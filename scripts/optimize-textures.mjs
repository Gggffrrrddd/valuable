/*
 * Moderate texture optimization for Study Table + Solar System visuals.
 * - Long edge > 1600px → resize to 1536px (conservative end of 1024-1536).
 * - PNG: lossless recompress (compressionLevel 9). JPG: q90 (transparent).
 * - TIFF: resize only, same container (validated by decoding with the app's
 *   own three TIFFLoader afterwards — output that fails decode is reverted).
 * - Same filenames in place → zero code changes. Originals are backed up in
 *   model-original-backup/ (never bundled, repo root).
 *
 * Usage: node scripts/optimize-textures.mjs
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import sharp from 'sharp';
import { TIFFLoader } from 'three/examples/jsm/loaders/TIFFLoader.js';

const LONG_EDGE = 1536;

const PNG_FILES = [
  'public/visuals/table/table-3d-texture.png',
  'public/visuals/table/chair-3d-texture.png',
  'public/visuals/table/floor-texture.png',
  'public/visuals/table/wall-texture.png',
  'public/visuals/solar-system/galaxies/whirlpool-galaxy-tilted.png',
  'public/visuals/solar-system/galaxies/andromeda-galaxy-tilted.png',
];

const JPG_FILES = [
  'public/visuals/solar-system/2k_sun.jpg',
  'public/visuals/solar-system/2k_mercury.jpg',
  'public/visuals/solar-system/2k_venus_surface.jpg',
  'public/visuals/solar-system/2k_earth_daymap.jpg',
  'public/visuals/solar-system/2k_earth_nightmap.jpg',
  'public/visuals/solar-system/2k_earth_clouds.jpg',
  'public/visuals/solar-system/2k_mars.jpg',
  'public/visuals/solar-system/2k_jupiter.jpg',
  'public/visuals/solar-system/2k_saturn.jpg',
  'public/visuals/solar-system/2k_uranus.jpg',
  'public/visuals/solar-system/2k_neptune.jpg',
];

const TIFF_FILES = [
  'public/visuals/solar-system/2k_earth_normal_map.tif',
  'public/visuals/solar-system/2k_earth_specular_map.tif',
];

const mb = (b) => (b / 1048576).toFixed(2);

async function dimsOf(buf) {
  const m = await sharp(buf).metadata();
  return { w: m.width ?? 0, h: m.height ?? 0 };
}

function targetSize(w, h) {
  const long = Math.max(w, h);
  if (long <= 1600) return null; // recompress only
  const s = LONG_EDGE / long;
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

async function processPng(path) {
  const before = statSync(path).size;
  const input = readFileSync(path);
  const { w, h } = await dimsOf(input);
  const t = targetSize(w, h);
  let pipe = sharp(input);
  if (t) pipe = pipe.resize(t.w, t.h, { fit: 'inside', withoutEnlargement: true });
  const out = await pipe.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
  const om = await sharp(out).metadata();
  if (!om.width || !om.height) throw new Error(`${path}: output unreadable`);
  writeFileSync(path, out);
  console.log(`PNG ${path}: ${w}x${h} ${(before / 1048576).toFixed(2)}MB → ${om.width}x${om.height} ${mb(out.length)}MB`);
}

async function processJpg(path) {
  const before = statSync(path).size;
  const input = readFileSync(path);
  const { w, h } = await dimsOf(input);
  const t = targetSize(w, h);
  let pipe = sharp(input, { failOn: 'none' });
  if (t) pipe = pipe.resize(t.w, t.h, { fit: 'inside', withoutEnlargement: true });
  const out = await pipe.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  const om = await sharp(out).metadata();
  if (!om.width || !om.height) throw new Error(`${path}: output unreadable`);
  writeFileSync(path, out);
  console.log(`JPG ${path.split('/').pop()}: ${w}x${h} ${(before / 1048576).toFixed(2)}MB → ${om.width}x${om.height} ${mb(out.length)}MB`);
}

async function processTiff(path) {
  const before = statSync(path).size;
  const input = readFileSync(path);
  const { w, h } = await dimsOf(input);
  const t = targetSize(w, h);
  let pipe = sharp(input, { failOn: 'none' });
  if (t) pipe = pipe.resize(t.w, t.h, { fit: 'inside', withoutEnlargement: true });
  const out = await pipe.tiff({ compression: 'deflate', predictor: 'horizontal' }).toBuffer();
  // Validate with the app's own decoder before accepting.
  const decoded = new TIFFLoader().parse(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength));
  const dw = decoded?.width ?? 0;
  const dh = decoded?.height ?? 0;
  if (!dw || !dh) throw new Error(`${path}: TIFF decode validation failed`);
  writeFileSync(path, out);
  console.log(`TIF ${path.split('/').pop()}: ${w}x${h} ${(before / 1048576).toFixed(2)}MB → ${dw}x${dh} ${mb(out.length)}MB decode-ok`);
}

for (const f of PNG_FILES) await processPng(f);
for (const f of JPG_FILES) await processJpg(f);
for (const f of TIFF_FILES) await processTiff(f);
console.log('done');
