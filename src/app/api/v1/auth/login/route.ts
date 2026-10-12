import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { setAuthCookies } from '@/lib/auth/cookies';
import { issueAuthTokens } from '@/lib/auth/jwt';
import { hashPassword, verifyPassword, verifyUnknownUserPassword } from '@/lib/auth/password';
import { hashRefreshToken } from '@/lib/auth/session';
import { authRateLimiter, getRequestIp, hashRateLimitKey } from '@/lib/auth/rate-limit';
import { waitForMinimumResponseTime } from '@/lib/auth/response-timing';
import { createPendingMfaResponse, shouldRequireMfaChallenge } from '@/lib/auth/mfa';
import { getAuthConfig } from '@/lib/auth/config';

const loginSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim(),
  password: z.string().min(1).max(128),
}).strict();

const INVALID_CREDENTIALS = () => apiError('INVALID_CREDENTIALS', 'Invalid credentials', 401);

const MINIMUM_INVALID_LOGIN_DURATION_MS = 2_000;

export async function POST(request: NextRequest) {
  if (!hasValidCsrfOrigin(request)) {
    return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  }

  const startedAt = Date.now();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid login request', 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Invalid login request', 400);

  const { email, password } = parsed.data;
  const ip = getRequestIp(request);
  const ipLimit = await authRateLimiter.consume(`login:ip:${hashRateLimitKey(ip)}`, 30, 15 * 60 * 1000);
  const accountLimit = await authRateLimiter.consume(
    `login:email:${hashRateLimitKey(email)}`,
    15,
    15 * 60 * 1000,
  );
  if (!ipLimit.allowed || !accountLimit.allowed) {
    return apiError('RATE_LIMITED', 'Too many attempts. Please try again later.', 429);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      credential: true,
      mfaSecretRecord: { select: { verifiedAt: true } },
    },
  });
  const storedHash = user?.credential?.passwordHash || user?.passwordHash;
  const passwordMatches = storedHash
    ? await verifyPassword(password, storedHash)
    : (await verifyUnknownUserPassword(password), false);
  const isLocked = Boolean(user?.lockedUntil && user.lockedUntil > new Date());

  if (!user || !storedHash || !passwordMatches || !user.emailVerifiedAt || isLocked) {
    if (user && storedHash && (!passwordMatches || isLocked)) {
      const failedUser = await prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: { increment: 1 } },
        select: { failedAttempts: true },
      });
      if (failedUser.failedAttempts >= 5) {
        const lockoutMinutes = Math.min(60 * 24, 15 * 2 ** Math.min(failedUser.failedAttempts - 5, 6));
        await prisma.user.update({
          where: { id: user.id },
          data: { lockedUntil: new Date(Date.now() + lockoutMinutes * 60 * 1000) },
        });
      }
    }
    await prisma.authAuditLog.create({
      data: {
        userId: user?.id,
        eventType: 'LOGIN_FAILED',
        ipAddress: ip,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });
    await waitForMinimumResponseTime(startedAt, MINIMUM_INVALID_LOGIN_DURATION_MS);
    return INVALID_CREDENTIALS();
  }

  if (storedHash.startsWith('$2')) {
    const upgradedHash = await hashPassword(password);
    await prisma.$transaction(async transaction => {
      await transaction.credential.upsert({
        where: { userId: user.id },
        create: { userId: user.id, passwordHash: upgradedHash },
        update: { passwordHash: upgradedHash, passwordUpdatedAt: new Date() },
      });
      await transaction.user.update({
        where: { id: user.id },
        data: { passwordHash: null },
      });
    });
    await waitForMinimumResponseTime(startedAt, MINIMUM_INVALID_LOGIN_DURATION_MS);
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
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: {
      token: hashRefreshToken(refreshToken),
      userId: user.id,
      sessionId: session.id,
      expiresAt: refreshExpiry,
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
