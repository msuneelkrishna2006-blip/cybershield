/**
 * Standardized API response helpers for Next.js Route Handlers
 */
import { NextResponse } from 'next/server';

/**
 * Returns a standard success response
 */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

/**
 * Returns a standard error response
 */
export function apiError(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
    },
    { status }
  );
}

/**
 * Returns a paginated success response
 */
export function apiPaginated<T>(data: T[], cursor?: string, hasMore?: boolean) {
  return NextResponse.json(
    {
      success: true,
      data,
      pagination: {
        cursor,
        hasMore: hasMore ?? false,
      },
    },
    { status: 200 }
  );
}
