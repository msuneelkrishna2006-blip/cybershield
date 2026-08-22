'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react'
import { Alert, AlertCategory, AlertSeverity } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

interface AlertsContextType {
  alerts: Alert[]
  unreadCount: number
  connectionStatus: 'connected' | 'reconnecting' | 'offline'
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  dismissAlert: (id: string) => void
  triggerSimulatedAlert: (category?: AlertCategory, severity?: AlertSeverity) => void
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined)

export function AlertsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'offline'>('connected')
  
  const channelRef = useRef<BroadcastChannel | null>(null)

  const loadAlerts = async () => {
    try {
      const res = await fetch('/api/v1/alerts')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setAlerts(data.alerts)
        }
      }
    } catch (e) {
      console.error('Failed to load alerts:', e)
    }
  }

  // Load alerts from SQLite on mount / user change
  // Load alerts when user changes
useEffect(() => {
  if (!user) return

  const timer = setTimeout(() => {
    void loadAlerts()
  }, 0)

  return () => clearTimeout(timer)
}, [user])

  // Connection Resilience & BroadcastChannel tab sync
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      setConnectionStatus('reconnecting')
      setTimeout(() => {
        setConnectionStatus('connected')
        loadAlerts()
      }, 1000)
    }
    const handleOffline = () => setConnectionStatus('offline')

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    const channel = new BroadcastChannel('cybershield_alerts_sync')
    channelRef.current = channel

    channel.onmessage = (event) => {
      const { type, payload } = event.data
      if (type === 'SYNC') {
        setAlerts(payload)
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      channel.close()
    }
  }, [])

  // Play a soft alarm chime for critical alerts
  const playAlertSound = (severity: AlertSeverity) => {
    if (severity !== 'critical') return
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()
      
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime)
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime)
      
      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      
      oscillator.start()
      setTimeout(() => {
        oscillator.stop()
        const osc2 = audioCtx.createOscillator()
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(880, audioCtx.currentTime)
        osc2.connect(gainNode)
        osc2.start()
        setTimeout(() => osc2.stop(), 150)
      }, 150)
    } catch (e) {
      console.warn('Audio chime blocked by browser autoplays policy')
    }
  }

  const markAsRead = async (id: string) => {
    const updated = alerts.map(a => a.id === id ? { ...a, read: true } : a)
    setAlerts(updated)

    try {
      await fetch('/api/v1/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', alertId: id })
      })
      if (channelRef.current) {
        channelRef.current.postMessage({ type: 'SYNC', payload: updated })
      }
    } catch (e) {
      console.error(e)
    }
  }

  const markAllAsRead = async () => {
    const updated = alerts.map(a => ({ ...a, read: true }))
    setAlerts(updated)
    toast.success('All alerts marked as read')

    try {
      await fetch('/api/v1/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' })
      })
      if (channelRef.current) {
        channelRef.current.postMessage({ type: 'SYNC', payload: updated })
      }
    } catch (e) {
      console.error(e)
    }
  }

  const dismissAlert = async (id: string) => {
    const updated = alerts.filter(a => a.id !== id)
    setAlerts(updated)
    toast.success('Alert dismissed')

    try {
      await fetch('/api/v1/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', alertId: id })
      })
      if (channelRef.current) {
        channelRef.current.postMessage({ type: 'SYNC', payload: updated })
      }
    } catch (e) {
      console.error(e)
    }
  }

  const triggerSimulatedAlert = async (category?: AlertCategory, severity?: AlertSeverity) => {
    const categories: AlertCategory[] = ['scam', 'child_safety', 'family', 'women_safety', 'emergency_sos', 'system']
    const severities: AlertSeverity[] = ['low', 'medium', 'high', 'critical']
    
    const cat = category || categories[Math.floor(Math.random() * categories.length)]
    const sev = severity || severities[Math.floor(Math.random() * severities.length)]

    const details: Record<AlertCategory, { title: string; desc: string }> = {
      scam: {
        title: 'UPI Payment Fraud Blocked',
        desc: 'Blocked a suspicious collect request of ₹10,000 from an unregistered seller account.'
      },
      child_safety: {
        title: 'Downtime Alert: Screen Time Limit',
        desc: 'Rahul reached the screen limit of 180 minutes on his gaming profiles.'
      },
      family: {
        title: 'Weekly Report Ready',
        desc: 'The security report for the Sharma family has been compiled for review.'
      },
      women_safety: {
        title: 'Check-in Alert Triggered',
        desc: 'Priya failed to check in on the family tracking loop within the travel window.'
      },
      emergency_sos: {
        title: 'Emergency Contact Alert',
        desc: 'Critical Alert: Emergency response initiated. Coordinates sent to close contacts.'
      },
      system: {
        title: 'New Device Login Detected',
        desc: 'A login was registered on chrome browser from New Delhi, IN.'
      }
    }

    try {
      const res = await fetch('/api/v1/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'trigger_test',
          type: cat,
          severity: sev,
          title: details[cat].title,
          description: details[cat].desc
        })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.alert) {
          const newAlertList = [data.alert, ...alerts]
          setAlerts(newAlertList)
          if (channelRef.current) {
            channelRef.current.postMessage({ type: 'SYNC', payload: newAlertList })
          }
          if (sev === 'critical') {
            playAlertSound('critical')
            toast.error(
              <div className="flex flex-col gap-1">
                <span className="font-extrabold text-red-500 tracking-wide uppercase text-xs">🚨 Critical Safety Alert</span>
                <span className="font-bold text-white text-sm">{data.alert.title}</span>
                <span className="text-xs text-slate-300">{data.alert.description}</span>
              </div>,
              {
                duration: 6000,
                style: {
                  background: '#09090b',
                  border: '2px solid rgba(239, 68, 68, 0.4)',
                  boxShadow: '0 0 25px rgba(239, 68, 68, 0.3)'
                }
              }
            )
          } else {
            toast.success(
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-cyan-400 text-xs">New Notification</span>
                <span className="text-white text-sm font-semibold">{data.alert.title}</span>
              </div>,
              {
                duration: 3500,
                style: {
                  background: '#09090b',
                  border: '1px solid rgba(6, 182, 212, 0.3)'
                }
              }
            )
          }
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const unreadCount = alerts.filter(a => !a.read).length

  return (
    <AlertsContext.Provider value={{
      alerts,
      unreadCount,
      connectionStatus,
      markAsRead,
      markAllAsRead,
      dismissAlert,
      triggerSimulatedAlert
    }}>
      {children}
    </AlertsContext.Provider>
  )
}

export function useAlerts() {
  const context = useContext(AlertsContext)
  if (context === undefined) {
    throw new Error('useAlerts must be used within an AlertsProvider')
  }
  return context
}
