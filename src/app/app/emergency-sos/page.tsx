'use client'

import React, { useState, useEffect } from 'react'
import { Card, Badge } from '@/components/ui'
import { useTranslation } from '@/contexts/TranslationContext'
import {
  Siren, Phone, MapPin, Users, Plus, Trash2,
  ShieldCheck, AlertTriangle, Clock
} from 'lucide-react'

interface EmergencyContact {
  id: string
  name: string
  phone: string
  relationship: string | null
  priority: number
}

interface Helpline {
  name: string
  number: string
  description: string
  category: string
}

export default function EmergencySOSPage() {
  const { t } = useTranslation('emergency')
  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [helplines, setHelplines] = useState<Helpline[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sosTriggered, setSosTriggered] = useState(false)
  const [sosResult, setSosResult] = useState<{ eventId?: string; message?: string } | null>(null)
  const [newContact, setNewContact] = useState({ name: '', phone: '', relationship: '' })
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const [contactsRes, helplinesRes] = await Promise.all([
          fetch('/api/v1/emergency/contacts'),
          fetch('/api/v1/emergency/helplines'),
        ])

        if (contactsRes.ok) {
          const data = await contactsRes.json()
          if (data.success) setContacts(data.data.contacts || [])
        }

        if (helplinesRes.ok) {
          const data = await helplinesRes.json()
          if (data.success) setHelplines(data.data.helplines || [])
        }
      } catch (e) {
        console.error('Failed to load emergency data:', e)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  async function triggerSOS() {
    setSosTriggered(true)
    try {
      const res = await fetch('/api/v1/emergency/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationStatus: 'MANUAL_TRIGGER' }),
      })
      const data = await res.json()
      if (data.success) {
        setSosResult({ eventId: data.data.eventId, message: 'SOS triggered. Emergency services notified.' })
      } else {
        setSosResult({ message: data.error?.message || 'SOS trigger failed' })
      }
    } catch {
      setSosResult({ message: 'Network error. Call 112 directly.' })
    }
  }

  async function addContact() {
    if (!newContact.name || !newContact.phone) return
    try {
      const res = await fetch('/api/v1/emergency/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact),
      })
      const data = await res.json()
      if (data.success) {
        setContacts(prev => [...prev, data.data.contact])
        setNewContact({ name: '', phone: '', relationship: '' })
        setShowAddForm(false)
      }
    } catch (e) {
      console.error('Failed to add contact:', e)
    }
  }

  async function deleteContact(id: string) {
    try {
      const res = await fetch(`/api/v1/emergency/contacts?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setContacts(prev => prev.filter(c => c.id !== id))
      }
    } catch (e) {
      console.error('Failed to delete contact:', e)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto animate-pulse">
        <div className="h-32 bg-red-900/20 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-800 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in duration-300">
      <div className="tricolor-accent-bar" />

      <div>
        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <Siren className="text-red-400" /> Emergency SOS
        </h1>
        <p className="text-sm text-slate-400 mt-1">Quick access to emergency services and your trusted contacts.</p>
      </div>

      {/* SOS Button */}
      <Card className="relative overflow-hidden border-red-500/30">
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/50 to-transparent" />
        <div className="relative p-8 text-center space-y-4">
          {!sosTriggered ? (
            <>
              <p className="text-slate-300 text-sm font-semibold">Press and hold to trigger Emergency SOS</p>
              <button
                onClick={triggerSOS}
                className="mx-auto w-32 h-32 rounded-full bg-red-600 hover:bg-red-500 active:bg-red-700 transition-all shadow-lg shadow-red-900/50 flex items-center justify-center group"
              >
                <Siren className="w-12 h-12 text-white group-hover:scale-110 transition-transform" />
              </button>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                This will notify your emergency contacts and log the event
              </p>
            </>
          ) : (
            <div className="space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
                <Siren className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-red-400 font-black text-lg">
                {sosResult?.message || 'Triggering SOS...'}
              </p>
              {sosResult?.eventId && (
                <p className="text-xs text-slate-500">Event ID: {sosResult.eventId}</p>
              )}
              <button
                onClick={() => { setSosTriggered(false); setSosResult(null) }}
                className="text-sm text-slate-400 hover:text-white underline"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Quick Dial Helplines */}
      <div>
        <h2 className="text-lg font-extrabold text-white mb-3 flex items-center gap-2">
          <Phone className="w-5 h-5 text-emerald-400" /> Emergency Helplines
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {helplines.map((helpline, i) => (
            <a
              key={i}
              href={`tel:${helpline.number}`}
              className="block p-4 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{helpline.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{helpline.description}</p>
                </div>
                <span className="text-lg font-black text-emerald-400 font-mono">{helpline.number}</span>
              </div>
            </a>
          ))}
        </div>
        <p className="text-[10px] text-slate-600 mt-2 text-center">
          CyberShield is NOT affiliated with any government organization. These are publicly available helpline numbers.
        </p>
      </div>

      {/* Emergency Contacts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" /> Your Emergency Contacts
          </h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-sm bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1"
          >
            <Plus size={14} /> Add Contact
          </button>
        </div>

        {showAddForm && (
          <Card className="mb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Name"
                value={newContact.name}
                onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))}
                className="input py-2 text-sm bg-black/40"
              />
              <input
                type="tel"
                placeholder="+91 Phone"
                value={newContact.phone}
                onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))}
                className="input py-2 text-sm bg-black/40"
              />
              <input
                type="text"
                placeholder="Relationship"
                value={newContact.relationship}
                onChange={e => setNewContact(p => ({ ...p, relationship: e.target.value }))}
                className="input py-2 text-sm bg-black/40"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAddForm(false)} className="text-xs text-slate-400 hover:text-white px-3 py-1.5">Cancel</button>
              <button onClick={addContact} className="btn-primary text-xs px-4 py-1.5">Save</button>
            </div>
          </Card>
        )}

        <div className="space-y-2">
          {contacts.length > 0 ? contacts.map(contact => (
            <div key={contact.id} className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">{contact.name}</p>
                <p className="text-xs text-slate-400">{contact.phone} {contact.relationship ? `• ${contact.relationship}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <a href={`tel:${contact.phone}`} className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
                  <Phone size={16} />
                </a>
                <button onClick={() => deleteContact(contact.id)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )) : (
            <div className="py-8 text-center text-slate-500">
              <Users className="mx-auto w-8 h-8 mb-2 text-slate-600" />
              <p className="text-sm">No emergency contacts added yet.</p>
              <p className="text-xs mt-1">Add trusted contacts who will be notified during SOS.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
