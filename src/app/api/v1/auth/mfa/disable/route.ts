import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { requireStepUp } from '@/lib/auth/step-up';
import { getRequestIp } from '@/lib/auth/rate-limit';

export async function POST(request: NextRequest) {
  if (!hasValidCsrfOrigin(request)) return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  const authorization = await requireStepUp(request);
  if (!authorization.authorized) return authorization.response;

  const { userId } = authorization.payload;
  await prisma.$transaction(async transaction => {
    await transaction.recoveryCode.deleteMany({ where: { userId } });
    await transaction.mfaSecret.deleteMany({ where: { userId } });
    await transaction.user.update({ where: { id: userId }, data: { mfaEnabled: false } });
    await transaction.session.updateMany({
      where: { userId, revokedAt: null, id: { not: authorization.payload.sessionId } },
      data: { revokedAt: new Date() },
    });
    await transaction.refreshToken.updateMany({
      where: {
        userId,
        revoked: false,
        OR: [
          { sessionId: null },
          { sessionId: { not: authorization.payload.sessionId } },
        ],
      },
      data: { revoked: true },
    });
  });
  await prisma.authAuditLog.create({
    data: {
      userId,
      eventType: 'MFA_DISABLED',
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
    },
  });
  return apiSuccess({ message: 'Multi-factor authentication disabled.' });
}
