'use client'

import { ReactNode, useEffect, useState } from 'react'
import i18n from '@/lib/i18n'

/**
 * I18nInitializer — gates rendering until i18n is ready.
 * 
 * For English (statically bundled), i18n.isInitialized is true immediately.
 * For other languages, this waits until HttpBackend finishes loading.
 */
export default function I18nInitializer({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(i18n.isInitialized)

  useEffect(() => {
    if (i18n.isInitialized) {
      setReady(true)
      return
    }

    const handleInitialized = () => setReady(true)
    i18n.on('initialized', handleInitialized)

    return () => {
      i18n.off('initialized', handleInitialized)
    }
  }, [])

  if (!ready) {
    // Minimal loading state — matches the dark theme
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading...</span>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
