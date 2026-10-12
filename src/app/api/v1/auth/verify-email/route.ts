import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { consumeEmailToken } from '@/lib/auth/email-tokens';
import { authRateLimiter, getRequestIp, hashRateLimitKey } from '@/lib/auth/rate-limit';

const schema = z.object({ token: z.string().min(32).max(128) }).strict();

export async function POST(request: NextRequest) {
  if (!hasValidCsrfOrigin(request)) {
    return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  }
  const limit = await authRateLimiter.consume(
    `verify-email:ip:${hashRateLimitKey(getRequestIp(request))}`,
    20,
    60 * 60 * 1000,
  );
  if (!limit.allowed) return apiError('RATE_LIMITED', 'Please try again later.', 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid verification request', 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError('INVALID_TOKEN', 'Verification link is invalid or expired.', 400);

  const now = new Date();
  const result = await consumeEmailToken(parsed.data.token, 'verify_email', async (transaction, userId) => {
    await transaction.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: now },
    });
    await transaction.authAuditLog.create({
      data: {
        userId,
        eventType: 'EMAIL_VERIFIED',
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });
  }, now);

  if (!result) return apiError('INVALID_TOKEN', 'Verification link is invalid or expired.', 400);
  return apiSuccess({ message: 'Email verified. You can now sign in.' });
}
