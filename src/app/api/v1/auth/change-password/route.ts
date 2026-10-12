import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { getAccessToken } from '@/lib/auth/cookies';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { hashPassword, validatePasswordStrength, verifyPassword } from '@/lib/auth/password';
import { getRequestIp } from '@/lib/auth/rate-limit';
import { revokeAllUserSessions } from '@/lib/auth/session';
import { requireStepUp, markSessionReauthenticated } from '@/lib/auth/step-up';

const schema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
}).strict();

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
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Invalid password change request', 400);

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { credential: true },
  });
  const storedHash = user?.credential?.passwordHash || user?.passwordHash;
  if (!user || !storedHash || !(await verifyPassword(parsed.data.currentPassword, storedHash))) {
    return apiError('INVALID_CREDENTIALS', 'Current password is incorrect', 401);
  }
  if (!(await validatePasswordStrength(parsed.data.newPassword))) {
    return apiError('WEAK_PASSWORD', 'Choose a password that is not commonly used or known to be breached.', 400);
  }

  await markSessionReauthenticated(payload.sessionId);
  const authorization = await requireStepUp(request);
  if (!authorization.authorized) return authorization.response;
  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.$transaction(async transaction => {
    await transaction.credential.upsert({
      where: { userId: user.id },
      create: { userId: user.id, passwordHash },
      update: { passwordHash, passwordUpdatedAt: new Date() },
    });
    await transaction.user.update({
      where: { id: user.id },
      data: { passwordHash: null },
    });
  });

  await revokeAllUserSessions(user.id, payload.sessionId);
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, sessionId: { not: payload.sessionId }, revoked: false },
    data: { revoked: true },
  });
  await prisma.authAuditLog.create({
    data: {
      userId: user.id,
      eventType: 'PASSWORD_CHANGED',
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
    },
  });
  return apiSuccess({ message: 'Password changed. Other sessions have been revoked.' });
}
