#!/usr/bin/env node
/**
 * Generate placeholder PWA PNG icons (192x192, 512x512, 512x512 maskable).
 *
 * Pure-Node implementation: writes a single-color RGBA PNG using only
 * Node built-ins (zlib + Buffer). Avoids a runtime dependency on sharp
 * or ImageMagick for a placeholder asset.
 *
 * Maskable icon keeps the brand "safe zone" (inner ~80% circle/square)
 * fully opaque so OS-launcher masks never crop the logo.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, '..', 'public');

// Brand: zinc-900 background (#18181b), white "T" shape.
const BG = [0x18, 0x18, 0x1b, 0xff];
const FG = [0xff, 0xff, 0xff, 0xff];

/**
 * Compute PNG CRC32 (must match zlib polynomial 0xedb88320).
 * Returns a 4-byte big-endian buffer.
 */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return Buffer.from([(c >>> 24) & 0xff, (c >>> 16) & 0xff, (c >>> 8) & 0xff, c & 0xff]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBuf, data]));
  return Buffer.concat([len, typeBuf, data, crc]);
}

/**
 * Render an RGBA pixel grid of size*size as a single PNG.
 * shape: 'square' draws a white "T" letter; 'circle' draws a filled disk
 *        (used for the maskable safe-zone preview).
 */
function buildPixels(size, shape) {
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      let c = BG;

      if (shape === 'square') {
        // "T" letter, ~16% stem width, top bar at 25–35% height.
        const stemHalfWidth = 0.08;
        const barHalfHeight = 0.05;
        const barYMin = 0.25;
        const barYMax = 0.35;
        const inStem =
          u > 0.5 - stemHalfWidth && u < 0.5 + stemHalfWidth && v > barYMax && v < 0.78;
        const inBar = v > barYMin && v < barYMax && u > 0.18 && u < 0.82;
        if (inStem || inBar) c = FG;
      } else if (shape === 'circle') {
        // Maskable preview: white filled circle, ~80% diameter.
        const dx = u - 0.5;
        const dy = v - 0.5;
        if (dx * dx + dy * dy < 0.16) c = FG;
      }

      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = c[3];
    }
  }
  return px;
}

function encodePng(width, height, rgba) {
  // PNG signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw scanlines: 1 filter byte (0) + RGBA row
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function emit(file, size, shape) {
  const pixels = buildPixels(size, shape);
  const png = encodePng(size, size, pixels);
  const out = resolve(PUBLIC_DIR, file);
  writeFileSync(out, png);
  console.log(`wrote ${file} (${png.length} bytes)`);
}

mkdirSync(PUBLIC_DIR, { recursive: true });
emit('pwa-192.png', 192, 'square');
emit('pwa-512.png', 512, 'square');
emit('pwa-512-maskable.png', 512, 'circle');