import { NextRequest } from 'next/server';
import { apiError } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';
import { getAccessToken } from './cookies';
import { verifyAccessToken, type JwtPayload } from './jwt';

const STEP_UP_WINDOW_MS = 10 * 60 * 1000;

export type StepUpResult =
  | { authorized: true; payload: JwtPayload }
  | { authorized: false; response: ReturnType<typeof apiError> };

export async function requireStepUp(
  request: NextRequest,
  options: { guardianOnly?: boolean } = {},
): Promise<StepUpResult> {
  const token = getAccessToken(request);
  if (!token) {
    return { authorized: false, response: apiError('UNAUTHORIZED', 'Authentication required', 401) };
  }

  let payload: JwtPayload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return { authorized: false, response: apiError('UNAUTHORIZED', 'Invalid or expired token', 401) };
  }

  if (options.guardianOnly) {
    const [user, familyMembership] = await Promise.all([
      prisma.user.findUnique({
        where: { id: payload.userId },
        select: { role: true },
      }),
      prisma.familyMember.findFirst({
        where: {
          userId: payload.userId,
          role: { in: ['guardian', 'adult', 'ADMIN'] },
        },
        select: { id: true },
      }),
    ]);
    if (
      !user
      || user.role === 'CHILD'
      || (!['GUARDIAN', 'ADMIN'].includes(user.role) && !familyMembership)
    ) {
      return { authorized: false, response: apiError('FORBIDDEN', 'Guardian access required', 403) };
    }
  }

  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId },
    select: { userId: true, lastReauthAt: true },
  });
  const now = Date.now();
  if (
    !session
    || session.userId !== payload.userId
    || !session.lastReauthAt
    || session.lastReauthAt.getTime() > now
    || now - session.lastReauthAt.getTime() > STEP_UP_WINDOW_MS
  ) {
    return {
      authorized: false,
      response: apiError('STEP_UP_REQUIRED', 'Re-authenticate to continue.', 403),
    };
  }

  return { authorized: true, payload };
}

export async function markSessionReauthenticated(sessionId: string): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { lastReauthAt: new Date() },
  });
}
