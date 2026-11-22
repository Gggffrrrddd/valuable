import { useEffect, useRef } from 'react';

/**
 * Full-screen ambient particle layer for the Particle Painting mobile stage.
 *
 * The painting reveal canvas lives inside the fixed 1366×768 stage, so its
 * particles stop at the stage edge. This layer sits outside the stage and
 * scatters particles across the whole device screen at any aspect ratio, so
 * the letterbox never reads as a hard boundary.
 */
const COLORS: [number, number, number][] = [
  [255, 200, 80], [255, 140, 60], [255, 100, 120], [200, 130, 255],
  [100, 200, 255], [130, 255, 200], [255, 220, 150], [255, 80, 180],
  [100, 255, 255], [255, 255, 180], [220, 180, 255], [255, 160, 100],
  [180, 255, 160], [255, 120, 200], [255, 200, 200],
];

interface Dot {
  x: number; y: number;
  vx: number; vy: number;
  r: number; a: number;
  phase: number;
  cr: number; cg: number; cb: number;
  glow: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export default function BladeParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;

    let dots: Dot[] = [];
    let W = 0;
    let H = 0;
    let raf = 0;

    const init = () => {
      W = host.clientWidth;
      H = host.clientHeight;
      if (W < 1 || H < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(420, Math.max(150, Math.round((W * H) / 3200)));
      dots = Array.from({ length: count }, () => {
        const [cr, cg, cb] = COLORS[Math.floor(Math.random() * COLORS.length)];
        return {
          x: rand(0, W),
          y: rand(0, H),
          vx: rand(-0.18, 0.18),
          vy: rand(-0.14, 0.08),
          r: rand(0.45, 1.35),
          a: rand(0.18, 0.6),
          phase: rand(0, Math.PI * 2),
          cr, cg, cb,
          glow: rand(2.2, 4.8),
        };
      });
    };

    const draw = (now: number) => {
      const ctx = canvas.getContext('2d');
      if (!ctx || W < 1) {
        raf = requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < -10) d.x = W + 10;
        if (d.x > W + 10) d.x = -10;
        if (d.y < -10) d.y = H + 10;
        if (d.y > H + 10) d.y = -10;

        const twinkle = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now * 0.0012 + d.phase));
        const alpha = d.a * twinkle;
        const gr = d.r * d.glow;
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, gr);
        g.addColorStop(0, `rgba(${d.cr},${d.cg},${d.cb},${alpha * 0.5})`);
        g.addColorStop(0.4, `rgba(${d.cr},${d.cg},${d.cb},${alpha * 0.15})`);
        g.addColorStop(1, `rgba(${d.cr},${d.cg},${d.cb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(d.x, d.y, gr, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${Math.min(255, d.cr + 60)},${Math.min(255, d.cg + 60)},${Math.min(255, d.cb + 60)})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

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
  }, []);

  return <canvas ref={canvasRef} className="bl-particles" aria-hidden="true" />;
}
