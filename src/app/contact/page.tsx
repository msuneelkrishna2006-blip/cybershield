'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ShieldLogo, Spinner } from '@/components/ui'
import { 
  ShieldAlert, Phone, Mail, User, Send, Building, 
  ExternalLink, CheckCircle2, ShieldAlert as GovernmentIcon, AlertTriangle 
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import Footer from '@/components/layout/Footer'

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    contactInfo: '',
    category: 'general',
    message: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Submission failed')
      }

      toast.success('Your support ticket has been created!')
      setSubmitted(true)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const govResources = [
    {
      name: "National Cyber Crime Reporting Portal",
      authority: "Ministry of Home Affairs, Government of India",
      desc: "Official legal portal to file cyber fraud, financial theft, and harassment complaints.",
      href: "https://cybercrime.gov.in",
      helpline: "1930 (Toll-Free, 24x7)"
    },
    {
      name: "CERT-In (Indian Computer Emergency Response Team)",
      authority: "Ministry of Electronics & Information Technology",
      desc: "National agency for incident response, vulnerability reporting, and threat advisories.",
      href: "https://www.cert-in.org.in"
    },
    {
      name: "National Emergency Response System",
      authority: "Government of India",
      desc: "Emergency unified response line for police, fire, health, and rescue support.",
      helpline: "112 (Universal Emergency Number)"
    },
    {
      name: "Women Safety Helpline",
      authority: "Government of India",
      desc: "National dedicated helpline for women safety, domestic support, and stalking concerns.",
      helpline: "181 (Toll-Free, 24x7)"
    },
    {
      name: "Childline India",
      authority: "Ministry of Women and Child Development",
      desc: "Dedicated protection network for minors, children in distress, and POCSO alerts.",
      helpline: "1098 (Toll-Free, 24x7)"
    }
  ]

  return (
    <main className="min-h-screen relative overflow-hidden flex flex-col justify-between">
      {/* Tricolor Accent Bar */}
      <div className="tricolor-accent-bar" />
      
      {/* Cyber Grid & Blobs */}
      <div className="absolute inset-0 cyber-grid-bg opacity-30 z-0" />
      <div className="glow-blob bg-cyan-500/10 w-[600px] h-[600px] top-[-100px] right-[-200px]" />
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
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
            <Link href="/contact" className="text-white transition-colors">Contact</Link>
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
        <section className="relative z-10 container-custom px-6 pt-16 pb-20 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight text-white">
              Get In <span className="gradient-text-accent">Touch</span>
            </h1>
            <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Submit a secure support ticket below to connect with CyberShield safety experts, or consult official government enforcement channels.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-5xl mx-auto">
            
            {/* Contact Form Section */}
            <div className="lg:col-span-6">
              <div className="glass rounded-3xl p-6 sm:p-8 border border-white/10 relative shadow-xl">
                <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2">
                  <Mail className="text-cyan-400 w-5 h-5" /> Support Ticket Form
                </h3>

                {!submitted ? (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                          type="text" 
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                          className="input pl-11 py-3 text-sm"
                          placeholder="Arjun Sharma"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email or Mobile Number</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                          type="text" 
                          value={formData.contactInfo}
                          onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
                          required
                          className="input pl-11 py-3 text-sm"
                          placeholder="arjun@cybershield.in or +919876543210"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ticket Category</label>
                      <select 
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="input py-3 text-sm bg-black"
                      >
                        <option value="scam">Report a scam / Suspicious Link</option>
                        <option value="account">Account help / Subscription</option>
                        <option value="general">General Inquiry</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Describe your Issue</label>
                      <textarea 
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        required
                        rows={4}
                        className="textarea text-sm"
                        placeholder="Please details the threat vector, link URL, or problem you are experiencing..."
                      />
                    </div>

                    <div className="pt-2">
                      <button 
                        type="submit" 
                        disabled={isLoading}
                        className="btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isLoading ? <Spinner size={16} className="text-white" /> : 'Send Ticket'}
                        {!isLoading && <Send size={16} />}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto animate-pulse">
                      <CheckCircle2 size={32} />
                    </div>
                    <h4 className="font-extrabold text-white text-lg tracking-tight">Ticket Submitted!</h4>
                    <p className="text-slate-400 text-xs leading-relaxed max-w-sm mx-auto">
                      Thank you. We have recorded your submission in our security vault. A representative will contact you via your email/phone shortly.
                    </p>
                    <button 
                      onClick={() => { setSubmitted(false); setFormData({ name: '', contactInfo: '', category: 'general', message: '' }); }}
                      className="text-xs font-bold text-cyan-400 hover:underline cursor-pointer"
                    >
                      Submit another ticket
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Government Resources Section */}
            <div className="lg:col-span-6 space-y-6">
              {/* Disclaimer Callout Box */}
              <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block mb-1 text-sm font-black">Official Affiliation Disclaimer</strong>
                  CyberShield is an independent, community-driven digital safety platform. We are not partnered with, certified by, or officially affiliated with the Government of India. For direct law-enforcement complaints and legal reports, always submit complaints to the official channels below.
                </div>
              </div>

              <div className="glass rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6 shadow-xl">
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <GovernmentIcon className="text-purple-400 w-5 h-5" /> Official Government Channels
                </h3>

                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                  {govResources.map((res, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2 hover:bg-white/10 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-extrabold text-white text-sm tracking-tight">{res.name}</h4>
                          <span className="text-[10px] text-slate-500 font-bold block">{res.authority}</span>
                        </div>
                        <a 
                          href={res.href || `tel:${res.helpline?.split(' ')[0]}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                      
                      <p className="text-slate-400 text-[11px] leading-relaxed">{res.desc}</p>
                      
                      {res.helpline && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-[10px] font-black text-purple-400">
                          <Phone size={10} /> {res.helpline}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </section>
      </div>

      <Footer />
    </main>
  )
}
