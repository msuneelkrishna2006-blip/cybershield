/**
 * CyberShield India — Child Safety Agent
 * 
 * Analyzes chat/message text for grooming, cyberbullying, and abusive language.
 */

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

export interface ChildSafetyResult {
  verdict: string;
  riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  categories: string[];
  indicators: Array<{ pattern: string; description: string; severity: string }>;
  recommendations: string[];
  parentAlert: boolean;
}

const CHILD_SAFETY_PROMPT = `You are a Child Safety AI Agent for CyberShield India. 
Your job is to analyze chat messages directed at a child for predatory behavior, grooming, cyberbullying, and manipulation.

Analyze the following content. The child's age is \${AGE}.
Content:
---
\${CONTENT}
---

Return ONLY valid JSON matching this schema:
{
  "verdict": "One-line plain-language verdict (e.g., 'Warning — grooming patterns detected')",
  "riskLevel": "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "categories": ["grooming", "cyberbullying", "manipulation", "abuse"],
  "indicators": [
    { "pattern": "exact words/theme", "description": "why it's dangerous", "severity": "low/medium/high/critical" }
  ],
  "recommendations": ["actions the child or parent should take"],
  "parentAlert": true/false
}

Look for:
- Grooming: age probing, isolation language, secret-keeping, gift-giving promises
- Cyberbullying: threats, insults, exclusion, humiliation
- Emotional manipulation: guilt-tripping, love bombing, gaslighting
`;

export async function analyzeChildSafety(text: string, childAge: string = 'unknown'): Promise<ChildSafetyResult> {
  // First run basic heuristic checks
  const lowerText = text.toLowerCase();
  const indicators: Array<{ pattern: string; description: string; severity: string }> = [];
  const categories = new Set<string>();
  
  if (lowerText.includes('don\'t tell your parents') || lowerText.includes('keep it a secret') || lowerText.includes('our little secret')) {
    indicators.push({ pattern: 'secret-keeping', description: 'Offender is attempting to isolate the child and enforce secrecy.', severity: 'critical' });
    categories.add('grooming');
    categories.add('isolation');
  }

  if (lowerText.includes('send a picture') || lowerText.includes('send pic') || lowerText.includes('are you alone')) {
    indicators.push({ pattern: 'inappropriate requests', description: 'Asking for pictures or probing for isolation.', severity: 'high' });
    categories.add('grooming');
  }

  // Use Gemini for nuanced classification
  try {
    const prompt = CHILD_SAFETY_PROMPT
      .replace('${AGE}', childAge)
      .replace('${CONTENT}', text);

    const { text: aiResponse } = await generateText({
      model: google('gemini-1.5-flash'),
      system: 'You are a child safety expert.',
      prompt: prompt,
      maxOutputTokens: 1024,
      temperature: 0.1,
    });

    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Merge heuristics with AI result
      parsed.indicators = [...indicators, ...(parsed.indicators || [])];
      parsed.categories = Array.from(new Set([...Array.from(categories), ...(parsed.categories || [])]));
      
      if (indicators.length > 0 && parsed.riskLevel === 'SAFE') {
         parsed.riskLevel = 'HIGH';
         parsed.verdict = 'Warning — suspicious patterns detected by heuristics.';
         parsed.parentAlert = true;
      }
      
      return parsed as ChildSafetyResult;
    }
  } catch (error) {
    console.error('Child safety AI analysis failed:', error);
  }

  // Fallback if AI fails but heuristics fired
  if (indicators.length > 0) {
    return {
      verdict: 'Warning — suspicious behavior patterns detected.',
      riskLevel: 'HIGH',
      categories: Array.from(categories),
      indicators,
      recommendations: ['Stop talking to this person immediately.', 'Show this message to a trusted adult.'],
      parentAlert: true,
    };
  }

  return {
    verdict: 'No immediate threats detected, but always stay safe online.',
    riskLevel: 'SAFE',
    categories: [],
    indicators: [],
    recommendations: ['Remember to never share personal information online.'],
    parentAlert: false,
  };
}
