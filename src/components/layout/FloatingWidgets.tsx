'use client'

import React, { useState, useEffect } from 'react'
import { SOSButton, SOSModal } from '@/components/ui'
import HelperChatWidget from './HelperChatWidget'

export default function FloatingWidgets() {
  const [sosOpen, setSosOpen] = useState(false)

  useEffect(() => {
    const handleTriggerSOS = () => {
      setSosOpen(true)
    }
    window.addEventListener('cyber-sos-trigger', handleTriggerSOS)
    return () => {
      window.removeEventListener('cyber-sos-trigger', handleTriggerSOS)
    }
  }, [])

  return (
    <>
      <SOSButton onClick={() => setSosOpen(true)} />
      <SOSModal isOpen={sosOpen} onClose={() => setSosOpen(false)} />
      <HelperChatWidget />
    </>
  )
}
