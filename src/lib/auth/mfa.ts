import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'crypto';
import { authenticator } from 'otplib';
import { HashAlgorithms } from '@otplib/core';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthConfig } from './config';
import { clearAuthCookies } from './cookies';

const MFA_PENDING_COOKIE = '__Host-cs_mfa_pending';
const MFA_DEVICE_COOKIE = '__Host-cs_mfa_device';
const MFA_PENDING_LIFETIME_SECONDS = 5 * 60;

const defaultTotpOptions = authenticator.allOptions();
authenticator.options = {
  ...defaultTotpOptions,
  algorithm: HashAlgorithms.SHA1,
  digits: 6,
  step: 30,
  window: 1,
};
export const totp = authenticator;

export function shouldRequireMfaChallenge(
  mfaEnabled: boolean,
  secretVerifiedAt: Date | null | undefined,
): boolean {
  return mfaEnabled && Boolean(secretVerifiedAt);
}

function encryptionKey(): Buffer {
  const key = getAuthConfig().AUTH_ENCRYPTION_KEY;
  if (!key) throw new Error('AUTH_ENCRYPTION_KEY is required for MFA secrets');
  return Buffer.from(key, 'hex');
}

export function encryptTotpSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function decryptTotpSecret(encrypted: string): string {
  const [version, ivValue, tagValue, ciphertextValue] = encrypted.split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error('Invalid encrypted MFA secret');
  }

  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function matchingTotpStep(code: string, secret: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const checker = totp.create({
    ...totp.allOptions(),
    epoch: now,
    step: 30,
    digits: 6,
    algorithm: HashAlgorithms.SHA1,
    window: 1,
  });
  const delta = checker.checkDelta(code, secret);
  return delta === null ? null : Math.floor(now / 30_000) + delta;
}

export function createRecoveryCodes(): string[] {
  return Array.from({ length: 10 }, () => randomBytes(8).toString('hex').toUpperCase());
}

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.replace(/-/g, '').toUpperCase()).digest('hex');
}

export async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  const consumed = await prisma.recoveryCode.updateMany({
    where: { userId, codeHash: hashRecoveryCode(code), usedAt: null },
    data: { usedAt: new Date() },
  });
  return consumed.count === 1;
}

export async function consumeTotpStep(userId: string, step: number): Promise<boolean> {
  const used = await prisma.mfaSecret.updateMany({
    where: { userId, verifiedAt: { not: null }, lastUsedStep: { lt: step } },
    data: { lastUsedStep: step },
  });
  return used.count === 1;
}

export function constantTimeHashMatch(left: string, right: string): boolean {
  const leftHash = Buffer.from(left, 'hex');
  const rightHash = Buffer.from(right, 'hex');
  return leftHash.length === rightHash.length && timingSafeEqual(leftHash, rightHash);
}

export function hashPendingMfaValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function createPendingMfaResponse(
  userId: string,
  response: NextResponse,
): Promise<NextResponse> {
  const token = randomBytes(32).toString('base64url');
  const device = randomBytes(32).toString('base64url');
  const now = new Date();

  await prisma.pendingMfaChallenge.updateMany({
    where: { userId, completedAt: null },
    data: { completedAt: now },
  });
  await prisma.pendingMfaChallenge.create({
    data: {
      userId,
      tokenHash: hashPendingMfaValue(token),
      deviceHash: hashPendingMfaValue(device),
      expiresAt: new Date(now.getTime() + MFA_PENDING_LIFETIME_SECONDS * 1000),
    },
  });

  clearAuthCookies(response);
  for (const [name, value] of [[MFA_PENDING_COOKIE, token], [MFA_DEVICE_COOKIE, device]]) {
    response.cookies.set(name, value, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: MFA_PENDING_LIFETIME_SECONDS,
    });
  }

  return response;
}

export function getPendingMfaCookies(request: NextRequest) {
  const token = request.cookies.get(MFA_PENDING_COOKIE)?.value;
  const device = request.cookies.get(MFA_DEVICE_COOKIE)?.value;
  if (!token || !device) return null;
  return { tokenHash: hashPendingMfaValue(token), deviceHash: hashPendingMfaValue(device) };
}

export async function incrementPendingMfaAttempt(tokenHash: string, deviceHash: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string; user_id: string; attempts: number }>>`
    UPDATE pending_mfa_challenges
    SET attempts = attempts + 1
    WHERE id = (
      SELECT id
      FROM pending_mfa_challenges
      WHERE token_hash = ${tokenHash}
        AND device_hash = ${deviceHash}
        AND completed_at IS NULL
        AND expires_at > NOW()
        AND attempts < max_attempts
      FOR UPDATE
    )
    AND completed_at IS NULL
    AND expires_at > NOW()
    AND attempts < max_attempts
    RETURNING id, user_id, attempts
  `;
  return rows[0] ?? null;
}

export function clearPendingMfaCookies(response: NextResponse): void {
  for (const name of [MFA_PENDING_COOKIE, MFA_DEVICE_COOKIE]) {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
  }
}
