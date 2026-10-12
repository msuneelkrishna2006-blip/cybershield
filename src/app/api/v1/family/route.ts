import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getAccessToken } from '@/lib/auth/cookies';
import { apiSuccess, apiError } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { requireStepUp } from '@/lib/auth/step-up';

const familySchema = z.object({
  name: z.string().min(1, 'Family name is required'),
  relation: z.string().optional().default('self'),
});

export async function GET(request: NextRequest) {
  try {
    const token = getAccessToken(request);
    if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);
    
    let payload;
    try {
      payload = await verifyAccessToken(token);
    } catch {
      return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    const members = await prisma.familyMember.findMany({
      where: { userId: payload.userId },
      include: {
        family: {
          include: {
            members: {
              include: {
                user: {
                  select: { name: true, email: true }
                }
              }
            }
          }
        }
      }
    });

    const families = members.map(m => m.family);

    return apiSuccess(families);
  } catch (error) {
    console.error('Error in family GET:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(request: NextRequest) {
  if (!hasValidCsrfOrigin(request)) {
    return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  }
  const authorization = await requireStepUp(request, { guardianOnly: true });
  if (!authorization.authorized) return authorization.response;

  try {
    const payload = authorization.payload;

    const body = await request.json().catch(() => ({}));
    const parsed = familySchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid request body', 400, parsed.error.format());
    }

    const result = await prisma.$transaction(async (tx) => {
      const family = await tx.family.create({
        data: {
          name: parsed.data.name,
          ownerId: payload.userId,
        }
      });

      const member = await tx.familyMember.create({
        data: {
          userId: payload.userId,
          familyId: family.id,
          role: 'ADMIN',
          relation: parsed.data.relation,
        }
      });

      return { family, member };
    });

    return apiSuccess(result, 201);
  } catch (error) {
    console.error('Error in family POST:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
