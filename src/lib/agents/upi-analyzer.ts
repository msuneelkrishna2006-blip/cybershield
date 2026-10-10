/**
 * CyberShield India — UPI Analyzer Agent
 * 
 * Analyzes UPI-related content for known scams like fake payment confirmations,
 * collect request scams, and mule patterns.
 */

export interface UPIAnalysisSignal {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
}

export interface UPIAnalysisResult {
  signals: UPIAnalysisSignal[];
  riskScore: number;
}

export async function analyzeUpi(content: string): Promise<UPIAnalysisResult> {
  const signals: UPIAnalysisSignal[] = [];
  let totalScore = 0;

  const lowerContent = content.toLowerCase();

  // UPI ID extraction
  const upiRegex = /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/g;
  const upiMatches = content.match(upiRegex);
  if (upiMatches) {
    signals.push({
      type: 'upi_id_detected',
      description: `Detected UPI ID(s): ${upiMatches.join(', ')}`,
      severity: 'low',
      score: 5
    });
    totalScore += 5;
  }

  // Collect request scam keywords
  const collectRequestKeywords = ['enter pin to receive', 'enter upi pin to get', 'receive payment', 'click to receive', 'scan to receive'];
  for (const keyword of collectRequestKeywords) {
    if (lowerContent.includes(keyword)) {
      signals.push({
        type: 'collect_request_scam',
        description: 'Requests UPI PIN to receive money (Common Scam: You never need a PIN to receive money)',
        severity: 'critical',
        score: 90
      });
      totalScore += 90;
    }
  }

  // Fake payment confirmation patterns
  if (lowerContent.includes('payment successful') && (lowerContent.includes('apk') || lowerContent.includes('download'))) {
    signals.push({
      type: 'fake_payment_app',
      description: 'Mentions payment success along with app download (Potential fake payment app)',
      severity: 'high',
      score: 75
    });
    totalScore += 75;
  }
  
  if (lowerContent.includes('cashback') && lowerContent.includes('scratch card')) {
    signals.push({
      type: 'cashback_scam',
      description: 'Mentions cashback or scratch card (Common lure)',
      severity: 'medium',
      score: 30
    });
    totalScore += 30;
  }

  return {
    signals,
    riskScore: Math.min(100, totalScore)
  };
}
