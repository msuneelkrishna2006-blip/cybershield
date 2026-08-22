/**
 * CyberShield India — System Metrics API
 * GET /api/v1/admin/metrics — Get metrics for a time range
 * POST /api/v1/admin/metrics — Record a system metric
 *
 * Schema: {metricKey, value, period, recordedAt}
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    // Dev-only access check (proper admin auth in Phase 10)
    if (process.env.NODE_ENV === 'production') {
      return apiError('UNAUTHORIZED', 'Admin authentication required', 401);
    }

    const url = new URL(request.url);
    const metricKey = url.searchParams.get('key') || undefined;
    const period = url.searchParams.get('period') || undefined;
    const hours = parseInt(url.searchParams.get('hours') || '24');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const metrics = await prisma.systemMetric.findMany({
      where: {
        recordedAt: { gte: since },
        ...(metricKey ? { metricKey } : {}),
        ...(period ? { period } : {}),
      },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });

    return apiSuccess({ metrics, count: metrics.length });
  } catch (error) {
    console.error('[Metrics] GET error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to load metrics', 500);
  }
}

const metricSchema = z.object({
  metricKey: z.string().min(1).max(100),
  value: z.number(),
  period: z.enum(['hourly', 'daily', 'weekly', 'monthly']),
  recordedAt: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return apiError('UNAUTHORIZED', 'Admin authentication required', 401);
    }

    const body = await request.json();
    const parsed = metricSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid metric data', 400, parsed.error.flatten().fieldErrors);
    }

    const metric = await prisma.systemMetric.create({
      data: {
        metricKey: parsed.data.metricKey,
        value: parsed.data.value,
        period: parsed.data.period,
        recordedAt: parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : new Date(),
      },
    });

    return apiSuccess({ metric }, 201);
  } catch (error) {
    console.error('[Metrics] POST error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to record metric', 500);
  }
}
