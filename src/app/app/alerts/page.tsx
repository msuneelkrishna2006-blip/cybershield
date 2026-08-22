'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { useTranslation } from '@/contexts/TranslationContext'
import { Alert, AlertCategory, AlertSeverity } from '@/types'
import { formatDateTime } from '@/lib/utils'
import { Card, Badge, LoadingSkeleton, EmptyState } from '@/components/ui'
import { 
  Bell, Check, Trash2, ShieldAlert, Bot, Siren, 
  HeartPulse, ShieldCheck, HelpCircle, ActivitySquare, 
  Settings, CheckSquare, Sparkles, ArrowUp
} from 'lucide-react'
import Link from 'next/link'

const CATEGORY_INFO: Record<AlertCategory, { icon: any; color: string; labelKey: string }> = {
  scam: { icon: ShieldAlert, color: 'text-cyan-400 bg-cyan-950/40 border-cyan-500/20', labelKey: 'filter_scam' },
  child_safety: { icon: ShieldCheck, color: 'text-purple-400 bg-purple-950/40 border-purple-500/20', labelKey: 'filter_child_safety' },
  family: { icon: Bot, color: 'text-emerald-400 bg-emerald-950/40 border-emerald-500/20', labelKey: 'filter_family' },
  women_safety: { icon: HeartPulse, color: 'text-pink-400 bg-pink-950/40 border-pink-500/20', labelKey: 'filter_women_safety' },
  emergency_sos: { icon: Siren, color: 'text-red-400 bg-red-950/40 border-red-500/20', labelKey: 'filter_emergency' },
  system: { icon: Settings, color: 'text-slate-400 bg-slate-950/40 border-slate-500/20', labelKey: 'filter_system' }
}

const SEVERITY_VARIANTS: Record<AlertSeverity, 'info' | 'warning' | 'danger' | 'safe'> = {
  low: 'info',
  medium: 'warning',
  high: 'danger',
  critical: 'danger'
}

const SEVERITY_LABELS = {
  low: 'lowRisk',
  medium: 'mediumRisk',
  high: 'highRisk',
  critical: 'criticalRisk'
}

const STATUS_LABELS = {
  all: 'statusAll',
  unread: 'statusUnread',
  read: 'statusRead'
}

export default function AlertsPage() {
  const { t } = useTranslation('alerts')
  
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<AlertCategory | 'all'>('all')
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all')
  
  const [scrolledDown, setScrolledDown] = useState(false)
  const [newAlertsAvailable, setNewAlertsAvailable] = useState(false)
  const prevAlertsLengthRef = useRef(alerts.length)
  const listContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        const res = await fetch('/api/v1/dashboard')
        const data = await res.json()
        if (data.success && data.data) {
          const dashboardAlerts = (data.data.timelineEvents || data.data.recentAlerts || []).map((ev: any) => ({
            id: ev.id,
            type: (ev.title.includes('CHILD') ? 'child_safety' : ev.title.includes('FAMILY') ? 'family' : ev.title.includes('WOMEN') ? 'women_safety' : 'system') as AlertCategory,
            severity: ev.type === 'alert' ? 'high' : 'info',
            title: ev.title,
            description: ev.desc,
            createdAt: ev.timestamp,
            read: false,
          }))
          setAlerts(dashboardAlerts)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadAlerts()
  }, [])

  const markAsRead = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))
  }

  const markAllAsRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })))
  }

  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  const triggerSimulatedAlert = () => {}

  // Detect scroll position to show "New Alerts" back to top pill
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setScrolledDown(true)
      } else {
        setScrolledDown(false)
        setNewAlertsAvailable(false)
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Detect new unread alerts added to top
  useEffect(() => {
    if (alerts.length > prevAlertsLengthRef.current) {
      const hasNewUnread = alerts.slice(0, alerts.length - prevAlertsLengthRef.current).some(a => !a.read)
      if (hasNewUnread && scrolledDown) {
        setNewAlertsAvailable(true)
      }
    }
    prevAlertsLengthRef.current = alerts.length
  }, [alerts, scrolledDown])

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      const matchCat = categoryFilter === 'all' || alert.type === categoryFilter
      const matchRead = readFilter === 'all' || 
                        (readFilter === 'unread' && !alert.read) || 
                        (readFilter === 'read' && alert.read)
      return matchCat && matchRead
    })
  }, [alerts, categoryFilter, readFilter])

  // Group alerts by day
  const groupedAlerts = useMemo(() => {
    const groups: Record<string, Alert[]> = {}
    
    filteredAlerts.forEach(alert => {
      const date = new Date(alert.createdAt)
      const today = new Date()
      const yesterday = new Date()
      yesterday.setDate(today.getDate() - 1)
      
      let dayKey = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      
      if (date.toDateString() === today.toDateString()) {
        dayKey = 'today'
      } else if (date.toDateString() === yesterday.toDateString()) {
        dayKey = 'yesterday'
      }
      
      if (!groups[dayKey]) {
        groups[dayKey] = []
      }
      groups[dayKey].push(alert)
    })
    
    return groups
  }, [filteredAlerts])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setNewAlertsAvailable(false)
  }

  // Announces new alerts to Screen Readers
  const ariaAnnouncement = useMemo(() => {
    const unread = alerts.filter(a => !a.read)
    if (unread.length === 0) return ''
    const latest = unread[0]
    return `New ${latest.severity} alert: ${latest.title}. ${latest.description}`
  }, [alerts])

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 relative">
      {/* Screen Reader ARIA Live Region */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {ariaAnnouncement}
      </div>

      {/* Floating Back to Top Pill for New Alerts */}
      <AnimatePresence>
        {newAlertsAvailable && (
          <motion.button
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            onClick={scrollToTop}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 rounded-full text-xs font-black text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-cyan-400/20"
          >
            <Sparkles className="w-4 h-4 animate-bounce" />
            {t('newAlertsReceived')}
            <ArrowUp className="w-3.5 h-3.5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-black tracking-tight text-white">{t('title')}</h1>
            {alerts.filter(a => !a.read).length > 0 && (
              <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-xs px-2.5 py-0.5 rounded-full font-bold">
                {alerts.filter(a => !a.read).length} {t('unread')}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400">{t('subtitle')}</p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 self-end md:self-center">
          <button 
            onClick={() => triggerSimulatedAlert()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 font-bold transition-all"
            title={t('triggerTestAlert')}
          >
            <Sparkles className="w-4 h-4 text-cyan-400" />
            {t('triggerTestAlert')}
          </button>
          
          <button 
            onClick={markAllAsRead}
            disabled={alerts.every(a => a.read)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs text-white font-bold transition-all"
          >
            <CheckSquare className="w-4 h-4" />
            {t('markAllRead')}
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">{t('category')}</span>
          {(['all', 'scam', 'child_safety', 'family', 'women_safety', 'emergency_sos', 'system'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                categoryFilter === cat 
                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' 
                  : 'bg-transparent text-slate-400 border-transparent hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              {cat === 'all' ? t('filterAll') : t(CATEGORY_INFO[cat].labelKey)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">{t('status')}</span>
          {(['all', 'unread', 'read'] as const).map(readState => (
            <button
              key={readState}
              onClick={() => setReadFilter(readState)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                readFilter === readState
                  ? 'bg-white/10 text-white border-white/10 font-extrabold'
                  : 'bg-transparent text-slate-400 border-transparent hover:bg-white/5'
              }`}
            >
              {t(STATUS_LABELS[readState])}
            </button>
          ))}
        </div>
      </div>

      {/* Main Alert List */}
      <div ref={listContainerRef} className="space-y-8">
        {loading ? (
          <div className="space-y-4">
            <LoadingSkeleton className="h-24 w-full" />
            <LoadingSkeleton className="h-24 w-full" />
            <LoadingSkeleton className="h-24 w-full" />
          </div>
        ) : filteredAlerts.length === 0 ? (
          <EmptyState 
            icon={<Bell className="w-12 h-12" />}
            title={t('allClear')}
            description={t('noAlerts')}
          />
        ) : (
          Object.keys(groupedAlerts).map(day => (
            <div key={day} className="space-y-3">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider pl-1">
                {day === 'today' || day === 'yesterday' ? t(day) : day}
              </h3>
              
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {groupedAlerts[day].map(alert => {
                    const info = CATEGORY_INFO[alert.type]
                    const Icon = info.icon
                    
                    return (
                      <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 20 }}
                        className={`group relative flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 ${
                          alert.read 
                            ? 'bg-black/20 border-white/5 hover:bg-black/30' 
                            : 'bg-white/[0.03] border-cyan-500/10 hover:border-cyan-500/25 shadow-[0_0_20px_rgba(6,182,212,0.03)]'
                        }`}
                      >
                        {/* Unread dot indicator */}
                        {!alert.read && (
                          <div className="absolute top-1/2 -translate-y-1/2 left-2 w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        )}

                        {/* Icon Block */}
                        <div className={`p-3 rounded-xl border shrink-0 ${info.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>

                        {/* Content text */}
                        <div className="flex-1 min-w-0 pr-10">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            {alert.actionUrl ? (
                              <Link 
                                href={alert.actionUrl}
                                onClick={() => markAsRead(alert.id)}
                                className="font-bold text-white hover:text-cyan-400 transition-colors text-sm md:text-base leading-snug truncate"
                              >
                                {alert.title}
                              </Link>
                            ) : (
                              <h4 
                                onClick={() => markAsRead(alert.id)}
                                className="font-bold text-white text-sm md:text-base leading-snug truncate cursor-pointer"
                              >
                                {alert.title}
                              </h4>
                            )}
                            
                            <Badge variant={SEVERITY_VARIANTS[alert.severity]} className="text-[9px] font-black uppercase tracking-wider scale-90">
                              {t(SEVERITY_LABELS[alert.severity])}
                            </Badge>
                          </div>
                          
                          <p className="text-slate-300 text-xs md:text-sm leading-relaxed mb-1 pr-4">
                            {alert.description}
                          </p>
                          
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            {formatDateTime(alert.createdAt)}
                          </span>
                        </div>

                        {/* Quick Action Side Buttons */}
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          {!alert.read && (
                            <button
                              onClick={() => markAsRead(alert.id)}
                              className="p-2 rounded-lg bg-white/5 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 border border-white/5 transition-all"
                              title={t('markAsRead')}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => dismissAlert(alert.id)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-white/5 transition-all"
                            title={t('dismissNotification')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
