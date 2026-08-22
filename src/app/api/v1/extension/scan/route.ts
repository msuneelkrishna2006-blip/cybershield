/**
 * CyberShield India — Browser Extension API
 * POST /api/v1/extension/scan
 *
 * Lightweight scan endpoint for the browser extension.
 * Accepts URL or text content and returns a quick risk assessment.
 * Uses API key auth (X-Extension-Key header) instead of cookies.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isBlockedUrl } from '@/lib/security/ssrf';
import { apiSuccess, apiError } from '@/lib/api/response';

const extensionScanSchema = z.object({
  url: z.string().url().max(2048).optional(),
  content: z.string().max(5000).optional(),
  source: z.enum(['chrome', 'firefox', 'edge']).optional(),
}).refine(data => data.url || data.content, {
  message: 'Either url or content is required',
});

// Verify extension API key
function verifyExtensionKey(request: NextRequest): boolean {
  const key = request.headers.get('x-extension-key');
  const validKey = process.env.EXTENSION_API_KEY;

  // In dev mode, allow any key
  if (process.env.NODE_ENV !== 'production') return true;

  if (!validKey || !key) return false;
  return key === validKey;
}

/** Known phishing patterns for quick URL check */
const QUICK_URL_PATTERNS = [
  { pattern: /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/, risk: 20, label: 'IP-based URL' },
  { pattern: /\.(tk|ml|ga|cf|gq|xyz|top|buzz)\//i, risk: 25, label: 'Suspicious TLD' },
  { pattern: /(login|verify|secure|update|account|confirm|bank|kyc)/i, risk: 15, label: 'Phishing keywords' },
  { pattern: /bit\.ly|tinyurl|goo\.gl|is\.gd/i, risk: 15, label: 'URL shortener' },
  { pattern: /xn--|[а-яА-Я]/i, risk: 25, label: 'IDN/homograph' },
  { pattern: /@/i, risk: 10, label: 'Credential in URL' },
];

/** Known safe Indian domains */
const SAFE_DOMAINS = [
  'gov.in', 'nic.in', 'rbi.org.in', 'npci.org.in',
  'sbi.co.in', 'hdfcbank.com', 'icicibank.com',
  'paytm.com', 'phonepe.com', 'google.com', 'microsoft.com',
];

export async function POST(request: NextRequest) {
  try {
    if (!verifyExtensionKey(request)) {
      return apiError('UNAUTHORIZED', 'Invalid extension API key', 401);
    }

    const body = await request.json();
    const parsed = extensionScanSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid scan request', 400);
    }

    const { url, content, source } = parsed.data;
    let riskScore = 0;
    const indicators: string[] = [];

    // URL analysis
    if (url) {
      // SSRF check
      const ssrfCheck = isBlockedUrl(url);
      if (ssrfCheck.blocked) {
        return apiSuccess({
          riskScore: 100,
          riskLevel: 'CRITICAL',
          blocked: true,
          indicators: ['Blocked: targets internal network'],
          action: 'DO NOT VISIT',
        });
      }

      // Check against known threat indicators
      try {
        const hostname = new URL(url).hostname;
        const threatMatch = await prisma.threatIndicator.findFirst({
          where: {
            OR: [
              { type: 'URL', value: url },
              { type: 'DOMAIN', value: hostname },
            ],
            active: true,
          },
        });

        if (threatMatch) {
          riskScore += Math.round(threatMatch.confidence * 80);
          indicators.push(`Known threat indicator (confidence: ${Math.round(threatMatch.confidence * 100)}%)`);
        }

        // Safe domain check
        const isSafe = SAFE_DOMAINS.some(d => hostname.endsWith(d));
        if (isSafe) {
          riskScore = Math.max(riskScore - 30, 0);
          indicators.push('Known safe domain');
        }
      } catch {
        // URL parse failed
      }

      // Pattern matching
      for (const { pattern, risk, label } of QUICK_URL_PATTERNS) {
        if (pattern.test(url)) {
          riskScore += risk;
          indicators.push(label);
        }
      }

      // HTTPS check
      if (!url.startsWith('https://')) {
        riskScore += 10;
        indicators.push('No HTTPS');
      }
    }

    // Text content analysis (quick keyword check)
    if (content) {
      const scamKeywords = [
        'otp', 'kyc', 'verify', 'blocked', 'suspended', 'arrest', 'warrant',
        'upi', 'transfer', 'lottery', 'prize', 'winner', 'urgent',
        'click here', 'limited time', 'act now', 'aadhaar', 'pan card',
      ];

      const lowerContent = content.toLowerCase();
      let keywordHits = 0;
      for (const keyword of scamKeywords) {
        if (lowerContent.includes(keyword)) keywordHits++;
      }

      if (keywordHits >= 3) {
        riskScore += 40;
        indicators.push(`${keywordHits} scam keywords detected`);
      } else if (keywordHits >= 1) {
        riskScore += 15;
        indicators.push(`${keywordHits} suspicious keyword(s)`);
      }
    }

    riskScore = Math.min(riskScore, 100);

    let riskLevel: string;
    if (riskScore >= 75) riskLevel = 'CRITICAL';
    else if (riskScore >= 50) riskLevel = 'HIGH';
    else if (riskScore >= 25) riskLevel = 'MEDIUM';
    else if (riskScore >= 10) riskLevel = 'LOW';
    else riskLevel = 'SAFE';

    return apiSuccess({
      riskScore,
      riskLevel,
      indicators,
      action: riskLevel === 'CRITICAL' || riskLevel === 'HIGH'
        ? 'BLOCK — This appears dangerous. Do not proceed.'
        : riskLevel === 'MEDIUM'
          ? 'CAUTION — Verify through official channels.'
          : 'SAFE — No significant threats detected.',
      source: source || 'unknown',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Extension] Scan error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Extension scan failed', 500);
  }
}
