'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, Spinner } from '@/components/ui'
import { Shield, Check, X, ShieldAlert, Cpu } from 'lucide-react'
import toast from 'react-hot-toast'

interface InviteDetails {
  id: string
  status: string
  label?: string
  createdAt: string
  user: {
    id: string
    name: string
    email: string
  }
}

export default function InviteAcceptancePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [isLoading, setIsLoading] = useState(true)
  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (!token) return

    const fetchInvite = async () => {
      try {
        const res = await fetch(`/api/guardian/invite/${token}`)
        const data = await res.json()
        if (res.ok && data.success) {
          setInvite(data.invite)
        } else {
          setError(data.error || 'Invitation link is invalid or has expired.')
        }
      } catch (err) {
        setError('Connection error loading invitation.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchInvite()
  }, [token])

  const handleAction = async (action: 'accept' | 'decline') => {
    setIsProcessing(true)
    try {
      const res = await fetch(`/api/guardian/invite/${token}/${action}`, {
        method: 'POST',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || `Invitation ${action}ed successfully!`)
        setTimeout(() => {
          router.push('/app/ai-guardian')
        }, 1500)
      } else {
        toast.error(data.error || `Failed to ${action} invitation`)
      }
    } catch (err) {
      toast.error('Connection error processing request')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background neon blobs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#1E3A5F]/20 rounded-full blur-3xl pointer-events-none" />

      {/* Cyber grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <Cpu className="w-7 h-7 text-cyan-400 animate-pulse" />
          <span className="text-xl font-black text-white font-display uppercase tracking-tight">CyberShield 2.0</span>
        </div>

        <Card className="p-8 bg-gradient-to-b from-[#131A2C]/90 to-[#0A0E1A]/95 border-cyan-500/20 text-center shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Spinner size={32} />
              <p className="text-sm text-slate-400">Verifying invitation token...</p>
            </div>
          ) : error ? (
            <div className="py-6 space-y-4">
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-red-500">
                <ShieldAlert size={32} />
              </div>
              <h2 className="text-lg font-bold text-white font-display">Invitation Error</h2>
              <p className="text-sm text-slate-400">{error}</p>
              <button
                onClick={() => router.push('/app')}
                className="mt-4 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Go to Dashboard
              </button>
            </div>
          ) : invite ? (
            <div className="space-y-6">
              <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/30 rounded-full flex items-center justify-center mx-auto text-cyan-400">
                <Shield size={32} className="animate-pulse" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white font-display">Guardian Invitation</h2>
                <p className="text-sm text-slate-300">
                  <span className="font-bold text-white">{invite.user.name}</span> has invited you to be their trusted Guardian.
                </p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  As a guardian, you will receive real-time notifications and GPS maps if they trigger an SOS or fail to respond to safety checks.
                </p>
              </div>

              {invite.label && (
                <div className="bg-slate-900/50 border border-white/5 rounded-xl px-4 py-2 text-xs text-slate-400 font-mono inline-block">
                  Relationship Label: {invite.label}
                </div>
              )}

              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={() => handleAction('decline')}
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-slate-950 border border-red-500/30 text-red-400 hover:bg-red-950/20 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <X size={16} />
                  Decline
                </button>
                <button
                  onClick={() => handleAction('accept')}
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-600 text-black font-black font-display rounded-xl text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check size={16} />
                  Accept
                </button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  )
}
