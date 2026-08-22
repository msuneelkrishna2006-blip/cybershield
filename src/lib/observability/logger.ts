import { generateCorrelationId } from '@/lib/security/correlation';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  [key: string]: any;
}

const SENSITIVE_FIELDS = ['password', 'token', 'otp', 'apiKey', 'secret', 'accessToken', 'refreshToken'];

function maskSensitiveData(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(maskSensitiveData);
  }

  const maskedObj: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()));
    if (isSensitive) {
      maskedObj[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      maskedObj[key] = maskSensitiveData(value);
    } else {
      maskedObj[key] = value;
    }
  }
  return maskedObj;
}

function log(level: LogLevel, message: string, correlationId?: string, extra?: object) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    correlationId,
    ...maskSensitiveData(extra || {})
  };
  
  // Format as JSON
  const output = JSON.stringify(entry);

  switch (level) {
    case 'debug':
      console.debug(output);
      break;
    case 'info':
      console.info(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'error':
      console.error(output);
      break;
  }
}

export const logger = {
  debug: (message: string, correlationId?: string, extra?: object) => log('debug', message, correlationId, extra),
  info: (message: string, correlationId?: string, extra?: object) => log('info', message, correlationId, extra),
  warn: (message: string, correlationId?: string, extra?: object) => log('warn', message, correlationId, extra),
  error: (message: string, correlationId?: string, extra?: object) => log('error', message, correlationId, extra),
};

export async function logSecurityEvent(event: { type: string; userId?: string; ipAddress?: string; details: any }) {
  const correlationId = generateCorrelationId();
  logger.warn(`SECURITY EVENT: ${event.type}`, correlationId, event);
  
  // Later: save to `security_events` table via Prisma
  // await prisma.securityEvent.create({ ... })
}
