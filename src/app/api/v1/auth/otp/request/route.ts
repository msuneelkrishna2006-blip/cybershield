import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { getAccessToken } from '@/lib/auth/cookies';
import { verifyAccessToken } from '@/lib/auth/jwt';
import {
  createOtpChallengeId,
  generateOtpCode,
  hashOtpCode,
  normalizeIndianPhoneNumber,
  type OtpPurpose,
} from '@/lib/auth/otp';
import { authRateLimiter, getRequestIp, hashRateLimitKey } from '@/lib/auth/rate-limit';
import { waitForMinimumResponseTime } from '@/lib/auth/response-timing';
import { scheduleOtpSms } from '@/lib/auth/sms';

const schema = z.object({
  phone: z.string().min(10).max(13),
  purpose: z.enum(['login', 'verify_phone']).default('login'),
}).strict();
const GENERIC_MESSAGE = 'If this number is eligible, a verification code will be sent.';

async function genericResponse(startedAt: number) {
  await waitForMinimumResponseTime(startedAt);
  return apiSuccess({ message: GENERIC_MESSAGE }, 202);
}

export async function POST(request: NextRequest) {
  if (!hasValidCsrfOrigin(request)) {
    return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  }

  const startedAt = Date.now();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid OTP request', 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Invalid OTP request', 400);

  const phone = normalizeIndianPhoneNumber(parsed.data.phone);
  if (!phone) return apiError('VALIDATION_ERROR', 'Enter a valid Indian mobile number.', 400);

  const purpose: OtpPurpose = parsed.data.purpose;
  let verificationUserId: string | undefined;
  if (purpose === 'verify_phone') {
    const token = getAccessToken(request);
    if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);
    try {
      verificationUserId = (await verifyAccessToken(token)).userId;
    } catch {
      return apiError('UNAUTHORIZED', 'Authentication required', 401);
    }
  }

  const ip = getRequestIp(request);
  const [ipLimit, phoneLimit] = await Promise.all([
    authRateLimiter.consume(`otp:ip:${hashRateLimitKey(ip)}`, 20, 60 * 60 * 1000),
    authRateLimiter.consume(`otp:phone:${hashRateLimitKey(phone)}`, 5, 60 * 60 * 1000),
  ]);
  if (!ipLimit.allowed || !phoneLimit.allowed) return genericResponse(startedAt);

  const cooldown = await prisma.otpChallenge.findFirst({
    where: { phone, sentAt: { gt: new Date(Date.now() - 60_000) } },
    select: { id: true },
  });
  if (cooldown) return genericResponse(startedAt);

  let userId: string | null = null;
  if (purpose === 'login') {
    const user = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        lockedUntil: true,
      },
    });
    if (
      !user
      || !user.emailVerifiedAt
      || !user.phoneVerifiedAt
      || Boolean(user.lockedUntil && user.lockedUntil > new Date())
    ) {
      return genericResponse(startedAt);
    }
    userId = user.id;
  } else {
    const [user, phoneOwner] = await Promise.all([
      prisma.user.findUnique({
        where: { id: verificationUserId },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { phone },
        select: { id: true },
      }),
    ]);
    if (!user || (phoneOwner && phoneOwner.id !== verificationUserId)) {
      return genericResponse(startedAt);
    }
    userId = verificationUserId!;
  }

  const challengeId = createOtpChallengeId();
  const code = generateOtpCode();
  const now = new Date();
  await prisma.$transaction(async transaction => {
    await transaction.otpChallenge.updateMany({
      where: { phone, purpose, usedAt: null },
      data: { usedAt: now },
    });
    await transaction.otpChallenge.create({
      data: {
        id: challengeId,
        userId,
        phone,
        purpose,
        codeHash: hashOtpCode(challengeId, phone, code),
        attempts: 0,
        maxAttempts: 5,
        sentAt: now,
        expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      },
    });
  });

  await prisma.authAuditLog.create({
    data: {
      userId,
      eventType: 'OTP_SENT',
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') || undefined,
    },
  });
  scheduleOtpSms({ to: phone, code });
  return genericResponse(startedAt);
}
