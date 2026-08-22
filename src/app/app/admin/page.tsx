'use client'

import React, { useState, useEffect } from 'react'
import { Card, Badge } from '@/components/ui'
import {
  Shield, Users, Search, AlertTriangle, Activity,
  Clock, ShieldAlert, Database, Cpu, BarChart3, 
  RefreshCw, ChevronDown
} from 'lucide-react'

interface PlatformStats {
  platform: {
    totalUsers: number
    totalScans: number
    totalFamilies: number
    activeSessions: number
  }
  scans: {
    today: number
    thisWeek: number
    highRisk: number
    critical: number
  }
  threats: {
    topCategories: Array<{ category: string; count: number }>
  }
  security: {
    events24h: number
    recentEvents: Array<{
      id: string
      eventType: string
      severity: string
      sourceIp: string
      createdAt: string
    }>
  }
  modelAccuracy: {
    totalFeedback: number
    accurate?: number
    falsePositives?: number
    falseNegatives?: number
    accuracyRate?: number
    message?: string
  }
  generatedAt: string
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadStats() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/v1/admin/stats')
      const data = await res.json()
      if (data.success) {
        setStats(data.data)
        setError(null)
      } else {
        setError(data.error?.message || 'Failed to load stats')
      }
    } catch {
      setError('Network error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadStats() }, [])

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto animate-pulse">
        <div className="h-10 bg-slate-800 rounded-lg w-1/3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-800 rounded-xl" />)}
        </div>
        <div className="h-64 bg-slate-800 rounded-xl" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="text-center py-20 text-slate-500">
        <ShieldAlert className="mx-auto w-12 h-12 mb-3 text-red-400" />
        <p className="font-bold text-white">Admin Access Required</p>
        <p className="text-sm mt-1">{error || 'Unable to load admin dashboard'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in duration-300">
      <div className="tricolor-accent-bar" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Shield className="text-orange-400" /> SOC Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Platform-wide security operations. Last updated: {new Date(stats.generatedAt).toLocaleTimeString()}
          </p>
        </div>
        <button onClick={loadStats} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Platform Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400"><Users size={22} /></div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Users</p>
              <p className="text-2xl font-black text-white">{stats.platform.totalUsers.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400"><Search size={22} /></div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Scans</p>
              <p className="text-2xl font-black text-white">{stats.platform.totalScans.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400"><Users size={22} /></div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Families</p>
              <p className="text-2xl font-black text-white">{stats.platform.totalFamilies.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400"><Activity size={22} /></div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active Sessions</p>
              <p className="text-2xl font-black text-white">{stats.platform.activeSessions}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Scan Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-emerald-500/20">
          <p className="text-[10px] text-slate-500 font-bold uppercase">Scans Today</p>
          <p className="text-xl font-black text-emerald-400">{stats.scans.today}</p>
        </Card>
        <Card className="border-blue-500/20">
          <p className="text-[10px] text-slate-500 font-bold uppercase">This Week</p>
          <p className="text-xl font-black text-blue-400">{stats.scans.thisWeek}</p>
        </Card>
        <Card className="border-amber-500/20">
          <p className="text-[10px] text-slate-500 font-bold uppercase">High Risk</p>
          <p className="text-xl font-black text-amber-400">{stats.scans.highRisk}</p>
        </Card>
        <Card className="border-red-500/20">
          <p className="text-[10px] text-slate-500 font-bold uppercase">Critical</p>
          <p className="text-xl font-black text-red-400">{stats.scans.critical}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Threat Categories */}
        <Card className="space-y-4">
          <h3 className="font-extrabold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-orange-400" /> Top Threat Categories
          </h3>
          <div className="space-y-3">
            {stats.threats.topCategories.length > 0 ? stats.threats.topCategories.map((cat, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-slate-300 font-semibold">
                  {cat.category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </span>
                <Badge variant={i === 0 ? 'danger' : i < 3 ? 'warning' : 'info'}>
                  {cat.count}
                </Badge>
              </div>
            )) : (
              <p className="text-sm text-slate-500">No scan data yet.</p>
            )}
          </div>
        </Card>

        {/* Model Accuracy */}
        <Card className="space-y-4">
          <h3 className="font-extrabold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-purple-400" /> AI Model Accuracy
          </h3>
          {stats.modelAccuracy.totalFeedback > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Accuracy Rate</span>
                <span className="text-2xl font-black text-emerald-400">{stats.modelAccuracy.accuracyRate}%</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-emerald-500/10">
                  <p className="text-lg font-black text-emerald-400">{stats.modelAccuracy.accurate}</p>
                  <p className="text-[10px] text-slate-500 font-bold">Accurate</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/10">
                  <p className="text-lg font-black text-amber-400">{stats.modelAccuracy.falsePositives}</p>
                  <p className="text-[10px] text-slate-500 font-bold">False +</p>
                </div>
                <div className="p-3 rounded-lg bg-red-500/10">
                  <p className="text-lg font-black text-red-400">{stats.modelAccuracy.falseNegatives}</p>
                  <p className="text-[10px] text-slate-500 font-bold">False −</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 text-center">Based on {stats.modelAccuracy.totalFeedback} user feedback reports</p>
            </div>
          ) : (
            <div className="text-center py-4 text-slate-500">
              <Database className="mx-auto w-8 h-8 mb-2" />
              <p className="text-sm">No feedback data yet.</p>
              <p className="text-xs mt-1">Accuracy metrics will appear after users provide scan feedback.</p>
            </div>
          )}
        </Card>
      </div>

      {/* Security Events */}
      <Card className="space-y-4">
        <h3 className="font-extrabold text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-400" /> Security Events (24h)
          <Badge>{stats.security.events24h}</Badge>
        </h3>
        <div className="space-y-2">
          {stats.security.recentEvents.length > 0 ? stats.security.recentEvents.map(event => (
            <div key={event.id} className="p-3 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant={event.severity === 'CRITICAL' ? 'danger' : event.severity === 'HIGH' ? 'warning' : 'info'}>
                  {event.severity}
                </Badge>
                <div>
                  <p className="text-sm font-semibold text-white">{event.eventType.replace(/_/g, ' ')}</p>
                  <p className="text-[10px] text-slate-500">From: {event.sourceIp}</p>
                </div>
              </div>
              <span className="text-xs text-slate-500">
                {new Date(event.createdAt).toLocaleTimeString()}
              </span>
            </div>
          )) : (
            <p className="text-sm text-slate-500 text-center py-4">No security events in the last 24 hours.</p>
          )}
        </div>
      </Card>
    </div>
  )
}
