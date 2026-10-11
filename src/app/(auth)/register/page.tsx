'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ShieldLogo, Spinner } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from '@/contexts/TranslationContext'
import { ArrowRight, Mail, Lock, User, Phone, Check, X, ShieldAlert } from 'lucide-react'
import { toast } from 'react-hot-toast'

export default function RegisterPage() {
  const { register } = useAuth()
  const { t } = useTranslation('auth')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  })
  const [isLoading, setIsLoading] = useState(false)

  // Password strength checks
  const passwordLengthValid = formData.password.length >= 12 && formData.password.length <= 128
  const allChecksPassed = passwordLengthValid

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      toast.error(t('passwordsNoMatch'))
      return
    }

    if (!allChecksPassed) {
      toast.error(t('passwordRequirements'))
      return
    }

    setIsLoading(true)
    try {
      let formattedPhone = formData.phone.trim()
      if (formattedPhone && !formattedPhone.startsWith('+')) {
        formattedPhone = formattedPhone.startsWith('91') ? '+' + formattedPhone : '+91' + formattedPhone
      }
      
      await register(
        formData.name,
        formData.email,
        formattedPhone || '',
        formData.password
      )
    } catch (error) {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen relative flex items-center justify-center p-6 py-12">
      {/* Background */}
      <div className="absolute inset-0 cyber-grid-bg opacity-20 z-0" />
      <div className="glow-blob bg-purple-500/20 w-[500px] h-[500px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      
      <Link href="/" className="absolute top-8 left-8 z-20 flex items-center gap-2 hover:opacity-80 transition-opacity">
        <ShieldLogo className="w-8 h-8" />
        <span className="text-xl font-black tracking-tight">Cyber<span className="text-cyan-400">Shield</span></span>
      </Link>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass rounded-3xl p-8 md:p-12 w-full max-w-lg relative z-10 shadow-2xl shadow-purple-900/20 my-auto"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black mb-2 tracking-tight">{t('createAccount')}</h1>
          <p className="text-slate-400 text-sm">{t('joinCyberShield')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-300 ml-1">{t('fullName')}</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input 
                type="text" 
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="input pl-12"
                placeholder={t('namePlaceholder')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-300 ml-1">{t('emailAddress')}</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  type="email" 
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="input pl-12"
                  placeholder={t('emailPlaceholder')}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-300 ml-1">{t('phoneOptional')}</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  type="tel" 
                  name="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                  className="input pl-12"
                  maxLength={10}
                  placeholder="98765 43210"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-300 ml-1">{t('password')}</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input 
                type="password" 
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={12}
                maxLength={128}
                className="input pl-12"
                placeholder="••••••••"
              />
            </div>
            
            {/* Password strength indicators */}
            {formData.password && (
              <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-2 mt-2">
                <p className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-purple-400" /> {t('passwordGuidelines')}
                </p>
                <span className={`flex items-center gap-1.5 text-xs ${passwordLengthValid ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {passwordLengthValid ? <Check size={12} /> : <X size={12} />}
                  Use 12–128 characters; composition rules are not required.
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-300 ml-1">{t('confirmPassword')}</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input 
                type="password" 
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                minLength={12}
                maxLength={128}
                className="input pl-12"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit" 
              disabled={isLoading || !formData.name || !formData.email || !formData.password || !allChecksPassed}
              className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? <Spinner size={20} className="text-white" /> : t('createAccount')} 
              {!isLoading && <ArrowRight className="w-5 h-5" />}
            </button>
          </div>
        </form>

        <div className="mt-8 text-center text-sm text-slate-400">
          <p>
            {t('alreadyHaveAccount')} <Link href="/login" className="text-cyan-400 hover:underline font-semibold">{t('signIn')}</Link>
          </p>
        </div>
      </motion.div>
    </main>
  )
}
