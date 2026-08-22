/**
 * CyberShield India — Health Check API
 * GET /api/v1/health
 *
 * Returns system health status including database and cache connectivity.
 * Public endpoint — no authentication required.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PRODUCT } from '@/lib/config';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: string; latencyMs?: number; error?: string };
    redis: { status: string; latencyMs?: number; error?: string };
  };
}

export async function GET(_request: NextRequest) {
  const health: HealthStatus = {
    status: 'healthy',
    version: PRODUCT.version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: { status: 'unknown' },
      redis: { status: 'unknown' },
    },
  };

  // Check database connectivity
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database = {
      status: 'healthy',
      latencyMs: Date.now() - dbStart,
    };
  } catch (error) {
    health.checks.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Database connection failed',
    };
    health.status = 'degraded';
  }

  // Check Redis connectivity (placeholder — will be implemented with Redis client)
  try {
    // TODO: Replace with actual Redis ping when Redis client is configured
    health.checks.redis = {
      status: 'not_configured',
    };
  } catch (error) {
    health.checks.redis = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Redis connection failed',
    };
  }

  const httpStatus = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  return Response.json(health, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
