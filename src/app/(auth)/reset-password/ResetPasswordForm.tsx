'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const reset = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    try {
      const response = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const result = await response.json()
      setMessage(result.data?.message || result.error?.message || 'Password reset failed. Request a new link.')
    } catch {
      setMessage('Password reset failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={reset} className="glass rounded-3xl p-8 w-full max-w-lg space-y-5">
        <h1 className="text-2xl font-black text-center">Reset your password</h1>
        <label className="block text-sm font-semibold text-slate-300" htmlFor="new-password">New password</label>
        <input
          id="new-password"
          className="input"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          value={password}
          onChange={event => setPassword(event.target.value)}
        />
        <button className="btn-primary w-full py-3" disabled={loading || !token}>
          {loading ? 'Resetting…' : 'Set new password'}
        </button>
        {message && <p role="status" className="text-sm text-cyan-300">{message}</p>}
        <p className="text-center"><Link href="/login" className="text-cyan-400 hover:underline">Back to sign in</Link></p>
      </form>
    </main>
  )
}
