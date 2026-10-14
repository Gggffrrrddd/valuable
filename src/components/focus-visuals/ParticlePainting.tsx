import { useEffect, useRef, useCallback } from 'react';

// ─── constants ────────────────────────────────────────────────────────────────

// Canvas zone: the painting sits at translate(-28.15%, -10%) scale(0.21)
// relative to the container. We map this to a rect on the screen canvas so
// landing particles reveal that exact region.
const CANVAS_ZONE = {
  // normalised centre (0-1) of the canvas image within the container
  cx: 0.5 - 0.2815,   // ≈ 0.2185
  cy: 0.5 - 0.10,     // ≈ 0.40
  // scale(0.21) means the image occupies 21 % of container width/height
  // but object-cover means it fills its box — we just need a reasonable
  // landing rectangle. Tune these if needed.
  hw: 0.11,  // half-width  (fraction of container)
  hh: 0.14,  // half-height (fraction of container)
};

const PARTICLE_COUNT_DESKTOP = 1800;
const PARTICLE_COUNT_MOBILE  = 600;
const LAND_RADIUS_BASE       = 28; // px, soft brush stroke radius on mask
const COMPLETION_THRESHOLD   = 0.98;

// Gold/warm-white palette
const COLORS = [
  'rgba(246,227,186,',  // #f6e3ba
  'rgba(255,220,140,',
  'rgba(255,240,200,',
  'rgba(230,200,150,',
  'rgba(255,255,230,',
];

// ─── types ────────────────────────────────────────────────────────────────────

interface Particle {
  x: number; y: number;       // current position (px)
  vx: number; vy: number;     // velocity
  size: number;               // radius
  alpha: number;              // current opacity
  baseAlpha: number;          // idle opacity
  color: string;              // rgba prefix
  phase: 'ambient' | 'drifting' | 'landing' | 'landed';
  tx: number; ty: number;     // target (canvas zone) when drifting
  age: number;                // frames alive
  landTimer: number;          // countdown after landing
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function makeParticle(W: number, H: number): Particle {
  return {
    x: rand(0, W), y: rand(0, H),
    vx: rand(-0.3, 0.3), vy: rand(-0.25, 0.05),
    size: rand(1.2, 3.2),
    alpha: 0,
    baseAlpha: rand(0.18, 0.55),
    color: pick(COLORS),
    phase: 'ambient',
    tx: 0, ty: 0,
    age: Math.floor(rand(0, 200)),
    landTimer: 0,
  };
}

// ─── component ───────────────────────────────────────────────────────────────

interface Props {
  progress: number;   // 0-1
  running: boolean;
}

export default function ParticlePainting({ progress, running }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const maskRef    = useRef<HTMLCanvasElement>(null);  // offscreen reveal mask
  const paintImgRef = useRef<HTMLImageElement>(null);
  const stateRef   = useRef({
    particles: [] as Particle[],
    W: 0, H: 0,
    raf: 0,
    progress: 0,
    running: false,
    maskDirty: false,
    completionFired: false,
    landedCount: 0,
  });

  // initialise / resize
  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = width  * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    // offscreen mask canvas — same logical size
    const mask = maskRef.current;
    if (mask) {
      mask.width  = width;
      mask.height = height;
    }

    const isMobile = width < 768;
    const count = isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;
    const s = stateRef.current;
    s.W = width; s.H = height;
    s.particles = Array.from({ length: count }, () => makeParticle(width, height));
  }, []);

  // draw loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const mask   = maskRef.current;
    const img    = paintImgRef.current;
    if (!canvas || !mask) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const s = stateRef.current;
    const { W, H, particles, progress: prog } = s;
    if (W === 0) { s.raf = requestAnimationFrame(draw); return; }

    // canvas zone in px
    const zoneX = W * CANVAS_ZONE.cx;
    const zoneY = H * CANVAS_ZONE.cy;
    const zoneHW = W * CANVAS_ZONE.hw;
    const zoneHH = H * CANVAS_ZONE.hh;

    // how many particles should have landed by now (eased)
    const eased = Math.pow(prog, 0.7); // slightly faster towards end
    const targetLanded = Math.floor(eased * particles.length * 0.72);
    const needMore = Math.max(0, targetLanded - s.landedCount);

    // clear main canvas
    ctx.clearRect(0, 0, W, H);

    // update + draw particles
    for (const p of particles) {
      p.age++;

      if (p.phase === 'ambient') {
        // slow drift
        p.x += p.vx + Math.sin(p.age * 0.012) * 0.18;
        p.y += p.vy + Math.cos(p.age * 0.009) * 0.12;
        p.alpha = p.baseAlpha * (0.6 + 0.4 * Math.sin(p.age * 0.04));
        // wrap
        if (p.x < -5) p.x = W + 5;
        if (p.x > W + 5) p.x = -5;
        if (p.y < -5) p.y = H + 5;
        if (p.y > H + 5) p.y = -5;

        // recruit to drift if needMore
        if (needMore > 0 && s.running && Math.random() < 0.003 * needMore) {
          p.phase = 'drifting';
          p.tx = rand(zoneX - zoneHW, zoneX + zoneHW);
          p.ty = rand(zoneY - zoneHH, zoneY + zoneHH);
        }
      } else if (p.phase === 'drifting') {
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = Math.max(0.8, dist * 0.04);
        p.x += (dx / dist) * speed;
        p.y += (dy / dist) * speed;
        p.alpha = Math.min(0.9, p.alpha + 0.04);

        if (dist < 2) {
          p.phase = 'landing';
          p.landTimer = 40;
          s.landedCount++;
          s.maskDirty = true;

          // paint a soft glow on the reveal mask
          const mc = mask.getContext('2d');
          if (mc) {
            const r = LAND_RADIUS_BASE * rand(0.5, 1.4);
            const grd = mc.createRadialGradient(p.tx, p.ty, 0, p.tx, p.ty, r);
            grd.addColorStop(0, 'rgba(255,255,255,0.35)');
            grd.addColorStop(1, 'rgba(255,255,255,0)');
            mc.fillStyle = grd;
            mc.beginPath();
            mc.arc(p.tx, p.ty, r, 0, Math.PI * 2);
            mc.fill();
          }
        }
      } else if (p.phase === 'landing') {
        p.alpha *= 0.93;
        p.landTimer--;
        if (p.landTimer <= 0) {
          p.phase = 'landed';
          p.alpha = 0;
        }
      }
      // 'landed' particles are invisible, skip draw

      if (p.phase !== 'landed' && p.alpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
        grd.addColorStop(0, p.color + '1)');
        grd.addColorStop(1, p.color + '0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // completion burst
    if (prog >= COMPLETION_THRESHOLD && !s.completionFired) {
      s.completionFired = true;
      const mc = mask.getContext('2d');
      if (mc) {
        // flood the mask with a large soft wash to complete the reveal
        const grd = mc.createRadialGradient(zoneX, zoneY, 0, zoneX, zoneY, Math.max(zoneHW, zoneHH) * 2.2);
        grd.addColorStop(0, 'rgba(255,255,255,0.95)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        mc.fillStyle = grd;
        mc.beginPath();
        mc.arc(zoneX, zoneY, Math.max(zoneHW, zoneHH) * 2.2, 0, Math.PI * 2);
        mc.fill();
        s.maskDirty = true;
      }
    }

    // apply mask canvas as CSS mask on the painting img
    if (s.maskDirty && img) {
      img.style.maskImage = `url(${mask.toDataURL()})`;
      img.style.webkitMaskImage = `url(${mask.toDataURL()})`;
      img.style.maskSize = '100% 100%';
      img.style.webkitMaskSize = '100% 100%';
      s.maskDirty = false;
    }

    s.raf = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    stateRef.current.progress = progress;
    stateRef.current.running  = running;
  }, [progress, running]);

  useEffect(() => {
    init();
    stateRef.current.raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(init);
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => {
      cancelAnimationFrame(stateRef.current.raf);
      ro.disconnect();
    };
  }, [init, draw]);

  return (
    <>
      {/* offscreen mask accumulator — hidden from view */}
      <canvas ref={maskRef} className="pointer-events-none absolute hidden" aria-hidden="true" />

      {/* painting image — starts fully transparent; mask reveals it */}
      <img
        ref={paintImgRef}
        src="/visuals/blade/easel-tune.jpg"
        alt="Particle painting reveal"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{
          transform: 'translate(-28.15%, -10%) scale(0.21)',
          maskImage: 'none',
          WebkitMaskImage: 'none',
          maskSize: '100% 100%',
          WebkitMaskSize: '100% 100%',
        }}
        draggable={false}
      />

      {/* particle canvas — on top of everything */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      />
    </>
  );
}
