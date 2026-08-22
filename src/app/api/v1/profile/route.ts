/**
 * CyberShield India — User Profile API
 * GET /api/v1/profile — Get current user profile
 * PATCH /api/v1/profile — Update profile
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getAccessToken } from '@/lib/auth/cookies';
import { apiSuccess, apiError } from '@/lib/api/response';

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  phone: z.string().regex(/^(\+91)?[6-9]\d{9}$/).optional(),
  language: z.string().min(2).max(5).optional(),
}).strict();

export async function GET(request: NextRequest) {
  try {
    const token = getAccessToken(request);
    if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        safetyScore: true,
        scansToday: true,
        totalScans: true,
        mfaEnabled: true,
        createdAt: true,
      },
    });

    if (!user) return apiError('NOT_FOUND', 'User not found', 404);

    return apiSuccess({ user });
  } catch (error) {
    console.error('[Profile] GET error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to load profile', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = getAccessToken(request);
    if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid profile data', 400, parsed.error.flatten().fieldErrors);
    }

    const updated = await prisma.user.update({
      where: { id: payload.userId },
      data: parsed.data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        safetyScore: true,
        mfaEnabled: true,
      },
    });

    return apiSuccess({ user: updated });
  } catch (error) {
    console.error('[Profile] PATCH error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to update profile', 500);
  }
}
