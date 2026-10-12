/**
 * CyberShield India — Model Feedback API
 * POST /api/v1/scans/[scanId]/feedback
 *
 * Allows users to submit feedback on scan results.
 * This data is used to calibrate AI model accuracy over time.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getAccessToken } from '@/lib/auth/cookies';
import { apiSuccess, apiError } from '@/lib/api/response';

const feedbackSchema = z.object({
  feedback: z.enum(['accurate', 'false_positive', 'false_negative']),
  userComment: z.string().max(500).optional(),
});

export async function POST(
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
    const body = await request.json();
    const parsed = feedbackSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid feedback', 400, parsed.error.flatten().fieldErrors);
    }

    // Verify scan exists
    const scan = await prisma.scanRecord.findUnique({
      where: { id: scanId },
    });

    if (!scan) {
      return apiError('NOT_FOUND', 'Scan not found', 404);
    }

    // Store feedback
    const feedback = await prisma.modelFeedback.create({
      data: {
        scanRecordId: scanId,
        feedback: parsed.data.feedback,
        userComment: parsed.data.userComment,
      },
    });

    return apiSuccess({
      feedbackId: feedback.id,
      message: 'Thank you for your feedback. This helps improve our threat detection accuracy.',
    }, 201);
  } catch (error) {
    console.error('[Feedback] Error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to submit feedback', 500);
  }
}
