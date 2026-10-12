import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { getAccessToken } from '@/lib/auth/cookies';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { authRateLimiter, getRequestIp, hashRateLimitKey } from '@/lib/auth/rate-limit';
import { consumeTotpStep, decryptTotpSecret, matchingTotpStep } from '@/lib/auth/mfa';
import { verifyPassword } from '@/lib/auth/password';
import { markSessionReauthenticated } from '@/lib/auth/step-up';

const schema = z.object({
  method: z.enum(['password', 'totp']),
  password: z.string().min(1).max(128).optional(),
  code: z.string().regex(/^\d{6}$/).optional(),
}).strict().refine(value => (
  value.method === 'password' ? Boolean(value.password) : Boolean(value.code)
));

export async function POST(request: NextRequest) {
  if (!hasValidCsrfOrigin(request)) return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  const token = getAccessToken(request);
  if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);
  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Re-authentication data is invalid', 400);
  const ip = getRequestIp(request);
  const [userLimit, ipLimit] = await Promise.all([
    authRateLimiter.consume(`step-up:user:${hashRateLimitKey(payload.userId)}`, 5, 15 * 60 * 1000),
    authRateLimiter.consume(`step-up:ip:${hashRateLimitKey(ip)}`, 20, 15 * 60 * 1000),
  ]);
  if (!userLimit.allowed || !ipLimit.allowed) return apiError('MFA_RATE_LIMITED', 'Too many re-authentication attempts.', 429);

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { credential: true, mfaSecretRecord: true },
  });
  if (!user) return apiError('UNAUTHORIZED', 'Authentication required', 401);

  let valid = false;
  if (parsed.data.method === 'password') {
    const storedHash = user.credential?.passwordHash || user.passwordHash;
    valid = Boolean(storedHash && await verifyPassword(parsed.data.password!, storedHash));
  } else if (user.mfaEnabled && user.mfaSecretRecord?.verifiedAt) {
    const secret = decryptTotpSecret(user.mfaSecretRecord.encryptedSecret);
    const step = matchingTotpStep(parsed.data.code!, secret);
    if (step !== null) {
      valid = await consumeTotpStep(user.id, step);
    }
  }

  if (!valid) {
    await prisma.authAuditLog.create({
      data: {
        userId: user.id,
        eventType: 'STEP_UP_FAILED',
        ipAddress: ip,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });
    return apiError('REAUTH_FAILED', 'Re-authentication failed.', 401);
  }

  await markSessionReauthenticated(payload.sessionId);
  await prisma.authAuditLog.create({
    data: {
      userId: user.id,
      eventType: 'STEP_UP_SUCCESS',
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') || undefined,
    },
  });
  return apiSuccess({ message: 'Re-authentication successful.' });
}
