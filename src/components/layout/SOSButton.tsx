'use client'

import React, { useState } from 'react'
import { ShieldAlert, MapPin, AlertTriangle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/contexts/TranslationContext'

export function SOSButton() {
  const { t } = useTranslation()
  const [showModal, setShowModal] = useState(false)
  const [activating, setActivating] = useState(false)

  const handleSOS = async () => {
    setActivating(true)
    
    // Simulate getting location and sending alerts
    toast.loading(t('sosAcquiringGps'), { id: 'sos' })
    
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          () => console.log('Location acquired'),
          () => console.error('Location error')
        )
      }
      
      await new Promise(r => setTimeout(r, 1500))
      
      toast.success(t('sosActivated'), { 
        id: 'sos',
        duration: 5000,
        style: { background: '#ef4444', color: '#fff' }
      })
      
      setShowModal(false)
      
      // Store event
      const events = JSON.parse(localStorage.getItem('cyber_sos_events') || '[]')
      events.push({ timestamp: new Date().toISOString(), status: 'active' })
      localStorage.setItem('cyber_sos_events', JSON.stringify(events))
      
    } catch (e) {
      toast.error(t('sosFailed'), { id: 'sos' })
    } finally {
      setActivating(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-700 border-2 border-red-400 flex items-center justify-center text-white shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:scale-105 active:scale-95 transition-all animate-pulse"
        title={t('emergencySosTitle')}
      >
        <ShieldAlert size={28} />
      </button>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => !activating && setShowModal(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative glass-dark rounded-2xl p-6 md:p-8 max-w-sm w-full border-2 border-red-500/50 shadow-2xl shadow-red-500/20 text-center"
            >
              <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-6">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              
              <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-wide">{t('emergencySosTitle')}</h2>
              <p className="text-slate-300 mb-6">
                {t('sosConfirmTitle')}
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={handleSOS}
                  disabled={activating}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 text-lg uppercase tracking-wider transition-colors disabled:opacity-70"
                >
                  {activating ? t('sosActivating') : t('sosConfirmButton')} <MapPin size={20} />
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  disabled={activating}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  {t('cancel')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
