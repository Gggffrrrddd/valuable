import { useEffect, useRef } from 'react';
import type { PaintRect } from './ParticlePainting';
import { getGlowSprite } from './ParticlePainting';

/**
 * Extra particles for the empty letterbox around the fixed stage.
 *
 * They spawn only in that empty space, drift at the same gentle speed as the
 * normal ambient particles toward the nearest stage edge beside the easel,
 * and disappear on contact. They never enter the stage and never stamp the
 * reveal mask, so the painting is still revealed only by the decided
 * stage particles.
 */
const COLORS: [number, number, number][] = [
  [255, 200, 80], [255, 140, 60], [255, 100, 120], [200, 130, 255],
  [100, 200, 255], [130, 255, 200], [255, 220, 150], [255, 80, 180],
  [100, 255, 255], [255, 255, 180], [220, 180, 255], [255, 160, 100],
  [180, 255, 160], [255, 120, 200], [255, 200, 200],
];

interface Dot {
  x: number; y: number; tx: number; ty: number;
  speed: number; wobble: number; phase: number;
  r: number; cr: number; cg: number; cb: number; glow: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export default function BladeLetterboxParticles({
  stage,
  easel,
}: {
  stage: { left: number; top: number; scale: number };
  easel: PaintRect;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;

    let W = 0;
    let H = 0;
    let dots: Dot[] = [];
    let raf = 0;
    let last = 0;
    let spawnAcc = 0;

    const spawn = () => {
      const sx = stage.left;
      const sy = stage.top;
      const sw = 1366 * stage.scale;
      const sh = 768 * stage.scale;
      const right = sx + sw;
      const bottom = sy + sh;
      const pad = 3;

      type Band = { x0: number; y0: number; x1: number; y1: number; side: 'l' | 'r' | 't' | 'b' };
      const bands: Band[] = [];
      if (sx > pad) bands.push({ x0: 0, y0: 0, x1: sx, y1: H, side: 'l' });
      if (right < W - pad) bands.push({ x0: right, y0: 0, x1: W, y1: H, side: 'r' });
      if (sy > pad) bands.push({ x0: 0, y0: 0, x1: W, y1: sy, side: 't' });
      if (bottom < H - pad) bands.push({ x0: 0, y0: bottom, x1: W, y1: H, side: 'b' });
      if (!bands.length) return;

      let total = 0;
      for (const b of bands) total += Math.max(1, (b.x1 - b.x0) * (b.y1 - b.y0));
      let pick = Math.random() * total;
      let band = bands[0];
      for (const b of bands) {
        pick -= Math.max(1, (b.x1 - b.x0) * (b.y1 - b.y0));
        if (pick <= 0) { band = b; break; }
      }

      const x = rand(band.x0 + 2, Math.max(band.x0 + 3, band.x1 - 2));
      const y = rand(band.y0 + 2, Math.max(band.y0 + 3, band.y1 - 2));

      // Aim at the stage edge next to the easel, never inside the stage.
      const ex = sx + (easel.x + easel.w / 2) * stage.scale;
      const ey = sy + (easel.y + easel.h / 2) * stage.scale;
      const spreadX = Math.max(12, easel.w * stage.scale * 0.42);
      const spreadY = Math.max(10, easel.h * stage.scale * 0.42);
      let tx = ex;
      let ty = ey;
      if (band.side === 'l') {
        tx = Math.max(2, sx - rand(3, 9));
        ty = ey + rand(-spreadY, spreadY);
      } else if (band.side === 'r') {
        tx = Math.min(W - 2, right + rand(3, 9));
        ty = ey + rand(-spreadY, spreadY);
      } else if (band.side === 't') {
        tx = ex + rand(-spreadX, spreadX);
        ty = Math.max(2, sy - rand(3, 9));
      } else {
        tx = ex + rand(-spreadX, spreadX);
        ty = Math.min(H - 2, bottom + rand(3, 9));
      }

      const [cr, cg, cb] = COLORS[Math.floor(Math.random() * COLORS.length)];
      dots.push({
        x, y, tx, ty,
        speed: rand(0.35, 0.65),
        wobble: rand(0.15, 0.45),
        phase: rand(0, Math.PI * 2),
        r: rand(0.6, 1.6),
        cr, cg, cb,
        glow: rand(2.5, 5),
      });
    };

    const init = () => {
      W = host.clientWidth;
      H = host.clientHeight;
      if (W < 1 || H < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      const ctx = canvas.getContext('2d');
      if (!ctx || W < 1) { raf = requestAnimationFrame(draw); return; }
      const dt = Math.min(40, Math.max(1, now - (last || now)));
      last = now;
      const step = dt / 16.67;

      spawnAcc += dt * 0.009;
      while (spawnAcc >= 1 && dots.length < 120) {
        spawnAcc -= 1;
        spawn();
      }

      const sx = stage.left;
      const sy = stage.top;
      const sw = 1366 * stage.scale;
      const sh = 768 * stage.scale;

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      dots = dots.filter((d) => {
        const dx = d.tx - d.x;
        const dy = d.ty - d.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 7) return false;

        const wob = Math.sin(now * 0.0015 + d.phase) * d.wobble;
        const vx = (dx / dist) * d.speed + (-dy / dist) * wob;
        const vy = (dy / dist) * d.speed + (dx / dist) * wob;
        d.x += vx * step;
        d.y += vy * step;

        // Never leave the screen or enter the stage.
        if (d.x < 1 || d.x > W - 1 || d.y < 1 || d.y > H - 1) return false;
        if (d.x > sx + 1 && d.x < sx + sw - 1 && d.y > sy + 1 && d.y < sy + sh - 1) return false;

        const gr = d.r * d.glow;
        const sprite = getGlowSprite(d.cr, d.cg, d.cb);
        ctx.globalAlpha = 0.55;
        ctx.drawImage(sprite, d.x - gr, d.y - gr, gr * 2, gr * 2);

        ctx.fillStyle = `rgb(${Math.min(255, d.cr + 60)},${Math.min(255, d.cg + 60)},${Math.min(255, d.cb + 60)})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        return true;
      });
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(draw);
    };

    init();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(init);
    ro.observe(host);
    window.addEventListener('resize', init);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', init);
    };
  }, [stage.left, stage.top, stage.scale, easel.x, easel.y, easel.w, easel.h]);

  return <canvas ref={canvasRef} className="bl-letterbox-particles" aria-hidden="true" />;
}
