/*
 * Generates PLACEHOLDER assets for the Compete mountain into
 * public/visuals/compete/. When real assets (step markers, climber sprite,
 * mountain art) arrive, drop them at the same paths and delete this output —
 * only the files change; src/components/compete/mountainConfig.ts keeps the
 * same asset paths.
 *
 * Pure Node (zlib only): minimal PNG encoder, same approach as
 * scripts/generate-table-placeholders.mjs.
 * Run: npm run generate:compete-placeholders
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'visuals', 'compete');

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
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(w, h, data) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Glowing lime disc step marker. */
function drawStepMarker() {
  const size = 64;
  const c = size / 2;
  const data = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / (size / 2);
      const i = (y * size + x) * 4;
      if (d < 0.55) {
        data[i] = 197; data[i + 1] = 255; data[i + 2] = 84; data[i + 3] = 255;
      } else if (d < 0.72) {
        data[i] = 197; data[i + 1] = 255; data[i + 2] = 84;
        data[i + 3] = Math.round(255 * (0.72 - d) / 0.17);
      }
    }
  }
  return encodePng(size, size, data);
}

/** Simple climber avatar: warm-lit figure dot with a head. */
function drawClimber() {
  const size = 96;
  const data = Buffer.alloc(size * size * 4);
  const put = (x, y, r, g, b, a) => {
    const i = (y * size + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      // Head
      const dh = Math.hypot(px - 48, py - 26) / 12;
      if (dh < 1) put(x, y, 226, 216, 196, 255);
      // Body capsule
      const db = Math.hypot((px - 48) / 13, (py - 60) / 24);
      if (db < 1) put(x, y, 197, 255, 84, Math.round(255 * Math.min(1, (1 - db) * 3)));
    }
  }
  return encodePng(size, size, data);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'step-marker.png'), drawStepMarker());
writeFileSync(join(OUT_DIR, 'climber.png'), drawClimber());
console.log('wrote public/visuals/compete/step-marker.png');
console.log('wrote public/visuals/compete/climber.png');
