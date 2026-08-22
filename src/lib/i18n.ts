'use client'

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import HttpBackend from 'i18next-http-backend'
import LanguageDetector from 'i18next-browser-languagedetector'

const NAMESPACES = [
  'common', 'dashboard', 'scamScanner', 'childSafety', 'aiGuardian',
  'alerts', 'family', 'womenSafety', 'emergencySOS', 'settings',
  'auth', 'landing'
]

const SUPPORTED_LANGUAGES = ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'ur']

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: SUPPORTED_LANGUAGES,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: NAMESPACES,

    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },

    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'cyber_lang',
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false, // React already escapes
    },

    react: {
      useSuspense: false,
    },

    // Dev-only missing key warning
    saveMissing: process.env.NODE_ENV === 'development',
    missingKeyHandler: (lngs, ns, key) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[i18n] Missing key: ${ns}:${key} for languages: ${lngs.join(', ')}`)
      }
    },
  })

export default i18n
export { SUPPORTED_LANGUAGES, NAMESPACES };
