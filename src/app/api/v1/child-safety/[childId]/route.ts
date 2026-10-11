import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { requireStepUp } from '@/lib/auth/step-up';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> },
) {
  if (!hasValidCsrfOrigin(request)) return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  const authorization = await requireStepUp(request, { guardianOnly: true });
  if (!authorization.authorized) return authorization.response;

  const { childId } = await params;
  const profile = await prisma.childProfile.findUnique({
    where: { id: childId },
    select: { id: true, member: { select: { familyId: true } } },
  });
  if (!profile) return apiError('NOT_FOUND', 'Child profile not found', 404);
  const membership = await prisma.familyMember.findFirst({
    where: {
      userId: authorization.payload.userId,
      familyId: profile.member.familyId,
      role: { in: ['guardian', 'adult'] },
    },
    select: { id: true },
  });
  if (!membership) return apiError('FORBIDDEN', 'Access denied', 403);

  await prisma.childProfile.delete({ where: { id: childId } });
  await prisma.authAuditLog.create({
    data: {
      userId: authorization.payload.userId,
      eventType: 'CHILD_PROFILE_DELETED',
    },
  });
  return apiSuccess({ message: 'Child profile deleted.' });
}
