'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/contexts/TranslationContext'
import { useAuth } from '@/contexts/AuthContext'
import { useAlerts } from '@/contexts/AlertsContext'
import { Menu, Globe, Bell, Search, Sun, Moon, Eye, LogOut, User } from 'lucide-react'
import { Language } from '@/types'
import { cn } from '@/lib/utils'

interface TopbarProps {
  onMenuToggle: () => void
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const { t, language, setLanguage, languages } = useTranslation()
  const { user, logout } = useAuth()
  const { unreadCount } = useAlerts()
  
  const [showLangDropdown, setShowLangDropdown] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  
  // Theme toggles (just visual for now, actual implementation would use next-themes)
  const toggleHighContrast = () => {
    document.documentElement.classList.toggle('high-contrast')
  }

  return (
    <header className="h-16 glass-dark border-b border-white/5 sticky top-0 z-30 px-4 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1">
        <button 
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Menu size={24} />
        </button>
        
        <div className="hidden md:flex relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            placeholder={t('search')} 
            className="w-full bg-black/40 border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Accessibility Tools */}
        <div className="hidden sm:flex items-center gap-1 border-r border-white/10 pr-4">
          <button onClick={toggleHighContrast} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors" title={t('toggleHighContrast')}>
            <Eye size={18} />
          </button>
        </div>

        {/* Language Switcher */}
        <div className="relative">
          <button 
            onClick={() => {
              setShowLangDropdown(!showLangDropdown)
              setShowProfileDropdown(false)
            }}
            className="flex items-center gap-1.5 p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-sm font-semibold uppercase"
          >
            <Globe size={18} className="text-cyan-400" />
            <span className="hidden sm:inline">{language}</span>
          </button>
          
          {showLangDropdown && (
            <div className="absolute right-0 mt-2 w-48 glass rounded-xl border border-white/10 shadow-2xl py-1 z-50">
              {languages.map((l) => (
                <button
                  key={l.code}
                  onClick={() => { setLanguage(l.code); setShowLangDropdown(false) }}
                  className={cn(
                    "w-full text-left px-4 py-2 text-sm hover:bg-white/10 transition-colors flex items-center justify-between",
                    language === l.code ? "text-cyan-400 font-bold" : "text-slate-300"
                  )}
                >
                  <span>{l.name}</span>
                  <span className="text-xs opacity-60">{l.nativeName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <Link 
          href="/app/alerts" 
          className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors block"
          title={t('unreadAlerts', { count: unreadCount })}
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-[10px] font-black text-white flex items-center justify-center px-1 animate-pulse">
              {unreadCount}
            </span>
          )}
        </Link>

        {/* Mobile Profile Toggle */}
        <div className="md:hidden relative ml-2">
          <button 
            onClick={() => {
              setShowProfileDropdown(!showProfileDropdown)
              setShowLangDropdown(false)
            }}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold"
          >
            {user?.name?.charAt(0) || 'U'}
          </button>

          {showProfileDropdown && (
            <div className="absolute right-0 mt-2 w-48 glass rounded-xl border border-white/10 shadow-2xl py-1 z-50">
              <div className="px-4 py-3 border-b border-white/10">
                <p className="text-sm font-bold text-white truncate">{user?.name}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
              <button
                onClick={logout}
                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-400/10 transition-colors flex items-center gap-2"
              >
                <LogOut size={16} /> {t('signOut')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
