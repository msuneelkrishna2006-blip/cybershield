import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { clearAuthCookies, getAccessToken } from '@/lib/auth/cookies';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getRequestIp } from '@/lib/auth/rate-limit';
import { revokeAllUserSessions } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  if (!hasValidCsrfOrigin(request)) return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  const token = getAccessToken(request);
  if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);
  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
  }

  await revokeAllUserSessions(payload.userId);
  await prisma.refreshToken.updateMany({
    where: { userId: payload.userId, revoked: false },
    data: { revoked: true },
  });
  await prisma.authAuditLog.create({
    data: {
      userId: payload.userId,
      eventType: 'ALL_SESSIONS_REVOKED',
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
    },
  });
  const response = apiSuccess({ message: 'All sessions have been revoked.' });
  clearAuthCookies(response);
  return response;
}
