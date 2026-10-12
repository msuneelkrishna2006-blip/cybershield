import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { consumeEmailToken } from '@/lib/auth/email-tokens';
import { clearAuthCookies } from '@/lib/auth/cookies';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { authRateLimiter, getRequestIp, hashRateLimitKey } from '@/lib/auth/rate-limit';

const schema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(12).max(128),
}).strict();

export async function POST(request: NextRequest) {
  if (!hasValidCsrfOrigin(request)) {
    return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  }
  const limit = await authRateLimiter.consume(
    `password-reset:complete:${hashRateLimitKey(getRequestIp(request))}`,
    10,
    60 * 60 * 1000,
  );
  if (!limit.allowed) return apiError('RATE_LIMITED', 'Please try again later.', 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid password reset request', 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Invalid password reset request', 400);
  if (!(await validatePasswordStrength(parsed.data.password))) {
    return apiError('WEAK_PASSWORD', 'Choose a password that is not commonly used or known to be breached.', 400);
  }

  const now = new Date();
  const newPasswordHash = await hashPassword(parsed.data.password);
  const reset = await consumeEmailToken(parsed.data.token, 'reset_password', async (transaction, userId) => {
    await transaction.credential.upsert({
      where: { userId },
      create: { userId, passwordHash: newPasswordHash },
      update: { passwordHash: newPasswordHash, passwordUpdatedAt: now },
    });
    await transaction.user.update({
      where: { id: userId },
      data: { passwordHash: null, failedAttempts: 0, lockedUntil: null },
    });
    await transaction.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
    await transaction.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
    await transaction.authAuditLog.create({
      data: {
        userId,
        eventType: 'PASSWORD_RESET_COMPLETED',
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });
  }, now);

  if (!reset) return apiError('INVALID_TOKEN', 'Password reset link is invalid or expired.', 400);
  const response = apiSuccess({ message: 'Password reset successfully. Please sign in again.' });
  clearAuthCookies(response);
  return response;
}
