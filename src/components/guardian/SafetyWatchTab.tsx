'use client'

import React, { useState, useEffect } from 'react'
import { Card, Badge, Spinner } from '@/components/ui'
import { 
  Shield, Timer, AlertOctagon, Plus, MapPin, 
  Trash2, Send, Check, ShieldAlert, Navigation, Clock 
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from '@/contexts/TranslationContext'

interface Guardian {
  id: string
  status: string
  label?: string
  guardian: {
    id: string
    name: string
    email: string
    phone: string
  }
}

interface SafetySession {
  id: string
  activityLabel: string
  destination?: string
  notes?: string
  expectedDuration: number
  checkInInterval: number
  status: string
  expiresAt: string
  nextCheckInAt?: string
  riskLevel?: string
  riskContext?: string
}

export default function SafetyWatchTab() {
  const { t } = useTranslation('aiGuardian')
  // Lists
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [activeSession, setActiveSession] = useState<SafetySession | null>(null)
  const [pendingCheckIn, setPendingCheckIn] = useState<any | null>(null)
  const [auditLogs, setAuditLogs] = useState<any[]>([])

  // Forms
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLabel, setInviteLabel] = useState('')
  const [activityLabel, setActivityLabel] = useState('')
  const [destination, setDestination] = useState('')
  const [notes, setNotes] = useState('')
  const [duration, setDuration] = useState('30')
  const [interval, setIntervalVal] = useState('auto') // auto = AI evaluates it

  // Loading states
  const [isLoadingGuardians, setIsLoadingGuardians] = useState(false)
  const [isStartingSession, setIsStartingSession] = useState(false)
  const [isSendingInvite, setIsSendingInvite] = useState(false)
  const [isLoadingSession, setIsLoadingSession] = useState(false)

  // Fetch relationships (guardians)
  const fetchGuardians = async () => {
    setIsLoadingGuardians(true)
    try {
      const res = await fetch('/api/guardian/relationships')
      if (res.ok) {
        const data = await res.json()
        setGuardians(data.guardians || [])
      }
    } catch (err) {
      console.error('Fetch guardians error:', err)
    } finally {
      setIsLoadingGuardians(false)
    }
  }

  // Fetch active session and pending check-ins
  const fetchActiveSession = async () => {
    setIsLoadingSession(true)
    try {
      const res = await fetch('/api/guardian/sessions')
      if (res.ok) {
        const data = await res.json()
        const active = data.sessions?.find((s: any) => 
          ['ACTIVE', 'EXPIRED_UNRESPONDED', 'ESCALATED'].includes(s.status)
        )
        if (active) {
          // Fetch full session details (with checkIns)
          const detailRes = await fetch(`/api/guardian/sessions/${active.id}`)
          if (detailRes.ok) {
            const detailData = await detailRes.json()
            setActiveSession(detailData.session)
            
            // Find if there is a pending check-in requiring response
            const pending = detailData.session?.checkIns?.find((c: any) => !c.respondedAt)
            setPendingCheckIn(pending || null)
          }
        } else {
          setActiveSession(null)
          setPendingCheckIn(null)
        }
      }
    } catch (err) {
      console.error('Fetch active session error:', err)
    } finally {
      setIsLoadingSession(false)
    }
  }

  // Fetch audit logs
  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/guardian/audit-logs')
      if (res.ok) {
        const data = await res.json()
        setAuditLogs(data.auditLogs || [])
      }
    } catch (err) {
      console.error('Fetch audit logs error:', err)
    }
  }

  useEffect(() => {
    fetchGuardians()
    fetchActiveSession()
    fetchAuditLogs()

    // Poll active session & check-ins every 5 seconds to match worker polling
    const pollId = setInterval(() => {
      fetchActiveSession()
      fetchAuditLogs()
    }, 5000)

    return () => clearInterval(pollId)
  }, [])

  // Send invitation
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return

    setIsSendingInvite(true)
    try {
      const res = await fetch('/api/guardian/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, label: inviteLabel }),
      })

      const data = await res.json()
      if (res.ok) {
        toast.success(t('invitationSent'))
        // If local dev, show the invitation link in toast for easy accept testing
        if (data.inviteToken) {
          console.log(`[DEV ONLY] Accept invite link: /api/guardian/invite/${data.inviteToken}/accept`)
        }
        setInviteEmail('')
        setInviteLabel('')
        fetchGuardians()
      } else {
        toast.error(data.error || t('failedToSendInvitation'))
      }
    } catch (err) {
      toast.error(t('connectionErrorSendingInvitation'))
    } finally {
      setIsSendingInvite(false)
    }
  }

  // Revoke relationship
  const handleRevoke = async (relId: string) => {
    if (!confirm(t('confirmRemoveGuardian', { defaultValue: 'Are you sure you want to remove this guardian?' }))) return

    try {
      const res = await fetch(`/api/guardian/relationships/${relId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success(t('guardianRemoved'))
        fetchGuardians()
      } else {
        toast.error(t('failedToRemoveGuardian'))
      }
    } catch (err) {
      toast.error(t('connectionError', { defaultValue: 'Connection error' }))
    }
  }
  // Start Safety Session
  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activityLabel) return

    setIsStartingSession(true)
    try {
      const res = await fetch('/api/guardian/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityLabel,
          destination,
          notes,
          expectedDuration: duration,
          checkInInterval: interval === 'auto' ? undefined : interval,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        toast.success(t('safetySessionStarted'))
        setActivityLabel('')
        setDestination('')
        setNotes('')
        fetchActiveSession()
      } else {
        toast.error(data.error || t('failedToStartSession'))
      }
    } catch (err) {
      toast.error(t('connectionErrorStartingSession'))
    } finally {
      setIsStartingSession(false)
    }
  }

  // End Session (Cancel)
  const handleEndSession = async () => {
    if (!activeSession) return
    if (!confirm(t('confirmEndSession', { defaultValue: 'Are you sure you want to end your safety session?' }))) return

    try {
      const res = await fetch(`/api/guardian/sessions/${activeSession.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      if (res.ok) {
        toast.success(t('sessionEndedSafe'))
        setActiveSession(null)
        setPendingCheckIn(null)
      } else {
        toast.error(t('failedToEndSession'))
      }
    } catch (err) {
      toast.error(t('connectionError', { defaultValue: 'Connection error' }))
    }
  }

  // Extend Session
  const handleExtendSession = async () => {
    if (!activeSession) return
    const mins = prompt(t('promptExtendMins', { defaultValue: 'Enter number of minutes to extend your safety session:' }), '15')
    if (!mins || isNaN(parseInt(mins)) || parseInt(mins) <= 0) return

    try {
      const res = await fetch(`/api/guardian/sessions/${activeSession.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extend', additionalMinutes: mins }),
      })
      if (res.ok) {
        toast.success(t('sessionExtendedByMins', { count: mins }))
        fetchActiveSession()
      } else {
        toast.error(t('failedToExtendSession'))
      }
    } catch (err) {
      toast.error(t('connectionError', { defaultValue: 'Connection error' }))
    }
  }

  // Submit Check-In Response
  const handleCheckInResponse = async (response: 'SAFE' | 'EXTEND' | 'SOS') => {
    if (!activeSession || !pendingCheckIn) return

    try {
      const res = await fetch(`/api/guardian/sessions/${activeSession.id}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkInId: pendingCheckIn.id,
          response,
        }),
      })

      if (res.ok) {
        if (response === 'SAFE') {
          toast.success(t('verifiedSafePromptLater'))
        } else if (response === 'EXTEND') {
          toast.success(t('sessionExtendedTimerUpdated'))
        } else {
          toast.error(t('sosActivatedGuardiansNotified'))
        }
        fetchActiveSession()
      } else {
        toast.error(t('failedToProcessResponse'))
      }
    } catch (err) {
      toast.error(t('connectionError', { defaultValue: 'Connection error' }))
    }
  }

  // Simulate GPS coordinates ping
  const handleSimulateGPS = async () => {
    if (!activeSession) return
    const lat = 12.9716 + (Math.random() - 0.5) * 0.01
    const lng = 77.5946 + (Math.random() - 0.5) * 0.01

    try {
      const res = await fetch(`/api/guardian/sessions/${activeSession.id}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      })
      if (res.ok) {
        toast.success(t('gpsSimulatorCoordinatesSent', { lat: lat.toFixed(4), lng: lng.toFixed(4) }))
        fetchActiveSession()
      } else {
        toast.error(t('failedToSendCoordinates'))
      }
    } catch (err) {
      toast.error(t('gpsSimulatorConnectionError'))
    }
  }

  // Trigger Standing SOS
  const handleTriggerSOS = async () => {
    if (!confirm(t('confirmActivateSos', { defaultValue: '🚨 ACTIVATE EMERGENCY SOS? This will immediately alert all your guardians and share your location.' }))) return

    try {
      const res = await fetch('/api/guardian/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: 12.9716,
          lng: 77.5946,
          message: 'User activated Emergency SOS panic button.',
        }),
      })

      if (res.ok) {
        toast.error(t('sosActivatedNotified'))
        fetchActiveSession()
      } else {
        toast.error(t('failedToActivateSos'))
      }
    } catch (err) {
      toast.error(t('connectionErrorActivatingSos', { defaultValue: 'Connection error activating SOS' }))
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* LEFT COLUMN: Controls, Invite Form, active monitoring */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* PENDING CHECK-IN BLOCK WARNING OUTLINE */}
        {pendingCheckIn && (
          <div className="border-2 border-red-500 bg-red-950/20 text-white rounded-2xl p-6 shadow-[0_0_25px_rgba(239,68,68,0.3)] animate-pulse flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/40 text-red-400 shrink-0">
                <AlertOctagon size={24} className="animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-black font-display text-white">{t('safetyCheckInRequired')}</h3>
                <p className="text-sm text-slate-300">{t('areYouOkayConfirm')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => handleCheckInResponse('SAFE')}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl text-sm transition-colors cursor-pointer"
              >
                {t('imSafe')}
              </button>
              <button
                onClick={() => handleCheckInResponse('EXTEND')}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-black font-bold rounded-xl text-sm transition-colors cursor-pointer"
              >
                {t('extend15m')}
              </button>
              <button
                onClick={() => handleCheckInResponse('SOS')}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-colors cursor-pointer shadow-lg"
              >
                {t('sos')}
              </button>
            </div>
          </div>
        )}

        {/* ACTIVE SESSION CARD */}
        {activeSession ? (
          <Card className="p-6 bg-gradient-to-b from-[#18233C]/95 to-[#0A0E1A]/95 border-red-500/20 relative overflow-hidden">
            {/* Pulsing red neon border if escalated */}
            {activeSession.status === 'ESCALATED' && (
              <div className="absolute inset-0 border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-pulse pointer-events-none rounded-xl" />
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={activeSession.status === 'ESCALATED' ? 'danger' : 'info'}>
                    {activeSession.status}
                  </Badge>
                  <Badge variant={activeSession.riskLevel === 'high' ? 'danger' : activeSession.riskLevel === 'medium' ? 'warning' : 'safe'}>
                    {t('common:riskLabel')}: {t(activeSession.riskLevel === 'high' ? 'common:highRisk' : activeSession.riskLevel === 'medium' ? 'common:mediumRisk' : 'common:lowRisk')}
                  </Badge>
                </div>
                <h3 className="text-xl font-bold text-white tracking-wide font-display">
                  {activeSession.activityLabel}
                </h3>
                {activeSession.destination && (
                  <p className="text-slate-400 text-xs flex items-center gap-1.5 mt-1">
                    <MapPin size={12} className="text-cyan-400" />
                    <span>{t('destinationOptional').replace(' (optional)', '')}: {activeSession.destination}</span>
                  </p>
                )}
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleSimulateGPS}
                  className="px-3.5 py-1.5 bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-900/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title={t('simulateGpsPing')}
                >
                  <Navigation size={12} className="animate-pulse" />
                  {t('gpsPing')}
                </button>
                <button
                  onClick={handleExtendSession}
                  className="px-3.5 py-1.5 bg-slate-800 border border-white/10 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Clock size={12} />
                  {t('extend')}
                </button>
                <button
                  onClick={handleEndSession}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-black font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  {t('imSafeEnd')}
                </button>
              </div>
            </div>

            {/* RISK LAYER INSIGHTS */}
            {activeSession.riskContext && (
              <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4 mb-4 text-xs">
                <h4 className="font-bold text-white mb-1 flex items-center gap-1 text-[11px] uppercase tracking-wider text-cyan-400">
                  <Shield size={12} />
                  {t('aiSafetyAssessment')}
                </h4>
                <p className="text-slate-300 leading-relaxed italic">&ldquo;{activeSession.riskContext}&rdquo;</p>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mt-4">
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <Timer className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-widest">{t('expectedDuration')}</span>
                <span className="text-sm font-bold text-white">{t('expectedDurationMins', { count: activeSession.expectedDuration })}</span>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <Clock className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-widest">{t('monitoringInterval')}</span>
                <span className="text-sm font-bold text-white">{t('monitoringIntervalMins', { count: activeSession.checkInInterval })}</span>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5 col-span-2">
                <ShieldAlert className="w-5 h-5 mx-auto text-red-500 mb-1" />
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-widest">{t('nextSafetyCheckIn')}</span>
                <span className="text-sm font-bold text-white">
                  {activeSession.nextCheckInAt 
                    ? new Date(activeSession.nextCheckInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                    : t('awaitingCheckIn')}
                </span>
              </div>
            </div>
          </Card>
        ) : (
          /* START SAFETY SESSION FORM */
          <Card className="p-6 bg-gradient-to-b from-[#131A2C]/90 to-[#0A0E1A]/95 border-cyan-500/10">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2 font-display">
              <Shield className="text-cyan-400" />
              {t('startMonitoredSafetySession')}
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              {t('startSessionDesc')}
            </p>

            <form onSubmit={handleStartSession} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">{t('activityLabel')}</label>
                  <input
                    type="text"
                    required
                    value={activityLabel}
                    onChange={(e) => setActivityLabel(e.target.value)}
                    placeholder="e.g. Uber Ride home, Walking alone"
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">{t('destinationOptional')}</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="e.g. Indiranagar Metro Station"
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">{t('activityNotesOptional')}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Cab registration KA-03-XX-1234, driver is wearing green shirt"
                  rows={2}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">{t('expectedDuration')}</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="15">{t('duration15m')}</option>
                    <option value="30">{t('duration30m')}</option>
                    <option value="60">{t('duration1h')}</option>
                    <option value="120">{t('duration2h')}</option>
                    <option value="180">{t('duration3h')}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">{t('checkInInterval')}</label>
                  <select
                    value={interval}
                    onChange={(e) => setIntervalVal(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="auto">{t('aiAssessmentRecommended')}</option>
                    <option value="5">{t('every5mHighRisk')}</option>
                    <option value="10">{t('every10m')}</option>
                    <option value="15">{t('every15m')}</option>
                    <option value="30">{t('every30m')}</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isStartingSession || guardians.filter(g => g.status === 'ACCEPTED').length === 0}
                className={`w-full py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-800 disabled:text-slate-500 text-black font-black font-display rounded-xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isStartingSession ? 'opacity-80' : ''
                }`}
              >
                {isStartingSession ? (
                  <>
                    <Spinner size={16} />
                    {t('analyzingRiskStarting')}
                  </>
                ) : (
                  <>
                    <Shield size={16} />
                    {t('startSafetySession')}
                  </>
                )}
              </button>
              {guardians.filter(g => g.status === 'ACCEPTED').length === 0 && (
                <p className="text-[10px] text-red-400 text-center mt-1">
                  {t('mustDesignateGuardian')}
                </p>
              )}
            </form>
          </Card>
        )}

        {/* TRANSPARENT AUDIT LOG VIEWER */}
        <Card className="p-6 bg-gradient-to-b from-[#131A2C]/90 to-[#0A0E1A]/95 border-cyan-500/10 mt-6">
          <h3 className="text-base font-bold text-white mb-1 font-display">{t('guardianAccessAuditLogs')}</h3>
          <p className="text-[11px] text-slate-400 mb-4">
            {t('guardianAccessAuditLogsDesc')}
          </p>

          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2 text-center">{t('noAccessHistory')}</p>
            ) : (
              auditLogs.map((log: any) => (
                <div key={log.id} className="bg-white/5 border border-white/5 rounded-xl p-2.5 flex items-center justify-between gap-3 text-[11px]">
                  <div>
                    <span className="font-bold text-white">{log.guardian?.name || 'Guardian'}</span>
                    <span className="text-slate-400"> {t('accessedYour')} </span>
                    <span className="text-cyan-400 font-mono">{log.resourceType}</span>
                    <p className="text-[9px] text-slate-500 mt-1">{t('action')}{log.action}</p>
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono shrink-0">
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* RIGHT COLUMN: Guardian List & Add Form */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* EMERGENCY SOS PANIC BOX */}
        <button
          onClick={handleTriggerSOS}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-black font-display text-base py-4 rounded-2xl flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(239,68,68,0.4)] hover:shadow-[0_4px_30px_rgba(239,68,68,0.6)] cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all border border-red-500/30"
        >
          <ShieldAlert size={22} className="animate-pulse" />
          {t('common:sos').toUpperCase()} {t('common:emergencySosTitle').toUpperCase()}
        </button>

        {/* GUARDIANS CARD */}
        <Card className="p-6 bg-gradient-to-b from-[#131A2C]/90 to-[#0A0E1A]/95 border-cyan-500/10">
          <h3 className="text-base font-bold text-white mb-1 font-display">{t('myTrustedGuardians')}</h3>
          <p className="text-[11px] text-slate-400 mb-4">{t('safetyWatchDesc')}</p>
          
          <div className="space-y-3 mb-6">
            {isLoadingGuardians ? (
              <div className="flex items-center justify-center py-4">
                <Spinner size={20} />
              </div>
            ) : guardians.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2 text-center">{t('noGuardiansConfigured')}</p>
            ) : (
              guardians.map((g) => (
                <div key={g.id} className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{g.guardian.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{g.guardian.email || g.guardian.phone}</p>
                    <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mt-1.5 ${
                      g.status === 'ACCEPTED' 
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                        : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                    }`}>
                      {g.status}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRevoke(g.id)}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors cursor-pointer"
                    title={t('removeGuardianTooltip')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          <h4 className="text-xs font-bold text-white mb-2 pt-2 border-t border-white/5">{t('inviteGuardian')}</h4>
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="space-y-1">
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t('guardianEmailPlaceholder')}
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="space-y-1">
              <input
                type="text"
                value={inviteLabel}
                onChange={(e) => setInviteLabel(e.target.value)}
                placeholder={t('nicknameLabelPlaceholder', { defaultValue: 'Nickname label (e.g. Dad, Spouse)' })}
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              type="submit"
              disabled={isSendingInvite || !inviteEmail}
              className="w-full py-2 bg-cyan-950/60 border border-cyan-500/35 hover:bg-cyan-500 hover:text-black font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer text-cyan-400"
            >
              {isSendingInvite ? (
                <>
                  <Spinner size={12} />
                  {t('inviting', { defaultValue: 'Inviting...' })}
                </>
              ) : (
                <>
                  <Plus size={12} />
                  {t('sendInvitation', { defaultValue: 'Send Invitation' })}
                </>
              )}
            </button>
          </form>
        </Card>
      </div>
    </div>
  )
}
