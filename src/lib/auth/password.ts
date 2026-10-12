import { hash, verify } from '@node-rs/argon2';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const DUMMY_PASSWORD = 'CyberShield-invalid-user-dummy-password';
let dummyHashPromise: Promise<string> | undefined;

const COMMON_PASSWORDS = new Set([
  '123456789012',
  'password123',
  'password1234',
  'qwerty123456',
  'iloveyou1234',
  'admin123456',
  'welcome1234',
  'letmein12345',
]);

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  if (encodedHash.startsWith('$argon2')) {
    try {
      return await verify(encodedHash, password);
    } catch {
      return false;
    }
  }

  // Existing accounts used bcrypt; support them for login and upgrade after success.
  if (encodedHash.startsWith('$2')) {
    return bcrypt.compare(password, encodedHash);
  }

  return false;
}

export async function verifyUnknownUserPassword(password: string): Promise<void> {
  dummyHashPromise ??= hashPassword(DUMMY_PASSWORD);
  await verify(await dummyHashPromise, password);
}

export async function isCommonPassword(password: string): Promise<boolean> {
  const normalized = password.toLowerCase();
  if (COMMON_PASSWORDS.has(normalized)) return true;

  const hashHex = createHash('sha1').update(password).digest('hex').toUpperCase();

  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${hashHex.slice(0, 5)}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) throw new Error('Breach lookup failed');

    const suffix = hashHex.slice(5);
    return (await response.text()).split(/\r?\n/).some(line => line.split(':', 1)[0] === suffix);
  } catch {
    console.warn('[Auth] Breached-password lookup unavailable; using local password checks');
    return false;
  }
}

export async function validatePasswordStrength(password: string): Promise<boolean> {
  return password.length >= 12
    && password.length <= 128
    && !(await isCommonPassword(password));
}
