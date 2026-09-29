/**
 * A single premium moon, pre-rendered once to an offscreen canvas (soft
 * atmospheric glow, shaded disc, faint maria and a bright rim). Drawn as a
 * plain `drawImage` each frame so it costs almost nothing at runtime.
 */

/** Deterministic pseudo-random in [0, 1). */
function rand(seed: number) {
  const x = Math.sin(seed * 91.7 + 47.3) * 43758.5453;
  return x - Math.floor(x);
}

export interface MoonSprite {
  canvas: HTMLCanvasElement;
  /** Where the moon's centre sits inside the sprite canvas. */
  cx: number;
  cy: number;
  /** Radius of the solid disc, in px. */
  radius: number;
}

export function generateMoon(radius: number): MoonSprite {
  const r = Math.max(6, radius);
  const pad = r * 2.6; // room for the glow halo
  const size = Math.ceil((r + pad) * 2);
  const cx = size / 2;
  const cy = size / 2;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { canvas, cx, cy, radius: r };

  // 1. Wide, soft atmospheric halo.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r + pad);
  halo.addColorStop(0, 'rgba(214,228,255,0.30)');
  halo.addColorStop(0.35, 'rgba(190,210,255,0.11)');
  halo.addColorStop(0.7, 'rgba(170,195,255,0.035)');
  halo.addColorStop(1, 'rgba(160,190,255,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, r + pad, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. The disc, lit from the upper-left.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  const disc = ctx.createRadialGradient(
    cx - r * 0.35, cy - r * 0.4, r * 0.1,
    cx, cy, r * 1.15,
  );
  disc.addColorStop(0, '#ffffff');
  disc.addColorStop(0.45, '#eef3ff');
  disc.addColorStop(0.8, '#cdd8ef');
  disc.addColorStop(1, '#a9b6d4');
  ctx.fillStyle = disc;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // 3. Faint maria (the darker patches visible on a real moon).
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 9; i++) {
    const a = rand(i * 3.1) * Math.PI * 2;
    const dist = rand(i * 7.7) * r * 0.72;
    const mx = cx + Math.cos(a) * dist;
    const my = cy + Math.sin(a) * dist;
    const mr = r * (0.1 + rand(i * 11.3) * 0.24);
    const patch = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
    patch.addColorStop(0, 'rgba(150,164,196,0.5)');
    patch.addColorStop(1, 'rgba(150,164,196,0)');
    ctx.fillStyle = patch;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  // 4. A few small craters.
  for (let i = 0; i < 14; i++) {
    const a = rand(i * 5.9 + 2.1) * Math.PI * 2;
    const dist = rand(i * 4.3 + 1.7) * r * 0.85;
    const crx = cx + Math.cos(a) * dist;
    const cry = cy + Math.sin(a) * dist;
    const crr = r * (0.03 + rand(i * 9.1) * 0.07);
    ctx.strokeStyle = 'rgba(150,166,200,0.45)';
    ctx.lineWidth = Math.max(0.5, crr * 0.35);
    ctx.beginPath();
    ctx.arc(crx, cry, crr, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 5. Rim light along the lit edge.
  const rim = ctx.createRadialGradient(
    cx - r * 0.4, cy - r * 0.45, r * 0.55,
    cx, cy, r,
  );
  rim.addColorStop(0, 'rgba(255,255,255,0)');
  rim.addColorStop(0.82, 'rgba(255,255,255,0.22)');
  rim.addColorStop(1, 'rgba(255,255,255,0.5)');
  ctx.fillStyle = rim;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // 6. Subtle terminator shading on the lower-right.
  const shade = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(0.62, 'rgba(20,28,52,0.06)');
  shade.addColorStop(1, 'rgba(20,28,52,0.28)');
  ctx.fillStyle = shade;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();

  return { canvas, cx, cy, radius: r };
}
