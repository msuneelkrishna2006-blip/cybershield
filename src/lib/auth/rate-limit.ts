import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
let cleanupCounter = 0;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export interface RateLimiter {
  consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

export class DatabaseRateLimiter implements RateLimiter {
  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);
    cleanupCounter += 1;
    if (cleanupCounter % 100 === 0) {
      await prisma.authRateLimit.deleteMany({
        where: { windowStartedAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      });
    }
    const rows = await prisma.$queryRaw<Array<{ count: number; window_started_at: Date }>>`
      INSERT INTO auth_rate_limits ("key", "count", "window_started_at", "updated_at")
      VALUES (${key}, 1, ${now}, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN auth_rate_limits."window_started_at" <= ${windowStart} THEN 1
          ELSE auth_rate_limits."count" + 1
        END,
        "window_started_at" = CASE
          WHEN auth_rate_limits."window_started_at" <= ${windowStart} THEN ${now}
          ELSE auth_rate_limits."window_started_at"
        END,
        "updated_at" = ${now}
      RETURNING "count", "window_started_at"
    `;
    const record = rows[0];
    if (!record) throw new Error('Rate limit store returned no row');

    const resetAt = new Date(record.window_started_at.getTime() + windowMs);
    return {
      allowed: record.count <= limit,
      remaining: Math.max(0, limit - record.count),
      resetAt,
    };
  }
}

export const authRateLimiter: RateLimiter = new DatabaseRateLimiter();

export function getRequestIp(request: Request): string {
  if (process.env.VERCEL) {
    return request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  }

  if (process.env.TRUSTED_PROXY === 'true') {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')?.trim()
      || 'unknown';
  }

  return 'unknown';
}

export function hashRateLimitKey(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
