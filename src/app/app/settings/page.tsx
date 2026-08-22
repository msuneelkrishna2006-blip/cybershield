'use client'

import React, { useState, useEffect } from 'react'
import { Card, Badge, Spinner } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from '@/contexts/TranslationContext'
import { 
  User, Bell, Shield, Globe, Users, Smartphone, 
  Key, Save, CheckCircle, Settings
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { user } = useAuth()
  const { t, language, setLanguage, languages } = useTranslation('settings')
  const [activeSection, setActiveSection] = useState<'profile' | 'notifications' | 'privacy' | 'family' | 'contacts'>('profile')
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)

  // Form states
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  
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

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate email
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
        body: JSON.stringify({ name, email, phone })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
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
          {[
            { id: 'profile', label: t('accountProfile'), icon: User },
            { id: 'notifications', label: t('notifications'), icon: Bell },
            { id: 'privacy', label: t('privacyData'), icon: Shield },
            { id: 'family', label: t('familySettings'), icon: Users },
            { id: 'contacts', label: t('emergencySosContacts'), icon: Key },
          ].map(section => {
            const Icon = section.icon
            const isActive = activeSection === section.id
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as any)}
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
                        onChange={(e) => setPhone(e.target.value)}
                        className="input bg-black/40" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('interfaceLanguage')}</label>
                      <select 
                        value={language} 
                        onChange={(e) => setLanguage(e.target.value as any)}
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

    </div>
  )
}
