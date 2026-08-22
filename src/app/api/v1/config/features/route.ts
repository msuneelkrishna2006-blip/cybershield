/**
 * CyberShield India — Feature Flags API
 * GET /api/v1/config/features
 *
 * Returns enabled feature flags for the client.
 * Public endpoint — used to conditionally render UI modules.
 */

import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET() {
  try {
    const flags = await prisma.featureFlag.findMany({
      select: {
        key: true,
        enabled: true,
        description: true,
      },
    });

    const features: Record<string, boolean> = {};
    for (const flag of flags) {
      features[flag.key] = flag.enabled;
    }

    return apiSuccess({ features }, 200);
  } catch (error) {
    console.error('[Config] Feature flags error:', error instanceof Error ? error.message : 'Unknown');

    // Return defaults on error so the app doesn't break
    return apiSuccess({
      features: {
        ai_scanning_enabled: true,
        child_safety_module: true,
        women_safety_module: true,
        elderly_mode: true,
        browser_extension_api: false,
        threat_feed_ingestion: false,
      },
    });
  }
}
