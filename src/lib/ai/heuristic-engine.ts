/**
 * CyberShield India — Deterministic Heuristic Threat Engine
 *
 * Rule-based threat detection that runs without any AI provider.
 * This is the always-available fallback when Gemini/OpenAI are unavailable.
 * Uses keyword matching, regex patterns, and India-specific scam signatures.
 */

import {
  type AIProvider,
  type AnalysisInput,
  type ScanAnalysisResult,
  type ChatMessage,
  type ChatResponse,
} from './provider';

// ═══════════════════════════════════════════════════════════════
// INDIA-SPECIFIC SCAM PATTERN DATABASE
// ═══════════════════════════════════════════════════════════════

interface ScamPattern {
  category: string;
  keywords: string[];
  weight: number;
  indicators: string[];
}

const SCAM_PATTERNS: ScamPattern[] = [
  {
    category: 'UPI_FRAUD',
    keywords: ['upi', 'paytm', 'phonepe', 'googlepay', 'gpay', 'bhim', 'collect request', 'upi pin', 'qr code payment', 'send money', 'payment link'],
    weight: 15,
    indicators: ['UPI payment mention', 'Payment request detected'],
  },
  {
    category: 'OTP_FRAUD',
    keywords: ['otp', 'verification code', 'share otp', 'send otp', 'otp is', 'one time password', 'sms code', 'confirm code'],
    weight: 20,
    indicators: ['OTP/verification code request', 'Credential harvesting attempt'],
  },
  {
    category: 'KYC_FRAUD',
    keywords: ['kyc', 'pan card', 'aadhaar', 'aadhar', 'kyc update', 'kyc expired', 'pan verification', 'identity verification', 'link aadhaar'],
    weight: 18,
    indicators: ['KYC update request', 'Identity document request'],
  },
  {
    category: 'BANK_IMPERSONATION',
    keywords: ['account blocked', 'account suspended', 'bank account', 'debit card', 'credit card blocked', 'sbi', 'hdfc', 'icici', 'axis bank', 'pnb', 'kotak', 'rbi', 'reserve bank'],
    weight: 16,
    indicators: ['Bank impersonation', 'Account threat'],
  },
  {
    category: 'DIGITAL_ARREST',
    keywords: ['digital arrest', 'cbi', 'narcotics', 'money laundering', 'police case', 'arrest warrant', 'court order', 'customs', 'parcel seized', 'drugs found', 'interpol', 'cyber cell'],
    weight: 25,
    indicators: ['Law enforcement impersonation', 'Digital arrest scam pattern'],
  },
  {
    category: 'GOVERNMENT_IMPERSONATION',
    keywords: ['income tax', 'it department', 'tax refund', 'electricity bill', 'gas connection', 'ration card', 'pm kisan', 'subsidy', 'government scheme', 'sarkari'],
    weight: 16,
    indicators: ['Government impersonation', 'Fake scheme/subsidy offer'],
  },
  {
    category: 'FAKE_JOB',
    keywords: ['work from home', 'part time job', 'earn daily', 'earn per day', 'data entry', 'typing job', 'online earning', 'task based', 'guaranteed income', 'no experience required', 'apply now'],
    weight: 14,
    indicators: ['Suspicious job offer', 'Unrealistic income promise'],
  },
  {
    category: 'LOAN_APP_FRAUD',
    keywords: ['instant loan', 'personal loan', 'loan approved', 'credit score', 'processing fee', 'loan app', 'easy emi', 'zero interest', 'pre-approved loan'],
    weight: 14,
    indicators: ['Predatory lending indicators', 'Unsolicited loan offer'],
  },
  {
    category: 'INVESTMENT_SCAM',
    keywords: ['guaranteed return', 'double money', 'bitcoin', 'crypto', 'trading', 'forex', 'stock tips', 'investment opportunity', 'high return', 'passive income', 'ponzi'],
    weight: 16,
    indicators: ['Unrealistic returns promise', 'Investment scam pattern'],
  },
  {
    category: 'COURIER_SCAM',
    keywords: ['courier', 'parcel', 'delivery failed', 'package held', 'customs duty', 'fedex', 'bluedart', 'delhivery', 'international parcel', 'seized package'],
    weight: 14,
    indicators: ['Fake courier notification', 'Customs impersonation'],
  },
  {
    category: 'CUSTOMER_CARE_FRAUD',
    keywords: ['customer care', 'toll free', 'helpline', 'call this number', 'contact us at', 'customer support number', 'official number'],
    weight: 12,
    indicators: ['Fake customer care number', 'Phishing for contact'],
  },
  {
    category: 'PHISHING',
    keywords: ['click here', 'verify now', 'confirm now', 'update now', 'login required', 'account verify', 'suspicious activity detected', 'security alert'],
    weight: 10,
    indicators: ['Phishing link detected', 'Urgency-based social engineering'],
  },
  {
    category: 'ROMANCE_SCAM',
    keywords: ['dear friend', 'lonely', 'looking for love', 'marriage proposal', 'foreign country', 'send gift', 'meet offline', 'video call', 'relationship'],
    weight: 10,
    indicators: ['Romance scam indicators', 'Emotional manipulation'],
  },
  {
    category: 'REMOTE_ACCESS_SCAM',
    keywords: ['anydesk', 'teamviewer', 'quicksupport', 'screen share', 'remote access', 'install app', 'download app'],
    weight: 20,
    indicators: ['Remote access tool mention', 'Device control attempt'],
  },
  {
    category: 'GROOMING',
    keywords: ['secret', 'dont tell', 'only between us', 'special friend', 'send photo', 'send picture', 'private photo', 'turn on camera', 'video call alone', 'age', 'how old'],
    weight: 22,
    indicators: ['Grooming language detected', 'Privacy/secrecy request'],
  },
];

/** General urgency indicators that amplify risk */
const URGENCY_KEYWORDS = [
  'urgent', 'immediately', 'right now', 'within 24 hours', 'last chance',
  'hurry', 'act fast', 'limited time', 'expiring', 'final notice',
  'do it now', 'turant', 'jaldi', 'abhi', 'fauran',
];

/** URL patterns that increase suspicion */
const SUSPICIOUS_URL_PATTERNS = [
  /https?:\/\/\d+\.\d+\.\d+\.\d+/i,           // IP-based URLs
  /https?:\/\/[^/]*\.(tk|ml|ga|cf|gq)\//i,     // Free TLDs
  /https?:\/\/[^/]*bit\.ly/i,                    // URL shorteners
  /https?:\/\/[^/]*tinyurl/i,
  /https?:\/\/[^/]*short\.link/i,
  /http:\/\//i,                                    // Non-HTTPS
  /https?:\/\/[^/]*-[^/]*-[^/]*\./i,             // Hyphenated domains (typosquatting)
];

// ═══════════════════════════════════════════════════════════════
// HEURISTIC ENGINE
// ═══════════════════════════════════════════════════════════════

/**
 * Deterministic Heuristic Threat Engine.
 * Always available — no external API dependencies.
 */
export class HeuristicEngine implements AIProvider {
  name = 'heuristic';

  isAvailable(): boolean {
    return true; // Always available
  }

  async analyzeThreat(input: AnalysisInput): Promise<ScanAnalysisResult> {
    const text = input.content.toLowerCase();
    let totalScore = 0;
    const detectedCategories: string[] = [];
    const allIndicators: string[] = [];
    let primaryCategory = 'UNKNOWN';
    let maxWeight = 0;

    // Check each scam pattern
    for (const pattern of SCAM_PATTERNS) {
      let matchCount = 0;
      for (const keyword of pattern.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        const patternScore = Math.min(matchCount * pattern.weight, pattern.weight * 3);
        totalScore += patternScore;
        detectedCategories.push(pattern.category);
        allIndicators.push(...pattern.indicators);

        if (patternScore > maxWeight) {
          maxWeight = patternScore;
          primaryCategory = pattern.category;
        }
      }
    }

    // Check urgency amplifiers
    let urgencyCount = 0;
    for (const keyword of URGENCY_KEYWORDS) {
      if (text.includes(keyword.toLowerCase())) {
        urgencyCount++;
      }
    }
    if (urgencyCount > 0) {
      totalScore += urgencyCount * 8;
      allIndicators.push('Urgency language detected');
    }

    // Check suspicious URLs
    for (const pattern of SUSPICIOUS_URL_PATTERNS) {
      if (pattern.test(input.content)) {
        totalScore += 15;
        allIndicators.push('Suspicious URL pattern detected');
        break;
      }
    }

    // Check for credential requests
    if (/(?:send|share|enter|type|give)\s+(?:your\s+)?(?:password|otp|pin|cvv|card\s+number)/i.test(text)) {
      totalScore += 30;
      allIndicators.push('Credential request detected');
    }

    // Normalize score to 0-100
    const riskScore = Math.min(Math.round(totalScore), 100);

    // Determine risk level
    let riskLevel: ScanAnalysisResult['riskLevel'];
    if (riskScore >= 75) riskLevel = 'CRITICAL';
    else if (riskScore >= 50) riskLevel = 'HIGH';
    else if (riskScore >= 25) riskLevel = 'MEDIUM';
    else if (riskScore >= 10) riskLevel = 'LOW';
    else riskLevel = 'SAFE';

    // Confidence based on how many patterns matched
    const confidence = Math.min(detectedCategories.length / 3, 0.85);

    // Unique indicators
    const uniqueIndicators = [...new Set(allIndicators)];

    // Generate explanation
    const explanation = this.generateExplanation(riskLevel, primaryCategory, uniqueIndicators);
    const recommendedAction = this.getRecommendedAction(riskLevel);
    const safeNextSteps = this.getSafeNextSteps(riskLevel, primaryCategory);

    return {
      riskScore,
      riskLevel,
      category: primaryCategory,
      confidence: Math.round(confidence * 100) / 100,
      indicators: uniqueIndicators,
      explanation,
      recommendedAction,
      safeNextSteps,
    };
  }

  async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return {
        message: 'I can help you with cybersecurity questions. What would you like to know?',
        suggestions: [
          'How to check if a message is a scam?',
          'What is digital arrest fraud?',
          'How to report cybercrime in India?',
          'How to protect my UPI account?',
        ],
      };
    }

    const text = lastMessage.content.toLowerCase();

    // Pattern-matched responses for common queries
    if (text.includes('report') && (text.includes('cyber') || text.includes('fraud') || text.includes('scam'))) {
      return {
        message: 'To report cybercrime in India:\n\n1. **Online**: Visit cybercrime.gov.in and file a complaint\n2. **Helpline**: Call 1930 (National Cyber Crime Helpline)\n3. **Police**: Visit your nearest cyber police station\n4. **For financial fraud**: Contact your bank immediately to freeze the transaction\n\n⚠️ Note: Filing a report on CyberShield is NOT the same as filing an official police complaint. Please use the official channels above.',
        suggestions: ['What documents do I need?', 'How to freeze my bank account?'],
      };
    }

    if (text.includes('digital arrest')) {
      return {
        message: '**Digital Arrest is a SCAM** — there is no legal concept called "digital arrest" in India.\n\nScammers impersonate CBI, police, or customs officials and claim you are under "digital arrest" via video call. They demand money to "resolve the case."\n\n**Remember:**\n- Police NEVER arrest anyone over video call\n- No officer will ask for money to drop charges\n- Government agencies do NOT call asking for immediate payment\n\n**If you receive such a call:**\n1. Hang up immediately\n2. Do NOT pay any money\n3. Call 1930 to report\n4. Visit cybercrime.gov.in',
        suggestions: ['How do I report this?', 'My family member was targeted'],
      };
    }

    if (text.includes('upi') && (text.includes('safe') || text.includes('protect') || text.includes('scam'))) {
      return {
        message: '**How to protect your UPI account:**\n\n1. ❌ NEVER share your UPI PIN with anyone\n2. ❌ NEVER enter your PIN to receive money (PIN is only for sending)\n3. ❌ NEVER scan unknown QR codes to receive payment\n4. ✅ Use only official app stores to download UPI apps\n5. ✅ Enable app lock on your UPI apps\n6. ✅ Set transaction limits\n7. ✅ Report unauthorized transactions to your bank within 24 hours\n\n**Common UPI scams:**\n- "Send ₹1 to verify" → SCAM\n- "Enter PIN to receive refund" → SCAM\n- "Scan QR to get cashback" → SCAM',
        suggestions: ['What if I already shared my PIN?', 'How to block UPI transactions?'],
      };
    }

    return {
      message: 'I can help you with cybersecurity questions related to:\n\n• **Scam identification** — analyzing suspicious messages\n• **Account protection** — securing your online accounts\n• **Reporting cybercrime** — how to file complaints\n• **Digital safety** — protecting your family online\n\nPlease note: AI analysis is currently limited. For detailed threat analysis, please use the Scam Scanner feature.',
      suggestions: [
        'How to report cybercrime?',
        'What is digital arrest?',
        'How to protect my UPI?',
        'How to identify phishing?',
      ],
    };
  }

  private generateExplanation(riskLevel: string, category: string, indicators: string[]): string {
    if (riskLevel === 'SAFE' || indicators.length === 0) {
      return 'No significant threats detected based on pattern analysis. However, always exercise caution with unknown messages.';
    }

    const categoryName = category.replace(/_/g, ' ').toLowerCase();
    const prefix = riskLevel === 'CRITICAL' || riskLevel === 'HIGH'
      ? 'This content is likely suspicious.'
      : 'This content contains some potentially concerning patterns.';

    return `${prefix} Detected potential ${categoryName} indicators: ${indicators.join(', ')}. Note: This is a heuristic analysis — for higher confidence results, try again when AI analysis is available.`;
  }

  private getRecommendedAction(riskLevel: string): string {
    switch (riskLevel) {
      case 'CRITICAL':
        return 'Do NOT interact with this message. Do not click links, share information, or send money. Block the sender and report to 1930.';
      case 'HIGH':
        return 'Exercise extreme caution. Do not click links or share personal information. Verify through official channels only.';
      case 'MEDIUM':
        return 'Be cautious. Verify the sender through official channels before taking any action.';
      case 'LOW':
        return 'Low risk detected, but remain vigilant. Verify unknown senders independently.';
      default:
        return 'No immediate action required, but always stay alert to suspicious messages.';
    }
  }

  private getSafeNextSteps(riskLevel: string, category: string): string[] {
    const steps: string[] = ['Do not share personal information with unknown senders'];

    if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
      steps.push('Block the sender immediately');
      steps.push('Report to Cyber Crime Helpline: 1930');
      steps.push('File a complaint at cybercrime.gov.in');
    }

    if (category === 'BANK_IMPERSONATION' || category === 'UPI_FRAUD' || category === 'OTP_FRAUD') {
      steps.push('Contact your bank through the official number on your card/passbook');
      steps.push('Never share OTP, UPI PIN, or card details');
    }

    if (category === 'DIGITAL_ARREST' || category === 'GOVERNMENT_IMPERSONATION') {
      steps.push('Remember: Police/CBI never arrest via video call');
      steps.push('No government official will ask for money over phone');
    }

    if (category === 'GROOMING') {
      steps.push('Talk to a trusted adult immediately');
      steps.push('Call Childline: 1098');
      steps.push('Do not delete evidence — save screenshots');
    }

    return steps;
  }
}
