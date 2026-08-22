/**
 * CyberShield India — Extension Content Script
 * Runs on every page to detect phishing indicators in real-time.
 */

(function() {
  'use strict';

  // Quick phishing detection on page load
  const PHISHING_SIGNALS = [
    { selector: 'input[type="password"]', weight: 5, label: 'password-field' },
    { selector: 'input[name*="otp" i], input[name*="pin" i]', weight: 15, label: 'otp-field' },
    { selector: 'input[name*="aadhaar" i], input[name*="aadhar" i]', weight: 20, label: 'aadhaar-field' },
    { selector: 'input[name*="pan" i]', weight: 15, label: 'pan-field' },
    { selector: 'input[name*="upi" i], input[name*="vpa" i]', weight: 20, label: 'upi-field' },
    { selector: 'input[name*="card" i][name*="number" i]', weight: 15, label: 'card-field' },
    { selector: 'input[name*="cvv" i]', weight: 20, label: 'cvv-field' },
    { selector: 'input[name*="bank" i]', weight: 10, label: 'bank-field' },
  ];

  const TEXT_SIGNALS = [
    { pattern: /your.*account.*(?:blocked|suspended|locked|verified)/i, weight: 15 },
    { pattern: /digital.*arrest/i, weight: 25 },
    { pattern: /(?:kyc|aadhar|aadhaar).*(?:expire|update|verify)/i, weight: 20 },
    { pattern: /you.*won.*(?:lottery|prize|crore|lakh)/i, weight: 25 },
    { pattern: /(?:pay|transfer|send).*(?:immediately|urgently|now)/i, weight: 15 },
  ];

  function analyzePageRisk() {
    let riskScore = 0;
    const signals = [];

    // Check form fields
    for (const signal of PHISHING_SIGNALS) {
      const elements = document.querySelectorAll(signal.selector);
      if (elements.length > 0) {
        riskScore += signal.weight;
        signals.push(signal.label);
      }
    }

    // Check page text
    const bodyText = document.body?.innerText || '';
    for (const signal of TEXT_SIGNALS) {
      if (signal.pattern.test(bodyText)) {
        riskScore += signal.weight;
      }
    }

    // Check if page mimics a known Indian bank/service
    const hostname = window.location.hostname;
    const title = document.title.toLowerCase();
    const IMPERSONATION_TARGETS = ['sbi', 'hdfc', 'icici', 'axis', 'paytm', 'phonepe', 'gpay', 'rbi', 'uidai'];
    for (const target of IMPERSONATION_TARGETS) {
      if ((title.includes(target) || bodyText.toLowerCase().includes(target)) && !hostname.includes(target)) {
        riskScore += 20;
        signals.push(`possible-impersonation:${target}`);
      }
    }

    return { riskScore: Math.min(riskScore, 100), signals };
  }

  // Run analysis after page loads
  if (document.readyState === 'complete') {
    runAnalysis();
  } else {
    window.addEventListener('load', runAnalysis);
  }

  function runAnalysis() {
    try {
      const { riskScore, signals } = analyzePageRisk();
      
      // Send to background script if risk detected
      if (riskScore >= 30 && typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'PAGE_RISK_DETECTED',
          data: { url: window.location.href, riskScore, signals },
        });
      }

      // Show warning banner for high risk pages
      if (riskScore >= 50) {
        showWarningBanner(riskScore, signals);
      }
    } catch (e) {
      // Content script errors should never break the page
    }
  }

  function showWarningBanner(riskScore, signals) {
    const banner = document.createElement('div');
    banner.id = 'cybershield-warning';
    banner.innerHTML = `
      <div style="position:fixed;top:0;left:0;right:0;z-index:2147483647;background:linear-gradient(135deg,#dc2626,#991b1b);color:#fff;padding:12px 20px;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:space-between;box-shadow:0 4px 20px rgba(0,0,0,0.3);">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:20px;">🛡️⚠️</span>
          <div>
            <strong style="font-size:14px;">CyberShield Warning — This page may be dangerous</strong>
            <p style="font-size:11px;opacity:0.9;margin-top:2px;">Risk Score: ${riskScore}/100 | This page has characteristics of known scam sites. Do NOT enter personal information.</p>
          </div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">Dismiss</button>
      </div>
    `;
    document.body.prepend(banner);
  }
})();
