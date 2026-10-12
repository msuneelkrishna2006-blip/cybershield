'use client'

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import HttpBackend from 'i18next-http-backend'
import LanguageDetector from 'i18next-browser-languagedetector'

// ─── Static imports for English (default language) ───────────────────────────
// These are bundled into the build so English is available SYNCHRONOUSLY
// on both SSR and client — no async fetch, no flash of raw keys.
import commonEn from '../../public/locales/en/common.json'
import landingEn from '../../public/locales/en/landing.json'
import dashboardEn from '../../public/locales/en/dashboard.json'
import scamScannerEn from '../../public/locales/en/scamScanner.json'
import childSafetyEn from '../../public/locales/en/childSafety.json'
import aiGuardianEn from '../../public/locales/en/aiGuardian.json'
import alertsEn from '../../public/locales/en/alerts.json'
import familyEn from '../../public/locales/en/family.json'
import womenSafetyEn from '../../public/locales/en/womenSafety.json'
import emergencySOSEn from '../../public/locales/en/emergencySOS.json'
import settingsEn from '../../public/locales/en/settings.json'
import authEn from '../../public/locales/en/auth.json'

const NAMESPACES = [
  'common', 'dashboard', 'scamScanner', 'childSafety', 'aiGuardian',
  'alerts', 'family', 'womenSafety', 'emergencySOS', 'settings',
  'auth', 'landing'
]

const SUPPORTED_LANGUAGES = ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'ur']

i18n
  .use(HttpBackend)        // Still used for non-English languages (lazy loaded)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: SUPPORTED_LANGUAGES,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: NAMESPACES,

    // ─── English translations bundled statically ─────────────────────────
    // This is the key fix: English is always available immediately,
    // no async fetch needed. Other languages load via HttpBackend.
    resources: {
      en: {
        common: commonEn,
        landing: landingEn,
        dashboard: dashboardEn,
        scamScanner: scamScannerEn,
        childSafety: childSafetyEn,
        aiGuardian: aiGuardianEn,
        alerts: alertsEn,
        family: familyEn,
        womenSafety: womenSafetyEn,
        emergencySOS: emergencySOSEn,
        settings: settingsEn,
        auth: authEn,
      },
    },

    // HttpBackend only kicks in for non-English languages
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },

    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'cyber_lang',
      caches: ['localStorage'],
    },

    // Don't load English from backend — it's already in resources
    partialBundledLanguages: true,

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
