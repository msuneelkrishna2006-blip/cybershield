/**
 * CyberShield India — Women Safety API
 * POST /api/v1/women-safety — Start a safe walk session
 * GET /api/v1/women-safety — Get active safety sessions
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getAccessToken } from '@/lib/auth/cookies';
import { apiSuccess, apiError } from '@/lib/api/response';

const createSessionSchema = z.object({
  activityLabel: z.string().min(1).max(200),
  destination: z.string().max(500).optional(),
  expectedDuration: z.number().int().min(5).max(720), // 5 min to 12 hours
  checkInInterval: z.number().int().min(5).max(60).optional(), // default 15 min
  notes: z.string().max(1000).optional(),
});

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
    const parsed = createSessionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid session data', 400, parsed.error.flatten().fieldErrors);
    }

    const { activityLabel, destination, expectedDuration, checkInInterval, notes } = parsed.data;
    const interval = checkInInterval || 15;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expectedDuration * 60 * 1000);
    const nextCheckInAt = new Date(now.getTime() + interval * 60 * 1000);

    const session = await prisma.safetySession.create({
      data: {
        userId: payload.userId,
        activityLabel,
        destination,
        expectedDuration,
        checkInInterval: interval,
        graceWindow: 5,
        notes,
        status: 'ACTIVE',
        expiresAt,
        nextCheckInAt,
      },
    });

    return apiSuccess({
      session: {
        id: session.id,
        activityLabel: session.activityLabel,
        status: session.status,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
        nextCheckInAt: session.nextCheckInAt,
        checkInInterval: session.checkInInterval,
      },
      message: `Safe walk session started. Check-ins every ${interval} minutes.`,
    }, 201);
  } catch (error) {
    console.error('[WomenSafety] POST error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to create safety session', 500);
  }
}

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

    const sessions = await prisma.safetySession.findMany({
      where: {
        userId: payload.userId,
        status: 'ACTIVE',
      },
      orderBy: { startedAt: 'desc' },
      include: {
        checkIns: {
          orderBy: { promptedAt: 'desc' },
          take: 5,
        },
      },
    });

    return apiSuccess({ sessions });
  } catch (error) {
    console.error('[WomenSafety] GET error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to load safety sessions', 500);
  }
}
