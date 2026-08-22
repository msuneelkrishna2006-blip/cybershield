export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export interface RateLimiterConfig {
  limit: number;
  windowMs: number; // in milliseconds
}

// In-memory store: { [key: string]: { count: number, resetAt: number } }
// Redis can replace this later.
const store = new Map<string, { count: number, resetAt: number }>();

export const rateLimiterConfigs = {
  authLimiter: { limit: 5, windowMs: 60 * 1000 },
  scanLimiter: { limit: 20, windowMs: 60 * 1000 },
  aiLimiter: { limit: 10, windowMs: 60 * 1000 },
  generalLimiter: { limit: 100, windowMs: 60 * 1000 },
};

/**
 * Factory that creates a rate limiter function for a specific config
 */
export function createRateLimiter(config: RateLimiterConfig) {
  return function checkLimit(key: string): RateLimitResult {
    const now = Date.now();
    const record = store.get(key);

    if (!record || record.resetAt <= now) {
      // Create new window
      const resetAt = now + config.windowMs;
      store.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: config.limit - 1, resetAt: new Date(resetAt) };
    }

    if (record.count >= config.limit) {
      // Limit exceeded
      return { allowed: false, remaining: 0, resetAt: new Date(record.resetAt) };
    }

    // Increment count
    record.count += 1;
    store.set(key, record);

    return { allowed: true, remaining: config.limit - record.count, resetAt: new Date(record.resetAt) };
  };
}

// Expose individual checkers
export const authLimiter = createRateLimiter(rateLimiterConfigs.authLimiter);
export const scanLimiter = createRateLimiter(rateLimiterConfigs.scanLimiter);
export const aiLimiter = createRateLimiter(rateLimiterConfigs.aiLimiter);
export const generalLimiter = createRateLimiter(rateLimiterConfigs.generalLimiter);
