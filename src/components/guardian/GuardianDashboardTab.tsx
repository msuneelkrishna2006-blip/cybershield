'use client'

import React, { useState, useEffect } from 'react'
import { Card, Badge, Spinner } from '@/components/ui'
import { 
  Bell, ShieldAlert, Heart, Navigation, 
  MapPin, Check, AlertOctagon, Phone, Info, Eye
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from '@/contexts/TranslationContext'

interface ActiveAlert {
  id: string
  type: string
  status: string
  title: string
  description: string
  lat?: number
  lng?: number
  createdAt: string
  user: {
    id: string
    name: string
    phone?: string
  }
  myResponse?: string
  myRespondedAt?: string
}

interface WatchedSession {
  id: string
  activityLabel: string
  status: string
  nextCheckInAt?: string
  expiresAt: string
  userName: string
  relationshipLabel?: string
  locationPings?: Array<{ lat: number; lng: number }>
}

export default function GuardianDashboardTab() {
  const { t } = useTranslation('aiGuardian')
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([])
  const [watchedSessions, setWatchedSessions] = useState<WatchedSession[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sseConnected, setSseConnected] = useState(false)
  
  // Selected user for map simulation view
  const [selectedSession, setSelectedSession] = useState<WatchedSession | null>(null)

  // Fetch initial dashboard state
  const fetchDashboardData = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/guardian/dashboard')
      if (res.ok) {
        const data = await res.json()
        setActiveAlerts(data.activeAlerts || [])
        setWatchedSessions(data.watchedSessions || [])
        
        // Auto select first active session if none selected
        if (data.watchedSessions?.length > 0 && !selectedSession) {
          setSelectedSession(data.watchedSessions[0])
        }
      }
    } catch (err) {
      console.error('Fetch dashboard data error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Connect to SSE live updates
  useEffect(() => {
    fetchDashboardData()

    let eventSource: EventSource | null = null

    const connectSSE = async () => {
      try {
        const res = await fetch('/api/auth/token')
        if (!res.ok) return

        const { token } = await res.json()
        if (!token) return

        eventSource = new EventSource(`/api/guardian/realtime?token=${token}`)

        eventSource.addEventListener('update', (event: any) => {
          try {
            const data = JSON.parse(event.data)
            console.log('[SSE UPDATE RECEIVED]:', data)
            
            // Map keys to fit the dashboard lists
            setActiveAlerts(data.alerts || [])
            setWatchedSessions(data.sessions || [])
            setSseConnected(true)
            
            // Update selected session details if it's active
            if (selectedSession) {
              const updated = data.sessions?.find((s: any) => s.id === selectedSession.id)
              if (updated) {
                setSelectedSession(updated)
              }
            }
          } catch (e) {
            console.error('SSE JSON parse error:', e)
          }
        })

        eventSource.addEventListener('ping', () => {
          setSseConnected(true)
        })

        eventSource.onerror = (err) => {
          console.warn('[SSE ERROR] Reconnecting...', err)
          setSseConnected(false)
        }
      } catch (err) {
        console.error('SSE Setup error:', err)
      }
    }

    connectSSE()

    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [])

  // Handle respond to alert
  const handleAlertResponse = async (alertId: string, action: 'got_this' | 'false_alarm' | 'escalate' | 'resolve') => {
    try {
      const res = await fetch(`/api/guardian/alerts/${alertId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      if (res.ok) {
        if (action === 'got_this') {
          toast.success(t('acknowledgedAlertOtherGuardians'))
        } else if (action === 'false_alarm') {
          toast.success(t('alertDismissedFalseAlarm'))
        } else if (action === 'resolve') {
          toast.success(t('emergencyResolvedSafe'))
        } else {
          toast.error(t('reescalatingAlertWarning'))
        }
        fetchDashboardData()
      } else {
        const errData = await res.json()
        toast.error(errData.error || t('failedToUpdateAlert'))
      }
    } catch (err) {
      toast.error(t('connectionErrorResponding'))
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* LEFT COLUMN: Active alerts, user list */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* SSE CONNECTED BADGE INDICATOR */}
        <div className="flex items-center justify-between bg-black/30 border border-white/5 rounded-xl px-4 py-2 text-xs">
          <span className="text-slate-400">{t('liveConnectionStatus')}</span>
          <div className="flex items-center gap-1.5 font-bold font-mono">
            <span className={`w-2.5 h-2.5 rounded-full ${sseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span className={sseConnected ? 'text-emerald-400' : 'text-red-400'}>
              {sseConnected ? t('sseActive') : t('sseOffline')}
            </span>
          </div>
        </div>

        {/* ACTIVE WARNING ALERTS SECTOR */}
        {activeAlerts.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-black font-display text-red-400 flex items-center gap-2">
              <ShieldAlert className="animate-bounce" />
              {t('activeSafetyEmergencyAlerts')}
            </h3>
            
            {activeAlerts.map((alert) => (
              <Card key={alert.id} className="p-5 bg-red-950/20 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)] relative">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-3 border-b border-red-500/10 pb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="danger">{alert.type}</Badge>
                      <Badge variant="warning">{alert.status}</Badge>
                    </div>
                    <h4 className="text-base font-bold text-white font-display">
                      {alert.user.name}: {alert.title}
                    </h4>
                    <p className="text-slate-300 text-xs mt-1 leading-relaxed">{alert.description}</p>
                  </div>
                  
                  {alert.user.phone && (
                    <a
                      href={`tel:${alert.user.phone}`}
                      className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Phone size={12} />
                      {t('callGuardian')} {alert.user.name}
                    </a>
                  )}
                </div>

                {alert.lat && (
                  <p className="text-[11px] text-cyan-400 flex items-center gap-1.5 mb-4">
                    <MapPin size={12} />
                    <span>{t('coordinates')}: {alert.lat.toFixed(5)}, {alert.lng?.toFixed(5)}</span>
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleAlertResponse(alert.id, 'got_this')}
                    disabled={alert.status === 'ACKNOWLEDGED' && alert.myResponse === 'got_this'}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    {t('iGotThis')}
                  </button>
                  <button
                    onClick={() => handleAlertResponse(alert.id, 'escalate')}
                    className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    {t('escalateWarning')}
                  </button>
                  <button
                    onClick={() => handleAlertResponse(alert.id, 'false_alarm')}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    {t('falseAlarm')}
                  </button>
                  <button
                    onClick={() => handleAlertResponse(alert.id, 'resolve')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-black font-bold rounded-xl text-xs transition-colors cursor-pointer ml-auto"
                  >
                    {t('resolveSafe')}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* WATCHED USERS LIST */}
        <div>
          <h3 className="text-base font-bold text-white mb-3 font-display">{t('watchedSafetyStatuses')}</h3>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size={30} />
            </div>
          ) : watchedSessions.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4 bg-white/5 rounded-2xl text-center border border-white/5">
              {t('notGuardingAnyoneYet')}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {watchedSessions.map((session) => {
                const isSelected = selectedSession?.id === session.id
                return (
                  <Card 
                    key={session.id} 
                    onClick={() => setSelectedSession(session)}
                    className={`p-4 bg-[#131A2C]/90 hover:bg-[#18233C]/95 transition-all border cursor-pointer ${
                      isSelected ? 'border-cyan-500/80 shadow-[0_0_15px_rgba(34,211,238,0.15)]' : 'border-white/5'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-white text-sm">{session.userName}</h4>
                        {session.relationshipLabel && (
                          <span className="text-[10px] text-slate-400 font-mono">({session.relationshipLabel})</span>
                        )}
                      </div>
                      <Badge variant={session.status === 'ESCALATED' ? 'danger' : session.status === 'ACTIVE' ? 'safe' : 'info'}>
                        {session.status}
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-300 font-bold mb-1 mt-3">
                      {t('activity')} {session.activityLabel}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-4 pt-2 border-t border-white/5">
                      <span>{t('expires')}: {new Date(session.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-cyan-400 font-bold flex items-center gap-1 hover:underline">
                        <Eye size={10} />
                        {t('viewLiveMap')}
                      </span>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Live Map Simulator */}
      <div className="lg:col-span-4">
        <Card className="p-4 bg-gradient-to-b from-[#131A2C]/95 to-[#0A0E1A]/95 border-cyan-500/10 h-full flex flex-col min-h-[400px]">
          <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-1.5 font-display">
            <Navigation size={14} className="text-cyan-400 animate-pulse" />
            {t('liveSafetyTrackerMap')}
          </h3>
          <p className="text-[11px] text-slate-400 mb-4">
            {selectedSession 
              ? t('trackingUserRealtime', { name: selectedSession.userName })
              : t('selectWatchedUserTelemetry')}
          </p>

          {selectedSession ? (
            <div className="flex-1 flex flex-col justify-between space-y-4">
              {/* MOCK MAP GRID BACKGROUND */}
              <div className="flex-1 relative bg-slate-950 border border-white/10 rounded-2xl overflow-hidden min-h-[220px] flex items-center justify-center">
                {/* Cyber Grid Background */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />
                
                {/* Fake GPS Path Node */}
                <div className="absolute w-24 h-24 bg-cyan-500/10 rounded-full border border-cyan-500/25 flex items-center justify-center animate-ping" />
                <div className="z-10 bg-slate-900 border border-cyan-500/50 rounded-xl p-3 text-center shadow-lg">
                  <MapPin size={24} className="text-cyan-400 mx-auto animate-bounce mb-1" />
                  <p className="text-[10px] font-bold text-white font-mono">{selectedSession.userName}</p>
                  <p className="text-[9px] text-slate-400 font-mono">
                    {selectedSession.locationPings && selectedSession.locationPings[0] 
                      ? `${(selectedSession.locationPings[0] as any).lat.toFixed(4)}, ${(selectedSession.locationPings[0] as any).lng.toFixed(4)}`
                      : '12.9716, 77.5946'}
                  </p>
                </div>
              </div>

              {/* TELEMETRY INFO */}
              <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-xs">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-slate-400">{t('targetUser')}</span>
                  <span className="font-bold text-white">{selectedSession.userName}</span>
                </div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-slate-400">{t('activity')}</span>
                  <span className="font-bold text-white">{selectedSession.activityLabel}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">{t('currentStatus')}</span>
                  <span className="font-bold text-cyan-400 uppercase">{selectedSession.status}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs italic">
              <Info size={32} className="mb-2 text-slate-600" />
              {t('noSafetySessionSelected')}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
