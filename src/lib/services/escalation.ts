/**
 * Escalation State Machine
 *
 * Manages the lifecycle of safety sessions and their transitions:
 *
 *   ACTIVE ──→ CHECKED_IN_SAFE ──→ ACTIVE (re-schedule next check-in)
 *     │
 *     ├──→ EXPIRED_UNRESPONDED ──→ ESCALATED ──→ RESOLVED
 *     │                                      ├──→ FALSE_ALARM
 *     ├──→ CANCELLED
 *     │
 *     └──→ (SOS) ──→ ESCALATED ──→ RESOLVED
 *
 * Core invariant: base timeout escalation ALWAYS fires even if AI or notifications fail.
 */

import { prisma } from '@/lib/prisma'
import { notificationService } from './notification'
import { riskAnalyzer } from './risk-analyzer'

// ─── Types ────────────────────────────────────────────────────

export type SessionStatus = 'ACTIVE' | 'CHECKED_IN_SAFE' | 'EXPIRED_UNRESPONDED' | 'ESCALATED' | 'RESOLVED' | 'CANCELLED'
export type GuardianAlertType = 'CHECK_IN_MISSED' | 'SOS' | 'SESSION_EXPIRED'
export type GuardianAlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_ALARM'

export interface EscalationResult {
  success: boolean
  newStatus?: SessionStatus
  alertId?: string
  error?: string
}

export interface CheckInResult {
  success: boolean
  nextCheckInAt?: Date
  error?: string
}

// ─── Valid State Transitions ──────────────────────────────────

const VALID_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  ACTIVE:               ['CHECKED_IN_SAFE', 'EXPIRED_UNRESPONDED', 'ESCALATED', 'CANCELLED'],
  CHECKED_IN_SAFE:      ['ACTIVE'], // immediately transitions back to ACTIVE with next check-in scheduled
  EXPIRED_UNRESPONDED:  ['ESCALATED', 'RESOLVED'], // user responds late → resolve; or escalate
  ESCALATED:            ['RESOLVED'],
  RESOLVED:             [], // terminal
  CANCELLED:            [], // terminal
}

function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

// ─── Session Lifecycle ────────────────────────────────────────

/**
 * Start a new safety session. Calculates expiry and first check-in time.
 */
export async function startSession(params: {
  userId: string
  activityLabel: string
  notes?: string
  destination?: string
  expectedDuration: number // minutes
  checkInInterval?: number // minutes, default 15
  graceWindow?: number // minutes, default 5
}): Promise<{ sessionId: string; expiresAt: Date; nextCheckInAt: Date }> {
  const grace = params.graceWindow ?? 5
  const now = new Date()
  const expiresAt = new Date(now.getTime() + params.expectedDuration * 60 * 1000)

  // Run AI / rule-based risk analysis
  let riskLevel = 'low'
  let riskContext = 'Rule-based analysis default'
  let adjustedInterval = 15

  try {
    const analysis = await riskAnalyzer.analyzeSessionRisk(
      params.activityLabel,
      params.destination,
      params.notes
    )
    riskLevel = analysis.riskLevel
    riskContext = analysis.riskContext
    adjustedInterval = analysis.adjustedInterval || 15
  } catch (err) {
    console.error('Failed to run AI risk analysis on session start:', err)
  }

  // Use explicitly requested interval, or fallback to AI adjusted interval
  const interval = params.checkInInterval ?? adjustedInterval
  const nextCheckInAt = new Date(now.getTime() + interval * 60 * 1000)

  const session = await prisma.safetySession.create({
    data: {
      userId: params.userId,
      activityLabel: params.activityLabel,
      notes: params.notes,
      destination: params.destination,
      expectedDuration: params.expectedDuration,
      checkInInterval: interval,
      graceWindow: grace,
      status: 'ACTIVE',
      expiresAt,
      nextCheckInAt,
      riskLevel,
      riskContext,
      adjustedInterval,
    },
  })

  return {
    sessionId: session.id,
    expiresAt: session.expiresAt,
    nextCheckInAt,
  }
}

/**
 * User responds to a check-in prompt.
 */
export async function respondToCheckIn(
  sessionId: string,
  checkInId: string,
  response: 'SAFE' | 'EXTEND' | 'SOS'
): Promise<CheckInResult> {
  const session = await prisma.safetySession.findUnique({ where: { id: sessionId } })
  if (!session) return { success: false, error: 'Session not found' }
  if (session.status === 'CANCELLED' || session.status === 'RESOLVED') {
    return { success: false, error: `Session is already ${session.status.toLowerCase()}` }
  }

  const checkIn = await prisma.checkIn.findUnique({ where: { id: checkInId } })
  if (!checkIn) return { success: false, error: 'Check-in not found' }
  if (checkIn.respondedAt) return { success: false, error: 'Check-in already responded to' }

  // Record the response
  await prisma.checkIn.update({
    where: { id: checkInId },
    data: { response, respondedAt: new Date() },
  })

  if (response === 'SOS') {
    // Trigger SOS escalation
    await escalateSession(sessionId, 'SOS')
    return { success: true }
  }

  if (response === 'EXTEND') {
    // Extend session by its original duration
    const newExpiry = new Date(session.expiresAt.getTime() + session.expectedDuration * 60 * 1000)
    const interval = session.adjustedInterval ?? session.checkInInterval
    const nextCheckInAt = new Date(Date.now() + interval * 60 * 1000)

    await prisma.safetySession.update({
      where: { id: sessionId },
      data: {
        status: 'ACTIVE',
        expiresAt: newExpiry,
        nextCheckInAt,
      },
    })
    return { success: true, nextCheckInAt }
  }

  // SAFE — schedule next check-in
  const interval = session.adjustedInterval ?? session.checkInInterval
  const nextCheckInAt = new Date(Date.now() + interval * 60 * 1000)

  // Only if the next check-in is before session expiry
  if (nextCheckInAt < session.expiresAt) {
    await prisma.safetySession.update({
      where: { id: sessionId },
      data: { status: 'ACTIVE', nextCheckInAt },
    })
    return { success: true, nextCheckInAt }
  } else {
    // Session naturally completes — resolve
    await prisma.safetySession.update({
      where: { id: sessionId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        nextCheckInAt: null,
      },
    })
    return { success: true }
  }
}

/**
 * Cancel an active session.
 */
export async function cancelSession(sessionId: string, userId: string): Promise<EscalationResult> {
  const session = await prisma.safetySession.findUnique({ where: { id: sessionId } })
  if (!session) return { success: false, error: 'Session not found' }
  if (session.userId !== userId) return { success: false, error: 'Not your session' }
  if (!canTransition(session.status as SessionStatus, 'CANCELLED')) {
    return { success: false, error: `Cannot cancel session in ${session.status} state` }
  }

  await prisma.safetySession.update({
    where: { id: sessionId },
    data: { status: 'CANCELLED', cancelledAt: new Date(), nextCheckInAt: null },
  })

  return { success: true, newStatus: 'CANCELLED' }
}

/**
 * Extend an active session's duration.
 */
export async function extendSession(
  sessionId: string,
  userId: string,
  additionalMinutes: number
): Promise<EscalationResult> {
  const session = await prisma.safetySession.findUnique({ where: { id: sessionId } })
  if (!session) return { success: false, error: 'Session not found' }
  if (session.userId !== userId) return { success: false, error: 'Not your session' }
  if (session.status !== 'ACTIVE') {
    return { success: false, error: `Cannot extend session in ${session.status} state` }
  }

  const newExpiry = new Date(session.expiresAt.getTime() + additionalMinutes * 60 * 1000)
  await prisma.safetySession.update({
    where: { id: sessionId },
    data: { expiresAt: newExpiry },
  })

  return { success: true, newStatus: 'ACTIVE' }
}

/**
 * Escalate a session — create alert and notify all guardians.
 * This is the critical path — must succeed even if notifications fail.
 */
export async function escalateSession(
  sessionId: string,
  type: 'CHECK_IN_MISSED' | 'SESSION_EXPIRED' | 'SOS'
): Promise<EscalationResult> {
  const session = await prisma.safetySession.findUnique({
    where: { id: sessionId },
    include: { locationPings: { orderBy: { createdAt: 'desc' }, take: 1 } },
  })
  if (!session) return { success: false, error: 'Session not found' }

  // Get latest location
  const lastPing = session.locationPings[0]

  // Create the alert
  const alert = await prisma.guardianAlert.create({
    data: {
      userId: session.userId,
      sessionId,
      type: type as GuardianAlertType,
      status: 'ACTIVE',
      title: getAlertTitle(type, session.activityLabel),
      description: getAlertDescription(type, session),
      lat: lastPing?.lat,
      lng: lastPing?.lng,
    },
  })

  // Update session status
  const newStatus: SessionStatus = 'ESCALATED'
  await prisma.safetySession.update({
    where: { id: sessionId },
    data: { status: newStatus, nextCheckInAt: null },
  })

  // Get all accepted guardians for this user
  const guardianRelations = await prisma.guardianRelationship.findMany({
    where: { userId: session.userId, status: 'ACCEPTED' },
    include: { guardian: true },
  })

  // Create alert recipients
  for (const rel of guardianRelations) {
    await prisma.alertRecipient.create({
      data: {
        alertId: alert.id,
        guardianId: rel.guardianId,
        notifiedVia: JSON.stringify(['push']),
      },
    })
  }

  // Fire notifications (best-effort — alert already exists in DB)
  try {
    await notificationService.notifyGuardians(
      alert,
      guardianRelations.map((r) => r.guardian)
    )
  } catch (err) {
    console.error('[Escalation] Notification failed, but alert persisted:', err)
  }

  return { success: true, newStatus, alertId: alert.id }
}

/**
 * Create an SOS alert independent of any session.
 */
export async function triggerSOS(params: {
  userId: string
  lat?: number
  lng?: number
  message?: string
}): Promise<{ alertId: string; sosEventId: string }> {
  // Create SOS event
  const sosEvent = await prisma.sOSEvent.create({
    data: {
      userId: params.userId,
      lat: params.lat,
      lng: params.lng,
      message: params.message,
    },
  })

  // Create alert
  const alert = await prisma.guardianAlert.create({
    data: {
      userId: params.userId,
      sosEventId: sosEvent.id,
      type: 'SOS',
      status: 'ACTIVE',
      title: '🚨 Emergency SOS Activated',
      description: params.message || 'User triggered emergency SOS. Immediate attention required.',
      lat: params.lat,
      lng: params.lng,
    },
  })

  // Get all accepted guardians
  const guardianRelations = await prisma.guardianRelationship.findMany({
    where: { userId: params.userId, status: 'ACCEPTED' },
    include: { guardian: true },
  })

  // Create alert recipients
  for (const rel of guardianRelations) {
    await prisma.alertRecipient.create({
      data: {
        alertId: alert.id,
        guardianId: rel.guardianId,
        notifiedVia: JSON.stringify(['push', 'sms']),
      },
    })
  }

  // Fire notifications (best-effort)
  try {
    await notificationService.notifyGuardians(
      alert,
      guardianRelations.map((r) => r.guardian)
    )
  } catch (err) {
    console.error('[SOS] Notification failed, but alert persisted:', err)
  }

  // Also check if user has an active session — escalate it too
  const activeSession = await prisma.safetySession.findFirst({
    where: { userId: params.userId, status: 'ACTIVE' },
  })
  if (activeSession) {
    await prisma.safetySession.update({
      where: { id: activeSession.id },
      data: { status: 'ESCALATED', nextCheckInAt: null },
    })
  }

  return { alertId: alert.id, sosEventId: sosEvent.id }
}

/**
 * Guardian responds to an alert.
 */
export async function respondToAlert(
  alertId: string,
  guardianId: string,
  response: 'got_this' | 'escalate' | 'false_alarm'
): Promise<{ success: boolean; error?: string }> {
  const recipient = await prisma.alertRecipient.findUnique({
    where: { alertId_guardianId: { alertId, guardianId } },
  })
  if (!recipient) return { success: false, error: 'You are not a recipient of this alert' }

  // Record response
  await prisma.alertRecipient.update({
    where: { id: recipient.id },
    data: { response, respondedAt: new Date() },
  })

  const alert = await prisma.guardianAlert.findUnique({
    where: { id: alertId },
    include: { recipients: { include: { guardian: true } } },
  })
  if (!alert) return { success: false, error: 'Alert not found' }

  if (response === 'got_this') {
    await prisma.guardianAlert.update({
      where: { id: alertId },
      data: { status: 'ACKNOWLEDGED', resolvedBy: guardianId },
    })

    // Notify other guardians that someone has acknowledged
    try {
      const otherGuardians = alert.recipients
        .filter((r) => r.guardianId !== guardianId)
        .map((r) => r.guardian)
      if (otherGuardians.length > 0) {
        await notificationService.notifyAlertUpdate(alertId, guardianId, 'acknowledged', otherGuardians)
      }
    } catch (err) {
      console.error('[Alert] Update notification failed:', err)
    }
  } else if (response === 'false_alarm') {
    await prisma.guardianAlert.update({
      where: { id: alertId },
      data: {
        status: 'FALSE_ALARM',
        resolvedAt: new Date(),
        resolvedBy: guardianId,
      },
    })

    // Resolve associated session if any
    if (alert.sessionId) {
      await prisma.safetySession.update({
        where: { id: alert.sessionId },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      })
    }

    // Resolve SOS event if any
    if (alert.sosEventId) {
      await prisma.sOSEvent.update({
        where: { id: alert.sosEventId },
        data: { resolvedAt: new Date() },
      })
    }
  } else if (response === 'escalate') {
    // Re-notify all guardians
    try {
      const allGuardians = alert.recipients.map((r) => r.guardian)
      await notificationService.notifyGuardians(alert, allGuardians)
    } catch (err) {
      console.error('[Alert] Re-escalation notification failed:', err)
    }
  }

  return { success: true }
}

/**
 * Resolve an alert (used when guardian confirms user is safe).
 */
export async function resolveAlert(
  alertId: string,
  guardianId: string
): Promise<{ success: boolean; error?: string }> {
  const alert = await prisma.guardianAlert.findUnique({ where: { id: alertId } })
  if (!alert) return { success: false, error: 'Alert not found' }
  if (alert.status === 'RESOLVED' || alert.status === 'FALSE_ALARM') {
    return { success: false, error: 'Alert already resolved' }
  }

  await prisma.guardianAlert.update({
    where: { id: alertId },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedBy: guardianId,
    },
  })

  // Resolve associated session
  if (alert.sessionId) {
    await prisma.safetySession.update({
      where: { id: alert.sessionId },
      data: { status: 'RESOLVED', resolvedAt: new Date(), nextCheckInAt: null },
    })
  }

  // Resolve SOS event
  if (alert.sosEventId) {
    await prisma.sOSEvent.update({
      where: { id: alert.sosEventId },
      data: { resolvedAt: new Date() },
    })
  }

  // Purge location pings for the session (privacy: retention window)
  if (alert.sessionId) {
    await prisma.locationPing.deleteMany({
      where: { sessionId: alert.sessionId },
    })
  }

  return { success: true }
}

// ─── Helpers ──────────────────────────────────────────────────

function getAlertTitle(type: string, activityLabel: string): string {
  switch (type) {
    case 'CHECK_IN_MISSED':
      return `⚠️ Missed check-in during "${activityLabel}"`
    case 'SESSION_EXPIRED':
      return `⏰ Session "${activityLabel}" expired without check-in`
    case 'SOS':
      return `🚨 SOS triggered during "${activityLabel}"`
    default:
      return `⚠️ Safety alert for "${activityLabel}"`
  }
}

function getAlertDescription(
  type: string,
  session: { activityLabel: string; destination?: string | null; riskContext?: string | null }
): string {
  const dest = session.destination ? ` Destination: ${session.destination}.` : ''
  const risk = session.riskContext ? ` AI context: ${session.riskContext}` : ''

  switch (type) {
    case 'CHECK_IN_MISSED':
      return `User did not respond to a safety check-in during "${session.activityLabel}".${dest}${risk}`
    case 'SESSION_EXPIRED':
      return `Safety session "${session.activityLabel}" has expired and the user has not checked in.${dest}${risk}`
    case 'SOS':
      return `User triggered an emergency SOS during "${session.activityLabel}".${dest}${risk}`
    default:
      return `Safety concern during "${session.activityLabel}".${dest}`
  }
}
