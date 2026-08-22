'use client'

import React, { useState, useEffect } from 'react'
import { Card, Badge, Spinner } from '@/components/ui'
import { useTranslation } from '@/contexts/TranslationContext'
import { 
  Shield, Heart, Baby, PhoneCall, Clock, 
  Search, Camera, Phone, CheckCircle2, 
  Building, Siren 
} from 'lucide-react'

const helplines = [
  {
    id: "cyber-crime",
    icon: "Shield",
    emoji: "🚨",
    accent: "blue" as const,
    title: "Cyber Crime Helpline",
    badge: "24/7",
    description: "Report online fraud, scams, UPI fraud, phishing & cybercrime",
    call: { label: "Call 1930", href: "tel:1930" },
    secondary: { label: "How to Report", href: "https://cybercrime.gov.in" },
  },
  {
    id: "women-safety",
    icon: "Heart",
    emoji: "👩",
    accent: "rose" as const,
    title: "Women Safety Helpline",
    badge: "24/7",
    description: "Women emergency & safety support, harassment, stalking",
    call: { label: "Call 1091", href: "tel:1091" },
    secondary: { label: "How to Report", href: "https://cybercrime.gov.in" },
  },
  {
    id: "child-helpline",
    icon: "Baby",
    emoji: "🧒",
    accent: "teal" as const,
    title: "Child Helpline",
    badge: "24/7",
    description: "Child abuse, online grooming, exploitation, POCSO cases",
    call: { label: "Call 1098", href: "tel:1098" },
  },
  {
    id: "police",
    icon: "PhoneCall",
    emoji: "👮",
    accent: "amber" as const,
    title: "Police Emergency",
    badge: "24/7",
    description: "National emergency number for immediate police assistance",
    call: { label: "Call 112", href: "tel:112" },
  },
]

const complaintSteps = [
  { number: 1, icon: "Search", title: "Identify the Issue", description: "Determine the type: Scam / Cyber Crime / Child Safety / Women Safety / Online Harassment" },
  { number: 2, icon: "Camera", title: "Collect Evidence", description: "Take screenshots of messages, save URLs, note phone numbers, record transaction IDs" },
  { number: 3, icon: "Phone", title: "Call 1930 or Visit Portal", description: "Call the Cyber Crime Helpline at 1930 OR file an online complaint at cybercrime.gov.in" },
  { number: 4, icon: "CheckCircle2", title: "Track Your Complaint", description: "Save your complaint reference number. Track status on the cybercrime portal dashboard" },
]

const ACCENTS = {
  blue: {
    badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    button: 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.25)]',
    outline: 'border border-blue-500/30 text-blue-400 hover:bg-blue-500/10'
  },
  rose: {
    badge: 'bg-pink-500/10 text-pink-400 border border-pink-500/20',
    button: 'bg-pink-600 hover:bg-pink-500 text-white shadow-[0_0_15px_rgba(219,39,119,0.25)]',
    outline: 'border border-pink-500/30 text-pink-400 hover:bg-pink-500/10'
  },
  teal: {
    badge: 'bg-teal-500/10 text-teal-400 border border-teal-500/20',
    button: 'bg-teal-600 hover:bg-teal-500 text-white shadow-[0_0_15px_rgba(13,148,136,0.25)]'
  },
  amber: {
    badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    button: 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_0_15px_rgba(217,119,6,0.25)]'
  }
}

function getIcon(name: string) {
  switch (name) {
    case 'Shield': return Shield
    case 'Heart': return Heart
    case 'Baby': return Baby
    case 'PhoneCall': return PhoneCall
    case 'Search': return Search
    case 'Camera': return Camera
    case 'Phone': return Phone
    case 'CheckCircle2': return CheckCircle2
    default: return Shield
  }
}

export default function EmergencyPage() {
  const { t } = useTranslation('emergencySOS')
  const [sosEvents, setSosEvents] = useState<any[]>([])
  const [dynamicHelplines, setDynamicHelplines] = useState<any[]>(helplines)
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sosRes, helplinesRes, contactsRes] = await Promise.all([
          fetch('/api/v1/emergency/sos'),
          fetch('/api/v1/emergency/helplines'),
          fetch('/api/v1/emergency/contacts')
        ])
        
        if (sosRes.ok) {
          const sosData = await sosRes.json()
          if (sosData.success) {
            setSosEvents(sosData.data.sosEvents || [])
          }
        }
        
        if (helplinesRes.ok) {
          const helplinesData = await helplinesRes.json()
          if (helplinesData.success && helplinesData.data.helplines) {
            setDynamicHelplines(helplinesData.data.helplines)
          }
        }

        if (contactsRes.ok) {
          const contactsData = await contactsRes.json()
          if (contactsData.success) {
            setContacts(contactsData.data.contacts || [])
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleTriggerSos = async () => {
    try {
      const res = await fetch('/api/v1/emergency/sos', {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setSosEvents(prev => [data.data.sosEvent, ...prev])
          alert('SOS triggered successfully!')
        }
      }
    } catch (err) {
      console.error('Failed to trigger SOS', err)
    }
  }

  return (
    <div className="space-y-10 max-w-6xl mx-auto pb-12 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-4">
          <div className="bg-red-600 text-white font-extrabold text-xs px-3 py-1.5 rounded-lg uppercase tracking-wider shadow-[0_0_15px_rgba(239,68,68,0.3)] select-none">
            SOS
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">{t('title')}</h1>
            <p className="text-sm text-slate-400 mt-1">
              {t('subtitle')}
            </p>
          </div>
        </div>
        <button
          onClick={handleTriggerSos}
          className="bg-red-600 hover:bg-red-500 text-white font-black text-sm px-6 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center gap-2 cursor-pointer"
        >
          <Siren className="w-5 h-5 animate-pulse" />
          TRIGGER SOS NOW
        </button>
      </div>

      {/* Helplines Grid */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Siren className="w-5 h-5 text-red-500" />
          Indian Emergency Helplines
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {dynamicHelplines.map((helpline) => {
            const Icon = getIcon(helpline.icon)
            const style = ACCENTS[helpline.accent as keyof typeof ACCENTS] || ACCENTS.blue
            
            return (
              <Card key={helpline.id} className="p-6 relative flex flex-col justify-between border-white/5 bg-black/40 hover:border-white/10 transition-colors">
                
                {/* 24/7 Clock Badge */}
                <div className="absolute top-6 right-6">
                  <Badge variant="danger" className="flex items-center gap-1 bg-red-500/10 border-red-500/20 text-red-400">
                    <Clock className="w-3.5 h-3.5" />
                    {helpline.badge}
                  </Badge>
                </div>

                <div className="space-y-4">
                  {/* Top Block with Badge Icon and Title */}
                  <div className="flex items-center gap-3.5">
                    <div className={`p-3 rounded-2xl ${style.badge}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                      <span>{helpline.emoji}</span>
                      <span>{helpline.title}</span>
                    </h3>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-400 leading-relaxed pr-12">
                    {helpline.description}
                  </p>
                </div>

                {/* Actions Button Block */}
                <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-4 border-t border-white/5">
                  <a
                    href={helpline.call.href}
                    className={`flex-1 font-extrabold text-sm py-3 px-4 rounded-xl text-center transition-all ${style.button}`}
                    aria-label={`Call ${helpline.title} at ${helpline.call.label.split(' ')[1]}`}
                  >
                    {helpline.call.label}
                  </a>
                  {'secondary' in helpline && helpline.secondary && (
                    <a
                      href={helpline.secondary.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex-1 font-bold text-sm py-3 px-4 rounded-xl text-center transition-all border border-white/10 text-white hover:bg-white/5`}
                      aria-label={`How to Report on ${helpline.title} portal`}
                    >
                      {helpline.secondary.label}
                    </a>
                  )}
                </div>

              </Card>
            )
          })}
        </div>
      </section>

      {/* SOS Events Log */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Siren className="w-5 h-5 text-red-500" />
          Active SOS & Emergency Log
        </h2>
        <Card className="p-0 overflow-hidden">
          <div className="p-4 bg-white/5 border-b border-white/10">
            <h3 className="text-sm font-bold text-slate-300">Recent SOS Activities</h3>
          </div>
          <div className="divide-y divide-white/5">
            {loading ? (
              <div className="p-8 text-center"><Spinner size={20} className="text-red-500" /></div>
            ) : sosEvents.length > 0 ? (
              sosEvents.map((event) => (
                <div key={event.id} className="p-4 flex justify-between items-center text-sm">
                  <div>
                    <p className="text-white font-bold">Emergency Signal Sent</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Coordinates: {event.lat ? `${event.lat.toFixed(5)}, ${event.lng.toFixed(5)}` : 'GPS Offline'}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={event.location_status === 'active' ? 'danger' : 'warning'}>
                      {event.location_status === 'active' ? 'GPS Broadcasting' : 'GPS Offline'}
                    </Badge>
                    <p className="text-[10px] text-slate-500 mt-1">SMS Contacts: {event.sms_status}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs">No emergency alerts have been triggered recently.</div>
            )}
          </div>
        </Card>
      </section>

      {/* How to File a Complaint Steps */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Search className="w-5 h-5 text-cyan-400" />
          How to File a Complaint
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {complaintSteps.map((step, i) => {
            const Icon = getIcon(step.icon)
            const leftBorder = i % 2 === 0 ? 'border-l-pink-500/50' : 'border-l-cyan-500/50'
            
            return (
              <Card key={step.number} className={`p-6 border border-white/5 border-l-4 ${leftBorder} bg-black/40 hover:border-white/10 transition-colors`}>
                <div className="space-y-4">
                  {/* Step Number Badge */}
                  <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-sm font-black text-cyan-400 shadow-sm">
                    {step.number}
                  </div>
                  
                  {/* Title and Description */}
                  <div className="space-y-2">
                    <h3 className="font-extrabold text-white flex items-center gap-2 text-sm leading-snug">
                      <Icon className="w-4 h-4 shrink-0 text-slate-400" />
                      {step.title}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Need Immediate Help Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-2xl bg-red-500/5 border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.05)]">
        <div className="space-y-1">
          <h3 className="text-lg font-black text-red-400">Need Immediate Help?</h3>
          <p className="text-sm text-slate-300">Don't wait — call the helpline or file a complaint now.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <a 
            href="tel:1930"
            className="bg-red-600 hover:bg-red-500 text-white font-extrabold px-6 py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(239,68,68,0.25)] text-center text-sm uppercase tracking-wider w-full sm:w-auto"
            aria-label="Call Cyber Crime Helpline 1930"
          >
            Call 1930
          </a>
          <a 
            href="https://cybercrime.gov.in" 
            target="_blank" 
            rel="noopener noreferrer"
            className="border border-red-500/30 hover:border-red-500/50 text-red-400 hover:bg-red-500/10 font-bold px-6 py-3 rounded-xl transition-all text-center text-sm w-full sm:w-auto"
            aria-label="File Online Complaint at cybercrime.gov.in"
          >
            File Online Complaint
          </a>
        </div>
      </div>

      {/* Footer Disclaimer */}
      <footer className="flex items-center justify-center gap-2 py-4 border-t border-white/5 text-center text-xs text-slate-500 select-none">
        <Building className="w-4 h-4 shrink-0 text-slate-500" />
        <span>
          All helpline numbers listed are <strong>Government of India official helplines</strong>. No personal data is stored without your consent. CyberShield is a privacy-first platform.
        </span>
      </footer>

    </div>
  )
}
