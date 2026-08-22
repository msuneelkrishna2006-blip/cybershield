import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getAccessToken } from '@/lib/auth/cookies';
import { apiSuccess, apiError } from '@/lib/api/response';

const sosSchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  locationStatus: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const token = getAccessToken(request);
    if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);
    
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = sosSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid request body', 400, parsed.error.format());
    }

    const member = await prisma.familyMember.findFirst({
      where: { userId: payload.userId },
    });

    if (!member) {
      return apiError('FORBIDDEN', 'User is not part of a family', 403);
    }

    const sosEvent = await prisma.emergencySosEvent.create({
      data: {
        memberId: member.id,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        locationStatus: parsed.data.locationStatus,
      },
    });

    await prisma.authAuditLog.create({
      data: {
        userId: payload.userId,
        eventType: 'SOS_EVENT_TRIGGERED',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('remote-addr') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }
    });

    return apiSuccess(sosEvent, 201);
  } catch (error) {
    console.error('Error in SOS POST:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
