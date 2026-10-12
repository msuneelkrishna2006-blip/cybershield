'use client'

import { useCallback, useRef, useState } from 'react'
import { StepUpModal, type StepUpCredentials } from '@/components/auth/StepUpModal'

interface PendingRequest {
  retry: () => Promise<Response>
  originalResponse: Response
  resolve: (response: Response) => void
}

async function responseErrorCode(response: Response): Promise<string | null> {
  try {
    const body = await response.clone().json()
    return body.error?.code || null
  } catch {
    return null
  }
}

export function useStepUpFetch() {
  const [isOpen, setIsOpen] = useState(false)
  const pendingRequest = useRef<PendingRequest | null>(null)

  const fetchWithStepUp = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const savedInput = input instanceof Request ? input.clone() : input
    const retry = () => fetch(savedInput instanceof Request ? savedInput.clone() : savedInput, init)
    const response = await retry()
    if (response.status !== 403 || await responseErrorCode(response) !== 'STEP_UP_REQUIRED') {
      return response
    }

    return new Promise<Response>(resolve => {
      pendingRequest.current = { retry, originalResponse: response, resolve }
      setIsOpen(true)
    })
  }, [])

  const authenticate = useCallback(async (credentials: StepUpCredentials) => {
    const response = credentials.method === 'phone'
      ? await fetch('/api/v1/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: credentials.phone,
          code: credentials.code,
          purpose: 'step_up',
        }),
      })
      : await fetch('/api/v1/auth/step-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(credentials.method === 'password'
          ? { method: 'password', password: credentials.password }
          : { method: 'totp', code: credentials.code }),
      })

    const result = await response.json()
    if (!response.ok || !result.success) {
      throw new Error(result.error?.message || 'Re-authentication failed.')
    }

    const pending = pendingRequest.current
    if (!pending) return
    const retriedResponse = await pending.retry()
    pendingRequest.current = null
    setIsOpen(false)
    pending.resolve(retriedResponse)
  }, [])

  const cancel = useCallback(() => {
    const pending = pendingRequest.current
    pendingRequest.current = null
    setIsOpen(false)
    pending?.resolve(pending.originalResponse)
  }, [])

  return {
    fetchWithStepUp,
    stepUpModal: (
      <StepUpModal
        open={isOpen}
        onAuthenticate={authenticate}
        onCancel={cancel}
      />
    ),
  }
}
