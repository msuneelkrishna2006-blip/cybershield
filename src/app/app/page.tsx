'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from '@/contexts/TranslationContext'
import { 
  StatCard, SafetyScore, ProgressBar, Badge, Card, ShieldLogo 
} from '@/components/ui'
import { formatDateTime } from '@/lib/utils'
import { 
  ShieldCheck, AlertTriangle, MessageSquareWarning, 
  Link as LinkIcon, QrCode, ArrowRight, Activity, Users, ShieldAlert,
  Clock, ShieldAlert as AlertIcon, RefreshCw, CheckCircle2, Siren, UserCheck
} from 'lucide-react'

// Recharts for activity graphs
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, Legend
} from 'recharts'

// Chart dynamic datasets
// Note: chart data names are localized at render time via getDailyChartData() etc.
// Raw static data is defined inline below, with translated names injected at runtime.

interface SecurityEvent {
  id: string
  title: string
  desc: string
  timeText: string
  timestamp: string
  type: 'safe' | 'alert' | 'sos'
}

export default function DashboardHome() {
  const { user } = useAuth()
  const { t, language } = useTranslation('dashboard')
  const isUrdu = language === 'ur'
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week')
  const [stats, setStats] = useState<any>(null)
  const [familyMembers, setFamilyMembers] = useState<any[]>([])
  const [threatTypeData, setThreatTypeData] = useState<any[]>([])
  const [timelineEvents, setTimelineEvents] = useState<any[]>([])
  const [chartDataRaw, setChartDataRaw] = useState<any>({ daily: [], weekly: [], monthly: [] })
  const [recentAlerts, setRecentAlerts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load dashboard statistics on mount
  const loadDashboard = async () => {
    try {
      const res = await fetch('/api/v1/dashboard')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setStats(data.data.stats)
          setFamilyMembers(data.data.familyMembers)
          setThreatTypeData(data.data.threatTypeData)
          setTimelineEvents(data.data.timelineEvents)
          setChartDataRaw({
            daily: data.data.dailyChartData,
            weekly: data.data.weeklyChartData,
            monthly: data.data.monthlyChartData
          })
          setRecentAlerts(data.data.recentAlerts)
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  if (!user) return null

  // Dynamic Chart Selection
  const activeChartData = 
    timeRange === 'day' ? chartDataRaw.daily : 
    timeRange === 'month' ? chartDataRaw.monthly : 
    chartDataRaw.weekly

  // Compile Dynamic Activity Timeline
  const compiledTimelineEvents = [
    ...timelineEvents
  ]

  const quickActions = [
    { icon: MessageSquareWarning, label: t('scanMessage'), href: '/app/scam-scanner', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
    { icon: LinkIcon, label: t('checkLink'), href: '/app/scam-scanner?tab=link', color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { icon: QrCode, label: t('scanQr'), href: '/app/scam-scanner?tab=qr', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { icon: Users, label: t('manageFamily'), href: '/app/family', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  ]

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse max-w-6xl mx-auto p-4">
        <div className="h-10 bg-slate-800 rounded-lg w-1/4 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="h-28 bg-slate-800 rounded-xl" />
          <div className="h-28 bg-slate-800 rounded-xl" />
          <div className="h-28 bg-slate-800 rounded-xl" />
          <div className="h-28 bg-slate-800 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-64 bg-slate-800 rounded-xl" />
            <div className="h-48 bg-slate-800 rounded-xl" />
          </div>
          <div className="h-96 bg-slate-800 rounded-xl" />
        </div>
      </div>
    )
  }

  const resolvedScams = stats ? `${stats.scamsResolved} ${t('scams')}` : `0 ${t('scams')}`
  const responseTime = stats ? `${(stats.avgResponseTimeMs / 100).toFixed(1)}s` : '3.7s'

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Decorative tricolor top banner */}
      <div className="tricolor-accent-bar" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div dir={isUrdu ? 'rtl' : 'ltr'}>
          <h1 className="text-3xl font-black text-white mb-1">
            {t('welcomeBack', { name: '' })}<span className="gradient-text">{(user?.name ?? '').split(' ')[0] || 'User'}</span>
          </h1>
          <p className="text-slate-400 text-sm">{t('subtitle')}</p>
        </div>
        
        <div className="flex gap-3">
          <Link href="/app/scam-scanner" className="btn-primary flex items-center gap-1.5 animate-pulse">
            <MessageSquareWarning className="w-4 h-4" /> {t('newScamScan')}
          </Link>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex items-center gap-6">
          <SafetyScore score={stats ? stats.safetyScore : 90} size={80} />
          <div dir={isUrdu ? 'rtl' : 'ltr'}>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{t('personalScore')}</p>
            <p className="text-2xl font-black text-white">{stats ? stats.safetyScore : 90}<span className="text-sm font-normal text-slate-500 ml-1">/100</span></p>
          </div>
        </Card>

        <StatCard 
          title={t('activeAlerts')} 
          value={stats ? stats.activeAlerts : 0} 
          icon={<ShieldAlert className="w-6 h-6" />} 
          color="#ef4444" 
        />

        <StatCard 
          title={t('resolvedThisWeek')} 
          value={resolvedScams} 
          icon={<CheckCircle2 className="w-6 h-6" />} 
          change={stats && stats.scamsResolved > 0 ? stats.scamsResolved.toString() : undefined} positive
          color="#10b981" 
        />

        <StatCard 
          title={t('avgResponseTime')} 
          value={responseTime} 
          icon={<Clock className="w-6 h-6" />} 
          color="#06b6d4" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (2/3 width) - Charts */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Main Area Chart */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6" dir={isUrdu ? 'rtl' : 'ltr'}>
              <h3 className="font-bold text-lg flex items-center gap-2 text-white">
                <Activity className="text-cyan-400 w-5 h-5" /> {t('threatDefenseActivity')}
              </h3>
              
              <div className="flex bg-black/40 rounded-xl p-1 border border-white/5 gap-1" dir="ltr">
                {[
                  { id: 'day', label: t('day') },
                  { id: 'week', label: t('week') },
                  { id: 'month', label: t('month') }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setTimeRange(opt.id as any)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      timeRange === opt.id 
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSafe" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorThreats" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0A0E1A', borderColor: '#232B42', borderRadius: '0.75rem', color: '#fff' }}
                    itemStyle={{ fontWeight: 'bold', fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="safe" stroke="#10b981" fillOpacity={1} fill="url(#colorSafe)" strokeWidth={2} name={t('scansAudited')} />
                  <Area type="monotone" dataKey="threats" stroke="#ef4444" fillOpacity={1} fill="url(#colorThreats)" strokeWidth={2} name={t('blockedScams')} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Bar Chart of Threat Categories */}
          <Card className="p-6">
            <h3 className="font-bold text-lg flex items-center gap-2 mb-6 text-white" dir={isUrdu ? 'rtl' : 'ltr'}>
              <Siren className="text-purple-400 w-5 h-5" /> {t('threatCategoryBreakdown')}
            </h3>

            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={threatTypeData} layout="vertical" margin={{ top: 5, right: 10, left: 30, bottom: 5 }}>
                  <XAxis type="number" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0A0E1A', borderColor: '#232B42', borderRadius: '0.75rem', color: '#fff' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={12}>
                    {threatTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Right Column (1/3 width) - Status & Feeds */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Family Status Card */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4" dir={isUrdu ? 'rtl' : 'ltr'}>
              <h3 className="font-bold text-base text-slate-200">{t('familyCircleStatus')}</h3>
              <Link href="/app/family" className="text-cyan-400 text-xs font-bold hover:underline">{t('manage')}</Link>
            </div>
            
            <div className="flex items-center gap-4 mb-4 p-4 rounded-2xl bg-gradient-to-r from-blue-900/20 to-cyan-900/20 border border-blue-500/10" dir={isUrdu ? 'rtl' : 'ltr'}>
              <SafetyScore score={stats ? stats.safetyScore : 90} size={60} />
              <div>
                <p className="text-xs font-bold text-slate-400">{t('familyCircleSafety')}</p>
                <p className={`text-xs font-black mt-1 uppercase ${
                  (stats && stats.safetyScore < 70) ? 'text-red-400' : 'text-emerald-400'
                }`}>
                  {(stats && stats.safetyScore < 70) ? t('highRiskStatus') : t('lowRiskStatus')}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {familyMembers.map(member => (
                <div key={member.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.02] transition-colors" dir={isUrdu ? 'rtl' : 'ltr'}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/5 flex items-center justify-center text-xs font-bold text-slate-300">
                      {member?.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{member.name}</p>
                      <p className="text-[10px] text-slate-500 capitalize">{member.role}</p>
                    </div>
                  </div>
                  <Badge variant={member.riskScore > 50 ? 'danger' : member.riskScore > 20 ? 'warning' : 'safe'}>
                    {member.riskScore}{t('percentRisk')}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Activity Timeline Feed */}
          <Card className="p-5 space-y-4">
            <h3 className="font-bold text-base text-slate-200 flex items-center gap-2" dir={isUrdu ? 'rtl' : 'ltr'}>
              <Activity size={16} className="text-purple-400" /> {t('securityTimeline')}
            </h3>

            <div className="space-y-4 relative pl-4 border-l border-white/10 max-h-[360px] overflow-y-auto pr-2 scrollbar-thin" dir={isUrdu ? 'rtl' : 'ltr'}>
              {compiledTimelineEvents.map(evt => (
                <div key={evt.id} className="relative space-y-1">
                  <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border border-black ${
                    evt.type === 'sos' ? 'bg-red-500' : evt.type === 'alert' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                  
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-black text-white leading-tight">{evt.title}</span>
                    <span className="text-[9px] text-slate-500 whitespace-nowrap">{formatDateTime(evt.timestamp)}</span>
                  </div>
                  
                  <p className="text-[11px] text-slate-400 leading-normal">{evt.desc}</p>
                </div>
              ))}
            </div>
          </Card>

        </div>

      </div>

    </div>
  )
}
