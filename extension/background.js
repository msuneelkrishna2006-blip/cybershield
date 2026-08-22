/**
 * CyberShield India — Extension Background Service Worker
 * Handles messages from content scripts and manages badge state.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PAGE_RISK_DETECTED') {
    const { riskScore } = message.data;
    const tabId = sender.tab?.id;

    if (tabId) {
      // Update extension badge
      const color = riskScore >= 75 ? '#dc2626' : riskScore >= 50 ? '#f59e0b' : riskScore >= 25 ? '#3b82f6' : '#10b981';
      const text = riskScore >= 50 ? '⚠' : '';

      chrome.action.setBadgeBackgroundColor({ color, tabId });
      chrome.action.setBadgeText({ text, tabId });
    }
  }
  return true;
});

// Clear badge when navigating
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ text: '', tabId });
  }
});
