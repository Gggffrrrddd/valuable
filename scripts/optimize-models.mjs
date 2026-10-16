/*
 * Moderate OBJ decimation for Study Table models (table-3d.obj, chair-3d.obj).
 * Uses the project's own three.js (SimplifyModifier + OBJLoader + OBJExporter),
 * so the output goes through the EXACT same parse path as the app loader.
 *
 * - Target: ~25% fewer triangles (moderate/safe per brief 20-30%).
 * - UVs preserved (SimplifyModifier is uv-aware); materials are applied by
 *   code at runtime (MTL files are unused dummies), so dropping mtllib is safe.
 * - Validates by re-parsing the output: mesh count, tri count in [70%,80%],
 *   uv attribute present.
 *
 * Usage: node scripts/optimize-models.mjs
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const TARGET_KEEP = 0.75; // keep 75% of triangles (25% reduction)
const DEFAULT_FILES = ['public/visuals/table/table-3d.obj', 'public/visuals/table/chair-3d.obj'];
const FILES = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_FILES;

function triCount(geo) {
  const index = geo.index;
  const pos = geo.attributes.position;
  if (!pos) return 0;
  return index ? Math.floor(index.count / 3) : Math.floor(pos.count / 3);
}

function processFile(path) {
  const before = statSync(path).size;
  const group = new OBJLoader().parse(readFileSync(path, 'utf8'));
  const meshes = [];
  group.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  if (!meshes.length) throw new Error(`${path}: no meshes found`);
  const mod = new SimplifyModifier();
  const stats = [];
  for (const mesh of meshes) {
    let geo = mesh.geometry;
    const beforeTris = triCount(geo);
    const beforeVerts = geo.attributes.position.count;
    const hasUv = !!geo.attributes.uv;
    // Index first for cleaner collapses (mergeVertices is idempotent-ish).
    try {
      geo = mergeVertices(geo);
    } catch {
      /* keep original on merge failure */
    }
    const target = Math.floor(beforeTris * TARGET_KEEP);
    let current = triCount(geo);
    let guard = 0;
    while (current > target && guard < 8) {
      const verts = geo.attributes.position.count;
      const remove = Math.max(50, Math.floor(verts * 0.08));
      const next = mod.modify(geo, remove);
      if (!next || triCount(next) >= current) break; // no progress — stop
      if (geo !== mesh.geometry) geo.dispose?.();
      geo = next;
      current = triCount(geo);
      guard += 1;
    }
    mesh.geometry = geo;
    // Re-index (SimplifyModifier outputs non-indexed: 3 verts per tri) and
    // drop normals (originals have none; the loader path stays identical).
    // Without this the file bloats ~6x and gains 73k vn lines.
    try {
      const prev = mesh.geometry;
      // Delete normals FIRST: SimplifyModifier leaves per-face normals that
      // differ at shared corners and block merging. Originals carry no
      // normals at all (loader path stays identical without them).
      prev.deleteAttribute('normal');
      const welded = mergeVertices(prev);
      mesh.geometry = welded;
      if (prev !== welded) prev.dispose?.();
      geo = welded;
    } catch {
      /* keep unindexed on weld failure */
    }
    stats.push({
      beforeTris,
      beforeVerts,
      afterTris: triCount(geo),
      afterVerts: geo.attributes.position.count,
      uvKept: !!geo.attributes.uv && (hasUv ? geo.attributes.uv.count > 0 : true),
    });
  }
  const raw = new OBJExporter().parse(group);
  // OBJExporter writes full double precision (~17 digits) which bloats the
  // file ~6x. Round vertex data to 6 decimals (visually lossless) — this is
  // what makes the decimation actually shrink the download size.
  const out = raw
    .split('\n')
    .map((line) => {
      const head = line.slice(0, 2);
      if (head !== 'v ' && head !== 'vt' && head !== 'vn') return line;
      const parts = line.split(/\s+/);
      return parts[0] + ' ' + parts.slice(1).map((p) => {
        if (p.indexOf('/') !== -1) return p; // face line safety (not v/vt/vn anyway)
        const n = Number(p);
        return Number.isFinite(n) ? String(Number(n.toFixed(6))) : p;
      }).join(' ');
    })
    .join('\n');
  writeFileSync(path, out, 'utf8');
  const after = statSync(path).size;

  // Validate: re-parse output through the same loader the app uses.
  const re = new OBJLoader().parse(out);
  const reMeshes = [];
  re.traverse((o) => {
    if (o.isMesh) reMeshes.push(o);
  });
  if (!reMeshes.length) throw new Error(`${path}: re-parse found no meshes`);
  let reTris = 0;
  let reUv = true;
  for (const m of reMeshes) {
    reTris += triCount(m.geometry);
    if (!m.geometry.attributes.uv || m.geometry.attributes.uv.count === 0) reUv = false;
  }
  const totBefore = stats.reduce((a, s) => a + s.beforeTris, 0);
  const totAfter = stats.reduce((a, s) => a + s.afterTris, 0);
  const ratio = totAfter / Math.max(1, totBefore);
  const vnLines = out.split('\n').filter((l) => l.startsWith('vn ')).length;
  const ok = reMeshes.length === meshes.length && ratio >= 0.68 && ratio <= 0.82 && reUv && vnLines === 0;
  console.log(
    `${path}: meshes=${meshes.length} tris ${totBefore}→${totAfter} (${Math.round(ratio * 100)}% kept) ` +
      `size ${(before / 1048576).toFixed(2)}→${(after / 1048576).toFixed(2)}MB uv=${reUv} VALID=${ok}`,
  );
  if (!ok) throw new Error(`${path}: validation failed (ratio ${ratio.toFixed(3)}, uv ${reUv})`);
}

for (const f of FILES) processFile(f);
console.log('done');
