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
import { validateSession } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function POST(request: NextRequest) {
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
        token,
        userId: payload.userId,
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
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      });

      return apiError('TOKEN_REUSE', 'Token has been revoked. Please log in again.', 401);
    }

    // Validate the session is still active
    const session = await validateSession(payload.sessionId);
    if (!session) {
      return apiError('SESSION_EXPIRED', 'Session has expired. Please log in again.', 401);
    }

    // Revoke the old refresh token (rotation)
    await prisma.refreshToken.update({
      where: { token: storedToken.token },
      data: { revoked: true },
    });

    // Issue new tokens
    const newAccessToken = signAccessToken({
      userId: payload.userId,
      sessionId: payload.sessionId,
    });

    const newRefreshToken = signRefreshToken({
      userId: payload.userId,
      sessionId: payload.sessionId,
    });

    // Store new refresh token
    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: payload.userId,
        expiresAt: refreshExpiry,
      },
    });

    const response = apiSuccess({ message: 'Token refreshed' });
    setAuthCookies(response, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

    return response;
  } catch (error) {
    console.error('[Auth] Token refresh error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Token refresh failed', 500);
  }
}
