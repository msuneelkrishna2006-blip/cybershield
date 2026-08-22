'use client'

import React, { use, useState, useEffect } from 'react'
import { Card, Badge, RiskScore } from '@/components/ui'
import { formatDateTime } from '@/lib/utils'
import { 
  ArrowLeft, Shield, AlertTriangle, Settings, Users, 
  Smartphone, User, Bell, Trash2, CheckCircle
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useTranslation } from '@/contexts/TranslationContext'

interface PageProps {
  params: Promise<{ memberId: string }>
}

interface UserData {
  id: string
  name: string
  email: string
}

interface FamilyMember {
  id: string
  relation: string
  role: 'guardian' | 'adult' | 'child'
  riskScore: number
  user?: UserData
}

interface Family {
  id: string
  name?: string
  members: FamilyMember[]
}

interface Alert {
  id: string
  memberId: string
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  createdAt: string
}

export default function MemberDetailsPage({ params }: PageProps) {
  const { memberId } = use(params)
  const { t } = useTranslation('family')
  
  const [member, setMember] = useState<FamilyMember | null>(null)
  const [memberAlerts, setMemberAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  // States for interactive settings form
  const [relation, setRelation] = useState('')
  const [role, setRole] = useState<'guardian' | 'adult' | 'child'>('adult')
  const [alertsEnabled, setAlertsEnabled] = useState(true)
  const [screenMonitoring, setScreenMonitoring] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const res = await fetch('/api/v1/family')
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data) {
            let foundMember: FamilyMember | undefined
            for (const family of data.data as Family[]) {
              const m = family.members?.find((mem) => mem.id === memberId)
              if (m) {
                foundMember = m
                break
              }
            }
            if (foundMember) {
              setMember(foundMember)
              setRelation(foundMember.relation)
              setRole(foundMember.role)
              setScreenMonitoring(foundMember.role === 'child')
            }
          }
        }
        
        // Fetch alerts (assuming a standard endpoint for member alerts)
        const alertsRes = await fetch(`/api/v1/alerts?memberId=${memberId}`)
        if (alertsRes.ok) {
          const alertsData = await alertsRes.json()
          if (alertsData.success && alertsData.data) {
            setMemberAlerts(alertsData.data)
          }
        }
      } catch (error) {
        console.error('Error fetching member data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [memberId])

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success(t('settingsSaved'))
  }

  const getRoleBadgeVariant = (mRole: string) => {
    switch (mRole) {
      case 'guardian': return 'info'
      case 'adult': return 'safe'
      case 'child': return 'purple'
      default: return 'info'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-pulse">
        <div className="h-2 bg-slate-800 rounded w-full" />
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-800 rounded-xl" />
          <div>
            <div className="h-8 bg-slate-800 rounded w-48 mb-2" />
            <div className="h-4 bg-slate-800 rounded w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-6">
            <div className="h-80 bg-slate-800 rounded-xl" />
            <div className="h-64 bg-slate-800 rounded-xl" />
          </div>
          <div className="lg:col-span-8 space-y-6">
            <div className="h-96 bg-slate-800 rounded-xl" />
            <div className="h-48 bg-slate-800 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p>{t('memberNotFound', { defaultValue: 'Member not found.' })}</p>
        <Link href="/app/family" className="text-cyan-400 hover:underline mt-4 inline-block">
          {t('backToFamily', { defaultValue: 'Back to Family' })}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-300">
      
      {/* Decorative top gradient */}
      <div className="tricolor-accent-bar" />

      {/* Header with back navigation button */}
      <div className="flex items-center gap-4">
        <Link 
          href="/app/family"
          className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 rounded-xl text-slate-400 hover:text-white transition-all"
          aria-label="Back to Family Circle"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">{t('memberProfile')}</h1>
          <p className="text-sm text-slate-400 mt-1">{t('profileSubtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: profile card and alerts log */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Member Overview Card */}
          <Card className="text-center p-6 space-y-4 flex flex-col items-center">
            <div className="relative">
              <RiskScore score={member.riskScore} size={120} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-white/10 flex items-center justify-center text-white text-3xl font-black">
                  {member.user?.name ? member.user.name.charAt(0) : member.relation.charAt(0)}
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-white">{member.user?.name || member.relation}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{member.user?.email || t('noEmail')}</p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              <Badge variant={getRoleBadgeVariant(member.role)}>
                {member.role.toUpperCase()}
              </Badge>
              <Badge variant={member.riskScore > 50 ? 'danger' : 'safe'}>
                {t('riskPercentage', { count: member.riskScore })}
              </Badge>
            </div>

            <div className="w-full pt-4 border-t border-white/5 grid grid-cols-2 gap-2 text-left">
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('relationshipLabel')}</p>
                <p className="text-sm text-slate-300 font-bold">{member.relation}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('deviceCount')}</p>
                <p className="text-sm text-slate-300 font-bold">{t('devicesCountVal', { count: 2 })}</p>
              </div>
            </div>
          </Card>

          {/* Member Safety Alerts History */}
          <Card className="space-y-4">
            <h3 className="font-extrabold text-white text-lg flex items-center gap-2">
              <Bell className="text-cyan-400 w-5 h-5" /> {t('recentAlerts')}
            </h3>
            
            <div className="space-y-3">
              {memberAlerts.length > 0 ? (
                memberAlerts.map(alert => (
                  <div key={alert.id} className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white text-xs truncate max-w-[150px]">{alert.title}</span>
                      <Badge variant={alert.severity === 'critical' ? 'danger' : 'warning'} className="scale-75 origin-right">
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{alert.description}</p>
                    <p className="text-[9px] text-slate-500">{formatDateTime(alert.createdAt)}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 text-center py-4">{t('noRecentAlerts')}</p>
              )}
            </div>
          </Card>

        </div>

        {/* Right column: settings form and device control */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Settings Form */}
          <Card className="p-6">
            <h3 className="font-extrabold text-white text-lg flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
              <Settings className="text-purple-400 w-5 h-5" /> {t('profilePermissions')}
            </h3>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Relationship tag */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('relationshipInputLabel')}</label>
                  <input 
                    type="text" 
                    value={relation} 
                    onChange={(e) => setRelation(e.target.value)}
                    className="input" 
                    placeholder={t('relationshipInputPlaceholder')}
                    required
                  />
                </div>

                {/* Role dropdown */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('systemRole')}</label>
                  <select 
                    value={role} 
                    onChange={(e) => setRole(e.target.value as any)}
                    className="input bg-black/80"
                  >
                    <option value="guardian">{t('roleGuardianDesc')}</option>
                    <option value="adult">{t('roleAdultDesc')}</option>
                    <option value="child">{t('roleChildDesc')}</option>
                  </select>
                </div>

              </div>

              {/* Toggle Switches */}
              <div className="space-y-4 border-t border-white/5 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{t('enableNotifications')}</p>
                    <p className="text-xs text-slate-500">{t('enableNotificationsDesc')}</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setAlertsEnabled(!alertsEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${alertsEnabled ? 'bg-purple-500' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${alertsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{t('deviceSecurityScanning')}</p>
                    <p className="text-xs text-slate-500">{t('deviceSecurityScanningDesc')}</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setScreenMonitoring(!screenMonitoring)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${screenMonitoring ? 'bg-purple-500' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${screenMonitoring ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              {/* Form Action buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <button 
                  type="button"
                  onClick={() => toast.error(t('adminCredentialsRequired'))}
                  className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-bold transition-colors"
                >
                  <Trash2 size={14} /> {t('removeMember')}
                </button>

                <button type="submit" className="btn-primary flex items-center gap-1 py-2 text-xs">
                  <CheckCircle size={14} /> {t('savePermissions')}
                </button>
              </div>

            </form>
          </Card>

          {/* Devices List */}
          <Card className="space-y-4">
            <h3 className="font-extrabold text-white text-lg flex items-center gap-2">
              <Smartphone className="text-cyan-400 w-5 h-5" /> {t('connectedDevices')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="text-slate-400 w-6 h-6" />
                  <div>
                    <p className="text-sm font-bold text-white">Samsung Galaxy S23</p>
                    <p className="text-[10px] text-slate-500">Android 14 · App version 2.4.1</p>
                  </div>
                </div>
                <Badge variant="safe">{t('active', { defaultValue: 'Active' })}</Badge>
              </div>

              <div className="p-4 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="text-slate-400 w-6 h-6" />
                  <div>
                    <p className="text-sm font-bold text-white">Apple iPad Air</p>
                    <p className="text-[10px] text-slate-500">iOS 17 · App version 2.4.0</p>
                  </div>
                </div>
                <Badge variant="safe">{t('active', { defaultValue: 'Active' })}</Badge>
              </div>
            </div>
          </Card>

        </div>

      </div>

    </div>
  )
}
