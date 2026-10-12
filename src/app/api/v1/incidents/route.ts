/**
 * CyberShield India — Incidents API
 * GET /api/v1/incidents — List user's reported incidents
 * POST /api/v1/incidents — Report a new incident
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getAccessToken } from '@/lib/auth/cookies';
import { apiSuccess, apiError } from '@/lib/api/response';

const createIncidentSchema = z.object({
  description: z.string().min(10).max(5000),
  evidence: z.string().max(5000).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

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

    // Get user's family member IDs
    const members = await prisma.familyMember.findMany({
      where: { userId: payload.userId },
      select: { id: true },
    });
    const memberIds = members.map(m => m.id);

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const cursor = url.searchParams.get('cursor') || undefined;

    const incidents = await prisma.incident.findMany({
      where: {
        memberId: { in: memberIds },
        deletedAt: null,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      select: {
        id: true,
        description: true,
        evidence: true,
        lat: true,
        lng: true,
        createdAt: true,
      },
    });

    const hasMore = incidents.length > limit;
    const results = incidents.slice(0, limit);
    const nextCursor = hasMore && results.length > 0
      ? results[results.length - 1].createdAt.toISOString()
      : undefined;

    return apiSuccess({ incidents: results, hasMore, cursor: nextCursor });
  } catch (error) {
    console.error('[Incidents] GET error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to load incidents', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getAccessToken(request);
    if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);

    let payload;
    try {
      payload = await verifyAccessToken(token);
    } catch {
      return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    const body = await request.json();
    const parsed = createIncidentSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid incident data', 400, parsed.error.flatten().fieldErrors);
    }

    // Get user's primary family member record
    const member = await prisma.familyMember.findFirst({
      where: { userId: payload.userId },
    });

    if (!member) {
      return apiError('NO_FAMILY', 'You must be part of a family circle to report incidents', 400);
    }

    const incident = await prisma.incident.create({
      data: {
        memberId: member.id,
        description: parsed.data.description,
        evidence: parsed.data.evidence,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
      },
    });

    return apiSuccess({ incident }, 201);
  } catch (error) {
    console.error('[Incidents] POST error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to report incident', 500);
  }
}
