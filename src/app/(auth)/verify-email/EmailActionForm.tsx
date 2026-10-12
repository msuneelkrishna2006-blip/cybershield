'use client'

import { useState } from 'react'

export function EmailActionForm({ token }: { token: string }) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const verify = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/v1/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const result = await response.json()
      setMessage(result.data?.message || result.error?.message || 'Verification failed. Request a new link.')
    } catch {
      setMessage('Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="glass rounded-3xl p-8 w-full max-w-lg text-center space-y-5">
        <h1 className="text-2xl font-black">Verify your email</h1>
        <p className="text-slate-400">Confirm your email address to activate your CyberShield account.</p>
        <button className="btn-primary w-full py-3" disabled={loading || !token} onClick={verify}>
          {loading ? 'Verifying…' : 'Verify email'}
        </button>
        {message && <p role="status" className="text-sm text-cyan-300">{message}</p>}
      </section>
    </main>
  )
}
