import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { clearAuthCookies, getAccessToken } from '@/lib/auth/cookies';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getRequestIp } from '@/lib/auth/rate-limit';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  if (!hasValidCsrfOrigin(request)) return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  const token = getAccessToken(request);
  if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);
  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
  }
  const { sessionId } = await params;
  const revoked = await prisma.session.updateMany({
    where: { id: sessionId, userId: payload.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (!revoked.count) return apiError('NOT_FOUND', 'Active session not found', 404);

  await prisma.refreshToken.updateMany({
    where: { userId: payload.userId, sessionId, revoked: false },
    data: { revoked: true },
  });
  await prisma.authAuditLog.create({
    data: {
      userId: payload.userId,
      eventType: 'SESSION_REVOKED',
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
    },
  });

  const response = apiSuccess({ message: 'Session revoked.' });
  if (sessionId === payload.sessionId) clearAuthCookies(response);
  return response;
}
