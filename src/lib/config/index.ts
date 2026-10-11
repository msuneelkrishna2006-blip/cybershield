/**
 * CyberShield India — Application Configuration
 *
 * Centralized configuration with fail-fast validation.
 * All secrets must be provided via environment variables.
 * NEVER hard-code secrets or use fallback values in production.
 */

/** Require an environment variable, throwing if missing */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(
      `[CyberShield] Missing required environment variable: ${key}. ` +
      `Application cannot start without it. Check your .env file.`
    );
  }
  return value;
}

/** Get optional environment variable with a default */
function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Application configuration — loaded lazily to avoid throwing during Next.js build.
 * Access via `getConfig()`.
 */
interface AppConfig {
  /** Application environment */
  nodeEnv: string;
  /** Whether this is a production deployment */
  isProduction: boolean;
  /** Application base URL */
  appUrl: string;
  /** Log level */
  logLevel: string;
  /** Database connection URL */
  databaseUrl: string;
  /** Redis connection URL (optional in dev) */
  redisUrl: string | undefined;
  /** Google Generative AI API key for Gemini */
  geminiApiKey: string | undefined;
  /** Twilio configuration for OTP */
  twilio: {
    accountSid: string | undefined;
    authToken: string | undefined;
    serviceSid: string | undefined;
  };
}

let _config: AppConfig | null = null;

/**
 * Get application configuration.
 * Throws on first call if required env vars are missing.
 * Caches result for subsequent calls.
 */
export function getConfig(): AppConfig {
  if (_config) return _config;

  _config = {
    nodeEnv: optionalEnv('NODE_ENV', 'development'),
    isProduction: process.env.NODE_ENV === 'production',
    appUrl: optionalEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
    logLevel: optionalEnv('LOG_LEVEL', 'info'),
    databaseUrl: requireEnv('DATABASE_URL'),
    redisUrl: process.env.REDIS_URL,
    geminiApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      serviceSid: process.env.TWILIO_SERVICE_SID,
    },
  };

  return _config;
}

/**
 * Product positioning constants.
 * These are the only approved descriptions for the platform.
 */
export const PRODUCT = {
  name: 'CyberShield',
  tagline: "India's AI-Powered Digital Safety & Cyber Threat Protection Platform",
  positioning: [
    'Built for India\'s digital safety ecosystem.',
    'Designed for Indian users.',
    'India-focused cybersecurity protection.',
  ],
  /** Emergency helpline numbers — verified official GOI numbers */
  emergencyHelplines: [
    { number: '112', label: 'National Emergency', description: 'Police, Fire, Ambulance' },
    { number: '1930', label: 'Cyber Crime Helpline', description: 'National Cybercrime Reporting' },
    { number: '181', label: 'Women Helpline', description: 'Women in distress' },
    { number: '1098', label: 'Childline', description: 'Child protection' },
    { number: '14448', label: 'Senior Citizen Helpline', description: 'Elderly assistance' },
    { number: '100', label: 'Police', description: 'Police emergency' },
    { number: '108', label: 'Ambulance', description: 'Medical emergency' },
  ],
  /** Official cybercrime reporting portal */
  nccrpUrl: 'https://cybercrime.gov.in',
  /** Current version */
  version: '3.0.0',
} as const;
