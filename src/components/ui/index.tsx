'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { useTranslation } from '@/contexts/TranslationContext'

// ── 1. ShieldLogo ─────────────────────────────────────────────────────────────
export function ShieldLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn('text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.6)]', className)}>
      <defs>
        <linearGradient id="shieldGrad" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="url(#shieldGrad)" fillOpacity="0.2" stroke="url(#shieldGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── 2. SafetyScore ────────────────────────────────────────────────────────────
export function SafetyScore({ score, size = 100 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const progress = ((100 - score) / 100) * circumference
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#eab308' : '#ef4444'

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circumference} strokeDashoffset={progress}
          strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        <span className="font-black leading-none drop-shadow-md" style={{ color, fontSize: size * 0.28 }}>{score}</span>
        {size >= 80 && <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">/100</span>}
      </div>
    </div>
  )
}

// ── 3. RiskScore ──────────────────────────────────────────────────────────────
export function RiskScore({ score, size = 100 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const progress = ((100 - score) / 100) * circumference
  const color = score >= 80 ? '#ef4444' : score >= 40 ? '#eab308' : '#10b981'

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circumference} strokeDashoffset={progress}
          strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        <span className="font-black leading-none drop-shadow-md" style={{ color, fontSize: size * 0.28 }}>{score}%</span>
        {size >= 80 && <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Risk</span>}
      </div>
    </div>
  )
}

// ── 4. StatCard ───────────────────────────────────────────────────────────────
export function StatCard({ 
  title, value, icon, change, positive, color = '#06b6d4' 
}: { 
  title: string; value: string | number; icon: React.ReactNode; change?: string; positive?: boolean; color?: string 
}) {
  const { language } = useTranslation()
  const isUrdu = language === 'ur'
  return (
    <div className="stat-card" dir={isUrdu ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-4">
        <div className="p-2.5 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, color }}>
          {icon}
        </div>
        {change && (
          <span className={cn("text-xs font-bold px-2 py-1 rounded-full", positive ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400")}>
            {positive ? '+' : '-'}{change}
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-white mb-1 drop-shadow-sm">{value}</p>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
    </div>
  )
}

// ── 5. Badge ──────────────────────────────────────────────────────────────────
export function Badge({ 
  variant = 'info', children, className 
}: { 
  variant?: 'info' | 'safe' | 'warning' | 'danger' | 'purple'; children: React.ReactNode; className?: string 
}) {
  return (
    <span className={cn('badge', `badge-${variant}`, className)}>
      {children}
    </span>
  )
}

// ── 6. ProgressBar ────────────────────────────────────────────────────────────
export function ProgressBar({ 
  value, max = 100, label, color = '#06b6d4' 
}: { 
  value: number; max?: number; label?: string; color?: string 
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs mb-1.5">
          <span className="font-semibold text-slate-300">{label}</span>
          <span className="text-slate-500">{value}{max !== 100 ? `/${max}` : '%'}</span>
        </div>
      )}
      <div className="progress-bar">
        <div 
          className="h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_currentColor]" 
          style={{ width: `${percentage}%`, backgroundColor: color, color }} 
        />
      </div>
    </div>
  )
}

// ── 7. AgentDot ───────────────────────────────────────────────────────────────
export function AgentDot({ status }: { status: 'active' | 'processing' | 'idle' }) {
  if (status === 'active') return <div className="w-2.5 h-2.5 rounded-full agent-dot-active shrink-0" title="Active" />
  if (status === 'processing') return <div className="w-2.5 h-2.5 rounded-full agent-dot-warning shrink-0" title="Processing" />
  return <div className="w-2.5 h-2.5 rounded-full bg-slate-600 shrink-0" title="Idle" />
}

// ── 8. Spinner ────────────────────────────────────────────────────────────────
export function Spinner({ size = 24, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cn("animate-spin text-cyan-400", className)} />
}

// ── 9. Card ───────────────────────────────────────────────────────────────────
export function Card({ 
  children, className, hover = false, ...props 
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div className={cn(hover ? 'card-hover' : 'card', className)} {...props}>
      {children}
    </div>
  )
}

// ── 10. EmptyState ────────────────────────────────────────────────────────────
export function EmptyState({ 
  icon, title, description 
}: { 
  icon: React.ReactNode; title: string; description: string 
}) {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center rounded-xl border-2 border-dashed border-white/10 bg-black/20">
      <div className="text-slate-500 mb-4 scale-150">{icon}</div>
      <h3 className="text-lg font-bold text-slate-200 mb-2">{title}</h3>
      <p className="text-sm text-slate-400 max-w-sm">{description}</p>
    </div>
  )
}

// ── 11. LoadingSkeleton ───────────────────────────────────────────────────────
export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} />
}

// ── 12. SOSButton ─────────────────────────────────────────────────────────────
export function SOSButton({ className, onClick }: { className?: string; onClick?: () => void }) {
  return (
    <div className={cn("fixed bottom-6 right-6 z-50 flex items-center gap-4", className)}>
      <button
        onClick={onClick}
        className={cn(
          "relative flex items-center justify-center w-16 h-16 rounded-full font-black text-xl transition-all shadow-[0_0_30px_rgba(239,68,68,0.4)] bg-red-500 hover:bg-red-600 text-white group"
        )}
      >
        {/* Background Ripple */}
        <div className="absolute inset-0 rounded-full animate-ping bg-red-500 opacity-20" />
        
        {/* Content */}
        <span className="drop-shadow-md tracking-wider group-hover:scale-105 transition-transform">SOS</span>
      </button>
    </div>
  )
}

// ── 13. SOSModal ──────────────────────────────────────────────────────────────
export { SOSModal } from './SOSModal'

