/**
 * CyberShield India — Security Hardening Utilities
 *
 * Additional security measures beyond the base middleware.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Content Security Policy with nonce support.
 * In production: generates per-request nonce for inline scripts.
 */
export function generateCspNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Validates that request origin matches allowed origins.
 * Prevents CSRF attacks on state-changing endpoints.
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // No origin header = same-origin request (OK)
  if (!origin) return true;

  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'https://cybershield.in',
    'https://www.cybershield.in',
  ].filter(Boolean);

  if (allowedOrigins.includes(origin)) return true;

  // Check referer as fallback
  if (referer) {
    return allowedOrigins.some(o => referer.startsWith(o));
  }

  return false;
}

/**
 * Sanitizes user input to prevent XSS in stored data.
 * Strips HTML tags and dangerous patterns.
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/data:text\/html/gi, '')
    .trim();
}

/**
 * Checks if a password has been compromised using k-anonymity.
 * Uses the HaveIBeenPwned API (only sends first 5 chars of SHA-1 hash).
 */
export async function isPasswordCompromised(password: string): Promise<boolean> {
  try {
    const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) return false; // Don't block on API failure

    const text = await res.text();
    return text.split('\n').some(line => line.startsWith(suffix));
  } catch {
    return false; // Network error — don't block registration
  }
}

/**
 * Generates a secure random token for password resets, invites, etc.
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Rate limit key generator with IP + User-Agent fingerprint.
 * More resistant to IP rotation attacks.
 */
export function getRateLimitKey(request: NextRequest, prefix: string): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
  const ua = request.headers.get('user-agent') || '';
  const uaHash = crypto.createHash('md5').update(ua).digest('hex').slice(0, 8);
  return `${prefix}:${ip}:${uaHash}`;
}
