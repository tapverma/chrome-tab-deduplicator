# Chrome Web Store Listing — Smart Tab Deduplicator & Group Manager

> Last Updated: 2026-09-19

## Store Listing

**Extension Name** [REQUIRED]
Smart Tab Deduplicator & Group Manager

**Short Description** [REQUIRED]
Find and clean duplicate tabs across all windows and tab groups with smart URL normalization for Google Docs, Sheets, and more.

**Detailed Description** [REQUIRED]
Smart Tab Deduplicator scans all open Chrome windows and tab groups in your profile to detect and clean redundant duplicate tabs in seconds.

Tired of having 50 tabs open, including the same Google Docs, Google Sheets, and web pages duplicated across multiple windows and tab groups? Smart Tab Deduplicator helps you reclaim your memory and focus.

Key Features:
- Cross-Window Tab Discovery: Finds duplicate tabs across all active Chrome windows in your current profile.
- Tab Group Awareness: Displays whether each duplicate tab belongs to a tab group or is ungrouped, including the exact group name and native Chrome group color dot.
- Smart URL Normalization: Intelligently detects duplicates even if URLs slightly differ, such as Google Docs (ignoring headings/edit mode), Google Sheets (detecting the same spreadsheet across different sheet tabs while showing the sheet gid), GitHub pull requests, and URLs with tracking parameters (utm_source, fbclid, etc.) or anchor hashes.
- In-Place Deduplication: Close redundant tabs directly from the dropdown popup with a single click on the cross (×) button.
- Instant Jump: Click on any tab entry to instantly switch to that tab and bring its window to the front.
- "Keep This Tab" Shortcut: One-click option to keep your preferred tab and dismiss all redundant duplicates in that cluster.
- Batch Clean All: Close all extra duplicate tabs at once with a safe confirmation step.
- Real-time Toolbar Badge: Shows the current number of duplicate tabs open directly on the extension icon.

How to Use:
1. Click the Smart Tab Deduplicator icon in your Chrome toolbar.
2. Review the duplicate tab clusters grouped into clear sections.
3. Check which tab is inside your preferred tab group or window.
4. Click the "×" button to close individual unwanted tabs, or use "Clean All".

Privacy & Permissions:
All tab analysis is performed 100% locally in your browser. No browsing data, tab URLs, or history are ever stored externally or transmitted off your computer.

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Finds and cleans duplicate tabs across all Chrome windows and tab groups with smart URL normalization.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icons/icon-128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 3 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |
| Marquee Promo Tile | 1400×560 | ⬜ Not created | |

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `tabs` | permissions | Required to read tab URLs, titles, and favicons to detect duplicate tabs across windows, switch to selected tabs, and close redundant tabs when requested by the user. |
| `tabGroups` | permissions | Required to query tab group titles and native colors to display whether duplicate tabs are organized inside specific groups. |
| `storage` | permissions | Used to persist user settings locally (such as Smart Match vs Exact Match mode). |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

All data is processed strictly in-memory on the client machine. No analytics, tracking, or network requests are executed.

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free

## Developer Info

**Publisher Name** [REQUIRED]
Developer

**Contact Email** [REQUIRED]
developer@example.com

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-09-19 | Initial release: Cross-window duplicate tab detection, Google Docs/Sheets smart URL normalization, tab group badges with color pills, and in-popup tab closing. | Draft |
