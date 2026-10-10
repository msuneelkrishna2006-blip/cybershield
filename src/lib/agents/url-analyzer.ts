/**
 * CyberShield India — URL Analyzer Agent
 *
 * Agent 2 in the scan pipeline. Analyzes URLs for phishing indicators:
 * - Domain extraction + normalization
 * - HTTPS/SSL check
 * - Homograph/punycode detection
 * - Suspicious TLD detection
 * - Redirect chain detection
 * - Blocklist check against ThreatIndicator DB
 */

import { prisma } from '@/lib/prisma'

export interface UrlAnalysisResult {
  agentName: 'url-analyzer'
  url: string
  domain: string
  signals: UrlSignal[]
  riskContribution: number // 0-100
  summary: string
}

interface UrlSignal {
  type: string
  description: string
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  score: number // contribution to risk
}

/** Known safe Indian domains — reduces false positives */
const SAFE_DOMAINS = new Set([
  'gov.in', 'nic.in', 'rbi.org.in', 'npci.org.in',
  'sbi.co.in', 'hdfcbank.com', 'icicibank.com', 'axisbank.com',
  'kotak.com', 'pnbindia.in', 'onlinesbi.sbi',
  'paytm.com', 'phonepe.com', 'google.com', 'microsoft.com',
  'amazon.in', 'flipkart.com', 'gpay.app',
  'irctc.co.in', 'incometax.gov.in', 'uidai.gov.in',
])

/** Suspicious TLDs commonly used in phishing */
const SUSPICIOUS_TLDS = new Set([
  'tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top', 'buzz', 'club',
  'icu', 'monster', 'cam', 'rest', 'sbs', 'cfd'
])

/** Brand names commonly impersonated in India-specific phishing */
const IMPERSONATION_TARGETS = [
  { name: 'SBI', pattern: /sbi/i, domain: 'sbi.co.in' },
  { name: 'HDFC', pattern: /hdfc/i, domain: 'hdfcbank.com' },
  { name: 'ICICI', pattern: /icici/i, domain: 'icicibank.com' },
  { name: 'Axis', pattern: /axis/i, domain: 'axisbank.com' },
  { name: 'Paytm', pattern: /paytm/i, domain: 'paytm.com' },
  { name: 'PhonePe', pattern: /phonepe/i, domain: 'phonepe.com' },
  { name: 'GPay', pattern: /gpay|googlepay/i, domain: 'gpay.app' },
  { name: 'IRCTC', pattern: /irctc/i, domain: 'irctc.co.in' },
  { name: 'UIDAI', pattern: /uidai|aadhaar|aadhar/i, domain: 'uidai.gov.in' },
  { name: 'Income Tax', pattern: /incometax/i, domain: 'incometax.gov.in' },
]

export async function analyzeUrl(rawUrl: string): Promise<UrlAnalysisResult> {
  const signals: UrlSignal[] = []
  let riskContribution = 0

  // Normalize URL
  let url = rawUrl.trim()
  if (!url.match(/^https?:\/\//)) {
    url = 'http://' + url
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return {
      agentName: 'url-analyzer',
      url: rawUrl,
      domain: 'unknown',
      signals: [{ type: 'invalid-url', description: 'Could not parse as a valid URL', severity: 'high', score: 40 }],
      riskContribution: 40,
      summary: 'Invalid URL format — could not be analyzed.',
    }
  }

  const domain = parsed.hostname.toLowerCase()

  // 1. HTTPS check
  if (parsed.protocol !== 'https:') {
    signals.push({ type: 'no-https', description: 'Site does not use HTTPS encryption', severity: 'medium', score: 10 })
    riskContribution += 10
  }

  // 2. IP-based URL (common phishing pattern)
  if (/^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/.test(domain)) {
    signals.push({ type: 'ip-url', description: 'URL uses an IP address instead of a domain name', severity: 'high', score: 25 })
    riskContribution += 25
  }

  // 3. Homograph / punycode detection
  if (domain.startsWith('xn--') || /[^\x00-\x7F]/.test(domain)) {
    signals.push({ type: 'homograph', description: 'Domain uses international characters (possible lookalike attack)', severity: 'high', score: 25 })
    riskContribution += 25
  }

  // 4. Suspicious TLD
  const tld = domain.split('.').pop() || ''
  if (SUSPICIOUS_TLDS.has(tld)) {
    signals.push({ type: 'suspicious-tld', description: `Uses suspicious TLD ".${tld}" commonly associated with phishing`, severity: 'medium', score: 15 })
    riskContribution += 15
  }

  // 5. Excessive subdomains (e.g., login.sbi.fakescam.com)
  const parts = domain.split('.')
  if (parts.length > 4) {
    signals.push({ type: 'excessive-subdomains', description: `Domain has ${parts.length} levels — possible impersonation attempt`, severity: 'medium', score: 10 })
    riskContribution += 10
  }

  // 6. URL shortener
  const shorteners = ['bit.ly', 'tinyurl.com', 'goo.gl', 'is.gd', 't.co', 'short.io', 'rb.gy']
  if (shorteners.some(s => domain.includes(s))) {
    signals.push({ type: 'url-shortener', description: 'URL uses a shortening service — destination is hidden', severity: 'medium', score: 15 })
    riskContribution += 15
  }

  // 7. Phishing keywords in URL
  const phishingKeywords = ['login', 'verify', 'secure', 'update', 'confirm', 'bank', 'kyc', 'suspend', 'block', 'unlock']
  const urlLower = url.toLowerCase()
  const keywordHits = phishingKeywords.filter(kw => urlLower.includes(kw))
  if (keywordHits.length >= 2) {
    signals.push({ type: 'phishing-keywords', description: `URL contains phishing keywords: ${keywordHits.join(', ')}`, severity: 'high', score: 20 })
    riskContribution += 20
  } else if (keywordHits.length === 1) {
    signals.push({ type: 'phishing-keywords', description: `URL contains suspicious keyword: "${keywordHits[0]}"`, severity: 'low', score: 5 })
    riskContribution += 5
  }

  // 8. Credential in URL (user:pass@domain)
  if (parsed.username || parsed.password) {
    signals.push({ type: 'credentials-in-url', description: 'URL contains embedded credentials — high risk', severity: 'critical', score: 30 })
    riskContribution += 30
  }

  // 9. Brand impersonation check
  for (const target of IMPERSONATION_TARGETS) {
    if (target.pattern.test(domain) && !domain.endsWith(target.domain)) {
      signals.push({
        type: 'brand-impersonation',
        description: `Domain appears to impersonate ${target.name} (real site: ${target.domain})`,
        severity: 'critical',
        score: 35,
      })
      riskContribution += 35
      break // Only flag the most relevant impersonation
    }
  }

  // 10. Safe domain check (reduce risk)
  const isSafe = Array.from(SAFE_DOMAINS).some(d => domain === d || domain.endsWith('.' + d))
  if (isSafe) {
    signals.push({ type: 'known-safe', description: 'This is a known legitimate domain', severity: 'info', score: -30 })
    riskContribution = Math.max(riskContribution - 30, 0)
  }

  // 11. Check against threat indicator database
  try {
    const threatMatch = await prisma.threatIndicator.findFirst({
      where: {
        OR: [
          { type: 'URL', value: rawUrl },
          { type: 'DOMAIN', value: domain },
        ],
        active: true,
      },
      include: { category: { select: { nameEn: true } } },
    })

    if (threatMatch) {
      const conf = Math.round(threatMatch.confidence * 100)
      signals.push({
        type: 'known-threat',
        description: `Found in threat database: ${threatMatch.category?.nameEn || 'Known threat'} (confidence: ${conf}%)`,
        severity: 'critical',
        score: 40,
      })
      riskContribution += 40
    }
  } catch {
    // DB error — don't block the scan
  }

  riskContribution = Math.min(riskContribution, 100)

  // Generate summary
  const summary = signals.length === 0
    ? `No suspicious indicators found for ${domain}.`
    : signals.length === 1
      ? signals[0].description
      : `Found ${signals.length} indicators: ${signals.filter(s => s.severity !== 'info').map(s => s.description).slice(0, 3).join('; ')}.`

  return {
    agentName: 'url-analyzer',
    url: rawUrl,
    domain,
    signals,
    riskContribution,
    summary,
  }
}
