import { z } from 'zod';

/**
 * Auth configuration that fails fast if secrets are missing.
 */
let cachedConfig: ReturnType<typeof createConfig> | null = null;

const authEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  OTP_HMAC_SECRET: z.string().regex(/^[\da-fA-F]{64}$/, 'OTP_HMAC_SECRET must be 32 bytes encoded as hex').optional(),
  DATA_ENCRYPTION_KEY: z.string().regex(/^[\da-fA-F]{64}$/, 'DATA_ENCRYPTION_KEY must be 32 bytes encoded as hex').optional(),
  AUTH_ENCRYPTION_KEY: z.string().regex(/^[\da-fA-F]{64}$/, 'AUTH_ENCRYPTION_KEY must be 32 bytes encoded as hex').optional(),
  MFA_REQUIRED_FOR_GUARDIANS: z.enum(['true', 'false']).optional(),
  REDIS_URL: z.string().url().optional(),
  EMAIL_PROVIDER: z.enum(['mock', 'resend']).optional(),
  RESEND_API_KEY: z.string().optional(),
  AUTH_EMAIL_FROM: z.string().min(3).optional(),
  SMS_PROVIDER: z.enum(['mock', 'twilio']).optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
}).superRefine((env, context) => {
  if (env.NODE_ENV === 'production') {
    for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      if (env[key].length < 64) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: 'Must be at least 64 characters in production',
        });
      }
    }

    for (const key of ['OTP_HMAC_SECRET', 'DATA_ENCRYPTION_KEY', 'AUTH_ENCRYPTION_KEY'] as const) {
      if (!env[key]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: 'Required in production',
        });
      }
    }

    if (env.EMAIL_PROVIDER !== 'resend' || !env.RESEND_API_KEY || !env.AUTH_EMAIL_FROM) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['EMAIL_PROVIDER'],
        message: 'Production email delivery requires EMAIL_PROVIDER=resend, RESEND_API_KEY, and AUTH_EMAIL_FROM',
      });
    }

    if (
      env.SMS_PROVIDER !== 'twilio'
      || !env.TWILIO_ACCOUNT_SID
      || !env.TWILIO_AUTH_TOKEN
      || !env.TWILIO_FROM_NUMBER
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SMS_PROVIDER'],
        message: 'Production SMS delivery requires Twilio credentials and a sender number',
      });
    }
  }
});

function createConfig() {
  const result = authEnvironmentSchema.safeParse(process.env);
  if (!result.success) {
    const invalidVariables = result.error.issues
      .map(issue => issue.path.join('.'))
      .join(', ');
    throw new Error(`Invalid authentication environment configuration: ${invalidVariables}`);
  }

  const env = result.data;
  return {
    JWT_SECRET: env.JWT_SECRET,
    JWT_REFRESH_SECRET: env.JWT_REFRESH_SECRET,
    OTP_HMAC_SECRET: env.OTP_HMAC_SECRET,
    DATA_ENCRYPTION_KEY: env.DATA_ENCRYPTION_KEY,
    AUTH_ENCRYPTION_KEY: env.AUTH_ENCRYPTION_KEY,
    MFA_REQUIRED_FOR_GUARDIANS: env.MFA_REQUIRED_FOR_GUARDIANS === 'true',
    REDIS_URL: env.REDIS_URL,
    EMAIL_PROVIDER: env.EMAIL_PROVIDER || (env.NODE_ENV === 'production' ? undefined : 'mock'),
    RESEND_API_KEY: env.RESEND_API_KEY,
    AUTH_EMAIL_FROM: env.AUTH_EMAIL_FROM,
    SMS_PROVIDER: env.SMS_PROVIDER || (env.NODE_ENV === 'production' ? undefined : 'mock'),
    TWILIO_ACCOUNT_SID: env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: env.TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER: env.TWILIO_FROM_NUMBER,
    ACCESS_TOKEN_EXPIRY: '15m',
    REFRESH_TOKEN_EXPIRY: '7d',
    SESSION_COOKIE_NAME: '__Host-cs_session',
    REFRESH_COOKIE_NAME: '__Host-cs_refresh',
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
