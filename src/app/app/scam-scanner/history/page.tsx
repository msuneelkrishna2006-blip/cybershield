'use client'

import { useTranslation } from '@/contexts/TranslationContext'
import React, { useState, useEffect } from 'react'
import { Card, Badge, RiskScore } from '@/components/ui'
import { formatDateTime } from '@/lib/utils'
import { 
  MessageSquareWarning, Link as LinkIcon, QrCode, Image as ImageIcon, 
  ChevronDown, ChevronUp, ShieldCheck, AlertTriangle, ArrowLeft 
} from 'lucide-react'
import Link from 'next/link'

interface AgentResult {
  agentName: string
  agentIcon: string
  riskScore: number
  explanation: string
}

interface ScanRecord {
  id: string
  type: 'sms' | 'link' | 'qr' | 'screenshot' | string
  riskScore: number
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'safe'
  category: string
  summary: string
  createdAt: string
  input?: string
  recommendations: string[]
  agentResults?: AgentResult[]
}

interface ScansResponse {
  success: boolean
  data?: {
    scans: ScanRecord[]
    hasMore: boolean
    cursor: string | null
  }
}

export default function ScanHistoryPage() {
  const { t } = useTranslation('scamScanner')
  const [expandedScan, setExpandedScan] = useState<string | null>(null)
  
  const [scans, setScans] = useState<ScanRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchScans() {
      try {
        setLoading(true)
        const res = await fetch('/api/v1/scans')
        if (res.ok) {
          const data: ScansResponse = await res.json()
          if (data.success && data.data) {
            setScans(data.data.scans)
          }
        }
      } catch (error) {
        console.error('Error fetching scan history:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchScans()
  }, [])

  const getScanIcon = (type: string) => {
    switch (type) {
      case 'sms': return MessageSquareWarning
      case 'link': return LinkIcon
      case 'qr': return QrCode
      case 'screenshot': return ImageIcon
      default: return MessageSquareWarning
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedScan(expandedScan === id ? null : id)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in duration-300">
      
      {/* Top Banner accent */}
      <div className="tricolor-accent-bar" />

      {/* Header with back navigation button */}
      <div className="flex items-center gap-4">
        <Link 
          href="/app/scam-scanner"
          className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 rounded-xl text-slate-400 hover:text-white transition-all"
          aria-label="Back to Scam Scanner"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">{t('scanHistory')}</h1>
          <p className="text-sm text-slate-400 mt-1">{t('scanHistorySubtitle')}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-0 border-white/5 overflow-hidden animate-pulse">
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-slate-800 rounded-2xl shrink-0" />
                  <div>
                    <div className="w-48 h-4 bg-slate-800 rounded mb-2" />
                    <div className="w-24 h-3 bg-slate-800 rounded" />
                  </div>
                </div>
                <div className="w-16 h-6 bg-slate-800 rounded-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {scans.length > 0 ? scans.map((scan) => {
            const Icon = getScanIcon(scan.type)
            const isExpanded = expandedScan === scan.id
            const isCritical = scan.riskLevel === 'critical' || scan.riskLevel === 'high'

            return (
              <Card 
                key={scan.id}
                className="p-0 border-white/5 overflow-hidden transition-all duration-300"
              >
                {/* Header segment of card (always visible) */}
                <div 
                  onClick={() => toggleExpand(scan.id)}
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`p-3 rounded-2xl shrink-0 ${isCritical ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-extrabold text-white text-sm md:text-base truncate max-w-[280px] md:max-w-md">
                        {scan.input || scan.summary || 'Scan Record'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDateTime(scan.createdAt)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="hidden sm:flex items-center gap-2">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('riskIndex')}</p>
                      <Badge variant={scan.riskLevel === 'critical' ? 'danger' : 'safe'}>
                        {scan.riskScore}%
                      </Badge>
                    </div>
                    {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                  </div>
                </div>

                {/* Collapsible details drawer */}
                {isExpanded && (
                  <div className="p-6 bg-black/20 border-t border-white/5 space-y-6 animate-in slide-in-from-top-4 duration-200">
                    
                    {/* Synthesis Verdict overview */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                      <div className="md:col-span-3 flex justify-center">
                        <RiskScore score={scan.riskScore} size={90} />
                      </div>
                      <div className="md:col-span-9 space-y-2 text-center md:text-left">
                        <h3 className="text-lg font-black text-white flex items-center justify-center md:justify-start gap-2">
                          {t('verdict')} 
                          <span className={isCritical ? 'text-red-400' : 'text-emerald-400'}>
                            {scan.riskLevel.toUpperCase()}
                          </span>
                        </h3>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          {scan.summary}
                        </p>
                      </div>
                    </div>

                    {/* Recommendations */}
                    {scan.recommendations && scan.recommendations.length > 0 && (
                      <div className="bg-black/30 rounded-xl p-5 border border-white/5">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                          <ShieldCheck size={14} className="text-emerald-400" /> {t('recommendations')}
                        </h4>
                        <ul className="space-y-2">
                          {scan.recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                              <span className={`mt-2 shrink-0 w-1.5 h-1.5 rounded-full ${isCritical ? 'bg-red-400' : 'bg-emerald-400'}`} />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Agent Details */}
                    {scan.agentResults && scan.agentResults.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">{t('agentAnalysisBreakdown')}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {scan.agentResults.map((agent, i) => (
                            <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{agent.agentIcon}</span>
                                  <p className="text-sm font-bold text-slate-200">{agent.agentName}</p>
                                </div>
                                <Badge variant={agent.riskScore > 50 ? 'danger' : 'safe'}>
                                  {agent.riskScore}%
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-400 leading-relaxed">{agent.explanation}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </Card>
            )
          }) : (
            <div className="text-center py-12 text-slate-400">
              <p>{t('noScansFound', { defaultValue: 'No scan history found.' })}</p>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
