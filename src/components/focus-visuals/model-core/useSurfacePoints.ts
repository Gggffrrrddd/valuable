import { useEffect, useState } from 'react';
import { Box3, Mesh, Vector2, Vector3 } from 'three';
import type { BufferGeometry, Object3D } from 'three';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';

/**
 * Shared, model-agnostic surface sampling built on MeshSurfaceSampler.
 * Works identically for any loaded model (horse, beyblade, lion, …) because
 * it is fully parameterized — nothing is hardcoded to a specific shape.
 */

export interface SurfacePoint {
  position: Vector3;
  normal: Vector3;
  uv: Vector2;
  /** 0..count-1 shuffled order, useful for staggered reveal effects. */
  revealRank: number;
  /** Normalized height (0 = lowest, 1 = highest) of the point on the model. */
  heightRank: number;
  twinklePhase: number;
  twinkleSpeed: number;
}

export interface SurfacePointsOptions {
  seed?: number;
  /** Normalize positions into a unit-ish space centered on the origin. */
  normalize?: boolean;
  /** Normalization target size (largest dimension → this value). */
  normalizeSize?: number;
  maxAttempts?: number;
  /** Optional filter — return false to reject a sample. */
  acceptSample?: (sample: Pick<SurfacePoint, 'position' | 'normal' | 'uv'>) => boolean;
}

export interface SurfacePointsState {
  points: SurfacePoint[] | null;
  isLoading: boolean;
  error: Error | null;
}

interface SamplerEntry {
  sampler: MeshSurfaceSampler;
  mesh: Mesh;
  cumulativeArea: number;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function geometrySurfaceArea(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position');
  if (!position) return 0;
  const index = geometry.getIndex();
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  let area = 0;
  const triangleCount = index ? index.count / 3 : position.count / 3;
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 3;
    a.fromBufferAttribute(position, index ? index.getX(offset) : offset);
    b.fromBufferAttribute(position, index ? index.getX(offset + 1) : offset + 1);
    c.fromBufferAttribute(position, index ? index.getX(offset + 2) : offset + 2);
    area += b.sub(a).cross(c.sub(a)).length() * 0.5;
  }
  return area;
}

function collectSamplers(root: Object3D): SamplerEntry[] {
  const entries: SamplerEntry[] = [];
  let cumulativeArea = 0;
  root.updateWorldMatrix(true, true);
  root.traverse((child) => {
    if (!(child instanceof Mesh) || !child.geometry.getAttribute('position')) return;
    cumulativeArea += Math.max(geometrySurfaceArea(child.geometry), 0.0001);
    entries.push({ sampler: new MeshSurfaceSampler(child).build(), mesh: child, cumulativeArea });
  });
  return entries;
}

/**
 * Pure sampling function (also usable outside React). Samples `count` points
 * on the surface of `model`, area-weighted across all meshes, with seeded
 * randomness so results are stable across reloads.
 */
export function sampleSurfacePoints(model: Object3D, count: number, options: SurfacePointsOptions = {}): SurfacePoint[] {
  const { seed = 9137, normalize = true, normalizeSize = 1.9, maxAttempts = count * 12, acceptSample } = options;
  const samplers = collectSamplers(model);
  if (samplers.length === 0) throw new Error('Model contains no renderable mesh to sample');

  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const normalizationScale = normalize ? normalizeSize / Math.max(size.x, size.y, size.z, 0.0001) : 1;
  const random = seededRandom(seed);
  const samples: SurfacePoint[] = [];
  const localPosition = new Vector3();
  const localNormal = new Vector3();
  const localUv = new Vector2();

  for (let attempt = 0; attempt < maxAttempts && samples.length < count; attempt += 1) {
    const targetArea = random() * samplers[samplers.length - 1].cumulativeArea;
    const entry = samplers.find((candidate) => targetArea <= candidate.cumulativeArea) ?? samplers[samplers.length - 1];
    entry.sampler.sample(localPosition, localNormal, undefined, localUv);
    const position = entry.mesh.localToWorld(localPosition.clone());
    if (normalize) position.sub(center).multiplyScalar(normalizationScale);
    const normal = localNormal.clone().transformDirection(entry.mesh.matrixWorld).normalize();
    const uv = localUv.clone();
    if (acceptSample && !acceptSample({ position, normal, uv })) continue;
    samples.push({
      position,
      normal,
      uv,
      revealRank: 0,
      heightRank: 0,
      twinklePhase: random() * Math.PI * 2,
      twinkleSpeed: 0.0009 + random() * 0.00085,
    });
  }

  // Shuffled reveal ranks (Fisher–Yates with the seeded RNG).
  const ranks = samples.map((_, index) => index);
  for (let index = ranks.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [ranks[index], ranks[swap]] = [ranks[swap], ranks[index]];
  }
  const minY = bounds.min.y;
  const spanY = Math.max(bounds.max.y - bounds.min.y, 0.0001);
  samples.forEach((sample, index) => {
    sample.revealRank = ranks[index];
    // Height rank derives from the raw (un-normalized) sampled world position.
    const rawY = normalize ? sample.position.y / normalizationScale + center.y : sample.position.y;
    sample.heightRank = Math.max(0, Math.min(1, (rawY - minY) / spanY));
  });
  return samples;
}

/**
 * React hook: sample `count` surface points on a loaded model.
 * Returns `{ points, isLoading, error }` — never throws. Sampling runs in an
 * effect so large point counts do not block the render that shows the model.
 */
export function useSurfacePoints(
  model: Object3D | null,
  count: number,
  options: SurfacePointsOptions = {},
): SurfacePointsState {
  const [state, setState] = useState<SurfacePointsState>({ points: null, isLoading: !!model, error: null });
  const { seed, normalize, normalizeSize, maxAttempts, acceptSample } = options;

  useEffect(() => {
    if (!model) {
      setState({ points: null, isLoading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ points: null, isLoading: true, error: null });
    // Defer to the next frame so the loading UI paints before heavy sampling.
    const handle = window.setTimeout(() => {
      try {
        const points = sampleSurfacePoints(model, count, { seed, normalize, normalizeSize, maxAttempts, acceptSample });
        if (!cancelled) setState({ points, isLoading: false, error: null });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        const error = new Error(`Failed to sample surface points: ${message}`);
        console.error(error.message);
        if (!cancelled) setState({ points: null, isLoading: false, error });
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [model, count, seed, normalize, normalizeSize, maxAttempts, acceptSample]);

  return state;
}
