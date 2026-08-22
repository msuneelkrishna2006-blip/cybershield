/**
 * SSRF Protection Utilities
 */

const BLOCKED_IPS = [
  /^127\./,           // localhost
  /^10\./,            // private class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // private class B
  /^192\.168\./,      // private class C
  /^169\.254\./,      // link-local (cloud metadata)
];

const BLOCKED_DOMAINS = [
  'localhost',
  '.local',
  '.internal'
];

const BLOCKED_PROTOCOLS = ['file:', 'ftp:', 'gopher:'];

export interface SsrfCheckResult {
  blocked: boolean;
  reason?: string;
}

/**
 * Checks if a URL targets blocked internal or sensitive addresses
 */
export function isBlockedUrl(urlString: string): SsrfCheckResult {
  try {
    const url = new URL(urlString);

    if (BLOCKED_PROTOCOLS.includes(url.protocol)) {
      return { blocked: true, reason: 'Dangerous protocol' };
    }

    const hostname = url.hostname;

    // Check if domain is blocked
    if (BLOCKED_DOMAINS.some(domain => hostname === domain || hostname.endsWith(domain))) {
      return { blocked: true, reason: 'Blocked internal domain' };
    }

    // Check if IP is blocked (basic string match, note that full protection 
    // requires DNS resolution to catch DNS rebinding and masked IPs)
    if (BLOCKED_IPS.some(regex => regex.test(hostname))) {
      return { blocked: true, reason: 'Blocked private IP range' };
    }

    // Check for metadata IP explicitly
    if (hostname === '169.254.169.254') {
      return { blocked: true, reason: 'Cloud metadata endpoint' };
    }

    return { blocked: false };
  } catch (error) {
    return { blocked: true, reason: 'Invalid URL format' };
  }
}

/**
 * Normalizes and validates a URL, ensuring it is safe against SSRF
 */
export function sanitizeUrl(urlString: string): string {
  const url = new URL(urlString);
  
  const check = isBlockedUrl(urlString);
  if (check.blocked) {
    throw new Error(`SSRF blocked: ${check.reason}`);
  }

  // Normalize by rebuilding
  return url.toString();
}
