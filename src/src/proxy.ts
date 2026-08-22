import { NextRequest, NextResponse } from 'next/server';
import { getSecurityHeaders } from '@/lib/security/headers';
import { generateCorrelationId } from '@/lib/security/correlation';
import { authLimiter, generalLimiter } from '@/lib/security/rate-limiter';
import { getAuthConfig } from '@/lib/auth/config';

// Note: Next.js middleware runs in the Edge Runtime.
// Full JWT verification requires 'jose' for Edge compatibility.
// For now, we check token presence and let API routes do full verification.

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

const PUBLIC_ROUTES = [
  '/',
  '/about',
  '/contact',
  '/login',
  '/register',
  '/api/v1/health',
  '/api/v1/threats/stats',
  '/api/v1/threats/categories',
  '/api/v1/emergency/helplines',
  '/api/v1/config/features',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 1. Generate Correlation ID
  const correlationId = request.headers.get('x-request-id') || generateCorrelationId();

  // Create response to modify headers
  const response = NextResponse.next();
  response.headers.set('x-request-id', correlationId);
  
  // 2. Apply Security Headers
  const securityHeaders = getSecurityHeaders();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // 3. Rate Limiting for API routes
  if (pathname.startsWith('/api')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    const isAuthRoute = pathname.startsWith('/api/v1/auth');
    
    const limitResult = isAuthRoute ? authLimiter(ip) : generalLimiter(ip);
    
    response.headers.set('X-RateLimit-Limit', isAuthRoute ? '5' : '100');
    response.headers.set('X-RateLimit-Remaining', limitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', limitResult.resetAt.toISOString());

    if (!limitResult.allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
        { status: 429, headers: response.headers }
      );
    }
  }

  // 4. Auth check for protected routes
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname) || pathname.startsWith('/api/v1/auth/');
  const isProtectedRoute = pathname.startsWith('/app') || pathname.startsWith('/dashboard');

  let isAuthenticated = false;
  
  try {
    const authConfig = getAuthConfig();
    const token = request.cookies.get(authConfig.SESSION_COOKIE_NAME)?.value;
    
    if (token) {
      // Presence check only — full verification happens in API route handlers.
      // Edge Runtime cannot run jsonwebtoken; use 'jose' for Edge-compatible verification.
      isAuthenticated = true;
    }
  } catch {
    isAuthenticated = false;
  }

  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
