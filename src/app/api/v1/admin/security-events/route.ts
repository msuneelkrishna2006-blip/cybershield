/**
 * CyberShield India — Security Events API
 * GET /api/v1/admin/security-events
 *
 * Lists security events for the admin SOC.
 * Supports filtering by type, severity, and time range.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const eventType = url.searchParams.get('type') || undefined;
    const severity = url.searchParams.get('severity') || undefined;
    const hours = parseInt(url.searchParams.get('hours') || '24');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const cursor = url.searchParams.get('cursor') || undefined;

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const events = await prisma.securityEvent.findMany({
      where: {
        createdAt: { gte: since },
        ...(eventType ? { eventType } : {}),
        ...(severity ? { severity } : {}),
        ...(cursor ? { createdAt: { lt: new Date(cursor), gte: since } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      select: {
        id: true,
        eventType: true,
        severity: true,
        sourceIp: true,
        userId: true,
        details: true,
        createdAt: true,
      },
    });

    const hasMore = events.length > limit;
    const results = events.slice(0, limit);
    const nextCursor = hasMore && results.length > 0
      ? results[results.length - 1].createdAt.toISOString()
      : undefined;

    return apiSuccess({
      events: results,
      hasMore,
      cursor: nextCursor,
    });
  } catch (error) {
    console.error('[Admin] Security events error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to load security events', 500);
  }
}
