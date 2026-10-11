import { createHash, randomBytes } from 'crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { scheduleAuthEmail } from '@/lib/auth/email';
import { authRateLimiter, getRequestIp, hashRateLimitKey } from '@/lib/auth/rate-limit';
import { waitForMinimumResponseTime } from '@/lib/auth/response-timing';

const schema = z.object({ email: z.string().email().max(255).toLowerCase().trim() }).strict();
const GENERIC_MESSAGE = 'If an account exists for that email, password reset instructions will be sent.';

async function genericResetResponse(startedAt: number) {
  await waitForMinimumResponseTime(startedAt);
  return apiSuccess({ message: GENERIC_MESSAGE }, 202);
}

export async function POST(request: NextRequest) {
  if (!hasValidCsrfOrigin(request)) {
    return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  }

  const startedAt = Date.now();
  const ipLimit = await authRateLimiter.consume(
    `password-reset:ip:${hashRateLimitKey(getRequestIp(request))}`,
    10,
    60 * 60 * 1000,
  );
  if (!ipLimit.allowed) return genericResetResponse(startedAt);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid password reset request', 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Invalid password reset request', 400);
  const { email } = parsed.data;

  const emailLimit = await authRateLimiter.consume(
    `password-reset:email:${hashRateLimitKey(email)}`,
    3,
    60 * 60 * 1000,
  );
  if (!emailLimit.allowed) return genericResetResponse(startedAt);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, emailVerifiedAt: true },
  });
  if (!user?.email || !user.emailVerifiedAt) return genericResetResponse(startedAt);

  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  await prisma.emailToken.create({
    data: {
      userId: user.id,
      tokenHash,
      purpose: 'reset_password',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });
  const resetUrl = new URL('/reset-password', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
  resetUrl.searchParams.set('token', rawToken);
  scheduleAuthEmail({
    to: user.email,
    subject: 'Reset your CyberShield password',
    actionUrl: resetUrl.toString(),
    purpose: 'reset_password',
  });

  await prisma.authAuditLog.create({
    data: {
      userId: user.id,
      eventType: 'PASSWORD_RESET_REQUESTED',
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
    },
  });
  return genericResetResponse(startedAt);
}
