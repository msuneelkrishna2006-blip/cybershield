/**
 * CyberShield India — Scan Submission API
 * POST /api/v1/scans
 * GET /api/v1/scans
 *
 * Submit content for AI-powered threat analysis.
 * Returns risk score, category, indicators, and recommended actions.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getAccessToken } from '@/lib/auth/cookies';
import { analyzeWithFallback, getProviderChain } from '@/lib/ai';
import { apiSuccess, apiError } from '@/lib/api/response';
import type { ScanType } from '@/lib/ai';

const scanSubmitSchema = z.object({
  content: z.string().min(1).max(10000, 'Content must not exceed 10,000 characters').trim(),
  type: z.enum([
    'sms', 'whatsapp', 'email', 'url', 'social_media',
    'job_offer', 'loan_offer', 'investment', 'qr', 'general',
  ]),
  familyMemberId: z.string().optional(),
});

/**
 * POST /api/v1/scans — Submit content for analysis
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = getAccessToken(request);
    if (!token) {
      return apiError('UNAUTHORIZED', 'Authentication required', 401);
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    // Parse and validate input
    const body = await request.json();
    const parsed = scanSubmitSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid scan input', 400, parsed.error.flatten().fieldErrors);
    }

    const { content, type, familyMemberId } = parsed.data;

    // Run AI analysis with fallback chain
    const providers = getProviderChain();
    const { result, provider, fallback } = await analyzeWithFallback(providers, {
      content,
      type: type as ScanType,
    });

    // Determine family member context
    let memberId = familyMemberId;
    if (!memberId) {
      // Find the user's default family member record
      const member = await prisma.familyMember.findFirst({
        where: { userId: payload.userId },
      });
      memberId = member?.id;
    }

    // Store scan record
    const scanRecord = memberId ? await prisma.scanRecord.create({
      data: {
        memberId,
        type,
        input: content.substring(0, 500), // Store truncated input only
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        category: result.category,
        summary: result.explanation,
        recommendations: JSON.stringify(result.safeNextSteps),
        agentResults: JSON.stringify({
          provider,
          fallback,
          indicators: result.indicators,
          confidence: result.confidence,
          recommendedAction: result.recommendedAction,
        }),
      },
    }) : null;

    // Update user scan count
    await prisma.user.update({
      where: { id: payload.userId },
      data: {
        scansToday: { increment: 1 },
        totalScans: { increment: 1 },
      },
    });

    // If high risk, create a family alert
    if (result.riskScore >= 50 && memberId) {
      const member = await prisma.familyMember.findUnique({
        where: { id: memberId },
        include: { family: true },
      });

      if (member) {
        await prisma.familyAlert.create({
          data: {
            familyId: member.familyId,
            memberId: member.id,
            type: 'scam_detection',
            severity: result.riskLevel === 'CRITICAL' ? 'critical' : 'high',
            title: `${result.riskLevel} Risk: ${result.category.replace(/_/g, ' ')}`,
            description: result.explanation.substring(0, 500),
          },
        });
      }
    }

    return apiSuccess({
      scanId: scanRecord?.id,
      result: {
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        category: result.category,
        confidence: result.confidence,
        indicators: result.indicators,
        explanation: result.explanation,
        recommendedAction: result.recommendedAction,
        safeNextSteps: result.safeNextSteps,
      },
      metadata: {
        provider,
        fallback,
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Scan] Analysis error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Scan analysis failed. Please try again.', 500);
  }
}

/**
 * GET /api/v1/scans — List user's scan history
 */
export async function GET(request: NextRequest) {
  try {
    const token = getAccessToken(request);
    if (!token) {
      return apiError('UNAUTHORIZED', 'Authentication required', 401);
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const cursor = url.searchParams.get('cursor') || undefined;

    // Find user's family member records
    const members = await prisma.familyMember.findMany({
      where: { userId: payload.userId },
      select: { id: true },
    });

    const memberIds = members.map(m => m.id);

    if (memberIds.length === 0) {
      return apiSuccess({ scans: [], hasMore: false });
    }

    const scans = await prisma.scanRecord.findMany({
      where: {
        memberId: { in: memberIds },
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      select: {
        id: true,
        type: true,
        riskScore: true,
        riskLevel: true,
        category: true,
        summary: true,
        createdAt: true,
      },
    });

    const hasMore = scans.length > limit;
    const results = scans.slice(0, limit);
    const nextCursor = hasMore && results.length > 0
      ? results[results.length - 1].createdAt.toISOString()
      : undefined;

    return apiSuccess({
      scans: results,
      hasMore,
      cursor: nextCursor,
    });
  } catch (error) {
    console.error('[Scan] List error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to retrieve scan history', 500);
  }
}
