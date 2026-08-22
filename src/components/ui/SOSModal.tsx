'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, AlertTriangle, Phone, MapPin, FileText, 
  ExternalLink, Heart, Siren, Baby, ShieldAlert, ShieldCheck
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useTranslation } from '@/contexts/TranslationContext'

interface SOSModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SOSModal({ isOpen, onClose }: SOSModalProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState(1)
  const [sharingLocation, setSharingLocation] = useState(false)
  const [activating, setActivating] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  // Reset to Step 1 on open/close
  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setActivating(false)
      // Focus trap setup
      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusableElements && focusableElements.length > 0) {
        (focusableElements[0] as HTMLElement).focus()
      }
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Focus trap Tab handling
  const handleTabKey = (e: React.KeyboardEvent) => {
    if (!modalRef.current) return
    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus()
          e.preventDefault()
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus()
          e.preventDefault()
        }
      }
    }
  }

  // Handle SOS Confirmation and Notification Dispatch
  const handleConfirmSOS = () => {
    setActivating(true)
    toast.loading(t('sosAcquiringGpsLocation'), { id: 'sos-trigger' })

    // Simulate Location Query
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`
          triggerNotificationAlert(mapsLink)
        },
        () => {
          // Fallback if denied/error
          triggerNotificationAlert(null)
        },
        { timeout: 5000 }
      )
    } else {
      triggerNotificationAlert(null)
    }
  }

  const triggerNotificationAlert = (mapsLink: string | null) => {
    // 1. Get emergency contacts from settings or default mock list
    // Priya Sharma (+919876543211) and Rajesh Sharma (+919876543212)
    const contactsText = 'Priya Sharma (Spouse) and Rajesh Sharma (Father)'
    
    // 2. Dispatch Mock SMS alert
    setTimeout(() => {
      toast.success(
        <div className="flex flex-col gap-1 text-left text-xs">
          <span className="font-bold text-white uppercase tracking-wider">{t('sosActivatedToast')}</span>
          <span>{t('sosDispatchedTo')}</span>
          <span className="text-[10px] text-slate-200 font-semibold">{contactsText}</span>
          {mapsLink ? (
            <span className="text-[9px] text-cyan-400 truncate">{t('sosSharedMaps')} {mapsLink}</span>
          ) : (
            <span className="text-[9px] text-red-300">{t('sosGpsUnavailable')}</span>
          )}
        </div>,
        { id: 'sos-trigger', duration: 6000, style: { background: '#ef4444', color: '#fff' } }
      )

      // 3. Log event to local history storage for activity feed
      const events = JSON.parse(localStorage.getItem('cyber_sos_events') || '[]')
      events.unshift({
        id: 'sos_' + Math.random().toString(36).substring(2, 10),
        timestamp: new Date().toISOString(),
        status: 'unresolved', // default state
        location: mapsLink || 'GPS Unavailable'
      })
      localStorage.setItem('cyber_sos_events', JSON.stringify(events))

      // Trigger custom storage event to alert dashboard in real-time
      window.dispatchEvent(new Event('storage'))

      setStep(2)
      setActivating(false)
    }, 1200)
  }

  // Handle location sharing link copy manually
  const handleShareLocation = () => {
    setSharingLocation(true)
    toast.loading(t('sosAcquiringLocation'), { id: 'sos-location' })

    if (!navigator.geolocation) {
      toast.error(t('sosGeolocationUnsupported'), { id: 'sos-location' })
      setSharingLocation(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`
        navigator.clipboard.writeText(mapsLink).then(() => {
          toast.success(t('sosGpsCopied'), { id: 'sos-location' })
        }).catch(() => {
          toast.success(`Coords: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, { id: 'sos-location' })
        })
        setSharingLocation(false)
      },
      (err) => {
        toast.error(t('sosLocationDenied'), { id: 'sos-location' })
        setSharingLocation(false)
      }
    )
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sos-header"
          onKeyDown={handleTabKey}
        >
          {/* Backdrop Click Close */}
          <div className="absolute inset-0" onClick={() => !activating && onClose()} />

          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative glass-dark rounded-3xl border-2 border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.2)] max-w-lg w-full overflow-hidden text-center z-10"
          >
            {/* Header Area */}
            <div className="p-6 md:p-8 border-b border-white/5 bg-white/[0.01] flex items-start justify-between text-left">
              <div>
                <h2 id="sos-header" className="text-xl md:text-2xl font-black text-red-500 flex items-center gap-2 tracking-wide uppercase">
                  <AlertTriangle className="w-6 h-6 text-red-500 animate-pulse" />
                  {t('sosModalTitle')}
                </h2>
                <p className="text-xs md:text-sm text-slate-400 mt-1">
                  {t('sosModalSubtitle')}
                </p>
              </div>
              <button 
                onClick={onClose}
                disabled={activating}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors disabled:opacity-55"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Steps Rendering */}
            <div className="p-6 md:p-8">
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-6"
                  >
                    <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                      <AlertTriangle className="w-10 h-10 animate-bounce" />
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-lg md:text-xl font-bold text-white">{t('sosAreYouInDanger')}</h3>
                      <p className="text-xs md:text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
                        {t('sosAccessHelplines')}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button
                        onClick={handleConfirmSOS}
                        disabled={activating}
                        className="flex-1 bg-red-600 hover:bg-red-500 text-white font-extrabold py-3.5 px-6 rounded-xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] text-sm md:text-base uppercase tracking-wider cursor-pointer"
                      >
                        {activating ? t('sosNotifying') : t('sosYesNeedHelp')}
                      </button>
                      <button
                        onClick={onClose}
                        disabled={activating}
                        className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 font-bold py-3.5 px-6 rounded-xl transition-all text-sm md:text-base cursor-pointer"
                      >
                        {t('sosNoImSafe')}
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-5 text-left"
                  >
                    {/* Primary Verified Emergency Dials */}
                    <div className="space-y-3">
                      {/* Call 112 */}
                      <a 
                        href="tel:112"
                        className="flex items-start gap-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 transition-all group"
                      >
                        <div className="p-3 rounded-xl bg-red-500/20 text-red-400 shrink-0">
                          <Phone className="w-5 h-5 animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-sm text-white group-hover:text-red-300 transition-colors">Call National Police (112)</span>
                            <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase">Universal</span>
                          </div>
                          <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                            Call immediately for physical danger, harassment, stalking, safety hazards, or medical assistance.
                          </p>
                        </div>
                      </a>

                      {/* Call 1930 */}
                      <a 
                        href="tel:1930"
                        className="flex items-start gap-4 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 hover:bg-cyan-500/20 transition-all group"
                      >
                        <div className="p-3 rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0">
                          <Phone className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-sm text-white group-hover:text-cyan-300 transition-colors">Call Cyber Helpline (1930)</span>
                            <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded font-bold uppercase">Financial</span>
                          </div>
                          <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                            Call immediately for digital arrest scams, bank account compromises, OTP fraud, or financial thefts.
                          </p>
                        </div>
                      </a>
                    </div>

                    {/* Secondary Actions Drawer */}
                    <div className="max-h-[160px] overflow-y-auto space-y-2 pr-2 scrollbar-thin border-t border-white/5 pt-4">
                      
                      {/* Women Safety 181 */}
                      <a 
                        href="tel:181"
                        className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Heart className="w-4 h-4 text-pink-400" />
                          <span className="font-bold text-slate-200">Call Women Safety (181)</span>
                        </div>
                        <Phone className="w-3.5 h-3.5 text-pink-400" />
                      </a>

                      {/* Child Safety 1098 */}
                      <a 
                        href="tel:1098"
                        className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Baby className="w-4 h-4 text-emerald-400" />
                          <span className="font-bold text-slate-200">Call Child Helpline (1098)</span>
                        </div>
                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      </a>

                      {/* Share My Location */}
                      <button
                        onClick={handleShareLocation}
                        disabled={sharingLocation}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-xs text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-purple-400" />
                          <span className="font-bold text-slate-200">Get Live GPS Coordinates Link</span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
                      </button>

                      {/* Report complaint */}
                      <a 
                        href="/app/emergency"
                        onClick={onClose}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-400" />
                          <span className="font-bold text-slate-200">File Online Incident Complaint</span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                      </a>
                    </div>

                    <div className="text-center text-[9px] text-slate-500 font-bold uppercase tracking-wider pt-2 border-t border-white/5">
                      CyberShield Emergency Network · Contacts Notified
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
