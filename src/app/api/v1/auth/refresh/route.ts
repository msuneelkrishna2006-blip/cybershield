/**
 * CyberShield India — Token Refresh API
 * POST /api/v1/auth/refresh
 *
 * Exchanges a valid refresh token for a new access + refresh token pair.
 * Implements token rotation — old refresh token is revoked on use.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyRefreshToken, signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { getRefreshToken, setAuthCookies } from '@/lib/auth/cookies';
import { consumeRefreshToken, hashRefreshToken, validateSession } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { authRateLimiter, getRequestIp, hashRateLimitKey } from '@/lib/auth/rate-limit';

export async function POST(request: NextRequest) {
  if (!hasValidCsrfOrigin(request)) {
    return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  }
  const limit = await authRateLimiter.consume(
    `refresh:ip:${hashRateLimitKey(getRequestIp(request))}`,
    60,
    15 * 60 * 1000,
  );
  if (!limit.allowed) return apiError('RATE_LIMITED', 'Too many attempts. Please try again later.', 429);
  try {
    const token = getRefreshToken(request);

    if (!token) {
      return apiError('NO_REFRESH_TOKEN', 'No refresh token provided', 401);
    }

    // Verify the refresh token JWT
    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      return apiError('INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired', 401);
    }

    // Check if the refresh token exists in DB and is not revoked
    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        token: hashRefreshToken(token),
        userId: payload.userId,
        sessionId: payload.sessionId,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!storedToken) {
      // Token reuse detected — revoke ALL user tokens for security
      await prisma.refreshToken.updateMany({
        where: { userId: payload.userId },
        data: { revoked: true },
      });

      await prisma.authAuditLog.create({
        data: {
          userId: payload.userId,
          eventType: 'TOKEN_REUSE_DETECTED',
          ipAddress: getRequestIp(request),
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      });

      return apiError('TOKEN_REUSE', 'Token has been revoked. Please log in again.', 401);
    }

    // Validate the session is still active
    const session = await validateSession(payload.sessionId, payload.sessionSecret);
    if (!session) {
      return apiError('SESSION_EXPIRED', 'Session has expired. Please log in again.', 401);
    }

    // Conditional consume prevents two concurrent refreshes from both rotating the same token.
    if (!(await consumeRefreshToken(token, payload.userId, payload.sessionId))) {
      await prisma.refreshToken.updateMany({
        where: { userId: payload.userId, revoked: false },
        data: { revoked: true },
      });
      await prisma.authAuditLog.create({
        data: {
          userId: payload.userId,
          eventType: 'TOKEN_REUSE_DETECTED',
          ipAddress: getRequestIp(request),
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      });
      return apiError('TOKEN_REUSE', 'Token has been revoked. Please log in again.', 401);
    }

    // Issue new tokens
    const newAccessToken = signAccessToken({
      userId: payload.userId,
      sessionId: payload.sessionId,
      sessionSecret: payload.sessionSecret,
    });

    const newRefreshToken = signRefreshToken({
      userId: payload.userId,
      sessionId: payload.sessionId,
      sessionSecret: payload.sessionSecret,
    });

    // Store new refresh token
    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: hashRefreshToken(newRefreshToken),
        userId: payload.userId,
        sessionId: payload.sessionId,
        expiresAt: refreshExpiry,
      },
    });

    const response = apiSuccess({ message: 'Token refreshed' });
    setAuthCookies(response, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

    return response;
  } catch {
    console.error('[Auth] Token refresh failed');
    return apiError('INTERNAL_ERROR', 'Token refresh failed', 500);
  }
}
