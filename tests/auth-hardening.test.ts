import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    authAuditLog: { create: jest.fn() },
    authRateLimit: { deleteMany: jest.fn() },
    emailToken: { create: jest.fn() },
    refreshToken: { updateMany: jest.fn() },
    user: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/auth/email', () => ({
  authEmailProvider: { send: jest.fn() },
  scheduleAuthEmail: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { hashRefreshToken, consumeRefreshToken } from '@/lib/auth/session';
import { getRequestIp } from '@/lib/auth/rate-limit';
import { isCommonPassword, validatePasswordStrength } from '@/lib/auth/password';
import { POST as register } from '@/app/api/v1/auth/register/route';
import { POST as forgotPassword } from '@/app/api/v1/auth/forgot-password/route';
import { POST as resendVerification } from '@/app/api/v1/auth/resend-verification/route';
import { scheduleAuthEmail } from '@/lib/auth/email';

const mockedPrisma = jest.mocked(prisma);
const mockedScheduleAuthEmail = jest.mocked(scheduleAuthEmail);
const originalFetch = global.fetch;

function postRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`https://cybershield.in${path}`, {
    method: 'POST',
    headers: {
      origin: 'https://cybershield.in',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function responseWithDuration(handler: (request: NextRequest) => Promise<Response>, path: string, body: unknown) {
  const startedAt = Date.now();
  const response = await handler(postRequest(path, body));
  return { response, durationMs: Date.now() - startedAt };
}

describe('Phase 2.5 auth hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://cybershield.in';
    process.env.VERCEL = '';
    process.env.TRUSTED_PROXY = '';
    mockedPrisma.$queryRaw.mockResolvedValue([{ count: 1, window_started_at: new Date() }] as never);
    mockedPrisma.authAuditLog.create.mockResolvedValue({} as never);
    global.fetch = jest.fn().mockResolvedValue(new Response('', { status: 200 }));
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('stores and consumes only a SHA-256 refresh-token digest', async () => {
    const rawToken = 'refresh-token-that-must-not-be-persisted';
    const tokenHash = hashRefreshToken(rawToken);
    expect(tokenHash).toMatch(/^[\da-f]{64}$/);
    expect(tokenHash).not.toBe(rawToken);

    mockedPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 } as never);
    await expect(consumeRefreshToken(rawToken, 'user-id', 'session-id')).resolves.toBe(true);
    expect(mockedPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { token: tokenHash, userId: 'user-id', sessionId: 'session-id', revoked: false },
      data: { revoked: true },
    });
  });

  test('trusts only configured proxy IP headers and prefers the Vercel forwarded header', () => {
    const request = new Request('https://cybershield.in', {
      headers: {
        'x-forwarded-for': 'spoofed-client, proxy',
        'x-real-ip': 'spoofed-real-ip',
        'x-vercel-forwarded-for': '203.0.113.5',
      },
    });

    expect(getRequestIp(request)).toBe('unknown');
    process.env.TRUSTED_PROXY = 'true';
    expect(getRequestIp(request)).toBe('spoofed-client');
    process.env.VERCEL = '1';
    expect(getRequestIp(request)).toBe('203.0.113.5');
  });

  test('falls back to local password rules if the padded HIBP lookup is unavailable', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');
    const fetchMock = jest.mocked(global.fetch);
    fetchMock.mockRejectedValueOnce(new Error('request contained secret password'));

    await expect(isCommonPassword('long unique passphrase')).resolves.toBe(false);
    await expect(validatePasswordStrength('long unique passphrase')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/api\.pwnedpasswords\.com\/range\/[A-F0-9]{5}$/),
      expect.objectContaining({
        headers: { 'Add-Padding': 'true' },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(timeoutSpy).toHaveBeenCalledWith(3_000);
    expect(warning).toHaveBeenCalledWith(
      '[Auth] Breached-password lookup unavailable; using local password checks',
    );
    expect(warning.mock.calls.flat().join(' ')).not.toContain('long unique passphrase');
    warning.mockRestore();
    timeoutSpy.mockRestore();
  });

  test('register responds consistently for an existing and a new email', async () => {
    mockedPrisma.user.findFirst
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ id: 'existing-user' } as never);
    mockedPrisma.user.create.mockResolvedValue({ id: 'new-user' } as never);

    const body = {
      name: 'New User',
      email: 'member@example.com',
      password: 'a sufficiently long passphrase',
    };
    const unknown = await responseWithDuration(register, '/api/v1/auth/register', body);
    const existing = await responseWithDuration(register, '/api/v1/auth/register', body);

    expect(unknown.response.status).toBe(202);
    expect(existing.response.status).toBe(202);
    expect(await unknown.response.json()).toEqual(await existing.response.json());
    expect(Math.abs(unknown.durationMs - existing.durationMs)).toBeLessThan(150);
    expect(unknown.durationMs).toBeGreaterThanOrEqual(700);
    expect(mockedScheduleAuthEmail).toHaveBeenCalledTimes(1);
  });

  test('forgot-password responds consistently for unknown, unverified, and verified emails', async () => {
    mockedPrisma.user.findUnique
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ id: 'unverified', email: 'member@example.com', emailVerifiedAt: null } as never)
      .mockResolvedValueOnce({
        id: 'verified',
        email: 'member@example.com',
        emailVerifiedAt: new Date(),
      } as never);

    const body = { email: 'member@example.com' };
    const unknown = await responseWithDuration(forgotPassword, '/api/v1/auth/forgot-password', body);
    const unverified = await responseWithDuration(forgotPassword, '/api/v1/auth/forgot-password', body);
    const verified = await responseWithDuration(forgotPassword, '/api/v1/auth/forgot-password', body);
    const results = [unknown, unverified, verified];
    const expectedBody = await unknown.response.clone().json();

    for (const result of results) {
      expect(result.response.status).toBe(202);
      expect(await result.response.json()).toEqual(expectedBody);
      expect(result.durationMs).toBeGreaterThanOrEqual(700);
    }
    expect(Math.max(...results.map(result => result.durationMs))
      - Math.min(...results.map(result => result.durationMs))).toBeLessThan(150);
    expect(mockedScheduleAuthEmail).toHaveBeenCalledTimes(1);
  });

  test('resend-verification responds consistently for unknown, verified, and unverified emails', async () => {
    mockedPrisma.user.findUnique
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({
        id: 'verified',
        email: 'member@example.com',
        emailVerifiedAt: new Date(),
      } as never)
      .mockResolvedValueOnce({ id: 'unverified', email: 'member@example.com', emailVerifiedAt: null } as never);
    mockedPrisma.$transaction.mockImplementation(async callback => {
      const transaction = {
        emailToken: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          create: jest.fn().mockResolvedValue({}),
        },
      };
      return callback(transaction as never) as never;
    });

    const body = { email: 'member@example.com' };
    const unknown = await responseWithDuration(
      resendVerification,
      '/api/v1/auth/resend-verification',
      body,
    );
    const verified = await responseWithDuration(
      resendVerification,
      '/api/v1/auth/resend-verification',
      body,
    );
    const unverified = await responseWithDuration(
      resendVerification,
      '/api/v1/auth/resend-verification',
      body,
    );
    const results = [unknown, verified, unverified];
    const expectedBody = await unknown.response.clone().json();

    for (const result of results) {
      expect(result.response.status).toBe(202);
      expect(await result.response.json()).toEqual(expectedBody);
      expect(result.durationMs).toBeGreaterThanOrEqual(700);
    }
    expect(Math.max(...results.map(result => result.durationMs))
      - Math.min(...results.map(result => result.durationMs))).toBeLessThan(150);
    expect(mockedScheduleAuthEmail).toHaveBeenCalledTimes(1);
  });
});
