import { normalizeUrl, getDisplayUrl } from './url-normalizer.js';

/**
 * Tab Deduplication Engine
 * Groups tabs across all windows and tab groups, enriching them with group and window metadata.
 */

/**
 * Processes raw tabs, tab groups, and windows to find clusters of duplicate tabs.
 * 
 * @param {Array<chrome.tabs.Tab>} allTabs
 * @param {Map<number, chrome.tabGroups.TabGroup> | Object} groupsMap
 * @param {Map<number, { index: number, isCurrent: boolean }> | Object} windowsMap
 * @param {'smart' | 'exact'} mode
 * @returns {{ clusters: Array<DuplicateCluster>, stats: Stats }}
 */
export function findDuplicateTabs(allTabs = [], groupsMap = new Map(), windowsMap = new Map(), mode = 'smart') {
  const clustersByKey = new Map();

  for (const tab of allTabs) {
    if (!tab.url) continue;

    const { canonicalUrl, subDetail, originalUrl } = normalizeUrl(tab.url, mode);
    if (!canonicalUrl) continue;

    const groupId = tab.groupId ?? -1;
    const group = (groupId !== -1 && groupsMap instanceof Map) ? groupsMap.get(groupId) : (groupsMap?.[groupId] || null);

    const windowInfo = (windowsMap instanceof Map) ? windowsMap.get(tab.windowId) : (windowsMap?.[tab.windowId] || null);
    const windowName = windowInfo ? (windowInfo.isCurrent ? `Current Win` : `Win ${windowInfo.index}`) : `Win`;

    const enrichedTab = {
      id: tab.id,
      title: tab.title || 'Untitled',
      url: originalUrl,
      favIconUrl: tab.favIconUrl || '',
      windowId: tab.windowId,
      windowName,
      isCurrentWindow: Boolean(windowInfo?.isCurrent),
      active: Boolean(tab.active),
      pinned: Boolean(tab.pinned),
      audible: Boolean(tab.audible),
      groupId,
      isGrouped: groupId !== -1 && groupId !== undefined,
      groupTitle: group ? (group.title && group.title.trim().length > 0 ? group.title : `Group #${groupId}`) : null,
      groupColor: group ? group.color : null,
      subDetail
    };

    if (!clustersByKey.has(canonicalUrl)) {
      clustersByKey.set(canonicalUrl, {
        canonicalUrl,
        displayUrl: getDisplayUrl(canonicalUrl),
        domain: extractDomain(canonicalUrl),
        title: enrichedTab.title,
        tabs: []
      });
    }

    const cluster = clustersByKey.get(canonicalUrl);
    cluster.tabs.push(enrichedTab);
    // Prefer non-generic title for the cluster
    if (enrichedTab.title && (!cluster.title || cluster.title === 'Untitled' || cluster.title.length < enrichedTab.title.length)) {
      cluster.title = enrichedTab.title;
    }
  }

  // Filter out clusters with only 1 tab (not a duplicate)
  const duplicateClusters = [];
  let totalDuplicates = 0; // redundant tabs that can be closed
  let totalDuplicateTabs = 0; // all tabs in duplicate clusters

  for (const cluster of clustersByKey.values()) {
    if (cluster.tabs.length > 1) {
      // Sort tabs within cluster: grouped tabs first, then active tabs, then pinned
      cluster.tabs.sort((a, b) => {
        if (a.isGrouped !== b.isGrouped) return a.isGrouped ? -1 : 1;
        if (a.active !== b.active) return a.active ? -1 : 1;
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return a.id - b.id;
      });

      duplicateClusters.push(cluster);
      totalDuplicates += (cluster.tabs.length - 1);
      totalDuplicateTabs += cluster.tabs.length;
    }
  }

  // Sort clusters: clusters with more duplicates first
  duplicateClusters.sort((a, b) => b.tabs.length - a.tabs.length);

  return {
    clusters: duplicateClusters,
    stats: {
      clusterCount: duplicateClusters.length,
      redundantTabCount: totalDuplicates,
      totalDuplicateTabs,
      totalTabsScanned: allTabs.length
    }
  };
}

function extractDomain(urlStr) {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, '');
  } catch {
    return 'Web';
  }
}
