'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { Language } from '@/types'
import i18n from '@/lib/i18n'

interface TranslationContextType {
  t: (key: string, options?: Record<string, any>) => string
  language: Language
  setLanguage: (lang: Language) => void
  languages: { code: Language; name: string; nativeName: string }[]
}

const LANGUAGES: { code: Language; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' }
]

const RTL_LANGUAGES: Language[] = ['ur']

const TranslationContext = createContext<TranslationContextType | undefined>(undefined)

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>((i18n.language as Language) || 'en')
  const [, setRerender] = useState(0)

  // Sync language state with i18next — listen to ALL relevant events
  useEffect(() => {
    const forceUpdate = () => setRerender(n => n + 1)

    const handleLanguageChanged = (lng: string) => {
      const lang = lng as Language
      setLanguageState(lang)
      forceUpdate()

      // Update document lang for RTL/LTR dynamically
      if (typeof document !== 'undefined') {
        document.documentElement.lang = lang
        document.documentElement.dir = RTL_LANGUAGES.includes(lang) ? 'rtl' : 'ltr'
      }
    }

    // FIX: Subscribe to 'loaded' and 'initialized' events
    // This ensures re-render when HttpBackend finishes loading translations
    // for non-English languages (English is bundled statically)
    i18n.on('languageChanged', handleLanguageChanged)
    i18n.on('loaded', forceUpdate)
    i18n.on('initialized', forceUpdate)

    // Set initial direction
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language
      document.documentElement.dir = RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr'
    }

    return () => {
      i18n.off('languageChanged', handleLanguageChanged)
      i18n.off('loaded', forceUpdate)
      i18n.off('initialized', forceUpdate)
    }
  }, [language])

  const setLanguage = useCallback((lang: Language) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('cyber_lang', lang)
  }, [])

  // Translation function that searches all namespaces
  const t = useCallback((key: string, options?: Record<string, any>): string => {
    // If key contains a namespace separator, use it directly
    if (key.includes(':')) {
      return String(i18n.t(key, options || {}))
    }
    // Otherwise search common namespace first, then try the key as-is
    const result = String(i18n.t(key, { ns: 'common', ...options }))
    // If the result equals the key (not found in common), try without namespace
    if (result === key) {
      return String(i18n.t(key, options || {}))
    }
    return result
  }, [language]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TranslationContext.Provider value={{ t, language, setLanguage, languages: LANGUAGES }}>
      {children}
    </TranslationContext.Provider>
  )
}

export function useTranslation(namespace?: string) {
  const context = useContext(TranslationContext)
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider')
  }

  // If a namespace is provided, return a namespace-scoped t function
  if (namespace) {
    const nsT = (key: string, options?: Record<string, any>): string => {
      // Try namespace first, then common
      const result = String(i18n.t(`${namespace}:${key}`, options || {}))
      if (result === `${namespace}:${key}` || result === key) {
        // Fallback to common namespace
        const commonResult = String(i18n.t(`common:${key}`, options || {}))
        if (commonResult !== `common:${key}` && commonResult !== key) {
          return commonResult
        }
        return String(i18n.t(key, options || {}))
      }
      return result
    }

    return { ...context, t: nsT }
  }

  return context
}
