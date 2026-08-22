/**
 * CyberShield India — Extension Popup Script
 */

const API_BASE = 'http://localhost:3000'; // Updated in production build

async function scanPage() {
  const initial = document.getElementById('initial');
  const loading = document.getElementById('loading');
  const result = document.getElementById('result');

  initial.style.display = 'none';
  result.style.display = 'none';
  loading.style.display = 'block';

  try {
    // Get current tab URL
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url || '';

    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
      showResult({ riskScore: 0, riskLevel: 'SAFE', indicators: ['Browser internal page'], action: 'This is a browser page — no scan needed.' });
      return;
    }

    const res = await fetch(`${API_BASE}/api/v1/extension/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Extension-Key': await getApiKey() },
      body: JSON.stringify({ url, source: 'chrome' }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.success) {
      showResult(data.data);
    } else {
      showResult({ riskScore: 0, riskLevel: 'SAFE', indicators: ['Scan unavailable'], action: data.error?.message || 'Could not analyze page.' });
    }
  } catch (err) {
    showResult({ riskScore: 0, riskLevel: 'SAFE', indicators: ['Connection error'], action: 'Could not connect to CyberShield. Check if the app is running.' });
  }
}

function showResult(data) {
  const loading = document.getElementById('loading');
  const result = document.getElementById('result');
  const scoreEl = document.getElementById('riskScore');
  const labelEl = document.getElementById('riskLabel');
  const indicatorsEl = document.getElementById('indicators');
  const actionEl = document.getElementById('actionText');

  loading.style.display = 'none';
  result.style.display = 'block';

  scoreEl.textContent = data.riskScore;
  labelEl.textContent = data.riskLevel;

  // Color classes
  const level = data.riskLevel.toLowerCase();
  scoreEl.className = 'risk-score ' + level;
  labelEl.className = 'risk-label ' + level;

  // Indicators
  indicatorsEl.innerHTML = (data.indicators || []).map(i => `<div class="indicator">• ${i}</div>`).join('');

  // Action
  const actionClass = data.riskScore >= 50 ? 'action-danger' : data.riskScore >= 25 ? 'action-caution' : 'action-safe';
  actionEl.className = 'action-text ' + actionClass;
  actionEl.textContent = data.action || '';
}

async function getApiKey() {
  const result = await chrome.storage.local.get('extensionApiKey');
  return result.extensionApiKey || 'dev-key';
}
