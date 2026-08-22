/**
 * CyberShield India — Women Safety Check-in API
 * POST /api/v1/women-safety/[sessionId]/check-in
 *
 * Records a check-in during a safe walk session.
 * If SOS, triggers emergency escalation.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getAccessToken } from '@/lib/auth/cookies';
import { apiSuccess, apiError } from '@/lib/api/response';

const checkInSchema = z.object({
  response: z.enum(['SAFE', 'EXTEND', 'SOS']),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const token = getAccessToken(request);
    if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    const { sessionId } = await params;
    const body = await request.json();
    const parsed = checkInSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid check-in data', 400, parsed.error.flatten().fieldErrors);
    }

    // Verify session belongs to user and is active
    const session = await prisma.safetySession.findFirst({
      where: {
        id: sessionId,
        userId: payload.userId,
        status: 'ACTIVE',
      },
    });

    if (!session) {
      return apiError('NOT_FOUND', 'Active session not found', 404);
    }

    const now = new Date();
    const { response } = parsed.data;

    // Create the check-in record
    const checkIn = await prisma.checkIn.create({
      data: {
        sessionId,
        promptedAt: now,
        respondedAt: now,
        response,
        graceEndsAt: new Date(now.getTime() + session.graceWindow * 60 * 1000),
      },
    });

    // Handle response type
    if (response === 'SOS') {
      // Escalate: mark session as ESCALATED
      await prisma.safetySession.update({
        where: { id: sessionId },
        data: { status: 'ESCALATED' },
      });

      // Create emergency SOS event if user has a family member record
      const member = await prisma.familyMember.findFirst({
        where: { userId: payload.userId },
      });

      if (member) {
        await prisma.emergencySosEvent.create({
          data: {
            memberId: member.id,
            lat: parsed.data.lat,
            lng: parsed.data.lng,
            locationStatus: 'SOS_FROM_SAFETY_SESSION',
          },
        });
      }

      // Audit log
      await prisma.authAuditLog.create({
        data: {
          userId: payload.userId,
          eventType: 'SOS_TRIGGERED_FROM_SESSION',
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      });

      return apiSuccess({
        checkIn: { id: checkIn.id, response },
        escalated: true,
        message: 'SOS triggered. Emergency contacts are being notified.',
        helplines: {
          emergency: '112',
          cyberCrime: '1930',
          women: '181',
        },
      });
    }

    if (response === 'EXTEND') {
      // Extend session by another interval
      const newExpiry = new Date(session.expiresAt.getTime() + session.checkInInterval * 60 * 1000);
      const nextCheckIn = new Date(now.getTime() + session.checkInInterval * 60 * 1000);

      await prisma.safetySession.update({
        where: { id: sessionId },
        data: {
          expiresAt: newExpiry,
          nextCheckInAt: nextCheckIn,
        },
      });

      return apiSuccess({
        checkIn: { id: checkIn.id, response },
        extended: true,
        nextCheckInAt: nextCheckIn.toISOString(),
        expiresAt: newExpiry.toISOString(),
      });
    }

    // SAFE response — schedule next check-in
    const nextCheckIn = new Date(now.getTime() + session.checkInInterval * 60 * 1000);
    await prisma.safetySession.update({
      where: { id: sessionId },
      data: {
        status: 'CHECKED_IN_SAFE',
        nextCheckInAt: nextCheckIn,
      },
    });

    return apiSuccess({
      checkIn: { id: checkIn.id, response },
      nextCheckInAt: nextCheckIn.toISOString(),
      message: 'Check-in recorded. Stay safe!',
    });
  } catch (error) {
    console.error('[CheckIn] Error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Check-in failed', 500);
  }
}
