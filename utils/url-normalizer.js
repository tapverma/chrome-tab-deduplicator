/**
 * URL Normalizer and Canonicalizer for Smart Tab Deduplication
 * 
 * Handles smart normalization for Google Docs, Sheets, Slides, GitHub, YouTube,
 * tracking query parameters, and URL fragments.
 */

// Tracking parameters to strip in smart mode
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'msclkid',
  'ref',
  'ref_src',
  'source',
  'feature',
  '_hsenc',
  '_hsmi',
  'mc_cid',
  'mc_eid',
  'yclid',
  'igshid',
  'spm',
  'si',
  // Google sharing / account routing parameters
  'usp',
  'ouid',
  'authuser'
]);

/**
 * Normalizes a URL based on mode.
 * @param {string} rawUrl - The tab's full URL
 * @param {'smart' | 'exact'} mode - Deduplication mode
 * @returns {{ canonicalUrl: string, subDetail: string, originalUrl: string }}
 */
export function normalizeUrl(rawUrl, mode = 'smart') {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      canonicalUrl: '',
      subDetail: '',
      originalUrl: rawUrl || ''
    };
  }

  // Exact mode preserves full URL trimmed of outer whitespace
  if (mode === 'exact') {
    return {
      canonicalUrl: rawUrl.trim(),
      subDetail: '',
      originalUrl: rawUrl.trim()
    };
  }

  try {
    const urlObj = new URL(rawUrl.trim());
    const protocol = urlObj.protocol.toLowerCase();
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname;
    const hash = urlObj.hash;
    let subDetail = '';

    // Ignore protocols that aren't web URLs (e.g., javascript:, data:)
    if (!['http:', 'https:', 'chrome:', 'edge:', 'brave:'].includes(protocol)) {
      return {
        canonicalUrl: rawUrl.trim(),
        subDetail: '',
        originalUrl: rawUrl.trim()
      };
    }

    // 1. Special Handling: Google Docs
    // docs.google.com/document/d/{id}/... or docs.google.com/document/u/0/d/{id}/...
    if (hostname === 'docs.google.com' && pathname.includes('/document/')) {
      const docMatch = pathname.match(/\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
      if (docMatch) {
        const docId = docMatch[1];
        const canonicalUrl = `https://docs.google.com/document/d/${docId}`;
        
        // Extract sub-details (e.g. #heading=..., ?tab=...)
        const details = [];
        if (hash) {
          const headingMatch = hash.match(/heading=([^&]+)/);
          if (headingMatch) {
            details.push(`Heading: ${decodeURIComponent(headingMatch[1])}`);
          } else {
            details.push(hash.replace(/^#/, ''));
          }
        }
        if (urlObj.searchParams.has('tab')) {
          details.push(`Tab: ${urlObj.searchParams.get('tab')}`);
        }
        if (pathname.includes('/edit')) {
          // default edit view
        } else if (pathname.includes('/preview')) {
          details.push('Preview');
        } else if (pathname.includes('/view')) {
          details.push('View only');
        }

        return {
          canonicalUrl,
          subDetail: details.join(' • '),
          originalUrl: rawUrl.trim()
        };
      }
    }

    // 2. Special Handling: Google Sheets
    // docs.google.com/spreadsheets/d/{id}/...
    if (hostname === 'docs.google.com' && pathname.includes('/spreadsheets/')) {
      const sheetMatch = pathname.match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
      if (sheetMatch) {
        const sheetId = sheetMatch[1];
        const canonicalUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`;
        
        const details = [];
        // Check hash for gid or range
        if (hash) {
          const gidMatch = hash.match(/gid=(\d+)/);
          if (gidMatch) {
            details.push(`Sheet gid: ${gidMatch[1]}`);
          }
          const rangeMatch = hash.match(/range=([a-zA-Z0-9:]+)/);
          if (rangeMatch) {
            details.push(`Range: ${rangeMatch[1]}`);
          }
          if (!gidMatch && !rangeMatch) {
            details.push(hash.replace(/^#/, ''));
          }
        }
        // Also check if gid is in query parameters
        if (urlObj.searchParams.has('gid')) {
          details.push(`Sheet gid: ${urlObj.searchParams.get('gid')}`);
        }

        return {
          canonicalUrl,
          subDetail: details.join(' • '),
          originalUrl: rawUrl.trim()
        };
      }
    }

    // 3. Special Handling: Google Slides
    // docs.google.com/presentation/d/{id}/...
    if (hostname === 'docs.google.com' && pathname.includes('/presentation/')) {
      const slideMatch = pathname.match(/\/presentation\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
      if (slideMatch) {
        const slideId = slideMatch[1];
        const canonicalUrl = `https://docs.google.com/presentation/d/${slideId}`;
        
        const details = [];
        if (hash) {
          const slideSlide = hash.match(/slide=([^&]+)/);
          if (slideSlide) {
            details.push(`Slide: ${slideSlide[1]}`);
          } else {
            details.push(hash.replace(/^#/, ''));
          }
        }

        return {
          canonicalUrl,
          subDetail: details.join(' • '),
          originalUrl: rawUrl.trim()
        };
      }
    }

    // 4. Special Handling: Google Drive Folders / Files
    if (hostname === 'drive.google.com') {
      const folderMatch = pathname.match(/\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/);
      if (folderMatch) {
        return {
          canonicalUrl: `https://drive.google.com/drive/folders/${folderMatch[1]}`,
          subDetail: '',
          originalUrl: rawUrl.trim()
        };
      }
      const fileMatch = pathname.match(/\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch) {
        return {
          canonicalUrl: `https://drive.google.com/file/d/${fileMatch[1]}`,
          subDetail: '',
          originalUrl: rawUrl.trim()
        };
      }
    }

    // 5. Special Handling: GitHub Pull Requests & Issues
    if (hostname === 'github.com') {
      const prMatch = pathname.match(/^\/([^/]+\/[^/]+)\/pull\/(\d+)/);
      if (prMatch) {
        const canonicalUrl = `https://github.com/${prMatch[1]}/pull/${prMatch[2]}`;
        let sub = '';
        if (pathname.includes('/files')) sub = 'Files changed';
        else if (pathname.includes('/commits')) sub = 'Commits';
        else if (hash) sub = hash.replace(/^#/, '');
        return {
          canonicalUrl,
          subDetail: sub,
          originalUrl: rawUrl.trim()
        };
      }

      const issueMatch = pathname.match(/^\/([^/]+\/[^/]+)\/issues\/(\d+)/);
      if (issueMatch) {
        const canonicalUrl = `https://github.com/${issueMatch[1]}/issues/${issueMatch[2]}`;
        const sub = hash ? hash.replace(/^#/, '') : '';
        return {
          canonicalUrl,
          subDetail: sub,
          originalUrl: rawUrl.trim()
        };
      }
    }

    // 6. Special Handling: YouTube Videos
    if (hostname === 'www.youtube.com' || hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      if (pathname === '/watch' && urlObj.searchParams.has('v')) {
        const videoId = urlObj.searchParams.get('v');
        const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const time = urlObj.searchParams.get('t');
        return {
          canonicalUrl,
          subDetail: time ? `Time: ${time}` : '',
          originalUrl: rawUrl.trim()
        };
      }
    } else if (hostname === 'youtu.be') {
      const videoId = pathname.replace(/^\//, '');
      if (videoId) {
        const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const time = urlObj.searchParams.get('t');
        return {
          canonicalUrl,
          subDetail: time ? `Time: ${time}` : '',
          originalUrl: rawUrl.trim()
        };
      }
    }

    // 7. General Web URL Normalization
    // Sub detail for hash fragments
    if (hash) {
      subDetail = decodeURIComponent(hash.replace(/^#/, ''));
    }

    // Filter tracking query parameters
    const cleanParams = new URLSearchParams();
    const sortedKeys = Array.from(urlObj.searchParams.keys()).sort();
    for (const key of sortedKeys) {
      const lowerKey = key.toLowerCase();
      if (!TRACKING_PARAMS.has(lowerKey)) {
        for (const val of urlObj.searchParams.getAll(key)) {
          cleanParams.append(key, val);
        }
      }
    }

    // Strip standard ports
    let host = urlObj.hostname.toLowerCase();
    if ((protocol === 'http:' && urlObj.port === '80') || (protocol === 'https:' && urlObj.port === '443')) {
      host = urlObj.hostname;
    } else if (urlObj.port) {
      host = `${urlObj.hostname}:${urlObj.port}`;
    }

    // Normalize pathname: remove trailing slash if path is longer than 1 character
    let normPath = pathname;
    if (normPath.length > 1 && normPath.endsWith('/')) {
      normPath = normPath.slice(0, -1);
    }

    const queryStr = cleanParams.toString();
    const canonicalUrl = `${protocol}//${host}${normPath}${queryStr ? '?' + queryStr : ''}`;

    return {
      canonicalUrl,
      subDetail,
      originalUrl: rawUrl.trim()
    };
  } catch {
    // If URL parsing fails (e.g. custom scheme), fallback to trimmed URL
    return {
      canonicalUrl: rawUrl.trim(),
      subDetail: '',
      originalUrl: rawUrl.trim()
    };
  }
}

/**
 * Returns a human-friendly display label for the canonical URL
 * @param {string} canonicalUrl 
 * @returns {string}
 */
export function getDisplayUrl(canonicalUrl) {
  try {
    const u = new URL(canonicalUrl);
    return `${u.hostname}${u.pathname !== '/' ? u.pathname : ''}${u.search}`;
  } catch {
    return canonicalUrl;
  }
}
