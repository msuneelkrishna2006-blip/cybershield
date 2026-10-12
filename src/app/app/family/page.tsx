'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, Badge, RiskScore, StatCard, Spinner } from '@/components/ui'
import { Users, Shield, AlertTriangle, Plus, ShieldCheck, Mail, Smartphone, X } from 'lucide-react'
import { calculateFamilyRiskScore } from '@/lib/risk-scoring'
import { useTranslation } from '@/contexts/TranslationContext'
import { useStepUpFetch } from '@/hooks/useStepUpFetch'
import toast from 'react-hot-toast'

export default function FamilyManagementPage() {
  const { fetchWithStepUp, stepUpModal } = useStepUpFetch()
  const { t } = useTranslation('family')
  const [members, setMembers] = useState<any[]>([])
  const [alertsCount, setAlertsCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Invite Modal States
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'adult' | 'child' | 'elderly'>('adult')
  const [inviteRelation, setInviteRelation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadFamily = async () => {
    try {
      const res = await fetch('/api/v1/family')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data && data.data.families) {
          const allMembers = data.data.families.flatMap((f: any) => f.members)
          setMembers(allMembers)
          setAlertsCount(data.data.alertsCount || 0)
        }
      }
    } catch (e) {
      console.error('Failed to load family circle:', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadFamily()
  }, [])

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteName.trim() || !inviteEmail.trim() || !inviteRelation.trim()) {
      toast.error(t('fillAllFields'))
      return
    }

    setIsSubmitting(inviteName.trim() !== '')
    try {
      const res = await fetchWithStepUp('/api/v1/family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inviteName,
          email: inviteEmail,
          role: inviteRole,
          relation: inviteRelation
        })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          toast.success(t('inviteSent', { name: inviteName }))
          setIsInviteOpen(false)
          setInviteName('')
          setInviteEmail('')
          setInviteRelation('')
          loadFamily()
        } else {
          toast.error(data.error || t('inviteFailed'))
        }
      } else {
        const data = await res.json()
        toast.error(data.error?.message || t('inviteFailed'))
      }
    } catch (err) {
      console.error(err)
      toast.error(t('inviteFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Spinner size={32} className="text-cyan-500" />
      </div>
    )
  }

  const memberRiskScores = members.map(m => m.riskScore || 0)
  const familyRisk = calculateFamilyRiskScore(memberRiskScores)
  const childrenCount = members.filter(m => m.role === 'child').length

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-cyan-400" />
            {t('title')}
          </h1>
          <p className="text-slate-400 mt-1">{t('subtitle')}</p>
        </div>
        <button 
          onClick={() => setIsInviteOpen(true)}
          className="btn-primary flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          {t('inviteMember')}
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          title={t('overallFamilyRisk')}
          value={`${familyRisk}/100`}
          icon={<Shield className="w-6 h-6 text-emerald-400" />}
          color="emerald"
        />
        <StatCard 
          title={t('activeAlerts')}
          value={alertsCount.toString()}
          icon={<AlertTriangle className="w-6 h-6 text-red-400" />}
          color="red"
          positive={alertsCount === 0}
        />
        <StatCard 
          title={t('protectedChildren')}
          value={childrenCount.toString()}
          icon={<Users className="w-6 h-6 text-purple-400" />}
          color="purple"
        />
      </div>

      {/* Family Members List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white mt-8 mb-4">{t('yourCircle')}</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {members.map(member => (
            <Card key={member.id} className="p-6 flex flex-col sm:flex-row items-center gap-6" hover>
              <div className="shrink-0">
                <RiskScore score={member.riskScore || 0} size={80} />
              </div>
              
              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold text-white">
                    {member.user?.name || member.relation}
                  </h3>
                  <Badge variant={
                    member.role === 'guardian' ? 'purple' :
                    member.role === 'child' ? 'info' : 'safe'
                  }>
                    {member.role.toUpperCase()}
                  </Badge>
                </div>
                
                <p className="text-slate-400 text-sm mb-3">
                  {member.relation} {member.ageTier ? `· ${member.ageTier}` : ''}
                </p>
                
                <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                  <Badge variant="safe" className="flex items-center gap-1 opacity-80">
                    <ShieldCheck className="w-3 h-3" /> {t('protected')}
                  </Badge>
                  {member.role === 'adult' && (
                    <Badge variant="info" className="flex items-center gap-1 opacity-80 bg-blue-500/20 text-blue-300">
                      <Smartphone className="w-3 h-3" /> {t('devices', { count: 2 })}
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="shrink-0 w-full sm:w-auto flex flex-row sm:flex-col gap-2 mt-4 sm:mt-0">
                <Link 
                  href={`/app/family/${member.id}`} 
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white py-2 px-4 rounded-xl text-sm text-center transition-colors border border-white/10 font-bold"
                >
                  {t('settingsBtn')}
                </Link>
                <Link 
                  href={
                    member.role === 'child' 
                      ? `/app/child-safety` 
                      : `/app/family/${member.id}`
                  } 
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white py-2 px-4 rounded-xl text-sm text-center transition-colors border border-white/10 font-bold"
                >
                  {t('activity')}
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Invite Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 relative border border-white/10">
            <button 
              onClick={() => setIsInviteOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={20} />
            </button>
            
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="text-cyan-400" /> {t('inviteTitle')}
            </h3>
            
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{t('fullName')}</label>
                <input 
                  type="text" 
                  value={inviteName} 
                  onChange={e => setInviteName(e.target.value)} 
                  placeholder={t('namePlaceholder')} 
                  className="input py-2 text-sm bg-black/40"
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{t('emailAddress')}</label>
                <input 
                  type="email" 
                  value={inviteEmail} 
                  onChange={e => setInviteEmail(e.target.value)} 
                  placeholder={t('emailPlaceholder')} 
                  className="input py-2 text-sm bg-black/40"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{t('role')}</label>
                  <select 
                    value={inviteRole} 
                    onChange={e => setInviteRole(e.target.value as any)} 
                    className="input py-2 text-sm bg-black/40"
                  >
                    <option value="adult">{t('roleAdult')}</option>
                    <option value="child">{t('roleChild')}</option>
                    <option value="elderly">{t('roleElderly')}</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{t('relation')}</label>
                  <input 
                    type="text" 
                    value={inviteRelation} 
                    onChange={e => setInviteRelation(e.target.value)} 
                    placeholder={t('relationPlaceholder')} 
                    className="input py-2 text-sm bg-black/40"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsInviteOpen(false)}
                  className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer border border-white/10 font-bold"
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="btn-primary px-6 py-2 text-sm flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? <Spinner size={14} className="text-black" /> : t('sendInvite')}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
      {stepUpModal}
    </div>
  )
}
