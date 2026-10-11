/**
 * CyberShield India — Notification Preferences API
 * GET /api/v1/notifications/preferences
 * PATCH /api/v1/notifications/preferences
 *
 * Schema uses channel+category pairs: {userId, channel, category, enabled}
 * Channels: push, sms, email
 * Categories: security_alert, family_alert, scan_result, system
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getAccessToken } from '@/lib/auth/cookies';
import { apiSuccess, apiError } from '@/lib/api/response';

const CHANNELS = ['push', 'sms', 'email'] as const;
const CATEGORIES = ['security_alert', 'family_alert', 'scan_result', 'system'] as const;

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

    const prefs = await prisma.notificationPreference.findMany({
      where: { userId: payload.userId },
    });

    // Build a structured map: { channel: { category: enabled } }
    const structured: Record<string, Record<string, boolean>> = {};
    for (const ch of CHANNELS) {
      structured[ch] = {};
      for (const cat of CATEGORIES) {
        const pref = prefs.find(p => p.channel === ch && p.category === cat);
        structured[ch][cat] = pref?.enabled ?? true; // Default to enabled
      }
    }

    return apiSuccess({ preferences: structured, raw: prefs });
  } catch (error) {
    console.error('[Notifications] GET error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to load preferences', 500);
  }
}

const updateSchema = z.object({
  channel: z.enum(CHANNELS),
  category: z.enum(CATEGORIES),
  enabled: z.boolean(),
});

export async function PATCH(request: NextRequest) {
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
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid preferences', 400, parsed.error.flatten().fieldErrors);
    }

    const { channel, category, enabled } = parsed.data;

    const pref = await prisma.notificationPreference.upsert({
      where: {
        userId_channel_category: {
          userId: payload.userId,
          channel,
          category,
        },
      },
      update: { enabled },
      create: {
        userId: payload.userId,
        channel,
        category,
        enabled,
      },
    });

    return apiSuccess({ preference: pref });
  } catch (error) {
    console.error('[Notifications] PATCH error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to update preferences', 500);
  }
}
