/**
 * CyberShield India — URL Analysis API
 * POST /api/v1/urls/analyze
 *
 * Analyzes a URL for security threats using SSRF protection,
 * domain intelligence, and SSL verification.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getAccessToken } from '@/lib/auth/cookies';
import { isBlockedUrl } from '@/lib/security/ssrf';
import { apiSuccess, apiError } from '@/lib/api/response';

const urlAnalyzeSchema = z.object({
  url: z.string().url('Invalid URL format').max(2048),
});

/** Extract domain components from a URL */
function parseDomainInfo(urlString: string) {
  try {
    const parsed = new URL(urlString);
    const hostname = parsed.hostname;
    const parts = hostname.split('.');
    const tld = parts.length > 1 ? parts[parts.length - 1] : '';
    return {
      domain: hostname,
      tld,
      protocol: parsed.protocol,
      path: parsed.pathname,
      hasSsl: parsed.protocol === 'https:',
    };
  } catch {
    return null;
  }
}

/** Known suspicious TLDs commonly used in phishing */
const SUSPICIOUS_TLDS = new Set([
  'tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top', 'buzz', 'club',
  'work', 'click', 'link', 'info', 'icu', 'live', 'su',
]);

/** Known legitimate Indian domains */
const TRUSTED_INDIAN_DOMAINS = new Set([
  'gov.in', 'nic.in', 'sbi.co.in', 'hdfcbank.com', 'icicibank.com',
  'axisbank.com', 'kotak.com', 'rbi.org.in', 'npci.org.in',
  'cybercrime.gov.in', 'paytm.com', 'phonepe.com', 'gpay.in',
]);

/** Suspicious URL patterns */
const SUSPICIOUS_PATTERNS = [
  /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/,  // IP-based URLs
  /-{2,}/,                                                // Multiple hyphens
  /\.(tk|ml|ga|cf|gq)\//,                                // Free TLDs
  /login|verify|secure|update|account|confirm/i,          // Phishing keywords in path
  /[а-яА-Я]/,                                            // Cyrillic characters (homograph)
  /@/,                                                     // @ in URL (credential injection)
];

export async function POST(request: NextRequest) {
  try {
    const token = getAccessToken(request);
    if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);

    try {
      verifyAccessToken(token);
    } catch {
      return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    const body = await request.json();
    const parsed = urlAnalyzeSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid URL', 400);
    }

    const { url } = parsed.data;

    // SSRF check — block private/internal URLs
    const ssrfCheck = isBlockedUrl(url);
    if (ssrfCheck.blocked) {
      // Store the blocked attempt
      await prisma.urlAnalysis.create({
        data: {
          url: url.substring(0, 500),
          ssrfBlocked: true,
          riskScore: 100,
          indicators: JSON.stringify([`SSRF blocked: ${ssrfCheck.reason}`]),
        },
      });

      return apiSuccess({
        riskScore: 100,
        riskLevel: 'CRITICAL',
        blocked: true,
        reason: 'This URL targets an internal or restricted network address. It has been blocked for security.',
        indicators: ['SSRF attack attempt detected'],
      });
    }

    // Parse domain info
    const domainInfo = parseDomainInfo(url);
    if (!domainInfo) {
      return apiError('INVALID_URL', 'Could not parse URL', 400);
    }

    // Build risk assessment
    const indicators: string[] = [];
    let riskScore = 0;

    // Check SSL
    if (!domainInfo.hasSsl) {
      riskScore += 20;
      indicators.push('No SSL/HTTPS — connection is not encrypted');
    }

    // Check TLD
    if (SUSPICIOUS_TLDS.has(domainInfo.tld)) {
      riskScore += 15;
      indicators.push(`Suspicious TLD (.${domainInfo.tld}) commonly used in phishing`);
    }

    // Check trusted domains
    const isTrusted = Array.from(TRUSTED_INDIAN_DOMAINS).some(d =>
      domainInfo.domain.endsWith(d)
    );
    if (isTrusted) {
      riskScore = Math.max(riskScore - 30, 0);
      indicators.push('Domain matches a known trusted Indian service');
    }

    // Check suspicious patterns
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(url)) {
        riskScore += 10;
        indicators.push('Suspicious URL pattern detected');
        break;
      }
    }

    // Check domain length (long domains are suspicious)
    if (domainInfo.domain.length > 40) {
      riskScore += 10;
      indicators.push('Unusually long domain name');
    }

    // Check for URL shorteners
    const shorteners = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'v.gd'];
    if (shorteners.some(s => domainInfo.domain.includes(s))) {
      riskScore += 15;
      indicators.push('URL shortener detected — final destination unknown');
    }

    // Check for homograph attacks
    if (/[а-яА-Я]/.test(url) || /xn--/.test(domainInfo.domain)) {
      riskScore += 25;
      indicators.push('Internationalized domain name (IDN) — possible homograph attack');
    }

    // Cap score
    riskScore = Math.min(riskScore, 100);

    // Determine risk level
    let riskLevel: string;
    if (riskScore >= 75) riskLevel = 'CRITICAL';
    else if (riskScore >= 50) riskLevel = 'HIGH';
    else if (riskScore >= 25) riskLevel = 'MEDIUM';
    else if (riskScore >= 10) riskLevel = 'LOW';
    else riskLevel = 'SAFE';

    // Store analysis
    const analysis = await prisma.urlAnalysis.create({
      data: {
        url: url.substring(0, 500),
        domain: domainInfo.domain,
        tld: domainInfo.tld,
        hasSsl: domainInfo.hasSsl,
        riskScore,
        indicators: JSON.stringify(indicators),
        ssrfBlocked: false,
      },
    });

    return apiSuccess({
      analysisId: analysis.id,
      url: url.substring(0, 100) + (url.length > 100 ? '...' : ''),
      domain: domainInfo.domain,
      hasSsl: domainInfo.hasSsl,
      riskScore,
      riskLevel,
      indicators,
      isTrusted,
      recommendation: riskLevel === 'SAFE' || riskLevel === 'LOW'
        ? 'URL appears relatively safe, but always exercise caution.'
        : riskLevel === 'CRITICAL'
          ? 'DO NOT visit this URL. It shows strong indicators of being malicious.'
          : 'Exercise caution. Verify the URL through official channels before visiting.',
    });
  } catch (error) {
    console.error('[URL] Analysis error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'URL analysis failed', 500);
  }
}
