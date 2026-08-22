import jwt from 'jsonwebtoken';
import { getAuthConfig } from './config';

export interface JwtPayload {
  userId: string;
  email?: string;
  sessionId: string;
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
export function verifyAccessToken(token: string): JwtPayload {
  const config = getAuthConfig();
  return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
}

/**
 * Verifies a refresh token and returns its payload, throws if invalid
 */
export function verifyRefreshToken(token: string): Omit<JwtPayload, 'email'> {
  const config = getAuthConfig();
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as Omit<JwtPayload, 'email'>;
}
