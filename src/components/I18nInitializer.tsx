'use client'

import { ReactNode, useEffect, useState } from 'react'
import '@/lib/i18n' // Initialize i18n on import

export default function I18nInitializer({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // i18n is initialized on import, just mark ready
    setReady(true)
  }, [])

  // Render children immediately - i18n will load translations async and re-render
  return <>{children}</>
}
