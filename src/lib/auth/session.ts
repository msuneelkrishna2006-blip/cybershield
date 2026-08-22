/**
 * CyberShield India — Session Management
 *
 * Database-backed session CRUD with IP/UA tracking.
 * Sessions are stored in PostgreSQL and validated on each request.
 */

import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';

/**
 * Creates a new session in the database.
 * Returns the full session object.
 */
export async function createSession(userId: string, request: NextRequest) {
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  // Expiry aligned with refresh token (7 days)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      token: randomUUID(),
      ipAddress,
      userAgent,
      lastActiveAt: new Date(),
      expiresAt,
    },
  });

  return session;
}

/**
 * Validates a session and updates its last active time.
 * Returns true if session is valid, false otherwise.
 */
export async function validateSession(sessionId: string): Promise<boolean> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) return false;

  if (new Date() > session.expiresAt) {
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
    data: { expiresAt: new Date() },
  });
}

/**
 * Revokes all sessions for a given user.
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId },
    data: { expiresAt: new Date() },
  });
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
