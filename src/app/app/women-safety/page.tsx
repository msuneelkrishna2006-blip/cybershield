'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, Badge, Spinner } from '@/components/ui'
import { 
  Heart, PhoneCall, MapPin, AlertCircle, FileText, Download, 
  Play, Square, Video, Mic, ShieldAlert, PhoneOff, Phone, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from '@/contexts/TranslationContext'
import { sleep } from '@/lib/utils'

export default function WomenSafetyPage() {
  const { t } = useTranslation('womenSafety')
  const [activeTab, setActiveTab] = useState<'overview' | 'incidents'>('overview')
  const [incidents, setIncidents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Fake Call State
  const [callerName, setCallerName] = useState('Dad')
  const [delay, setDelay] = useState(15) // seconds
  const [fakeCallActive, setFakeCallActive] = useState(false)
  const [showCallOverlay, setShowCallOverlay] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  
  // Journey Sharing State
  const [locationShared, setLocationShared] = useState(false)
  const [journeyAddress, setJourneyAddress] = useState('Metro Station, Indiranagar, Bangalore')
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const oscillatorIntervalRef = useRef<any>(null)

  const loadIncidents = async () => {
    try {
      const [incidentsRes, sessionsRes] = await Promise.all([
        fetch('/api/v1/incidents'),
        fetch('/api/v1/women-safety')
      ])
      
      if (incidentsRes.ok) {
        const data = await incidentsRes.json()
        if (data.success) {
          setIncidents(data.data.incidents)
        }
      }
      
      if (sessionsRes.ok) {
        const data = await sessionsRes.json()
        if (data.success && data.data && data.data.sessions && data.data.sessions.length > 0) {
          const activeSession = data.data.sessions.find((s: any) => s.status === 'active')
          if (activeSession) {
            setActiveSessionId(activeSession.id)
            setLocationShared(true)
            if (activeSession.destination) {
              setJourneyAddress(activeSession.destination)
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to load data:', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadIncidents()
  }, [])

  // Web Audio Ringtone Synthesizer
  const startRingtone = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AudioContextClass()
      audioCtxRef.current = ctx

      const ringSequence = () => {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') return

        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const gainNode = ctx.createGain()

        osc1.type = 'sine'
        osc1.frequency.setValueAtTime(440, ctx.currentTime)
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(480, ctx.currentTime)

        gainNode.gain.setValueAtTime(0.15, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8)

        osc1.connect(gainNode)
        osc2.connect(gainNode)
        gainNode.connect(ctx.destination)

        osc1.start()
        osc2.start()
        osc1.stop(ctx.currentTime + 2.0)
        osc2.stop(ctx.currentTime + 2.0)
      }

      ringSequence()
      oscillatorIntervalRef.current = setInterval(ringSequence, 3000)
    } catch (e) {
      console.error('Web Audio not supported or blocked by browser', e)
    }
  }

  const stopRingtone = () => {
    if (oscillatorIntervalRef.current) {
      clearInterval(oscillatorIntervalRef.current)
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close()
    }
  }

  // Handle countdown logic for Fake Incoming Call
  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) {
      setCountdown(null)
      setShowCallOverlay(true)
      startRingtone()
      return
    }

    const timer = setTimeout(() => {
      setCountdown(prev => (prev !== null ? prev - 1 : null))
    }, 1000)

    return () => clearTimeout(timer)
  }, [countdown])

  const triggerFakeCall = () => {
    if (fakeCallActive) {
      setFakeCallActive(false)
      setCountdown(null)
      toast.dismiss()
      toast.error(t('callCancelled'))
    } else {
      setFakeCallActive(true)
      setCountdown(delay)
      toast.success(t('callScheduled', { seconds: delay }))
    }
  }

  const handleDeclineCall = () => {
    setShowCallOverlay(false)
    setFakeCallActive(false)
    stopRingtone()
    toast.error(t('callDeclined'))
  }

  const handleAcceptCall = () => {
    setShowCallOverlay(false)
    setFakeCallActive(false)
    stopRingtone()
    toast.success(t('callAccepted'))
  }

  const handleJourneyShare = async () => {
    if (locationShared && activeSessionId) {
      try {
        await fetch(`/api/v1/women-safety/${activeSessionId}/check-in`, {
          method: 'POST'
        })
        setLocationShared(false)
        setActiveSessionId(null)
        toast.error(t('journeyTerminated'))
      } catch (e) {
        console.error(e)
      }
    } else {
      try {
        const res = await fetch('/api/v1/women-safety', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activityLabel: 'Safe Walk',
            destination: journeyAddress,
            expectedDuration: 30
          })
        })
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data && data.data.session) {
            setActiveSessionId(data.data.session.id)
            setLocationShared(true)
            toast.success(t('locationBroadcasted'))
          }
        }
      } catch (e) {
        console.error(e)
      }
    }
  }

  // Simulation controls saving to SQLite incidents table
  const handleRecordAudio = async () => {
    toast.promise(
      new Promise(async (resolve, reject) => {
        try {
          let lat = 12.9716, lng = 77.5946
          if (typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                lat = pos.coords.latitude
                lng = pos.coords.longitude
              },
              () => {},
              { timeout: 3000 }
            )
          }
          await sleep(1500)
          
          const res = await fetch('/api/v1/incidents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: 'Harassment/Threat incident with audio recording evidence',
              lat,
              lng,
              evidence: ['audio']
            })
          })
          if (res.ok) {
            const data = await res.json()
            if (data.success) {
              loadIncidents()
              resolve(true)
            } else {
              reject(new Error(data.error))
            }
          } else {
            reject(new Error('Failed to record incident.'))
          }
        } catch (e) {
          reject(e)
        }
      }),
      {
        loading: t('audioInit'),
        success: t('audioUploaded'),
        error: t('audioFailed')
      }
    )
  }

  const handleRecordVideo = async () => {
    toast.promise(
      new Promise(async (resolve, reject) => {
        try {
          let lat = 12.9716, lng = 77.5946
          if (typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                lat = pos.coords.latitude
                lng = pos.coords.longitude
              },
              () => {},
              { timeout: 3000 }
            )
          }
          await sleep(1500)
          
          const res = await fetch('/api/v1/incidents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: 'Suspicious journey/stalking threat with video recording evidence',
              lat,
              lng,
              evidence: ['video']
            })
          })
          if (res.ok) {
            const data = await res.json()
            if (data.success) {
              loadIncidents()
              resolve(true)
            } else {
              reject(new Error(data.error))
            }
          } else {
            reject(new Error('Failed to record incident.'))
          }
        } catch (e) {
          reject(e)
        }
      }),
      {
        loading: t('videoInit'),
        success: t('videoRecorded'),
        error: t('videoFailed')
      }
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in duration-300">
      
      <div className="tricolor-accent-bar" />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          <Heart className="w-8 h-8 text-pink-500" />
          {t('title')}
        </h1>
        <p className="text-slate-400 mt-1">{t('subtitle')}</p>
      </div>

      {/* Tab select layout */}
      <div className="flex gap-4 border-b border-white/10 pb-4">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`font-bold pb-2 text-sm transition-colors border-b-2 cursor-pointer ${
            activeTab === 'overview' 
              ? 'text-pink-400 border-pink-500' 
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          {t('tabQuickActions')}
        </button>
        <button 
          onClick={() => setActiveTab('incidents')}
          className={`font-bold pb-2 text-sm transition-colors border-b-2 cursor-pointer ${
            activeTab === 'incidents' 
              ? 'text-pink-400 border-pink-500' 
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          {t('tabIncidentVault')}
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Fake Incoming Call card */}
          <Card className="p-6 border-pink-500/20 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <PhoneCall className="w-6 h-6 text-pink-400" />
                    {t('fakeCallTitle')}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">{t('fakeCallDesc')}</p>
                </div>
                <Badge variant={fakeCallActive ? 'danger' : 'info'}>
                  {fakeCallActive ? t('statusActive') : t('statusReady')}
                </Badge>
              </div>
              
              <div className="bg-black/40 rounded-xl p-4 mb-4 border border-white/5 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">{t('callerName')}</span>
                  <input 
                    type="text" 
                    value={callerName} 
                    onChange={(e) => setCallerName(e.target.value)}
                    className="bg-slate-800/80 border border-white/10 rounded px-2.5 py-1 text-right text-white font-medium outline-none focus:border-pink-500 max-w-[120px] text-xs" 
                  />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">{t('delaySeconds')}</span>
                  <select 
                    value={delay} 
                    onChange={(e) => setDelay(Number(e.target.value))}
                    className="bg-slate-800/80 border border-white/10 rounded px-2.5 py-1 text-white font-medium outline-none text-xs"
                  >
                    <option value={5}>{t('delay5')}</option>
                    <option value={10}>{t('delay10')}</option>
                    <option value={15}>{t('delay15')}</option>
                    <option value={30}>{t('delay30')}</option>
                  </select>
                </div>
              </div>
            </div>
            
            <button 
              onClick={triggerFakeCall}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                fakeCallActive 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30' 
                  : 'bg-pink-600 hover:bg-pink-500 text-white shadow-[0_0_20px_rgba(219,39,119,0.3)]'
              }`}
            >
              {fakeCallActive ? (
                <><Square className="w-5 h-5 shrink-0" /> {t('cancelCall')} {countdown !== null && `(${countdown}s)`}</>
              ) : (
                <><Play className="w-5 h-5 shrink-0" /> {t('triggerCallNow')}</>
              )}
            </button>
          </Card>

          {/* Journey Sharing card */}
          <Card className="p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <MapPin className="w-6 h-6 text-emerald-400" />
                    {t('journeySharing')}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">{t('journeySharingDesc')}</p>
                </div>
                {locationShared && <Badge variant="safe" className="animate-pulse">{t('live')}</Badge>}
              </div>
              
              {/* Map Simulator */}
              <div className="aspect-video bg-[#0c1224] rounded-xl mb-4 flex flex-col items-center justify-center border border-white/10 relative overflow-hidden">
                <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '15px 15px' }}></div>
                
                {locationShared ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                    <div className="relative">
                      <div className="absolute -inset-4 bg-emerald-500/20 rounded-full animate-ping" />
                      <div className="absolute -inset-8 bg-emerald-500/10 rounded-full animate-pulse" />
                      <MapPin className="w-8 h-8 text-emerald-400 z-10 relative drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                    </div>
                    <div className="mt-4 text-center z-10">
                      <p className="text-xs font-bold text-white uppercase tracking-widest animate-pulse">{t('gpsTrackingActive')}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 max-w-[200px] truncate">{journeyAddress}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center z-10 flex flex-col items-center">
                    <MapPin className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-xs text-slate-500 font-semibold">{t('locationSharedInactive')}</p>
                  </div>
                )}
              </div>
            </div>
            
            <button 
              onClick={handleJourneyShare}
              className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                locationShared 
                  ? 'bg-white/10 text-white hover:bg-white/20' 
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]'
              }`}
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              {locationShared ? t('stopSharing') : t('startJourney')}
            </button>
          </Card>

          {/* Evidence Capture shortcuts */}
          <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <button 
              onClick={handleRecordAudio}
              className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors cursor-pointer"
            >
              <Mic className="w-6 h-6 text-blue-400" />
              <span className="text-xs text-white font-bold">{t('recordAudio')}</span>
            </button>
            <button 
              onClick={handleRecordVideo}
              className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors cursor-pointer"
            >
              <Video className="w-6 h-6 text-purple-400" />
              <span className="text-xs text-white font-bold">{t('recordVideo')}</span>
            </button>
            
            {/* Real tel link dials */}
            <a 
              href="tel:112"
              className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors text-center text-decoration-none"
            >
              <AlertCircle className="w-6 h-6 text-orange-400" />
              <span className="text-xs text-white font-bold">{t('quickDial112')}</span>
            </a>
            <a 
              href="tel:1091"
              className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors text-center text-decoration-none"
            >
              <PhoneCall className="w-6 h-6 text-pink-400" />
              <span className="text-xs text-white font-bold">{t('helpline1091')}</span>
            </a>
          </div>
        </div>
      )}

      {activeTab === 'incidents' && (
        <Card className="p-0 overflow-hidden">
          <div className="p-6 border-b border-white/5 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-black text-white">{t('secureIncidentVault')}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{t('vaultSubtitle')}</p>
            </div>
            <button 
              onClick={() => toast.success(t('exportingPdf'))}
              className="text-pink-400 text-xs font-extrabold uppercase hover:text-pink-300 transition-colors cursor-pointer"
            >
              {t('exportAllPdf')}
            </button>
          </div>
          
          {isLoading ? (
            <div className="p-12 text-center">
              <Spinner size={24} className="text-pink-500" />
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {incidents.length > 0 ? incidents.map((incident) => {
                const hasAudio = incident.evidence.includes('audio')
                const hasVideo = incident.evidence.includes('video')
                return (
                  <div key={incident.id} className="p-6 hover:bg-white/5 transition-colors flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-extrabold text-white text-sm">{incident.description}</h4>
                        {hasAudio && <Badge variant="info">{t('audioAttached')}</Badge>}
                        {hasVideo && <Badge variant="purple">{t('videoAttached')}</Badge>}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2">
                        <span>{new Date(incident.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-pink-400" /> 
                          {incident.lat ? `${incident.lat.toFixed(4)}, ${incident.lng.toFixed(4)}` : 'Indiranagar, Bangalore'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => toast.success(t('accessingToken'))}
                        className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer" 
                        title="View Details"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => toast.success(t('downloadingRecord'))}
                        className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer" 
                        title="Export Archive"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              }) : (
                <div className="p-12 text-center text-slate-500 text-sm">
                  {t('noIncidents')}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Simulated Call Screen Overlay */}
      {showCallOverlay && (
        <div className="fixed inset-0 z-[99999] bg-[#0c1020] flex flex-col justify-between items-center py-20 px-8 animate-in fade-in duration-300">
          <div className="text-center space-y-4">
            <p className="text-xs font-bold text-pink-400 uppercase tracking-widest animate-pulse">{t('incomingCallSimulated')}</p>
            <h1 className="text-4xl font-black text-white tracking-tight">{callerName}</h1>
            <p className="text-sm text-slate-400">{t('cyberShieldProtection')}</p>
          </div>

          <div className="w-28 h-28 rounded-full bg-pink-500/10 flex items-center justify-center border border-pink-500/20 animate-pulse-slow">
            <PhoneCall className="w-12 h-12 text-pink-400 animate-bounce" />
          </div>

          <div className="flex gap-16 justify-center items-center w-full max-w-sm">
            {/* Decline Call */}
            <button 
              onClick={handleDeclineCall}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white transition-transform hover:scale-115 cursor-pointer shadow-[0_0_24px_rgba(220,38,38,0.4)]"
            >
              <PhoneOff size={24} />
            </button>

            {/* Accept Call */}
            <button 
              onClick={handleAcceptCall}
              className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white transition-transform hover:scale-115 cursor-pointer shadow-[0_0_24px_rgba(16,185,129,0.4)]"
            >
              <Phone size={24} className="rotate-[15deg] animate-pulse" />
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
