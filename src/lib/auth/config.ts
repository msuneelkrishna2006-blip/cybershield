/**
 * Auth configuration that fails fast if secrets are missing.
 */
let cachedConfig: ReturnType<typeof createConfig> | null = null;

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}. Application cannot start without it.`);
  }
  if (key.includes('SECRET') && value.length < 64 && process.env.NODE_ENV === 'production') {
    throw new Error(`${key} must be at least 64 characters for production security.`);
  }
  return value;
}

function createConfig() {
  return {
    JWT_SECRET: requireEnv('JWT_SECRET'),
    JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET'),
    ACCESS_TOKEN_EXPIRY: '15m',
    REFRESH_TOKEN_EXPIRY: '7d',
    SESSION_COOKIE_NAME: 'cs_session',
    REFRESH_COOKIE_NAME: 'cs_refresh',
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION_MINUTES: 30,
    OTP_EXPIRY_MINUTES: 5,
    OTP_MAX_ATTEMPTS: 3,
    MFA_ISSUER: 'CyberShield',
  } as const;
}

/**
 * Lazy getter for auth config to avoid throwing at import time during build.
 */
export function getAuthConfig() {
  if (!cachedConfig) {
    cachedConfig = createConfig();
  }
  return cachedConfig;
}
