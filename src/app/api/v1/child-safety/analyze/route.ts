import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getAccessToken } from '@/lib/auth/cookies';
import { apiSuccess, apiError } from '@/lib/api/response';
import { analyzeChildSafety } from '@/lib/agents/child-safety-agent';

const analyzeRequestSchema = z.object({
  text: z.string().min(1, "Text content is required"),
  childAge: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const token = await getAccessToken(request);
    let userId: string | undefined;
    
    if (token) {
      const decoded = await verifyAccessToken(token);
      if (decoded && decoded.userId) {
        userId = decoded.userId;
      }
    }
    
    // In a real app we might require auth for this endpoint, but we'll allow it 
    // depending on the exact requirements. Assuming it's authenticated.
    if (!userId) {
      return NextResponse.json(
        apiError('UNAUTHORIZED', 'Authentication required', 401),
        { status: 401 }
      );
    }

    // 2. Parse and validate request
    const body = await request.json();
    const result = analyzeRequestSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        apiError('VALIDATION_ERROR', 'Invalid request body', 400, result.error.errors),
        { status: 400 }
      );
    }

    const { text, childAge } = result.data;

    // 3. Analyze content using the Child Safety Agent
    const analysisResult = await analyzeChildSafety(text, childAge);

    // 4. Log metadata ONLY (never the raw text)
    // We assume there's a model like ScanLog or ChildSafetyLog.
    // We'll just create a general scan log if possible, or skip if the model doesn't exist.
    // For now we'll do a basic prisma call assuming a Scan table or similar, 
    // but the prompt says "only log metadata", maybe via console or a specific table.
    
    console.log(JSON.stringify({
      event: 'child_safety_scan',
      timestamp: new Date().toISOString(),
      userId,
      riskLevel: analysisResult.riskLevel,
      categories: analysisResult.categories,
      parentAlertTriggered: analysisResult.parentAlert
    }));

    // NOTE: We deliberately do NOT persist submitted text to the database.
    // Metadata (risk level, categories) is already logged above via structured console.log.

    // 5. Return structured response
    return NextResponse.json(apiSuccess(analysisResult));

  } catch (error) {
    console.error('Child safety analysis error:', error);
    return NextResponse.json(
      apiError('INTERNAL_ERROR', 'Failed to analyze content', 500),
      { status: 500 }
    );
  }
}
