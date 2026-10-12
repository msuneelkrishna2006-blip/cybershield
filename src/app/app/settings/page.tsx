'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { Language } from '@/types'
import { Card, Badge, Spinner } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from '@/contexts/TranslationContext'
import { 
  User, Bell, Shield, Globe, Users, Smartphone, 
  Key, Save, CheckCircle, Settings
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useStepUpFetch } from '@/hooks/useStepUpFetch'

export default function SettingsPage() {
  const { fetchWithStepUp, stepUpModal } = useStepUpFetch()
  const { user } = useAuth()
  const { t, language, setLanguage, languages } = useTranslation('settings')
  const [activeSection, setActiveSection] = useState<'profile' | 'notifications' | 'privacy' | 'family' | 'contacts' | 'security'>('profile')
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)

  // Form states
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [phoneOtpSent, setPhoneOtpSent] = useState(false)
  const [phoneOtp, setPhoneOtp] = useState('')
  const [phoneOtpLoading, setPhoneOtpLoading] = useState(false)
  const [mfaCurrentPassword, setMfaCurrentPassword] = useState('')
  const [mfaConfirmCode, setMfaConfirmCode] = useState('')
  const [mfaEnrollment, setMfaEnrollment] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [securityPassword, setSecurityPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [sessions, setSessions] = useState<Array<{ id: string; ipAddress: string | null; userAgent: string | null; lastActiveAt: string; isCurrent: boolean }>>([])
  const [securityLoading, setSecurityLoading] = useState(false)
  const [accountDeleteLoading, setAccountDeleteLoading] = useState(false)
  
  // Notification states
  const [notifScam, setNotifScam] = useState(true)
  const [notifChild, setNotifChild] = useState(true)
  const [notifSOS, setNotifSOS] = useState(true)

  // Contacts states
  const [contacts, setContacts] = useState([
    { name: 'Priya Sharma', relation: 'Spouse', phone: '+919876543211', notifySOS: true },
    { name: 'Rajesh Sharma', relation: 'Father', phone: '+919876543212', notifySOS: true }
  ])

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/v1/profile')
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            setName(data.data.user.name || '')
            setEmail(data.data.user.email || '')
            setPhone(data.data.user.phone || '')
            setPhoneVerified(Boolean(data.data.user.phoneVerifiedAt))
            setMfaEnabled(Boolean(data.data.user.mfaEnabled))
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoadingProfile(false)
      }
    }
    fetchProfile()
  }, [])

  const normalizedPhone = () => {
    const digits = phone.replace(/\D/g, '')
    return digits.length === 12 && digits.startsWith('91') ? `+${digits}` : digits.length === 10 ? `+91${digits}` : ''
  }

  const handleRequestPhoneVerification = async () => {
    const normalized = normalizedPhone()
    if (!normalized) {
      toast.error(t('invalidPhone'))
      return
    }
    setPhoneOtpLoading(true)
    try {
      const response = await fetch('/api/v1/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: normalized, purpose: 'verify_phone' }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Unable to request verification code.')
      }
      setPhoneOtpSent(true)
      toast.success(result.data?.message || 'If this number is eligible, a verification code will be sent.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to request verification code.')
    } finally {
      setPhoneOtpLoading(false)
    }
  }

  const handleVerifyPhone = async () => {
    const normalized = normalizedPhone()
    if (!normalized || !/^\d{6}$/.test(phoneOtp)) {
      toast.error('Enter the 6-digit verification code.')
      return
    }

    setPhoneOtpLoading(true)
    try {
      const response = await fetch('/api/v1/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: normalized, code: phoneOtp, purpose: 'verify_phone' }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Phone verification failed.')
      }
      setPhoneVerified(true)
      setPhoneOtpSent(false)
      setPhoneOtp('')
      toast.success('Phone number verified.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Phone verification failed.')
    } finally {
      setPhoneOtpLoading(false)
    }
  }

  const loadSessions = async () => {
    const response = await fetch('/api/v1/auth/sessions', { credentials: 'include' })
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(result.error?.message || 'Unable to load sessions.')
    setSessions(result.data.sessions)
  }

  const handleMfaEnroll = async () => {
    setSecurityLoading(true)
    try {
      const response = await fetch('/api/v1/auth/mfa/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword: mfaCurrentPassword }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error?.message || 'Unable to start MFA enrollment.')
      setMfaEnrollment({ secret: result.data.secret, qrCodeDataUrl: result.data.qrCodeDataUrl })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to start MFA enrollment.')
    } finally {
      setSecurityLoading(false)
    }
  }

  const handleMfaConfirm = async () => {
    setSecurityLoading(true)
    try {
      const response = await fetchWithStepUp('/api/v1/auth/mfa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: mfaConfirmCode }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error?.message || 'Unable to confirm MFA.')
      setRecoveryCodes(result.data.recoveryCodes)
      setMfaEnabled(true)
      setMfaEnrollment(null)
      setMfaConfirmCode('')
      toast.success('Multi-factor authentication enabled. Save your recovery codes.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to confirm MFA.')
    } finally {
      setSecurityLoading(false)
    }
  }

  const handleMfaDisable = async () => {
    setSecurityLoading(true)
    try {
      const response = await fetchWithStepUp('/api/v1/auth/mfa/disable', { method: 'POST', credentials: 'include' })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error?.message || 'Unable to disable MFA.')
      setMfaEnabled(false)
      setSecurityPassword('')
      setRecoveryCodes([])
      toast.success('Multi-factor authentication disabled.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to disable MFA.')
    } finally {
      setSecurityLoading(false)
    }
  }

  const handleChangePassword = async () => {
    setSecurityLoading(true)
    try {
      const response = await fetchWithStepUp('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword: securityPassword, newPassword }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error?.message || 'Unable to change password.')
      setSecurityPassword('')
      setNewPassword('')
      toast.success(result.data.message)
      await loadSessions()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to change password.')
    } finally {
      setSecurityLoading(false)
    }
  }

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/v1/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error?.message || 'Unable to revoke session.')
      await loadSessions()
      toast.success(result.data.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to revoke session.')
    }
  }

  const handleLogoutAll = async () => {
    try {
      const response = await fetch('/api/v1/auth/sessions/logout-all', {
        method: 'POST',
        credentials: 'include',
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error?.message || 'Unable to log out all devices.')
      toast.success(result.data.message)
      window.location.assign('/login')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to log out all devices.')
    }
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm('Delete your CyberShield account and associated account data? This cannot be undone.')) return
    setAccountDeleteLoading(true)
    try {
      const response = await fetchWithStepUp('/api/v1/auth/account', {
        method: 'DELETE',
        credentials: 'include',
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error?.message || 'Unable to delete account.')
      window.location.assign('/login')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete account.')
    } finally {
      setAccountDeleteLoading(false)
    }
  }

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault()

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error(t('invalidEmail'))
      return
    }

    // Validate phone number: must be +91 followed by 10 digits
    const phoneRegex = /^\+91\d{10}$/
    if (!phoneRegex.test(phone)) {
      toast.error(t('invalidPhone'))
      return
    }

    try {
      const res = await fetch('/api/v1/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setPhoneVerified(Boolean(data.data.user.phoneVerifiedAt))
          toast.success(t('profileSaved'))
        } else {
          toast.error(data.error || t('profileSaveFailed'))
        }
      }
    } catch (err) {
      console.error(err)
      toast.error(t('profileSaveFailed'))
    }
  }

  const handleNotifSave = () => {
    toast.success(t('preferencesUpdated'))
  }

  const handleAddContact = () => {
    toast.success(t('contactAdded'))
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-300">
      
      {/* Decorative tricolor top banner */}
      <div className="tricolor-accent-bar" />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <Settings className="w-8 h-8 text-slate-400" />
          {t('title')}
        </h1>
        <p className="text-sm text-slate-400 mt-1">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* Left Sidebar Sections List */}
        <div className="md:col-span-3 space-y-1">
          {([
            { id: 'profile', label: t('accountProfile'), icon: User },
            { id: 'notifications', label: t('notifications'), icon: Bell },
            { id: 'privacy', label: t('privacyData'), icon: Shield },
            { id: 'family', label: t('familySettings'), icon: Users },
            { id: 'contacts', label: t('emergencySosContacts'), icon: Key },
            { id: 'security', label: 'Security', icon: Shield },
          ] as const).map(section => {
            const Icon = section.icon
            const isActive = activeSection === section.id
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-bold transition-all border cursor-pointer ${
                  isActive 
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_15px_rgba(139,92,246,0.05)]' 
                    : 'bg-white/5 text-slate-400 border-transparent hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={18} />
                <span>{section.label}</span>
              </button>
            )
          })}
        </div>

        {/* Right Section Content Drawer */}
        <div className="md:col-span-9">
          
          {activeSection === 'profile' && (
            <Card className="p-6">
              <h3 className="text-lg font-black text-white flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                <User className="text-purple-400 w-5 h-5" /> {t('accountProfile')}
              </h3>
              
              {isLoadingProfile ? (
                <div className="py-8 text-center"><Spinner size={24} className="text-purple-500" /></div>
              ) : (
                <form onSubmit={handleProfileSave} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('fullName')}</label>
                      <input 
                        type="text" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)}
                        className="input bg-black/40" 
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('emailAddress')}</label>
                      <input 
                        type="email" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)}
                        className="input bg-black/40" 
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('phoneNumber')}</label>
                      <input 
                        type="text" 
                        value={phone} 
                        onChange={(e) => {
                          setPhone(e.target.value)
                          setPhoneVerified(false)
                          setPhoneOtpSent(false)
                          setPhoneOtp('')
                        }}
                        className="input bg-black/40" 
                      />
                      <p className={`text-xs ${phoneVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {phoneVerified ? 'Phone number verified' : 'Phone number not verified'}
                      </p>
                      {!phoneVerified && (
                        <div className="flex flex-wrap gap-2">
                          {!phoneOtpSent ? (
                            <button
                              type="button"
                              onClick={handleRequestPhoneVerification}
                              disabled={phoneOtpLoading}
                              className="btn-primary py-2 px-3 text-xs"
                            >
                              {phoneOtpLoading ? 'Sending…' : 'Send verification code'}
                            </button>
                          ) : (
                            <>
                              <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={6}
                                value={phoneOtp}
                                onChange={event => setPhoneOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="6-digit code"
                                className="input bg-black/40 max-w-40"
                              />
                              <button
                                type="button"
                                onClick={handleVerifyPhone}
                                disabled={phoneOtpLoading || phoneOtp.length !== 6}
                                className="btn-primary py-2 px-3 text-xs"
                              >
                                {phoneOtpLoading ? 'Verifying…' : 'Verify phone'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('interfaceLanguage')}</label>
                      <select 
                        value={language} 
                        onChange={(e) => setLanguage(e.target.value as Language)}
                        className="input bg-black/40 cursor-pointer"
                      >
                        {languages.map((lang) => (
                          <option key={lang.code} value={lang.code}>
                            {lang.nativeName} ({lang.code.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5 flex justify-end">
                    <button type="submit" className="btn-primary py-2 text-xs flex items-center gap-1 cursor-pointer">
                      <Save size={14} /> {t('saveProfile')}
                    </button>
                  </div>
                </form>
              )}
            </Card>
          )}

          {activeSection === 'security' && (
            <Card className="p-6 space-y-8">
              <section className="space-y-4">
                <h3 className="text-lg font-black text-white">Multi-factor authentication</h3>
                <p className="text-sm text-slate-400">
                  {mfaEnabled ? 'MFA is enabled for this account.' : 'Protect your account with an authenticator app.'}
                </p>
                {!mfaEnabled && !mfaEnrollment && (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={mfaCurrentPassword}
                      onChange={event => setMfaCurrentPassword(event.target.value)}
                      className="input"
                      placeholder="Re-enter current password"
                    />
                    <button type="button" disabled={securityLoading || !mfaCurrentPassword} onClick={handleMfaEnroll} className="btn-primary px-4">
                      Start setup
                    </button>
                  </div>
                )}
                {mfaEnrollment && (
                  <div className="space-y-3">
                    <Image src={mfaEnrollment.qrCodeDataUrl} alt="Authenticator setup QR code" width={176} height={176} unoptimized className="bg-white p-2 rounded" />
                    <p className="text-xs text-slate-300 break-all">Manual key: {mfaEnrollment.secret}</p>
                    <input
                      value={mfaConfirmCode}
                      onChange={event => setMfaConfirmCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className="input"
                      placeholder="Enter 6-digit authenticator code"
                    />
                    <button type="button" disabled={securityLoading || mfaConfirmCode.length !== 6} onClick={handleMfaConfirm} className="btn-primary px-4">
                      Confirm and enable
                    </button>
                  </div>
                )}
                {mfaEnabled && (
                  <div className="flex gap-2">
                    <button type="button" disabled={securityLoading} onClick={handleMfaDisable} className="btn-primary px-4">
                      Disable MFA
                    </button>
                  </div>
                )}
                {recoveryCodes.length > 0 && (
                  <div className="rounded border border-amber-500/30 p-4">
                    <p className="mb-2 text-sm text-amber-300">Save these recovery codes now. They are shown only once.</p>
                    <ul className="grid grid-cols-2 gap-2 font-mono text-sm text-white">
                      {recoveryCodes.map(code => <li key={code}>{code}</li>)}
                    </ul>
                    <button type="button" onClick={() => setRecoveryCodes([])} className="mt-3 text-xs text-cyan-400">I saved these codes</button>
                  </div>
                )}
              </section>
              <section className="space-y-3 border-t border-white/10 pt-5">
                <h3 className="text-lg font-black text-white">Change password</h3>
                <input
                  type="password"
                  value={securityPassword}
                  onChange={event => setSecurityPassword(event.target.value)}
                  className="input"
                  placeholder="Current password"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={event => setNewPassword(event.target.value)}
                  minLength={12}
                  maxLength={128}
                  className="input"
                  placeholder="New password (12–128 characters)"
                />
                <button type="button" disabled={securityLoading || !securityPassword || newPassword.length < 12} onClick={handleChangePassword} className="btn-primary px-4">
                  Change password
                </button>
              </section>
              <section className="space-y-3 border-t border-white/10 pt-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-white">Active sessions</h3>
                  <button
                    type="button"
                    onClick={() => void loadSessions().catch(error => toast.error(error instanceof Error ? error.message : 'Unable to load sessions.'))}
                    className="text-sm text-cyan-400 hover:underline"
                  >
                    Refresh
                  </button>
                </div>
                {sessions.map(session => (
                  <div key={session.id} className="flex items-center justify-between gap-3 rounded bg-white/5 p-3">
                    <div className="min-w-0 text-xs text-slate-300">
                      <p className="truncate">{session.userAgent || 'Unknown device'} {session.isCurrent ? '(This device)' : ''}</p>
                      <p>{session.ipAddress || 'Unknown IP'} · {new Date(session.lastActiveAt).toLocaleString()}</p>
                    </div>
                    <button type="button" onClick={() => void handleRevokeSession(session.id)} className="shrink-0 text-xs text-red-400 hover:underline">Revoke</button>
                  </div>
                ))}
                <button type="button" onClick={() => void handleLogoutAll()} className="rounded border border-red-500/30 px-4 py-2 text-sm text-red-300">
                  Log out all devices
                </button>
              </section>
              <section className="space-y-3 border-t border-red-500/20 pt-5">
                <h3 className="text-lg font-black text-red-300">Delete account</h3>
                <p className="text-sm text-slate-400">Permanently delete your account and associated data.</p>
                <button
                  type="button"
                  disabled={accountDeleteLoading}
                  onClick={() => void handleDeleteAccount()}
                  className="rounded border border-red-500/40 px-4 py-2 text-sm text-red-300"
                >
                  Delete account
                </button>
              </section>
            </Card>
          )}

          {activeSection === 'notifications' && (
            <Card className="p-6 space-y-6">
              <h3 className="text-lg font-black text-white flex items-center gap-2 border-b border-white/5 pb-4">
                <Bell className="text-cyan-400 w-5 h-5" /> {t('notificationPreferences')}
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{t('scamDetectionAlerts')}</p>
                    <p className="text-xs text-slate-500">{t('scamDetectionDesc')}</p>
                  </div>
                  <button 
                    onClick={() => setNotifScam(!notifScam)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${notifScam ? 'bg-purple-500' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifScam ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{t('childScreenTime')}</p>
                    <p className="text-xs text-slate-500">{t('childScreenTimeDesc')}</p>
                  </div>
                  <button 
                    onClick={() => setNotifChild(!notifChild)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${notifChild ? 'bg-purple-500' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifChild ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{t('emergencySosBroadcasts')}</p>
                    <p className="text-xs text-slate-500">{t('emergencySosBroadcastsDesc')}</p>
                  </div>
                  <button 
                    onClick={() => setNotifSOS(!notifSOS)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${notifSOS ? 'bg-purple-500' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifSOS ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 flex justify-end">
                <button onClick={handleNotifSave} className="btn-primary py-2 text-xs flex items-center gap-1 cursor-pointer">
                  <CheckCircle size={14} /> {t('updatePreferences')}
                </button>
              </div>
            </Card>
          )}

          {activeSection === 'privacy' && (
            <Card className="p-6 space-y-6">
              <h3 className="text-lg font-black text-white flex items-center gap-2 border-b border-white/5 pb-4">
                <Shield className="text-emerald-400 w-5 h-5" /> {t('privacyDataVault')}
              </h3>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <h4 className="font-bold text-white text-sm">{t('privacyByDesign')}</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {t('privacyDesc')}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div>
                    <p className="text-sm font-bold text-white">{t('exportDataArchive')}</p>
                    <p className="text-xs text-slate-500">{t('exportDataDesc')}</p>
                  </div>
                  <button 
                    onClick={() => toast.success(t('dataExported'))}
                    className="btn-secondary py-2 text-xs cursor-pointer border border-white/10"
                  >
                    {t('exportData')}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <div>
                    <p className="text-sm font-bold text-white">{t('clearScanHistory')}</p>
                    <p className="text-xs text-slate-500">{t('clearScanHistoryDesc')}</p>
                  </div>
                  <button 
                    onClick={() => toast.error(t('masterCredentials'))}
                    className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                  >
                    {t('deleteHistory')}
                  </button>
                </div>
              </div>
            </Card>
          )}

          {activeSection === 'family' && (
            <Card className="p-6 space-y-6">
              <h3 className="text-lg font-black text-white flex items-center gap-2 border-b border-white/5 pb-4">
                <Users className="text-blue-400 w-5 h-5" /> {t('familyPermissions')}
              </h3>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white text-sm">{t('childrenDashboardView')}</span>
                    <Badge variant="purple">{t('tweenTeenActive')}</Badge>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {t('childrenDashboardDesc')}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{t('allowAdultInvite')}</p>
                    <p className="text-xs text-slate-500">{t('allowAdultInviteDesc')}</p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-purple-500 cursor-pointer">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6 animate-pulse" />
                  </button>
                </div>
              </div>
            </Card>
          )}

          {activeSection === 'contacts' && (
            <Card className="p-6 space-y-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Key className="text-red-400 w-5 h-5" /> {t('emergencySosContacts')}
                </h3>
                <button onClick={handleAddContact} className="btn-primary py-1.5 px-3 text-[11px] font-bold cursor-pointer">
                  {t('addContact')}
                </button>
              </div>

              <div className="space-y-3">
                {contacts.map((contact, i) => (
                  <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-white text-sm">{contact.name}</p>
                      <p className="text-xs text-slate-400">{contact.relation} · {contact.phone}</p>
                    </div>
                    <Badge variant="danger">{t('notifiesViaSms')}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

        </div>

      </div>

      {stepUpModal}
    </div>
  )
}
