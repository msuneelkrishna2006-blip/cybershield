import { riskAnalyzer } from '../src/lib/services/risk-analyzer'

describe('AI / Rule-Based Risk Analyzer Service', () => {
  let originalGetHours: () => number

  beforeAll(() => {
    originalGetHours = Date.prototype.getHours
  })

  afterEach(() => {
    Date.prototype.getHours = originalGetHours
  })

  test('should classify normal daytime walk notes as low risk', async () => {
    // Force fallback mode by removing API key from process.env if present
    const originalKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY

    // Mock Date.prototype.getHours to return a daytime hour
    Date.prototype.getHours = () => 12

    const result = await riskAnalyzer.analyzeSessionRisk(
      'Shopping at market',
      'Market square',
      'Daytime stroll to buy groceries'
    )

    expect(result.riskLevel).toBe('low')
    expect(result.adjustedInterval).toBe(15)

    // Restore original key
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalKey
  })

  test('should classify alone / night walking as high risk', async () => {
    const originalKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY

    const result = await riskAnalyzer.analyzeSessionRisk('Walking home', 'Apartment', 'walking alone in the dark night')

    expect(result.riskLevel).toBe('high')
    expect(result.adjustedInterval).toBe(5)

    process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalKey
  })

  test('should classify late night activities as high risk automatically', async () => {
    const originalKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY

    // Mock Date.prototype.getHours to return a late-night hour
    Date.prototype.getHours = () => 23

    const result = await riskAnalyzer.analyzeSessionRisk('Bus ride', 'Station', 'going home')

    expect(result.riskLevel).toBe('high')
    expect(result.adjustedInterval).toBe(5)

    process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalKey
  })
})
