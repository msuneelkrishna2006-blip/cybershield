/**
 * CyberShield India — Prometheus Metrics Endpoint
 * GET /api/v1/admin/prometheus
 *
 * Returns metrics in Prometheus text exposition format.
 * Protected: only accessible in development or with admin auth.
 */

import { NextRequest } from 'next/server';
import { getPrometheusMetrics, getMetricsSummary } from '@/lib/observability/metrics';

export async function GET(request: NextRequest) {
  // Access control
  if (process.env.NODE_ENV === 'production') {
    const metricsKey = process.env.METRICS_API_KEY;
    const providedKey = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!metricsKey || providedKey !== metricsKey) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const format = request.nextUrl.searchParams.get('format');

  if (format === 'json') {
    return Response.json(getMetricsSummary());
  }

  // Default: Prometheus text format
  return new Response(getPrometheusMetrics(), {
    headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' },
  });
}
