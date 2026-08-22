/**
 * CyberShield India — User Sessions API
 * GET /api/v1/auth/sessions — List active sessions
 * DELETE /api/v1/auth/sessions — Revoke all other sessions
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getAccessToken } from '@/lib/auth/cookies';
import { listUserSessions, revokeAllUserSessions } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const token = getAccessToken(request);
    if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    const sessions = await listUserSessions(payload.userId);

    return apiSuccess({
      sessions: sessions.map(s => ({
        id: s.id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
        isCurrent: s.id === payload.sessionId,
      })),
    });
  } catch (error) {
    console.error('[Sessions] List error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to list sessions', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = getAccessToken(request);
    if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    // Revoke all sessions except current
    await revokeAllUserSessions(payload.userId);

    // Re-create current session (keep user logged in)
    // The current token remains valid until it expires

    // Revoke all refresh tokens except for current session
    await prisma.refreshToken.updateMany({
      where: {
        userId: payload.userId,
        revoked: false,
      },
      data: { revoked: true },
    });

    await prisma.authAuditLog.create({
      data: {
        userId: payload.userId,
        eventType: 'ALL_SESSIONS_REVOKED',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return apiSuccess({ message: 'All other sessions have been revoked' });
  } catch (error) {
    console.error('[Sessions] Revoke error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to revoke sessions', 500);
  }
}
