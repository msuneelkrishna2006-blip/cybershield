import { z } from 'zod';

/**
 * Strips dangerous HTML/script tags from input string.
 * Note: A real implementation should use DOMPurify or similar.
 */
export function sanitizeHtml(input: string): string {
  if (!input) return input;
  // Simple regex-based sanitization for basic needs (stripping scripts and common XSS vectors)
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/g, '')
    .replace(/on\w+='[^']*'/g, '')
    .replace(/on\w+=\w+/g, '');
}

/**
 * Validates that an input string does not exceed a maximum length.
 */
export function validateMaxLength(input: string, max: number): boolean {
  return input.length <= max;
}

// Common Zod schemas

export const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(255, 'Email is too long');

export const phoneSchema = z
  .string()
  .regex(/^(?:\+91|91)?[6-9]\d{9}$|^[0-9]{10}$/, 'Invalid Indian phone number format');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .max(72, 'Password is too long');

export const scanInputSchema = z
  .string()
  .max(10000, 'Input exceeds maximum length of 10000 characters')
  .transform(val => sanitizeHtml(val));

export const urlSchema = z
  .string()
  .url('Invalid URL format')
  .max(2048, 'URL is too long');
