/**
 * CyberShield India — Email Analyzer Agent
 * 
 * Analyzes pasted email content for spoofing indicators, phishing keywords,
 * urgency language, and other threats.
 */

export interface EmailAnalysisSignal {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
}

export interface EmailAnalysisResult {
  signals: EmailAnalysisSignal[];
  riskScore: number;
}

export async function analyzeEmail(content: string): Promise<EmailAnalysisResult> {
  const signals: EmailAnalysisSignal[] = [];
  let totalScore = 0;

  const lowerContent = content.toLowerCase();

  // Spoofing indicators
  if (lowerContent.includes('from:') && lowerContent.includes('reply-to:')) {
    // Simple heuristic for mismatched headers if visible in pasted text
    signals.push({
      type: 'header_mismatch',
      description: 'Potential sender spoofing (Reply-To differs from sender)',
      severity: 'medium',
      score: 30
    });
    totalScore += 30;
  }

  // Phishing keywords
  const phishingKeywords = ['verify your account', 'update your payment', 'account suspended', 'login immediately', 'unauthorized access'];
  for (const keyword of phishingKeywords) {
    if (lowerContent.includes(keyword)) {
      signals.push({
        type: 'phishing_language',
        description: `Found common phishing phrase: "${keyword}"`,
        severity: 'high',
        score: 40
      });
      totalScore += 40;
    }
  }

  // Urgency language
  const urgencyKeywords = ['urgent', 'immediate action required', '24 hours', 'will be closed'];
  for (const keyword of urgencyKeywords) {
    if (lowerContent.includes(keyword)) {
      signals.push({
        type: 'urgency_pressure',
        description: 'Uses urgency to pressure the user',
        severity: 'medium',
        score: 20
      });
      totalScore += 20;
    }
  }
  
  // SPF/DKIM/DMARC failures (if mentioned in headers)
  if (lowerContent.includes('spf=fail') || lowerContent.includes('dkim=fail') || lowerContent.includes('dmarc=fail')) {
    signals.push({
      type: 'auth_failure',
      description: 'Email authentication failed (SPF/DKIM/DMARC)',
      severity: 'high',
      score: 50
    });
    totalScore += 50;
  }

  return {
    signals,
    riskScore: Math.min(100, totalScore)
  };
}
