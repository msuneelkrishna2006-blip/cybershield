import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getAccessToken } from '@/lib/auth/cookies';
import { apiSuccess, apiError } from '@/lib/api/response';

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
  relationship: z.string().optional(),
  priority: z.number().optional().default(0),
});

export async function GET(request: NextRequest) {
  try {
    const token = getAccessToken(request);
    if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);
    
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    const contacts = await prisma.emergencyContact.findMany({
      where: { userId: payload.userId },
      orderBy: { priority: 'desc' },
    });

    return apiSuccess(contacts);
  } catch (error) {
    console.error('Error in emergency contacts GET:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getAccessToken(request);
    if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);
    
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid request body', 400, parsed.error.format());
    }

    const contact = await prisma.emergencyContact.create({
      data: {
        userId: payload.userId,
        name: parsed.data.name,
        phone: parsed.data.phone,
        relationship: parsed.data.relationship,
        priority: parsed.data.priority,
      },
    });

    return apiSuccess(contact, 201);
  } catch (error) {
    console.error('Error in emergency contacts POST:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = getAccessToken(request);
    if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);
    
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return apiError('VALIDATION_ERROR', 'Contact ID is required', 400);
    }

    const existing = await prisma.emergencyContact.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== payload.userId) {
      return apiError('NOT_FOUND', 'Contact not found', 404);
    }

    await prisma.emergencyContact.delete({
      where: { id },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error('Error in emergency contacts DELETE:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
