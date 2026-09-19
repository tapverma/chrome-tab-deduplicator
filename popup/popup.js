import { findDuplicateTabs } from '../utils/deduplicator.js';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const smartModeToggle = document.getElementById('smartModeToggle');
const modeText = document.getElementById('modeText');
const popoutBtn = document.getElementById('popoutBtn');
const refreshBtn = document.getElementById('refreshBtn');
const cleanAllBtn = document.getElementById('cleanAllBtn');
const summaryBanner = document.getElementById('summaryBanner');
const duplicatesCountBadge = document.getElementById('duplicatesCountBadge');
const summaryText = document.getElementById('summaryText');
const statSubtitle = document.getElementById('statSubtitle');

const duplicateSections = document.getElementById('duplicateSections');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const noResultsState = document.getElementById('noResultsState');

const confirmModal = document.getElementById('confirmModal');
const modalMessage = document.getElementById('modalMessage');
const confirmCleanBtn = document.getElementById('confirmCleanBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const toast = document.getElementById('toast');

// Application State
let currentMode = 'smart';
let currentClusters = [];
let allTabsCache = [];
let groupsMapCache = new Map();
let windowsMapCache = new Map();
let searchQuery = '';

/**
 * Show a quick toast notification
 */
let toastTimeout = null;
function showToast(message) {
  if (toastTimeout) clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.remove('hidden');
  toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2200);
}

/**
 * Fetches all tabs, tab groups, and windows from Chrome, then runs deduplication.
 */
async function scanDuplicateTabs() {
  duplicateSections.innerHTML = '';
  loadingState.classList.remove('hidden');
  emptyState.classList.add('hidden');
  noResultsState.classList.add('hidden');
  summaryBanner.classList.add('hidden');

  try {
    // 1. Query all tabs in all windows
    allTabsCache = await chrome.tabs.query({});

    // 2. Query tab groups
    groupsMapCache.clear();
    try {
      if (chrome.tabGroups) {
        const groups = await chrome.tabGroups.query({});
        for (const g of groups) {
          groupsMapCache.set(g.id, g);
        }
      }
    } catch (e) {
      console.warn('Could not query tab groups:', e);
    }

    // 3. Query all windows
    windowsMapCache.clear();
    try {
      let currentWinId = null;
      try {
        const currentWin = await chrome.windows.getCurrent();
        currentWinId = currentWin?.id;
      } catch {}

      const windows = await chrome.windows.getAll();
      windows.forEach((win, index) => {
        windowsMapCache.set(win.id, {
          index: index + 1,
          isCurrent: currentWinId ? (win.id === currentWinId) : Boolean(win.focused)
        });
      });
    } catch (e) {
      console.warn('Could not query windows:', e);
    }

    // 4. Run deduplication engine
    const { clusters, stats } = findDuplicateTabs(allTabsCache, groupsMapCache, windowsMapCache, currentMode);
    currentClusters = clusters;

    // Update Header Stats
    statSubtitle.textContent = `Scanned ${stats.totalTabsScanned} tabs in ${windowsMapCache.size || 1} window${windowsMapCache.size > 1 ? 's' : ''}`;

    loadingState.classList.add('hidden');
    renderClusters();

    // Sync toolbar badge
    try {
      chrome.runtime.sendMessage({ type: 'REFRESH_BADGE' });
    } catch {}
  } catch (err) {
    loadingState.classList.add('hidden');
    console.error('Error scanning duplicate tabs:', err);
    showToast('Failed to scan tabs');
  }
}

/**
 * Renders the duplicate tab clusters based on currentClusters and search filter.
 */
function renderClusters() {
  duplicateSections.innerHTML = '';

  if (currentClusters.length === 0) {
    emptyState.classList.remove('hidden');
    noResultsState.classList.add('hidden');
    summaryBanner.classList.add('hidden');
    return;
  }

  // Apply search query filter
  const query = searchQuery.trim().toLowerCase();
  const filteredClusters = currentClusters.filter(cluster => {
    if (!query) return true;
    if (cluster.title.toLowerCase().includes(query)) return true;
    if (cluster.canonicalUrl.toLowerCase().includes(query)) return true;
    if (cluster.domain.toLowerCase().includes(query)) return true;
    return cluster.tabs.some(tab => 
      tab.title.toLowerCase().includes(query) ||
      (tab.groupTitle && tab.groupTitle.toLowerCase().includes(query)) ||
      (tab.subDetail && tab.subDetail.toLowerCase().includes(query))
    );
  });

  if (filteredClusters.length === 0) {
    emptyState.classList.add('hidden');
    noResultsState.classList.remove('hidden');
    summaryBanner.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  noResultsState.classList.add('hidden');

  // Update Summary Banner
  let totalRedundant = 0;
  for (const c of currentClusters) {
    totalRedundant += (c.tabs.length - 1);
  }

  duplicatesCountBadge.textContent = String(totalRedundant);
  summaryText.textContent = `${totalRedundant} duplicate tab${totalRedundant === 1 ? '' : 's'} can be closed`;
  summaryBanner.classList.remove('hidden');

  // Build each duplicate section
  filteredClusters.forEach((cluster, clusterIndex) => {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'cluster-section';
    sectionEl.dataset.canonicalUrl = cluster.canonicalUrl;

    // Cluster Header
    const headerEl = document.createElement('div');
    headerEl.className = 'cluster-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'cluster-header-left';

    const domainBadge = document.createElement('span');
    domainBadge.className = 'cluster-domain-badge';
    domainBadge.textContent = cluster.domain;
    domainBadge.title = cluster.displayUrl;

    const titleEl = document.createElement('span');
    titleEl.className = 'cluster-title';
    titleEl.textContent = cluster.title;
    titleEl.title = `${cluster.title}\n${cluster.canonicalUrl}`;

    headerLeft.appendChild(domainBadge);
    headerLeft.appendChild(titleEl);

    const headerRight = document.createElement('div');
    headerRight.className = 'cluster-header-right';

    const countEl = document.createElement('span');
    countEl.className = 'cluster-count';
    countEl.textContent = `${cluster.tabs.length} tabs`;

    const keepFirstBtn = document.createElement('button');
    keepFirstBtn.className = 'keep-one-btn';
    keepFirstBtn.textContent = 'Keep 1st';
    keepFirstBtn.title = 'Keep the first tab and close all other duplicates in this group';
    keepFirstBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      keepTabAndCloseOthers(cluster.tabs[0].id, cluster, sectionEl);
    });

    headerRight.appendChild(countEl);
    headerRight.appendChild(keepFirstBtn);

    headerEl.appendChild(headerLeft);
    headerEl.appendChild(headerRight);
    sectionEl.appendChild(headerEl);

    // Tab List
    const tabListEl = document.createElement('div');
    tabListEl.className = 'tab-list';

    cluster.tabs.forEach((tab, tabIndex) => {
      const tabItemEl = document.createElement('div');
      tabItemEl.className = 'tab-item';
      tabItemEl.dataset.tabId = String(tab.id);

      tabItemEl.title = `Switch to tab: ${tab.title}`;
      tabItemEl.addEventListener('click', (e) => {
        // If clicking on or inside the close button, don't switch tabs
        if (e.target.closest('.tab-close-btn')) {
          return;
        }
        goToTab(tab.id, tab.windowId, tab.groupId);
      });

      // Main Info Area
      const mainInfoEl = document.createElement('div');
      mainInfoEl.className = 'tab-main-info';

      // Favicon
      if (tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://')) {
        const iconImg = document.createElement('img');
        iconImg.className = 'tab-favicon';
        iconImg.src = tab.favIconUrl;
        iconImg.alt = '';
        iconImg.onerror = () => {
          iconImg.replaceWith(createFallbackIcon());
        };
        mainInfoEl.appendChild(iconImg);
      } else {
        mainInfoEl.appendChild(createFallbackIcon());
      }

      // Details
      const detailsEl = document.createElement('div');
      detailsEl.className = 'tab-text-details';

      const titleLine = document.createElement('div');
      titleLine.className = 'tab-title-line';
      titleLine.textContent = tab.title;

      const metaLine = document.createElement('div');
      metaLine.className = 'tab-meta-line';

      // 1. Tab Group Pill
      if (tab.isGrouped) {
        const groupPill = document.createElement('span');
        const colorClass = tab.groupColor ? `group-${tab.groupColor}` : 'group-grey';
        groupPill.className = `pill group-pill ${colorClass}`;
        
        const dot = document.createElement('span');
        dot.className = 'group-dot';
        groupPill.appendChild(dot);

        const groupTitle = document.createElement('span');
        groupTitle.textContent = tab.groupTitle;
        groupPill.appendChild(groupTitle);
        metaLine.appendChild(groupPill);
      } else {
        const ungroupedPill = document.createElement('span');
        ungroupedPill.className = 'pill ungrouped-pill';
        ungroupedPill.textContent = 'Ungrouped';
        metaLine.appendChild(ungroupedPill);
      }

      // 2. Window Pill
      const windowPill = document.createElement('span');
      windowPill.className = `pill window-pill ${tab.isCurrentWindow ? 'current' : ''}`;
      windowPill.textContent = tab.windowName;
      metaLine.appendChild(windowPill);

      // 3. Sub-detail (e.g. Sheet gid, section heading, PR files)
      if (tab.subDetail) {
        const detailPill = document.createElement('span');
        detailPill.className = 'pill detail-pill';
        detailPill.textContent = tab.subDetail;
        detailPill.title = tab.subDetail;
        metaLine.appendChild(detailPill);
      }

      detailsEl.appendChild(titleLine);
      detailsEl.appendChild(metaLine);
      mainInfoEl.appendChild(detailsEl);

      // Close Button (Cross '×')
      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close-btn';
      closeBtn.innerHTML = '&times;';
      closeBtn.title = 'Close this tab';
      closeBtn.setAttribute('aria-label', `Close ${tab.title}`);
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeSingleTab(tab.id, cluster, tabItemEl, sectionEl);
      });

      tabItemEl.appendChild(mainInfoEl);
      tabItemEl.appendChild(closeBtn);
      tabListEl.appendChild(tabItemEl);
    });

    sectionEl.appendChild(tabListEl);
    duplicateSections.appendChild(sectionEl);
  });
}

/**
 * Creates fallback icon element for tabs without favicon
 */
function createFallbackIcon() {
  const fallback = document.createElement('div');
  fallback.className = 'tab-favicon-fallback';
  fallback.textContent = '⧉';
  return fallback;
}

/**
 * Reliably activates and focuses the target tab across any window or tab group.
 */
async function goToTab(tabId, windowId, groupId) {
  if (!tabId || !windowId) {
    showToast('Invalid tab target');
    return;
  }

  const numTabId = Number(tabId);
  const numWindowId = Number(windowId);
  const numGroupId = (groupId !== undefined && groupId !== null) ? Number(groupId) : -1;

  try {
    // 1. If tab is in a collapsed group, uncollapse the group so Chrome reveals it
    if (numGroupId !== -1 && chrome.tabGroups) {
      try {
        await chrome.tabGroups.update(numGroupId, { collapsed: false });
      } catch (groupErr) {
        console.warn('Could not uncollapse group:', groupErr);
      }
    }

    // 2. Activate the tab inside its window
    await chrome.tabs.update(numTabId, { active: true });

    // 3. Bring the target window to the front (unminimize if needed)
    try {
      const targetWin = await chrome.windows.get(numWindowId);
      if (targetWin.state === 'minimized') {
        await chrome.windows.update(numWindowId, { state: 'normal', focused: true });
      } else {
        await chrome.windows.update(numWindowId, { focused: true });
      }
    } catch (winErr) {
      console.warn('Fallback direct window focus:', winErr);
      await chrome.windows.update(numWindowId, { focused: true });
    }

    // 4. In dropdown popup, close popup so Chrome immediately reveals the focused tab
    const isDetached = new URLSearchParams(window.location.search).get('detached') === 'true';
    if (!isDetached) {
      window.close();
    } else {
      document.querySelectorAll('.tab-item.active-focused').forEach(el => el.classList.remove('active-focused'));
      const activeEl = document.querySelector(`.tab-item[data-tab-id="${numTabId}"]`);
      if (activeEl) activeEl.classList.add('active-focused');
      showToast('Switched to tab');
    }
  } catch (err) {
    console.error('Failed to switch to tab:', err);
    showToast('Could not open tab — it may have been closed');
    await scanDuplicateTabs();
  }
}

/**
 * Closes an individual tab with smooth animation and updates data model.
 */
async function closeSingleTab(tabId, cluster, tabItemEl, sectionEl) {
  try {
    tabItemEl.classList.add('removing');
    await chrome.tabs.remove(tabId);

    setTimeout(() => {
      // Remove tab from cluster object
      cluster.tabs = cluster.tabs.filter(t => t.id !== tabId);
      tabItemEl.remove();

      // If cluster has 1 or 0 tabs remaining, it is no longer a duplicate set
      if (cluster.tabs.length <= 1) {
        sectionEl.classList.add('collapsing');
        setTimeout(() => {
          sectionEl.remove();
          currentClusters = currentClusters.filter(c => c.canonicalUrl !== cluster.canonicalUrl);
          updateSummaryAndStates();
        }, 200);
      } else {
        // Update cluster count display
        const countBadge = sectionEl.querySelector('.cluster-count');
        if (countBadge) countBadge.textContent = `${cluster.tabs.length} tabs`;
        updateSummaryAndStates();
      }

      showToast('Tab closed');
      try {
        chrome.runtime.sendMessage({ type: 'REFRESH_BADGE' });
      } catch {}
    }, 180);
  } catch (err) {
    console.error('Failed to close tab:', err);
    tabItemEl.classList.remove('removing');
    showToast('Failed to close tab');
  }
}

/**
 * Keeps one selected tab in the cluster and closes all other duplicate tabs.
 */
async function keepTabAndCloseOthers(keepTabId, cluster, sectionEl) {
  const tabsToClose = cluster.tabs.filter(t => t.id !== keepTabId);
  const tabIdsToClose = tabsToClose.map(t => t.id);

  if (tabIdsToClose.length === 0) return;

  try {
    sectionEl.classList.add('collapsing');
    await chrome.tabs.remove(tabIdsToClose);

    setTimeout(() => {
      sectionEl.remove();
      currentClusters = currentClusters.filter(c => c.canonicalUrl !== cluster.canonicalUrl);
      updateSummaryAndStates();
      showToast(`Closed ${tabIdsToClose.length} duplicate tab${tabIdsToClose.length > 1 ? 's' : ''}`);
      try {
        chrome.runtime.sendMessage({ type: 'REFRESH_BADGE' });
      } catch {}
    }, 200);
  } catch (err) {
    console.error('Failed to close other duplicate tabs:', err);
    sectionEl.classList.remove('collapsing');
    showToast('Failed to close duplicate tabs');
  }
}

/**
 * Updates summary banner numbers and handles empty state transition.
 */
function updateSummaryAndStates() {
  let totalRedundant = 0;
  for (const c of currentClusters) {
    totalRedundant += (c.tabs.length - 1);
  }

  if (totalRedundant <= 0 || currentClusters.length === 0) {
    summaryBanner.classList.add('hidden');
    emptyState.classList.remove('hidden');
  } else {
    duplicatesCountBadge.textContent = String(totalRedundant);
    summaryText.textContent = `${totalRedundant} duplicate tab${totalRedundant === 1 ? '' : 's'} can be closed`;
  }
}

/**
 * Clean all redundant duplicates across all clusters at once.
 */
async function cleanAllDuplicates() {
  const allRedundantTabIds = [];
  for (const cluster of currentClusters) {
    if (cluster.tabs.length > 1) {
      // Keep the first tab, collect all subsequent duplicate tab IDs
      for (let i = 1; i < cluster.tabs.length; i++) {
        allRedundantTabIds.push(cluster.tabs[i].id);
      }
    }
  }

  if (allRedundantTabIds.length === 0) return;

  confirmModal.classList.add('hidden');

  try {
    await chrome.tabs.remove(allRedundantTabIds);
    showToast(`Closed ${allRedundantTabIds.length} duplicate tabs!`);
    await scanDuplicateTabs();
  } catch (err) {
    console.error('Failed to batch close duplicates:', err);
    showToast('Error closing tabs');
    await scanDuplicateTabs();
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
  // Restore saved mode preference
  const saved = await chrome.storage.local.get('mode');
  if (saved.mode) {
    currentMode = saved.mode;
    smartModeToggle.checked = (currentMode === 'smart');
    modeText.textContent = (currentMode === 'smart') ? 'Smart Match' : 'Exact Match';
  }

  // Scan immediately
  await scanDuplicateTabs();
});

// Refresh button
refreshBtn.addEventListener('click', () => {
  scanDuplicateTabs();
});

// Mode switch toggle
smartModeToggle.addEventListener('change', async () => {
  currentMode = smartModeToggle.checked ? 'smart' : 'exact';
  modeText.textContent = smartModeToggle.checked ? 'Smart Match' : 'Exact Match';
  await chrome.storage.local.set({ mode: currentMode });
  await scanDuplicateTabs();
});

// Search input handling
searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  clearSearchBtn.classList.toggle('hidden', !searchQuery);
  renderClusters();
});

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  clearSearchBtn.classList.add('hidden');
  renderClusters();
});

// Clean All modal triggers
cleanAllBtn.addEventListener('click', () => {
  let count = 0;
  for (const c of currentClusters) {
    count += (c.tabs.length - 1);
  }
  modalMessage.textContent = `This will close ${count} duplicate tab${count === 1 ? '' : 's'} across your windows, keeping the primary tab in each group.`;
  confirmModal.classList.remove('hidden');
});

cancelModalBtn.addEventListener('click', () => {
  confirmModal.classList.add('hidden');
});

confirmCleanBtn.addEventListener('click', cleanAllDuplicates);

// Hide popout button if already running in a detached window
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('detached') === 'true' && popoutBtn) {
  popoutBtn.classList.add('hidden');
}

// Popout Window Button
if (popoutBtn) {
  popoutBtn.addEventListener('click', async () => {
    try {
      await chrome.windows.create({
        url: chrome.runtime.getURL('popup/popup.html?detached=true'),
        type: 'popup',
        width: 440,
        height: 600
      });
      window.close();
    } catch (err) {
      console.warn('Could not create popup window:', err);
      showToast('Could not pop out window');
    }
  });
}
