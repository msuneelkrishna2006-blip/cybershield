'use client'

import React, { useEffect, useState } from 'react'
import { Card, Badge, Spinner } from '@/components/ui'
import { Mail, CheckCircle2, AlertCircle, Phone, Calendar, User, ShieldAlert } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface SupportTicket {
  id: string
  name: string
  contact_info: string
  category: string
  message: string
  status: string
  created_at: string
}

export default function SupportTicketsAdminPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchTickets = async () => {
    try {
      // Endpoint /api/support/tickets was deleted. Using placeholder or /api/v1/admin/stats.
      // For now we just return empty array as per instructions "shows 'Support system coming soon'"
      setTickets([])
      toast('Support system coming soon', { icon: 'ℹ️' })
    } catch (err) {
      toast.error('Failed to fetch tickets')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [])

  const handleToggleStatus = async (ticketId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'open' ? 'resolved' : 'open'
    try {
      toast.error('Support system coming soon - status cannot be modified')
    } catch (err) {
      toast.error('Status modification failed')
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* Decorative tricolor top banner */}
      <div className="tricolor-accent-bar" />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-purple-400" />
          Support Ticket Hub
        </h1>
        <p className="text-sm text-slate-400 mt-1">Review contact form submissions, categorize scam reports, and resolve issues.</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Spinner size={32} className="text-cyan-500 mb-3 animate-spin" />
          <span>Fetching support tickets...</span>
        </div>
      ) : tickets.length === 0 ? (
        <Card className="p-12 text-center text-slate-400 border border-white/5 bg-white/[0.01]">
          <Mail className="mx-auto w-12 h-12 text-slate-600 mb-4" />
          <h4 className="font-extrabold text-white text-lg mb-1">No Tickets Found</h4>
          <p className="text-xs max-w-sm mx-auto">All in-app contact form submissions will appear here. No submissions currently recorded.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {tickets.map(ticket => (
            <Card 
              key={ticket.id} 
              className={`p-6 border transition-all ${
                ticket.status === 'open' 
                  ? 'border-purple-500/20 bg-purple-950/[0.02]' 
                  : 'border-white/5 bg-white/[0.01]'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 text-sm ${
                    ticket.category === 'scam' 
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                      : ticket.category === 'account'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                  }`}>
                    {ticket?.name?.charAt(0) || 'T'}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                      {ticket.name}
                      <Badge variant={ticket.category === 'scam' ? 'danger' : ticket.category === 'account' ? 'info' : 'purple'}>
                        {ticket.category === 'scam' ? 'Scam Report' : ticket.category === 'account' ? 'Account Help' : 'General'}
                      </Badge>
                    </h4>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <Phone size={12} /> {ticket.contact_info}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:self-center">
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(ticket.created_at).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  
                  <button 
                    onClick={() => handleToggleStatus(ticket.id, ticket.status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                      ticket.status === 'open'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                        : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20'
                    }`}
                  >
                    {ticket.status === 'open' ? (
                      <>
                        <CheckCircle2 size={12} /> Resolve
                      </>
                    ) : (
                      <>
                        <AlertCircle size={12} /> Reopen
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap pl-1 mt-2">
                {ticket.message}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
