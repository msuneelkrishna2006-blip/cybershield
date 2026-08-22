import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Generates a unique correlation ID
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Injects a correlation ID into the request headers if not present,
 * and ensures it is included in the response headers.
 */
export function withCorrelationId(request: NextRequest, response: NextResponse): NextResponse {
  let correlationId = request.headers.get('X-Request-Id');
  
  if (!correlationId) {
    correlationId = generateCorrelationId();
    // NextRequest headers are read-only, but in middleware we can clone headers
    // or just ensure we pass it along. Here we mutate the response headers.
  }
  
  response.headers.set('X-Request-Id', correlationId);
  return response;
}
