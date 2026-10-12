import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import {
  createRecoveryCodes,
  decryptTotpSecret,
  hashRecoveryCode,
  matchingTotpStep,
} from '@/lib/auth/mfa';
import { markSessionReauthenticated, requireStepUp } from '@/lib/auth/step-up';
import { authRateLimiter, getRequestIp, hashRateLimitKey } from '@/lib/auth/rate-limit';

const schema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();

export async function POST(request: NextRequest) {
  if (!hasValidCsrfOrigin(request)) return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  const authorization = await requireStepUp(request);
  if (!authorization.authorized) return authorization.response;
  const { userId, sessionId } = authorization.payload;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Enter a valid authenticator code', 400);
  const [userLimit, ipLimit] = await Promise.all([
    authRateLimiter.consume(`mfa-enroll:user:${hashRateLimitKey(userId)}`, 5, 15 * 60 * 1000),
    authRateLimiter.consume(`mfa-enroll:ip:${hashRateLimitKey(getRequestIp(request))}`, 20, 15 * 60 * 1000),
  ]);
  if (!userLimit.allowed || !ipLimit.allowed) {
    return apiError('MFA_RATE_LIMITED', 'Too many MFA setup attempts. Try again later.', 429);
  }
  const secretRecord = await prisma.mfaSecret.findUnique({ where: { userId } });
  if (!secretRecord || secretRecord.verifiedAt) {
    return apiError('MFA_ENROLLMENT_NOT_FOUND', 'No pending MFA enrollment was found', 409);
  }

  const secret = decryptTotpSecret(secretRecord.encryptedSecret);
  const step = matchingTotpStep(parsed.data.code, secret);
  if (step === null) return apiError('INVALID_MFA_CODE', 'The authenticator code is invalid or expired', 400);

  const codes = createRecoveryCodes();
  const activated = await prisma.$transaction(async transaction => {
    const activated = await transaction.mfaSecret.updateMany({
      where: { userId, verifiedAt: null, lastUsedStep: { lt: step } },
      data: { verifiedAt: new Date(), lastUsedStep: step },
    });
    if (activated.count !== 1) return false;

    await transaction.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });
    await transaction.recoveryCode.deleteMany({ where: { userId } });
    await transaction.recoveryCode.createMany({
      data: codes.map(code => ({ userId, codeHash: hashRecoveryCode(code) })),
    });
    return true;
  });
  if (!activated) return apiError('INVALID_MFA_CODE', 'The authenticator code is invalid or already used', 401);

  await markSessionReauthenticated(sessionId);
  await prisma.authAuditLog.create({
    data: {
      userId,
      eventType: 'MFA_ENABLED',
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
    },
  });
  return apiSuccess({ recoveryCodes: codes });
}
