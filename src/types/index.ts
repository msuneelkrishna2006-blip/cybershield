// ── CyberShield 2.0 Type Definitions ──────────────────────────────────────────

export type UserRole = 'guardian' | 'adult' | 'child' | 'elderly'
export type AgeTier = 'child' | 'tween' | 'teen'
export type ScanType = 'sms' | 'whatsapp' | 'email' | 'link' | 'qr' | 'upi' | 'screenshot'
export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical'
export type ThreatCategory = 'phishing' | 'scam' | 'malware' | 'fraud' | 'grooming' | 'harassment' | 'investment_scam' | 'job_scam' | 'fake_shopping' | 'identity_theft' | 'digital_arrest' | 'otp_fraud' | 'kyc_fraud' | 'loan_app' | 'deepfake' | 'task_scam' | 'safe'
export type AlertCategory = 'scam' | 'child_safety' | 'family' | 'women_safety' | 'emergency_sos' | 'system'
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'
export type Language = 'auto' | 'en' | 'hi' | 'te' | 'ta' | 'kn' | 'ml' | 'mr' | 'bn' | 'gu' | 'pa' | 'ur'

export interface User {
  id: string
  name: string
  email: string
  phone?: string
  role: UserRole
  avatar?: string
  familyId?: string
  safetyScore: number
  scansToday: number
  totalScans: number
  createdAt: string
}

export interface Family {
  id: string
  name: string
  ownerId: string
  createdAt: string
}

export interface FamilyMember {
  id: string
  userId: string
  familyId: string
  role: UserRole
  relation: string
  ageTier?: AgeTier
  user?: User
  riskScore: number
  createdAt: string
}

export interface EmergencyContact {
  id: string
  memberId: string
  name: string
  phone: string
  relation: string
  isPrimary: boolean
}

export interface AgentResult {
  agentName: string
  agentIcon: string
  confidence: number
  riskScore: number
  category: ThreatCategory
  summary: string
  explanation: string
  indicators: string[]
  recommendations: string[]
  processingTime: number
}

export interface ScanRecord {
  id: string
  memberId: string
  type: ScanType
  input: string
  riskScore: number
  riskLevel: RiskLevel
  category: ThreatCategory
  summary: string
  agentResults: AgentResult[]
  recommendations: string[]
  createdAt: string
}

export interface Alert {
  id: string
  memberId: string
  familyId: string
  type: AlertCategory
  severity: AlertSeverity
  title: string
  description: string
  read: boolean
  createdAt: string
  actionUrl?: string
}

export interface ChildProfile {
  id: string
  memberId: string
  ageTier: AgeTier
  screenTimeRules: {
    dailyLimitMinutes: number
    downtimeStart?: string
    downtimeEnd?: string
    blockedCategories: string[]
  }
  safetyScore: number
  alerts: number
  lastActive: string
  riskLevel: RiskLevel
}

export interface ChildSafetyAlert {
  id: string
  childProfileId: string
  patternType: 'grooming-language' | 'personal-info-request' | 'unknown-contact'
  severitySummary: string
  timestamp: string
  parentNotified: boolean
}

export interface LocationShare {
  id: string
  memberId: string
  lat: number
  lng: number
  sharedWith: string[]
  isActive: boolean
  journeyDestination?: string
  expectedArrival?: string
  expiresAt: string
  createdAt: string
}

export interface IncidentReport {
  id: string
  memberId: string
  description: string
  lat?: number
  lng?: number
  evidence: string[]
  createdAt: string
  exportedAt?: string
}

export interface ChatMessage {
  id: string
  memberId?: string
  role: 'user' | 'assistant'
  content: string
  language: Language
  createdAt: Date
  typing?: boolean
}

export interface AnalyticsData {
  date: string
  scans: number
  threats: number
  safe: number
}

export interface AgentStatus {
  name: string
  icon: string
  status: 'active' | 'processing' | 'idle'
  processedToday: number
  accuracy: number
}

export interface WeeklyReport {
  week: string
  totalScans: number
  threatsDetected: number
  safetyScore: number
  topThreats: { category: ThreatCategory; count: number }[]
}

export interface NavItem {
  icon: string
  label: string
  key: string
  href: string
  badge?: string
  color?: string
}
