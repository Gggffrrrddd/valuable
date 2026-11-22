import { useEffect, useRef } from 'react';
import type { PaintRect } from './ParticlePainting';

/**
 * Extra particles for the letterbox only. When the screen ratio leaves empty
 * space around the fixed stage, these spawn in that empty space, drift toward
 * the easel canvas and vanish on contact. They never stamp the reveal mask, so
 * the painting is still revealed only by the decided stage particles.
 */
const COLORS: [number, number, number][] = [
  [255, 200, 80], [255, 140, 60], [255, 100, 120], [200, 130, 255],
  [100, 200, 255], [130, 255, 200], [255, 220, 150], [255, 80, 180],
  [100, 255, 255], [255, 255, 180], [220, 180, 255], [255, 160, 100],
  [180, 255, 160], [255, 120, 200], [255, 200, 200],
];

interface Dot {
  x: number; y: number; tx: number; ty: number;
  vx: number; vy: number;
  r: number; cr: number; cg: number; cb: number;
  life: number; age: number;
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
      const pad = 4;
      const bands: { x0: number; y0: number; x1: number; y1: number }[] = [];
      if (sx > pad) bands.push({ x0: 0, y0: 0, x1: sx, y1: H });
      if (sx + sw < W - pad) bands.push({ x0: sx + sw, y0: 0, x1: W, y1: H });
      if (sy > pad) bands.push({ x0: 0, y0: 0, x1: W, y1: sy });
      if (sy + sh < H - pad) bands.push({ x0: 0, y0: sy + sh, x1: W, y1: H });
      if (!bands.length) return;

      let total = 0;
      for (const b of bands) total += Math.max(1, (b.x1 - b.x0) * (b.y1 - b.y0));
      let pick = Math.random() * total;
      let band = bands[0];
      for (const b of bands) {
        pick -= Math.max(1, (b.x1 - b.x0) * (b.y1 - b.y0));
        if (pick <= 0) { band = b; break; }
      }

      const x = rand(band.x0, Math.max(band.x0 + 1, band.x1));
      const y = rand(band.y0, Math.max(band.y0 + 1, band.y1));
      // Aim inside the easel canvas, not a single point.
      const tx = sx + (easel.x + rand(0.12, 0.88) * easel.w) * stage.scale;
      const ty = sy + (easel.y + rand(0.18, 0.82) * easel.h) * stage.scale;
      const [cr, cg, cb] = COLORS[Math.floor(Math.random() * COLORS.length)];
      dots.push({
        x, y, tx, ty,
        vx: rand(-0.15, 0.15),
        vy: rand(-0.12, 0.12),
        r: rand(0.5, 1.4),
        cr, cg, cb,
        life: rand(6500, 11000),
        age: 0,
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

      spawnAcc += dt * 0.016;
      while (spawnAcc >= 1 && dots.length < 170) {
        spawnAcc -= 1;
        spawn();
      }

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      dots = dots.filter((d) => {
        d.age += dt;
        const dx = d.tx - d.x;
        const dy = d.ty - d.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 10 || d.age > d.life) return false;

        const k = 0.00045 * dt;
        d.vx = (d.vx + dx * k) * 0.988;
        d.vy = (d.vy + dy * k) * 0.988;
        const speed = Math.hypot(d.vx, d.vy);
        if (speed > 3.4) {
          d.vx = (d.vx / speed) * 3.4;
          d.vy = (d.vy / speed) * 3.4;
        }
        d.x += d.vx * dt;
        d.y += d.vy * dt;

        const fadeIn = Math.min(1, d.age / 450);
        const a = 0.55 * fadeIn;
        const gr = d.r * 4.2;
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, gr);
        g.addColorStop(0, `rgba(${d.cr},${d.cg},${d.cb},${a * 0.5})`);
        g.addColorStop(0.4, `rgba(${d.cr},${d.cg},${d.cb},${a * 0.15})`);
        g.addColorStop(1, `rgba(${d.cr},${d.cg},${d.cb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(d.x, d.y, gr, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = a;
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
