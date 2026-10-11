/**
 * CyberShield India — Session Management
 *
 * Database-backed session CRUD with IP/UA tracking.
 * Sessions are stored in PostgreSQL and validated on each request.
 */

import { prisma } from '@/lib/prisma';
import { getRequestIp } from './rate-limit';
import { NextRequest } from 'next/server';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Creates a new session in the database.
 * Returns the full session object.
 */
export async function createSession(userId: string, request: NextRequest) {
  const ipAddress = getRequestIp(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';

  const sessionSecret = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      token: createHash('sha256').update(sessionSecret).digest('hex'),
      ipAddress,
      userAgent,
      lastActiveAt: new Date(),
      expiresAt,
    },
  });

  return { ...session, sessionSecret };
}

/**
 * Validates a session and updates its last active time.
 * Returns true if session is valid, false otherwise.
 */
export async function validateSession(sessionId: string, sessionSecret: string): Promise<boolean> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) return false;

  const now = new Date();
  const idleExpiry = new Date(session.lastActiveAt.getTime() + 24 * 60 * 60 * 1000);
  const suppliedHash = createHash('sha256').update(sessionSecret).digest();
  const storedHash = Buffer.from(session.token, 'hex');
  if (
    session.revokedAt
    || now > session.expiresAt
    || now > idleExpiry
    || suppliedHash.length !== storedHash.length
    || !timingSafeEqual(suppliedHash, storedHash)
  ) {
    await revokeSession(sessionId);
    return false;
  }

  // Update last active time
  await prisma.session.update({
    where: { id: sessionId },
    data: { lastActiveAt: new Date() },
  });

  return true;
}

/**
 * Revokes a specific session by setting its expiry to now.
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revokes all sessions for a given user.
 */
export async function revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}

export async function consumeRefreshToken(
  token: string,
  userId: string,
  sessionId: string,
): Promise<boolean> {
  const result = await prisma.refreshToken.updateMany({
    where: { token: hashRefreshToken(token), userId, sessionId, revoked: false },
    data: { revoked: true },
  });
  return result.count === 1;
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Lists all active sessions for a given user.
 */
export async function listUserSessions(userId: string) {
  const now = new Date();
  return prisma.session.findMany({
    where: {
      userId,
      expiresAt: { gt: now },
      revokedAt: null,
    },
    orderBy: { lastActiveAt: 'desc' },
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      lastActiveAt: true,
      createdAt: true,
    },
  });
}
