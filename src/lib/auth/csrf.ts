import { NextRequest } from 'next/server';

const TRUSTED_ORIGINS = new Set([
  'https://cybershield.in',
  'https://www.cybershield.in',
]);

export function hasValidCsrfOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  let parsedOrigin: string;
  try {
    parsedOrigin = new URL(origin).origin;
  } catch {
    return false;
  }

  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;
  const allowedOrigins = new Set(TRUSTED_ORIGINS);
  if (configuredOrigin) {
    try {
      allowedOrigins.add(new URL(configuredOrigin).origin);
    } catch {
      return false;
    }
  } else if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.add(request.nextUrl.origin);
  }

  return allowedOrigins.has(parsedOrigin)
    && request.headers.get('sec-fetch-site') !== 'cross-site';
}

