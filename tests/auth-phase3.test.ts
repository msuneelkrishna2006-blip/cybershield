import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    authAuditLog: { create: jest.fn() },
    authRateLimit: { deleteMany: jest.fn() },
    otpChallenge: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    user: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    refreshToken: { create: jest.fn() },
    session: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/auth/sms', () => ({
  scheduleOtpSms: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import {
  createOtpChallengeId,
  generateOtpCode,
  hashOtpCode,
  incrementOtpAttempt,
  matchesOtpCode,
  normalizeIndianPhoneNumber,
  verifyOtpCode,
} from '@/lib/auth/otp';
import { POST as requestOtp } from '@/app/api/v1/auth/otp/request/route';
import { POST as verifyOtp } from '@/app/api/v1/auth/otp/verify/route';
import { PATCH as updateProfile } from '@/app/api/v1/profile/route';
import { signAccessToken } from '@/lib/auth/jwt';
import { scheduleOtpSms } from '@/lib/auth/sms';
import { createHash } from 'crypto';

const mockedPrisma = jest.mocked(prisma);
const mockedScheduleOtpSms = jest.mocked(scheduleOtpSms);

function request(body: unknown, path = '/api/v1/auth/otp/request', cookie?: string) {
  return new NextRequest(`https://cybershield.in${path}`, {
    method: 'POST',
    headers: {
      origin: 'https://cybershield.in',
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('Phase 3 mobile OTP authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret-with-sufficient-entropy';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-sufficient-entropy';
    process.env.OTP_HMAC_SECRET = 'a'.repeat(64);
    process.env.NEXT_PUBLIC_APP_URL = 'https://cybershield.in';
    process.env.TRUSTED_PROXY = '';
    process.env.VERCEL = '';
    mockedPrisma.$queryRaw.mockResolvedValue([{ count: 1, window_started_at: new Date() }] as never);
  });

  test('normalizes only strict Indian E.164 mobile numbers', () => {
    expect(normalizeIndianPhoneNumber('9876543210')).toBe('+919876543210');
    expect(normalizeIndianPhoneNumber('+919876543210')).toBe('+919876543210');
    expect(normalizeIndianPhoneNumber('+91 9876543210')).toBeNull();
    expect(normalizeIndianPhoneNumber('5876543210')).toBeNull();
    expect(normalizeIndianPhoneNumber('+14155552671')).toBeNull();
  });

  test('generates six-digit codes and HMAC-binds them to challenge and phone', () => {
    const code = generateOtpCode();
    const challengeId = createOtpChallengeId();
    const phone = '+919876543210';
    expect(code).toMatch(/^\d{6}$/);
    const row = {
      id: challengeId,
      phone,
      purpose: 'login' as const,
      code_hash: hashOtpCode(challengeId, phone, 'login', code),
    };
    expect(matchesOtpCode(row, code)).toBe(true);
    expect(matchesOtpCode({ ...row, id: createOtpChallengeId() }, code)).toBe(false);
    expect(matchesOtpCode({ ...row, phone: '+919876543211' }, code)).toBe(false);
    expect(matchesOtpCode({ ...row, purpose: 'verify_phone' }, code)).toBe(false);
  });

  test('rejects expired challenges without incrementing or consuming them', async () => {
    mockedPrisma.$queryRaw.mockResolvedValueOnce([] as never);
    await expect(verifyOtpCode('+919876543210', 'login', '123456')).resolves.toBeNull();
    expect(mockedPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.otpChallenge.updateMany).not.toHaveBeenCalled();
  });

  test('increments attempts atomically in one statement and locks after five attempts', async () => {
    const challengeId = createOtpChallengeId();
    const phone = '+919876543210';
    const codeHash = hashOtpCode(challengeId, phone, 'login', '654321');
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      mockedPrisma.$queryRaw.mockResolvedValueOnce([{
        id: challengeId,
        user_id: 'user-id',
        phone,
        purpose: 'login',
        code_hash: codeHash,
        attempts: attempt,
        max_attempts: 5,
      }] as never);
      await expect(verifyOtpCode(phone, 'login', '000000')).resolves.toBeNull();
    }
    mockedPrisma.$queryRaw.mockResolvedValueOnce([] as never);
    await expect(incrementOtpAttempt(phone, 'login')).resolves.toBeNull();

    expect(mockedPrisma.$queryRaw).toHaveBeenCalledTimes(6);
    const sql = JSON.stringify(mockedPrisma.$queryRaw.mock.calls[0][0]);
    expect(sql).toContain('SET attempts = attempts + 1');
    expect(sql).toContain('attempts < max_attempts');
    expect(mockedPrisma.otpChallenge.updateMany).not.toHaveBeenCalled();
  });

  test('consumes a valid OTP once only', async () => {
    const challengeId = createOtpChallengeId();
    const phone = '+919876543210';
    const code = '042817';
    mockedPrisma.$queryRaw
      .mockResolvedValueOnce([{
        id: challengeId,
        user_id: 'user-id',
        phone,
        purpose: 'login',
        code_hash: hashOtpCode(challengeId, phone, 'login', code),
        attempts: 1,
        max_attempts: 5,
      }] as never)
      .mockResolvedValueOnce([] as never);
    mockedPrisma.otpChallenge.updateMany.mockResolvedValue({ count: 1 } as never);

    await expect(verifyOtpCode(phone, 'login', code)).resolves.toMatchObject({
      id: challengeId,
      user_id: 'user-id',
    });
    await expect(verifyOtpCode(phone, 'login', code)).resolves.toBeNull();
    expect(mockedPrisma.otpChallenge.updateMany).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.otpChallenge.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: challengeId, attempts: 1, usedAt: null }),
    }));
  });

  test('returns the same response for existing and unknown numbers and does not expose the code', async () => {
    mockedPrisma.otpChallenge.findFirst.mockResolvedValue(null as never);
    mockedPrisma.user.findFirst
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({
        id: 'eligible-user',
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
        lockedUntil: null,
      } as never);
    mockedPrisma.$transaction.mockImplementation(async callback => {
      const transaction = {
        otpChallenge: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          create: jest.fn().mockResolvedValue({}),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        $queryRaw: jest.fn().mockResolvedValue([]),
      };
      return callback(transaction as never) as never;
    });

    const started = Date.now();
    const unknownResponse = await requestOtp(request({ phone: '+919876543210' }));
    const unknownDuration = Date.now() - started;
    const existingStarted = Date.now();
    const existingResponse = await requestOtp(request({ phone: '+919876543210' }));
    const existingDuration = Date.now() - existingStarted;

    expect(unknownResponse.status).toBe(202);
    expect(existingResponse.status).toBe(202);
    const unknownBody = await unknownResponse.json();
    const existingBody = await existingResponse.json();
    expect(unknownBody).toEqual(existingBody);
    expect(Math.abs(unknownDuration - existingDuration)).toBeLessThan(150);
    expect(unknownDuration).toBeGreaterThanOrEqual(700);
    expect(mockedScheduleOtpSms).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(existingBody)).not.toMatch(/\b\d{6}\b/);
    expect(mockedPrisma.user.findFirst.mock.calls[1][0]).toEqual(expect.objectContaining({
      where: { phone: '+919876543210', phoneVerifiedAt: { not: null } },
    }));
  });

  test('serializes OTP issuance and rechecks cooldown while holding the advisory lock', async () => {
    const transactionCalls: string[] = [];
    mockedPrisma.user.findFirst.mockResolvedValue({
      id: 'eligible-user',
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      lockedUntil: null,
    } as never);
    mockedPrisma.otpChallenge.findFirst.mockResolvedValue(null as never);
    const transaction = {
      otpChallenge: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockImplementation(async () => {
          transactionCalls.push('create');
          return {};
        }),
        findFirst: jest.fn().mockImplementation(async () => {
          transactionCalls.push('cooldown');
          return null;
        }),
      },
      $queryRaw: jest.fn().mockImplementation(async () => {
        transactionCalls.push('advisory-lock');
        return [];
      }),
    };
    mockedPrisma.$transaction.mockImplementation(async callback => callback(transaction as never) as never);

    const response = await requestOtp(request({ phone: '+919876543210', purpose: 'login' }));

    expect(response.status).toBe(202);
    expect(transactionCalls).toEqual(['advisory-lock', 'cooldown', 'create']);
    expect(mockedScheduleOtpSms).toHaveBeenCalledTimes(1);
  });

  test('enforces the 60-second cooldown without sending another SMS', async () => {
    mockedPrisma.$queryRaw.mockResolvedValue([{ count: 1, window_started_at: new Date() }] as never);
    mockedPrisma.otpChallenge.findFirst.mockResolvedValue({ id: 'recent-challenge' } as never);
    mockedPrisma.user.findFirst.mockResolvedValue({
      id: 'eligible-user',
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      lockedUntil: null,
    } as never);

    const response = await requestOtp(request({ phone: '9876543210' }));

    expect(response.status).toBe(202);
    expect(mockedPrisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { phone: '+919876543210', phoneVerifiedAt: { not: null } },
    }));
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockedScheduleOtpSms).not.toHaveBeenCalled();
  });

  test.each([
    ['account lockout', { lockedUntil: new Date(Date.now() + 60_000) }],
    ['unverified email', { emailVerifiedAt: null }],
    ['unverified phone', { phoneVerifiedAt: null }],
  ])('does not allow OTP login for %s', async (_condition, override) => {
    const phone = '+919876543210';
    const code = '531904';
    const challengeId = createOtpChallengeId();
    mockedPrisma.$queryRaw
      .mockResolvedValueOnce([{ count: 1, window_started_at: new Date() }] as never)
      .mockResolvedValueOnce([{ count: 1, window_started_at: new Date() }] as never)
      .mockResolvedValueOnce([{
        id: challengeId,
        user_id: 'user-id',
        phone,
        purpose: 'verify_phone',
        code_hash: hashOtpCode(challengeId, phone, 'verify_phone', code),
        attempts: 1,
        max_attempts: 5,
      }] as never);
    mockedPrisma.otpChallenge.updateMany.mockResolvedValue({ count: 1 } as never);
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      name: 'User',
      email: 'user@example.com',
      phone,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      lockedUntil: null,
      safetyScore: 100,
      mfaEnabled: false,
      ...override,
    } as never);

    const response = await verifyOtp(
      request({ phone, code, purpose: 'login' }, '/api/v1/auth/otp/verify'),
    );

    expect(response.status).toBe(400);
    expect(mockedPrisma.refreshToken.create).not.toHaveBeenCalled();
    expect(mockedPrisma.session.create).not.toHaveBeenCalled();
  });

  test('verifies a phone for the signed-in user with the same OTP flow', async () => {
    const userId = 'user-id';
    const sessionId = 'session-id';
    const sessionSecret = 'session-secret';
    const phone = '+919876543210';
    const code = '531904';
    const challengeId = createOtpChallengeId();
    const now = new Date();
    process.env.SMS_PROVIDER = 'mock';
    const accessToken = signAccessToken({ userId, sessionId, sessionSecret });
    mockedPrisma.session.findUnique.mockResolvedValue({
      id: sessionId,
      userId,
      token: createHash('sha256').update(sessionSecret).digest('hex'),
      ipAddress: null,
      userAgent: null,
      lastActiveAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
      revokedAt: null,
      createdAt: now,
      updatedAt: null,
    } as never);
    mockedPrisma.session.update.mockResolvedValue({} as never);
    mockedPrisma.otpChallenge.findFirst.mockResolvedValue(null as never);
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ id: userId } as never);
    mockedPrisma.user.findFirst.mockResolvedValue(null as never);
    mockedPrisma.$transaction.mockImplementation(async callback => {
      const transaction = {
        otpChallenge: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          create: jest.fn().mockResolvedValue({}),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        $queryRaw: jest.fn().mockResolvedValue([]),
      };
      return callback(transaction as never) as never;
    });

    const sendResponse = await requestOtp(request(
      { phone, purpose: 'verify_phone' },
      '/api/v1/auth/otp/request',
      `__Host-cs_session=${accessToken}`,
    ));
    expect(sendResponse.status).toBe(202);
    expect(mockedScheduleOtpSms).toHaveBeenCalledTimes(1);

    mockedPrisma.$queryRaw
      .mockResolvedValueOnce([{ count: 1, window_started_at: now }] as never)
      .mockResolvedValueOnce([{ count: 1, window_started_at: now }] as never)
      .mockResolvedValueOnce([{
        id: challengeId,
        user_id: userId,
        phone,
        purpose: 'verify_phone',
        code_hash: hashOtpCode(challengeId, phone, 'verify_phone', code),
        attempts: 1,
        max_attempts: 5,
      }] as never);
    mockedPrisma.otpChallenge.updateMany.mockResolvedValue({ count: 1 } as never);
    mockedPrisma.user.update.mockResolvedValue({} as never);

    const verified = await verifyOtp(
      request(
        { phone, code, purpose: 'verify_phone' },
        '/api/v1/auth/otp/verify',
        `__Host-cs_session=${accessToken}`,
      ),
    );

    expect(verified.status).toBe(200);
    expect(mockedPrisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { phone, phoneVerifiedAt: expect.any(Date) },
    });
  });

  test('lets multiple accounts claim an unverified phone, but only the first verification succeeds', async () => {
    const phone = '+919876543210';
    const sessionSecret = 'shared-test-session-secret';
    const accountA = '11111111-1111-4111-8111-111111111111';
    const accountB = '22222222-2222-4222-8222-222222222222';
    const sessionA = 'session-a';
    const sessionB = 'session-b';
    const now = new Date();
    const accessTokenA = signAccessToken({ userId: accountA, sessionId: sessionA, sessionSecret });
    const accessTokenB = signAccessToken({ userId: accountB, sessionId: sessionB, sessionSecret });
    mockedPrisma.session.findUnique.mockResolvedValue({
      token: createHash('sha256').update(sessionSecret).digest('hex'),
      lastActiveAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
      revokedAt: null,
    } as never);
    mockedPrisma.session.update.mockResolvedValue({} as never);
    mockedPrisma.user.findUnique
      .mockResolvedValueOnce({ id: accountA } as never)
      .mockResolvedValueOnce({ id: accountB } as never);
    mockedPrisma.user.findFirst.mockResolvedValue(null as never);
    mockedPrisma.otpChallenge.findFirst.mockResolvedValue(null as never);
    mockedPrisma.otpChallenge.updateMany.mockResolvedValue({ count: 1 } as never);

    const createdChallenges: Array<{ id: string; userId: string; phone: string; purpose: string; codeHash: string }> = [];
    mockedPrisma.$transaction.mockImplementation(async callback => callback({
      otpChallenge: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockImplementation(async ({ data }) => {
          createdChallenges.push(data);
          return data;
        }),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    } as never) as never);

    const responseA = await requestOtp(request(
      { phone, purpose: 'verify_phone' },
      '/api/v1/auth/otp/request',
      `__Host-cs_session=${accessTokenA}`,
    ));
    const responseB = await requestOtp(request(
      { phone, purpose: 'verify_phone' },
      '/api/v1/auth/otp/request',
      `__Host-cs_session=${accessTokenB}`,
    ));
    expect(responseA.status).toBe(202);
    expect(responseB.status).toBe(202);
    expect(createdChallenges.map(challenge => challenge.userId)).toEqual([accountA, accountB]);

    const challengeA = createdChallenges[0];
    const challengeB = createdChallenges[1];
    const codeA = mockedScheduleOtpSms.mock.calls[0][0].code;
    const codeB = mockedScheduleOtpSms.mock.calls[1][0].code;
    mockedPrisma.$queryRaw
      .mockResolvedValueOnce([{ count: 1, window_started_at: now }] as never)
      .mockResolvedValueOnce([{ count: 1, window_started_at: now }] as never)
      .mockResolvedValueOnce([{
        id: challengeA.id,
        user_id: accountA,
        phone,
        purpose: 'verify_phone',
        code_hash: challengeA.codeHash,
        attempts: 1,
        max_attempts: 5,
      }] as never)
      .mockResolvedValueOnce([{ count: 1, window_started_at: now }] as never)
      .mockResolvedValueOnce([{ count: 1, window_started_at: now }] as never)
      .mockResolvedValueOnce([{
        id: challengeB.id,
        user_id: accountB,
        phone,
        purpose: 'verify_phone',
        code_hash: challengeB.codeHash,
        attempts: 1,
        max_attempts: 5,
      }] as never);
    mockedPrisma.user.update
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));

    const verifiedA = await verifyOtp(request(
      { phone, code: codeA, purpose: 'verify_phone' },
      '/api/v1/auth/otp/verify',
      `__Host-cs_session=${accessTokenA}`,
    ));
    const verifiedB = await verifyOtp(request(
      { phone, code: codeB, purpose: 'verify_phone' },
      '/api/v1/auth/otp/verify',
      `__Host-cs_session=${accessTokenB}`,
    ));

    expect(verifiedA.status).toBe(200);
    expect(verifiedB.status).toBe(400);
    expect(await verifiedB.json()).toMatchObject({
      error: {
        code: 'INVALID_OTP',
        message: 'The verification code is invalid or expired.',
      },
    });
    expect(mockedPrisma.authAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: accountB,
        eventType: 'PHONE_VERIFICATION_CONFLICT',
      }),
    }));
    expect(JSON.stringify(mockedPrisma.authAuditLog.create.mock.calls)).not.toContain(phone);
    expect(JSON.stringify(mockedPrisma.$queryRaw.mock.calls[6])).toContain(accountA);
    expect(JSON.stringify(mockedPrisma.$queryRaw.mock.calls[9])).toContain(accountB);
  });

  test('OTP login selects only the account whose phone is verified', async () => {
    const phone = '+919876543210';
    const createdChallenges: Array<{ userId: string | null }> = [];
    mockedPrisma.user.findFirst.mockResolvedValue({
      id: 'verified-owner',
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      lockedUntil: null,
    } as never);
    mockedPrisma.otpChallenge.findFirst.mockResolvedValue(null as never);
    mockedPrisma.$transaction.mockImplementation(async callback => callback({
      otpChallenge: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockImplementation(async ({ data }) => {
          createdChallenges.push(data);
          return data;
        }),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    } as never) as never);

    const response = await requestOtp(request({ phone, purpose: 'login' }));

    expect(response.status).toBe(202);
    expect(mockedPrisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { phone, phoneVerifiedAt: { not: null } },
    }));
    expect(createdChallenges).toHaveLength(1);
    expect(createdChallenges[0]).toEqual(expect.objectContaining({ userId: 'verified-owner' }));
    expect(mockedScheduleOtpSms).toHaveBeenCalledTimes(1);
  });

  test('changing a phone clears its previous verification and requires a valid origin', async () => {
    const userId = 'user-id';
    const sessionId = 'session-id';
    const sessionSecret = 'session-secret';
    const currentPhone = '+919876543210';
    const nextPhone = '+919123456789';
    const accessToken = signAccessToken({ userId, sessionId, sessionSecret });
    const now = new Date();
    mockedPrisma.session.findUnique.mockResolvedValue({
      id: sessionId,
      userId,
      token: createHash('sha256').update(sessionSecret).digest('hex'),
      ipAddress: null,
      userAgent: null,
      lastActiveAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
      revokedAt: null,
      createdAt: now,
      updatedAt: null,
    } as never);
    mockedPrisma.session.update.mockResolvedValue({} as never);
    mockedPrisma.user.findUnique.mockResolvedValue({ phone: currentPhone } as never);
    mockedPrisma.user.update.mockResolvedValue({} as never);

    const response = await updateProfile(request(
      { phone: nextPhone },
      '/api/v1/profile',
      `__Host-cs_session=${accessToken}`,
    ));

    expect(response.status).toBe(200);
    expect(mockedPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { phone: nextPhone, phoneVerifiedAt: null },
    }));

    const csrfRejected = await updateProfile(new NextRequest('https://cybershield.in/api/v1/profile', {
      method: 'PATCH',
      headers: { cookie: `__Host-cs_session=${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ phone: nextPhone }),
    }));
    expect(csrfRejected.status).toBe(403);
  });
});
