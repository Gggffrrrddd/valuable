import { useEffect, useRef, useCallback } from 'react';
import { breadcrumb } from '@/lib/telemetry';

// ─── Config ──────────────────────────────────────────────────────────────────
//
// The painting sits exactly on the easel's canvas, at ANY container aspect
// (Jar-exact pattern: always cover, one shared transform for scene + mask).
// The old fixed transform (translate(-28.15%,-10%) scale(0.21)) only held at
// one aspect; now background crop and painting rect derive from the same
// cover+anchor math, so they track each other at every size.

// YOUR hardcoded tuner values for the painting placement — single source of
// truth for the live rect (matches the approved desktop look EXACTLY at 16:9;
// the contain math keeps it easel-anchored at every other aspect).
const TUNER_ZOOM = 0.21;
const TUNER_X = -28.15; // percent of W
const TUNER_Y = -10; // percent of H

// Easel canvas rect in base-image fractions — DERIVED FROM YOUR TUNER VALUES
// (above). At the 16:9 tune aspect the base cover-fit is ~identity, so tuner
// container fractions == base fractions: center (0.5+tx, 0.5+ty),
// half-size zoom/2.
const EASEL_CV = {
  u0: 0.5 + TUNER_X / 100 - TUNER_ZOOM / 2,
  v0: 0.5 + TUNER_Y / 100 - TUNER_ZOOM / 2,
  u1: 0.5 + TUNER_X / 100 + TUNER_ZOOM / 2,
  v1: 0.5 + TUNER_Y / 100 + TUNER_ZOOM / 2,
};

// Base image natural size (easel-base.png).
const BASE_W = 1672;
const BASE_H = 941;

interface PaintRect { x: number; y: number; w: number; h: number }

/** Stage fit (Jar-exact pattern): ALWAYS cover, never mode-switch.
 *  scale = max(W/BASE_W, H/BASE_H); overflow splits by object-position
 *  anchors shared with the <img> CSS, so painting math and displayed base
 *  can never misalign — mask values transform with the crop, like Jar.
 *  x-anchor 0.15 (easel sits left; preserves left, trims right emptiness);
 *  y-anchor 0.15 desktop / 0.75 mobile-compact (mirrors Jar: bottom-anchors
 *  the easel+legs on small stages, keeps sky on desktop). */
function baseCover(W: number, H: number) {
  const compact =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 1023.5px)').matches;
  const ax = 0.15;
  const ay = compact ? 0.75 : 0.15;
  const s = Math.max(W / BASE_W, H / BASE_H);
  return { s, ox: (W - BASE_W * s) * ax, oy: (H - BASE_H * s) * ay };
}

/** On-screen rect of the easel canvas for the CURRENT container size. */
function paintRectFor(W: number, H: number): PaintRect {
  const { s, ox, oy } = baseCover(W, H);
  return {
    x: ox + EASEL_CV.u0 * BASE_W * s,
    y: oy + EASEL_CV.v0 * BASE_H * s,
    w: (EASEL_CV.u1 - EASEL_CV.u0) * BASE_W * s,
    h: (EASEL_CV.v1 - EASEL_CV.v0) * BASE_H * s,
  };
}

// Painting pool — sequence 1-10, round-robin per session (see mount effect).
// 1-2 bundled (untouched, hardcoded values safe); 3-10 Cloudinary.
// All share the exact same placement + reveal animation.
const PAINTINGS = [
  '/visuals/blade/paint-default.jpg', // 1 (bundled)
  '/visuals/blade/paint-sunflower.png', // 2 (bundled)
  'https://res.cloudinary.com/r5wvbpys/image/upload/v1791993074/image_3.png', // 3 (fixed: was image_3.pngv → 404)
  'https://res.cloudinary.com/r5wvbpys/image/upload/v1791993086/image_4.png', // 4
  'https://res.cloudinary.com/r5wvbpys/image/upload/v1791993100/image_6.png', // 5
  'https://res.cloudinary.com/r5wvbpys/image/upload/v1791993114/imaeg_8.jpg', // 6
  'https://res.cloudinary.com/r5wvbpys/image/upload/v1791994070/iamge_9_1_1.png', // 7
  'https://res.cloudinary.com/r5wvbpys/image/upload/v1791994180/image_5_1.jpg', // 8
  'https://res.cloudinary.com/r5wvbpys/image/upload/v1791994231/image_7_1.png', // 9
  'https://res.cloudinary.com/r5wvbpys/image/upload/v1791994451/image_10_2_-compressed.jpg', // 10
];

// Round-robin cursor: stores the NEXT index to show, so refresh/relogin
// continues the 1-10 sequence without repeating until all 10 have shown.
const PAINT_INDEX_KEY = 'valuable-particle-painting-index';

const COUNT_DESKTOP = 2400;
const COUNT_MOBILE  = 800;
// Small, weak stamps: full coverage needs nearly ALL particles,
// so the reveal stays gradual across the whole session instead of
// saturating white after the first few hundred landings.
const LAND_RADIUS   = 12;   // px, screen space
const STAMP_ALPHA   = 0.13; // per-landing opacity
const DONE_AT       = 0.97;
const MAX_RECRUIT_PER_FRAME = 6;

// Vibrant multi-colour palette — [r, g, b]
const PALETTE: [number, number, number][] = [
  [255, 200,  80], [255, 140,  60], [255, 100, 120], [200, 130, 255],
  [100, 200, 255], [130, 255, 200], [255, 220, 150], [255,  80, 180],
  [100, 255, 255], [255, 255, 180], [220, 180, 255], [255, 160, 100],
  [180, 255, 160], [255, 120, 200], [255, 200, 200],
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface Dot {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  a: number; ba: number;
  cr: number; cg: number; cb: number;
  glow: number;
  phase: 0 | 1 | 2 | 3; // 0 ambient, 1 drift, 2 land-fade, 3 done
  tx: number; ty: number;
  age: number; lt: number;
  wobX: number; wobY: number;
  speed: number; pulse: number;
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
    wobX: rng(0.006, 0.018), wobY: rng(0.005, 0.014),
    speed: rng(0.6, 1.4),
    pulse: rng(0, Math.PI * 2),
  };
}

/** Stamp one small faint blob on the mask (screen coords). */
function stamp(mc: CanvasRenderingContext2D, x: number, y: number, strength = 1) {
  const r = LAND_RADIUS * rng(0.7, 1.4);
  const g = mc.createRadialGradient(x, y, 0, x, y, r);
  const c = STAMP_ALPHA * strength;
  g.addColorStop(0, `rgba(255,255,255,${c})`);
  g.addColorStop(0.5, `rgba(255,255,255,${c * 0.4})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  mc.fillStyle = g;
  mc.beginPath();
  mc.arc(x, y, r, 0, Math.PI * 2);
  mc.fill();
}

/**
 * Base wash: guarantees the reveal curve. B(progress) = progress² —
 * slow at start, accelerating, exactly 1.0 at session end.
 * Applied as max-so-far so the reveal can never jump or go backwards.
 */
function baseWashAlpha(p: number) {
  const c = Math.min(1, Math.max(0, p));
  return c * c;
}

/** Soft rect-covering wash at the given alpha (feathered, no hard edges). */
function applyWash(mc: CanvasRenderingContext2D, pr: PaintRect, alpha: number) {
  if (alpha <= 0) return;
  const zx = pr.x + pr.w / 2, zy = pr.y + pr.h / 2;
  // radius ≥ 2× rect half-diagonal → nearly uniform inside the rect
  const R = Math.hypot(pr.w / 2, pr.h / 2) * 2;
  const a = Math.min(1, alpha);
  const g = mc.createRadialGradient(zx, zy, 0, zx, zy, R);
  g.addColorStop(0, `rgba(255,255,255,${a})`);
  g.addColorStop(0.7, `rgba(255,255,255,${a * 0.85})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  mc.fillStyle = g;
  mc.beginPath();
  mc.arc(zx, zy, R, 0, Math.PI * 2);
  mc.fill();
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props { progress: number; running: boolean; duration?: number }

export default function ParticlePainting({ progress, running, duration = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const s = useRef({
    dots: [] as Dot[],
    W: 0, H: 0,
    raf: 0,
    last: 0,
    progress: 0,
    running: false,
    duration: 0,
    landed: 0,
    budget: 0,          // time-paced recruitment budget (particles)
    done: false,        // finale flurry fired
    wash: 0,            // base-wash level applied so far (max-so-far)
    shown: 0,           // smoothed progress (eases toward raw progress)
    imgReady: false,
    revealDirty: true,
    mask: null as HTMLCanvasElement | null,
    reveal: null as HTMLCanvasElement | null,
    img: null as HTMLImageElement | null,
  });

  // ── init / resize ─────────────────────────────────────────────────────────

  const init = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    // LAYOUT dims only: clientWidth/Height ignore ancestor transforms.
    // getBoundingClientRect() returns the POST-rotation bbox on mobile
    // (393×852 instead of the 852×393 stage) — that mismatch put the
    // painting somewhere the easel isn't. Same lesson as Study Table.
    const W = c.clientWidth, H = c.clientHeight;
    if (W < 1 || H < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = W * dpr; c.height = H * dpr;
    c.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);

    const st = s.current;
    st.W = W; st.H = H;

    // TEMP DIAGNOSTIC (mobile placement): log actual stage values once per
    // init (mount/resize only, no per-frame spam). Remove after diagnosis.
    try {
      const pr0dbg = paintRectFor(W, H);
      const baseElDbg = c.parentElement?.querySelector('img[src*="easel-base"]') as HTMLImageElement | null;
      const csDbg = baseElDbg ? getComputedStyle(baseElDbg) : null;
      const r1 = (v: number) => Math.round(v * 10) / 10;
      console.log('[particle-painting-mobile] init ' + JSON.stringify({
        containerWH: [r1(W), r1(H)],
        aspect: Math.round((W / Math.max(1, H)) * 1000) / 1000,
        coarse: window.matchMedia('(pointer: coarse)').matches,
        compact: window.matchMedia('(max-width: 1023.5px)').matches,
        orient: window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait',
        innerWH: [window.innerWidth, window.innerHeight],
        imgFit: csDbg ? csDbg.objectFit : null,
        imgPos: csDbg ? csDbg.objectPosition : null,
        paintRect: [r1(pr0dbg.x), r1(pr0dbg.y), r1(pr0dbg.w), r1(pr0dbg.h)],
      }));
    } catch { /* logging must never break the visual */ }

    // fresh offscreens
    const mask = document.createElement('canvas');
    mask.width = W; mask.height = H;
    const reveal = document.createElement('canvas');
    reveal.width = W; reveal.height = H;
    st.mask = mask; st.reveal = reveal;

    const coarse =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;
    // Capability-based (not width-based): rotated stage is wide on mobile.
    const n = coarse ? COUNT_MOBILE : COUNT_DESKTOP;
    st.dots = Array.from({ length: n }, () => spawn(W, H));
    st.done = false; st.budget = 0; st.revealDirty = true;
    st.shown = st.progress; // resize: stay in sync, never re-ease

    // pre-fill: keep reveal in sync with current progress across resizes —
    // base wash first (guaranteed curve), then particle stamps (texture),
    // and mark that many dots done.
    const mc = mask.getContext('2d');
    const pr0 = paintRectFor(W, H);
    const zx = pr0.x + pr0.w / 2, zy = pr0.y + pr0.h / 2;
    const zhw = pr0.w / 2, zhh = pr0.h / 2;
    if (mc) {
      const w0 = baseWashAlpha(st.progress);
      st.wash = w0;
      if (w0 >= 1) {
        mc.fillStyle = '#fff';
        mc.fillRect(0, 0, W, H);
      } else if (w0 > 0) {
        applyWash(mc, pr0, w0);
      }
    }
    const pre = Math.floor(st.progress * n);
    if (mc && pre > 0) {
      for (let i = 0; i < pre; i++) stamp(mc, rng(zx - zhw, zx + zhw), rng(zy - zhh, zy + zhh));
      for (let i = 0; i < pre && i < st.dots.length; i++) {
        const d = st.dots[Math.floor(Math.random() * st.dots.length)];
        if (d.phase === 0) { d.phase = 3; d.a = 0; }
      }
    }
    st.landed = pre;
    // NOTE: no instant fill here — the base wash already encodes the
    // progress curve, so a resize can never cause a reveal jump.
  }, []);

  // ── compose reveal canvas: painting (transformed) clipped by mask ─────────

  const composeReveal = useCallback(() => {
    const st = s.current;
    const { mask, reveal, img, W, H } = st;
    if (!mask || !reveal || !img || !st.imgReady || W < 1) return;
    const rc = reveal.getContext('2d');
    if (!rc) return;

    rc.setTransform(1, 0, 0, 1, 0, 0);
    rc.globalCompositeOperation = 'source-over';
    rc.clearRect(0, 0, W, H);

    // Draw the painting cover-fit into the CURRENT easel-canvas screen rect
    // (aspect-invariant — tracks the base image's contain fit exactly).
    const pr = paintRectFor(W, H);
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (iw > 0 && ih > 0) {
      const sc = Math.max(pr.w / iw, pr.h / ih);
      const dw = iw * sc, dh = ih * sc;
      rc.drawImage(img, pr.x + (pr.w - dw) / 2, pr.y + (pr.h - dh) / 2, dw, dh);
    }

    // clip to accumulated landings
    rc.globalCompositeOperation = 'destination-in';
    rc.drawImage(mask, 0, 0);
    rc.globalCompositeOperation = 'source-over';

    st.revealDirty = false;
  }, []);

  // ── main loop ─────────────────────────────────────────────────────────────

  const draw = useCallback((now: number) => {
    const c = canvasRef.current;
    if (!c) { s.current.raf = requestAnimationFrame(draw); return; }
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const st = s.current;
    const { W, H, dots } = st;
    if (W < 1) { st.raf = requestAnimationFrame(draw); return; }

    const dt = Math.min(0.1, Math.max(0.001, (now - (st.last || now)) / 1000));
    st.last = now;

    // ── smoothed progress ──
    // The timer ticks in 1-second steps; easing toward the raw value hides
    // every step — especially the final 0.99 → 1.0 jump that caused the
    // last-second pop. Catch-up capped at ~3× real-time rate.
    const raw = st.progress;
    const dur0 = st.duration > 0 ? st.duration : 1500;
    const maxStep = dt * (3 / dur0);
    st.shown = raw >= 1 ? Math.min(1, st.shown + Math.max(maxStep, dt * 0.25))
                        : Math.min(raw, st.shown + maxStep);
    if (st.shown < raw - maxStep * 2) st.shown = raw - maxStep * 2; // never lag far
    const prog = st.shown;

    // Landing zone = current easel-canvas screen rect (aspect-invariant).
    const pz = paintRectFor(W, H);
    const zx = pz.x + pz.w / 2, zy = pz.y + pz.h / 2;
    const zhw = pz.w / 2, zhh = pz.h / 2;

    // ── time-paced recruitment ──
    // rate spreads ALL particles evenly across the whole session duration,
    // so landings track the clock instead of bursting mid-session.
    const total = dots.length;
    const dur = st.duration > 0 ? st.duration : 1500;
    const rate = total / dur; // particles per second
    if (st.running) {
      st.budget = Math.min(rate * 5, st.budget + rate * dt); // cap 5s worth
    }
    const target = prog * total;
    const catchup = Math.max(0, target - st.landed);
    let recruit = Math.min(Math.floor(st.budget), catchup, MAX_RECRUIT_PER_FRAME);
    // NOTE: budget is consumed per actual recruitment inside the loop,
    // not here — so paused frames never waste budget.

    // ── update dots ──
    const mc = st.mask?.getContext('2d') ?? null;

    for (const d of dots) {
      d.age++;
      const sin1 = Math.sin(d.age * d.wobX + d.pulse);
      const cos1 = Math.cos(d.age * d.wobY + d.pulse);

      if (d.phase === 0) {
        d.x += (d.vx + sin1 * 0.15) * d.speed;
        d.y += (d.vy + cos1 * 0.10) * d.speed;
        d.a = d.ba * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(d.age * 0.02 + d.pulse)));
        if (d.x < -10) d.x = W + 10;
        if (d.x > W + 10) d.x = -10;
        if (d.y < -10) d.y = H + 10;
        if (d.y > H + 10) d.y = -10;

        if (recruit > 0 && st.running && Math.random() < 0.5) {
          d.phase = 1;
          d.tx = rng(zx - zhw, zx + zhw);
          d.ty = rng(zy - zhh, zy + zhh);
          recruit--;
          st.budget = Math.max(0, st.budget - 1);
        }
      } else if (d.phase === 1) {
        const dx = d.tx - d.x, dy = d.ty - d.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        // slow floating approach — taire hue canvas tak (~1.5s travel),
        // never a fast dart. Wobble keeps it organic.
        const spd = Math.max(0.5, dist * 0.012);
        d.x += (dx / dist) * spd + sin1 * 0.45;
        d.y += (dy / dist) * spd + cos1 * 0.35;
        d.a = Math.min(0.95, d.a + 0.012);

        if (dist < 5) {
          d.phase = 2; d.lt = 50;
          st.landed++;
          if (mc) { stamp(mc, d.tx, d.ty); st.revealDirty = true; }
        }
      } else if (d.phase === 2) {
        d.a *= 0.94;
        if (--d.lt <= 0) { d.phase = 3; d.a = 0; }
      }
    }

    // ── base wash top-up: reveal follows progress² with no jumps ──
    // Particle stamps add organic texture; the wash guarantees the curve
    // completes exactly at session end.
    if (mc) {
      const wTarget = baseWashAlpha(prog);
      if (wTarget > st.wash) {
        if (wTarget >= 1 || st.wash >= 0.999) {
          mc.fillStyle = '#fff';
          mc.fillRect(0, 0, W, H);
          st.wash = 1;
        } else {
          const delta = (wTarget - st.wash) / (1 - st.wash);
          applyWash(mc, paintRectFor(W, H), delta);
          st.wash = wTarget;
        }
        st.revealDirty = true;
      }
    }

    // ── finale flurry: EVERY remaining particle lands, none left floating ──
    // (No mask fill here — the wash ramp already completes the reveal
    // gradually, so there is no last-second pop.)
    if (prog >= DONE_AT && !st.done) {
      st.done = true;
      for (const d of dots) {
        if (d.phase === 0) {
          d.phase = 1;
          d.tx = rng(zx - zhw, zx + zhw);
          d.ty = rng(zy - zhh, zy + zhh);
        }
      }
    }

    // ── render ──
    if (st.revealDirty) composeReveal();

    ctx.clearRect(0, 0, W, H);

    // painting reveal under everything
    if (st.reveal) ctx.drawImage(st.reveal, 0, 0, W, H);

    // particles on top (additive glow)
    ctx.globalCompositeOperation = 'lighter';
    for (const d of dots) {
      if (d.phase >= 3 || d.a <= 0.008) continue;
      const gr = d.r * d.glow;
      const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, gr);
      g.addColorStop(0, `rgba(${d.cr},${d.cg},${d.cb},${d.a * 0.5})`);
      g.addColorStop(0.4, `rgba(${d.cr},${d.cg},${d.cb},${d.a * 0.15})`);
      g.addColorStop(1, `rgba(${d.cr},${d.cg},${d.cb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(d.x, d.y, gr, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = d.a;
      ctx.fillStyle = `rgb(${Math.min(255, d.cr + 60)},${Math.min(255, d.cg + 60)},${Math.min(255, d.cb + 60)})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';

    st.raf = requestAnimationFrame(draw);
  }, [composeReveal]);

  // ── sync props ────────────────────────────────────────────────────────────

  useEffect(() => {
    s.current.progress = progress;
    s.current.running = running;
    s.current.duration = duration;
  }, [progress, running, duration]);

  // ── mount: next painting in 1-10 sequence, load it, init, loop ────────

  useEffect(() => {
    const total = PAINTINGS.length;
    const readIdx = () => {
      try {
        return (((parseInt(localStorage.getItem(PAINT_INDEX_KEY) ?? '0', 10) || 0) % total) + total) % total;
      } catch {
        return 0;
      }
    };
    const writeIdx = (i: number) => {
      try {
        localStorage.setItem(PAINT_INDEX_KEY, String((((i % total) + total) % total)));
      } catch {
        /* storage unavailable — sequence restarts, harmless */
      }
    };
    let idx = readIdx();
    let attempts = 0;
    const img = new Image();
    img.onload = () => { s.current.imgReady = true; s.current.revealDirty = true; };
    img.onerror = () => {
      console.warn('[particle-painting] painting failed to load, skipping to next:', PAINTINGS[idx]);
      breadcrumb('painting', 'load failed, skipping', { src: PAINTINGS[idx] });
      attempts += 1;
      if (attempts >= total) return; // all failed — stay blank, never loop forever
      idx = (idx + 1) % total;
      writeIdx(idx + 1);
      img.src = PAINTINGS[idx];
    };
    img.src = PAINTINGS[idx];
    writeIdx(idx + 1); // reserve: next session continues the sequence
    // Warm the HTTP cache for the following painting (silent, no handlers).
    const warm = new Image();
    warm.src = PAINTINGS[(idx + 1) % total];
    s.current.img = img;

    init();
    s.current.raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(init);
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => { cancelAnimationFrame(s.current.raf); ro.disconnect(); };
  }, [init, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
