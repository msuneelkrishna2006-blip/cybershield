import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { clearAuthCookies } from '@/lib/auth/cookies';
import { requireStepUp } from '@/lib/auth/step-up';
import { getRequestIp } from '@/lib/auth/rate-limit';

export async function DELETE(request: NextRequest) {
  if (!hasValidCsrfOrigin(request)) return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  const authorization = await requireStepUp(request);
  if (!authorization.authorized) return authorization.response;

  await prisma.authAuditLog.create({
    data: {
      userId: authorization.payload.userId,
      eventType: 'ACCOUNT_DELETED',
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
    },
  });
  await prisma.user.delete({ where: { id: authorization.payload.userId } });
  const response = apiSuccess({ message: 'Account deleted.' });
  clearAuthCookies(response);
  return response;
}
