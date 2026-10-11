/**
 * CyberShield India — Logout API
 * POST /api/v1/auth/logout
 *
 * Revokes the current session, clears auth cookies,
 * and records the logout in the audit log.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAccessToken } from '@/lib/auth/cookies';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { revokeSession } from '@/lib/auth/session';
import { clearAuthCookies } from '@/lib/auth/cookies';
import { apiSuccess, apiError } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { getRequestIp } from '@/lib/auth/rate-limit';

export async function POST(request: NextRequest) {
  if (!hasValidCsrfOrigin(request)) {
    return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  }
  try {
    const token = getAccessToken(request);

    if (token) {
      try {
        const payload = await verifyAccessToken(token);

        // Revoke the current session
        await revokeSession(payload.sessionId);

        // Revoke the refresh token
        await prisma.refreshToken.updateMany({
          where: { userId: payload.userId, sessionId: payload.sessionId, revoked: false },
          data: { revoked: true },
        });

        // Audit log
        await prisma.authAuditLog.create({
          data: {
            userId: payload.userId,
            eventType: 'LOGOUT',
            ipAddress: getRequestIp(request),
            userAgent: request.headers.get('user-agent') || 'unknown',
          },
        });
      } catch {
        // Token may be expired/invalid — still clear cookies
      }
    }

    const response = apiSuccess({ message: 'Logged out successfully' });
    clearAuthCookies(response);
    return response;
  } catch (error) {
    console.error('[Auth] Logout error:', error instanceof Error ? error.message : 'Unknown');
    // Still clear cookies even on error
    const response = apiSuccess({ message: 'Logged out' });
    clearAuthCookies(response);
    return response;
  }
}
