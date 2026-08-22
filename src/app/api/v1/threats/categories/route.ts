/**
 * CyberShield India — Threat Feed API
 * GET /api/v1/threats/feed
 * GET /api/v1/threats/categories
 *
 * Returns threat intelligence feed and category taxonomy.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getAccessToken } from '@/lib/auth/cookies';
import { apiSuccess, apiError } from '@/lib/api/response';

/**
 * GET /api/v1/threats/categories — List threat categories
 * Public endpoint for the taxonomy.
 */
export async function GET(request: NextRequest) {
  try {
    // Check if this is a categories or feed request based on path
    const url = new URL(request.url);

    const categories = await prisma.threatCategory.findMany({
      where: { active: true },
      orderBy: [
        { parentId: 'asc' },
        { slug: 'asc' },
      ],
      select: {
        id: true,
        slug: true,
        nameEn: true,
        nameHi: true,
        severity: true,
        description: true,
        parentId: true,
      },
    });

    // Build tree structure
    const topLevel = categories.filter(c => !c.parentId);
    const tree = topLevel.map(parent => ({
      ...parent,
      children: categories.filter(c => c.parentId === parent.id),
    }));

    return apiSuccess({
      categories: tree,
      totalCategories: categories.length,
    }, 200);
  } catch (error) {
    console.error('[Threats] Categories error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to load threat categories', 500);
  }
}
