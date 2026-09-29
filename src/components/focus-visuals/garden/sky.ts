/**
 * Premium procedural night sky, written once to an offscreen canvas and shown
 * as a static overlay above the garden's dark upper area. It is transparent
 * and fades out towards its lower edge so it blends into the artwork with no
 * visible seam. No moon, no constellation — just depth, nebula haze and a
 * rich, multi-coloured star field.
 */
import { SKY } from './config';

/** Deterministic pseudo-random generator (so the sky is stable per size). */
function lcg(seed: number) {
  return function () {
    seed = (Math.imul(1500450271, seed) + 1) | 0;
    return (seed >>> 0) / 4294967296;
  };
}

/** Cheap 2D value noise for wispy nebula shapes. */
function createNoise2D(rand: () => number) {
  const table = new Float32Array(256);
  for (let i = 0; i < 256; i++) table[i] = rand();
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const r00 = table[(xi + yi * 57) & 255];
    const r10 = table[(xi + 1 + yi * 57) & 255];
    const r01 = table[(xi + (yi + 1) * 57) & 255];
    const r11 = table[(xi + 1 + (yi + 1) * 57) & 255];
    const sx = xf * xf * (3 - 2 * xf);
    const sy = yf * yf * (3 - 2 * yf);
    const nx0 = r00 * (1 - sx) + r10 * sx;
    const nx1 = r01 * (1 - sx) + r11 * sx;
    return nx0 * (1 - sy) + nx1 * sy;
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

  const rand = lcg(20260929);
  const noise = createNoise2D(rand);
  const maxDim = Math.max(width, height);
  const fadeStartY = height * SKY.fadeFrom;

  // 1. Deep-space gradient — cooler and darker than the artwork's black so it
  //    reads as depth, fading to fully transparent at the seam.
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(3, 5, 14, 0.95)');
  gradient.addColorStop(0.35, 'rgba(4, 7, 18, 0.82)');
  gradient.addColorStop(0.62, 'rgba(3, 5, 13, 0.5)');
  gradient.addColorStop(SKY.fadeFrom, 'rgba(2, 4, 10, 0)');
  gradient.addColorStop(1, 'rgba(2, 4, 10, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 2. Nebula haze — soft, wispy clouds in cool and warm tones.
  ctx.globalCompositeOperation = 'lighter';
  const cool = ['90,120,210', '120,90,200', '70,140,200'];
  const warm = ['200,120,150', '190,140,110'];
  for (let i = 0; i < SKY.nebulaBlobs; i++) {
    const t = rand();
    const baseX = width * (0.15 + t * 0.7);
    const baseY = height * (0.05 + t * 0.6);
    const spread = maxDim * 0.12;
    const x = baseX + (noise(t * 8, 0) - 0.5) * spread;
    const y = baseY + (noise(0, t * 8) - 0.5) * spread;
    const radius = maxDim * (0.06 + rand() * 0.1);
    const palette = rand() > 0.7 ? warm : cool;
    const rgb = palette[Math.floor(rand() * palette.length)];
    const alpha = SKY.nebulaAlpha * (0.5 + rand() * 0.5);

    const blob = ctx.createRadialGradient(x, y, 0, x, y, radius);
    blob.addColorStop(0, `rgba(${rgb},${alpha})`);
    blob.addColorStop(0.55, `rgba(${rgb},${alpha * 0.35})`);
    blob.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = blob;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Stars fade out before the sky's lower seam so nothing pops at the join. */
  const starFade = (y: number) =>
    1 - Math.max(0, Math.min(1, (y - fadeStartY * 0.55) / Math.max(1, fadeStartY * 0.55)));

  // 3. Fine background dust — a dense field of faint stars.
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < SKY.starsFull; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const fade = starFade(y);
    if (fade <= 0) continue;
    const size = 0.35 + rand() * 0.9;
    const alpha = (0.12 + rand() * 0.5) * fade;
    // A touch of colour temperature variation.
    const warmish = rand() > 0.72;
    ctx.fillStyle = warmish ? `rgba(255,236,214,${alpha})` : `rgba(226,236,255,${alpha})`;
    ctx.fillRect(x, y, size, size);
  }

  // 4. Bright stars with soft halos and subtle diffraction spikes.
  for (let i = 0; i < SKY.brightStars; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const fade = starFade(y);
    if (fade <= 0) continue;
    const size = 1.1 + rand() * 1.7;
    const alpha = (0.6 + rand() * 0.4) * fade;
    const blue = rand() > 0.72;
    const rgb = blue ? '200,230,255' : '255,248,236';

    const halo = ctx.createRadialGradient(x, y, 0, x, y, size * 4);
    halo.addColorStop(0, `rgba(${rgb},${alpha})`);
    halo.addColorStop(0.18, `rgba(${rgb},${alpha * 0.7})`);
    halo.addColorStop(0.5, `rgba(${rgb},${alpha * 0.14})`);
    halo.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, size * 4, 0, Math.PI * 2);
    ctx.fill();

    // Core.
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.42, 0, Math.PI * 2);
    ctx.fill();

    // Cross spikes on the brightest few.
    if (alpha > 0.85) {
      const len = size * 4.5;
      const spike = ctx.createLinearGradient(x - len, y, x + len, y);
      spike.addColorStop(0, 'rgba(255,255,255,0)');
      spike.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.5})`);
      spike.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = spike;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x - len, y);
      ctx.lineTo(x + len, y);
      ctx.moveTo(x, y - len);
      ctx.lineTo(x, y + len);
      ctx.stroke();
    }
  }

  // 5. A faint diagonal dust band gives the field structure without reading
  //    as a specific figure.
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) {
    const t = rand();
    const x = width * (0.05 + t * 0.9);
    const y = height * (0.02 + t * 0.5) + (rand() - 0.5) * height * 0.08;
    const fade = starFade(y);
    if (fade <= 0) continue;
    const radius = maxDim * (0.02 + rand() * 0.05);
    const band = ctx.createRadialGradient(x, y, 0, x, y, radius);
    band.addColorStop(0, `rgba(150,170,230,${0.025 * fade})`);
    band.addColorStop(1, 'rgba(150,170,230,0)');
    ctx.fillStyle = band;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
  return { canvas, width, height };
}
