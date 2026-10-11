import { NextRequest } from 'next/server';
jest.mock('@/lib/prisma', () => ({
  prisma: {
    authAuditLog: { create: jest.fn() },
    authRateLimit: { deleteMany: jest.fn() },
    credential: { upsert: jest.fn() },
    emergencySosEvent: { create: jest.fn() },
    familyMember: { findFirst: jest.fn() },
    mfaSecret: { deleteMany: jest.fn(), updateMany: jest.fn() },
    pendingMfaChallenge: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    recoveryCode: { deleteMany: jest.fn(), updateMany: jest.fn() },
    refreshToken: { updateMany: jest.fn() },
    session: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    user: { delete: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/auth/jwt', () => ({
  verifyAccessToken: jest.fn(),
  issueAuthTokens: jest.fn(),
}));

jest.mock('@/lib/auth/password', () => ({
  hashPassword: jest.fn().mockResolvedValue('new-argon2-hash'),
  validatePasswordStrength: jest.fn().mockResolvedValue(true),
  verifyPassword: jest.fn().mockResolvedValue(true),
}));

import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import {
  consumeRecoveryCode,
  consumeTotpStep,
  decryptTotpSecret,
  encryptTotpSecret,
  hashRecoveryCode,
  incrementPendingMfaAttempt,
  matchingTotpStep,
  shouldRequireMfaChallenge,
  totp,
} from '@/lib/auth/mfa';
import { requireStepUp } from '@/lib/auth/step-up';
import { POST as changePassword } from '@/app/api/v1/auth/change-password/route';
import { POST as disableMfa } from '@/app/api/v1/auth/mfa/disable/route';
import { GET as loadThreatFeed } from '@/app/api/v1/threats/feed/route';
import { POST as triggerSos } from '@/app/api/v1/emergency/sos/route';

const mockedPrisma = jest.mocked(prisma);
const mockedVerifyAccessToken = jest.mocked(verifyAccessToken);
const userId = '5f3c0a5a-126d-4873-a234-3e9d54f9a810';
const sessionId = '13dab1a0-8c05-4f51-92ca-3a45a673c015';

function request(path: string, method = 'POST', body?: unknown, cookies = '__Host-cs_session=access') {
  return new NextRequest(`https://cybershield.in${path}`, {
    method,
    headers: {
      origin: 'https://cybershield.in',
      'content-type': 'application/json',
      cookie: cookies,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe('Phase 4 MFA and step-up security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret-with-sufficient-entropy';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-sufficient-entropy';
    process.env.AUTH_ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.NEXT_PUBLIC_APP_URL = 'https://cybershield.in';
    mockedVerifyAccessToken.mockResolvedValue({
      userId,
      sessionId,
      sessionSecret: 'session-secret',
      email: 'user@example.test',
    });
    mockedPrisma.$queryRaw.mockResolvedValue([{ count: 1, window_started_at: new Date() }] as never);
    mockedPrisma.session.update.mockResolvedValue({} as never);
    mockedPrisma.session.updateMany.mockResolvedValue({ count: 1 } as never);
    mockedPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 } as never);
    mockedPrisma.authAuditLog.create.mockResolvedValue({} as never);
    mockedPrisma.$transaction.mockImplementation(async callback => callback(mockedPrisma as never) as never);
  });

  test('encrypts TOTP secrets with authenticated AES-GCM encryption', () => {
    const secret = totp.generateSecret();
    const encrypted = encryptTotpSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(decryptTotpSecret(encrypted)).toBe(secret);
    const [version, iv, tag, ciphertext] = encrypted.split('.');
    const tamperedTag = `${tag[0] === 'A' ? 'B' : 'A'}${tag.slice(1)}`;
    expect(() => decryptTotpSecret(`${version}.${iv}.${tamperedTag}.${ciphertext}`)).toThrow();
  });

  test('accepts TOTP codes within one 30-second step and rejects codes outside the window', () => {
    const secret = totp.generateSecret();
    const now = 1_800_000_000_000;
    const codeAt = (epoch: number) => totp.create({
      ...totp.allOptions(),
      epoch,
      window: 0,
    }).generate(secret);

    expect(matchingTotpStep(codeAt(now - 30_000), secret, now)).toBe(Math.floor(now / 30_000) - 1);
    expect(matchingTotpStep(codeAt(now), secret, now)).toBe(Math.floor(now / 30_000));
    expect(matchingTotpStep(codeAt(now + 30_000), secret, now)).toBe(Math.floor(now / 30_000) + 1);
    expect(matchingTotpStep(codeAt(now - 60_000), secret, now)).toBeNull();
    expect(matchingTotpStep(codeAt(now + 60_000), secret, now)).toBeNull();
  });

  test('uses atomic compare-and-set for TOTP replay rejection', async () => {
    mockedPrisma.mfaSecret.updateMany
      .mockResolvedValueOnce({ count: 1 } as never)
      .mockResolvedValueOnce({ count: 0 } as never);

    await expect(consumeTotpStep(userId, 60_000)).resolves.toBe(true);
    await expect(consumeTotpStep(userId, 60_000)).resolves.toBe(false);
    expect(mockedPrisma.mfaSecret.updateMany).toHaveBeenCalledWith({
      where: { userId, verifiedAt: { not: null }, lastUsedStep: { lt: 60_000 } },
      data: { lastUsedStep: 60_000 },
    });
  });

  test('consumes hashed recovery codes once only', async () => {
    mockedPrisma.recoveryCode.updateMany
      .mockResolvedValueOnce({ count: 1 } as never)
      .mockResolvedValueOnce({ count: 0 } as never);

    await expect(consumeRecoveryCode(userId, 'ab12-cd34-ef56-7890')).resolves.toBe(true);
    await expect(consumeRecoveryCode(userId, 'AB12CD34EF567890')).resolves.toBe(false);
    expect(mockedPrisma.recoveryCode.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId,
        codeHash: hashRecoveryCode('AB12CD34EF567890'),
        usedAt: null,
      },
    }));
  });

  test('enabled MFA without a confirmed secret does not require a pending challenge', () => {
    expect(shouldRequireMfaChallenge(true, null)).toBe(false);
    expect(shouldRequireMfaChallenge(true, undefined)).toBe(false);
    expect(shouldRequireMfaChallenge(true, new Date())).toBe(true);
  });

  test('atomically locks the pending MFA challenge after the attempt limit', async () => {
    mockedPrisma.$queryRaw.mockResolvedValueOnce([{
      id: 'pending-id',
      user_id: userId,
      attempts: 5,
    }] as never);
    const result = await incrementPendingMfaAttempt('token-hash', 'device-hash');
    expect(result?.attempts).toBe(5);

    mockedPrisma.$queryRaw.mockResolvedValueOnce([] as never);
    await expect(incrementPendingMfaAttempt('token-hash', 'device-hash')).resolves.toBeNull();

    const [query] = mockedPrisma.$queryRaw.mock.calls[0];
    const sql = Array.from(query as TemplateStringsArray).join('?');
    expect(sql).toContain('attempts = attempts + 1');
    expect(sql).toContain('completed_at IS NULL');
    expect(sql).toContain('expires_at > NOW()');
    expect(sql).toContain('attempts < max_attempts');
    expect(sql).toContain('FOR UPDATE');
  });

  test('does not accept pending-MFA cookies as an access session for protected APIs', async () => {
    const response = await loadThreatFeed(request(
      '/api/v1/threats/feed',
      'GET',
      undefined,
      '__Host-cs_mfa_pending=opaque; __Host-cs_mfa_device=device',
    ));
    expect(response.status).toBe(401);
    expect(mockedVerifyAccessToken).not.toHaveBeenCalled();
  });

  test('requires recent reauthentication and denies children guardian-only actions', async () => {
    mockedPrisma.session.findUnique.mockResolvedValue({
      userId,
      lastReauthAt: new Date(Date.now() - 11 * 60 * 1000),
    } as never);
    const stale = await requireStepUp(request('/api/v1/auth/account', 'DELETE'));
    expect(stale.authorized).toBe(false);
    if (!stale.authorized) expect((await stale.response.json()).error.code).toBe('STEP_UP_REQUIRED');

    mockedPrisma.user.findUnique.mockResolvedValue({ role: 'CHILD' } as never);
    mockedPrisma.familyMember.findFirst.mockResolvedValue({ id: 'elevated-membership' } as never);
    const child = await requireStepUp(request('/api/v1/threats/feed', 'GET'), { guardianOnly: true });
    expect(child.authorized).toBe(false);
    if (!child.authorized) expect((await child.response.json()).error.code).toBe('FORBIDDEN');
  });

  test('change-password revokes other sessions and refresh tokens', async () => {
    const now = new Date();
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: userId,
      passwordHash: null,
      credential: { passwordHash: 'old-hash' },
    } as never);
    mockedPrisma.session.findUnique.mockResolvedValue({
      userId,
      lastReauthAt: now,
    } as never);
    mockedPrisma.credential.upsert.mockResolvedValue({} as never);
    mockedPrisma.user.update.mockResolvedValue({} as never);

    const response = await changePassword(request(
      '/api/v1/auth/change-password',
      'POST',
      { currentPassword: 'OldPassword-123', newPassword: 'NewPassword-456' },
    ));
    expect(response.status).toBe(200);
    expect(mockedPrisma.session.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId, revokedAt: null, id: { not: sessionId } },
    }));
    expect(mockedPrisma.refreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId, sessionId: { not: sessionId }, revoked: false },
    }));
  });

  test('MFA disable retains the current session and revokes other sessions and refresh tokens', async () => {
    mockedPrisma.session.findUnique.mockResolvedValue({
      userId,
      lastReauthAt: new Date(),
    } as never);
    mockedPrisma.recoveryCode.deleteMany.mockResolvedValue({ count: 10 } as never);
    mockedPrisma.mfaSecret.deleteMany.mockResolvedValue({ count: 1 } as never);
    mockedPrisma.user.update.mockResolvedValue({} as never);

    const response = await disableMfa(request('/api/v1/auth/mfa/disable'));

    expect(response.status).toBe(200);
    expect(mockedPrisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId, revokedAt: null, id: { not: sessionId } },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mockedPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId,
        revoked: false,
        OR: [
          { sessionId: null },
          { sessionId: { not: sessionId } },
        ],
      },
      data: { revoked: true },
    });
    expect(mockedPrisma.recoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId } });
    expect(mockedPrisma.mfaSecret.deleteMany).toHaveBeenCalledWith({ where: { userId } });
    expect(mockedPrisma.authAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId, eventType: 'MFA_DISABLED' }),
    }));
  });

  test('does not require step-up for SOS', async () => {
    mockedPrisma.familyMember.findFirst.mockResolvedValue({ id: 'family-member-id' } as never);
    mockedPrisma.emergencySosEvent.create.mockResolvedValue({ id: 'sos-id' } as never);

    const response = await triggerSos(request('/api/v1/emergency/sos', 'POST', { lat: 1, lng: 2 }));
    expect(response.status).toBe(201);
    expect(mockedPrisma.emergencySosEvent.create).toHaveBeenCalled();
    expect(mockedPrisma.session.findUnique).not.toHaveBeenCalled();
  });
});
