/**
 * CyberShield India — Login API
 * POST /api/v1/auth/login
 *
 * Authenticates user with email/phone + password.
 * Implements brute-force protection with account lockout.
 * Returns httpOnly secure cookies.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { setAuthCookies } from '@/lib/auth/cookies';
import { createSession } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/response';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim().optional(),
  phone: z.string().regex(/^(\+91)?[6-9]\d{9}$/).optional(),
  password: z.string().min(1),
}).refine(
  (data) => data.email || data.phone,
  { message: 'Either email or phone number is required' }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid login credentials', 400);
    }

    const { email, phone, password } = parsed.data;
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Find user
    const user = email
      ? await prisma.user.findUnique({ where: { email } })
      : phone
        ? await prisma.user.findUnique({ where: { phone } })
        : null;

    if (!user || !user.passwordHash) {
      // Log failed attempt without revealing whether user exists
      await prisma.authAuditLog.create({
        data: {
          eventType: 'LOGIN_FAILED',
          ipAddress,
          userAgent,
        },
      });
      return apiError('INVALID_CREDENTIALS', 'Invalid email/phone or password', 401);
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      await prisma.authAuditLog.create({
        data: {
          userId: user.id,
          eventType: 'LOGIN_LOCKED',
          ipAddress,
          userAgent,
        },
      });
      return apiError(
        'ACCOUNT_LOCKED',
        `Account is temporarily locked. Please try again in ${remainingMinutes} minutes.`,
        429
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      const newFailedAttempts = user.failedAttempts + 1;
      const shouldLock = newFailedAttempts >= MAX_FAILED_ATTEMPTS;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: newFailedAttempts,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : undefined,
        },
      });

      await prisma.authAuditLog.create({
        data: {
          userId: user.id,
          eventType: shouldLock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
          ipAddress,
          userAgent,
        },
      });

      if (shouldLock) {
        return apiError(
          'ACCOUNT_LOCKED',
          'Too many failed attempts. Account locked for 30 minutes.',
          429
        );
      }

      return apiError(
        'INVALID_CREDENTIALS',
        `Invalid email/phone or password. ${MAX_FAILED_ATTEMPTS - newFailedAttempts} attempts remaining.`,
        401
      );
    }

    // Successful login — reset failed attempts
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
      },
    });

    // Check if MFA is required
    if (user.mfaEnabled) {
      // Create a temporary pre-MFA session
      const tempSession = await createSession(user.id, request);

      // Return MFA challenge
      return apiSuccess({
        mfaRequired: true,
        sessionId: tempSession.id,
      });
    }

    // Create session
    const session = await createSession(user.id, request);

    // Sign tokens
    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email || undefined,
      sessionId: session.id,
    });

    const refreshToken = signRefreshToken({
      userId: user.id,
      sessionId: session.id,
    });

    // Store refresh token
    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: refreshExpiry,
      },
    });

    // Revoke old refresh tokens (keep last 5 sessions)
    const oldTokens = await prisma.refreshToken.findMany({
      where: { userId: user.id, revoked: false },
      orderBy: { createdAt: 'desc' },
      skip: 5,
    });

    if (oldTokens.length > 0) {
      await prisma.refreshToken.updateMany({
        where: { token: { in: oldTokens.map(t => t.token) } },
        data: { revoked: true },
      });
    }

    // Audit log
    await prisma.authAuditLog.create({
      data: {
        userId: user.id,
        eventType: 'LOGIN_SUCCESS',
        ipAddress,
        userAgent,
      },
    });

    // Set cookies and return
    const response = apiSuccess({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        safetyScore: user.safetyScore,
        mfaEnabled: user.mfaEnabled,
      },
    });

    setAuthCookies(response, { accessToken, refreshToken });
    return response;
  } catch (error) {
    console.error('[Auth] Login error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Login failed. Please try again.', 500);
  }
}
