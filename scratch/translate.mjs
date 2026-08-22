import fs from 'fs'
import path from 'path'
import { google } from '@ai-sdk/google'
import { generateText } from 'ai'

// Load environment variables manually
if (fs.existsSync('.env.local')) {
  const envText = fs.readFileSync('.env.local', 'utf8')
  envText.split('\n').forEach(line => {
    const parts = line.split('=')
    if (parts.length >= 2) {
      const key = parts[0].trim()
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '')
      process.env[key] = val
    }
  })
}

const LOCALES_DIR = 'public/locales'
const LANGUAGES = ['hi', 'te', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'ur']

const LANG_NAMES = {
  hi: 'Hindi (हिन्दी)',
  te: 'Telugu (తెలుగు)',
  ta: 'Tamil (தமிழ்)',
  kn: 'Kannada (ಕನ್ನಡ)',
  ml: 'Malayalam (മലയാളം)',
  mr: 'Marathi (మராठी)',
  bn: 'Bengali (বাংলা)',
  gu: 'Gujarati (ગુજરાતી)',
  pa: 'Punjabi (ਪੰਜਾਬੀ)',
  ur: 'Urdu (اردו)'
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function translateNamespaceAllLanguages(ns, keysToTranslate) {
  const model = google('gemini-flash-latest')
  const prompt = `You are a professional software localization translator for Indian languages.
Translate the following English key-value pairs (stored as a JSON object) from namespace "${ns}" into the following 10 languages:
${Object.entries(LANG_NAMES).map(([code, name]) => `- ${code}: ${name}`).join('\n')}

Rules:
1. Return ONLY a single flat JSON object where the root keys are the language codes ('hi', 'te', etc.) and values are objects mapping the original keys to their translations. Do not output markdown, code blocks, or explanations.
2. Keep variables in double curly braces intact, e.g., {{name}} or {{count}}.
3. Keep technical or universal terms untranslated: "SOS", "AI", "OTP", "UPI", "CyberShield", "GPS", "IP", "HDFC", "SBI", "ICICI", "SMS", "WhatsApp", "Bedtime", "Bedtime Mode", "Mode".
4. Ensure context-appropriate, natural digital phrasing.

English JSON to translate:
${JSON.stringify(keysToTranslate, null, 2)}

Required output format:
{
  "hi": { "key1": "translation in Hindi", ... },
  "te": { "key1": "translation in Telugu", ... },
  ...
}`

  try {
    const { text } = await generateText({
      model,
      prompt,
      temperature: 0.1,
    })

    // Clean markdown code blocks if any
    let cleaned = text.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim()
    }

    return JSON.parse(cleaned)
  } catch (error) {
    console.error(`Error translating namespace ${ns}:`, error)
    return null
  }
}

async function run() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error('GOOGLE_GENERATIVE_AI_API_KEY is not defined in .env.local')
    process.exit(1)
  }

  const enDir = path.join(LOCALES_DIR, 'en')
  const files = fs.readdirSync(enDir).filter(f => f.endsWith('.json'))

  for (const file of files) {
    const ns = file.replace('.json', '')
    console.log(`\n========================================`)
    console.log(`Processing namespace: ${ns}`)
    console.log(`========================================`)

    const enPath = path.join(enDir, file)
    const enObj = JSON.parse(fs.readFileSync(enPath, 'utf8'))

    // Gather all keys that need translation for ANY language
    const langObjects = {}
    const keysNeedTranslation = new Set()

    for (const lang of LANGUAGES) {
      const langPath = path.join(LOCALES_DIR, lang, file)
      let langObj = {}
      if (fs.existsSync(langPath)) {
        langObj = JSON.parse(fs.readFileSync(langPath, 'utf8'))
      }
      langObjects[lang] = langObj

      for (const key in enObj) {
        const val = langObj[key]
        const enVal = enObj[key]

        let needsTranslation = false
        if (val === undefined) {
          needsTranslation = true
        } else if (val === enVal && /[a-zA-Z]/.test(val) && val.length > 2) {
          // Check exceptions
          const cleanVal = val.replace(/\b(SOS|AI|OTP|UPI|CyberShield|GPS|IP|HDFC|SBI|ICICI|SMS|WhatsApp|Bedtime|Bedtime Mode|Mode)\b/gi, '').trim()
          if (cleanVal.length > 0 && /[a-zA-Z]/.test(cleanVal)) {
            needsTranslation = true
          }
        }

        if (needsTranslation) {
          keysNeedTranslation.add(key)
        }
      }
    }

    if (keysNeedTranslation.size > 0) {
      console.log(`Need to translate ${keysNeedTranslation.size} keys for languages...`)
      const enSubset = {}
      keysNeedTranslation.forEach(k => {
        enSubset[k] = enObj[k]
      })

      // We translate in chunks of 15 keys to stay within token context/response limits reliably
      const keysList = Array.from(keysNeedTranslation)
      const CHUNK_SIZE = 15
      const allTranslations = {} // { hi: { key: val }, te: { key: val } }

      for (let i = 0; i < keysList.length; i += CHUNK_SIZE) {
        const chunkKeys = keysList.slice(i, i + CHUNK_SIZE)
        const chunkSubset = {}
        chunkKeys.forEach(k => { chunkSubset[k] = enSubset[k] })

        console.log(`Translating chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(keysList.length / CHUNK_SIZE)} for all 10 languages...`)
        
        // Sleep 12 seconds to completely avoid Rate Limits (5 RPM limit)
        if (i > 0) {
          console.log('Sleeping 12 seconds to respect API rate limits...')
          await sleep(12000)
        }

        const chunkResult = await translateNamespaceAllLanguages(ns, chunkSubset)

        if (chunkResult) {
          for (const lang in chunkResult) {
            if (!allTranslations[lang]) allTranslations[lang] = {}
            Object.assign(allTranslations[lang], chunkResult[lang])
          }
        } else {
          console.error(`Failed to translate chunk for ${ns}`)
        }
      }

      // Merge translations back for each language
      for (const lang of LANGUAGES) {
        const langPath = path.join(LOCALES_DIR, lang, file)
        const langObj = langObjects[lang]
        const langTranslations = allTranslations[lang] || {}

        // Merge back
        for (const key in enObj) {
          if (langTranslations[key] !== undefined) {
            langObj[key] = langTranslations[key]
          } else if (langObj[key] === undefined) {
            langObj[key] = enObj[key]
          }
        }

        // Sort by key order of English template
        const sortedObj = {}
        Object.keys(enObj).forEach(k => {
          sortedObj[k] = langObj[k] !== undefined ? langObj[k] : enObj[k]
        })

        fs.writeFileSync(langPath, JSON.stringify(sortedObj, null, 2), 'utf8')
        console.log(`Saved translations for ${lang}`)
      }

      // Sleep 12 seconds before the next namespace
      console.log('Sleeping 12 seconds before next namespace...')
      await sleep(12000)
    } else {
      console.log(`Namespace ${ns} is already fully translated!`)
    }
  }

  console.log('\nAll namespaces processed successfully!')
}

run()
