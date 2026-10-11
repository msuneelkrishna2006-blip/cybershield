import { NextRequest, NextResponse } from 'next/server';
import { getAuthConfig } from './config';
import { hasValidCsrfOrigin } from './csrf';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export function setAuthCookies(response: NextResponse, tokens: Tokens): NextResponse {
  const config = getAuthConfig();
  response.cookies.set(config.SESSION_COOKIE_NAME, tokens.accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60,
  });

  response.cookies.set(config.REFRESH_COOKIE_NAME, tokens.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });

  return response;
}

export function clearAuthCookies(response: NextResponse): NextResponse {
  const config = getAuthConfig();
  for (const name of [config.SESSION_COOKIE_NAME, config.REFRESH_COOKIE_NAME]) {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: true,
      sameSite: name === config.REFRESH_COOKIE_NAME ? 'strict' : 'lax',
      path: '/',
      maxAge: 0,
    });
  }
  return response;
}

export function getAccessToken(request: NextRequest): string | undefined {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !hasValidCsrfOrigin(request)) {
    return undefined;
  }
  return request.cookies.get(getAuthConfig().SESSION_COOKIE_NAME)?.value;
}

export function getRefreshToken(request: NextRequest): string | undefined {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !hasValidCsrfOrigin(request)) {
    return undefined;
  }
  return request.cookies.get(getAuthConfig().REFRESH_COOKIE_NAME)?.value;
}
