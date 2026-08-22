import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiSuccess, apiError } from '@/lib/api/response';
import { checkIndicator } from '@/lib/threat-feed/ingestion';

const lookupSchema = z.object({
  type: z.enum(['URL', 'DOMAIN', 'IP', 'HASH', 'PHONE', 'UPI_ID']),
  value: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, value } = lookupSchema.parse(body);

    const result = await checkIndicator(type, value);

    return apiSuccess(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('VALIDATION_ERROR', 'Invalid lookup parameters', 400, error.errors);
    }
    console.error('Error in IOC lookup:', error);
    return apiError('INTERNAL_ERROR', 'Failed to perform IOC lookup', 500);
  }
}
