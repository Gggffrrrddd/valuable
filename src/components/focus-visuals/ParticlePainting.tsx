import { useEffect, useRef, useCallback } from 'react';

// ─── Config ──────────────────────────────────────────────────────────────────

const CANVAS_ZONE = {
  cx: 0.5 - 0.2815,
  cy: 0.5 - 0.10,
  hw: 0.11,
  hh: 0.14,
};

const COUNT_DESKTOP = 2400;
const COUNT_MOBILE  = 800;
const LAND_RADIUS   = 26;
const DONE_AT       = 0.97;

// Vibrant multi-colour palette — each entry is [r, g, b]
const PALETTE: [number, number, number][] = [
  [255, 200,  80],   // warm gold
  [255, 140,  60],   // amber
  [255, 100, 120],   // rose
  [200, 130, 255],   // lavender
  [100, 200, 255],   // sky blue
  [130, 255, 200],   // mint
  [255, 220, 150],   // peach
  [255,  80, 180],   // hot pink
  [100, 255, 255],   // cyan
  [255, 255, 180],   // cream
  [220, 180, 255],   // lilac
  [255, 160, 100],   // tangerine
  [180, 255, 160],   // spring green
  [255, 120, 200],   // magenta-pink
  [255, 200, 200],   // blush
];

// ─── Particle type ───────────────────────────────────────────────────────────

interface Dot {
  x: number; y: number;
  vx: number; vy: number;
  r: number;               // radius (very small)
  a: number;               // current alpha
  ba: number;              // base alpha
  cr: number; cg: number; cb: number; // colour
  glow: number;            // outer glow radius multiplier
  phase: 0 | 1 | 2 | 3;   // 0 ambient, 1 drift, 2 land, 3 done
  tx: number; ty: number;  // target
  age: number;
  lt: number;              // land timer
  wobbleX: number;         // per-particle wobble seed
  wobbleY: number;
  speed: number;           // per-particle drift speed multiplier
  pulse: number;           // pulse phase offset
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const rng = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function spawn(W: number, H: number): Dot {
  const [cr, cg, cb] = pick(PALETTE);
  return {
    x: rng(0, W), y: rng(0, H),
    vx: rng(-0.25, 0.25), vy: rng(-0.18, 0.1),
    r: rng(0.6, 1.6),
    a: 0, ba: rng(0.25, 0.7),
    cr, cg, cb,
    glow: rng(2.5, 5),
    phase: 0,
    tx: 0, ty: 0,
    age: Math.floor(rng(0, 500)),
    lt: 0,
    wobbleX: rng(0.006, 0.018),
    wobbleY: rng(0.005, 0.014),
    speed: rng(0.6, 1.4),
    pulse: rng(0, Math.PI * 2),
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props { progress: number; running: boolean }

export default function ParticlePainting({ progress, running }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const maskRef     = useRef<HTMLCanvasElement>(null);
  const paintImgRef = useRef<HTMLImageElement>(null);

  const s = useRef({
    dots: [] as Dot[],
    W: 0, H: 0, dpr: 1,
    raf: 0,
    progress: 0,
    running: false,
    dirty: false,
    done: false,
    landed: 0,
  });

  // ── init / resize ──────────────────────────────────────────────────────────

  const init = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width  = rect.width  * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const m = maskRef.current;
    if (m) { m.width = rect.width; m.height = rect.height; }

    const st = s.current;
    st.W = rect.width; st.H = rect.height; st.dpr = dpr;
    const n = rect.width < 768 ? COUNT_MOBILE : COUNT_DESKTOP;
    st.dots = Array.from({ length: n }, () => spawn(rect.width, rect.height));
    st.landed = 0; st.done = false; st.dirty = true;

    // start mask fully transparent → painting fully hidden
    if (m) {
      const mc = m.getContext('2d');
      if (mc) mc.clearRect(0, 0, rect.width, rect.height);
    }
    // apply initial empty mask immediately so painting is hidden from frame 0
    const img = paintImgRef.current;
    if (img && m) {
      const url = m.toDataURL();
      img.style.maskImage = `url(${url})`;
      img.style.webkitMaskImage = `url(${url})`;
      img.style.opacity = '1'; // mask controls visibility now
    }
  }, []);

  // ── draw loop ──────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const c = canvasRef.current;
    const m = maskRef.current;
    const img = paintImgRef.current;
    if (!c || !m) { s.current.raf = requestAnimationFrame(draw); return; }
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const st = s.current;
    const { W, H, dots, progress: prog } = st;
    if (W < 1) { st.raf = requestAnimationFrame(draw); return; }

    // zone
    const zx  = W * CANVAS_ZONE.cx;
    const zy  = H * CANVAS_ZONE.cy;
    const zhw = W * CANVAS_ZONE.hw;
    const zhh = H * CANVAS_ZONE.hh;

    // target landed count
    const ease = prog < 0.5
      ? 2 * prog * prog                            // ease-in first half
      : 1 - Math.pow(-2 * prog + 2, 2) / 2;        // ease-out second half
    const target = Math.floor(ease * dots.length * 0.75);
    const need   = Math.max(0, target - st.landed);

    // clear
    ctx.clearRect(0, 0, W, H);

    // batch: first draw all glows (additive), then dots
    ctx.globalCompositeOperation = 'lighter';

    for (const d of dots) {
      d.age++;
      const sin1 = Math.sin(d.age * d.wobbleX + d.pulse);
      const cos1 = Math.cos(d.age * d.wobbleY + d.pulse);

      if (d.phase === 0) {
        // ambient — gentle float with slightly more movement
        d.x += (d.vx + sin1 * 0.15) * d.speed;
        d.y += (d.vy + cos1 * 0.10) * d.speed;

        // pulse alpha
        d.a = d.ba * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(d.age * 0.02 + d.pulse)));

        // wrap
        if (d.x < -10) d.x = W + 10;
        if (d.x > W + 10) d.x = -10;
        if (d.y < -10) d.y = H + 10;
        if (d.y > H + 10) d.y = -10;

        // recruit
        if (need > 0 && st.running && Math.random() < 0.002 * Math.min(need, 20)) {
          d.phase = 1;
          d.tx = rng(zx - zhw, zx + zhw);
          d.ty = rng(zy - zhh, zy + zhh);
        }
      } else if (d.phase === 1) {
        // drift toward canvas — graceful arc
        const dx = d.tx - d.x;
        const dy = d.ty - d.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const spd = Math.max(0.5, dist * 0.025);
        d.x += (dx / (dist || 1)) * spd + sin1 * 0.3;
        d.y += (dy / (dist || 1)) * spd + cos1 * 0.2;
        d.a = Math.min(0.95, d.a + 0.015);

        if (dist < 3) {
          d.phase = 2;
          d.lt = 50;
          st.landed++;
          st.dirty = true;
          // stamp reveal mask
          const mc = m.getContext('2d');
          if (mc) {
            const r = LAND_RADIUS * rng(0.4, 1.3);
            const g = mc.createRadialGradient(d.tx, d.ty, 0, d.tx, d.ty, r);
            g.addColorStop(0, 'rgba(255,255,255,0.3)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            mc.fillStyle = g;
            mc.beginPath();
            mc.arc(d.tx, d.ty, r, 0, Math.PI * 2);
            mc.fill();
          }
        }
      } else if (d.phase === 2) {
        d.a *= 0.94;
        d.lt--;
        if (d.lt <= 0) { d.phase = 3; d.a = 0; }
      }

      // draw (skip phase 3 = done)
      if (d.phase < 3 && d.a > 0.008) {
        // outer glow
        const gr = d.r * d.glow;
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, gr);
        g.addColorStop(0, `rgba(${d.cr},${d.cg},${d.cb},${d.a * 0.5})`);
        g.addColorStop(0.4, `rgba(${d.cr},${d.cg},${d.cb},${d.a * 0.15})`);
        g.addColorStop(1, `rgba(${d.cr},${d.cg},${d.cb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(d.x, d.y, gr, 0, Math.PI * 2);
        ctx.fill();

        // bright core
        ctx.globalAlpha = d.a;
        ctx.fillStyle = `rgb(${Math.min(255, d.cr + 60)},${Math.min(255, d.cg + 60)},${Math.min(255, d.cb + 60)})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    ctx.globalCompositeOperation = 'source-over';

    // completion burst — fill the entire canvas zone to fully reveal painting
    if (prog >= DONE_AT && !st.done) {
      st.done = true;
      const mc = m.getContext('2d');
      if (mc) {
        // multiple overlapping washes for full opaque coverage
        for (let i = 0; i < 5; i++) {
          const R = Math.max(zhw, zhh) * (2.0 + i * 0.5);
          const g = mc.createRadialGradient(zx, zy, 0, zx, zy, R);
          g.addColorStop(0, 'rgba(255,255,255,1)');
          g.addColorStop(0.7, 'rgba(255,255,255,0.8)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          mc.fillStyle = g;
          mc.beginPath();
          mc.arc(zx, zy, R, 0, Math.PI * 2);
          mc.fill();
        }
        st.dirty = true;
      }
    }

    // apply mask
    if (st.dirty && img) {
      const url = m.toDataURL();
      img.style.maskImage = `url(${url})`;
      img.style.webkitMaskImage = `url(${url})`;
      st.dirty = false;
    }

    st.raf = requestAnimationFrame(draw);
  }, []);

  // ── sync props ─────────────────────────────────────────────────────────────

  useEffect(() => {
    s.current.progress = progress;
    s.current.running  = running;
  }, [progress, running]);

  // ── mount ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    init();
    s.current.raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(init);
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => { cancelAnimationFrame(s.current.raf); ro.disconnect(); };
  }, [init, draw]);

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <canvas ref={maskRef} className="pointer-events-none absolute hidden" aria-hidden="true" />

      <img
        ref={paintImgRef}
        src="/visuals/blade/easel-tune.jpg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{
          transform: 'translate(-28.15%, -10%) scale(0.21)',
          opacity: 0,
          maskSize: '100% 100%',
          WebkitMaskSize: '100% 100%',
        }}
        draggable={false}
      />

      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      />
    </>
  );
}
