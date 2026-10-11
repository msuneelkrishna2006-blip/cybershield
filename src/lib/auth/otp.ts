import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getAuthConfig } from './config';

export type OtpPurpose = 'login' | 'verify_phone';

export interface OtpAttempt {
  id: string;
  user_id: string | null;
  phone: string;
  code_hash: string;
  attempts: number;
  max_attempts: number;
}

export function normalizeIndianPhoneNumber(value: string): string | null {
  const digits = value.startsWith('+91') ? value.slice(3) : value;
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `+91${digits}`;
}

export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashOtpCode(challengeId: string, phone: string, code: string): string {
  const secret = getAuthConfig().OTP_HMAC_SECRET;
  if (!secret) throw new Error('OTP_HMAC_SECRET is required to process OTPs');
  return createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(`${challengeId}:${phone}:${code}`)
    .digest('hex');
}

export function matchesOtpCode(challenge: Pick<OtpAttempt, 'id' | 'phone' | 'code_hash'>, code: string): boolean {
  const expected = Buffer.from(challenge.code_hash, 'hex');
  const actual = Buffer.from(hashOtpCode(challenge.id, challenge.phone, code), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function incrementOtpAttempt(phone: string, purpose: OtpPurpose, now = new Date()) {
  const rows = await prisma.$queryRaw<OtpAttempt[]>`
    UPDATE otp_challenges
    SET attempts = attempts + 1
    WHERE id = (
      SELECT id
      FROM otp_challenges
      WHERE phone = ${phone}
        AND purpose = ${purpose}
        AND used_at IS NULL
        AND expires_at > ${now}
        AND attempts < max_attempts
      ORDER BY sent_at DESC
      LIMIT 1
      FOR UPDATE
    )
    AND used_at IS NULL
    AND expires_at > ${now}
    AND attempts < max_attempts
    RETURNING id, user_id, phone, code_hash, attempts, max_attempts
  `;
  return rows[0] ?? null;
}

export async function consumeOtpChallenge(challenge: Pick<OtpAttempt, 'id' | 'attempts'>, now = new Date()) {
  const consumed = await prisma.otpChallenge.updateMany({
    where: {
      id: challenge.id,
      attempts: challenge.attempts,
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: { usedAt: now },
  });
  return consumed.count === 1;
}

export async function verifyOtpCode(
  phone: string,
  purpose: OtpPurpose,
  code: string,
  now = new Date(),
): Promise<OtpAttempt | null> {
  const challenge = await incrementOtpAttempt(phone, purpose, now);
  if (!challenge || !matchesOtpCode(challenge, code)) return null;
  return (await consumeOtpChallenge(challenge, now)) ? challenge : null;
}

export function createOtpChallengeId(): string {
  return randomUUID();
}
