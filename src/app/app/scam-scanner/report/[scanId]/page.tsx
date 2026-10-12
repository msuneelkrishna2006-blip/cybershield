'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Shield, AlertTriangle, CheckCircle2, Copy, Printer, Phone, ExternalLink } from 'lucide-react'

interface ReportData {
  id: string
  verdict: string
  riskScore: number
  riskLevel: string
  scanType: string
  category: string
  categoryName: string
  summary: string
  indicators: string[]
  recommendations: string[]
  helpline?: { number: string; name: string }
  scannedAt: string
  memberName?: string
}

export default function ScanReportPage() {
  const params = useParams()
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch(`/api/v1/scans/${params.scanId}/report`)
        const data = await res.json()
        if (data.success && data.data?.report) {
          setReport(data.data.report)
        } else {
          setError(data.error?.message || 'Report not found')
        }
      } catch {
        setError('Failed to load report')
      } finally {
        setLoading(false)
      }
    }
    if (params.scanId) fetchReport()
  }, [params.scanId])

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getRiskColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'CRITICAL': return 'text-red-500 bg-red-500/10 border-red-500/30'
      case 'HIGH': return 'text-orange-500 bg-orange-500/10 border-orange-500/30'
      case 'MEDIUM': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30'
      case 'LOW': return 'text-blue-400 bg-blue-400/10 border-blue-400/30'
      default: return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
          <span>Loading report...</span>
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-slate-300">{error || 'Report not found'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-slate-200 print:bg-white print:text-black">
      {/* Header — hidden in print */}
      <div className="print:hidden bg-[#0A0E1A]/80 border-b border-white/5 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-cyan-400" />
            <span className="font-bold text-white">CyberShield Report</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopyLink} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10">
              <Copy size={14} />
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-sm text-cyan-400 hover:bg-cyan-500/30">
              <Printer size={14} />
              Save as PDF
            </button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Logo for print */}
        <div className="hidden print:flex items-center gap-2 mb-6">
          <Shield className="w-8 h-8" />
          <span className="text-2xl font-bold">CyberShield India — Scan Report</span>
        </div>

        {/* Verdict */}
        <div className={`rounded-xl p-6 border-2 ${getRiskColor(report.riskLevel)}`}>
          <p className="text-2xl font-black mb-2">{report.verdict}</p>
          <div className="flex items-center gap-4 text-sm opacity-80">
            <span>Risk Score: <strong>{report.riskScore}/100</strong></span>
            <span>Level: <strong>{report.riskLevel}</strong></span>
            <span>Type: <strong>{report.scanType.toUpperCase()}</strong></span>
          </div>
        </div>

        {/* Summary */}
        {report.summary && (
          <div className="bg-white/5 print:bg-gray-50 rounded-xl p-5 border border-white/5 print:border-gray-200">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 print:text-gray-600 mb-2">Analysis Summary</h3>
            <p className="text-slate-200 print:text-gray-800 leading-relaxed">{report.summary}</p>
          </div>
        )}

        {/* Indicators */}
        {report.indicators.length > 0 && (
          <div className="bg-white/5 print:bg-gray-50 rounded-xl p-5 border border-white/5 print:border-gray-200">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 print:text-gray-600 mb-3">Detected Indicators</h3>
            <ul className="space-y-2">
              {report.indicators.map((ind, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle size={14} className="text-yellow-400 print:text-yellow-600 mt-0.5 shrink-0" />
                  <span className="text-slate-300 print:text-gray-700">{ind}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {report.recommendations.length > 0 && (
          <div className="bg-white/5 print:bg-gray-50 rounded-xl p-5 border border-white/5 print:border-gray-200">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 print:text-gray-600 mb-3">
              <CheckCircle2 size={16} className="inline mr-1" />
              Recommended Actions
            </h3>
            <ol className="space-y-2 list-decimal list-inside">
              {report.recommendations.map((rec, i) => (
                <li key={i} className="text-sm text-slate-300 print:text-gray-700">{rec}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Helpline */}
        {report.helpline && (
          <div className="bg-red-500/10 print:bg-red-50 rounded-xl p-5 border border-red-500/30 print:border-red-200">
            <h3 className="font-bold text-sm uppercase tracking-wider text-red-400 print:text-red-600 mb-2 flex items-center gap-2">
              <Phone size={16} /> Emergency Helpline
            </h3>
            <p className="text-lg font-bold text-white print:text-red-700">
              {report.helpline.name}: <a href={`tel:${report.helpline.number}`} className="underline">{report.helpline.number}</a>
            </p>
            <p className="text-sm text-slate-400 print:text-gray-600 mt-1">
              Also file a complaint at <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer" className="text-cyan-400 print:text-blue-600 underline inline-flex items-center gap-1">
                cybercrime.gov.in <ExternalLink size={12} />
              </a>
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 print:text-gray-500 pt-4 border-t border-white/5 print:border-gray-200">
          <p>Report generated by CyberShield India Platform • {new Date(report.scannedAt).toLocaleString('en-IN')}</p>
          <p className="mt-1">This is not a legal document. Please file a formal complaint for legal proceedings.</p>
        </div>
      </div>
    </div>
  )
}
