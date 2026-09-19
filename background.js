import { findDuplicateTabs } from './utils/deduplicator.js';

/**
 * Updates the extension badge with the current number of duplicate tabs.
 */
async function updateBadge() {
  try {
    const { mode = 'smart' } = await chrome.storage.local.get('mode');

    // Query all tabs across all windows
    const allTabs = await chrome.tabs.query({});

    // Query all tab groups
    let groupsMap = new Map();
    try {
      if (chrome.tabGroups) {
        const groups = await chrome.tabGroups.query({});
        for (const g of groups) {
          groupsMap.set(g.id, g);
        }
      }
    } catch (e) {
      console.warn('Tab groups query error:', e);
    }

    // Query windows
    let windowsMap = new Map();
    try {
      const windows = await chrome.windows.getAll();
      windows.forEach((win, index) => {
        windowsMap.set(win.id, { index: index + 1, isCurrent: win.focused });
      });
    } catch (e) {
      console.warn('Windows query error:', e);
    }

    const { stats } = findDuplicateTabs(allTabs, groupsMap, windowsMap, mode);

    if (stats.redundantTabCount > 0) {
      await chrome.action.setBadgeText({ text: String(stats.redundantTabCount) });
      await chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' }); // Amber warning
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch (err) {
    console.error('Failed to update duplicate tab badge:', err);
  }
}

// Debounced badge update to prevent rapid hammering on tab bursts
let debounceTimer = null;
function scheduleBadgeUpdate() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(updateBadge, 350);
}

// Listen to Chrome tab lifecycle events
chrome.tabs.onCreated.addListener(scheduleBadgeUpdate);
chrome.tabs.onRemoved.addListener(scheduleBadgeUpdate);
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.title || changeInfo.status === 'complete') {
    scheduleBadgeUpdate();
  }
});
chrome.tabs.onReplaced.addListener(scheduleBadgeUpdate);

// Listen to tab group changes
if (chrome.tabGroups) {
  chrome.tabGroups.onCreated.addListener(scheduleBadgeUpdate);
  chrome.tabGroups.onUpdated.addListener(scheduleBadgeUpdate);
  chrome.tabGroups.onRemoved.addListener(scheduleBadgeUpdate);
}

// Listen to window focus/creation/removal
chrome.windows.onCreated.addListener(scheduleBadgeUpdate);
chrome.windows.onRemoved.addListener(scheduleBadgeUpdate);

// Initialize on install or startup
chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get('mode');
  if (!current.mode) {
    await chrome.storage.local.set({ mode: 'smart' });
  }
  await updateBadge();
});

chrome.runtime.onStartup.addListener(updateBadge);

// Message handler for manual badge refresh from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REFRESH_BADGE') {
    updateBadge().then(() => sendResponse({ success: true }));
    return true; // Keep channel open for async response
  }
});
