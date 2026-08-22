import { NextRequest, NextResponse } from 'next/server';
import { getAuthConfig } from './config';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Sets secure HTTP-only cookies for authentication
 */
export function setAuthCookies(response: NextResponse, { accessToken, refreshToken }: Tokens) {
  const config = getAuthConfig();
  const isProduction = process.env.NODE_ENV === 'production';
  
  response.cookies.set(config.SESSION_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api',
    maxAge: 15 * 60, // 15 minutes
  });

  response.cookies.set(config.REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth/refresh',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
  
  return response;
}

/**
 * Clears the authentication cookies
 */
export function clearAuthCookies(response: NextResponse) {
  const config = getAuthConfig();
  const isProduction = process.env.NODE_ENV === 'production';

  response.cookies.set(config.SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api',
    maxAge: 0,
  });

  response.cookies.set(config.REFRESH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth/refresh',
    maxAge: 0,
  });
  
  return response;
}

/**
 * Retrieves the access token from cookies
 */
export function getAccessToken(request: NextRequest): string | undefined {
  const config = getAuthConfig();
  return request.cookies.get(config.SESSION_COOKIE_NAME)?.value;
}

/**
 * Retrieves the refresh token from cookies
 */
export function getRefreshToken(request: NextRequest): string | undefined {
  const config = getAuthConfig();
  return request.cookies.get(config.REFRESH_COOKIE_NAME)?.value;
}
