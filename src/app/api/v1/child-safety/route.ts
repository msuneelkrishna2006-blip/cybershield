/**
 * CyberShield India — Child Safety API
 * GET /api/v1/child-safety — List child profiles
 * POST /api/v1/child-safety — Create a child profile
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getAccessToken } from '@/lib/auth/cookies';
import { apiSuccess, apiError } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { requireStepUp } from '@/lib/auth/step-up';

const createChildProfileSchema = z.object({
  memberId: z.string().uuid().optional(),
  profileId: z.string().uuid().optional(),
  ageTier: z.enum(['child', 'tween', 'teen']).optional(),
  screenTimeRules: z.union([
    z.string().max(2000),
    z.record(z.string(), z.unknown()).refine(value => JSON.stringify(value).length <= 2000),
  ]).optional(),
  deviceRestrictions: z.union([
    z.string().max(2000),
    z.record(z.string(), z.unknown()).refine(value => JSON.stringify(value).length <= 2000),
  ]).optional(),
}).strict().refine(data => (
  data.profileId
    ? Boolean(data.screenTimeRules || data.deviceRestrictions) && !data.memberId
    : Boolean(data.memberId && data.ageTier)
));

export async function GET(request: NextRequest) {
  try {
    const token = getAccessToken(request);
    if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);

    let payload;
    try {
      payload = await verifyAccessToken(token);
    } catch {
      return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    // Get families where user is guardian/adult
    const userFamilies = await prisma.familyMember.findMany({
      where: { userId: payload.userId, role: { in: ['guardian', 'adult'] } },
      select: { familyId: true },
    });

    const familyIds = userFamilies.map(f => f.familyId);

    if (familyIds.length === 0) {
      return apiSuccess({ childProfiles: [] });
    }

    // Get all child members in those families
    const childMembers = await prisma.familyMember.findMany({
      where: { familyId: { in: familyIds }, role: 'child' },
      select: { id: true },
    });

    const childMemberIds = childMembers.map(m => m.id);

    // Get child profiles for those members
    const childProfiles = await prisma.childProfile.findMany({
      where: { memberId: { in: childMemberIds } },
      include: {
        member: {
          select: { id: true, familyId: true, role: true, user: { select: { name: true } } },
        },
        childSafetyAlerts: {
          take: 5,
          orderBy: { id: 'desc' },
        },
      },
    });

    return apiSuccess({ childProfiles });
  } catch (error) {
    console.error('[ChildSafety] GET error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to load child profiles', 500);
  }
}

export async function POST(request: NextRequest) {
  if (!hasValidCsrfOrigin(request)) return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  const authorization = await requireStepUp(request, { guardianOnly: true });
  if (!authorization.authorized) return authorization.response;
  try {
    const payload = authorization.payload;

    const body = await request.json();
    const parsed = createChildProfileSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid input', 400, parsed.error.flatten().fieldErrors);
    }

    if (parsed.data.profileId) {
      const profile = await prisma.childProfile.findUnique({
        where: { id: parsed.data.profileId },
        select: { id: true, member: { select: { familyId: true } } },
      });
      if (!profile) return apiError('NOT_FOUND', 'Child profile not found', 404);
      const userAuth = await prisma.familyMember.findFirst({
        where: {
          familyId: profile.member.familyId,
          userId: payload.userId,
          role: { in: ['guardian', 'adult'] },
        },
        select: { id: true },
      });
      if (!userAuth) return apiError('FORBIDDEN', 'Only guardians can update child profiles', 403);

      const childProfile = await prisma.childProfile.update({
        where: { id: profile.id },
        data: {
          ...(parsed.data.screenTimeRules
            ? { screenTimeRules: serializeRule(parsed.data.screenTimeRules) }
            : {}),
          ...(parsed.data.deviceRestrictions
            ? { deviceRestrictions: serializeRule(parsed.data.deviceRestrictions) }
            : {}),
        },
      });
      await prisma.authAuditLog.create({
        data: { userId: payload.userId, eventType: 'CHILD_SAFETY_SETTINGS_CHANGED' },
      });
      return apiSuccess({ childProfile });
    }

    // Verify the target member exists and user is guardian of that family
    const targetMember = await prisma.familyMember.findUnique({
      where: { id: parsed.data.memberId! },
      select: { familyId: true, role: true },
    });

    if (!targetMember) return apiError('NOT_FOUND', 'Family member not found', 404);

    const userAuth = await prisma.familyMember.findFirst({
      where: {
        familyId: targetMember.familyId,
        userId: payload.userId,
        role: { in: ['guardian', 'adult'] },
      },
    });

    if (!userAuth) return apiError('FORBIDDEN', 'Only guardians can create child profiles', 403);

    // Check if profile already exists
    const existing = await prisma.childProfile.findUnique({
      where: { memberId: parsed.data.memberId! },
    });

    if (existing) return apiError('CONFLICT', 'Child profile already exists for this member', 409);

    const childProfile = await prisma.childProfile.create({
      data: {
        memberId: parsed.data.memberId!,
        ageTier: parsed.data.ageTier!,
        screenTimeRules: parsed.data.screenTimeRules
          ? serializeRule(parsed.data.screenTimeRules)
          : undefined,
        deviceRestrictions: parsed.data.deviceRestrictions
          ? serializeRule(parsed.data.deviceRestrictions)
          : undefined,
      },
    });

    return apiSuccess({ childProfile }, 201);
  } catch (error) {
    console.error('[ChildSafety] POST error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to create child profile', 500);
  }

  function serializeRule(value: string | Record<string, unknown>): string {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
}
