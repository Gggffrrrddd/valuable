/*
 * Generates PLACEHOLDER assets for the Butterfly Constellation visual into
 * public/visuals/butterfly/:
 * - butterfly-silhouette.png: alpha mask (opaque = butterfly) that
 *   ButterflyConstellationVisual samples for star positions, exactly like
 *   JarVisual samples its water mask. When the real silhouette art arrives,
 *   drop it at the same path — the component only reads alpha.
 * - butterfly-preview.png: theme-picker preview card art.
 *
 * Run: npm run generate:butterfly-placeholders
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'visuals', 'butterfly');

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
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* Butterfly geometry in a 480x480 space. The TS fallback in
 * ButterflyConstellationVisual.tsx mirrors these constants. */
const SIZE = 480;
const WINGS = [
  { cx: 145, cy: 170, rx: 110, ry: 85, rot: -0.44 },
  { cx: 335, cy: 170, rx: 110, ry: 85, rot: 0.44 },
  { cx: 170, cy: 305, rx: 82, ry: 66, rot: 0.35 },
  { cx: 310, cy: 305, rx: 82, ry: 66, rot: -0.35 },
];
const BODY = { cx: 240, top: 130, bottom: 350, half: 13 };
const ANTENNAE = [
  { x1: 232, y1: 140, x2: 200, y2: 85 },
  { x1: 248, y1: 140, x2: 280, y2: 85 },
];

function distToSegment(px, py, s) {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const t = Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (s.x1 + dx * t), py - (s.y1 + dy * t));
}

function insideShape(px, py) {
  if (Math.abs(px - BODY.cx) <= BODY.half && py >= BODY.top && py <= BODY.bottom) return true;
  for (const a of ANTENNAE) if (distToSegment(px, py, a) <= 4) return true;
  for (const w of WINGS) {
    const cos = Math.cos(-w.rot);
    const sin = Math.sin(-w.rot);
    const dx = px - w.cx;
    const dy = py - w.cy;
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    if ((lx / w.rx) ** 2 + (ly / w.ry) ** 2 <= 1) return true;
  }
  return false;
}

function drawSilhouette() {
  const data = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!insideShape(x + 0.5, y + 0.5)) continue;
      const i = (y * SIZE + x) * 4;
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
    }
  }
  return encodePng(SIZE, SIZE, data);
}

function drawPreview() {
  const W = 360;
  const H = 220;
  const data = Buffer.alloc(W * H * 4);
  const put = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    const sa = a / 255;
    const da = data[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    data[i] = Math.round((r * sa + data[i] * da * (1 - sa)) / oa);
    data[i + 1] = Math.round((g * sa + data[i + 1] * da * (1 - sa)) / oa);
    data[i + 2] = Math.round((b * sa + data[i + 2] * da * (1 - sa)) / oa);
    data[i + 3] = Math.round(oa * 255);
  };
  // Deep night backdrop
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = y / H;
      put(x, y, 10 + 6 * (1 - t), 8 + 6 * (1 - t), 24 + 10 * (1 - t), 255);
    }
  }
  // Constellation dots sampled from the silhouette
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let y = 0; y < SIZE; y += 14) {
    for (let x = 0; x < SIZE; x += 14) {
      if (!insideShape(x, y) || rnd() < 0.25) continue;
      const px = Math.round(30 + (x / SIZE) * (W - 60));
      const py = Math.round(24 + (y / SIZE) * (H - 48));
      const key = rnd() < 0.18;
      const r = key ? 255 : 205;
      const g = key ? 240 : 222;
      const b = 255;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > 3) continue;
          put(px + dx, py + dy, r, g, b, Math.round(210 * (1 - d / 3.2)));
        }
      }
    }
  }
  return encodePng(W, H, data);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'butterfly-silhouette.png'), drawSilhouette());
writeFileSync(join(OUT_DIR, 'butterfly-preview.png'), drawPreview());
console.log('wrote public/visuals/butterfly/butterfly-silhouette.png');
console.log('wrote public/visuals/butterfly/butterfly-preview.png');
