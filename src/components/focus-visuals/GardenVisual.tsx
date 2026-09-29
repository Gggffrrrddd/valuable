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
  SKY,
  COCOON_COUNT,
  STARFIELD,
  PHRASE,
  OPEN_WINDOW,
} from './garden/config';
import { resolveSessionPalette } from './garden/palette';
import { generateSky, type SkyLayer } from './garden/sky';
import { ButterflyRenderer } from './garden/butterflySprite';
import { generateStarfield } from './garden/starfield';
import { ArrivalSwarm, EmergenceSwarm, createOpenSchedule } from './garden/butterflySwarm';
import { samplePhrase, resolveSessionPhrase } from './garden/phrases';
import { clamp01, smoothstep } from './model-core/canvasUtils';
import { useReducedMotion } from './model-core/useReducedMotion';

/** Deterministic pseudo-random in [0, 1) from a numeric seed. */
function rand01(seed: number) {
  const x = Math.sin(seed * 9999.9999) * 10000;
  return x - Math.floor(x);
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
  const rendererRef = useRef<ButterflyRenderer | null>(null);
  const swarmsRef = useRef<{ arrival: ArrivalSwarm; emergence: EmergenceSwarm } | null>(null);

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

      // (Re)build the offscreen layers and swarms whenever the canvas resizes.
      if (effCvs.width !== w || effCvs.height !== h) {
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

        const targets = generateStarfield(w, h);
        // The sampler centres its text, so a canvas twice as tall as the
        // desired centre offset places the phrase at `PHRASE.centerY`.
        const phraseCanvasH = Math.max(1, Math.round(h * PHRASE.centerY * 2));
        const phrasePoints = samplePhrase(phrase, w, phraseCanvasH);
        swarmsRef.current = {
          arrival: new ArrivalSwarm(targets, w, h),
          emergence: new EmergenceSwarm(COCOON_SLOTS, w, h, openSchedule, phrasePoints),
        };
      }

      const swarms = swarmsRef.current;
      const ctx = effCvs.getContext('2d');
      if (!swarms || !ctx) return;

      ctx.clearRect(0, 0, w, h);

      // --- Stars the arrivals dissolve into (no figure, just a scatter) ---
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const target of swarms.arrival.targets) {
        const starP = swarms.arrival.starP.get(target.id);
        if (starP === undefined || p < starP) continue;
        const appear = smoothstep(starP, starP + 0.02, p);
        const twinkle = 0.78 + 0.22 * Math.sin(time * 2.1 + target.id * 1.7);
        const alpha = appear * (target.isProminent ? 1 : 0.8) * twinkle;
        const tinted = rand01(target.id * 1.37) < STARFIELD.tintChance;
        const color = tinted ? palette.starTint : '#ffffff';
        const radius = (target.isProminent ? 2 : 1.1) * (0.5 + 0.5 * appear);

        ctx.shadowBlur = target.isProminent ? 8 : 4;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(target.x, target.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // --- Phrase (accent-coloured), traced by the emergence butterflies ---
      const writeAlpha = smoothstep(0.6, 0.98, p);
      if (writeAlpha > 0.001) {
        ctx.save();
        ctx.font = `bold ${PHRASE.fontPx}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = writeAlpha * 0.85;
        ctx.fillStyle = palette.glow;
        ctx.shadowBlur = 18;
        ctx.shadowColor = palette.glow;
        ctx.fillText(phrase, w / 2, h * PHRASE.centerY);
        ctx.restore();
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const b of swarms.emergence.butterflies) {
        if (p < b.writeStart || b.phrasePoints.length === 0) continue;
        const localT = swarms.emergence.getSliceProgress(b, p);
        const drawn = localT * b.phrasePoints.length;
        const upto = Math.min(b.phrasePoints.length, Math.ceil(drawn));
        for (let k = 0; k < upto; k++) {
          const pt = b.phrasePoints[k];
          const a = clamp01(drawn - k);
          if (a <= 0.01) continue;
          ctx.globalAlpha = a * 0.95;
          ctx.fillStyle = palette.core;
          ctx.shadowBlur = 6;
          ctx.shadowColor = palette.glow;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 1.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

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
        for (const rig of swarms.emergence.getRenderData(p, time)) renderer.draw(ctx, rig);
      }
    },
    [phrase, openSchedule, palette],
  );

  // Continuous render loop: eases the displayed progress towards the live
  // value (so 1 Hz timer ticks look smooth) while always finishing exactly on
  // the target. Dev seeking / reduced motion snap instantly.
  useEffect(() => {
    rendererRef.current = new ButterflyRenderer(palette.hue);
    swarmsRef.current = null;
    let frame = 0;
    let last = performance.now();
    let displayed = targetPRef.current;

    const loop = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const target = targetPRef.current;
      if (Math.abs(target - displayed) > 0.02) {
        displayed = target;
      } else {
        displayed += (target - displayed) * (1 - Math.exp(-dt * 10));
      }
      renderCanvasFrame(displayed, now / 1000);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [palette.hue, renderCanvasFrame]);

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
              <img src={ASSETS.cocoon} alt="" className="absolute inset-0 h-full w-full object-contain" />
              <img
                src={ASSETS.cocoon}
                alt=""
                className="absolute inset-0 h-full w-full object-contain"
                style={{
                  filter: `drop-shadow(0 0 ${COCOON.glowRadius}px ${palette.glow})`,
                  mixBlendMode: 'screen',
                  opacity: targetGlow,
                  animation: running ? `garden-breathe ${period}s ease-in-out infinite alternate` : 'none',
                  animationDelay: `-${COCOON_PHASES[i]}s`,
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
