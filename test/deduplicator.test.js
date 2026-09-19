import test from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicateTabs } from '../utils/deduplicator.js';

test('findDuplicateTabs clusters tabs with Google Docs variations across groups and windows', () => {
  const tabs = [
    {
      id: 101,
      title: 'Q3 Strategy Doc - Google Docs',
      url: 'https://docs.google.com/document/d/doc12345/edit',
      groupId: 10,
      windowId: 1
    },
    {
      id: 102,
      title: 'Q3 Strategy Doc - Google Docs',
      url: 'https://docs.google.com/document/d/doc12345/edit#heading=h.abc',
      groupId: -1, // ungrouped
      windowId: 1
    },
    {
      id: 103,
      title: 'Q3 Strategy Doc - Google Docs',
      url: 'https://docs.google.com/document/u/0/d/doc12345/view?tab=t.0',
      groupId: 20,
      windowId: 2
    },
    {
      id: 201,
      title: 'Single Tab',
      url: 'https://github.com/google/gemini',
      groupId: -1,
      windowId: 1
    }
  ];

  const groupsMap = new Map([
    [10, { id: 10, title: 'Strategy', color: 'blue' }],
    [20, { id: 20, title: 'Reference', color: 'red' }]
  ]);

  const windowsMap = new Map([
    [1, { index: 1, isCurrent: true }],
    [2, { index: 2, isCurrent: false }]
  ]);

  const result = findDuplicateTabs(tabs, groupsMap, windowsMap, 'smart');

  assert.equal(result.clusters.length, 1);
  assert.equal(result.stats.clusterCount, 1);
  assert.equal(result.stats.redundantTabCount, 2); // 3 tabs - 1 = 2 can be closed
  assert.equal(result.stats.totalDuplicateTabs, 3);
  assert.equal(result.stats.totalTabsScanned, 4);

  const cluster = result.clusters[0];
  assert.equal(cluster.canonicalUrl, 'https://docs.google.com/document/d/doc12345');
  assert.equal(cluster.tabs.length, 3);

  // Grouped tabs come first
  assert.equal(cluster.tabs[0].isGrouped, true);
  assert.equal(cluster.tabs[0].groupTitle, 'Strategy');
  assert.equal(cluster.tabs[0].groupColor, 'blue');
  assert.equal(cluster.tabs[0].windowName, 'Current Win');

  const ungrouped = cluster.tabs.find(t => !t.isGrouped);
  assert.ok(ungrouped);
  assert.equal(ungrouped.groupId, -1);
  assert.equal(ungrouped.groupTitle, null);
  assert.match(ungrouped.subDetail, /Heading: h\.abc/);
});

test('findDuplicateTabs with exact mode does not group different URLs', () => {
  const tabs = [
    {
      id: 1,
      title: 'Doc',
      url: 'https://docs.google.com/document/d/doc12345/edit',
      groupId: -1,
      windowId: 1
    },
    {
      id: 2,
      title: 'Doc Section',
      url: 'https://docs.google.com/document/d/doc12345/edit#heading=h.abc',
      groupId: -1,
      windowId: 1
    }
  ];

  const result = findDuplicateTabs(tabs, new Map(), new Map(), 'exact');
  assert.equal(result.clusters.length, 0);
  assert.equal(result.stats.redundantTabCount, 0);
});
