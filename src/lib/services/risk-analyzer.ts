import { google } from '@ai-sdk/google'
import { generateText } from 'ai'

export interface RiskAnalysisResult {
  riskLevel: 'low' | 'medium' | 'high'
  riskContext: string
  adjustedInterval?: number // in minutes
}

export interface RiskAnalysisService {
  analyzeSessionRisk(
    activityLabel: string,
    destination?: string,
    notes?: string
  ): Promise<RiskAnalysisResult>
}

class GeminiRiskAnalysisService implements RiskAnalysisService {
  // ─── Rule-Based Fallback ────────────────────────────────────
  private runFallbackAnalysis(
    activityLabel: string,
    destination?: string,
    notes?: string
  ): RiskAnalysisResult {
    const textToScan = `${activityLabel} ${destination || ''} ${notes || ''}`.toLowerCase()
    
    // High Risk Indicators
    const highKeywords = ['alone', 'night', 'cab', 'taxi', 'deserted', 'empty', 'stranger', 'dark', 'meet up', 'lonesome', 'unsafe']
    // Medium Risk Indicators
    const mediumKeywords = ['walk', 'travel', 'bus', 'train', 'metro', 'meeting', 'outside', 'date']

    let hasHigh = highKeywords.some((kw) => textToScan.includes(kw))
    let hasMedium = mediumKeywords.some((kw) => textToScan.includes(kw))

    // Check time of day (late night = automatically elevated risk)
    const currentHour = new Date().getHours()
    if (currentHour >= 22 || currentHour <= 5) {
      hasHigh = true
    }

    if (hasHigh) {
      return {
        riskLevel: 'high',
        riskContext: 'Rule-based analysis flagged high-risk environment (late night, transit, or walking alone).',
        adjustedInterval: 5, // 5 min check-in for high risk
      }
    }

    if (hasMedium) {
      return {
        riskLevel: 'medium',
        riskContext: 'Rule-based analysis flagged medium-risk environment (public transit or outdoor activity).',
        adjustedInterval: 10, // 10 min check-in for medium risk
      }
    }

    return {
      riskLevel: 'low',
      riskContext: 'Rule-based analysis: activity appears normal. Standard monitoring intervals applied.',
      adjustedInterval: 15, // 15 min check-in for low risk
    }
  }

  // ─── Main Analyze Call ──────────────────────────────────────
  async analyzeSessionRisk(
    activityLabel: string,
    destination?: string,
    notes?: string
  ): Promise<RiskAnalysisResult> {
    // If Gemini key is missing, immediately fallback gracefully
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.warn('[RISK ANALYZER] Gemini API key not found. Falling back to rule-based analysis.')
      return this.runFallbackAnalysis(activityLabel, destination, notes)
    }

    try {
      const prompt = `
        You are a CyberShield personal safety AI risk assessment agent.
        Analyze the following safety monitoring session details:
        - Activity: "${activityLabel}"
        - Destination: "${destination || 'Not specified'}"
        - Additional Notes: "${notes || 'None'}"

        Determine the risk level (low, medium, or high), explain the reasoning in a single short sentence, and suggest a check-in interval in minutes (between 5 and 30).
        High-risk activities (e.g. late-night rides, meeting strangers, empty areas) should get a 5-minute interval.
        Medium-risk (e.g. public transport, daytime meetings) should get 10 minutes.
        Low-risk should get 15-20 minutes.

        Return ONLY a raw JSON object matching this schema (do not wrap in markdown blocks or code formatting):
        {
          "riskLevel": "low" | "medium" | "high",
          "riskContext": "short reasoning explanation",
          "adjustedInterval": 5 | 10 | 15 | 20 | 30
        }
      `

      const { text } = await generateText({
        model: google('gemini-flash-latest'),
        prompt,
        temperature: 0.1,
      })

      // Clean the response from potential code block wraps
      const cleanJsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(cleanJsonStr)

      return {
        riskLevel: parsed.riskLevel || 'low',
        riskContext: parsed.riskContext || 'AI evaluated risk successfully.',
        adjustedInterval: parsed.adjustedInterval ? parseInt(parsed.adjustedInterval) : 15,
      }
    } catch (err) {
      console.error('[RISK ANALYZER] Gemini API call failed. Degrading gracefully to rules fallback:', err)
      return this.runFallbackAnalysis(activityLabel, destination, notes)
    }
  }
}

export const riskAnalyzer = new GeminiRiskAnalysisService()
