/**
 * Stars-only procedural sky. Drawn once to an offscreen canvas and shown as a
 * static overlay above the garden's dark upper area. The canvas is
 * transparent and fades out towards its lower edge so it blends into the
 * artwork with no visible seam. No milky way, no moon — just depth + stars.
 */
import { SKY } from './config';

/** Deterministic pseudo-random generator. */
function lcg(seed: number) {
  return function () {
    seed = (Math.imul(1500450271, seed) + 1) | 0;
    return (seed >>> 0) / 4294967296;
  };
}

export interface SkyLayer {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export function generateSky(width: number, height: number): SkyLayer {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context for sky');

  const rand = lcg(12345);
  const fadeStartY = height * SKY.fadeFrom;

  // Depth gradient: slightly cooler/darker than the artwork's black, fading
  // to fully transparent so the black artwork shows through at the seam.
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(4, 7, 16, 0.92)');
  gradient.addColorStop(0.4, 'rgba(3, 5, 12, 0.7)');
  gradient.addColorStop(SKY.fadeFrom, 'rgba(2, 4, 10, 0)');
  gradient.addColorStop(1, 'rgba(2, 4, 10, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  /** Stars fade out before the sky's lower seam. */
  const starFade = (y: number) => 1 - Math.max(0, Math.min(1, (y - fadeStartY * 0.6) / Math.max(1, fadeStartY * 0.5)));

  ctx.globalCompositeOperation = 'lighter';

  // Tiny background stars.
  for (let i = 0; i < SKY.starsFull; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const fade = starFade(y);
    if (fade <= 0) continue;
    const size = 0.4 + rand() * 0.9;
    const alpha = (0.18 + rand() * 0.55) * fade;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(x, y, size, size);
  }

  // Bright stars with soft halos.
  for (let i = 0; i < SKY.brightStars; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const fade = starFade(y);
    if (fade <= 0) continue;
    const size = 1.4 + rand() * 1.6;
    const alpha = (0.55 + rand() * 0.4) * fade;
    const isBlue = rand() > 0.7;
    const color = isBlue ? '200,230,255' : '255,250,240';

    const halo = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
    halo.addColorStop(0, `rgba(${color},${alpha})`);
    halo.addColorStop(0.2, `rgba(${color},${alpha * 0.8})`);
    halo.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, size * 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
  return { canvas, width, height };
}
