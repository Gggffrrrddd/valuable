/*
 * Generates PLACEHOLDER assets for the study-circle table into public/visuals/table/.
 * When the real assets (table-scene.png, student-figure.png, book-closed.png,
 * book-open-1..4.png) arrive, drop them at the same paths and delete this
 * script's output — nothing else needs to change except the anchors in
 * src/components/circle-table/tableConfig.ts.
 *
 * Pure Node (zlib only): minimal PNG encoder + small procedural drawing kit.
 * Run: npm run generate:table-placeholders
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'visuals', 'table');

/* ----------------------------- PNG encoding ------------------------------ */

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

function encodePng(raster) {
  const { w, h, data } = raster;
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

/* ------------------------------ draw kit --------------------------------- */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rgb = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

class Raster {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4); // transparent
  }

  blend(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = (y * this.w + x) * 4;
    const d = this.data;
    const sa = Math.min(1, a);
    const da = d[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    if (oa <= 0) {
      d[i + 3] = 0;
      return;
    }
    d[i] = Math.round((r * sa + d[i] * da * (1 - sa)) / oa);
    d[i + 1] = Math.round((g * sa + d[i + 1] * da * (1 - sa)) / oa);
    d[i + 2] = Math.round((b * sa + d[i + 2] * da * (1 - sa)) / oa);
    d[i + 3] = Math.round(oa * 255);
  }

  /** Fills a bbox using a signed-distance -> coverage fn (1px antialiasing). */
  fillSdf(x0, y0, x1, y1, sdf, colorFn) {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.h, Math.ceil(y1)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.w, Math.ceil(x1)); x++) {
        const a = sdf(x + 0.5, y + 0.5);
        if (a <= 0) continue;
        const [r, g, b] = colorFn(x + 0.5, y + 0.5);
        this.blend(x, y, r, g, b, Math.min(a, 1));
      }
    }
  }

  ellipse(cx, cy, rx, ry, colorFn) {
    const aa = Math.max(2, Math.min(rx, ry));
    this.fillSdf(
      cx - rx - 2, cy - ry - 2, cx + rx + 2, cy + ry + 2,
      (px, py) => {
        const d = Math.hypot((px - cx) / rx, (py - cy) / ry);
        return clamp(0.5 - (d - 1) * aa, 0, 1);
      },
      colorFn
    );
  }

  /** Feathered radial blob for shadows / light pools. */
  softEllipse(cx, cy, rx, ry, [r, g, b], peak) {
    this.fillSdf(
      cx - rx, cy - ry, cx + rx, cy + ry,
      (px, py) => {
        const d = Math.hypot((px - cx) / rx, (py - cy) / ry);
        return d >= 1 ? 0 : peak * (1 - d) * (1 - d);
      },
      () => [r, g, b]
    );
  }

  roundRect(cx, cy, w, h, r, colorFn) {
    const hw = w / 2;
    const hh = h / 2;
    this.fillSdf(
      cx - hw - 2, cy - hh - 2, cx + hw + 2, cy + hh + 2,
      (px, py) => {
        const dx = Math.max(Math.abs(px - cx) - (hw - r), 0);
        const dy = Math.max(Math.abs(py - cy) - (hh - r), 0);
        return clamp(0.5 - (Math.hypot(dx, dy) - r), 0, 1);
      },
      colorFn
    );
  }

  /** Bilinear src-over blit of another raster, centered at (cx, cy), scaled to dw x dh. */
  blitScaled(src, cx, cy, dw, dh) {
    for (let y = Math.max(0, Math.floor(cy - dh / 2)); y < Math.min(this.h, Math.ceil(cy + dh / 2)); y++) {
      for (let x = Math.max(0, Math.floor(cx - dw / 2)); x < Math.min(this.w, Math.ceil(cx + dw / 2)); x++) {
        const sx = ((x + 0.5 - (cx - dw / 2)) / dw) * src.w - 0.5;
        const sy = ((y + 0.5 - (cy - dh / 2)) / dh) * src.h - 0.5;
        const x0 = clamp(Math.floor(sx), 0, src.w - 1);
        const y0 = clamp(Math.floor(sy), 0, src.h - 1);
        const x1 = clamp(x0 + 1, 0, src.w - 1);
        const y1 = clamp(y0 + 1, 0, src.h - 1);
        const fx = clamp(sx - x0, 0, 1);
        const fy = clamp(sy - y0, 0, 1);
        const s = src.data;
        const sample = (xx, yy) => {
          const i = (yy * src.w + xx) * 4;
          return [s[i], s[i + 1], s[i + 2], s[i + 3] / 255];
        };
        const c00 = sample(x0, y0);
        const c10 = sample(x1, y0);
        const c01 = sample(x0, y1);
        const c11 = sample(x1, y1);
        const top = [
          lerp(c00[0], c10[0], fx), lerp(c00[1], c10[1], fx), lerp(c00[2], c10[2], fx), lerp(c00[3], c10[3], fx),
        ];
        const bot = [
          lerp(c01[0], c11[0], fx), lerp(c01[1], c11[1], fx), lerp(c01[2], c11[2], fx), lerp(c01[3], c11[3], fx),
        ];
        this.blend(x, y, lerp(top[0], bot[0], fy), lerp(top[1], bot[1], fy), lerp(top[2], bot[2], fy), lerp(top[3], bot[3], fy));
      }
    }
  }
}

/* --------------------------- palette + layout ----------------------------- */

const C = {
  bgNear: [23, 27, 22],
  bgFar: [9, 11, 10],
  woodLight: [90, 71, 50],
  woodDark: [50, 39, 27],
  woodRim: [36, 27, 18],
  chairTop: [46, 52, 43],
  chairBottom: [27, 31, 26],
  cushionTop: [56, 64, 51],
  cushionBottom: [35, 40, 32],
  ivory: [236, 230, 211],
  ivoryShade: [207, 199, 174],
  cover: [51, 64, 45],
  coverDark: [40, 50, 36],
  figureLight: [198, 194, 179],
  figureDark: [154, 150, 136],
};

// These anchors mirror src/components/circle-table/tableConfig.ts (scene pixels).
const TABLE = { cx: 960, cy: 660, rx: 430, ry: 185 };
const SEAT_FIGURE = [
  { x: 960, y: 905 },  // seat 1 — current user (front-center)
  { x: 475, y: 530 },  // seat 2 — top-left
  { x: 1445, y: 530 }, // seat 3 — top-right
  { x: 330, y: 700 },  // seat 4 — left
  { x: 1590, y: 700 }, // seat 5 — right
  { x: 960, y: 385 },  // seat 6 — top-center
];
const SEAT_BOOK = [
  { x: 960, y: 742 },
  { x: 640, y: 573 },
  { x: 1280, y: 573 },
  { x: 585, y: 668 },
  { x: 1335, y: 668 },
  { x: 960, y: 515 },
];

/* ------------------------------- art: books ------------------------------- */

function drawBookClosed() {
  const r = new Raster(220, 150);
  // Cover slab
  r.roundRect(110, 80, 128, 64, 7, (px, py) => rgb(C.cover, C.coverDark, clamp((py - 48) / 64, 0, 1)));
  // Spine band (left)
  r.roundRect(52, 80, 16, 60, 4, () => C.coverDark);
  // Page edge (right)
  r.roundRect(166, 80, 12, 56, 3, () => [221, 214, 193]);
  // Emboss line
  r.roundRect(112, 64, 82, 3, 1.5, () => [74, 90, 64]);
  return r;
}

const OPEN_FRAMES = [
  { coverProj: 40, spreadW: 116, spreadH: 66 },
  { coverProj: 22, spreadW: 142, spreadH: 75 },
  { coverProj: 8, spreadW: 162, spreadH: 84 },
  { coverProj: 0, spreadW: 174, spreadH: 92 },
];

function drawBookOpen(k) {
  const { coverProj, spreadW, spreadH } = OPEN_FRAMES[k];
  const r = new Raster(220, 150);
  // Pages spread beneath the rotating cover; darker toward the spine crease.
  r.roundRect(110, 80, spreadW, spreadH, 6, (px) => rgb(C.ivoryShade, C.ivory, clamp(Math.abs(px - 110) / (spreadW / 2), 0, 1)));
  // Page lines
  for (let i = 1; i <= 3; i++) {
    const ly = 80 - spreadH / 2 + (i * spreadH) / 4;
    r.roundRect(110 - spreadW / 4 - 6, ly, spreadW / 2 - 26, 2, 1, () => [183, 176, 154]);
    r.roundRect(110 + spreadW / 4 + 6, ly, spreadW / 2 - 26, 2, 1, () => [183, 176, 154]);
  }
  // Spine valley
  r.roundRect(110, 80, 6, spreadH - 6, 3, () => [143, 136, 115]);
  // Cover halves rotating through vertical (skip when fully flat)
  if (coverProj > 4) {
    const half = coverProj / 2;
    r.roundRect(110 - half, 79, coverProj, spreadH + 4, 4, () => C.cover);
    r.roundRect(110 - half, 79 - spreadH / 2 + 8, coverProj, 3, 1.5, () => [86, 104, 76]);
  } else {
    // Fully open: cover edges peeking at the far outer edges
    r.roundRect(110 - spreadW / 2 + 3, 80, 5, spreadH + 2, 2, () => C.coverDark);
    r.roundRect(110 + spreadW / 2 - 3, 80, 5, spreadH + 2, 2, () => C.coverDark);
  }
  return r;
}

/* ------------------------------ art: figure ------------------------------- */

function drawFigure() {
  const r = new Raster(200, 280);
  const body = (py) => rgb(C.figureLight, C.figureDark, clamp((py - 90) / 170, 0, 1));
  // Head
  r.ellipse(100, 62, 31, 33, (px, py) => rgb(C.figureLight, [166, 162, 148], clamp((py - 30) / 60, 0, 1)));
  // Neck shadow
  r.softEllipse(100, 94, 22, 9, [10, 10, 8], 0.35);
  // Torso / shoulders
  r.roundRect(100, 158, 108, 128, 50, (px, py) => body(py));
  // Arms resting at the sides
  r.ellipse(56, 168, 15, 36, () => [148, 144, 130]);
  r.ellipse(144, 168, 15, 36, () => [148, 144, 130]);
  // Lap (legs tucked under the table)
  r.ellipse(100, 240, 47, 24, () => [124, 120, 108]);
  r.softEllipse(100, 252, 60, 16, [8, 9, 7], 0.4);
  return r;
}

/* ------------------------------- art: scene ------------------------------- */

function drawChair(r, cx, cy, w, h) {
  r.roundRect(cx, cy, w, h, h * 0.3, (px, py) => rgb(C.chairTop, C.chairBottom, clamp((py - (cy - h / 2)) / h, 0, 1)));
  r.roundRect(cx, cy + 6, w - 18, h - 26, h * 0.26, (px, py) =>
    rgb(C.cushionTop, C.cushionBottom, clamp((py - (cy - h / 2)) / h, 0, 1))
  );
  r.roundRect(cx, cy - h / 2 + 6, w - 10, 6, 3, () => [176, 184, 160]);
  r.roundRect(cx, cy + h / 2 - 14, w * 0.42, 7, 3.5, () => [16, 18, 15]);
}

function drawScene(bookClosed) {
  const W = 1920;
  const H = 1080;
  const r = new Raster(W, H);

  // Ambient background: radial falloff + corner vignette
  r.fillSdf(0, 0, W, H, () => 1, (px, py) => {
    const dLight = Math.hypot(px - 960, py - 420) / 1200;
    const base = rgb(C.bgNear, C.bgFar, clamp(dLight, 0, 1));
    const v = clamp((Math.hypot(px - 960, py - 540) - 520) / 640, 0, 1);
    return [base[0] * (1 - v * 0.5), base[1] * (1 - v * 0.5), base[2] * (1 - v * 0.5)];
  });

  // Overhead lamp pool
  r.softEllipse(960, 480, 720, 400, [226, 232, 205], 0.05);

  // Far chairs (seats 2-6): beside / behind the table
  const farSeats = [1, 2, 3, 4, 5];
  for (const s of farSeats) {
    const { x, y } = SEAT_FIGURE[s];
    const side = s === 3 || s === 4; // left/right seats slightly larger (nearer)
    drawChair(r, x, y, side ? 146 : 138, side ? 158 : 150);
  }

  // Table floor shadow
  r.softEllipse(960, 852, 485, 95, [0, 0, 0], 0.5);

  // Table: dark rim below, lighter top surface, top sheen
  r.ellipse(TABLE.cx, TABLE.cy, TABLE.rx, TABLE.ry, () => C.woodRim);
  r.ellipse(TABLE.cx, TABLE.cy - 4, TABLE.rx - 16, TABLE.ry - 9, (px, py) => {
    const t = clamp((py - (TABLE.cy - TABLE.ry)) / (2 * TABLE.ry), 0, 1);
    const dCenter = Math.hypot((px - TABLE.cx) / TABLE.rx, (py - TABLE.cy) / TABLE.ry);
    const lit = rgb(C.woodLight, C.woodDark, t * 0.85 + dCenter * 0.15);
    return rgb(lit, [107, 86, 60], clamp((1 - dCenter) * 0.35, 0, 1));
  });
  r.softEllipse(960, 585, 330, 90, [255, 244, 220], 0.06);

  // Front chair (seat 1): drawn over the table's near edge
  drawChair(r, SEAT_FIGURE[0].x, SEAT_FIGURE[0].y, 158, 172);

  // Baked closed book at every seat (empty seats keep theirs permanently)
  for (const b of SEAT_BOOK) {
    r.softEllipse(b.x, b.y + 9, 62, 14, [0, 0, 0], 0.35);
    r.blitScaled(bookClosed, b.x, b.y, 110, 75);
  }

  return r;
}

/* --------------------------------- run ------------------------------------ */

mkdirSync(OUT_DIR, { recursive: true });

const outputs = [
  ['table-scene.png', () => drawScene(drawBookClosed())],
  ['student-figure.png', drawFigure],
  ['book-closed.png', drawBookClosed],
  ['book-open-1.png', () => drawBookOpen(0)],
  ['book-open-2.png', () => drawBookOpen(1)],
  ['book-open-3.png', () => drawBookOpen(2)],
  ['book-open-4.png', () => drawBookOpen(3)],
];

for (const [name, make] of outputs) {
  writeFileSync(join(OUT_DIR, name), encodePng(make()));
  console.log(`wrote ${join('public/visuals/table', name)}`);
}
