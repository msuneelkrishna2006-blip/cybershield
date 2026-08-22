import { startSession, respondToCheckIn, cancelSession, extendSession, escalateSession } from '../src/lib/services/escalation'
import { prisma } from '../src/lib/prisma'
import { notificationService } from '../src/lib/services/notification'

// Mock prisma and notificationService
jest.mock('../src/lib/prisma', () => ({
  prisma: {
    safetySession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    guardianAlert: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    guardianRelationship: {
      findMany: jest.fn(),
    },
    alertRecipient: {
      create: jest.fn(),
    },
    checkIn: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}))

jest.mock('../src/lib/services/notification', () => ({
  notificationService: {
    notifyGuardians: jest.fn().mockResolvedValue(undefined),
    promptCheckIn: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('../src/lib/services/risk-analyzer', () => ({
  riskAnalyzer: {
    analyzeSessionRisk: jest.fn().mockResolvedValue({
      riskLevel: 'low',
      riskContext: 'Mock test context',
      adjustedInterval: 15,
    }),
  },
}))

describe('Safety Session Escalation State Machine', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should start safety session with correct default intervals', async () => {
    const mockSession = {
      id: 'session_mock_id',
      userId: 'user_1',
      activityLabel: 'Night Walk',
      expectedDuration: 30,
      checkInInterval: 15,
      graceWindow: 5,
      status: 'ACTIVE',
      expiresAt: new Date(),
      nextCheckInAt: new Date(),
    }
    
    ;(prisma.safetySession.create as jest.Mock).mockResolvedValue(mockSession)

    const result = await startSession({
      userId: 'user_1',
      activityLabel: 'Night Walk',
      expectedDuration: 30,
      checkInInterval: 15,
      graceWindow: 5,
    })

    expect(prisma.safetySession.create).toHaveBeenCalled()
    expect(result.sessionId).toBe('session_mock_id')
  })

  test('should respond to check-in and reschedule next check-in time', async () => {
    const mockSession = {
      id: 'session_1',
      userId: 'user_1',
      status: 'ACTIVE',
      checkInInterval: 15,
      graceWindow: 5,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    }
    
    ;(prisma.safetySession.findUnique as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.safetySession.update as jest.Mock).mockResolvedValue({
      ...mockSession,
      status: 'ACTIVE',
    })
    ;(prisma.checkIn.findUnique as jest.Mock).mockResolvedValue({
      id: 'checkin_1',
      sessionId: 'session_1',
      respondedAt: null,
      graceEndsAt: new Date(Date.now() + 5 * 60 * 1000),
    })
    ;(prisma.checkIn.update as jest.Mock).mockResolvedValue({
      id: 'checkin_1',
      respondedAt: new Date(),
    })

    const result = await respondToCheckIn('session_1', 'checkin_1', 'SAFE')

    expect(result.success).toBe(true)
    expect(result.nextCheckInAt).toBeDefined()
    expect(prisma.safetySession.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'session_1' },
      data: expect.objectContaining({ status: 'ACTIVE' }),
    }))
  })

  test('should escalate safety session when check-in is missed', async () => {
    const mockSession = {
      id: 'session_1',
      userId: 'user_1',
      activityLabel: 'Night Walk',
      status: 'ACTIVE',
      locationPings: [{ lat: 12.9, lng: 77.6 }],
    }
    
    ;(prisma.safetySession.findUnique as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.guardianAlert.create as jest.Mock).mockResolvedValue({ id: 'alert_1', title: 'Missed check-in' })
    ;(prisma.guardianRelationship.findMany as jest.Mock).mockResolvedValue([
      { guardianId: 'guardian_1', guardian: { id: 'guardian_1', name: 'Priya' } }
    ])

    const result = await escalateSession('session_1', 'CHECK_IN_MISSED')

    expect(result.success).toBe(true)
    expect(result.newStatus).toBe('ESCALATED')
    expect(prisma.guardianAlert.create).toHaveBeenCalled()
    expect(notificationService.notifyGuardians).toHaveBeenCalled()
  })

  test('should cancel session successfully if owner cancels', async () => {
    const mockSession = {
      id: 'session_1',
      userId: 'user_1',
      status: 'ACTIVE',
    }

    ;(prisma.safetySession.findUnique as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.safetySession.update as jest.Mock).mockResolvedValue({
      ...mockSession,
      status: 'CANCELLED',
    })

    const result = await cancelSession('session_1', 'user_1')

    expect(result.success).toBe(true)
    expect(prisma.safetySession.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'session_1' },
      data: expect.objectContaining({ status: 'CANCELLED' }),
    }))
  })
})
