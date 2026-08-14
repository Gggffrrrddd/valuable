import { Box3, CanvasTexture, Vector3 } from 'three';
import type { Object3D } from 'three';

/** Small shared math/render helpers for model visuals. */

export function smoothstep(min: number, max: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return t * t * (3 - 2 * t);
}

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

/**
 * Center a loaded model on the origin and scale it so its largest dimension
 * becomes `targetSize`. Mutates the passed object (clone first if the source
 * is shared) and returns the largest raw dimension for further tuning.
 */
export function normalizeModel(model: Object3D, targetSize = 1.9): number {
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const largest = Math.max(size.x, size.y, size.z, 0.0001);
  model.position.sub(center);
  model.scale.setScalar(targetSize / largest);
  return largest;
}

/**
 * Build a soft radial-glow sprite texture on a canvas.
 * `rgb` is a "r,g,b" triplet string, e.g. "182,232,90".
 */
export function createGlowTexture(rgb: string, size = 256): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return new CanvasTexture(canvas);
  const half = size / 2;
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, `rgba(${rgb},1)`);
  gradient.addColorStop(.18, `rgba(${rgb},.62)`);
  gradient.addColorStop(.52, `rgba(${rgb},.16)`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}
