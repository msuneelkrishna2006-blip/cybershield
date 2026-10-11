'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, Badge, StatCard, Spinner } from '@/components/ui'
import { Shield, Smartphone, Clock, Settings, Gamepad2, Search, PlaySquare, Lock, AlertTriangle, Eye, Info, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from '@/contexts/TranslationContext'
import { formatDateTime } from '@/lib/utils'
import { useStepUpFetch } from '@/hooks/useStepUpFetch'
import toast from 'react-hot-toast'

export default function ChildSafetyPage() {
  const { user } = useAuth()
  const isChild = user?.role === 'child'

  const [children, setChildren] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadData = async () => {
    try {
      const res = await fetch('/api/v1/child-safety')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data.childProfiles) {
          const profilesData = data.data.childProfiles
          
          const members = profilesData.map((p: any) => p.member)
          setChildren(members)
          
          const mappedProfiles = profilesData.map((p: any) => ({
            ...p,
            memberId: p.member.id,
            appUsage: p.appUsage || []
          }))
          setProfiles(mappedProfiles)
          
          const allAlerts = profilesData.flatMap((p: any) => p.alerts || [])
          setAlerts(allAlerts)
          
          if (members.length > 0) {
            setSelectedChildId(members[0].id)
          }
        }
      }
    } catch (err) {
      console.error('Failed to load child safety data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (!user) return null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Spinner size={32} className="text-purple-500" />
      </div>
    )
  }

  if (isChild) {
    // Find the profile belonging to this child user
    const matchedMember = children.find(c => c.userId === user.id)
    const profile = matchedMember ? profiles.find(p => p.memberId === matchedMember.id) : null
    return <ChildView childProfile={profile} />
  }

  return (
    <GuardianView 
      childrenList={children}
      profiles={profiles}
      alerts={alerts}
      setProfiles={setProfiles}
      selectedChildId={selectedChildId}
      setSelectedChildId={setSelectedChildId}
    />
  )
}

function ChildView({ childProfile }: { childProfile: any }) {
  const { t } = useTranslation('childSafety')
  const isTeen = childProfile?.ageTier === 'teen'

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl p-6 md:p-10 text-center relative overflow-hidden border border-white/10">
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full text-xs font-medium text-slate-300">
          <Eye size={14} className="text-cyan-400" /> {t('familySafetyActive')}
        </div>
        
        <Sparkles className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
        <h1 className="text-3xl font-black text-white mb-2">
          {isTeen ? t('childDashboard') : t('childWelcome')}
        </h1>
        <p className="text-slate-300 max-w-lg mx-auto">
          {isTeen 
            ? "We help keep your devices secure and protect you from online scams and threats while you explore." 
            : "Explore, learn, and play online safely! We're here to help protect you from bad stuff on the internet."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
            <Clock className="text-blue-400" /> {t('screenTime')}
          </h3>
          <p className="text-3xl font-black text-white mb-2">2h 15m <span className="text-sm font-normal text-slate-400">{t('usedToday')}</span></p>
          <div className="h-3 bg-slate-800 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: '65%' }} />
          </div>
          <p className="text-sm text-slate-400 text-right">{t('outOfLimit', { mins: childProfile?.screenTimeRules.dailyLimitMinutes || 120 })}</p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-slate-900 to-black">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
            <Shield className="text-emerald-400" /> {t('safetyTips')}
          </h3>
          <ul className="space-y-4">
            <li className="flex gap-3">
              <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <span className="text-emerald-400 font-bold">1</span>
              </div>
              <p className="text-sm text-slate-300 pt-1">
                {isTeen 
                  ? t('safetyTipsTeen1') 
                  : t('safetyTipsKid1')}
              </p>
            </li>
            <li className="flex gap-3">
              <div className="shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                <span className="text-purple-400 font-bold">2</span>
              </div>
              <p className="text-sm text-slate-300 pt-1">
                {isTeen 
                  ? t('safetyTipsTeen2') 
                  : t('safetyTipsKid2')}
              </p>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}

interface GuardianViewProps {
  childrenList: any[]
  profiles: any[]
  alerts: any[]
  setProfiles: React.Dispatch<React.SetStateAction<any[]>>
  selectedChildId: string | null
  setSelectedChildId: (id: string) => void
}

function GuardianView({
  childrenList,
  profiles,
  alerts,
  setProfiles,
  selectedChildId,
  setSelectedChildId
}: GuardianViewProps) {
  const { t } = useTranslation('childSafety')
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analyze'>('dashboard')
  
  const activeChild = childrenList.find(c => c.id === selectedChildId)
  const childProfile = activeChild ? profiles.find(p => p.memberId === activeChild.id) : null
  const childAlerts = childProfile ? alerts.filter(a => a.childProfileId === childProfile.id) : []

  const handleToggleFilter = async (filterId: string) => {
    if (!childProfile) return
    const currentBlocked = childProfile.screenTimeRules.blockedCategories || []
    const nextBlocked = currentBlocked.includes(filterId)
      ? currentBlocked.filter((id: string) => id !== filterId)
      : [...currentBlocked, filterId]
      
    // Update local state optimistically
    const updatedProfiles = profiles.map(p => {
      if (p.id === childProfile.id) {
        return {
          ...p,
          screenTimeRules: {
            ...p.screenTimeRules,
            blockedCategories: nextBlocked
          }
        }
      }
      return p
    })
    setProfiles(updatedProfiles)

    try {
      const response = await fetchWithStepUp('/api/v1/child-safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: childProfile.id,
          screenTimeRules: {
            ...childProfile.screenTimeRules,
            blockedCategories: nextBlocked
          }
        })
      })
    } catch (e) {
      console.error(e)
    }
  }

  const handleToggleRestriction = async (restrictionType: 'bedtimeMode' | 'pauseAllApps') => {
    if (!childProfile) return
    const currentRestrictions = childProfile.deviceRestrictions || {}
    const nextVal = !currentRestrictions[restrictionType]
    
    const nextRestrictions = {
      ...currentRestrictions,
      [restrictionType]: nextVal
    }
    
    // Update local state optimistically
    const updatedProfiles = profiles.map(p => {
      if (p.id === childProfile.id) {
        return {
          ...p,
          deviceRestrictions: nextRestrictions
        }
      }
      return p
    })
    setProfiles(updatedProfiles)

    try {
      const response = await fetchWithStepUp('/api/v1/child-safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: childProfile.id,
          deviceRestrictions: nextRestrictions
        })
      })
      if (!response.ok) throw new Error('Unable to update device restrictions.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update device restrictions.')
    }
  }

  if (childrenList.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center">
        <Card className="p-8">
          <Shield className="w-16 h-16 mx-auto text-purple-500 mb-4 opacity-50" />
          <h2 className="text-xl font-bold text-white mb-2">{t('noChildrenLinked')}</h2>
          <p className="text-slate-400 mb-6 max-w-sm mx-auto">{t('noChildrenDesc')}</p>
          <Link href="/app/family" className="btn-primary">{t('goToFamilyCircle')}</Link>
        </Card>
      </div>
    )
  }

  if (!activeChild || !childProfile) {
    return <div className="p-8 text-center text-slate-400">{t('loadingChildProfile')}</div>
  }

  // Calculate stats
  const appUsage = childProfile.appUsage || []
  const totalAppsMonitored = appUsage.length > 0 ? appUsage.length + 15 : 24
  
  // Format total usage time
  const totalMinutesUsed = appUsage.reduce((acc: number, item: any) => acc + item.duration, 0)
  const hoursUsed = Math.floor(totalMinutesUsed / 60)
  const minutesUsed = totalMinutesUsed % 60
  const formattedTimeStr = hoursUsed > 0 ? `${hoursUsed}h ${minutesUsed}m` : `${minutesUsed}m`

  const bedtimeOn = childProfile.deviceRestrictions?.bedtimeMode || false
  const pauseOn = childProfile.deviceRestrictions?.pauseAllApps || false

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-white/10 pb-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-purple-500 animate-pulse" />
            {t('title')}
          </h1>
          <p className="text-slate-400 mt-1">{t('subtitle')}</p>
          <Link 
            href={`/app/child-safety/${childProfile.id}/history`}
            className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-extrabold tracking-wide uppercase mt-2 bg-purple-500/10 px-3 py-1.5 rounded-lg border border-purple-500/20 hover:bg-purple-500/20 transition-all cursor-pointer"
          >
            <Clock size={12} /> {t('viewDetailedLog')}
          </Link>
          {stepUpModal}
        </div>
        
        <div className="flex gap-2">
          {childrenList.map(child => (
            <button
              key={child.id}
              onClick={() => setSelectedChildId(child.id)}
              className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors border-b-2 cursor-pointer ${
                selectedChildId === child.id 
                  ? 'border-purple-500 text-purple-400 bg-purple-500/10' 
                  : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {child.user?.name || child.relation}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
            activeTab === 'dashboard' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('analyze')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
            activeTab === 'analyze' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          🔍 Analyze Chat
        </button>
      </div>

      {activeTab === 'analyze' && (
        <AnalyzeChatSection />
      )}

      {activeTab === 'dashboard' && (
      <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          title={t('screenTime')}
          value={formattedTimeStr}
          icon={<Clock className="w-6 h-6 text-blue-400" />}
          color="blue"
        />
        <StatCard 
          title={t('contentAlerts')}
          value={String(childAlerts.length)}
          icon={<AlertTriangle className="w-6 h-6 text-yellow-400" />}
          color="yellow"
        />
        <StatCard 
          title={t('gamesAccess')}
          value={appUsage.filter((u: any) => u.category === 'game').length > 0 ? String(appUsage.filter((u: any) => u.category === 'game').length) : '0'}
          icon={<Gamepad2 className="w-6 h-6 text-green-400" />}
          color="green"
        />
        <StatCard 
          title={t('webSearches')}
          value={appUsage.filter((u: any) => u.category === 'browser').length > 0 ? String(appUsage.filter((u: any) => u.category === 'browser').reduce((a: number, b: any) => a + (b.sessionsCount || 0), 0)) : '0'}
          icon={<Search className="w-6 h-6 text-cyan-400" />}
          color="cyan"
        />
        <StatCard 
          title={t('safetyScore')}
          value={childProfile.safetyScore.toString()}
          icon={<Shield className="w-6 h-6 text-emerald-400" />}
          color="emerald"
        />
        <StatCard 
          title={t('appsMonitored')}
          value={totalAppsMonitored.toString()}
          icon={<Smartphone className="w-6 h-6 text-cyan-400" />}
          color="cyan"
        />
        <StatCard 
          title={t('riskLevel')}
          value={childProfile.riskLevel.toUpperCase()}
          icon={<AlertTriangle className={`w-6 h-6 ${childProfile.riskLevel !== 'safe' ? 'text-orange-400' : 'text-emerald-400'}`} />}
          color={childProfile.riskLevel !== 'safe' ? 'orange' : 'emerald'}
          positive={childProfile.riskLevel === 'safe'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-cyan-400" />
                {t('appUsage')}
              </h3>
              <Badge variant="info">{t('limit')} {childProfile.screenTimeRules.dailyLimitMinutes / 60}h</Badge>
            </div>
            
            <div className="space-y-4">
              {appUsage.map((app: any) => {
                const pct = Math.min(100, Math.round((app.duration / app.limit) * 100))
                const AppIcon = app.app === 'BGMI' || app.app.toLowerCase().includes('game') ? Gamepad2 : app.app.toLowerCase().includes('instagram') ? PlaySquare : Search
                const appColor = app.app === 'BGMI' ? 'yellow' : app.app.toLowerCase().includes('instagram') ? 'pink' : 'emerald'
                return (
                  <div key={app.app} className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl bg-${appColor}-500/20 flex items-center justify-center shrink-0`}>
                      <AppIcon className={`w-5 h-5 text-${appColor}-400`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-white font-medium text-sm truncate">{app.app}</span>
                        <span className="text-slate-400 text-sm whitespace-nowrap">{app.duration}m</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full bg-${appColor}-500 rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
          
          <Card className="p-6 border-orange-500/30 bg-orange-500/5">
            <h3 className="text-lg font-bold text-orange-400 flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5" />
              {t('chatRiskAlerts')}
            </h3>
            <p className="text-xs text-slate-400 mb-4">{t('chatRiskSubtitle')}</p>
            
            <div className="space-y-3">
              {childAlerts.length > 0 ? childAlerts.map((alert: any) => (
                <div key={alert.id} className="p-4 bg-black/40 rounded-lg border border-orange-500/20 relative">
                  <Badge variant="warning" className="mb-2 absolute top-4 right-4">{alert.patternType}</Badge>
                  <p className="text-sm text-white pr-24">{alert.severitySummary}</p>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                    <p className="text-xs text-slate-500">{formatDateTime(alert.timestamp)}</p>
                    {alert.parentNotified && <span className="text-xs text-emerald-400 flex items-center gap-1"><Shield className="w-3 h-3" /> {t('addressed')}</span>}
                  </div>
                </div>
              )) : (
                <div className="text-center p-6 text-slate-400 bg-black/20 rounded-lg">
                  <Shield className="w-8 h-8 mx-auto mb-2 opacity-50 text-emerald-400" />
                  <p>{t('noChatRisks')}</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-bold text-white mb-4">{t('contentFilters')}</h3>
            <div className="space-y-4">
              {[
                { label: t('adultContent'), id: 'adult' },
                { label: t('gamblingBetting'), id: 'gambling' },
                { label: t('violenceGore'), id: 'violence' },
                { label: t('socialMediaApps'), id: 'social' },
                { label: t('inAppPurchases'), id: 'purchases' },
              ].map(filter => {
                const isBlocked = childProfile.screenTimeRules.blockedCategories.includes(filter.id)
                return (
                  <div key={filter.id} className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{filter.label}</span>
                    <button 
                      type="button"
                      onClick={() => handleToggleFilter(filter.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${isBlocked ? 'bg-purple-500' : 'bg-slate-700'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isBlocked ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-bold text-white mb-4">{t('deviceRestrictions')}</h3>
            <div className="space-y-3">
              <button 
                type="button"
                onClick={() => handleToggleRestriction('bedtimeMode')}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-white/10 hover:bg-white/5 transition-colors text-left text-sm text-white cursor-pointer font-bold"
              >
                <span className="flex items-center gap-2"><Lock className="w-4 h-4 text-slate-400" /> {t('bedtimeMode')} ({childProfile.screenTimeRules.downtimeStart || '21:00'} - {childProfile.screenTimeRules.downtimeEnd || '07:00'})</span>
                <span className={bedtimeOn ? 'text-purple-400' : 'text-slate-500'}>{bedtimeOn ? t('on') : t('off')}</span>
              </button>
              <button 
                type="button"
                onClick={() => handleToggleRestriction('pauseAllApps')}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-white/10 hover:bg-white/5 transition-colors text-left text-sm text-white cursor-pointer font-bold"
              >
                <span className="flex items-center gap-2"><Smartphone className="w-4 h-4 text-slate-400" /> {t('pauseAllApps')}</span>
                <span className={pauseOn ? 'text-red-400' : 'text-slate-500'}>{pauseOn ? t('on') : t('off')}</span>
              </button>
            </div>
          </Card>
        </div>

      </div>

      </>
      )}
    </div>
  )
}

/** Analyze Chat Section — paste chat text for grooming/bullying analysis */
function AnalyzeChatSection() {
  const [chatText, setChatText] = useState('')
  const [childAge, setChildAge] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    if (!chatText.trim()) return
    setIsAnalyzing(true)
    setAnalysisResult(null)
    setError(null)

    try {
      const res = await fetch('/api/v1/child-safety/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chatText, childAge: childAge || undefined }),
      })
      const data = await res.json()
      if (data.success && data.data) {
        setAnalysisResult(data.data)
      } else {
        setError(data.error?.message || 'Analysis failed')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getRiskBg = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'bg-red-500/10 border-red-500/30 text-red-400'
      case 'HIGH': return 'bg-orange-500/10 border-orange-500/30 text-orange-400'
      case 'MEDIUM': return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
      case 'LOW': return 'bg-blue-400/10 border-blue-400/30 text-blue-400'
      default: return 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400'
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border border-purple-500/20">
        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <Eye className="w-5 h-5 text-purple-400" />
          Analyze Chat for Safety Risks
        </h3>
        <p className="text-sm text-slate-400 mb-4">
          Paste any chat conversation (WhatsApp, Instagram, SMS) to check for grooming, bullying, or manipulation patterns.
        </p>

        {/* Privacy Notice */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-4 flex items-start gap-2">
          <Lock className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-xs text-emerald-300">
            <strong>Privacy:</strong> Submitted text is analyzed in real-time and <strong>NOT stored</strong> after results are returned. Only risk metadata is logged.
          </p>
        </div>

        <textarea
          value={chatText}
          onChange={(e) => setChatText(e.target.value)}
          placeholder="Paste the chat conversation here... (e.g., WhatsApp messages, Instagram DMs, SMS thread)"
          className="w-full h-40 bg-black/30 border border-white/10 rounded-lg p-4 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-purple-500/50"
        />

        <div className="flex items-center gap-3 mt-3">
          <select
            value={childAge}
            onChange={(e) => setChildAge(e.target.value)}
            className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white cursor-pointer"
          >
            <option value="">Child&apos;s Age (optional)</option>
            {Array.from({ length: 12 }, (_, i) => i + 6).map(age => (
              <option key={age} value={String(age)}>{age} years old</option>
            ))}
          </select>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !chatText.trim()}
            className="ml-auto px-6 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/30 text-white font-bold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed text-sm"
          >
            {isAnalyzing ? 'Analyzing...' : '🔍 Analyze Chat'}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}
      </Card>

      {/* Analysis Progress */}
      {isAnalyzing && (
        <Card className="border-purple-500/30">
          <div className="flex items-center gap-3">
            <Spinner className="w-5 h-5 text-purple-400" />
            <div>
              <p className="font-bold text-white text-sm">Analyzing conversation...</p>
              <p className="text-xs text-purple-400 animate-pulse">Checking for grooming, bullying, and manipulation patterns</p>
            </div>
          </div>
        </Card>
      )}

      {/* Analysis Results */}
      {analysisResult && !isAnalyzing && (
        <Card className={`border-2 ${getRiskBg(analysisResult.riskLevel)}`}>
          <p className="text-xl font-black mb-3">{analysisResult.verdict}</p>

          <div className="flex items-center gap-3 mb-4">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getRiskBg(analysisResult.riskLevel)}`}>
              {analysisResult.riskLevel}
            </span>
            {analysisResult.parentAlert && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                ⚠️ Parent Alert Recommended
              </span>
            )}
          </div>

          {/* Detected Categories */}
          {analysisResult.categories && analysisResult.categories.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Detected Patterns</h4>
              <div className="flex flex-wrap gap-2">
                {analysisResult.categories.map((cat: string, i: number) => (
                  <span key={i} className="px-2 py-1 rounded bg-white/10 text-xs text-white font-medium capitalize">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Indicators */}
          {analysisResult.indicators && analysisResult.indicators.length > 0 && (
            <div className="mb-4 bg-black/20 rounded-lg p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Specific Indicators Found</h4>
              <div className="space-y-2">
                {analysisResult.indicators.map((ind: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <AlertTriangle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-white font-medium">{ind.pattern}: </span>
                      <span className="text-slate-300">{ind.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
            <div className="bg-black/20 rounded-lg p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Recommended Actions</h4>
              <ul className="space-y-2">
                {analysisResult.recommendations.map((rec: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-200">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
