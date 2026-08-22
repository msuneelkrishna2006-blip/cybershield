import fs from 'fs'
import path from 'path'

const LOCALES_DIR = 'public/locales'
const SRC_DIR = 'src'
const LANGUAGES = ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'ur']

// Load keys from a JSON object recursively
function getKeys(obj, prefix = '') {
  let keys = {}
  for (let key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      Object.assign(keys, getKeys(obj[key], fullKey))
    } else {
      keys[fullKey] = obj[key]
    }
  }
  return keys
}

// 1. KEY PARITY AND HARDCODED ENGLISH IN LOCALES
console.log('--- LOCALES AUDIT ---')
const enDir = path.join(LOCALES_DIR, 'en')
const files = fs.readdirSync(enDir).filter(f => f.endsWith('.json'))

const auditReport = {}

for (const file of files) {
  const ns = file.replace('.json', '')
  auditReport[ns] = {}

  const enPath = path.join(enDir, file)
  const enObj = JSON.parse(fs.readFileSync(enPath, 'utf8'))
  const enKeys = getKeys(enObj)

  for (const lang of LANGUAGES) {
    if (lang === 'en') continue

    const langPath = path.join(LOCALES_DIR, lang, file)
    if (!fs.existsSync(langPath)) {
      console.log(`[Missing File] Namespace "${ns}" for language "${lang}" is missing completely!`)
      continue
    }

    const langObj = JSON.parse(fs.readFileSync(langPath, 'utf8'))
    const langKeys = getKeys(langObj)

    // Check missing keys
    const missingKeys = []
    const englishValues = []

    for (const key in enKeys) {
      if (!(key in langKeys)) {
        missingKeys.push(key)
      } else {
        const val = langKeys[key]
        // If value is identical to English and is English text (contains letters)
        if (val === enKeys[key] && /[a-zA-Z]/.test(val) && val.length > 2) {
          // Exception for words like SOS, AI, OTP, UPI, CyberShield
          const cleanVal = val.replace(/\b(SOS|AI|OTP|UPI|CyberShield|GPS|IP|HDFC|SBI|ICICI|SMS|WhatsApp|Bedtime|Bedtime Mode|Mode)\b/gi, '').trim()
          if (cleanVal.length > 0 && /[a-zA-Z]/.test(cleanVal)) {
            englishValues.push({ key, val })
          }
        }
      }
    }

    if (missingKeys.length > 0 || englishValues.length > 0) {
      auditReport[ns][lang] = { missingKeys, englishValues }
    }
  }
}

// Print locale issues summary
for (const ns in auditReport) {
  console.log(`\nNamespace: ${ns}`)
  for (const lang in auditReport[ns]) {
    const { missingKeys, englishValues } = auditReport[ns][lang]
    console.log(`  Language: ${lang}`)
    if (missingKeys.length > 0) {
      console.log(`    Missing Keys (${missingKeys.length}):`, missingKeys)
    }
    if (englishValues.length > 0) {
      console.log(`    Untranslated/English Values (${englishValues.length}):`, englishValues.map(ev => `${ev.key} => "${ev.val}"`))
    }
  }
}

// 2. SEARCH CODEBASE FOR HARDCODED JSX/STRING LITERALS
console.log('\n--- CODEBASE RAW STRINGS AUDIT ---')

function scanDir(dir, fileList = []) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      if (!['node_modules', '.next', '.git', '.vercel', 'tests', 'worker'].includes(file)) {
        scanDir(filePath, fileList)
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath)
    }
  }
  return fileList
}

const sourceFiles = scanDir(SRC_DIR)
console.log(`Scanning ${sourceFiles.length} source files...`)

const hardcodedStringsReport = []

sourceFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8')
  const lines = content.split('\n')

  lines.forEach((line, index) => {
    // Basic regex checks for potential raw text:
    // 1. Direct JSX text: >Text Here<
    // 2. Attributes: placeholder="Text Here", title="Text Here" (without braces/interpolation)
    // 3. String literals in JS: label: 'Text Here' or description: "Text Here" (non-i18n)
    
    // Ignore lines that import things, or console.log, or comments
    if (line.trim().startsWith('import') || line.trim().startsWith('//') || line.trim().startsWith('*') || line.includes('console.')) {
      return
    }

    // Match potential raw text in JSX: e.g. >Some English text<
    const jsxTextMatch = line.match(/>([^<>{}\n]*[a-zA-Z]{3,}[^<>{}\n]*)<[a-zA-Z\/]/)
    if (jsxTextMatch) {
      const text = jsxTextMatch[1].trim()
      if (text && !text.startsWith('http') && !text.startsWith('const') && !text.startsWith('export')) {
        hardcodedStringsReport.push({ file, lineNum: index + 1, type: 'JSX_TEXT', text, line: line.trim() })
      }
    }

    // Match raw attributes like placeholder="Some Text", title="Some Text", label="Some Text"
    const attrMatch = line.match(/\b(placeholder|title|label|aria-label|alt)="(.*?)"/)
    if (attrMatch) {
      const attr = attrMatch[1]
      const val = attrMatch[2]
      if (val && /[a-zA-Z]/.test(val) && val.length > 2) {
        // Exception for icons/keys
        if (!val.includes(':') && !val.includes('.') && !/^[A-Z_]+$/.test(val)) {
          hardcodedStringsReport.push({ file, lineNum: index + 1, type: `ATTR_${attr.toUpperCase()}`, text: val, line: line.trim() })
        }
      }
    }

    // Match raw strings inside JSX brackets like {"Some Text"}
    const jsxBracedMatch = line.match(/\{"([^"]*[a-zA-Z]{3,}[^"]*)"\}/)
    if (jsxBracedMatch) {
      const text = jsxBracedMatch[1].trim()
      hardcodedStringsReport.push({ file, lineNum: index + 1, type: 'BRACED_STRING', text, line: line.trim() })
    }
  })
})

console.log(`\nFound ${hardcodedStringsReport.length} potential raw strings in codebase.`)

// Output to a temporary report file
fs.writeFileSync('i18n-audit-report.json', JSON.stringify({ localeAudit: auditReport, rawStrings: hardcodedStringsReport }, null, 2))
console.log('Detailed audit report written to "i18n-audit-report.json"')
