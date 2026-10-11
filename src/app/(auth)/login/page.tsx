'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ShieldLogo, Spinner } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from '@/contexts/TranslationContext'
import { ArrowRight, Mail, Lock, Phone, ShieldCheck, AlertCircle, Info } from 'lucide-react'
import ReCAPTCHA from 'react-google-recaptcha'

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export default function LoginPage() {
  const { login, sendOtp, verifyOtp } = useAuth()
  const { t } = useTranslation('auth')
  
  // Tab states: 'mobile' | 'email' | 'aadhaar'
  const [activeTab, setActiveTab] = useState<'mobile' | 'email' | 'aadhaar'>('mobile')
  const [isLoading, setIsLoading] = useState(false)

  // Email form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Mobile form states
  const [phone, setPhone] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [devOtpCode, setDevOtpCode] = useState('') // Helper for local testing
  const [otpLoading, setOtpLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const recaptchaRef = useRef<ReCAPTCHA | null>(null)
  const captchaTokenRef = useRef<string | null>(null) // Mirror of captchaToken for use in closures

  // 6-digit OTP states
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [shake, setShake] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  // Resend and lockout states
  const [timer, setTimer] = useState(30)
  const [resendCount, setResendCount] = useState(0)
  const [resendLocked, setResendLocked] = useState(false)
  const [resendLockoutTimer, setResendLockoutTimer] = useState(0)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockoutTimer, setLockoutTimer] = useState(0)

  const otpRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null))

  // Keep captchaTokenRef in sync with state
  useEffect(() => {
    captchaTokenRef.current = captchaToken
  }, [captchaToken])

  // Helper: reset reCAPTCHA widget and clear token
  const resetCaptcha = () => {
    setCaptchaToken(null)
    captchaTokenRef.current = null
    try {
      if (recaptchaRef.current) {
        recaptchaRef.current.reset()
      }
    } catch (err) {
      console.error('reCAPTCHA reset error', err)
    }
  }

  // Resend Countdown
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (otpSent && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => prev - 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [otpSent, timer])

  // Resend Cooldown Lockout (10 minutes = 600 seconds)
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (resendLockoutTimer > 0) {
      interval = setInterval(() => {
        setResendLockoutTimer(prev => {
          if (prev <= 1) {
            setResendLocked(false)
            setResendCount(0)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [resendLockoutTimer])

  // Failed Attempts Lockout (60 seconds)
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (lockoutTimer > 0) {
      interval = setInterval(() => {
        setLockoutTimer(prev => prev - 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [lockoutTimer])

  // Auto-focus box 1 on load
  useEffect(() => {
    if (otpSent) {
      setTimeout(() => {
        otpRefs.current[0]?.focus()
      }, 100)
    }
  }, [otpSent])

  // WebOTP API integration
  useEffect(() => {
    if (otpSent && 'OTPCredential' in window) {
      const ac = new AbortController()
      navigator.credentials.get({
        otp: { transport: ['sms'] },
        signal: ac.signal
      } as CredentialRequestOptions & { otp: { transport: string[] } }).then(otpCred => {
        if (otpCred && 'code' in otpCred && typeof otpCred.code === 'string') {
          const code = otpCred.code.slice(0, 6)
          const newDigits = [...otpDigits]
          for (let i = 0; i < 6; i++) {
            newDigits[i] = code[i] || ''
          }
          setOtpDigits(newDigits)
          submitOtp(code)
        }
      }).catch(() => {
        // Fail silently
      })
      return () => ac.abort()
    }
  }, [otpSent])

  // Digit Input Handler
  const handleDigitChange = (value: string, index: number) => {
    const cleanVal = value.replace(/\D/g, '')
    if (!cleanVal) {
      const newDigits = [...otpDigits]
      newDigits[index] = ''
      setOtpDigits(newDigits)
      return
    }

    const newDigits = [...otpDigits]
    newDigits[index] = cleanVal[cleanVal.length - 1]
    setOtpDigits(newDigits)

    // Focus next box
    if (index < 5) {
      otpRefs.current[index + 1]?.focus()
    }

    // Auto submit if fully filled
    const updatedCode = newDigits.join('')
    if (updatedCode.length === 6 && index === 5) {
      submitOtp(updatedCode)
    }
  }

  // Keydown Backspace handling
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        const newDigits = [...otpDigits]
        newDigits[index - 1] = ''
        setOtpDigits(newDigits)
        otpRefs.current[index - 1]?.focus()
        e.preventDefault()
      } else {
        const newDigits = [...otpDigits]
        newDigits[index] = ''
        setOtpDigits(newDigits)
      }
    }
  }

  // Paste handler
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').trim()
    const cleanDigits = pastedData.replace(/\D/g, '').slice(0, 6)
    
    if (cleanDigits.length > 0) {
      const newDigits = [...otpDigits]
      for (let i = 0; i < 6; i++) {
        newDigits[i] = cleanDigits[i] || ''
      }
      setOtpDigits(newDigits)
      
      const lastIndex = Math.min(cleanDigits.length - 1, 5)
      otpRefs.current[lastIndex]?.focus()

      if (cleanDigits.length === 6) {
        submitOtp(cleanDigits)
      }
    }
  }

  // Submit OTP API handler
  const submitOtp = async (codeToSubmit?: string) => {
    const code = codeToSubmit || otpDigits.join('')
    if (code.length < 6) return
    if (lockoutTimer > 0) return

    setIsLoading(true)
    setErrorText('')
    
    const formattedPhone = '+91' + phone.trim().replace(/\D/g, '')

    try {
      await verifyOtp(formattedPhone, code)
      setIsSuccess(true)
    } catch (err: unknown) {
      setFailedAttempts(prev => {
        const next = prev + 1
        if (next >= 5) {
          setLockoutTimer(60) // Lock out for 60 seconds
          setErrorText(t('tooManyAttempts', { seconds: '60' }))
        } else {
          setErrorText(getErrorMessage(err, t('invalidOtp')))
        }
        return next
      })

      // Shake animation and reset fields
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setOtpDigits(['', '', '', '', '', ''])
      setTimeout(() => {
        otpRefs.current[0]?.focus()
      }, 50)
    } finally {
      setIsLoading(false)
    }
  }

  // Resend OTP API handler
  // Resend uses the server-side Twilio Verify resend mechanism,
  // which doesn't need a new captcha since the original session was verified.
  const handleResend = async () => {
    if (resendLocked || otpLoading) return
    
    const nextCount = resendCount + 1
    setResendCount(nextCount)
    if (nextCount >= 3) {
      setResendLocked(true)
      setResendLockoutTimer(600) // 10 minutes lock
      setErrorText(t('resendLimitReached'))
      return
    }

    setOtpLoading(true)
    setErrorText('')
    setOtpDigits(['', '', '', '', '', ''])

    const formattedPhone = '+91' + phone.trim().replace(/\D/g, '')

    try {
      // Pass null captcha for resend — the server allows resends
      // from the same session within the rate limit window
      const data = await sendOtp(formattedPhone, null)
      setTimer(30) // Reset 30s countdown
      if (data && data.devOtp) {
        setDevOtpCode(data.devOtp)
      }
      setTimeout(() => {
        otpRefs.current[0]?.focus()
      }, 50)
    } catch (err: unknown) {
      setErrorText(getErrorMessage(err, 'Failed to resend OTP'))
    } finally {
      setOtpLoading(false)
    }
  }

  const getMaskedPhone = () => {
    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length >= 10) {
      return `+91 XXXXX ${cleanPhone.slice(-5)}`
    }
    return `+91 ${phone}`
  }

  const handleChangeNumber = () => {
    setOtpSent(false)
    setPhone('')
    setDevOtpCode('')
    setOtpDigits(['', '', '', '', '', ''])
    setErrorText('')
    setFailedAttempts(0)
    setLockoutTimer(0)
  }

  // Recovery dialog mock
  const [showRecovery, setShowRecovery] = useState(false)
  const [recoveryContact, setRecoveryContact] = useState('')
  const [recoveryMessage, setRecoveryMessage] = useState('')

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorText('')
    try {
      await login(email, password)
    } catch (error) {
      setErrorText(getErrorMessage(error, 'Invalid credentials'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (!email) {
      setErrorText('Enter your email address first.')
      return
    }
    setIsLoading(true)
    try {
      const response = await fetch('/api/v1/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const result = await response.json()
      setErrorText(result.data?.message || 'If the account needs verification, a new message will be sent.')
    } catch {
      setErrorText('Unable to send a verification message. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone || otpLoading) return

    // Mobile validation regex format (exactly 10 digits starting 6–9)
    const phoneBase = phone.trim().replace(/\D/g, '')
    if (!/^[6-9]\d{9}$/.test(phoneBase)) {
      setErrorText(t('invalidMobile'))
      return
    }

    if (!captchaToken) {
      setErrorText(t('captchaRequired'))
      return
    }

    // Capture the token and immediately clear it to prevent reuse
    const tokenToSend = captchaToken
    setCaptchaToken(null)
    captchaTokenRef.current = null
    
    const formattedPhone = '+91' + phoneBase

    setOtpLoading(true)
    setErrorText('')
    try {
      const data = await sendOtp(formattedPhone, tokenToSend)
      setOtpSent(true)
      setTimer(30) // Start the 30-second resend cooldown
      if (data && data.devOtp) {
        setDevOtpCode(data.devOtp)
      }
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error, 'Failed to dispatch verification code')
      // Detect expired/invalid token errors and show a clear message
      if (errorMsg.includes('invalid-input-response') || errorMsg.includes('already-seen')) {
        setErrorText(t('captchaExpired'))
      } else {
        setErrorText(errorMsg)
      }
      // Reset the widget so user can re-solve
      resetCaptcha()
    } finally {
      setOtpLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    await submitOtp()
  }

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recoveryContact) return
    
    setIsLoading(true)
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryContact })
      })
      const data = await res.json()
      setRecoveryMessage(data.data?.message || t('recoveryNotice'))
    } catch (error) {
      setRecoveryMessage(t('recoveryError'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen relative flex items-center justify-center p-6">
      {/* Background */}
      <div className="absolute inset-0 cyber-grid-bg opacity-20 z-0" />
      <div className="glow-blob bg-cyan-500/20 w-[500px] h-[500px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      
      <Link href="/" className="absolute top-8 left-8 z-20 flex items-center gap-2 hover:opacity-80 transition-opacity">
        <ShieldLogo className="w-8 h-8" />
        <span className="text-xl font-black tracking-tight">Cyber<span className="text-cyan-400">Shield</span></span>
      </Link>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass rounded-3xl p-8 md:p-12 w-full max-w-lg relative z-10 shadow-2xl shadow-cyan-900/20"
      >
        {!showRecovery ? (
          <>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-black mb-2 tracking-tight">
                {activeTab === 'mobile' && otpSent ? t('verifyYourNumber') : t('secureSignIn')}
              </h1>
              {activeTab === 'mobile' && otpSent ? (
                <div className="text-slate-400 text-sm flex items-center justify-center gap-1.5 flex-wrap">
                  <span>{t('otpSentTo', { masked: getMaskedPhone() })}</span>
                  <button 
                    type="button" 
                    onClick={handleChangeNumber} 
                    className="text-cyan-400 hover:underline font-bold text-xs"
                  >
                    {t('changeNumber')}
                  </button>
                </div>
              ) : (
                <p className="text-slate-400 text-sm">{t('protectFamily')}</p>
              )}
            </div>

            {/* Tab Switched Header */}
            {!(activeTab === 'mobile' && otpSent) && (
              <div className="flex border-b border-white/10 mb-6 gap-2">
                <button
                  onClick={() => { setActiveTab('mobile'); setOtpSent(false); }}
                  className={`flex-1 pb-3 text-sm font-bold border-b-2 cursor-pointer transition-colors ${
                    activeTab === 'mobile' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  {t('tabMobileOtp')}
                </button>
                <button
                  onClick={() => setActiveTab('email')}
                  className={`flex-1 pb-3 text-sm font-bold border-b-2 cursor-pointer transition-colors ${
                    activeTab === 'email' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  {t('tabEmailPassword')}
                </button>
                <button
                  onClick={() => setActiveTab('aadhaar')}
                  className={`flex-1 pb-3 text-sm font-bold border-b-2 cursor-pointer transition-colors ${
                    activeTab === 'aadhaar' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  {t('tabAadhaar')}
                </button>
              </div>
            )}

            {/* Mobile OTP Auth Tab */}
            {activeTab === 'mobile' && (
              <div className="space-y-6">
                {!otpSent ? (
                  <form onSubmit={handleRequestOtp} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-300 ml-1">{t('mobileNumber')}</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <span className="absolute left-12 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold border-r border-white/10 pr-2">+91</span>
                        <input 
                          type="tel" 
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                          required
                          maxLength={10}
                          className="input pl-24"
                          placeholder="98765 43210"
                        />
                      </div>
                      <p className="text-xs text-slate-500 ml-1">{t('mobileHint')}</p>
                    </div>

                    {/* Google reCAPTCHA Bot Gating Check */}
                    <div className="flex justify-center my-4">
                      <ReCAPTCHA
                        ref={recaptchaRef}
                        sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'}
                        theme="dark"
                        onChange={(token) => {
                          setCaptchaToken(token)
                          captchaTokenRef.current = token
                        }}
                        onExpired={() => {
                          setCaptchaToken(null)
                          captchaTokenRef.current = null
                          setErrorText(t('captchaExpired'))
                        }}
                      />
                    </div>

                    <button 
                      type="submit" 
                      disabled={otpLoading || phone.length < 10}
                      className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {otpLoading ? <Spinner size={20} className="text-white" /> : t('getOtpCode')}
                      {!otpLoading && <ArrowRight className="w-5 h-5" />}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-300 ml-1">{t('verificationOtp')}</label>
                      
                      {/* 6 Digit Inputs Wrapper */}
                      <div className={`flex justify-between gap-2 sm:gap-2.5 my-6 ${shake ? 'animate-shake' : ''}`}>
                        {otpDigits.map((digit, idx) => (
                          <input
                            key={idx}
                            ref={el => { otpRefs.current[idx] = el }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            pattern="[0-9]*"
                            value={digit}
                            onChange={e => handleDigitChange(e.target.value, idx)}
                            onKeyDown={e => handleKeyDown(e, idx)}
                            onPaste={handlePaste}
                            disabled={isLoading || lockoutTimer > 0}
                            aria-label={`Digit ${idx + 1} of 6`}
                            className={`w-10 sm:w-12 h-12 sm:h-14 text-center text-xl font-black rounded-xl border bg-black/40 text-cyan-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all ${
                              shake 
                                ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' 
                                : 'border-white/10'
                            }`}
                          />
                        ))}
                      </div>

                      {/* Error & Info messages */}
                      <div aria-live="polite" className="space-y-2">
                        {errorText && (
                          <div className="flex items-center gap-1.5 text-xs text-red-400 mt-2 bg-red-950/20 border border-red-500/20 p-3 rounded-xl">
                            <AlertCircle size={14} className="shrink-0" />
                            <span>{errorText}</span>
                          </div>
                        )}

                        {lockoutTimer > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-red-400 mt-2 bg-red-950/20 border border-red-500/20 p-3 rounded-xl">
                            <AlertCircle size={14} className="shrink-0" />
                            <span>{t('tooManyAttempts', { seconds: String(lockoutTimer) })}</span>
                          </div>
                        )}

                        {/* Sandbox OTP hint (non-production builds only) */}
                        {process.env.NODE_ENV !== 'production' && devOtpCode && (
                          <div className="mt-2 bg-cyan-950/40 border border-cyan-500/20 p-3 rounded-xl flex items-center gap-2 text-xs text-cyan-300">
                            <Info size={14} className="shrink-0 text-cyan-400" />
                            <span><strong>{t('devSandboxOtp')}</strong> <code className="bg-black/40 px-1.5 py-0.5 rounded font-black tracking-widest">{devOtpCode}</code></span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button 
                      type="submit" 
                      disabled={isLoading || otpDigits.join('').length < 6 || lockoutTimer > 0}
                      className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isLoading ? <Spinner size={20} className="text-white" /> : t('verifyOtp')}
                      {!isLoading && <ShieldCheck className="w-5 h-5" />}
                    </button>

                    {/* Resend Link and countdown */}
                    <div className="text-center text-xs text-slate-400 mt-4">
                      {resendLocked ? (
                        <div className="text-red-400 font-semibold bg-red-950/20 border border-red-500/20 p-2.5 rounded-xl inline-block w-full">
                          {t('resendCooldown', { time: `${Math.ceil(resendLockoutTimer / 60)}m ${resendLockoutTimer % 60}s` })}
                        </div>
                      ) : timer > 0 ? (
                        <span>{t('resendIn', { time: timer < 10 ? `0${timer}` : String(timer) })}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResend}
                          disabled={otpLoading}
                          className="text-cyan-400 hover:underline font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          {otpLoading ? <Spinner size={12} className="text-cyan-400" /> : t('resendOtp')}
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Email/Password Auth Tab */}
            {activeTab === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300 ml-1">{t('emailAddress')}</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="input pl-12"
                      placeholder="name@cybershield.in"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-sm font-semibold text-slate-300">{t('password')}</label>
                    <button 
                      type="button"
                      onClick={() => { setShowRecovery(true); setRecoveryMessage(''); }}
                      className="text-xs text-cyan-400 hover:underline"
                    >
                      {t('forgotPassword')}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      maxLength={128}
                      className="input pl-12"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isLoading || !email || !password}
                  className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? <Spinner size={20} className="text-white" /> : t('signIn')} 
                  {!isLoading && <ArrowRight className="w-5 h-5" />}
                </button>
                <div aria-live="polite" className="text-center text-sm text-slate-300">
                  {errorText}
                </div>
                <button type="button" onClick={handleResendVerification} disabled={isLoading} className="w-full text-sm text-cyan-400 hover:underline">
                  Resend email verification
                </button>
              </form>
            )}

            {/* Aadhaar eKYC Auth Tab */}
            {activeTab === 'aadhaar' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300 ml-1">{t('aadhaarVid')}</label>
                  <div className="relative opacity-60">
                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input 
                      type="text" 
                      disabled
                      className="input pl-12"
                      placeholder="•••• •••• ••••"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex gap-3 text-xs text-amber-300 leading-relaxed">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    {t('aadhaarWarning')}
                  </div>
                </div>

                <button 
                  disabled 
                  className="w-full bg-slate-800 border border-slate-700 text-slate-500 font-bold py-4 rounded-xl cursor-not-allowed text-lg"
                >
                  {t('aadhaarDisabled')}
                </button>
              </div>
            )}

            <div className="mt-8 text-center text-sm text-slate-400">
              <p className="mb-4">
                {t('noAccount')} <Link href="/register" className="text-cyan-400 hover:underline font-semibold">{t('createAccount')}</Link>
              </p>
            </div>
          </>
        ) : (
          <form onSubmit={handleRecoverySubmit} className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-black mb-2 tracking-tight">{t('accountRecovery')}</h1>
              <p className="text-slate-400 text-sm">{t('recoverAccess')}</p>
            </div>

            {recoveryMessage && (
              <div className="p-4 rounded-xl bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 text-xs text-center leading-relaxed">
                {recoveryMessage}
              </div>
            )}

            {!recoveryMessage && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300 ml-1">{t('emailAddress')}</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                    type="email"
                      value={recoveryContact}
                      onChange={(e) => setRecoveryContact(e.target.value)}
                      required
                      placeholder="name@cybershield.in"
                      className="input pl-12"
                    />
                  </div>
                  <p className="text-xs text-slate-500 ml-1">{t('recoveryNotice')}</p>
                </div>

                <button 
                  type="submit" 
                  disabled={isLoading || !recoveryContact}
                  className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? <Spinner size={20} className="text-white" /> : t('sendRecovery')}
                  {!isLoading && <ArrowRight className="w-5 h-5" />}
                </button>
              </div>
            )}

            <div className="text-center">
              <button 
                type="button" 
                onClick={() => setShowRecovery(false)} 
                className="text-xs text-slate-400 hover:text-white underline"
              >
                {t('backToSignIn')}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </main>
  )
}
