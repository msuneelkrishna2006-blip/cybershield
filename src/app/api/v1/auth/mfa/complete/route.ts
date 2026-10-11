import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { setAuthCookies } from '@/lib/auth/cookies';
import { issueAuthTokens } from '@/lib/auth/jwt';
import {
  clearPendingMfaCookies,
  decryptTotpSecret,
  getPendingMfaCookies,
  hashRecoveryCode,
  incrementPendingMfaAttempt,
  matchingTotpStep,
} from '@/lib/auth/mfa';
import { hashRefreshToken } from '@/lib/auth/session';
import { authRateLimiter, getRequestIp, hashRateLimitKey } from '@/lib/auth/rate-limit';

const schema = z.object({
  code: z.string().regex(/^\d{6}$/).optional(),
  recoveryCode: z.string().min(8).max(32).optional(),
}).strict().refine(value => Boolean(value.code) !== Boolean(value.recoveryCode));

function invalidMfa() {
  return apiError('INVALID_MFA_CODE', 'The authenticator or recovery code is invalid or expired.', 401);
}

export async function POST(request: NextRequest) {
  if (!hasValidCsrfOrigin(request)) return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  const cookies = getPendingMfaCookies(request);
  if (!cookies) return apiError('MFA_CHALLENGE_EXPIRED', 'Sign in again to continue.', 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Enter a valid MFA code', 400);

  const pending = await prisma.pendingMfaChallenge.findFirst({
    where: {
      tokenHash: cookies.tokenHash,
      deviceHash: cookies.deviceHash,
      completedAt: null,
      expiresAt: { gt: new Date() },
      attempts: { lt: 5 },
    },
    select: { id: true, userId: true },
  });
  if (!pending) return apiError('MFA_CHALLENGE_EXPIRED', 'Sign in again to continue.', 401);

  const ip = getRequestIp(request);
  const [userLimit, ipLimit] = await Promise.all([
    authRateLimiter.consume(`mfa:user:${hashRateLimitKey(pending.userId)}`, 5, 15 * 60 * 1000),
    authRateLimiter.consume(`mfa:ip:${hashRateLimitKey(ip)}`, 20, 15 * 60 * 1000),
  ]);
  if (!userLimit.allowed || !ipLimit.allowed) return apiError('MFA_RATE_LIMITED', 'Too many MFA attempts. Try again later.', 429);

  const attempt = await incrementPendingMfaAttempt(cookies.tokenHash, cookies.deviceHash);
  if (!attempt) return invalidMfa();

  const [user, secretRecord] = await Promise.all([
    prisma.user.findUnique({
      where: { id: pending.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        emailVerifiedAt: true,
        lockedUntil: true,
        safetyScore: true,
        mfaEnabled: true,
      },
    }),
    prisma.mfaSecret.findUnique({ where: { userId: pending.userId } }),
  ]);
  if (
    !user
    || !user.mfaEnabled
    || !user.emailVerifiedAt
    || Boolean(user.lockedUntil && user.lockedUntil > new Date())
    || !secretRecord?.verifiedAt
  ) return invalidMfa();

  const totpStep = parsed.data.code
    ? matchingTotpStep(parsed.data.code, decryptTotpSecret(secretRecord.encryptedSecret))
    : null;
  if (parsed.data.code && totpStep === null) return invalidMfa();

  const challengeLost = Symbol('challenge-lost');
  let recoveryCodeUsed = false;
  let factorAccepted: boolean;
  try {
    factorAccepted = await prisma.$transaction(async transaction => {
      const factor = parsed.data.code
        ? await transaction.mfaSecret.updateMany({
          where: {
            userId: user.id,
            verifiedAt: { not: null },
            lastUsedStep: { lt: totpStep! },
          },
          data: { lastUsedStep: totpStep! },
        })
        : await transaction.recoveryCode.updateMany({
          where: {
            userId: user.id,
            codeHash: hashRecoveryCode(parsed.data.recoveryCode!),
            usedAt: null,
          },
          data: { usedAt: new Date() },
        });
      if (factor.count !== 1) return false;

      const completion = await transaction.pendingMfaChallenge.updateMany({
        where: { id: attempt.id, completedAt: null, expiresAt: { gt: new Date() } },
        data: { completedAt: new Date() },
      });
      if (completion.count !== 1) throw challengeLost;
      recoveryCodeUsed = Boolean(parsed.data.recoveryCode);
      return true;
    });
  } catch (error) {
    if (error !== challengeLost) throw error;
    return invalidMfa();
  }
  if (!factorAccepted) return invalidMfa();

  if (recoveryCodeUsed) {
    await prisma.authAuditLog.create({
      data: {
        userId: user.id,
        eventType: 'MFA_RECOVERY_CODE_USED',
        ipAddress: ip,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });
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
  clearPendingMfaCookies(response);
  return response;
}
