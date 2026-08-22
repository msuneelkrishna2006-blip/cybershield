'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from '@/contexts/TranslationContext'
import { useAuth } from '@/contexts/AuthContext'
import { ShieldLogo } from '@/components/ui'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, Search, Shield, Bot, Bell, Users, Heart, 
  ShieldAlert, Settings, LogOut, ChevronLeft, ChevronRight, Menu 
} from 'lucide-react'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'dashboard', href: '/app', color: '#06b6d4' },
  { icon: Search, label: 'scam_scanner', href: '/app/scam-scanner', color: '#ef4444' },
  { icon: Shield, label: 'child_safety', href: '/app/child-safety', color: '#8b5cf6', badge: 'New' },
  { icon: Bot, label: 'ai_guardian', href: '/app/ai-guardian', color: '#10b981' },
  { icon: Bell, label: 'alerts', href: '/app/alerts', color: '#f97316', badge: '2' },
  { icon: Users, label: 'family', href: '/app/family', color: '#06b6d4' },
  { icon: Heart, label: 'women_safety', href: '/app/women-safety', color: '#ec4899' },
  { icon: ShieldAlert, label: 'emergency', href: '/app/emergency', color: '#ef4444' },
  { icon: Settings, label: 'settings', href: '/app/settings', color: '#64748b' }
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
  onSOSClick: () => void
}

import { useAlerts } from '@/contexts/AlertsContext'

export function Sidebar({ collapsed, onToggle, mobileOpen, setMobileOpen, onSOSClick }: SidebarProps) {
  const pathname = usePathname()
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const { unreadCount } = useAlerts()

  const sidebarClasses = cn(
    "fixed inset-y-0 left-0 z-40 flex flex-col glass-dark border-r border-white/5 transition-all duration-300 ease-in-out h-screen",
    collapsed ? "w-20" : "w-64",
    mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
  )

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={sidebarClasses}>
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/5">
          <Link href="/app" className={cn("flex items-center gap-2 overflow-hidden", collapsed ? "w-10" : "w-auto")}>
            <ShieldLogo className="w-8 h-8 shrink-0" />
            {!collapsed && (
              <span className="text-xl font-black tracking-tight whitespace-nowrap">
                Cyber<span className="text-cyan-400">Shield</span>
              </span>
            )}
          </Link>
          
          <button 
            onClick={onToggle}
            className="hidden md:flex p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1 scrollbar-hide">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            const badge = item.label === 'alerts' 
              ? (unreadCount > 0 ? String(unreadCount) : undefined) 
              : item.badge
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                  isActive ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full" style={{ backgroundColor: item.color }} />
                )}
                <Icon size={20} className={cn("shrink-0", isActive ? "" : "opacity-80 group-hover:opacity-100")} style={{ color: isActive ? item.color : undefined }} />
                
                {!collapsed && (
                  <div className="flex items-center justify-between flex-1 overflow-hidden">
                    <span className={cn("font-medium whitespace-nowrap", isActive && "font-bold")}>
                      {t(item.label)}
                    </span>
                    {badge && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 shrink-0 animate-pulse">
                        {badge}
                      </span>
                    )}
                  </div>
                )}
                
                {/* Tooltip for collapsed state */}
                {collapsed && (
                  <div className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-xs font-semibold rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                    {t(item.label)}
                  </div>
                )}
              </Link>
            )
          })}
        </div>

        {/* User Profile Footer */}
        {user && (
          <div className="p-4 border-t border-white/5">
            <div className={cn("flex items-center gap-3", collapsed ? "justify-center" : "")}>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold shrink-0 border border-white/10">
                {user?.name?.charAt(0) || 'U'}
              </div>
              
              {!collapsed && (
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-bold text-white truncate">{user.name}</p>
                  <p className="text-xs text-slate-400 truncate capitalize">{user.role}</p>
                </div>
              )}
              
              {!collapsed && (
                <button 
                  onClick={logout}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                  title={t('logout')}
                >
                  <LogOut size={18} />
                </button>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
