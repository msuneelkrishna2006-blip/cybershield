/**
 * CyberShield India — Elderly Mode Configuration
 *
 * Provides accessibility features for elderly users:
 * - Larger text and simplified UI
 * - Voice narration integration hooks
 * - Simplified scan workflow
 * - Hindi/regional language defaults
 */

export interface ElderlyModeConfig {
  enabled: boolean;
  fontSize: 'normal' | 'large' | 'extra-large';
  highContrast: boolean;
  voiceNarration: boolean;
  simplifiedUI: boolean;
  preferredLanguage: string;
  autoScanOnPaste: boolean;
  quickDialEmergency: boolean;
}

export const DEFAULT_ELDERLY_CONFIG: ElderlyModeConfig = {
  enabled: false,
  fontSize: 'large',
  highContrast: true,
  voiceNarration: true,
  simplifiedUI: true,
  preferredLanguage: 'hi',
  autoScanOnPaste: true,
  quickDialEmergency: true,
};

/**
 * Font size CSS classes for elderly mode
 */
export const FONT_SIZE_CLASSES: Record<ElderlyModeConfig['fontSize'], string> = {
  'normal': '',
  'large': 'text-lg',
  'extra-large': 'text-xl',
};

/**
 * Simplified scan categories for elderly users
 * (reduces cognitive load from 8+ categories to 4)
 */
export const ELDERLY_SCAN_CATEGORIES = [
  {
    id: 'message',
    labelEn: 'Check Message',
    labelHi: 'संदेश जांचें',
    icon: 'MessageSquare',
    description: 'Paste any suspicious SMS, WhatsApp, or email message',
  },
  {
    id: 'call',
    labelEn: 'Report Phone Call',
    labelHi: 'फोन कॉल रिपोर्ट करें',
    icon: 'Phone',
    description: 'Describe a suspicious phone call you received',
  },
  {
    id: 'link',
    labelEn: 'Check Link/URL',
    labelHi: 'लिंक जांचें',
    icon: 'Link',
    description: 'Paste any link someone sent you',
  },
  {
    id: 'help',
    labelEn: 'Get Help',
    labelHi: 'मदद लें',
    icon: 'HelpCircle',
    description: 'Talk to CyberShield AI for guidance',
  },
];

/**
 * Voice narration text templates (Hindi + English)
 */
export const VOICE_TEMPLATES = {
  welcome: {
    en: 'Welcome to CyberShield. You are safe. Tap any option to get started.',
    hi: 'साइबरशील्ड में आपका स्वागत है। आप सुरक्षित हैं। शुरू करने के लिए कोई विकल्प चुनें।',
  },
  scanSafe: {
    en: 'Good news! This message appears to be safe. No threats were detected.',
    hi: 'अच्छी खबर! यह संदेश सुरक्षित प्रतीत होता है। कोई खतरा नहीं पाया गया।',
  },
  scanDanger: {
    en: 'Warning! This message may be a scam. Do not share any personal information or money. Call your family member if you need help.',
    hi: 'चेतावनी! यह संदेश एक धोखाधड़ी हो सकता है। कोई व्यक्तिगत जानकारी या पैसा न दें। मदद के लिए अपने परिवार के सदस्य को कॉल करें।',
  },
  sosTriggered: {
    en: 'Emergency SOS has been triggered. Your emergency contacts have been notified. Stay calm and call 112 if you are in immediate danger.',
    hi: 'आपातकालीन SOS शुरू हो गया है। आपके आपातकालीन संपर्कों को सूचित किया गया है। शांत रहें और तुरंत खतरे में हों तो 112 पर कॉल करें।',
  },
};

/**
 * Speaks text using the Web Speech API.
 * Returns a promise that resolves when speech completes.
 */
export function speakText(text: string, lang: string = 'hi-IN'): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve(); // SSR or no speech API
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.85; // Slightly slower for elderly
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error('Speech synthesis failed'));

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Stops any ongoing speech.
 */
export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
