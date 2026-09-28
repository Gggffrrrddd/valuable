import { SKY } from './config';

// Create deterministic pseudo-random generator
function lcg(seed: number) {
  return function() {
    seed = Math.imul(1500450271, seed) + 1 | 0;
    return (seed >>> 0) / 4294967296;
  };
}

// Simple value noise 2D
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
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

export function generateSky(width: number, height: number): SkyLayer {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('No 2d context for sky');

  const rand = lcg(12345);
  const noise2D = createNoise2D(rand);
  
  // Base gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#02040a');
  gradient.addColorStop(0.3, '#050914');
  gradient.addColorStop(0.8, '#0a1024');
  gradient.addColorStop(1, '#111a30');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Milky Way band
  ctx.globalCompositeOperation = 'lighter';
  const maxDim = Math.max(width, height);
  
  for (let i = 0; i < 400; i++) {
    const t = rand();
    // Diagonal path roughly top-left to bottom-right
    const basePathX = width * (0.2 + t * 0.6);
    const basePathY = height * (0.1 + t * 0.8);
    
    // Spread based on value noise
    const spread = maxDim * 0.15;
    const nx = noise2D(t * 10, 0);
    const ny = noise2D(0, t * 10);
    
    const x = basePathX + nx * spread;
    const y = basePathY + ny * spread;
    
    const radius = maxDim * (0.02 + rand() * 0.08);
    const radGrad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    
    // Mix of cool blue, violet, and pinkish core
    const isCore = rand() > 0.6;
    const color = isCore 
      ? `rgba(180, 100, 150, ${0.03 + rand() * 0.03})` // warm pinkish
      : `rgba(80, 120, 200, ${0.02 + rand() * 0.03})`; // cool blue
      
    radGrad.addColorStop(0, color);
    radGrad.addColorStop(1, 'rgba(0,0,0,0)');
    
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dark dust lanes
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 50; i++) {
    const t = rand();
    const x = width * (0.3 + t * 0.5) + (rand() - 0.5) * width * 0.1;
    const y = height * (0.2 + t * 0.7) + (rand() - 0.5) * height * 0.1;
    const radius = maxDim * (0.04 + rand() * 0.06);
    
    const radGrad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    radGrad.addColorStop(0, `rgba(0,0,0,${0.2 + rand() * 0.3})`);
    radGrad.addColorStop(1, 'rgba(0,0,0,0)');
    
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Stars
  ctx.globalCompositeOperation = 'lighter';
  
  // Tiny background stars
  for (let i = 0; i < SKY.starsFull; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const size = 0.4 + rand() * 0.8;
    const alpha = 0.2 + rand() * 0.6;
    
    // Bias towards milky way
    const distToCenter = Math.abs((x / width) - (y / height));
    if (distToCenter > 0.4 && rand() > 0.3) continue;
    
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(x, y, size, size);
  }

  // Bright stars
  for (let i = 0; i < SKY.brightStars; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const size = 1.5 + rand() * 1.5;
    const alpha = 0.6 + rand() * 0.4;
    
    const radGrad = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
    const isBlue = rand() > 0.7;
    const color = isBlue ? '200,230,255' : '255,250,240';
    
    radGrad.addColorStop(0, `rgba(${color},${alpha})`);
    radGrad.addColorStop(0.2, `rgba(${color},${alpha * 0.8})`);
    radGrad.addColorStop(1, `rgba(${color},0)`);
    
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(x, y, size * 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Moon
  ctx.globalCompositeOperation = 'source-over';
  const moonX = width * SKY.moon.x;
  const moonY = height * SKY.moon.y;
  const moonR = Math.min(width, height) * SKY.moon.r;
  
  // Moon glow
  const moonGlow = ctx.createRadialGradient(moonX, moonY, moonR * 0.5, moonX, moonY, moonR * 4);
  moonGlow.addColorStop(0, 'rgba(230, 240, 255, 0.4)');
  moonGlow.addColorStop(0.5, 'rgba(230, 240, 255, 0.1)');
  moonGlow.addColorStop(1, 'rgba(230, 240, 255, 0)');
  ctx.fillStyle = moonGlow;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR * 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Moon crescent
  ctx.save();
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.clip();
  
  ctx.fillStyle = '#f0f5ff';
  ctx.fillRect(moonX - moonR, moonY - moonR, moonR * 2, moonR * 2);
  
  // Cutout
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(moonX - moonR * 0.3, moonY - moonR * 0.2, moonR * 0.95, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Draw blending seam at bottom edge (matching garden image top edge)
  // We'll leave this part to the compositor or do a gradient fade at the bottom
  ctx.globalCompositeOperation = 'destination-out';
  const seamGradient = ctx.createLinearGradient(0, height - maxDim * 0.1, 0, height);
  seamGradient.addColorStop(0, 'rgba(0,0,0,0)');
  seamGradient.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = seamGradient;
  ctx.fillRect(0, height - maxDim * 0.1, width, maxDim * 0.1);

  ctx.globalCompositeOperation = 'source-over';

  return { canvas, ctx, width, height };
}
