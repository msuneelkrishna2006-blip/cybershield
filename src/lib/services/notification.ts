import type { User, GuardianAlert } from '@prisma/client'

export interface NotificationService {
  notifyGuardians(alert: GuardianAlert, guardians: User[]): Promise<void>
  notifyAlertUpdate(alertId: string, guardianId: string, action: string, guardians: User[]): Promise<void>
  promptCheckIn(sessionId: string, userId: string, graceEndsAt: Date): Promise<void>
}

class MockNotificationService implements NotificationService {
  async notifyGuardians(alert: GuardianAlert, guardians: User[]): Promise<void> {
    console.log(`\n🔔 [NOTIFICATION SERVICE] SENDING ALERT TO GUARDIANS:`)
    console.log(`   Alert ID: ${alert.id}`)
    console.log(`   Type: ${alert.type}`)
    console.log(`   Title: ${alert.title}`)
    console.log(`   Description: ${alert.description}`)
    console.log(`   Location: ${alert.lat ? `${alert.lat}, ${alert.lng}` : 'None'}`)
    console.log(`   Recipients: ${guardians.map((g) => `${g.name} (${g.phone || g.email})`).join(', ')}`)
    
    // Simulate SMS dispatch to Twilio
    if (process.env.TWILIO_ACCOUNT_SID) {
      console.log(`   [Twilio Verify API] Dispatching SMS warnings...`)
    }
    console.log(`   ✓ Notifications dispatched successfully.\n`)
  }

  async notifyAlertUpdate(alertId: string, guardianId: string, action: string, guardians: User[]): Promise<void> {
    console.log(`\n🔔 [NOTIFICATION SERVICE] ALERT UPDATE:`)
    console.log(`   Alert ID: ${alertId}`)
    console.log(`   Guardian ID: ${guardianId} performed action: "${action}"`)
    console.log(`   Recipients notified: ${guardians.map((g) => g.name).join(', ')}\n`)
  }

  async promptCheckIn(sessionId: string, userId: string, graceEndsAt: Date): Promise<void> {
    console.log(`\n🔔 [NOTIFICATION SERVICE] CHECK-IN REQUIRED:`)
    console.log(`   Session ID: ${sessionId}`)
    console.log(`   User ID: ${userId}`)
    console.log(`   Action: Prompting in-app "Are you okay?" check-in.`)
    console.log(`   Grace Period: Must respond by ${graceEndsAt.toLocaleTimeString()} to avoid escalation.\n`)
  }
}

export const notificationService = new MockNotificationService()
