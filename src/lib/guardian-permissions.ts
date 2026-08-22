import { prisma } from '@/lib/prisma'

/**
 * Permission checks for the Guardian safety system.
 * 
 * Rules:
 * - A Guardian can only see a user's session if:
 *   1. They have an ACCEPTED guardian relationship with that user.
 *   2. The session status is ACTIVE, EXPIRED_UNRESPONDED, or ESCALATED.
 *   3. OR, if the session is RESOLVED, it is the SINGLE most recent resolved session.
 * - A Guardian can NEVER see a full location history (only active session location pings).
 */
export async function canGuardianAccessSession(
  guardianId: string,
  userId: string,
  sessionId: string
): Promise<boolean> {
  // Check if relationship is ACCEPTED
  const relationship = await prisma.guardianRelationship.findFirst({
    where: {
      guardianId,
      userId,
      status: 'ACCEPTED',
    },
  })

  if (!relationship) return false

  // Fetch the session
  const session = await prisma.safetySession.findUnique({
    where: { id: sessionId },
  })

  if (!session || session.userId !== userId) return false

  // If session is active/expired/escalated, access is allowed
  if (
    session.status === 'ACTIVE' ||
    session.status === 'EXPIRED_UNRESPONDED' ||
    session.status === 'ESCALATED'
  ) {
    return true
  }

  // If session is resolved, check if it's the most recent resolved one
  if (session.status === 'RESOLVED') {
    const mostRecentResolved = await prisma.safetySession.findFirst({
      where: {
        userId,
        status: 'RESOLVED',
      },
      orderBy: {
        resolvedAt: 'desc',
      },
    })
    return mostRecentResolved?.id === sessionId
  }

  return false
}

/**
 * Checks if a guardian can view a user's location pings.
 * 
 * Rule: Location pings can ONLY be viewed if the session is currently active or escalated.
 * Once resolved or cancelled, pings are purged or inaccessible.
 */
export async function canGuardianAccessLocation(
  guardianId: string,
  userId: string,
  sessionId: string
): Promise<boolean> {
  // Check if relationship is ACCEPTED
  const relationship = await prisma.guardianRelationship.findFirst({
    where: {
      guardianId,
      userId,
      status: 'ACCEPTED',
    },
  })

  if (!relationship) return false

  // Fetch the session
  const session = await prisma.safetySession.findUnique({
    where: { id: sessionId },
  })

  if (!session || session.userId !== userId) return false

  // Location history is only accessible during active/escalated states
  return (
    session.status === 'ACTIVE' ||
    session.status === 'EXPIRED_UNRESPONDED' ||
    session.status === 'ESCALATED'
  )
}
