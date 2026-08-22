/**
 * CyberShield India — Admin Feature Flags Management API
 * PATCH /api/v1/admin/features/[key]
 *
 * Toggle feature flags. Admin-only endpoint.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api/response';

const updateFlagSchema = z.object({
  enabled: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    // TODO: Proper admin auth middleware in Phase 10
    if (process.env.NODE_ENV === 'production') {
      return apiError('UNAUTHORIZED', 'Admin authentication required', 401);
    }

    const { key } = await params;
    const body = await request.json();
    const parsed = updateFlagSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid input', 400);
    }

    const flag = await prisma.featureFlag.update({
      where: { key },
      data: { enabled: parsed.data.enabled },
    });

    return apiSuccess({
      key: flag.key,
      enabled: flag.enabled,
      message: `Feature '${key}' ${flag.enabled ? 'enabled' : 'disabled'}`,
    });
  } catch (error) {
    console.error('[Admin] Feature flag error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('NOT_FOUND', 'Feature flag not found', 404);
  }
}
