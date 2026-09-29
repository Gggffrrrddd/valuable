/**
 * Swarm behaviour, driven entirely by session progress (0..1) instead of a
 * wall-clock finale timeline. Every butterfly's position is a pure function of
 * progress, which keeps the whole animation seekable (dev tools), stable
 * across re-renders and identical between live playback and reduced motion.
 */
import { ARRIVAL, OPEN_WINDOW, RIG } from './config';
import { clamp01, smoothstep } from '../model-core/canvasUtils';
import type { StarTarget } from './starfield';
import type { ButterflyRig } from './animatedButterfly';
import type { CocoonSlot } from './cocoonSlots';
import { allocateButterfliesToPhrase, type PhraseGlyphPoint, type PhraseLayout } from './phrases';

/** Deterministic pseudo-random in [min, max) from an integer seed. */
function randRange(min: number, max: number, seed: number) {
  const x = Math.sin(seed * 9999.9999) * 10000;
  return min + (x - Math.floor(x)) * (max - min);
}

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Converts a linear progress-of-flight `t` (0..1) into an eased, *continuous*
 * path parameter. The velocity is never zero: it accelerates away from the
 * start, eases through the middle and smoothly accelerates again into the
 * target, so butterflies flow instead of stopping and starting.
 */
function flightParam(t: number): number {
  const c = clamp01(t);
  // Blend a smooth ease with a gentle mid-flight surge, then renormalise so it
  // still starts at 0 and ends at 1.
  const surge = Math.sin(c * Math.PI) * RIG.surgeAmount;
  return clamp01(easeInOutCubic(c) * (1 - RIG.surgeAmount * 0.5) + surge * (0.5 + 0.5 * easeInOutCubic(c)));
}

/** Wingbeat phase that always advances, regardless of flight state. */
function flapPhase(time: number, hz: number, offset: number) {
  return time * hz * Math.PI * 2 + offset;
}

export interface ArrivalButterfly {
  id: number;
  targetId: number;
  /** Progress at which this butterfly enters from a screen edge. */
  pStart: number;
  /** Progress at which it reaches its star target and becomes a star. */
  pEnd: number;
  /** Progress at which its body has fully faded into the star. */
  pFade: number;
  startX: number;
  startY: number;
  phaseOffset: number;
  flapHz: number;
  bank: number;
  /** Nominal on-screen width, in px. */
  px: number;
  flipP: number;
  willFlip: boolean;
  /** Star target position (cached for the settle/convert phase). */
  targetX: number;
  targetY: number;
}

/**
 * Act A: one small butterfly per scattered star. They trickle in from the
 * left/right edges continuously across progress 0..0.5 and dissolve into their
 * star at the target point. There is no constellation figure — the stars are a
 * natural scatter.
 */
export class ArrivalSwarm {
  public butterflies: ArrivalButterfly[] = [];
  /** Progress at which each star target first becomes visible. */
  public starP = new Map<number, number>();

  constructor(public targets: StarTarget[], private width: number, private height: number) {
    const count = Math.max(1, targets.length);
    const span = Math.max(0.05, ARRIVAL.end - ARRIVAL.start);
    // Shuffle-free even spread with jitter, so entry order is stable but not
    // mechanically left-to-right.
    targets.forEach((target, i) => {
      const base = ARRIVAL.start + ((i + 0.5) / count) * span;
      const jitter = randRange(-0.012, 0.012, i + 1.7);
      const pStart = clamp01(base + jitter);
      const pEnd = Math.min(ARRIVAL.end, pStart + ARRIVAL.flightP);
      const pFade = Math.min(ARRIVAL.end + 0.02, pEnd + ARRIVAL.convertP);
      const fromLeft = i % 2 === 0;
      const seed = target.id * 3.1 + i * 0.37;

      this.butterflies.push({
        id: this.butterflies.length,
        targetId: target.id,
        pStart,
        pEnd,
        pFade,
        startX: (fromLeft ? -0.06 : 1.06) * width,
        startY: randRange(ARRIVAL.entryTopY, ARRIVAL.entryBottomY, seed) * height,
        phaseOffset: randRange(0, Math.PI * 2, seed + 1.3),
        flapHz: RIG.flapHz * randRange(1 - RIG.flapVariance, 1 + RIG.flapVariance, seed + 2.6),
        bank: randRange(-RIG.bankDeg, RIG.bankDeg, seed + 3.9) * (Math.PI / 180),
        px: randRange(ARRIVAL.minPx, ARRIVAL.maxPx, seed + 5.2),
        flipP: randRange(pStart, pEnd, seed + 6.5),
        willFlip: randRange(0, 1, seed + 7.8) < RIG.flipChance,
        targetX: target.x,
        targetY: target.y,
      });

      const prev = this.starP.get(target.id);
      this.starP.set(target.id, prev === undefined ? pEnd : Math.min(prev, pEnd));
    });
  }

  /** Position on the curved entry path at progress `t` (0..1 along the flight). */
  private posAt(b: ArrivalButterfly, t: number) {
    const e = flightParam(t);
    const wob = 1 - e;
    const x =
      b.startX + (b.targetX - b.startX) * e + Math.sin(b.phaseOffset + e * Math.PI * 2.2) * this.width * 0.04 * wob;
    const y =
      b.startY + (b.targetY - b.startY) * e + Math.cos(b.phaseOffset * 1.3 + e * Math.PI * 1.7) * this.height * 0.025 * wob;
    return { x, y };
  }

  getRenderData(p: number, time: number): ButterflyRig[] {
    const rigs: ButterflyRig[] = [];
    for (const b of this.butterflies) {
      // The butterfly keeps flying right up to its target, then the body fades
      // into the star it becomes — it never simply vanishes mid-flight.
      if (p < b.pStart || p >= b.pFade) continue;
      const t = clamp01((p - b.pStart) / Math.max(0.0001, b.pEnd - b.pStart));
      const convert = smoothstep(b.pEnd, b.pFade, p);
      const alpha = smoothstep(0, 0.12, t) * (1 - 0.85 * convert);
      if (alpha <= 0.001) continue;

      const here = t >= 1 ? { x: b.targetX, y: b.targetY } : this.posAt(b, t);
      const next = this.posAt(b, Math.min(1, t + 0.02));
      const heading = Math.atan2(next.y - here.y, next.x - here.x) + Math.PI / 2;
      const isFlipping = b.willFlip && p > b.flipP && p < b.flipP + 0.02;

      rigs.push({
        x: here.x,
        y: here.y,
        px: b.px * (1 - 0.55 * convert),
        alpha,
        heading,
        flapPhase: flapPhase(time, b.flapHz, b.phaseOffset),
        bank: b.bank,
        isFlipped: isFlipping,
        glowAlpha: 0.5 + 0.5 * Math.cos(flapPhase(time, b.flapHz, b.phaseOffset)),
      });
    }
    return rigs;
  }

  /** A bright pulse that plays as a butterfly lands and becomes its star. */
  getStarPulse(target: StarTarget, p: number): number {
    const startP = this.starP.get(target.id);
    if (startP === undefined) return 0;
    return 1 - clamp01((p - startP) / ARRIVAL.pulseP);
  }
}

export interface EmergenceButterfly {
  id: number;
  /** Progress at which this cocoon opens. */
  tOpen: number;
  /** Progress at which the butterfly starts tracing its slice. */
  writeStart: number;
  /** Progress at which the trace finishes and it settles on its letter. */
  writeEnd: number;
  startX: number;
  startY: number;
  phaseOffset: number;
  flapHz: number;
  bank: number;
  /** Nominal on-screen width, in px. */
  px: number;
  phrasePoints: PhraseGlyphPoint[];
}

const OPEN_SCHEDULE_KEY = 'valuable-garden-open-schedule';

/**
 * A shuffled opening schedule for every cocoon, spread evenly across the open
 * window and persisted for the session so it is stable across re-renders and
 * remounts.
 */
export function createOpenSchedule(count: number): number[] {
  try {
    const raw = sessionStorage.getItem(OPEN_SCHEDULE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as number[];
      if (Array.isArray(parsed) && parsed.length === count && parsed.every((n) => typeof n === 'number')) {
        return parsed;
      }
    }
  } catch {
    /* fall through and regenerate */
  }

  const { start, end } = OPEN_WINDOW;
  const values = Array.from({ length: count }, (_, i) => start + ((i + 0.5) / count) * (end - start));
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }

  try {
    sessionStorage.setItem(OPEN_SCHEDULE_KEY, JSON.stringify(values));
  } catch {
    /* ignore */
  }
  return values;
}

/**
 * Act B: every cocoon releases one butterfly which flies to its allocated
 * slice of the phrase and traces it. All traces complete exactly at p = 1.
 */
export class EmergenceSwarm {
  public butterflies: EmergenceButterfly[] = [];

  constructor(
    private cocoons: CocoonSlot[],
    private width: number,
    private height: number,
    openSchedule: number[],
    layout: PhraseLayout,
  ) {
    // Write in reading order: the butterfly that starts writing first takes the
    // first letter, the next the following letter, and so on.
    const orderedIds = this.cocoons
      .map((_, i) => i)
      .sort((a, b) => (openSchedule[a] ?? OPEN_WINDOW.start) - (openSchedule[b] ?? OPEN_WINDOW.start));
    const allocation = allocateButterfliesToPhrase(orderedIds, layout);

    this.cocoons.forEach((c, i) => {
      const tOpen = openSchedule[i] ?? OPEN_WINDOW.start;
      const writeStart = tOpen + OPEN_WINDOW.popP + OPEN_WINDOW.flyP;
      const writeEnd = Math.min(1, writeStart + OPEN_WINDOW.settleP);
      const seed = i * 2.7;
      this.butterflies.push({
        id: i,
        tOpen,
        writeStart,
        writeEnd,
        startX: c.x * width,
        startY: c.y * height,
        phaseOffset: randRange(0, Math.PI * 2, seed),
        flapHz: RIG.flapHz * randRange(1 - RIG.flapVariance, 1 + RIG.flapVariance, seed + 1.1),
        bank: randRange(-RIG.bankDeg, RIG.bankDeg, seed + 2.2) * (Math.PI / 180),
        px: randRange(RIG.minPx * 1.15, RIG.maxPx, seed + 3.3),
        phrasePoints: allocation.get(i) ?? [],
      });
    });
  }

  /** How far along its own trace a butterfly is (0 before it starts writing). */
  getSliceProgress(b: EmergenceButterfly, p: number): number {
    if (p < b.writeStart) return 0;
    return clamp01((p - b.writeStart) / Math.max(0.0001, b.writeEnd - b.writeStart));
  }

  private posAt(b: EmergenceButterfly, p: number) {
    const popEnd = b.tOpen + OPEN_WINDOW.popP;
    const writeStart = b.writeStart;

    if (p < popEnd) {
      // Emerging at the slot (scale handled separately).
      return { x: b.startX, y: b.startY };
    }

    const slice = b.phrasePoints;
    const first = slice[0];
    if (!first) return { x: b.startX, y: b.startY };

    if (p < writeStart) {
      // Fly from the slot to the first point of the slice.
      const t = flightParam((p - popEnd) / Math.max(0.0001, writeStart - popEnd));
      const wob = 1 - t;
      return {
        x: b.startX + (first.x - b.startX) * t + Math.sin(b.phaseOffset + t * Math.PI * 1.6) * this.width * 0.025 * wob,
        y: b.startY + (first.y - b.startY) * t + Math.cos(b.phaseOffset + t * Math.PI * 1.2) * this.height * 0.018 * wob,
      };
    }

    // Trace the slice, then settle on its final point (the butterfly stays).
    const localT = this.getSliceProgress(b, p);
    const last = slice.length - 1;
    const pos = localT * last;
    const idx = Math.min(last, Math.floor(pos));
    const frac = pos - idx;
    const a = slice[idx];
    const c = slice[Math.min(last, idx + 1)];
    return { x: a.x + (c.x - a.x) * frac, y: a.y + (c.y - a.y) * frac };
  }

  getRenderData(p: number, time: number): ButterflyRig[] {
    const rigs: ButterflyRig[] = [];
    for (const b of this.butterflies) {
      if (p < b.tOpen) continue;

      const popEnd = b.tOpen + OPEN_WINDOW.popP;
      const popT = clamp01((p - b.tOpen) / OPEN_WINDOW.popP);
      const grow = p < popEnd ? 0.2 + 0.8 * smoothstep(0, 1, popT) : 1;
      const here = this.posAt(b, p);
      const next = this.posAt(b, Math.min(1, p + 0.004));
      const heading = Math.atan2(next.y - here.y, next.x - here.x) + Math.PI / 2;
      const alpha = smoothstep(b.tOpen, b.tOpen + OPEN_WINDOW.popP, p);

      rigs.push({
        x: here.x,
        y: here.y,
        px: b.px * grow,
        alpha,
        heading,
        flapPhase: flapPhase(time, b.flapHz, b.phaseOffset),
        bank: b.bank,
        isFlipped: false,
        glowAlpha: 0.8,
      });
    }
    return rigs;
  }
}
