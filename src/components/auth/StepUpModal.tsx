'use client'

import { useState, type FormEvent } from 'react'

type StepUpMethod = 'password' | 'totp' | 'phone'

export interface StepUpCredentials {
  method: StepUpMethod
  password?: string
  code?: string
  phone?: string
}

interface StepUpModalProps {
  open: boolean
  onCancel: () => void
  onAuthenticate: (credentials: StepUpCredentials) => Promise<void>
}

async function readResponse(response: Response) {
  const result = await response.json()
  if (!response.ok || !result.success) {
    throw new Error(result.error?.message || 'Re-authentication failed.')
  }
  return result
}

export function StepUpModal({ open, onCancel, onAuthenticate }: StepUpModalProps) {
  const [method, setMethod] = useState<StepUpMethod>('password')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneCodeSent, setPhoneCodeSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const requestPhoneCode = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/v1/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone, purpose: 'step_up' }),
      })
      await readResponse(response)
      setPhoneCodeSent(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to request a verification code.')
    } finally {
      setLoading(false)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await onAuthenticate({
        method,
        ...(method === 'password' ? { password } : {}),
        ...(method === 'totp' ? { code } : {}),
        ...(method === 'phone' ? { phone, code } : {}),
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Re-authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="presentation">
      <section
        aria-labelledby="step-up-title"
        aria-modal="true"
        className="w-full max-w-md space-y-5 rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl"
        role="dialog"
      >
        <div>
          <h2 id="step-up-title" className="text-xl font-bold text-white">Confirm it’s you</h2>
          <p className="mt-1 text-sm text-slate-400">Re-authenticate to continue with this sensitive action.</p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Re-authentication method">
          {(['password', 'totp', 'phone'] as const).map(value => (
            <button
              key={value}
              type="button"
              aria-pressed={method === value}
              onClick={() => {
                setMethod(value)
                setError('')
              }}
              className={`rounded-lg px-3 py-2 text-sm ${method === value ? 'bg-cyan-600 text-white' : 'bg-white/5 text-slate-300'}`}
            >
              {value === 'totp' ? 'Authenticator' : value === 'phone' ? 'Phone OTP' : 'Password'}
            </button>
          ))}
        </div>
        <form className="space-y-4" onSubmit={submit}>
          {method === 'password' && (
            <input
              autoComplete="current-password"
              autoFocus
              className="input w-full"
              onChange={event => setPassword(event.target.value)}
              placeholder="Current password"
              required
              type="password"
              value={password}
            />
          )}
          {method === 'totp' && (
            <input
              autoComplete="one-time-code"
              autoFocus
              className="input w-full"
              inputMode="numeric"
              maxLength={6}
              onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit authenticator code"
              required
              value={code}
            />
          )}
          {method === 'phone' && (
            <>
              <input
                autoComplete="tel"
                className="input w-full"
                onChange={event => setPhone(event.target.value)}
                placeholder="+91XXXXXXXXXX"
                required
                value={phone}
              />
              {!phoneCodeSent ? (
                <button
                  className="btn-primary w-full"
                  disabled={loading || !phone}
                  onClick={event => {
                    event.preventDefault()
                    void requestPhoneCode()
                  }}
                  type="button"
                >
                  Send verification code
                </button>
              ) : (
                <input
                  autoComplete="one-time-code"
                  className="input w-full"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit SMS code"
                  required
                  value={code}
                />
              )}
            </>
          )}
          {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
          <div className="flex justify-end gap-3">
            <button className="rounded-lg px-4 py-2 text-sm text-slate-300" onClick={onCancel} type="button">
              Cancel
            </button>
            {(method !== 'phone' || phoneCodeSent) && (
              <button
                className="btn-primary px-4"
                disabled={loading || (method === 'password' ? !password : code.length !== 6)}
                type="submit"
              >
                {loading ? 'Verifying…' : 'Verify'}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  )
}
