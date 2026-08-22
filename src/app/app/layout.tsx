'use client'

import React, { useState, useEffect, ReactNode } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { SOSButton, SOSModal } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui'
import HelperChatWidget from '@/components/layout/HelperChatWidget'

import { AlertsProvider, useAlerts } from '@/contexts/AlertsContext'

function ConnectionStatus() {
  const { connectionStatus } = useAlerts()
  if (connectionStatus === 'connected') return null
  
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-bold shadow-lg border transition-all duration-300 ${
      connectionStatus === 'offline' 
        ? 'bg-red-500/20 border-red-500/30 text-red-400 shadow-red-500/10' 
        : 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400 shadow-yellow-500/10 animate-pulse'
    }`}>
      {connectionStatus === 'offline' ? '⚠️ Offline (Falling back to local cache)' : '🔄 Reconnecting...'}
    </div>
  )
}

function AppLayoutContent({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, isLoading } = useAuth()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Show loading state while checking auth
  if (isLoading || !mounted) {
    return (
      <div className="min-h-screen bg-surface-900 flex flex-col items-center justify-center text-white">
        <Spinner size={48} className="mb-4 text-cyan-500" />
        <p className="text-slate-400 font-medium">Securing connection...</p>
      </div>
    )
  }

  // If no user after loading, the AuthContext effect will redirect to /login
  if (!user) return null

  return (
    <div className="app-shell flex h-screen bg-surface-900 overflow-hidden text-slate-100 relative" dir="ltr">
      {/* Background styling for app area */}
      <div className="fixed inset-0 cyber-grid-bg opacity-10 pointer-events-none z-0" />
      <div className="glow-blob bg-cyan-900/20 w-[800px] h-[800px] top-[-200px] right-[-200px] z-0" />
      
      <ConnectionStatus />

      {/* Sidebar */}
      <Sidebar 
        collapsed={collapsed} 
        onToggle={() => setCollapsed(!collapsed)} 
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onSOSClick={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('cyber-sos-trigger'))
          }
        }}
      />
      
      {/* Main Content Area */}
      <div 
        className="flex-1 flex flex-col min-w-0 h-screen transition-all duration-300 z-10"
        style={{ marginLeft: collapsed ? '5rem' : '16rem', width: '100%' }}
      >
        <div className="md:hidden" style={{ marginLeft: 0 }}></div>
        {/* We use CSS media queries to fix the margin on mobile */}
        <style dangerouslySetInnerHTML={{__html: `
          @media (max-width: 768px) {
            .flex-1 { margin-left: 0 !important; }
          }
        `}} />
        
        <Topbar onMenuToggle={() => setMobileOpen(true)} />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 scroll-smooth">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AlertsProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </AlertsProvider>
  )
}
