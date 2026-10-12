/**
 * CyberShield India — Child Safety Alerts API
 * GET /api/v1/child-safety/[childId]/alerts
 *
 * Lists safety alerts for a specific child profile.
 * Only guardians/adults of the child's family can view.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getAccessToken } from '@/lib/auth/cookies';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  try {
    const token = getAccessToken(request);
    if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);

    let payload;
    try {
      payload = await verifyAccessToken(token);
    } catch {
      return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    const { childId } = await params;

    // Get the child profile and verify access
    const childProfile = await prisma.childProfile.findUnique({
      where: { id: childId },
      include: {
        member: { select: { familyId: true } },
      },
    });

    if (!childProfile) return apiError('NOT_FOUND', 'Child profile not found', 404);

    // Verify user is guardian/adult of this family
    const userAuth = await prisma.familyMember.findFirst({
      where: {
        familyId: childProfile.member.familyId,
        userId: payload.userId,
        role: { in: ['guardian', 'adult'] },
      },
    });

    if (!userAuth) return apiError('FORBIDDEN', 'Access denied', 403);

    // Get alerts with pagination
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const cursor = url.searchParams.get('cursor') || undefined;

    const alerts = await prisma.childSafetyAlert.findMany({
      where: {
        childProfileId: childId,
        ...(cursor ? { timestamp: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: limit + 1,
      select: {
        id: true,
        patternType: true,
        severitySummary: true,
        timestamp: true,
        parentNotified: true,
      },
    });

    const hasMore = alerts.length > limit;
    const results = alerts.slice(0, limit);
    const nextCursor = hasMore && results.length > 0
      ? results[results.length - 1].timestamp.toISOString()
      : undefined;

    return apiSuccess({
      alerts: results,
      hasMore,
      cursor: nextCursor,
    });
  } catch (error) {
    console.error('[ChildSafety] Alerts error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to load alerts', 500);
  }
}
