import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * Pure Node.js PNG generator without external dependencies.
 * Creates valid PNG files with IHDR, IDAT, and IEND chunks.
 */
function createPNG(width, height, pixelFn) {
  // 4 bytes per pixel (RGBA), plus 1 filter byte per scanline
  const scanlineLength = width * 4;
  const rawData = Buffer.alloc(height * (scanlineLength + 1));

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // Helper to create chunk
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);

    const typeBuf = Buffer.from(type, 'ascii');
    const body = Buffer.concat([typeBuf, data]);

    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(body), 0);

    return Buffer.concat([len, body, crcBuf]);
  }

  // CRC32 implementation
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  // IHDR data
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression: 0
  ihdr[11] = 0; // Filter: 0
  ihdr[12] = 0; // Interlace: 0

  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrChunk = chunk('IHDR', ihdr);
  const idatChunk = chunk('IDAT', compressed);
  const iendChunk = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Draws an overlapping dual-tab icon with duplicate indicator.
 */
function drawTabDedupeIcon(x, y, w, h) {
  // Normalize to 0..1 coordinates
  const nx = x / w;
  const ny = y / h;

  // Background rounded rectangle
  const pad = 0.06;
  if (nx >= pad && nx <= 1 - pad && ny >= pad && ny <= 1 - pad) {
    // Check rounded corners of main background
    const cornerR = 0.2;
    const isCorner = (
      (nx < pad + cornerR && ny < pad + cornerR && Math.hypot(nx - (pad + cornerR), ny - (pad + cornerR)) > cornerR) ||
      (nx > 1 - pad - cornerR && ny < pad + cornerR && Math.hypot(nx - (1 - pad - cornerR), ny - (pad + cornerR)) > cornerR) ||
      (nx < pad + cornerR && ny > 1 - pad - cornerR && Math.hypot(nx - (pad + cornerR), ny - (1 - pad - cornerR)) > cornerR) ||
      (nx > 1 - pad - cornerR && ny > 1 - pad - cornerR && Math.hypot(nx - (1 - pad - cornerR), ny - (1 - pad - cornerR)) > cornerR)
    );
    if (!isCorner) {
      // Primary background: clean vibrant gradient from Blue #2563eb to Cyan #0284c7
      const grad = ny;
      const r = Math.round(37 + (2 - 37) * grad);
      const g = Math.round(99 + (132 - 99) * grad);
      const b = Math.round(235 + (199 - 235) * grad);

      // Tab 1 (back tab)
      const tab1L = 0.18, tab1R = 0.65, tab1T = 0.22, tab1B = 0.58;
      if (nx >= tab1L && nx <= tab1R && ny >= tab1T && ny <= tab1B) {
        return [255, 255, 255, 180];
      }

      // Tab 2 (front tab, overlapping)
      const tab2L = 0.32, tab2R = 0.78, tab2T = 0.38, tab2B = 0.74;
      if (nx >= tab2L && nx <= tab2R && ny >= tab2T && ny <= tab2B) {
        // Tab header bar
        if (ny <= tab2T + 0.10) {
          return [220, 235, 255, 255];
        }
        // Tab body with small cross indicator
        const cx = (tab2L + tab2R) / 2;
        const cy = (tab2T + tab2B + 0.05) / 2;
        const dist = Math.hypot(nx - cx, ny - cy);
        if (dist < 0.10) {
          // Orange/Amber dedupe dot
          return [245, 158, 11, 255];
        }
        return [255, 255, 255, 250];
      }

      return [r, g, b, 255];
    }
  }

  // Transparent outside
  return [0, 0, 0, 0];
}

const iconsDir = path.resolve('icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

for (const size of [16, 48, 128]) {
  const pngBuf = createPNG(size, size, drawTabDedupeIcon);
  const outPath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, pngBuf);
  console.log(`Generated ${outPath} (${size}x${size}, ${pngBuf.length} bytes)`);
}

// Also create an SVG for scalable preview
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
  </defs>
  <rect x="8" y="8" width="112" height="112" rx="24" fill="url(#bgGrad)" />
  <!-- Back tab -->
  <rect x="22" y="26" width="56" height="46" rx="6" fill="#ffffff" fill-opacity="0.75" />
  <!-- Front tab -->
  <rect x="42" y="46" width="60" height="48" rx="8" fill="#ffffff" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.2))" />
  <rect x="42" y="46" width="60" height="12" rx="8" fill="#e0e7ff" />
  <!-- Dedupe cross / indicator dot -->
  <circle cx="72" cy="74" r="10" fill="#f59e0b" />
  <path d="M68 70 L76 78 M76 70 L68 78" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent);
console.log('Generated icons/icon.svg');
