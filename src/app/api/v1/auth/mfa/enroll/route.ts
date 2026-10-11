import { NextRequest } from 'next/server';
import QRCode from 'qrcode';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api/response';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { getAccessToken } from '@/lib/auth/cookies';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { encryptTotpSecret, totp } from '@/lib/auth/mfa';
import { verifyPassword } from '@/lib/auth/password';
import { markSessionReauthenticated } from '@/lib/auth/step-up';

const schema = z.object({ currentPassword: z.string().min(1).max(128) }).strict();

export async function POST(request: NextRequest) {
  if (!hasValidCsrfOrigin(request)) return apiError('CSRF_REJECTED', 'Request origin could not be verified', 403);
  const token = getAccessToken(request);
  if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Current password is required', 400);

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { credential: true },
  });
  const storedHash = user?.credential?.passwordHash || user?.passwordHash;
  if (!user || !storedHash || !(await verifyPassword(parsed.data.currentPassword, storedHash))) {
    return apiError('INVALID_CREDENTIALS', 'Current password is incorrect', 401);
  }
  if (user.mfaEnabled) return apiError('MFA_ALREADY_ENABLED', 'Multi-factor authentication is already enabled', 409);

  const existing = await prisma.mfaSecret.findUnique({ where: { userId: user.id } });
  if (existing) return apiError('MFA_ENROLLMENT_PENDING', 'Finish or reset the existing MFA enrollment', 409);

  const secret = totp.generateSecret();
  const encryptedSecret = encryptTotpSecret(secret);
  const uri = totp.keyuri(user.email || user.id, 'CyberShield', secret);
  const qrCodeDataUrl = await QRCode.toDataURL(uri);
  await prisma.mfaSecret.create({
    data: { userId: user.id, encryptedSecret, verifiedAt: null },
  });
  await markSessionReauthenticated(payload.sessionId);
  await prisma.authAuditLog.create({
    data: { userId: user.id, eventType: 'MFA_ENROLLMENT_STARTED' },
  });

  return apiSuccess({ secret, uri, qrCodeDataUrl });
}
