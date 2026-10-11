import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    authAuditLog: {
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    emailToken: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { hasValidCsrfOrigin } from '@/lib/auth/csrf';
import { consumeEmailToken, hashEmailToken } from '@/lib/auth/email-tokens';
import { setAuthCookies } from '@/lib/auth/cookies';
import { hashPassword, isCommonPassword, validatePasswordStrength, verifyPassword } from '@/lib/auth/password';
import { DatabaseRateLimiter } from '@/lib/auth/rate-limit';
import { consumeRefreshToken, createSession, hashRefreshToken, validateSession } from '@/lib/auth/session';
import { scheduleAuthEmail, authEmailProvider } from '@/lib/auth/email';
import { POST as login } from '@/app/api/v1/auth/login/route';

const mockedPrisma = jest.mocked(prisma);

describe('Phase 2 authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses Argon2id with OWASP-minimum parameters and verifies passwords', async () => {
    const encoded = await hashPassword('a long passphrase without composition rules');
    expect(encoded).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    await expect(verifyPassword('a long passphrase without composition rules', encoded)).resolves.toBe(true);
    await expect(verifyPassword('incorrect passphrase', encoded)).resolves.toBe(false);
  });

  test('enforces the password length range and blocks common or breached values', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('', { status: 200 }),
    );
    await expect(validatePasswordStrength('shortpass')).resolves.toBe(false);
    await expect(isCommonPassword('password1234')).resolves.toBe(true);
    const breachedHash = createHash('sha1').update('breached but lengthy password').digest('hex').toUpperCase();
    fetchMock.mockResolvedValueOnce(new Response(`${breachedHash.slice(5)}:1\r\n`, { status: 200 }));
    await expect(validatePasswordStrength('breached but lengthy password')).resolves.toBe(false);
    await expect(validatePasswordStrength('long unique passphrase')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });

  test('hashes session secrets at rest and rejects revoked or idle sessions', async () => {
    const secret = 'opaque-random-session-secret';
    const sessionId = '9a14f9ae-94d2-4dce-a8ac-8ed789f547de';
    const now = new Date();
    mockedPrisma.session.create.mockResolvedValue({
      id: sessionId,
      userId: 'user-id',
      token: createHash('sha256').update(secret).digest('hex'),
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      lastActiveAt: now,
      lastReauthAt: null,
      expiresAt: new Date(now.getTime() + 60_000),
      revokedAt: null,
      createdAt: now,
      updatedAt: null,
    });
    const request = new NextRequest('https://cybershield.in/api/v1/auth/login', {
      headers: { 'user-agent': 'jest', 'x-real-ip': '127.0.0.1' },
    });
    const created = await createSession('user-id', request);
    expect(created.token).not.toBe(created.sessionSecret);
    expect(created.token).toMatch(/^[\da-f]{64}$/);

    mockedPrisma.session.findUnique.mockResolvedValue({
      id: sessionId,
      userId: 'user-id',
      token: createHash('sha256').update(secret).digest('hex'),
      ipAddress: null,
      userAgent: null,
      lastActiveAt: now,
      lastReauthAt: null,
      expiresAt: new Date(now.getTime() + 60_000),
      revokedAt: null,
      createdAt: now,
      updatedAt: null,
    });
    mockedPrisma.session.update.mockResolvedValue({} as never);
    await expect(validateSession(sessionId, secret)).resolves.toBe(true);
    await expect(validateSession(sessionId, 'wrong-secret')).resolves.toBe(false);
  });

  test('consumes verification and reset tokens at most once', async () => {
    const record = { id: 'token-id', userId: 'user-id' };
    let used = false;
    const transaction = {
      emailToken: {
        findFirst: jest.fn(async () => used ? null : record),
        updateMany: jest.fn(async () => {
          if (used) return { count: 0 };
          used = true;
          return { count: 1 };
        }),
      },
    };
    mockedPrisma.$transaction.mockImplementation(async callback => callback(transaction as never) as never);
    const onConsume = jest.fn(async () => undefined);
    const token = 'A'.repeat(43);

    expect(hashEmailToken(token)).not.toBe(token);
    await expect(consumeEmailToken(token, 'verify_email', onConsume)).resolves.toBe(true);
    await expect(consumeEmailToken(token, 'verify_email', onConsume)).resolves.toBe(false);
    expect(onConsume).toHaveBeenCalledTimes(1);
  });

  test('validates CSRF origin and rejects cross-site requests', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://cybershield.in';
    const sameOrigin = new NextRequest('https://cybershield.in/api/v1/auth/login', {
      headers: { origin: 'https://cybershield.in', 'sec-fetch-site': 'same-origin' },
    });
    const crossOrigin = new NextRequest('https://cybershield.in/api/v1/auth/login', {
      headers: { origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' },
    });
    expect(hasValidCsrfOrigin(sameOrigin)).toBe(true);
    expect(hasValidCsrfOrigin(crossOrigin)).toBe(false);
  });

  test('sets host-only secure authentication cookies with the required attributes', () => {
    process.env.JWT_SECRET = 'test-jwt-secret-with-sufficient-entropy';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-sufficient-entropy';
    const response = setAuthCookies(NextResponse.json({}), {
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    const setCookie = response.headers.get('set-cookie') || '';
    expect(setCookie).toContain('__Host-cs_session=access');
    expect(setCookie).toContain('__Host-cs_refresh=refresh');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
    expect(setCookie.toLowerCase()).toContain('samesite=strict');
  });

  test('only the first refresh request can consume a session refresh token', async () => {
    mockedPrisma.refreshToken.updateMany
      .mockResolvedValueOnce({ count: 1 } as never)
      .mockResolvedValueOnce({ count: 0 } as never);
    await expect(consumeRefreshToken('refresh-token', 'user-id', 'session-id')).resolves.toBe(true);
    await expect(consumeRefreshToken('refresh-token', 'user-id', 'session-id')).resolves.toBe(false);
    expect(mockedPrisma.refreshToken.updateMany).toHaveBeenCalledTimes(2);
  });

  test('upgrades a legacy bcrypt password and persists only the refresh-token hash', async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-with-sufficient-entropy';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-sufficient-entropy';
    const password = 'legacy account passphrase';
    const bcryptHash = await bcrypt.hash(password, 10);
    mockedPrisma.$queryRaw.mockResolvedValue([{ count: 1, window_started_at: new Date() }] as never);
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'legacy-user',
      email: 'legacy@example.com',
      name: 'Legacy User',
      phone: null,
      passwordHash: bcryptHash,
      credential: null,
      emailVerifiedAt: new Date(),
      failedAttempts: 0,
      lockedUntil: null,
      mfaEnabled: false,
      safetyScore: 100,
    } as never);
    mockedPrisma.user.update.mockResolvedValue({} as never);
    mockedPrisma.authAuditLog.create.mockResolvedValue({} as never);
    const now = new Date();
    mockedPrisma.session.create.mockResolvedValue({
      id: 'legacy-session',
      userId: 'legacy-user',
      token: '0'.repeat(64),
      ipAddress: null,
      userAgent: 'jest',
      lastActiveAt: now,
      lastReauthAt: null,
      expiresAt: new Date(now.getTime() + 60_000),
      revokedAt: null,
      createdAt: now,
      updatedAt: null,
    } as never);
    mockedPrisma.refreshToken.create.mockResolvedValue({} as never);
    const transaction = {
      credential: { upsert: jest.fn().mockResolvedValue({}) },
      user: { update: jest.fn().mockResolvedValue({}) },
    };
    mockedPrisma.$transaction.mockImplementation(async callback => callback(transaction as never) as never);

    const startedAt = Date.now();
    const response = await login(new NextRequest('https://cybershield.in/api/v1/auth/login', {
      method: 'POST',
      headers: {
        origin: 'https://cybershield.in',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email: 'legacy@example.com', password }),
    }));
    const duration = Date.now() - startedAt;
    const rawRefreshToken = response.cookies.get('__Host-cs_refresh')?.value;

    expect(response.status).toBe(200);
    expect(duration).toBeGreaterThanOrEqual(1_900);
    expect(transaction.credential.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ passwordHash: expect.stringMatching(/^\$argon2id\$/) }),
    }));
    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: 'legacy-user' },
      data: { passwordHash: null },
    });
    expect(rawRefreshToken).toBeTruthy();
    if (!rawRefreshToken) throw new Error('Login did not set a refresh cookie');
    expect(mockedPrisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ token: hashRefreshToken(rawRefreshToken) }),
    });
    expect(mockedPrisma.refreshToken.create.mock.calls[0][0].data.token).not.toBe(rawRefreshToken);
  });

  test('schedules email after the response and logs delivery failures without sensitive content', async () => {
    let scheduledCallback: (() => Promise<void>) | undefined;
    const scheduler = jest.fn((callback: () => Promise<void>) => {
      scheduledCallback = callback;
    });
    const send = jest.spyOn(authEmailProvider, 'send')
      .mockRejectedValue(new Error('secret-token and https://example.test/reset'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const message = {
      to: 'user@example.com',
      subject: 'Reset password',
      actionUrl: 'https://example.test/reset?token=secret-token',
      purpose: 'reset_password' as const,
    };

    scheduleAuthEmail(message, scheduler);
    expect(send).not.toHaveBeenCalled();
    expect(scheduler).toHaveBeenCalledTimes(1);
    await scheduledCallback?.();

    expect(log).toHaveBeenCalledWith('[Auth email] reset_password delivery failed');
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret-token');
    send.mockRestore();
    log.mockRestore();
  });

  test('uses the database-backed limiter atomically and enforces the configured limit', async () => {
    const now = new Date();
    mockedPrisma.$queryRaw
      .mockResolvedValueOnce([{ count: 1, window_started_at: now }] as never)
      .mockResolvedValueOnce([{ count: 3, window_started_at: now }] as never);
    const limiter = new DatabaseRateLimiter();
    await expect(limiter.consume('login:test', 2, 60_000)).resolves.toMatchObject({
      allowed: true,
      remaining: 1,
    });
    await expect(limiter.consume('login:test', 2, 60_000)).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
    });
    expect(mockedPrisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  test('returns the same credentials response and timing for unknown and known accounts', async () => {
    const password = 'incorrect but lengthy password';
    const bcryptHash = await bcrypt.hash('different and valid password', 10);
    mockedPrisma.$queryRaw.mockResolvedValue([{ count: 1, window_started_at: new Date() }] as never);
    mockedPrisma.authAuditLog.create.mockResolvedValue({} as never);
    mockedPrisma.user.update.mockResolvedValue({ failedAttempts: 1 } as never);

    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);
    const unknownStarted = Date.now();
    const unknownResponse = await login(new NextRequest('https://cybershield.in/api/v1/auth/login', {
      method: 'POST',
      headers: {
        origin: 'https://cybershield.in',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email: 'unknown@example.com', password }),
    }));
    const unknownDuration = Date.now() - unknownStarted;

    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'known-user',
      email: 'known@example.com',
      name: 'Known',
      phone: null,
      passwordHash: bcryptHash,
      emailVerifiedAt: new Date(),
      failedAttempts: 0,
      lockedUntil: null,
      mfaEnabled: false,
      safetyScore: 100,
    } as never);
    const knownStarted = Date.now();
    const knownResponse = await login(new NextRequest('https://cybershield.in/api/v1/auth/login', {
      method: 'POST',
      headers: {
        origin: 'https://cybershield.in',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email: 'known@example.com', password }),
    }));
    const knownDuration = Date.now() - knownStarted;

    expect(unknownResponse.status).toBe(401);
    expect(knownResponse.status).toBe(401);
    expect(await unknownResponse.json()).toEqual(await knownResponse.json());
    expect(unknownDuration).toBeGreaterThanOrEqual(1_900);
    expect(knownDuration).toBeGreaterThanOrEqual(1_900);
    expect(Math.abs(unknownDuration - knownDuration)).toBeLessThanOrEqual(150);
  });
});
