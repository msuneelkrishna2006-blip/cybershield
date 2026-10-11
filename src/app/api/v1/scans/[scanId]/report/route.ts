/**
 * CyberShield India — Scan Report API
 * GET /api/v1/scans/[scanId]/report
 *
 * Generates a structured report from a completed scan record.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getAccessToken } from '@/lib/auth/cookies';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const token = getAccessToken(request);
    if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);

    try {
      await verifyAccessToken(token);
    } catch {
      return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    const { scanId } = await params;

    const scan = await prisma.scanRecord.findUnique({
      where: { id: scanId },
    });

    if (!scan) {
      return apiError('NOT_FOUND', 'Scan record not found', 404);
    }

    // Parse stored JSON fields
    let recommendations: string[] = [];
    let agentResults: any = {};
    try { recommendations = JSON.parse(scan.recommendations || '[]'); } catch { /* */ }
    try { agentResults = JSON.parse(scan.agentResults || '{}'); } catch { /* */ }

    // Build verdict based on risk level
    let verdict = '';
    if (scan.riskLevel === 'CRITICAL' || scan.riskLevel === 'HIGH') {
      verdict = `⚠️ Dangerous — ${scan.category.replace(/_/g, ' ')} detected. Do not interact with this content.`;
    } else if (scan.riskLevel === 'MEDIUM') {
      verdict = `⚠️ Caution — potential risks detected. Exercise care.`;
    } else if (scan.riskLevel === 'LOW') {
      verdict = `ℹ️ Low risk — minor concerns detected.`;
    } else {
      verdict = `✅ Safe — no significant threats detected.`;
    }

    // Map risk level to helpline
    const helpline = (scan.riskLevel === 'CRITICAL' || scan.riskLevel === 'HIGH')
      ? { number: '1930', name: 'National Cyber Crime Helpline' }
      : undefined;

    return apiSuccess({
      report: {
        id: scan.id,
        verdict,
        riskScore: scan.riskScore,
        riskLevel: scan.riskLevel,
        scanType: scan.type,
        category: scan.category,
        categoryName: scan.category.replace(/_/g, ' '),
        summary: scan.summary,
        indicators: agentResults.indicators || [],
        recommendations,
        agentResults: agentResults,
        helpline,
        scannedAt: scan.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Report] Error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to generate report', 500);
  }
}
