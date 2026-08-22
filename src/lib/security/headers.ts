/**
 * Generates an object containing standard security headers
 * optimized for Next.js middleware.
 */
export function getSecurityHeaders() {
  return {
    // Basic CSP - nonce generation is complex in Next.js edge runtime, but here is a strong default
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:;",
    
    // Enforce HTTPS
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',
    
    // Rely on CSP for XSS protection
    'X-XSS-Protection': '0',
    
    // Strict referrer info
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Restrict device permissions
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)'
  };
}
