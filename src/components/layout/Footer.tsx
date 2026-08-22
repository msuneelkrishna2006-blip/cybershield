'use client'

import React from 'react'
import Link from 'next/link'
import { ShieldLogo } from '@/components/ui'
import { Phone, ExternalLink } from 'lucide-react'
import { useTranslation } from '@/contexts/TranslationContext'

export default function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="relative z-10 border-t border-white/5 bg-black/80 backdrop-blur-md pt-16 pb-8">
      {/* Tricolor Accent Bar */}
      <div className="tricolor-accent-bar absolute top-0 left-0 right-0 h-1" />

      <div className="container-custom px-6 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 mb-12">
        {/* Info Column */}
        <div className="md:col-span-5 space-y-4">
          <div className="flex items-center gap-3">
            <ShieldLogo className="w-8 h-8" />
            <span className="text-xl font-black tracking-tight text-white">
              Cyber<span className="text-cyan-400">Shield</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
            {t('brandDescription')}
          </p>
        </div>

        {/* Links Column */}
        <div className="md:col-span-3 space-y-4">
          <h4 className="font-bold text-white text-xs uppercase tracking-widest">{t('platform')}</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/#features" className="text-slate-400 hover:text-white transition-colors">{t('features')}</Link>
            </li>
            <li>
              <Link href="/about" className="text-slate-400 hover:text-white transition-colors">{t('aboutUs')}</Link>
            </li>
            <li>
              <Link href="/contact" className="text-slate-400 hover:text-white transition-colors">{t('contactSupport')}</Link>
            </li>
          </ul>
        </div>

        {/* Helplines Column */}
        <div className="md:col-span-4 space-y-4">
          <h4 className="font-bold text-white text-xs uppercase tracking-widest">{t('emergencyHelplineNumbers')}</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
            <a href="tel:1930" className="text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1">
              <Phone size={10} /> {t('cyberCrime1930')}
            </a>
            <a href="tel:112" className="text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1">
              <Phone size={10} /> {t('emergency112')}
            </a>
            <a href="tel:181" className="text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1">
              <Phone size={10} /> {t('womenSafety181')}
            </a>
            <a href="tel:1098" className="text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1">
              <Phone size={10} /> {t('childSafety1098')}
            </a>
          </div>
        </div>
      </div>

      <div className="container-custom px-6 max-w-7xl mx-auto border-t border-white/5 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
        <span>{t('copyright')}</span>
        <span className="text-center sm:text-right">
          {t('disclaimer')}
        </span>
      </div>
    </footer>
  )
}
