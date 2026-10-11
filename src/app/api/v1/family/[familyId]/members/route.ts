import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getAccessToken } from '@/lib/auth/cookies';
import { apiSuccess, apiError } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { requireStepUp } from '@/lib/auth/step-up';

const memberSchema = z.object({
  role: z.string().min(1, 'Role is required'),
  relation: z.string().min(1, 'Relation is required'),
  userId: z.string().optional(),
  ageTier: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ familyId: string }> }) {
  try {
    const token = getAccessToken(request);
    if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);
    
    let payload;
    try {
      payload = await verifyAccessToken(token);
    } catch {
      return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    const { familyId } = await params;

    const isMember = await prisma.familyMember.findFirst({
      where: { userId: payload.userId, familyId }
    });

    if (!isMember) {
      return apiError('FORBIDDEN', 'Access denied to this family', 403);
    }

    const members = await prisma.familyMember.findMany({
      where: { familyId },
      include: {
        user: {
          select: { name: true, email: true }
        }
      }
    });

    return apiSuccess(members);
  } catch (error) {
    console.error('Error in family members GET:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ familyId: string }> }) {
  if (!hasValidCsrfOrigin(request)) {
    return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  }
  const authorization = await requireStepUp(request, { guardianOnly: true });
  if (!authorization.authorized) return authorization.response;

  try {
    const payload = authorization.payload;

    const { familyId } = await params;

    const adminMember = await prisma.familyMember.findFirst({
      where: { userId: payload.userId, familyId, role: 'ADMIN' }
    });

    if (!adminMember) {
      return apiError('FORBIDDEN', 'Admin access required', 403);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = memberSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid request body', 400, parsed.error.format());
    }

    const newMember = await prisma.familyMember.create({
      data: {
        familyId,
        role: parsed.data.role,
        relation: parsed.data.relation,
        userId: parsed.data.userId || null,
        ageTier: parsed.data.ageTier,
      }
    });

    return apiSuccess(newMember, 201);
  } catch (error) {
    console.error('Error in family members POST:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
