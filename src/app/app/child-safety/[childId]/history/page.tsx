'use client'

import React, { use, useState, useEffect } from 'react'
import { Card, Badge, RiskScore } from '@/components/ui'
import { formatDateTime } from '@/lib/utils'
import { 
  ArrowLeft, Clock, ShieldAlert, Monitor, ShieldCheck, 
  AlertTriangle, Filter, Lock, Eye
} from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ childId: string }>
}

interface ChildProfile {
  id: string
  safetyScore: number
  alerts: number
  ageTier: string
  screenTimeRules: string | null
  member?: {
    id: string
    role: string
    user?: { name: string } | null
  }
}

interface ChildAlert {
  id: string
  patternType: string
  severitySummary: string
  timestamp: string
  parentNotified: boolean
}

export default function ChildHistoryPage({ params }: PageProps) {
  const { childId } = use(params)
  const [profile, setProfile] = useState<ChildProfile | null>(null)
  const [alerts, setAlerts] = useState<ChildAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        // Load child profiles
        const profileRes = await fetch('/api/v1/child-safety')
        if (profileRes.ok) {
          const profileData = await profileRes.json()
          if (profileData.success) {
            const found = profileData.data.childProfiles.find(
              (cp: ChildProfile) => cp.id === childId || cp.member?.id === childId
            )
            if (found) setProfile(found)
          }
        }

        // Load alerts for this child
        const alertsRes = await fetch(`/api/v1/child-safety/${childId}/alerts?limit=20`)
        if (alertsRes.ok) {
          const alertsData = await alertsRes.json()
          if (alertsData.success) {
            setAlerts(alertsData.data.alerts || [])
          }
        }
      } catch (e) {
        console.error('Failed to load child history:', e)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [childId])

  const childName = profile?.member?.user?.name || profile?.member?.role || 'Child'
  const screenTimeLimit = profile?.screenTimeRules 
    ? (() => { try { return JSON.parse(profile.screenTimeRules).dailyLimitMinutes || 120 } catch { return 120 } })()
    : 120

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto animate-pulse">
        <div className="h-10 bg-slate-800 rounded-lg w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-800 rounded-xl" />)}
        </div>
        <div className="h-64 bg-slate-800 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-300">
      
      {/* Decorative top gradient */}
      <div className="tricolor-accent-bar" />

      {/* Header with back navigation */}
      <div className="flex items-center gap-4">
        <Link 
          href="/app/child-safety"
          className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 rounded-xl text-slate-400 hover:text-white transition-all"
          aria-label="Back to Child Safety"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">{childName}&apos;s Activity Log</h1>
          <p className="text-sm text-slate-400 mt-1">Safety alerts and monitoring history.</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="flex items-center gap-4">
          <RiskScore score={profile ? 100 - profile.safetyScore : 0} size={70} />
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Safety Score</p>
            <p className="text-xl font-black text-white">{profile?.safetyScore || 0}/100</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Daily Screen Limit</p>
            <p className="text-xl font-black text-white">{Math.round(screenTimeLimit / 60)} Hours</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 bg-red-500/10 text-red-400 rounded-xl">
            <ShieldAlert size={24} />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Unresolved Flags</p>
            <p className="text-xl font-black text-white">{profile?.alerts || 0}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl">
            <Monitor size={24} />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Monitoring Status</p>
            <p className="text-sm font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Active
            </p>
          </div>
        </Card>
      </div>

      {/* Alerts Section */}
      <Card className="space-y-4">
        <div>
          <h3 className="font-extrabold text-white text-lg flex items-center gap-2">
            <ShieldAlert className="text-purple-400 w-5 h-5" /> Safety Alerts
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">AI-generated safety alerts without exposing raw content.</p>
        </div>

        <div className="space-y-3">
          {alerts.length > 0 ? (
            alerts.map((alert) => (
              <div 
                key={alert.id}
                className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="purple">
                    {alert.patternType.replace(/-/g, ' ').toUpperCase()}
                  </Badge>
                  <span className="text-[10px] text-slate-500">{formatDateTime(alert.timestamp)}</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed font-semibold">
                  {alert.severitySummary}
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Lock size={10} /> Privacy-Encrypted Summary
                  </span>
                  {alert.parentNotified && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
                      <ShieldCheck size={12} /> Parent Notified
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-slate-500">
              <ShieldCheck className="mx-auto text-emerald-400 w-8 h-8 mb-2" />
              <p className="text-sm font-semibold">No safety alerts recorded</p>
              <p className="text-xs mt-1">Alerts will appear here when the system detects risky patterns.</p>
            </div>
          )}
        </div>
      </Card>

    </div>
  )
}
