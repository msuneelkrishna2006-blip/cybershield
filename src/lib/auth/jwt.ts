import jwt from 'jsonwebtoken';
import { getAuthConfig } from './config';
import { createSession, validateSession } from './session';
import { NextRequest } from 'next/server';

export interface JwtPayload {
  userId: string;
  email?: string;
  sessionId: string;
  sessionSecret: string;
}

export async function issueAuthTokens(userId: string, email: string | null, request: NextRequest) {
  const session = await createSession(userId, request);
  const payload: JwtPayload = {
    userId,
    email: email || undefined,
    sessionId: session.id,
    sessionSecret: session.sessionSecret,
  };
  return {
    session,
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken({
      userId,
      sessionId: session.id,
      sessionSecret: session.sessionSecret,
    }),
  };
}

/**
 * Signs an access token for the given payload
 */
export function signAccessToken(payload: JwtPayload): string {
  const config = getAuthConfig();
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.ACCESS_TOKEN_EXPIRY,
  });
}

/**
 * Signs a refresh token for the given payload
 */
export function signRefreshToken(payload: Omit<JwtPayload, 'email'>): string {
  const config = getAuthConfig();
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.REFRESH_TOKEN_EXPIRY,
  });
}

/**
 * Verifies an access token and returns its payload, throws if invalid
 */
export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const config = getAuthConfig();
  const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
  if (!payload.userId || !payload.sessionId || !payload.sessionSecret) {
    throw new Error('Invalid session token');
  }
  if (!(await validateSession(payload.sessionId, payload.sessionSecret))) {
    throw new Error('Session is expired or revoked');
  }
  return payload;
}

/**
 * Verifies a refresh token and returns its payload, throws if invalid
 */
export function verifyRefreshToken(token: string): Omit<JwtPayload, 'email'> {
  const config = getAuthConfig();
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as Omit<JwtPayload, 'email'>;
}
