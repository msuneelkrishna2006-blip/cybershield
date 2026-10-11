/**
 * CyberShield India — Threat Feed API
 * GET /api/v1/threats/feed — List recent threat indicators
 * POST /api/v1/threats/feed — Submit a new indicator
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getAccessToken } from '@/lib/auth/cookies';
import { apiSuccess, apiError } from '@/lib/api/response';
import { requireStepUp } from '@/lib/auth/step-up';

export async function GET(request: NextRequest) {
  const authorization = await requireStepUp(request, { guardianOnly: true });
  if (!authorization.authorized) return authorization.response;

  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const type = url.searchParams.get('type') || undefined;
    const cursor = url.searchParams.get('cursor') || undefined;

    const indicators = await prisma.threatIndicator.findMany({
      where: {
        active: true,
        ...(type ? { type } : {}),
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        category: { select: { slug: true, nameEn: true, severity: true } },
      },
    });

    const hasMore = indicators.length > limit;
    const results = indicators.slice(0, limit);
    const nextCursor = hasMore && results.length > 0
      ? results[results.length - 1].createdAt.toISOString()
      : undefined;

    return apiSuccess({ indicators: results, hasMore, cursor: nextCursor });
  } catch (error) {
    console.error('[ThreatFeed] GET error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to load threat feed', 500);
  }
}

const submitIndicatorSchema = z.object({
  type: z.enum(['URL', 'DOMAIN', 'IP', 'PHONE', 'UPI_ID', 'HASH', 'PATTERN', 'KEYWORD']),
  value: z.string().min(1).max(2000),
  source: z.string().max(100).optional(),
  categorySlug: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const token = getAccessToken(request);
    if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);

    try {
      await verifyAccessToken(token);
    } catch {
      return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    const body = await request.json();
    const parsed = submitIndicatorSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid indicator data', 400, parsed.error.flatten().fieldErrors);
    }

    const { type, value, source, categorySlug, confidence } = parsed.data;

    // Look up category if slug provided
    let categoryId: string | null = null;
    if (categorySlug) {
      const category = await prisma.threatCategory.findUnique({ where: { slug: categorySlug } });
      if (category) categoryId = category.id;
    }

    // Check if indicator already exists
    const existing = await prisma.threatIndicator.findFirst({
      where: { type, value },
    });

    if (existing) {
      // Update confidence if higher
      const updated = await prisma.threatIndicator.update({
        where: { id: existing.id },
        data: {
          confidence: Math.max(existing.confidence, confidence || 0.5),
          active: true,
        },
      });
      return apiSuccess({ indicator: updated, updated: true });
    }

    const indicator = await prisma.threatIndicator.create({
      data: {
        type,
        value,
        source: source || 'community',
        confidence: confidence || 0.5,
        categoryId,
      },
    });

    return apiSuccess({ indicator }, 201);
  } catch (error) {
    console.error('[ThreatFeed] POST error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to submit indicator', 500);
  }
}
