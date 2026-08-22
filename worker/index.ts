import { prisma } from '../src/lib/prisma'
import { escalateSession } from '../src/lib/services/escalation'
import { notificationService } from '../src/lib/services/notification'

async function runWorkerCheck() {
  const now = new Date()

  try {
    // ═══════════════════════════════════════════════════════════════
    // 1. PROCESS ACTIVE SESSIONS NEEDING NEW CHECK-INS
    // ═══════════════════════════════════════════════════════════════
    const sessionsNeedingCheckIn = await prisma.safetySession.findMany({
      where: {
        status: 'ACTIVE',
        nextCheckInAt: { lte: now },
      },
    })

    for (const session of sessionsNeedingCheckIn) {
      // Check if there is already a pending check-in for this session
      const existingPendingCheckIn = await prisma.checkIn.findFirst({
        where: {
          sessionId: session.id,
          respondedAt: null,
        },
      })

      if (!existingPendingCheckIn) {
        const graceEndsAt = new Date(now.getTime() + session.graceWindow * 60 * 1000)

        // Create check-in prompt
        const checkIn = await prisma.checkIn.create({
          data: {
            sessionId: session.id,
            promptedAt: now,
            graceEndsAt,
          },
        })

        console.log(`[WORKER] Created check-in prompt ${checkIn.id} for session ${session.id}. Grace ends at ${graceEndsAt.toLocaleTimeString()}`)

        // Trigger notification check-in prompt (best-effort)
        try {
          await notificationService.promptCheckIn(session.id, session.userId, graceEndsAt)
        } catch (e) {
          console.error('[WORKER] Failed to send check-in prompt notification:', e)
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. PROCESS PENDING CHECK-INS THAT MISSED THE GRACE WINDOW
    // ═══════════════════════════════════════════════════════════════
    const missedCheckIns = await prisma.checkIn.findMany({
      where: {
        respondedAt: null,
        graceEndsAt: { lte: now },
        session: {
          status: { in: ['ACTIVE', 'EXPIRED_UNRESPONDED'] },
        },
      },
      include: {
        session: true,
      },
    })

    for (const checkIn of missedCheckIns) {
      console.log(`[WORKER] Missed check-in detected for session ${checkIn.sessionId}. Escalating...`)
      
      // Update check-in response as missed by setting response to SOS or mapping it
      // Wait, we can mark respondedAt to now to close it from checking again
      await prisma.checkIn.update({
        where: { id: checkIn.id },
        data: { respondedAt: now },
      })

      // Escalate session
      await escalateSession(checkIn.sessionId, 'CHECK_IN_MISSED')
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. PROCESS SESSIONS THAT EXPIRED WITHOUT RESOLUTION
    // ═══════════════════════════════════════════════════════════════
    const expiredSessions = await prisma.safetySession.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lte: now },
      },
    })

    for (const session of expiredSessions) {
      console.log(`[WORKER] Session ${session.id} expired without resolution. Escalating...`)
      await escalateSession(session.id, 'SESSION_EXPIRED')
    }

  } catch (error) {
    console.error('[WORKER ERROR]:', error)
  }
}

async function start() {
  console.log('👷 Background Escalation Worker started...')
  console.log('   Polling sessions every 5 seconds...')

  setInterval(async () => {
    await runWorkerCheck()
  }, 5000)
}

start()
