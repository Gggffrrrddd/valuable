/*
 * GLB embedded-texture compression (Study Table models only).
 * - Long edge > 1600px → resize to 1536px; else recompress only.
 * - Same format kept (PNG stays PNG, JPEG stays JPEG) — materials untouched.
 * - Geometry/accessors/materials/nodes are NEVER modified (byte-identical).
 * - Rebuilds the GLB binary: fresh offsets, 4-byte chunk padding, fixed lengths.
 * - Validates: re-parse JSON, decode every image, tri counts unchanged.
 *
 * Usage: node scripts/compress-glb-textures.mjs [files...]
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import sharp from 'sharp';

const LONG_EDGE = Number(process.env.LONG_EDGE || '1536');
const DEFAULT_FILES = [
  'public/visuals/table/girl_project_chair_polished.glb',
  'public/visuals/table/sitting-character-final.glb',
  'public/visuals/table/book-v2.glb',
  'public/visuals/table/plant-table-ready.glb',
  'public/visuals/table/pen-holder-table-ready.glb',
  'public/visuals/table/open_book_table_ready.glb',
  'public/visuals/table/open-book-table-ready.glb',
];
const FILES = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_FILES;

const mb = (b) => (b / 1048576).toFixed(2);

function triTotal(json) {
  return (json.meshes || []).reduce(
    (a, m) =>
      a +
      m.primitives.reduce((x, p) => {
        const acc = json.accessors[p.indices !== undefined ? p.indices : p.attributes.POSITION];
        const n = acc.count / (p.indices !== undefined ? 3 : 3);
        return x + Math.floor(p.indices !== undefined ? n : n / 1);
      }, 0),
    0,
  );
}

async function processFile(path) {
  const before = statSync(path).size;
  const file = readFileSync(path);
  if (file.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${path}: not a GLB`);
  const version = file.readUInt32LE(4);
  const c0len = file.readUInt32LE(12);
  const json = JSON.parse(file.toString('utf8', 20, 20 + c0len));
  if (!Array.isArray(json.buffers) || json.buffers.length !== 1) {
    throw new Error(`${path}: expected 1 buffer, found ${(json.buffers || []).length}`);
  }
  const binOff = 20 + c0len + 8;
  const binLen = file.readUInt32LE(20 + c0len);
  const bin = file.subarray(binOff, binOff + binLen);
  const trisBefore = triTotal(json);

  const origSlice = (vi) => {
    const bv = json.bufferViews[vi];
    return bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
  };

  // Process embedded images.
  const replacements = new Map(); // bufferView idx -> new Buffer
  for (let i = 0; i < (json.images || []).length; i++) {
    const img = json.images[i];
    if (img.bufferView === undefined || img.bufferView === null) continue; // external — skip
    const src = Buffer.from(origSlice(img.bufferView));
    const meta = await sharp(src, { failOn: 'none' }).metadata();
    if (!meta.width || !meta.height) throw new Error(`${path}: img${i} unreadable`);
    const long = Math.max(meta.width, meta.height);
    let pipe = sharp(src, { failOn: 'none' });
    let outW = meta.width;
    let outH = meta.height;
    if (long > 1600) {
      const s = LONG_EDGE / long;
      outW = Math.round(meta.width * s);
      outH = Math.round(meta.height * s);
      pipe = pipe.resize(outW, outH, { fit: 'inside', withoutEnlargement: true });
    }
    const mime = (img.mimeType || '').toLowerCase();
    let out;
    if (mime === 'image/jpeg' || mime === 'image/jpg') {
      out = await pipe.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    } else {
      out = await pipe.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
    }
    // Validate decodability + dims before accepting.
    const check = await sharp(out).metadata();
    if (!check.width || !check.height) throw new Error(`${path}: img${i} output unreadable`);
    replacements.set(img.bufferView, out);
    console.log(`  img${i} ${img.mimeType}: ${meta.width}x${meta.height} ${mb(src.length)}MB → ${check.width}x${check.height} ${mb(out.length)}MB`);
  }

  // Rebuild BIN in bufferView index order with fresh offsets.
  const newBins = [];
  let off = 0;
  for (let vi = 0; vi < json.bufferViews.length; vi++) {
    const nb = replacements.has(vi) ? replacements.get(vi) : Buffer.from(origSlice(vi));
    json.bufferViews[vi].byteOffset = off;
    json.bufferViews[vi].byteLength = nb.length;
    newBins.push(nb);
    off += nb.length;
  }
  json.buffers[0].byteLength = off;

  const jsonStr = JSON.stringify(json);
  const jsonPad = (4 - (Buffer.byteLength(jsonStr) % 4)) % 4;
  const jsonChunk = Buffer.concat([Buffer.from(jsonStr, 'utf8'), Buffer.alloc(jsonPad, 0x20)]);
  const binPad = (4 - (off % 4)) % 4;
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(version, 4);
  const total = 12 + 8 + jsonChunk.length + 8 + off + binPad;
  header.writeUInt32LE(total, 8);
  const c0h = Buffer.alloc(8);
  c0h.writeUInt32LE(jsonChunk.length, 0);
  c0h.writeUInt32LE(0x4e4f534a, 4);
  const c1h = Buffer.alloc(8);
  c1h.writeUInt32LE(off + binPad, 0);
  c1h.writeUInt32LE(0x004e4942, 4);
  const outFile = Buffer.concat([header, c0h, jsonChunk, c1h, ...newBins, Buffer.alloc(binPad, 0)]);

  // Validate: re-parse + decode every image + tri counts identical.
  const v2len = outFile.readUInt32LE(12);
  const v2json = JSON.parse(outFile.toString('utf8', 20, 20 + v2len));
  const v2off = 20 + v2len + 8;
  const v2bin = outFile.subarray(v2off);
  for (let i = 0; i < (v2json.images || []).length; i++) {
    const im = v2json.images[i];
    if (im.bufferView === undefined) continue;
    const bv = v2json.bufferViews[im.bufferView];
    const sl = v2bin.subarray(bv.byteOffset, bv.byteOffset + bv.byteLength);
    const m = await sharp(sl).metadata();
    if (!m.width || !m.height) throw new Error(`${path}: re-validate img${i} failed`);
  }
  if (triTotal(v2json) !== trisBefore) throw new Error(`${path}: tri count changed`);
  if (outFile.length !== total) throw new Error(`${path}: length header mismatch`);

  writeFileSync(path, outFile);
  console.log(`${path.split('/').pop()}: ${(before / 1048576).toFixed(2)}MB → ${mb(outFile.length)}MB tris=${trisBefore} VALID=true`);
}

for (const f of FILES) await processFile(f);
console.log('done');
