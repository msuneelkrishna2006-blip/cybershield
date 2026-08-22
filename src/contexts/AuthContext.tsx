'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { User } from '@/types'
import { toast } from 'react-hot-toast'
import { useRouter, usePathname } from 'next/navigation'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, pass: string) => Promise<void>
  register: (name: string, email: string, phone: string, pass: string) => Promise<void>
  logout: () => void
  sendOtp: (phone: string, captchaToken?: string | null) => Promise<{ devOtp?: string }>
  verifyOtp: (phone: string, code: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/profile', { credentials: 'include' })
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data) {
          setUser(json.data)
        } else {
          setUser(null)
        }
      } else {
        setUser(null)
      }
    } catch (err) {
      console.error('Failed to load profile', err)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load user on mount
  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  // Auto-refresh token every 10 minutes (600,000 ms)
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      if (user) {
        try {
          await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
        } catch (e) {
          console.error('Failed to refresh token', e)
        }
      }
    }, 10 * 60 * 1000)

    return () => clearInterval(refreshInterval)
  }, [user])

  // Protected route logic
  useEffect(() => {
    if (!isLoading) {
      const isAuthRoute = pathname === '/login' || pathname === '/register'
      const isAppRoute = pathname.startsWith('/app')
      
      if (!user && isAppRoute) {
        router.push('/login')
      } else if (user && isAuthRoute) {
        router.push('/app')
      }
    }
  }, [user, isLoading, pathname, router])

  const login = async (email: string, pass: string) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password: pass })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error || 'Login failed')
      }

      await loadProfile()
      toast.success('Successfully logged in!')
      router.push('/app')
    } catch (error: any) {
      toast.error(error.message)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (name: string, email: string, phone: string, pass: string) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, phone, password: pass })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error || 'Registration failed')
      }

      await loadProfile()
      toast.success('Account created and logged in successfully!')
      router.push('/app')
    } catch (error: any) {
      toast.error(error.message)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' })
      setUser(null)
      toast.success('Logged out successfully')
      router.push('/login')
    } catch (error) {
      toast.error('Logout error')
    }
  }

  const sendOtp = async (phone: string, captchaToken?: string | null) => {
    try {
      const payload: Record<string, string> = { phone }
      if (captchaToken) payload.captchaToken = captchaToken

      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch OTP')
      }

      toast.success(data.message)
      return data
    } catch (error: any) {
      toast.error(error.message)
      throw error
    }
  }

  const verifyOtp = async (phone: string, code: string) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone, code })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'OTP verification failed')
      }

      await loadProfile()
      toast.success('Successfully logged in!')
      router.push('/app')
    } catch (error: any) {
      toast.error(error.message)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated, login, register, logout, sendOtp, verifyOtp }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
