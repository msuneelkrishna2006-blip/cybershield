import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { getAccessToken, setAuthCookies } from '@/lib/auth/cookies';
import { verifyAccessToken, issueAuthTokens } from '@/lib/auth/jwt';
import {
  normalizeIndianPhoneNumber,
  type OtpPurpose,
  verifyOtpCode,
} from '@/lib/auth/otp';
import { authRateLimiter, getRequestIp, hashRateLimitKey } from '@/lib/auth/rate-limit';
import { hashRefreshToken } from '@/lib/auth/session';
import { createPendingMfaResponse, shouldRequireMfaChallenge } from '@/lib/auth/mfa';
import { getAuthConfig } from '@/lib/auth/config';
import { markSessionReauthenticated } from '@/lib/auth/step-up';

const schema = z.object({
  phone: z.string().min(10).max(13),
  code: z.string().regex(/^\d{6}$/),
  purpose: z.enum(['login', 'verify_phone', 'step_up']).default('login'),
}).strict();

function invalidCode() {
  return apiError('INVALID_OTP', 'The verification code is invalid or expired.', 400);
}

export async function POST(request: NextRequest) {
  if (!hasValidCsrfOrigin(request)) {
    return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid OTP verification request', 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Invalid OTP verification request', 400);

  const phone = normalizeIndianPhoneNumber(parsed.data.phone);
  if (!phone) return apiError('VALIDATION_ERROR', 'Invalid OTP verification request', 400);
  const purpose: OtpPurpose = parsed.data.purpose;

  let verificationUserId: string | undefined;
  if (purpose !== 'login') {
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
    authRateLimiter.consume(`otp-verify:ip:${hashRateLimitKey(ip)}`, 30, 60 * 60 * 1000),
    authRateLimiter.consume(`otp-verify:phone:${hashRateLimitKey(phone)}`, 10, 60 * 60 * 1000),
  ]);
  if (!ipLimit.allowed || !phoneLimit.allowed) return invalidCode();

  const consumedChallenge = await verifyOtpCode(
    phone,
    purpose,
    parsed.data.code,
    new Date(),
    verificationUserId,
  );
  if (!consumedChallenge) return invalidCode();

  if (purpose === 'step_up') {
    if (consumedChallenge.user_id !== verificationUserId) return invalidCode();
    const user = await prisma.user.findUnique({
      where: { id: verificationUserId },
      select: { phone: true, phoneVerifiedAt: true, emailVerifiedAt: true },
    });
    if (!user?.phoneVerifiedAt || !user.emailVerifiedAt || user.phone !== phone) return invalidCode();
    const accessToken = getAccessToken(request);
    if (!accessToken) return apiError('UNAUTHORIZED', 'Authentication required', 401);
    const payload = await verifyAccessToken(accessToken);
    await markSessionReauthenticated(payload.sessionId);
    await prisma.authAuditLog.create({
      data: {
        userId: verificationUserId,
        eventType: 'STEP_UP_SUCCESS',
        ipAddress: ip,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });
    return apiSuccess({ message: 'Re-authentication successful.' });
  }

  if (purpose === 'verify_phone') {
    if (consumedChallenge.user_id !== verificationUserId) return invalidCode();
    try {
      await prisma.user.update({
        where: { id: verificationUserId },
        data: { phone, phoneVerifiedAt: new Date() },
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        await prisma.authAuditLog.create({
          data: {
            userId: verificationUserId,
            eventType: 'PHONE_VERIFICATION_CONFLICT',
            ipAddress: ip,
            userAgent: request.headers.get('user-agent') || undefined,
          },
        });
        return invalidCode();
      }
      throw error;
    }
    await prisma.authAuditLog.create({
      data: {
        userId: verificationUserId,
        eventType: 'PHONE_VERIFIED',
        ipAddress: ip,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });
    return apiSuccess({ message: 'Phone number verified.' });
  }

  if (!consumedChallenge.user_id) return invalidCode();
  const user = await prisma.user.findUnique({
    where: { id: consumedChallenge.user_id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      lockedUntil: true,
      safetyScore: true,
      mfaEnabled: true,
      mfaSecretRecord: { select: { verifiedAt: true } },
      role: true,
    },
  });
  if (
    !user
    || user.phone !== phone
    || !user.phoneVerifiedAt
    || !user.emailVerifiedAt
    || Boolean(user.lockedUntil && user.lockedUntil > new Date())
  ) {
    await prisma.authAuditLog.create({
      data: {
        userId: user?.id,
        eventType: 'LOGIN_FAILED',
        ipAddress: ip,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });
    return invalidCode();
  }

  if (shouldRequireMfaChallenge(user.mfaEnabled, user.mfaSecretRecord?.verifiedAt)) {
    const response = apiError('MFA_REQUIRED', 'Complete multi-factor authentication to sign in.', 403);
    await prisma.authAuditLog.create({
      data: {
        userId: user.id,
        eventType: 'MFA_PENDING',
        ipAddress: ip,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });
    return createPendingMfaResponse(user.id, response);
  }

  if (user.role === 'GUARDIAN' && getAuthConfig().MFA_REQUIRED_FOR_GUARDIANS) {
    return apiError('MFA_SETUP_REQUIRED', 'Set up multi-factor authentication before signing in.', 403);
  }

  const { session, accessToken, refreshToken } = await issueAuthTokens(user.id, user.email, request);
  await prisma.refreshToken.create({
    data: {
      token: hashRefreshToken(refreshToken),
      userId: user.id,
      sessionId: session.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null },
  });
  await prisma.authAuditLog.create({
    data: {
      userId: user.id,
      eventType: 'LOGIN_SUCCESS',
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') || undefined,
    },
  });

  const response = apiSuccess({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      safetyScore: user.safetyScore,
      mfaEnabled: user.mfaEnabled,
    },
    sessionId: session.id,
  });
  setAuthCookies(response, { accessToken, refreshToken });
  return response;
}
