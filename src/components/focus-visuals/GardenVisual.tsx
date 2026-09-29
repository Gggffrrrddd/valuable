/**
 * Garden / "Starlight Butterfly" focus visual.
 *
 * The whole animation is driven by the session `progress` value (0..1) — the
 * same value the timer uses. There is NO camera and NO separate post-session
 * finale: the garden image is a fixed, untouched backdrop and everything else
 * (sky, stars, cocoons, butterflies, phrase) is an overlay in the dark area
 * above it.
 *
 *   Phase A (0.0 -> 0.5): small butterflies trickle in from the screen edges
 *                         and dissolve into a scatter of stars (no figure);
 *                         the whole star field is present by progress 0.5.
 *   Phase B (0.5 -> 1.0): cocoons open in a shuffled order, each releasing a
 *                         butterfly that traces its slice of the phrase; the
 *                         phrase is complete at exactly progress 1.0.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { FocusVisualProps } from './types';
import { COCOON_SLOTS, COCOON_PHASES } from './garden/cocoonSlots';
import {
  ASSETS,
  COCOON,
  GARDEN_PLACEMENT,
  MOON,
  SKY,
  COCOON_COUNT,
  STAR_COLORS,
  OPEN_WINDOW,
  DISSOLVE,
} from './garden/config';
import { resolveSessionPalette } from './garden/palette';
import { generateSky, type SkyLayer } from './garden/sky';
import { AnimatedButterflyRenderer } from './garden/animatedButterfly';
import { generateMoon, type MoonSprite } from './garden/moon';
import { generateStarfield } from './garden/starfield';
import { ArrivalSwarm, EmergenceSwarm, createOpenSchedule, type EmergenceButterfly } from './garden/butterflySwarm';
import { layoutPhrase, resolveSessionPhrase } from './garden/phrases';
import { clamp01, smoothstep } from './model-core/canvasUtils';
import { useReducedMotion } from './model-core/useReducedMotion';

/** Deterministic pseudo-random in [0, 1) from a numeric seed. */
function rand01(seed: number) {
  const x = Math.sin(seed * 9999.9999) * 10000;
  return x - Math.floor(x);
}

function hexToRgba(hex: string, a: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return `rgba(255,255,255,${a})`;
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${a})`;
}

/**
 * Pre-rendered radial glow sprite for stars — one build, then every star is a
 * single cheap drawImage instead of a per-frame shadowBlur arc.
 */
function makeGlowSprite(color: string): HTMLCanvasElement {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, color);
    g.addColorStop(0.17, color);
    g.addColorStop(0.42, hexToRgba(color, 0.32));
    g.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return canvas;
}

export default function GardenVisual({ progress, running = false, onFinaleComplete }: FocusVisualProps) {
  // Dev tools: ?garden=progress&p=0.0-1.0 seeks the whole animation instantly.
  const devTools = useMemo(() => {
    if (typeof window === 'undefined') return { p: null as number | null, palette: null, phrase: null };
    const params = new URLSearchParams(window.location.search);
    if (params.get('garden') !== 'progress') return { p: null as number | null, palette: null, phrase: null };
    const rawP = params.get('p');
    const p = rawP === null ? null : clamp01(Number(rawP));
    return {
      p: p !== null && Number.isFinite(p) ? p : null,
      palette: params.get('palette'),
      phrase: params.get('phrase'),
    };
  }, []);

  const palette = resolveSessionPalette(devTools.palette);
  const phrase = useMemo(() => resolveSessionPhrase(devTools.phrase), [devTools.phrase]);
  const reducedMotion = useReducedMotion();

  const sessionProgress = clamp01(progress);
  const complete = sessionProgress >= 1;
  const targetP = devTools.p ?? (reducedMotion ? 1 : sessionProgress);

  const targetPRef = useRef(targetP);
  targetPRef.current = targetP;

  const skyCanvasRef = useRef<HTMLCanvasElement>(null);
  const effectsCanvasRef = useRef<HTMLCanvasElement>(null);
  const skyLayerRef = useRef<SkyLayer | null>(null);
  const moonRef = useRef<MoonSprite | null>(null);
  const rendererRef = useRef<AnimatedButterflyRenderer | null>(null);
  const swarmsRef = useRef<{ arrival: ArrivalSwarm; emergence: EmergenceSwarm } | null>(null);
  // Phrase dots are stamped into an offscreen canvas once, then blitted —
  // never re-drawn — so a full phrase costs one drawImage per frame instead
  // of thousands of shadowed arcs.
  const phraseCvsRef = useRef<HTMLCanvasElement | null>(null);
  const phraseStampRef = useRef<WeakMap<EmergenceButterfly, number>>(new WeakMap());
  const phraseStampPRef = useRef(0);
  // Wall-clock moment progress first hit 1 — drives the end-of-phrase
  // dissolve of the phrase-writing butterflies (progress never exceeds 1).
  const phraseDoneAtRef = useRef<number | null>(null);

  // Natural star-colour glow sprites (fixed colours — stars never take the
  // session palette) plus a white pulse sprite for landing flashes.
  const starSprites = useMemo(
    () => ({ colors: STAR_COLORS.map(makeGlowSprite), pulse: makeGlowSprite('#ffffff') }),
    [],
  );

  // Open schedule is precomputed once per session and stable across re-renders.
  const openSchedule = useMemo(() => createOpenSchedule(COCOON_COUNT), []);

  const renderCanvasFrame = useCallback(
    (p: number, time: number) => {
      const effCvs = effectsCanvasRef.current;
      const skyCvs = skyCanvasRef.current;
      if (!effCvs || !skyCvs) return;

      const w = effCvs.clientWidth;
      const h = effCvs.clientHeight;
      if (w === 0 || h === 0) return;

      // (Re)build the offscreen layers and swarms whenever the canvas resizes
      // (or when the swarms were dropped by an effect re-run).
      const needsBuild = !swarmsRef.current || effCvs.width !== w || effCvs.height !== h;
      if (needsBuild) {
        effCvs.width = w;
        effCvs.height = h;

        const skyH = Math.max(1, Math.round(h * SKY.overlayVh));
        skyCvs.width = w;
        skyCvs.height = skyH;
        skyLayerRef.current = generateSky(w, skyH);
        const sctx = skyCvs.getContext('2d');
        if (sctx) {
          sctx.clearRect(0, 0, w, skyH);
          sctx.drawImage(skyLayerRef.current.canvas, 0, 0);
        }

        if (!phraseCvsRef.current) phraseCvsRef.current = document.createElement('canvas');
        phraseCvsRef.current.width = w;
        phraseCvsRef.current.height = h;
        phraseStampRef.current = new WeakMap();
        phraseStampPRef.current = 0;

        const targets = generateStarfield(w, h);
        const layout = layoutPhrase(phrase, w, h);
        moonRef.current = generateMoon(Math.min(w, h) * MOON.radius);
        swarmsRef.current = {
          arrival: new ArrivalSwarm(targets, w, h),
          emergence: new EmergenceSwarm(COCOON_SLOTS, w, h, openSchedule, layout),
        };
      }

      const swarms = swarmsRef.current;
      const ctx = effCvs.getContext('2d');
      if (!swarms || !ctx) return;

      ctx.clearRect(0, 0, w, h);

      // --- Stars the arrivals dissolve into (no figure, just a scatter) ---
      // Drawn from a pre-rendered glow sprite: one drawImage per star instead
      // of a per-frame shadowBlur arc (same look, a fraction of the cost).
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const target of swarms.arrival.targets) {
        const starP = swarms.arrival.starP.get(target.id);
        if (starP === undefined || p < starP) continue;
        const appear = smoothstep(starP, starP + 0.02, p);
        const twinkle = 0.78 + 0.22 * Math.sin(time * 2.1 + target.id * 1.7);
        const alpha = appear * (target.isProminent ? 1 : 0.8) * twinkle;
        const colorIdx =
          Math.floor(rand01(target.id * 1.37) * starSprites.colors.length) % starSprites.colors.length;
        const sprite = starSprites.colors[colorIdx];
        const radius = (target.isProminent ? 2 : 1.1) * (0.5 + 0.5 * appear);
        const size = radius * 7;

        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, target.x - size / 2, target.y - size / 2, size, size);

        // Bright pulse as a butterfly lands and becomes the star.
        const pulse = swarms.arrival.getStarPulse(target, p);
        if (pulse > 0.001) {
          const pulseSize = (radius + 3.5 * pulse) * 7;
          ctx.globalAlpha = pulse * 0.9;
          ctx.drawImage(
            starSprites.pulse,
            target.x - pulseSize / 2,
            target.y - pulseSize / 2,
            pulseSize,
            pulseSize,
          );
        }
      }
      ctx.restore();

      // --- Premium moon: fades in once the star field is complete, then stays.
      // Drawn before the phrase, so the phrase is written beneath it.
      const moon = moonRef.current;
      const moonAlpha = smoothstep(MOON.fadeStart, MOON.fadeEnd, p);
      if (moon && moonAlpha > 0.001) {
        ctx.save();
        ctx.globalAlpha = moonAlpha;
        ctx.drawImage(moon.canvas, w * MOON.x - moon.cx, h * MOON.y - moon.cy);
        ctx.restore();
      }

      // --- Phrase, built one letter at a time by the butterflies ---
      // Every finished dot is stamped once into an offscreen canvas; each
      // frame we only stamp the few newly-finished dots and blit the rest.
      const pcv = phraseCvsRef.current;
      if (pcv) {
        const pctx = pcv.getContext('2d');
        if (pctx) {
          // Dev seeking backwards: rebuild the stamped canvas from scratch.
          if (p + 1e-6 < phraseStampPRef.current) {
            pctx.clearRect(0, 0, w, h);
            phraseStampRef.current = new WeakMap();
            phraseStampPRef.current = 0;
          }

          const frontier: { x: number; y: number; a: number }[] = [];
          pctx.save();
          pctx.globalCompositeOperation = 'lighter';
          pctx.fillStyle = palette.core;
          pctx.shadowBlur = 6;
          pctx.shadowColor = palette.glow;
          for (const b of swarms.emergence.butterflies) {
            const pts = b.phrasePoints;
            if (pts.length === 0 || p < b.writeStart) continue;
            const drawn = swarms.emergence.getSliceProgress(b, p) * pts.length;
            const stamped = phraseStampRef.current.get(b) ?? 0;
            // A dot is stamped once its fade-in is ~done (alpha >= 0.95).
            const done = Math.min(pts.length, Math.max(stamped, Math.floor(drawn - 0.95) + 1));
            for (let k = stamped; k < done; k++) {
              const pt = pts[k];
              pctx.globalAlpha = 0.95;
              pctx.beginPath();
              pctx.arc(pt.x, pt.y, 1.7, 0, Math.PI * 2);
              pctx.fill();
            }
            if (done > stamped) phraseStampRef.current.set(b, done);
            // At most one still-fading dot per butterfly, drawn live.
            for (let k = done; k < pts.length && k < Math.ceil(drawn); k++) {
              frontier.push({ x: pts[k].x, y: pts[k].y, a: clamp01(drawn - k) * 0.95 });
            }
          }
          pctx.restore();
          phraseStampPRef.current = p;

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(pcv, 0, 0);
          if (frontier.length > 0) {
            ctx.fillStyle = palette.core;
            ctx.shadowBlur = 6;
            ctx.shadowColor = palette.glow;
            for (const d of frontier) {
              ctx.globalAlpha = d.a;
              ctx.beginPath();
              ctx.arc(d.x, d.y, 1.7, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
        }
      }

      // --- Cocoon opening bursts ---
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < COCOON_SLOTS.length; i++) {
        const openP = openSchedule[i] ?? OPEN_WINDOW.start;
        const t = (p - openP) / OPEN_WINDOW.burstP;
        if (t < 0 || t > 1) continue;
        const slot = COCOON_SLOTS[i];
        const cx = slot.x * w;
        const cy = slot.y * h;
        const eased = 1 - Math.pow(1 - t, 2);
        for (let k = 0; k < 12; k++) {
          const angle = (k / 12) * Math.PI * 2 + rand01(i * 3 + 1) * Math.PI;
          const dist = eased * (28 + 24 * rand01(i * 7 + k));
          ctx.globalAlpha = (1 - t) * 0.8;
          ctx.fillStyle = palette.glow;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // --- Butterflies ---
      const renderer = rendererRef.current;
      if (renderer && renderer.ready) {
        for (const rig of swarms.arrival.getRenderData(p, time)) renderer.draw(ctx, rig);

        // Once the phrase is complete (progress 1), the phrase-writing
        // butterflies hold for a beat and then dissolve into their letters.
        if (p >= 0.999) {
          if (phraseDoneAtRef.current === null) phraseDoneAtRef.current = time;
        } else {
          phraseDoneAtRef.current = null;
        }
        const dissolve =
          phraseDoneAtRef.current === null
            ? 0
            : clamp01((time - phraseDoneAtRef.current) / DISSOLVE.durationS);
        for (const rig of swarms.emergence.getRenderData(p, time, dissolve)) {
          renderer.draw(ctx, rig);
        }
      }
    },
    [phrase, openSchedule, palette, starSprites],
  );

  // Continuous render loop: eases the displayed progress towards the live
  // value (so 1 Hz timer ticks look smooth) while always finishing exactly on
  // the target. Dev seeking / reduced motion snap instantly.
  useEffect(() => {
    rendererRef.current = new AnimatedButterflyRenderer(palette.hue, palette.core, palette.glow);
    swarmsRef.current = null;
    let frame = 0;
    let last = performance.now();
    let lastDraw = 0;
    let displayed = targetPRef.current;

    const loop = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const target = targetPRef.current;
      if (Math.abs(target - displayed) > 0.02) {
        displayed = target;
      } else {
        // Slower chase (τ ≈ 0.25s): the displayed progress glides across the
        // whole gap between 1 Hz ticks instead of snapping then stalling.
        displayed += (target - displayed) * (1 - Math.exp(-dt * 4));
      }
      // Cap drawing at ~30fps — plenty for this scene, half the GPU cost.
      if (now - lastDraw >= 33) {
        lastDraw = now;
        renderCanvasFrame(displayed, now / 1000);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [palette.hue, palette.core, palette.glow, renderCanvasFrame]);

  // --- Cocoon glow response (ramps 0.12 -> 0.85 across phase A) ---
  const glow = COCOON.minGlow + clamp01(targetP / 0.5) * (COCOON.maxGlow - COCOON.minGlow);
  const targetGlow = running ? glow : COCOON.pausedGlow;
  const period = targetP > 0.9 ? COCOON.breathPeriodEndS : COCOON.breathPeriodS;
  const skyOpacity = smoothstep(0, SKY.fadeInEnd, targetP);

  return (
    <div className="absolute inset-0 z-0 bg-[#090b0a] overflow-hidden">
      {/* 1. Garden artwork — fixed size/position/crop, never transformed. */}
      <div className="absolute inset-0 h-full w-full" aria-hidden="true">
        <img
          src={ASSETS.garden}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover"
          style={{
            transform: `translate(${GARDEN_PLACEMENT.positionX}%, ${GARDEN_PLACEMENT.positionY}%) scale(${GARDEN_PLACEMENT.scale})`,
          }}
        />

        {/* 2. Cocoon sprites — individual, hidden once their cocoon opens. */}
        {COCOON_SLOTS.map((slot, i) => {
          const openP = openSchedule[i] ?? OPEN_WINDOW.start;
          if (targetP >= openP) return null;
          return (
            <div
              key={slot.id}
              className="absolute"
              style={{
                left: `${slot.x * 100}%`,
                top: `${slot.y * 100}%`,
                width: '100%',
                height: '100%',
                transform: `translate(-50%, -50%) scale(${slot.scale})`,
                pointerEvents: 'none',
              }}
            >
              {/* Base sprite (unlit). */}
              <img src={ASSETS.cocoon} alt="" className="absolute inset-0 h-full w-full object-contain" />
              {/* Wide outer bloom — soft, always present. */}
              <img
                src={ASSETS.cocoon}
                alt=""
                className="absolute inset-0 h-full w-full object-contain"
                style={{
                  filter: `blur(${COCOON.bloomRadius / 2}px) drop-shadow(0 0 ${COCOON.bloomRadius}px ${COCOON.glowColor})`,
                  mixBlendMode: 'screen',
                  opacity: targetGlow * 0.85,
                  animation: running ? `garden-breathe ${period}s ease-in-out infinite alternate` : 'none',
                  animationDelay: `-${COCOON_PHASES[i]}s`,
                }}
              />
              {/* Vibrant core glow — brighter, tighter, offset phase. */}
              <img
                src={ASSETS.cocoon}
                alt=""
                className="absolute inset-0 h-full w-full object-contain"
                style={{
                  filter: `brightness(1.35) drop-shadow(0 0 ${COCOON.glowRadius}px ${COCOON.glowColor}) drop-shadow(0 0 ${COCOON.glowRadius}px ${COCOON.coreColor})`,
                  mixBlendMode: 'screen',
                  opacity: targetGlow,
                  animation: running ? `garden-breathe ${period * 0.8}s ease-in-out infinite alternate` : 'none',
                  animationDelay: `-${COCOON_PHASES[i] * 1.4}s`,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* 3. Static stars-only sky overlay (fades in during phase A). */}
      <canvas
        ref={skyCanvasRef}
        aria-hidden="true"
        className="absolute left-0 top-0 w-full pointer-events-none"
        style={{ height: `${SKY.overlayVh * 100}vh`, opacity: skyOpacity }}
      />

      {/* 4. Effects canvas — fully transparent, cleared every frame. */}
      <canvas
        ref={effectsCanvasRef}
        aria-hidden="true"
        className="absolute inset-0 z-10 h-full w-full pointer-events-none"
      />

      {/* Screen-reader announcement of the written phrase. */}
      {complete && (
        <div aria-live="polite" className="sr-only">
          {phrase}
        </div>
      )}

      {/* Continue button once the session is truly complete. */}
      {complete && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-end pb-24 pointer-events-none animate-fade-in">
          <button
            onClick={onFinaleComplete}
            className="pointer-events-auto rounded-full bg-lime-300 px-8 py-3.5 font-display text-sm font-bold tracking-wide text-[#11130f] transition hover:bg-lime-200 hover:scale-105"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
