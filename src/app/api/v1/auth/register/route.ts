import { createHash, randomBytes } from 'crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { scheduleAuthEmail } from '@/lib/auth/email';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { authRateLimiter, getRequestIp, hashRateLimitKey } from '@/lib/auth/rate-limit';
import { waitForMinimumResponseTime } from '@/lib/auth/response-timing';

const registerSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().max(255).toLowerCase().trim(),
  phone: z.string().regex(/^(?:\+91)?[6-9]\d{9}$/).optional(),
  password: z.string().min(12).max(128),
}).strict();

const GENERIC_RESPONSE = 'If this email can be registered, a verification message will be sent.';

async function genericRegistrationResponse(startedAt: number) {
  await waitForMinimumResponseTime(startedAt);
  return apiSuccess({ message: GENERIC_RESPONSE }, 202);
}

export async function POST(request: NextRequest) {
  if (!hasValidCsrfOrigin(request)) {
    return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  }

  const startedAt = Date.now();
  const ip = getRequestIp(request);
  const ipLimit = await authRateLimiter.consume(`register:ip:${hashRateLimitKey(ip)}`, 10, 60 * 60 * 1000);
  if (!ipLimit.allowed) return genericRegistrationResponse(startedAt);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid registration data', 400);
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Invalid registration data', 400);

  const { name, email, phone, password } = parsed.data;
  if (!(await validatePasswordStrength(password))) {
    return apiError('WEAK_PASSWORD', 'Choose a password that is not commonly used or known to be breached.', 400);
  }

  const emailLimit = await authRateLimiter.consume(
    `register:email:${hashRateLimitKey(email)}`,
    5,
    60 * 60 * 1000,
  );
  if (!emailLimit.allowed) return genericRegistrationResponse(startedAt);

  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, ...(phone ? [{ phone: phone.startsWith('+') ? phone : `+91${phone}` }] : [])] },
    select: { id: true },
  });
  if (existing) return genericRegistrationResponse(startedAt);

  const normalizedPhone = phone ? (phone.startsWith('+') ? phone : `+91${phone}`) : undefined;
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  let userId: string;
  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: normalizedPhone,
        safetyScore: 100,
        scansToday: 0,
        totalScans: 0,
        failedAttempts: 0,
        credential: { create: { passwordHash } },
        emailTokens: {
          create: {
            tokenHash,
            purpose: 'verify_email',
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          },
        },
      },
      select: { id: true },
    });
    userId = user.id;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      return genericRegistrationResponse(startedAt);
    }
    throw error;
  }

  const verificationUrl = new URL('/verify-email', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
  verificationUrl.searchParams.set('token', rawToken);
  scheduleAuthEmail({
    to: email,
    subject: 'Verify your CyberShield email',
    actionUrl: verificationUrl.toString(),
    purpose: 'verify_email',
  });

  await prisma.authAuditLog.create({
    data: {
      userId,
      eventType: 'REGISTER',
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') || undefined,
    },
  });

  return genericRegistrationResponse(startedAt);
}
