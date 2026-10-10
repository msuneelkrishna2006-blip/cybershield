/**
 * CyberShield India — Scam Pattern Knowledge Base
 *
 * Curated database of 50+ India-specific scam patterns for the
 * Cyber Awareness Chatbot (RAG-lite approach).
 *
 * Each entry includes: pattern keywords, description, risk level,
 * relevant helpline, and recommended actions.
 */

export interface ScamPattern {
  id: string
  category: string
  keywords: string[]
  title: string
  description: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  helpline: string
  helplineNumber: string
  recommendations: string[]
  examples?: string[]
}

export const SCAM_PATTERNS: ScamPattern[] = [
  // ─── Digital Arrest Scams ─────────────────────────────────────────
  {
    id: 'digital-arrest-police',
    category: 'Digital Arrest',
    keywords: ['digital arrest', 'cyber police', 'cbi', 'narcotics', 'money laundering', 'video call police', 'arrest warrant'],
    title: 'Digital Arrest / Fake Police Call',
    description: 'Scammers impersonate police, CBI, or customs officers via phone/video call. They claim you are involved in money laundering or narcotics, demand you stay on the call (\"digital arrest\"), and ask for money to \"settle\" the case. NO law enforcement agency conducts arrest proceedings over video calls.',
    riskLevel: 'CRITICAL',
    helpline: 'Cyber Crime Helpline',
    helplineNumber: '1930',
    recommendations: [
      'Disconnect the call immediately — no real officer arrests via video call',
      'Call 1930 (Cyber Crime Helpline) to report',
      'File a complaint at cybercrime.gov.in',
      'Do NOT transfer any money',
      'Take a screenshot of the caller\'s number',
    ],
    examples: ['Your Aadhaar is linked to money laundering, you are under digital arrest', 'This is CBI, a parcel with drugs was found in your name'],
  },
  {
    id: 'digital-arrest-customs',
    category: 'Digital Arrest',
    keywords: ['customs', 'parcel', 'drugs found', 'seized package', 'courier', 'fedex', 'dhl'],
    title: 'Fake Customs / Parcel Scam',
    description: 'You receive a call claiming a parcel in your name was intercepted with illegal items. They transfer you to a "police officer" who demands money to avoid arrest. Real customs never calls to demand payment.',
    riskLevel: 'CRITICAL',
    helpline: 'Cyber Crime Helpline',
    helplineNumber: '1930',
    recommendations: [
      'Hang up — customs sends written notices, never phone calls demanding money',
      'Report to 1930 immediately',
      'Block the number',
    ],
  },

  // ─── OTP / KYC Fraud ─────────────────────────────────────────────
  {
    id: 'otp-fraud',
    category: 'OTP Fraud',
    keywords: ['otp', 'share otp', 'verify otp', 'one time password', 'send code', 'verification code'],
    title: 'OTP Sharing Scam',
    description: 'Scammers call or message asking you to share an OTP you received. They may claim to be from your bank, a delivery service, or a government agency. NEVER share OTPs — they can be used to access your bank account or take over your number.',
    riskLevel: 'CRITICAL',
    helpline: 'Bank Customer Care / Cyber Crime',
    helplineNumber: '1930',
    recommendations: [
      'NEVER share OTP with anyone over phone, SMS, or WhatsApp',
      'Your bank will NEVER ask for OTP',
      'If you shared an OTP, call your bank immediately to block your account',
      'Change your UPI PIN and passwords immediately',
    ],
  },
  {
    id: 'kyc-update',
    category: 'KYC Fraud',
    keywords: ['kyc', 'pan update', 'aadhaar update', 'account suspended', 'account blocked', 'verify identity', 'link expiring'],
    title: 'Fake KYC Update',
    description: 'A message claims your bank account or wallet will be blocked unless you update KYC immediately. The link leads to a fake website that steals your credentials. Banks never send KYC update links via SMS.',
    riskLevel: 'HIGH',
    helpline: 'Bank Customer Care',
    helplineNumber: '1930',
    recommendations: [
      'Do NOT click any KYC update link received via SMS/WhatsApp',
      'Visit your bank branch or official website directly',
      'Report the SMS to 1930',
    ],
  },

  // ─── UPI Scams ────────────────────────────────────────────────────
  {
    id: 'upi-collect',
    category: 'UPI Scam',
    keywords: ['upi', 'collect request', 'accept payment', 'receive money', 'upi pin', 'google pay', 'phonepe', 'paytm'],
    title: 'UPI Collect Request Scam',
    description: 'Scammer sends a UPI collect request claiming it\'s for receiving a refund or payment. When you enter your PIN to "accept", money is actually DEDUCTED from your account. You NEVER need to enter PIN to receive money.',
    riskLevel: 'CRITICAL',
    helpline: 'NPCI / Bank',
    helplineNumber: '1930',
    recommendations: [
      'NEVER enter UPI PIN to receive money — PINs are only for sending',
      'Decline unknown collect requests immediately',
      'Report the UPI ID on your payment app',
      'If money was debited, report within 24 hours to your bank',
    ],
  },
  {
    id: 'upi-qr-fraud',
    category: 'UPI Scam',
    keywords: ['qr code', 'scan to receive', 'scan qr', 'payment qr'],
    title: 'QR Code Payment Fraud',
    description: 'Scammer shares a QR code claiming you need to scan it to receive money. Scanning a QR code and entering PIN always SENDS money, never receives it. This is common on OLX, marketplace, and second-hand sale sites.',
    riskLevel: 'HIGH',
    helpline: 'Cyber Crime Helpline',
    helplineNumber: '1930',
    recommendations: [
      'NEVER scan a QR code to "receive" money',
      'QR codes are for paying, not receiving',
      'If on OLX/marketplace, insist on cash or bank transfer',
    ],
  },

  // ─── Job Scams ────────────────────────────────────────────────────
  {
    id: 'job-scam-task',
    category: 'Job Scam',
    keywords: ['part time job', 'work from home', 'task scam', 'telegram job', 'like and earn', 'review job', 'data entry job', 'typing job'],
    title: 'Part-Time Job / Task Scam',
    description: 'Ads on Telegram/WhatsApp offer easy money for "liking videos", "writing reviews", or "completing tasks". Initially you earn small amounts, then they ask you to invest more money for higher returns — which you never get back.',
    riskLevel: 'HIGH',
    helpline: 'Cyber Crime Helpline',
    helplineNumber: '1930',
    recommendations: [
      'No legitimate job asks you to pay money first',
      'Telegram/WhatsApp "task" jobs are almost always scams',
      'If you paid money, report to 1930 within 24 hours',
      'Block and report the account',
    ],
  },
  {
    id: 'job-scam-interview',
    category: 'Job Scam',
    keywords: ['job offer', 'selected', 'interview', 'registration fee', 'processing fee', 'security deposit'],
    title: 'Fake Job Offer',
    description: 'You receive an unexpected job offer (often via SMS or email) from a well-known company. They ask for a "registration fee" or "security deposit" before you can start. Legitimate companies never charge candidates.',
    riskLevel: 'MEDIUM',
    helpline: 'Cyber Crime Helpline',
    helplineNumber: '1930',
    recommendations: [
      'Verify the job on the company\'s official careers page',
      'Never pay any fee for a job',
      'Check if the email is from the company\'s official domain',
    ],
  },

  // ─── Loan App Harassment ──────────────────────────────────────────
  {
    id: 'loan-app',
    category: 'Loan App Harassment',
    keywords: ['loan app', 'instant loan', 'personal loan', 'loan recovery', 'morphed photos', 'contact list', 'threatening'],
    title: 'Predatory Loan App',
    description: 'Illegal loan apps offer quick loans but charge extreme interest (up to 40% per week). If you miss a payment, they access your phone contacts and photos, send morphed images to your contacts, and threaten violence. These apps are banned by RBI.',
    riskLevel: 'CRITICAL',
    helpline: 'RBI / Cyber Crime',
    helplineNumber: '1930',
    recommendations: [
      'Only borrow from RBI-licensed lenders',
      'Report the app to cybercrime.gov.in and Play Store',
      'If threatened, file an FIR at your local police station',
      'Revoke the app\'s permissions and uninstall it',
      'Call 1930 for immediate help',
    ],
  },

  // ─── Investment / Trading Scams ───────────────────────────────────
  {
    id: 'investment-scam',
    category: 'Investment Scam',
    keywords: ['guaranteed returns', 'invest', 'stock tips', 'crypto', 'trading platform', 'high returns', 'double money', 'forex'],
    title: 'Fake Investment / Trading Scam',
    description: 'Social media ads or WhatsApp groups promise guaranteed high returns on stock/crypto investments. They show fake profits on a demo platform, then ask you to invest real money which you can never withdraw.',
    riskLevel: 'HIGH',
    helpline: 'SEBI Helpline',
    helplineNumber: '1800-266-7575',
    recommendations: [
      'No legitimate investment guarantees fixed returns',
      'Verify the broker with SEBI (sebi.gov.in)',
      'Never invest through WhatsApp or Telegram groups',
      'If you\'ve lost money, report to cybercrime.gov.in',
    ],
  },

  // ─── Phishing ─────────────────────────────────────────────────────
  {
    id: 'phishing-bank',
    category: 'Phishing',
    keywords: ['phishing', 'fake website', 'login page', 'enter password', 'bank login', 'verify account', 'click link'],
    title: 'Bank Phishing Website',
    description: 'A fake website that looks identical to your bank\'s login page. When you enter your credentials, the scammers capture your username, password, and card details. Always check the URL before logging in.',
    riskLevel: 'CRITICAL',
    helpline: 'Bank Customer Care',
    helplineNumber: '1930',
    recommendations: [
      'Always type your bank URL directly — never click links from SMS/email',
      'Check for the correct domain (e.g., onlinesbi.sbi, NOT sbi-online.xyz)',
      'Look for the padlock icon and https://',
      'If you entered credentials on a fake site, change your password immediately and call your bank',
    ],
  },

  // ─── Matrimonial / Romance Scams ──────────────────────────────────
  {
    id: 'romance-scam',
    category: 'Romance Scam',
    keywords: ['matrimony', 'marriage', 'romance', 'dating', 'army officer', 'foreign national', 'send money', 'stuck abroad'],
    title: 'Matrimonial / Romance Scam',
    description: 'On matrimonial or dating sites, scammers create fake profiles (often claiming to be army officers, NRIs, or foreign nationals). After building trust, they ask for money for emergencies, visa fees, or gifts stuck in customs.',
    riskLevel: 'HIGH',
    helpline: 'Cyber Crime Helpline',
    helplineNumber: '1930',
    recommendations: [
      'Never send money to someone you haven\'t met in person',
      'Video-call before trusting online relationships',
      'Be suspicious of anyone who avoids meeting in person',
      'Report the profile on the platform',
    ],
  },

  // ─── Electricity / Utility Scams ──────────────────────────────────
  {
    id: 'electricity-scam',
    category: 'Utility Scam',
    keywords: ['electricity', 'bill overdue', 'disconnected', 'pay now', 'bijli', 'light bill', 'gas bill', 'power disconnection'],
    title: 'Fake Electricity Bill Disconnection',
    description: 'SMS warns your electricity will be disconnected today unless you call a number or click a link to pay. Real utility companies send paper notices and bills through official apps — not threatening SMS with phone numbers.',
    riskLevel: 'MEDIUM',
    helpline: 'State Electricity Board',
    helplineNumber: '1912',
    recommendations: [
      'Check your bill on the official electricity board website/app',
      'Do NOT call numbers from SMS — use official customer care',
      'Electricity boards don\'t disconnect without written notice',
    ],
  },

  // ─── Sextortion ───────────────────────────────────────────────────
  {
    id: 'sextortion',
    category: 'Sextortion',
    keywords: ['sextortion', 'nude video', 'private photos', 'blackmail', 'intimate video', 'recording', 'webcam'],
    title: 'Sextortion / Video Blackmail',
    description: 'Scammers trick you into a video call, record compromising footage (sometimes using AI-generated fake videos), then threaten to send it to your contacts unless you pay. This is a crime — report it immediately.',
    riskLevel: 'CRITICAL',
    helpline: 'Cyber Crime Helpline',
    helplineNumber: '1930',
    recommendations: [
      'Do NOT pay — paying only leads to more demands',
      'Do NOT delete evidence — save screenshots of threats',
      'Report to 1930 and file an FIR',
      'Block the blackmailer on all platforms',
      'Report the profile to the platform (WhatsApp, Instagram, etc.)',
    ],
  },

  // ─── WhatsApp Scams ───────────────────────────────────────────────
  {
    id: 'whatsapp-hijack',
    category: 'Account Takeover',
    keywords: ['whatsapp', 'verification code', 'account', 'friend asked', '6 digit code', 'by mistake'],
    title: 'WhatsApp Account Hijacking',
    description: 'Someone (often posing as a friend) asks you to share a "6-digit code you received by mistake." This is your WhatsApp verification code — sharing it gives them full control of your account.',
    riskLevel: 'CRITICAL',
    helpline: 'Cyber Crime Helpline',
    helplineNumber: '1930',
    recommendations: [
      'NEVER share verification codes with anyone',
      'Enable two-step verification in WhatsApp settings',
      'If your account was taken over, email support@whatsapp.com with your phone number',
      'Alert your contacts that your account was compromised',
    ],
  },
  {
    id: 'whatsapp-forwarded',
    category: 'Misinformation',
    keywords: ['forward', 'viral', 'breaking news', 'government scheme', 'free', 'free recharge', 'free data'],
    title: 'WhatsApp Forward Scam',
    description: 'Messages promising free data, free government money, or exclusive schemes — often with a link that steals your data. If a message has been "forwarded many times," it\'s likely false.',
    riskLevel: 'LOW',
    helpline: 'PIB Fact Check',
    helplineNumber: '918799711259',
    recommendations: [
      'Check forwarded messages on factcheck.pib.gov.in',
      'Government schemes are announced on official websites, not WhatsApp',
      'Don\'t click links in forwarded messages',
    ],
  },

  // ─── Insurance / Refund Scams ─────────────────────────────────────
  {
    id: 'insurance-refund',
    category: 'Refund Scam',
    keywords: ['insurance', 'refund', 'premium refund', 'policy matured', 'unclaimed', 'lic', 'irda'],
    title: 'Fake Insurance Refund',
    description: 'Callers claim you have an unclaimed insurance refund or your policy has matured. They ask for your bank details or a "processing fee" to release the funds. Real insurance companies communicate through official channels.',
    riskLevel: 'MEDIUM',
    helpline: 'IRDAI Helpline',
    helplineNumber: '155255',
    recommendations: [
      'Contact your insurance company directly using the number on your policy',
      'Never share bank details over the phone',
      'Report to IRDAI at igms.irda.gov.in',
    ],
  },

  // ─── Technical Support Scams ──────────────────────────────────────
  {
    id: 'tech-support',
    category: 'Tech Support Scam',
    keywords: ['tech support', 'virus detected', 'computer hacked', 'microsoft', 'apple', 'remote access', 'anydesk', 'teamviewer'],
    title: 'Fake Tech Support',
    description: 'Pop-ups or calls claim your device is infected or hacked. They ask you to install remote access tools (AnyDesk, TeamViewer) to "fix" the problem, then steal your data or money.',
    riskLevel: 'HIGH',
    helpline: 'Cyber Crime Helpline',
    helplineNumber: '1930',
    recommendations: [
      'Microsoft/Apple NEVER call you about viruses',
      'NEVER install AnyDesk/TeamViewer when asked by a stranger',
      'Close suspicious pop-ups — they are fake warnings',
      'If you gave remote access, change all passwords immediately',
    ],
  },

  // ─── Aadhaar Scams ────────────────────────────────────────────────
  {
    id: 'aadhaar-fraud',
    category: 'Identity Theft',
    keywords: ['aadhaar', 'aadhar', 'uidai', 'aadhaar number', 'biometric', 'aadhaar misused', 'aadhaar linked'],
    title: 'Aadhaar Misuse / Identity Fraud',
    description: 'Scammers claim your Aadhaar has been misused, linked to criminal activity, or needs immediate verification. They try to extract your Aadhaar number, OTPs, or biometric data. UIDAI never calls to verify Aadhaar.',
    riskLevel: 'HIGH',
    helpline: 'UIDAI Helpline',
    helplineNumber: '1947',
    recommendations: [
      'UIDAI never calls to verify your Aadhaar',
      'Lock your biometrics at myaadhaar.uidai.gov.in',
      'Never share your Aadhaar OTP',
      'Report Aadhaar misuse at 1947',
    ],
  },
]

/**
 * Search the knowledge base for patterns matching a query.
 * Returns the top N matching patterns sorted by relevance.
 */
export function searchPatterns(query: string, limit: number = 5): ScamPattern[] {
  const queryLower = query.toLowerCase()
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2)

  const scored = SCAM_PATTERNS.map(pattern => {
    let score = 0

    // Keyword matches (highest weight)
    for (const keyword of pattern.keywords) {
      if (queryLower.includes(keyword)) {
        score += 10
      } else {
        // Partial keyword match
        for (const word of queryWords) {
          if (keyword.includes(word) || word.includes(keyword)) {
            score += 3
          }
        }
      }
    }

    // Category match
    if (queryLower.includes(pattern.category.toLowerCase())) {
      score += 8
    }

    // Title match
    for (const word of queryWords) {
      if (pattern.title.toLowerCase().includes(word)) {
        score += 2
      }
    }

    return { pattern, score }
  })

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.pattern)
}

/**
 * Get a formatted response for a specific scam pattern.
 */
export function formatPatternResponse(pattern: ScamPattern): string {
  let response = `## ${pattern.title}\n\n`
  response += `**Risk Level:** ${pattern.riskLevel}\n\n`
  response += `${pattern.description}\n\n`
  response += `### What to do:\n`
  for (const rec of pattern.recommendations) {
    response += `- ${rec}\n`
  }
  response += `\n**Helpline:** ${pattern.helpline} — **${pattern.helplineNumber}**\n`
  return response
}
