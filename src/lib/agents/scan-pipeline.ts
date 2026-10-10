import { analyzeEmail } from './email-analyzer';
import { analyzeUpi } from './upi-analyzer';
import { analyzeUrl } from './url-analyzer';
import { getProviderChain, analyzeWithFallback } from '@/lib/ai';

export interface ScanPipelineInput {
  scanType: 'url' | 'sms' | 'email' | 'whatsapp' | 'qr';
  content: string;
  userId?: string;
}

export interface AgentOutput {
  agentName: string;
  agentNumber: number;
  summary: string;
  signals: Array<{ type: string; description: string; severity: string; score: number }>;
  riskContribution: number;
}

export interface ScanPipelineResult {
  verdict: string;
  riskScore: number;
  riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasoning: AgentOutput[];
  scanType: string;
  recommendations: string[];
  helpline?: string;
  timestamp: string;
}

const HELPLINES: Record<string, string> = {
  default: '1930 (National Cyber Crime Helpline)',
  child: '1098 (Childline)',
};

/**
 * CyberShield Multi-Agent Scan Pipeline
 */
export async function runScanPipeline(input: ScanPipelineInput): Promise<ScanPipelineResult> {
  const reasoning: AgentOutput[] = [];
  let combinedRiskScore = 0;
  let agentCounter = 1;

  // 1. Agent 1: Scam Detection (Heuristics — India-specific patterns)
  const scamSignals: Array<{ type: string; description: string; severity: string; score: number }> = [];
  const lowerContent = input.content.toLowerCase();
  
  if (lowerContent.includes('digital arrest') || (lowerContent.includes('cbi') && lowerContent.includes('case')) || lowerContent.includes('narcotics bureau')) {
    scamSignals.push({ type: 'digital_arrest', description: 'Digital Arrest scam — impersonates law enforcement via phone/video call', severity: 'critical', score: 85 });
  }
  if (lowerContent.includes('kyc') && (lowerContent.includes('suspend') || lowerContent.includes('block') || lowerContent.includes('expire'))) {
    scamSignals.push({ type: 'kyc_fraud', description: 'Fake KYC update — threatens account suspension to steal credentials', severity: 'high', score: 70 });
  }
  if ((lowerContent.includes('otp') || lowerContent.includes('one time password')) && (lowerContent.includes('share') || lowerContent.includes('send') || lowerContent.includes('tell'))) {
    scamSignals.push({ type: 'otp_theft', description: 'OTP sharing request — never share OTPs, banks never ask for them', severity: 'critical', score: 90 });
  }
  if (lowerContent.includes('collect request') || (lowerContent.includes('upi') && lowerContent.includes('pin') && lowerContent.includes('receive'))) {
    scamSignals.push({ type: 'upi_collect', description: 'UPI collect request scam — you never need to enter PIN to receive money', severity: 'critical', score: 85 });
  }
  if ((lowerContent.includes('part time') || lowerContent.includes('work from home')) && (lowerContent.includes('earn') || lowerContent.includes('₹') || lowerContent.includes('daily income'))) {
    scamSignals.push({ type: 'job_scam', description: 'Part-time job / task scam — legitimate jobs never ask you to pay first', severity: 'high', score: 70 });
  }
  if (lowerContent.includes('loan app') || (lowerContent.includes('instant loan') && lowerContent.includes('download'))) {
    scamSignals.push({ type: 'loan_app', description: 'Predatory loan app — may access contacts and photos for harassment', severity: 'high', score: 65 });
  }
  if ((lowerContent.includes('customs') || lowerContent.includes('parcel')) && (lowerContent.includes('drugs') || lowerContent.includes('illegal') || lowerContent.includes('seized'))) {
    scamSignals.push({ type: 'customs_scam', description: 'Fake customs/parcel scam — customs never demands payment via phone', severity: 'critical', score: 80 });
  }
  if (lowerContent.includes('electricity') && (lowerContent.includes('disconnect') || lowerContent.includes('cut') || lowerContent.includes('overdue'))) {
    scamSignals.push({ type: 'utility_scam', description: 'Fake utility disconnection — check bills on official website, not SMS links', severity: 'medium', score: 50 });
  }
  if ((lowerContent.includes('urgent') || lowerContent.includes('immediately') || lowerContent.includes('within 24 hours')) && (lowerContent.includes('account') || lowerContent.includes('bank') || lowerContent.includes('payment'))) {
    scamSignals.push({ type: 'urgency_pressure', description: 'Urgency/pressure tactics — scammers create artificial time pressure', severity: 'medium', score: 40 });
  }
  if (lowerContent.includes('6 digit code') || (lowerContent.includes('verification code') && lowerContent.includes('by mistake'))) {
    scamSignals.push({ type: 'account_hijack', description: 'Account hijacking attempt — someone trying to take over your WhatsApp/account', severity: 'critical', score: 85 });
  }
  
  if (scamSignals.length > 0) {
    const risk = Math.max(...scamSignals.map(s => s.score));
    combinedRiskScore = Math.max(combinedRiskScore, risk);
    reasoning.push({
      agentName: 'Scam Detection',
      agentNumber: agentCounter++,
      summary: 'Detected known India-specific scam patterns.',
      signals: scamSignals,
      riskContribution: risk
    });
  }

  // 2. Agent 2: Contextual Analysis based on scanType
  if (input.scanType === 'email') {
    const emailResult = await analyzeEmail(input.content);
    combinedRiskScore = Math.max(combinedRiskScore, emailResult.riskScore);
    reasoning.push({
      agentName: 'Email Analyzer',
      agentNumber: agentCounter++,
      summary: `Analyzed email headers and content. Found ${emailResult.signals.length} signals.`,
      signals: emailResult.signals,
      riskContribution: emailResult.riskScore
    });
  } else if (input.scanType === 'url') {
    try {
      const urlResult = await analyzeUrl(input.content);
      combinedRiskScore = Math.max(combinedRiskScore, urlResult.riskContribution);
      reasoning.push({
        agentName: 'URL Analyzer',
        agentNumber: agentCounter++,
        summary: urlResult.summary,
        signals: urlResult.signals.map(s => ({
          type: s.type,
          description: s.description,
          severity: s.severity,
          score: s.score
        })),
        riskContribution: urlResult.riskContribution
      });
    } catch (err) {
      console.error('URL analysis failed', err);
    }
  }
  
  // For SMS/WhatsApp: extract embedded URLs and analyze them
  if (['sms', 'whatsapp', 'qr'].includes(input.scanType)) {
    const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
    const extractedUrls = input.content.match(urlPattern) || [];
    
    for (const embeddedUrl of extractedUrls.slice(0, 3)) { // Limit to 3 URLs
      try {
        const urlResult = await analyzeUrl(embeddedUrl);
        if (urlResult.riskContribution > 0) {
          combinedRiskScore = Math.max(combinedRiskScore, urlResult.riskContribution);
          reasoning.push({
            agentName: 'URL Analyzer',
            agentNumber: agentCounter++,
            summary: `Analyzed embedded URL: ${urlResult.domain}`,
            signals: urlResult.signals.map(s => ({
              type: s.type,
              description: s.description,
              severity: s.severity,
              score: s.score
            })),
            riskContribution: urlResult.riskContribution
          });
        }
      } catch {
        // Skip URL analysis failures
      }
    }
  }

  // Also run UPI analyzer for messages that might contain UPI stuff
  if (['sms', 'whatsapp', 'email'].includes(input.scanType)) {
    const upiResult = await analyzeUpi(input.content);
    if (upiResult.signals.length > 0) {
      combinedRiskScore = Math.max(combinedRiskScore, upiResult.riskScore);
      reasoning.push({
        agentName: 'UPI Analyzer',
        agentNumber: agentCounter++,
        summary: 'Detected UPI related threats.',
        signals: upiResult.signals,
        riskContribution: upiResult.riskScore
      });
    }
  }

  // 3. Agent 3: AI Verdict (Gemini)
  const aiProviders = getProviderChain();
  // Map scanType to AnalysisInput type ('general' fallback if not strictly matching)
  const mappedType = ['sms', 'whatsapp', 'email', 'url', 'qr'].includes(input.scanType) 
    ? input.scanType as any 
    : 'general';

  const { result: aiResult } = await analyzeWithFallback(aiProviders, {
    content: input.content,
    type: mappedType
  });

  // Blend scores - AI gets a say, but heuristics can override if high
  combinedRiskScore = Math.max(combinedRiskScore, aiResult.riskScore);

  reasoning.push({
    agentName: 'AI Engine',
    agentNumber: agentCounter++,
    summary: 'Deep context analysis using AI.',
    signals: aiResult.indicators.map(ind => ({
      type: 'ai_finding',
      description: ind,
      severity: aiResult.riskLevel.toLowerCase(),
      score: aiResult.riskScore
    })),
    riskContribution: aiResult.riskScore
  });

  // Calculate final risk level
  let finalRiskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'SAFE';
  if (combinedRiskScore >= 76) finalRiskLevel = 'CRITICAL';
  else if (combinedRiskScore >= 51) finalRiskLevel = 'HIGH';
  else if (combinedRiskScore >= 26) finalRiskLevel = 'MEDIUM';
  else if (combinedRiskScore >= 11) finalRiskLevel = 'LOW';

  // Construct one-line verdict
  let verdict = `Analysis complete: ${aiResult.explanation.slice(0, 80)}...`;
  if (finalRiskLevel === 'CRITICAL' || finalRiskLevel === 'HIGH') {
    verdict = `⚠️ Dangerous — ${aiResult.category || 'Threat'} detected. Do not interact with this content.`;
  } else if (finalRiskLevel === 'SAFE') {
    verdict = `✅ Safe — No significant threats detected.`;
  } else {
    verdict = `⚠️ Caution — Be careful, potential risks detected.`;
  }

  return {
    verdict,
    riskScore: combinedRiskScore,
    riskLevel: finalRiskLevel,
    reasoning,
    scanType: input.scanType,
    recommendations: aiResult.safeNextSteps || [aiResult.recommendedAction],
    helpline: (finalRiskLevel === 'HIGH' || finalRiskLevel === 'CRITICAL') ? HELPLINES.default : undefined,
    timestamp: new Date().toISOString()
  };
}
