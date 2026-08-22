/**
 * CyberShield India — Registration API
 * POST /api/v1/auth/register
 *
 * Creates a new user account with secure password hashing.
 * Returns httpOnly secure cookies with auth tokens.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { setAuthCookies } from '@/lib/auth/cookies';
import { createSession } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/response';

const registerSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().toLowerCase().trim().optional(),
  phone: z.string().regex(/^(\+91)?[6-9]\d{9}$/, 'Invalid Indian phone number').optional(),
  password: z.string().min(8).max(128),
}).refine(
  (data) => data.email || data.phone,
  { message: 'Either email or phone number is required' }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        'VALIDATION_ERROR',
        'Invalid registration data',
        400,
        parsed.error.flatten().fieldErrors
      );
    }

    const { name, email, phone, password } = parsed.data;

    // Validate password strength
    const isStrongPassword = validatePasswordStrength(password);
    if (!isStrongPassword) {
      return apiError('WEAK_PASSWORD', 'Password must be at least 8 characters with uppercase, lowercase, and a number', 400);
    }

    // Check for existing user
    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        return apiError('EMAIL_EXISTS', 'An account with this email already exists', 409);
      }
    }

    if (phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone } });
      if (existingPhone) {
        return apiError('PHONE_EXISTS', 'An account with this phone number already exists', 409);
      }
    }

    // Hash password (bcrypt cost 12)
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash,
        safetyScore: 100, // Start with full safety score
        scansToday: 0,
        totalScans: 0,
        failedAttempts: 0,
      },
    });

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

    // Store refresh token in DB
    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: refreshExpiry,
      },
    });

    // Create auth audit log
    await prisma.authAuditLog.create({
      data: {
        userId: user.id,
        eventType: 'REGISTER',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    // Set secure cookies and return response
    const response = apiSuccess(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          safetyScore: user.safetyScore,
          mfaEnabled: user.mfaEnabled,
        },
      },
      201
    );

    setAuthCookies(response, { accessToken, refreshToken });
    return response;
  } catch (error) {
    console.error('[Auth] Registration error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Registration failed. Please try again.', 500);
  }
}
