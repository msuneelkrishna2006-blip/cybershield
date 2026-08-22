'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ShieldLogo } from '@/components/ui'
import { Shield, Bot, Bell, Users, Search, Heart, ArrowRight, ShieldCheck, CheckCircle2, Menu, X } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import { useTranslation } from '@/contexts/TranslationContext'

export default function LandingPage() {
  const { t } = useTranslation('landing')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [stats, setStats] = useState<any>({
    totalScans: 0,
    totalUsers: 0,
    threatsDetected: 0,
    topCategories: []
  })
  const [dataQuality, setDataQuality] = useState<string>('')

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/v1/threats/stats')
        const json = await res.json()
        if (json.success && json.data) {
          setStats(json.data.stats)
          setDataQuality(json.data.dataQuality)
        }
      } catch (err) {
        console.error('Failed to fetch stats', err)
      }
    }
    fetchStats()
  }, [])

  return (
    <main className="min-h-screen relative overflow-hidden bg-[#0A0E1A] font-sans text-slate-200">
      {/* Tricolor Accent Bar */}
      <div className="tricolor-accent-bar" />
      
      {/* Cyber Grid & Hero Radial Glow */}
      <div className="absolute inset-0 cyber-grid-bg opacity-20 z-0 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] pointer-events-none z-0 bg-[radial-gradient(#1E3A5F_0%,transparent_70%)] opacity-85" />

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-[#0A0E1A]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldLogo className="w-8 h-8" />
            <span className="text-xl font-bold tracking-tight text-white font-display">
              Cyber<span className="text-[#22D3EE]">Shield</span>
            </span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <Link href="#features" className="hover:text-white transition-colors">{t('navFeatures')}</Link>
            <Link href="/about" className="hover:text-white transition-colors">{t('navAbout')}</Link>
            <Link href="/contact" className="hover:text-white transition-colors">{t('navContact')}</Link>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            <Link href="/login" className="text-sm font-semibold text-slate-300 hover:text-white transition-colors">
              {t('navLogin')}
            </Link>
            <Link href="/register" className="bg-[#3D5AFE] hover:bg-[#3D5AFE]/95 hover:scale-[1.02] text-white text-sm font-bold px-5 py-2.5 rounded-lg transition-all shadow-[0_4px_12px_rgba(61,90,254,0.3)]">
              {t('navGetStarted')}
            </Link>
          </div>

          {/* Hamburger Menu Toggle */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white focus:outline-none"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu panel */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0A0E1A] border-b border-white/5 px-6 py-4 flex flex-col gap-4 text-sm font-semibold text-slate-300 animate-in fade-in slide-in-from-top-2 duration-200">
            <Link href="#features" onClick={() => setMobileMenuOpen(false)} className="hover:text-white py-1 transition-colors">{t('navFeatures')}</Link>
            <Link href="/about" onClick={() => setMobileMenuOpen(false)} className="hover:text-white py-1 transition-colors">{t('navAbout')}</Link>
            <Link href="/contact" onClick={() => setMobileMenuOpen(false)} className="hover:text-white py-1 transition-colors">{t('navContact')}</Link>
            <hr className="border-white/5 my-1" />
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="hover:text-white py-1 transition-colors">{t('navLogin')}</Link>
            <Link href="/register" onClick={() => setMobileMenuOpen(false)} className="bg-[#3D5AFE] hover:bg-[#3D5AFE]/95 text-white text-center font-bold py-2.5 rounded-lg transition-all">
              {t('navGetStarted')}
            </Link>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-28 flex flex-col items-center text-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl"
        >
          {/* Live Status Pill */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-cyan-950/30 border border-[#22D3EE]/20 text-[#22D3EE] font-semibold text-xs md:text-sm mb-8 tracking-wide">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22D3EE] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22D3EE]"></span>
            </span>
            {t('heroTag')}
          </div>
          
          {/* Hero H1 with custom clamp sizing */}
          <h1 className="font-display font-extrabold text-[clamp(2.25rem,6vw,4.75rem)] text-white mb-6 leading-[1.05] tracking-tight max-w-4xl mx-auto">
            India's AI Guardian for<br />Digital Safety
          </h1>
          
          {/* Subhead text */}
          <p className="font-sans font-medium text-lg md:text-xl text-slate-400 mb-10 max-w-[700px] mx-auto leading-relaxed">
            {t('heroSubtitle')}
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 w-full sm:w-auto">
            <Link href="/register" className="bg-[#3D5AFE] hover:bg-[#3D5AFE]/95 hover:scale-[1.02] hover:translate-y-[-1px] transition-all text-white font-bold py-3.5 px-8 rounded-xl shadow-[0_4px_14px_rgba(61,90,254,0.35)] flex items-center justify-center gap-2 w-full sm:w-auto">
              {t('getProtected')} <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="#features" className="bg-transparent border border-white/10 hover:border-white/30 hover:bg-white/[0.02] text-white font-bold py-3.5 px-8 rounded-xl transition-all w-full sm:w-auto">
              {t('viewFeatures')}
            </Link>
          </div>
          
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 max-w-4xl mx-auto border-t border-white/10 pt-8">
            <div className="flex flex-col gap-1">
              <span className="text-3xl font-black text-white drop-shadow-sm">{stats.totalScans.toLocaleString()}</span>
              <span className="text-xs font-bold text-slate-500 uppercase">Total Scans</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-3xl font-black text-white drop-shadow-sm">{stats.threatsDetected.toLocaleString()}</span>
              <span className="text-xs font-bold text-slate-500 uppercase">Threats Detected</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-3xl font-black text-white drop-shadow-sm">{stats.totalUsers.toLocaleString()}</span>
              <span className="text-xs font-bold text-slate-500 uppercase">Total Users</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-3xl font-black text-white drop-shadow-sm">
                {stats.topCategories && stats.topCategories.length > 0 ? stats.topCategories[0].category : 'None'}
              </span>
              <span className="text-xs font-bold text-slate-500 uppercase">Top Threat</span>
            </div>
          </div>
          {dataQuality !== 'production' && (
            <div className="mt-4 text-xs font-medium text-slate-400 bg-white/5 inline-block px-3 py-1.5 rounded-lg border border-white/10 mx-auto">
              Statistics reflect actual platform usage.
            </div>
          )}
        </motion.div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-24 border-y border-white/5">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black mb-4 font-display leading-tight">{t('completeProtection')}</h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">{t('completeProtectionDesc')}</p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: <Search className="w-8 h-8 text-[#22D3EE]" />, titleKey: 'featureScamScanner', descKey: 'featureScamScannerDesc', color: 'bg-cyan-400/10' },
            { icon: <Shield className="w-8 h-8 text-purple-400" />, titleKey: 'featureChildSafety', descKey: 'featureChildSafetyDesc', color: 'bg-purple-400/10' },
            { icon: <Bot className="w-8 h-8 text-emerald-400" />, titleKey: 'featureAiGuardian', descKey: 'featureAiGuardianDesc', color: 'bg-emerald-400/10' },
            { icon: <Heart className="w-8 h-8 text-pink-400" />, titleKey: 'featureWomenSafety', descKey: 'featureWomenSafetyDesc', color: 'bg-pink-400/10' },
            { icon: <Users className="w-8 h-8 text-blue-400" />, titleKey: 'featureFamilyCircle', descKey: 'featureFamilyCircleDesc', color: 'bg-blue-400/10' },
            { icon: <Bell className="w-8 h-8 text-orange-400" />, titleKey: 'featureEmergency', descKey: 'featureEmergencyDesc', color: 'bg-orange-400/10' },
          ].map((f, i) => (
            <div key={i} className="card-hover p-8 group">
              <div className={`w-16 h-16 rounded-2xl ${f.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                {f.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{t(f.titleKey)}</h3>
              <p className="text-slate-400 leading-relaxed">{t(f.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Built for India */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1">
            <h2 className="text-3xl md:text-5xl font-black mb-6 font-display leading-tight">{t('builtForIndia')}</h2>
            <p className="text-lg text-slate-400 mb-8 leading-relaxed">
              {t('builtForIndiaDesc')}
            </p>
            <div className="space-y-4">
              {[
                t('threatDigitalArrest'),
                t('threatOtpFraud'),
                t('threatUpiScam'),
                t('threatJobScam'),
                t('threatLoanApp')
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                  <span className="font-semibold text-slate-200">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 w-full">
            <div className="glass p-8 rounded-3xl relative">
              <div className="absolute -top-4 -right-4 bg-red-500 text-white text-xs font-black uppercase px-4 py-2 rounded-full rotate-12 shadow-neon-red animate-pulse">
                {t('demoBlocked')}
              </div>
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
                  <span className="text-xl">⚠️</span>
                </div>
                <div>
                  <h4 className="font-bold text-lg">{t('demoSuspicious')}</h4>
                  <p className="text-xs text-slate-400">{t('demoReceived')}</p>
                </div>
              </div>
              <div className="bg-black/50 p-4 rounded-xl border border-white/5 mb-6 text-sm text-slate-300 font-mono">
                "Dear Customer, your HDFC bank account will be blocked today due to pending PAN KYC. Click here immediately to update: http://hdfc-kyc-update-net.com"
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span className="font-bold text-red-400">{t('demoRisk')}</span>
                </div>
                <p className="text-sm text-red-200/70">
                  This is a known phishing attack. HDFC Bank will never ask you to update KYC via an SMS link.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="bg-[#131A2C]/80 backdrop-blur-md border border-white/10 rounded-3xl p-12 md:p-20 max-w-5xl mx-auto relative overflow-hidden shadow-2xl">
          <div className="relative z-10 flex flex-col items-center">
            <h2 className="font-display font-bold text-3xl md:text-5xl text-white mb-4 leading-tight tracking-tight">
              {t('readyToSecure')}
            </h2>
            <p className="font-sans font-medium text-slate-400 text-lg md:text-xl mb-8 max-w-2xl mx-auto leading-relaxed">
              {t('readyToSecureDesc')}
            </p>
            <Link href="/register" className="bg-[#3D5AFE] hover:bg-[#3D5AFE]/95 hover:scale-[1.02] hover:translate-y-[-1px] text-white font-bold py-4 px-10 rounded-xl transition-all shadow-[0_4px_14px_rgba(61,90,254,0.35)] text-lg mb-4 w-full sm:w-auto">
              {t('createFreeAccount')}
            </Link>
            <div className="flex items-center gap-1.5 text-emerald-400 text-sm font-semibold mt-2">
              <CheckCircle2 className="w-4 h-4 animate-pulse" />
              <span>{t('takesLessThan60')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </main>
  )
}
