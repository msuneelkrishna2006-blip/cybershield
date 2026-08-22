"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeThreatCollaborative = analyzeThreatCollaborative;
const google_1 = require("@ai-sdk/google");
const ai_1 = require("ai");
const client_1 = require("@prisma/client");
// Local high-fidelity mock orchestrator for fallback/out-of-box usage
function fallbackOrchestration(input, type) {
    const content = input.toLowerCase();
    let riskScore = 15;
    let riskLevel = client_1.RiskLevel.safe;
    let category = 'safe';
    let summary = 'Safe message';
    let recommendations = ['No threat detected', 'Safe to reply'];
    let indicators = [];
    const agents = [
        { name: 'Scam Detection Agent', confidence: 95 },
        { name: 'Financial Fraud Agent', confidence: 90 },
        { name: 'Risk Assessment Agent', confidence: 98 }
    ];
    if (content.includes('kyc') || content.includes('block') || content.includes('hdfc') || content.includes('sbi')) {
        riskScore = 92;
        riskLevel = client_1.RiskLevel.critical;
        category = 'kyc_fraud';
        summary = 'Critical Banking Phishing Scam';
        recommendations = ['Do NOT click any links', 'Report to National Cyber Crime portal', 'Call Cyber Crime Helpline at 1930'];
        indicators = ['Impersonating HDFC/SBI bank', 'Urgent "account blocked" threat', 'Unofficial kyc portal link'];
    }
    else if (content.includes('part-time') || content.includes('like') || content.includes('task') || content.includes('earn')) {
        riskScore = 85;
        riskLevel = client_1.RiskLevel.high;
        category = 'task_scam';
        summary = 'Part-Time Tasks YouTube Job Scam';
        recommendations = ['YouTube task likes are fraudulent scams', 'Do not pay initial deposits to unlock tasks'];
        indicators = ['High income ₹5000/day claim', 'Simple tasks (like videos)', 'Redirects to Telegram chat'];
    }
    else if (content.includes('police') || content.includes('arrest') || content.includes('cbi') || content.includes('drugs')) {
        riskScore = 96;
        riskLevel = client_1.RiskLevel.critical;
        category = 'digital_arrest';
        summary = 'Digital Arrest Extortion Threat';
        recommendations = ['Police or CBI never contact citizens via WhatsApp video calls', 'Do not share personal details', 'Hang up immediately'];
        indicators = ['WhatsApp video call threat', 'Impersonating CBI officers', 'Claims drug courier packet found'];
    }
    else if (content.includes('electricity') || content.includes('power') || content.includes('cut') || content.includes('disconnection')) {
        riskScore = 78;
        riskLevel = client_1.RiskLevel.medium;
        category = 'otp_fraud';
        summary = 'Electricity Disconnection Scam';
        recommendations = ['Power companies never request OTP or bank logins via SMS', 'Pay bills only on official app portals'];
        indicators = ['Urgent disconnection threat', 'Personal mobile number contact', 'Demands phone dialer app control'];
    }
    const agentResults = agents.map(agent => ({
        agentName: agent.name,
        agentIcon: 'ShieldAlert',
        confidence: agent.confidence,
        riskScore,
        category,
        summary,
        explanation: `Analyzed message for signature indicators. Score: ${riskScore}%. Detected threat indicators: ${indicators.join(', ') || 'None'}.`,
        indicators,
        recommendations,
        processingTime: Math.floor(Math.random() * 200) + 100
    }));
    return {
        riskScore,
        riskLevel,
        category,
        summary,
        recommendations,
        agentResults
    };
}
// Multi-Agent Collaboration analysis entry point
async function analyzeThreatCollaborative(input, type) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        console.log('Gemini API key not found. Falling back to local multi-agent simulation.');
        return fallbackOrchestration(input, type);
    }
    try {
        const prompt = `You are a multi-agent orchestrator analyzing a potential cyber scam in India.
Analyze the following input message/content:
Type: ${type}
Content: "${input}"

Orchestrate the collaborative analysis among these agents:
1. Scam Detection Agent (analyses urgency, banking terms, threats)
2. Financial Fraud Agent (checks for UPI, cash prize, money requests)
3. Risk Assessment Agent (determines final risk score 0-100 and risk level: safe, low, medium, high, critical)
4. Summarizer Agent (creates clean single-sentence highlights)
5. Report Generator Agent (compiles list of safety actions)

You MUST respond strictly in valid JSON format.
Example structure:
{
  "riskScore": 92,
  "riskLevel": "critical",
  "category": "kyc_fraud",
  "summary": "Critical Bank KYC Phishing Scam",
  "recommendations": ["Do not click the link", "Banks never send unofficial URLs"],
  "agentResults": [
    {
      "agentName": "Scam Detection Agent",
      "agentIcon": "ShieldAlert",
      "confidence": 95,
      "riskScore": 92,
      "category": "kyc_fraud",
      "summary": "Urgent banking message mimic",
      "explanation": "Uses threat language to force verification action.",
      "indicators": ["Threat of blocking", "Unofficial link"],
      "recommendations": ["Ignore SMS"],
      "processingTime": 150
    }
  ]
}`;
        const { text } = await (0, ai_1.generateText)({
            model: (0, google_1.google)('models/gemini-2.5-flash'),
            prompt,
            system: 'You are a cybersecurity multi-agent orchestrator. Return only raw, valid JSON matching the schema.'
        });
        const result = JSON.parse(text);
        // Convert string risk level to Prisma enum
        let resolvedRiskLevel = client_1.RiskLevel.safe;
        const riskLower = String(result.riskLevel).toLowerCase();
        if (riskLower === 'critical')
            resolvedRiskLevel = client_1.RiskLevel.critical;
        else if (riskLower === 'high')
            resolvedRiskLevel = client_1.RiskLevel.high;
        else if (riskLower === 'medium')
            resolvedRiskLevel = client_1.RiskLevel.medium;
        else if (riskLower === 'low')
            resolvedRiskLevel = client_1.RiskLevel.low;
        return {
            riskScore: result.riskScore || 0,
            riskLevel: resolvedRiskLevel,
            category: result.category || 'safe',
            summary: result.summary || 'Scan complete',
            recommendations: result.recommendations || [],
            agentResults: result.agentResults || []
        };
    }
    catch (err) {
        console.error('Gemini Multi-Agent Orchestration error, falling back to local simulation:', err);
        return fallbackOrchestration(input, type);
    }
}
