import { ScanRecord, Alert } from '@/types'

// Risk Scoring Bands
// 0 - 30: Safe / Low
// 31 - 60: Medium
// 61 - 85: High
// 86 - 100: Critical

export function calculateMemberRiskScore(scans: ScanRecord[], alerts: Alert[]): number {
  if (!scans.length && !alerts.length) return 0

  let totalScore = 0
  const now = new Date().getTime()
  
  // Base score from Alerts (unresolved alerts heavily penalize score)
  const unresolvedAlerts = alerts.filter(a => !a.read)
  for (const alert of unresolvedAlerts) {
    switch (alert.severity) {
      case 'critical': totalScore += 40; break;
      case 'high': totalScore += 25; break;
      case 'medium': totalScore += 10; break;
      case 'low': totalScore += 5; break;
    }
  }

  // Score from Scans (weighted by recency)
  let scanScore = 0
  for (const scan of scans) {
    if (scan.riskLevel === 'safe' || scan.riskLevel === 'low') continue

    const scanTime = new Date(scan.createdAt).getTime()
    const daysOld = Math.max(0, (now - scanTime) / (1000 * 60 * 60 * 24))
    
    // Decay factor: recent = 1.0, 7 days old = ~0.3, 30 days old = ~0.0
    const decay = Math.max(0, 1 - (daysOld / 30))
    
    let baseScanPenalty = 0
    switch (scan.riskLevel) {
      case 'critical': baseScanPenalty = 30; break;
      case 'high': baseScanPenalty = 20; break;
      case 'medium': baseScanPenalty = 10; break;
    }

    scanScore += baseScanPenalty * decay
  }

  totalScore += scanScore

  return Math.min(100, Math.round(totalScore))
}

export function calculateFamilyRiskScore(memberScores: number[]): number {
  if (!memberScores.length) return 0
  
  // The family score isn't just an average. One compromised member puts the family at risk.
  // We use a weighted average leaning towards the maximum score.
  const maxScore = Math.max(...memberScores)
  const avgScore = memberScores.reduce((a, b) => a + b, 0) / memberScores.length
  
  // 70% weight to the highest risk member, 30% to the average
  return Math.round((maxScore * 0.7) + (avgScore * 0.3))
}

export function getRiskLevelFromScore(score: number): 'safe' | 'low' | 'medium' | 'high' | 'critical' {
  if (score <= 15) return 'safe'
  if (score <= 30) return 'low'
  if (score <= 60) return 'medium'
  if (score <= 85) return 'high'
  return 'critical'
}
