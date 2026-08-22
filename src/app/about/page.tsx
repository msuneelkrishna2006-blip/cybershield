'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ShieldLogo } from '@/components/ui'
import { Shield, Bot, Eye, Users, AlertTriangle, ArrowRight, Heart } from 'lucide-react'
import Footer from '@/components/layout/Footer'

export default function AboutPage() {
  return (
    <main className="min-h-screen relative overflow-hidden flex flex-col justify-between">
      {/* Tricolor Accent Bar */}
      <div className="tricolor-accent-bar" />
      
      {/* Cyber Grid & Blobs */}
      <div className="absolute inset-0 cyber-grid-bg opacity-30 z-0" />
      <div className="glow-blob bg-cyan-500/10 w-[600px] h-[600px] top-[-100px] left-[-200px]" />
      <div className="glow-blob bg-purple-500/10 w-[500px] h-[500px] bottom-[200px] right-[-100px]" />

      <div>
        {/* Navbar */}
        <nav className="relative z-10 container-custom px-6 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-85 transition-opacity">
            <ShieldLogo className="w-10 h-10" />
            <span className="text-2xl font-black tracking-tight text-white">
              Cyber<span className="text-cyan-400">Shield</span>
            </span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <Link href="/" className="hover:text-white transition-colors">Features</Link>
            <Link href="/about" className="text-white transition-colors">About</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>
          
          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden md:block text-sm font-semibold text-slate-300 hover:text-white">
              Login
            </Link>
            <Link href="/register" className="btn-primary text-xs sm:text-sm">
              Get Started
            </Link>
          </div>
        </nav>

        {/* Content Body */}
        <section className="relative z-10 container-custom px-6 pt-16 pb-20 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight text-white">
              About <span className="gradient-text-accent">CyberShield</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
              CyberShield 2.0 is India's independent digital protection network, engineered to protect Indian households from the rising tide of cybercrime, online financial fraud, and digital safety hazards.
            </p>
          </motion.div>

          {/* Stats Segment */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto border-y border-white/10 py-10 mb-16 bg-white/[0.02] rounded-3xl p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <span className="text-4xl font-black text-white mb-2">2.4M+</span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Users Protected</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center">
              <span className="text-4xl font-black text-white mb-2">8.7M+</span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Threats Blocked</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center">
              <span className="text-4xl font-black text-white mb-2">28</span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">States Covered</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center">
              <span className="text-4xl font-black text-white mb-2">97.2%</span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Success Rate</span>
            </div>
          </div>

          {/* Vision Blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            <div className="glass rounded-3xl p-8 border border-white/10 flex flex-col gap-4">
              <Shield className="w-10 h-10 text-cyan-400" />
              <h3 className="text-2xl font-black text-white tracking-tight">Our Mission</h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                As the digital economy grows in India, so do scam complexities like Digital Arrests, UPI collect request scams, and KYC phishing. Our mission is to democratize digital safety tools, offering real-time prevention interfaces that protect family finances, child wellbeing, and elderly security.
              </p>
            </div>
            <div className="glass rounded-3xl p-8 border border-white/10 flex flex-col gap-4">
              <Bot className="w-10 h-10 text-purple-400" />
              <h3 className="text-2xl font-black text-white tracking-tight">AI-Powered Defense</h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                By processing suspicious WhatsApp messages, link URLs, and payment QR codes with advanced language-detecting models, CyberShield acts as an immediate safety firewall. Our local OCR scanning parses screenshot threats in regional languages, warning users before financial losses occur.
              </p>
            </div>
          </div>

          {/* How It Works List */}
          <div className="space-y-6">
            <h3 className="text-3xl font-black text-white tracking-tight mb-8 text-center">How We Protect You</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  icon: Eye,
                  color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
                  title: 'Real-Time Interception',
                  desc: 'Paste links, upload QR codes, or report messages to scan for signatures of active financial fraud.'
                },
                {
                  icon: Users,
                  color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
                  title: 'Unified Family Dashboard',
                  desc: 'Link multiple devices to observe digital safety scores, manage content restrictions, and coordinate SOS alerts.'
                },
                {
                  icon: Heart,
                  color: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
                  title: 'SOS Emergency Networks',
                  desc: 'Activate immediate location broadcasting and call alerts for your family circle in security emergencies.'
                }
              ].map((step, idx) => {
                const Icon = step.icon
                return (
                  <div key={idx} className="glass rounded-3xl p-6 border border-white/5 flex flex-col gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${step.color}`}>
                      <Icon size={22} />
                    </div>
                    <h4 className="font-extrabold text-white text-lg tracking-tight">{step.title}</h4>
                    <p className="text-slate-400 text-xs leading-relaxed">{step.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </main>
  )
}
