import { useEffect, useRef, useCallback } from 'react';

// ─── Config ──────────────────────────────────────────────────────────────────
//
// The painting sits where the old hardcoded img sat:
//   transform: translate(-28.15%, -10%) scale(0.21), origin 50% 50%.
// We replicate that exact transform on canvas (no CSS-mask coordinate trap)
// and render the painting reveal directly: painting (transformed, cover-fit)
// clipped by an accumulated landing mask, blitted under the particles.

// Landing zone on screen (fraction of container) — matches the visible canvas.
const ZONE = { cx: 0.5 - 0.2815, cy: 0.5 - 0.10, hw: 0.11, hh: 0.14 };

// Must match the old CSS values exactly.
const PAINT_TX = -0.2815; // fraction of W
const PAINT_TY = -0.10;   // fraction of H
const PAINT_S  = 0.21;

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

// ─── TEMP DIAGNOSTICS: [particle-painting-measure] ───────────────────────────
// Logs only, zero visual/behavior change. Remove after diagnosis.

function ppmLog(tag: string, data: Record<string, unknown>) {
  try {
    console.log('[particle-painting-measure] ' + tag + ' ' + JSON.stringify({
      fs: !!document.fullscreenElement,
      win: [window.innerWidth, window.innerHeight],
      dpr: window.devicePixelRatio || 1,
      ...data,
    }));
  } catch { /* logging must never break the visual */ }
}

function ppmRect(el: Element | null) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 };
}

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

/** Soft zone-covering wash at the given alpha (feathered, no hard edges). */
function applyWash(mc: CanvasRenderingContext2D, W: number, H: number, alpha: number) {
  if (alpha <= 0) return;
  const zx = W * ZONE.cx, zy = H * ZONE.cy;
  // radius ≥ 2× zone half-diagonal → nearly uniform inside the zone
  const R = Math.hypot(W * ZONE.hw, H * ZONE.hh) * 2;
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
    ppmInitSrc: 'mount', // TEMP: last init trigger source
    ppmLastComposeKey: '', // TEMP: dims key of last logged compose
  });

  // ── init / resize ─────────────────────────────────────────────────────────

  const init = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const W = rect.width, H = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // TEMP (#2): assumed math dims vs actual measured rect at init time.
    ppmLog('init-run', {
      src: s.current.ppmInitSrc,
      assumedWH: [Math.round(s.current.W * 10) / 10, Math.round(s.current.H * 10) / 10],
      measuredWH: [Math.round(W * 10) / 10, Math.round(H * 10) / 10],
      dprUsed: dpr,
      backingWH: [Math.round(W * dpr), Math.round(H * dpr)],
    });
    c.width = W * dpr; c.height = H * dpr;
    c.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);

    const st = s.current;
    st.W = W; st.H = H;

    // fresh offscreens
    const mask = document.createElement('canvas');
    mask.width = W; mask.height = H;
    const reveal = document.createElement('canvas');
    reveal.width = W; reveal.height = H;
    st.mask = mask; st.reveal = reveal;

    const n = W < 768 ? COUNT_MOBILE : COUNT_DESKTOP;
    st.dots = Array.from({ length: n }, () => spawn(W, H));
    st.done = false; st.budget = 0; st.revealDirty = true;
    st.shown = st.progress; // resize: stay in sync, never re-ease

    // pre-fill: keep reveal in sync with current progress across resizes —
    // base wash first (guaranteed curve), then particle stamps (texture),
    // and mark that many dots done.
    const mc = mask.getContext('2d');
    const zx = W * ZONE.cx, zy = H * ZONE.cy;
    const zhw = W * ZONE.hw, zhh = H * ZONE.hh;
    if (mc) {
      const w0 = baseWashAlpha(st.progress);
      st.wash = w0;
      if (w0 >= 1) {
        mc.fillStyle = '#fff';
        mc.fillRect(0, 0, W, H);
      } else if (w0 > 0) {
        applyWash(mc, W, H, w0);
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

    // replicate CSS: origin centre → translate → scale → un-origin
    rc.save();
    rc.translate(W / 2, H / 2);
    rc.translate(PAINT_TX * W, PAINT_TY * H);
    rc.scale(PAINT_S, PAINT_S);
    rc.translate(-W / 2, -H / 2);

    // object-cover the image into the W×H local box
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (iw > 0 && ih > 0) {
      const sc = Math.max(W / iw, H / ih);
      const dw = iw * sc, dh = ih * sc;
      // TEMP (#2/#3): log cover math + stretch ratios when dims change.
      const cvs = canvasRef.current;
      const cssR = cvs ? ppmRect(cvs) : null;
      const key = Math.round(W) + 'x' + Math.round(H) + '|' + (cssR ? Math.round(cssR.w) + 'x' + Math.round(cssR.h) : 'none');
      if (key !== s.current.ppmLastComposeKey) {
        s.current.ppmLastComposeKey = key;
        const attrW = cvs ? (cvs as HTMLCanvasElement).width : 0;
        const attrH = cvs ? (cvs as HTMLCanvasElement).height : 0;
        ppmLog('compose', {
          assumedWH: [Math.round(W * 10) / 10, Math.round(H * 10) / 10],
          cssWH: cssR ? [cssR.w, cssR.h] : null,
          naturalWH: [iw, ih],
          coverScale: Math.round(sc * 1000) / 1000,
          drawnWH: [Math.round(dw * 10) / 10, Math.round(dh * 10) / 10],
          drawnAspect: Math.round((dw / dh) * 1000) / 1000,
          naturalAspect: Math.round((iw / ih) * 1000) / 1000,
          backingWH: [attrW, attrH],
          backingAspect: attrH > 0 ? Math.round((attrW / attrH) * 1000) / 1000 : null,
          cssAspect: cssR && cssR.h > 0 ? Math.round((cssR.w / cssR.h) * 1000) / 1000 : null,
          backingPerCssX: cssR && cssR.w > 0 ? Math.round((attrW / cssR.w) * 100) / 100 : null,
          backingPerCssY: cssR && cssR.h > 0 ? Math.round((attrH / cssR.h) * 100) / 100 : null,
          revealWH: [reveal.width, reveal.height],
          maskWH: [mask.width, mask.height],
        });
      }
      rc.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }
    rc.restore();

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

    const zx = W * ZONE.cx, zy = H * ZONE.cy;
    const zhw = W * ZONE.hw, zhh = H * ZONE.hh;

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
          applyWash(mc, W, H, delta);
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
    img.onload = () => {
      s.current.imgReady = true;
      s.current.revealDirty = true;
      // TEMP (#3): painting natural size at load.
      ppmLog('img-loaded', { src: PAINTINGS[idx], naturalWH: [img.naturalWidth, img.naturalHeight] });
    };
    img.onerror = () => {
      console.warn('[particle-painting] painting failed to load, skipping to next:', PAINTINGS[idx]);
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
    // TEMP (#4): does re-measure fire on resize, or mount-only?
    const ro = new ResizeObserver(() => {
      const c = canvasRef.current;
      s.current.ppmInitSrc = 'ro-fire';
      ppmLog('ro-fire', { canvasWH: c ? ppmRect(c) : null, parentWH: c?.parentElement ? ppmRect(c.parentElement) : null });
      init();
    });
    const onWinResize = () => {
      const c = canvasRef.current;
      ppmLog('win-resize', {
        canvasWH: c ? ppmRect(c) : null,
        parentWH: c?.parentElement ? ppmRect(c.parentElement) : null,
        assumedWH: [Math.round(s.current.W * 10) / 10, Math.round(s.current.H * 10) / 10],
      });
    };
    const onFsChange = () => {
      const c = canvasRef.current;
      // TEMP (#1): container rect fullscreen vs windowed.
      ppmLog('fs-change', {
        canvasWH: c ? ppmRect(c) : null,
        parentWH: c?.parentElement ? ppmRect(c.parentElement) : null,
        assumedWH: [Math.round(s.current.W * 10) / 10, Math.round(s.current.H * 10) / 10],
      });
    };
    window.addEventListener('resize', onWinResize);
    document.addEventListener('fullscreenchange', onFsChange);
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => {
      cancelAnimationFrame(s.current.raf);
      ro.disconnect();
      window.removeEventListener('resize', onWinResize);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, [init, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
