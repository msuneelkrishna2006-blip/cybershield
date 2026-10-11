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
const GENERIC_MESSAGE = 'If the account needs verification, a new message will be sent.';

async function genericVerificationResponse(startedAt: number) {
  await waitForMinimumResponseTime(startedAt);
  return apiSuccess({ message: GENERIC_MESSAGE }, 202);
}

export async function POST(request: NextRequest) {
  if (!hasValidCsrfOrigin(request)) {
    return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  }
  const startedAt = Date.now();
  const ipLimit = await authRateLimiter.consume(
    `verify-resend:ip:${hashRateLimitKey(getRequestIp(request))}`,
    10,
    60 * 60 * 1000,
  );

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid verification request', 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Invalid verification request', 400);
  if (!ipLimit.allowed) return genericVerificationResponse(startedAt);

  const email = parsed.data.email;
  const emailLimit = await authRateLimiter.consume(
    `verify-resend:email:${hashRateLimitKey(email)}`,
    3,
    60 * 60 * 1000,
  );
  if (!emailLimit.allowed) return genericVerificationResponse(startedAt);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, emailVerifiedAt: true },
  });
  if (!user?.email || user.emailVerifiedAt) {
    return genericVerificationResponse(startedAt);
  }

  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  await prisma.$transaction(async transaction => {
    await transaction.emailToken.updateMany({
      where: { userId: user.id, purpose: 'verify_email', usedAt: null },
      data: { usedAt: new Date() },
    });
    await transaction.emailToken.create({
      data: {
        userId: user.id,
        tokenHash,
        purpose: 'verify_email',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
  });

  const verificationUrl = new URL('/verify-email', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
  verificationUrl.searchParams.set('token', rawToken);
  scheduleAuthEmail({
    to: user.email,
    subject: 'Verify your CyberShield email',
    actionUrl: verificationUrl.toString(),
    purpose: 'verify_email',
  });
  return genericVerificationResponse(startedAt);
}
