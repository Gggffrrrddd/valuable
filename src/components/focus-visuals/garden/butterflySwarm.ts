/**
 * Swarm behaviour, driven entirely by session progress (0..1) instead of a
 * wall-clock finale timeline. Every butterfly's position is a pure function of
 * progress, which keeps the whole animation seekable (dev tools), stable
 * across re-renders and identical between live playback and reduced motion.
 */
import { ARRIVAL, OPEN_WINDOW, RIG, VARIATION } from './config';
import { clamp01, smoothstep } from '../model-core/canvasUtils';
import type { StarTarget } from './constellation';
import type { ButterflyRig } from './butterflySprite';
import type { CocoonSlot } from './cocoonSlots';
import { allocateButterfliesToPhrase, type PhraseGlyphPoint } from './phrases';

/** Deterministic pseudo-random in [min, max) from an integer seed. */
function randRange(min: number, max: number, seed: number) {
  const x = Math.sin(seed * 9999.9999) * 10000;
  return min + (x - Math.floor(x)) * (max - min);
}

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export interface ArrivalButterfly {
  id: number;
  targetId: number;
  /** Progress at which this butterfly enters from a screen edge. */
  pStart: number;
  /** Progress at which it dissolves into its star. */
  pEnd: number;
  startX: number;
  startY: number;
  phaseOffset: number;
  flapHz: number;
  bank: number;
  scale: number;
  flipP: number;
  willFlip: boolean;
}

/**
 * Act A: one butterfly per constellation point, entering from the left/right
 * edges and dissolving into its star. Group order (outer -> wing ->
 * upperLower -> center) is preserved by mapping each group to its own
 * sub-range of progress 0..0.5.
 */
export class ArrivalSwarm {
  public butterflies: ArrivalButterfly[] = [];
  /** Progress at which each star target first becomes visible. */
  public starP = new Map<number, number>();

  constructor(public targets: StarTarget[], private width: number, private height: number) {
    const byGroup = new Map<StarTarget['group'], StarTarget[]>();
    for (const t of targets) {
      const list = byGroup.get(t.group) ?? [];
      list.push(t);
      byGroup.set(t.group, list);
    }

    (Object.keys(ARRIVAL.groups) as (keyof typeof ARRIVAL.groups)[]).forEach((group) => {
      const list = byGroup.get(group) ?? [];
      const [rangeStart, rangeEnd] = ARRIVAL.groups[group];
      const span = Math.max(0, rangeEnd - rangeStart - ARRIVAL.flightP);
      list.forEach((target, j) => {
        const count = Math.max(1, list.length);
        const base = rangeStart + (j / count) * span;
        const jitter = randRange(-0.008, 0.008, j + 1.7);
        const pStart = clamp01(base + jitter);
        const pEnd = Math.min(rangeEnd, pStart + ARRIVAL.flightP);
        const fromLeft = j % 2 === 0;
        const seed = target.id * 3.1;

        this.butterflies.push({
          id: this.butterflies.length,
          targetId: target.id,
          pStart,
          pEnd,
          startX: (fromLeft ? -0.06 : 1.06) * width,
          startY: randRange(ARRIVAL.entryTopY, ARRIVAL.entryBottomY, seed) * height,
          phaseOffset: randRange(0, Math.PI * 2, seed + 1.3),
          flapHz: RIG.flapHz * randRange(1 - RIG.flapVariance, 1 + RIG.flapVariance, seed + 2.6),
          bank: randRange(-RIG.bankDeg, RIG.bankDeg, seed + 3.9) * (Math.PI / 180),
          scale: randRange(1 - VARIATION.size, 1 + VARIATION.size, seed + 5.2) * RIG.minPx,
          flipP: randRange(pStart, pEnd, seed + 6.5),
          willFlip: randRange(0, 1, seed + 7.8) < RIG.flipChance,
        });

        const prev = this.starP.get(target.id);
        this.starP.set(target.id, prev === undefined ? pEnd : Math.min(prev, pEnd));
      });
    });
  }

  private target(targetId: number): StarTarget {
    return this.targets.find((t) => t.id === targetId) as StarTarget;
  }

  /** Position on the curved entry path at progress `p` (0..1 along the flight). */
  private posAt(b: ArrivalButterfly, t: number) {
    const target = this.target(b.targetId);
    const e = easeInOutCubic(clamp01(t));
    const wob = 1 - e;
    const x =
      b.startX + (target.x - b.startX) * e + Math.sin(b.phaseOffset + e * Math.PI * 2.2) * this.width * 0.05 * wob;
    const y =
      b.startY + (target.y - b.startY) * e + Math.cos(b.phaseOffset * 1.3 + e * Math.PI * 1.7) * this.height * 0.03 * wob;
    return { x, y };
  }

  getRenderData(p: number, time: number): ButterflyRig[] {
    const rigs: ButterflyRig[] = [];
    for (const b of this.butterflies) {
      if (p < b.pStart || p >= b.pEnd) continue;
      const t = clamp01((p - b.pStart) / (b.pEnd - b.pStart));
      const alpha = smoothstep(0, 0.12, t) * (1 - smoothstep(0.86, 1, t));
      if (alpha <= 0.001) continue;

      const here = this.posAt(b, t);
      const next = this.posAt(b, Math.min(1, t + 0.02));
      const heading = Math.atan2(next.y - here.y, next.x - here.x) + Math.PI / 2;
      const isFlipping = b.willFlip && p > b.flipP && p < b.flipP + 0.02;

      rigs.push({
        x: here.x,
        y: here.y,
        scale: b.scale / RIG.maxPx,
        alpha,
        heading,
        flapPhase: time * b.flapHz * Math.PI * 2 + b.phaseOffset,
        bank: b.bank,
        isFlipped: isFlipping,
        glowAlpha: 0.5 + 0.5 * Math.cos(time * b.flapHz * Math.PI * 2 + b.phaseOffset),
      });
    }
    return rigs;
  }
}

export interface EmergenceButterfly {
  id: number;
  /** Progress at which this cocoon opens. */
  tOpen: number;
  /** Progress at which the butterfly starts tracing its slice. */
  writeStart: number;
  startX: number;
  startY: number;
  phaseOffset: number;
  flapHz: number;
  bank: number;
  scale: number;
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
    phrasePoints: PhraseGlyphPoint[] = [],
  ) {
    const allocation = allocateButterfliesToPhrase(this.cocoons.length, phrasePoints);

    this.cocoons.forEach((c, i) => {
      const tOpen = openSchedule[i] ?? OPEN_WINDOW.start;
      const seed = i * 2.7;
      this.butterflies.push({
        id: i,
        tOpen,
        writeStart: tOpen + OPEN_WINDOW.popP + OPEN_WINDOW.flyP,
        startX: c.x * width,
        startY: c.y * height,
        phaseOffset: randRange(0, Math.PI * 2, seed),
        flapHz: RIG.flapHz * randRange(1 - RIG.flapVariance, 1 + RIG.flapVariance, seed + 1.1),
        bank: randRange(-RIG.bankDeg, RIG.bankDeg, seed + 2.2) * (Math.PI / 180),
        scale: randRange(1 - VARIATION.size, 1 + VARIATION.size, seed + 3.3) * RIG.maxPx,
        phrasePoints: allocation.get(i) ?? [],
      });
    });
  }

  /** How far along its own trace a butterfly is (0 before it starts writing). */
  getSliceProgress(b: EmergenceButterfly, p: number): number {
    if (p < b.writeStart) return 0;
    return clamp01((p - b.writeStart) / Math.max(0.0001, 1 - b.writeStart));
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
      const t = easeInOutCubic(clamp01((p - popEnd) / Math.max(0.0001, writeStart - popEnd)));
      const wob = 1 - t;
      return {
        x: b.startX + (first.x - b.startX) * t + Math.sin(b.phaseOffset + t * Math.PI * 1.6) * this.width * 0.03 * wob,
        y: b.startY + (first.y - b.startY) * t + Math.cos(b.phaseOffset + t * Math.PI * 1.2) * this.height * 0.02 * wob,
      };
    }

    // Trace the slice: walk its (x-sorted) points.
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
      if (p < b.tOpen || p >= 1) continue;

      const popEnd = b.tOpen + OPEN_WINDOW.popP;
      const popT = clamp01((p - b.tOpen) / OPEN_WINDOW.popP);
      const scale = (b.scale / RIG.maxPx) * (p < popEnd ? 0.2 + 0.8 * smoothstep(0, 1, popT) : 1);
      const here = this.posAt(b, p);
      const next = this.posAt(b, Math.min(1, p + 0.004));
      const heading = Math.atan2(next.y - here.y, next.x - here.x) + Math.PI / 2;
      const alpha = smoothstep(b.tOpen, b.tOpen + OPEN_WINDOW.popP, p);

      rigs.push({
        x: here.x,
        y: here.y,
        scale,
        alpha,
        heading,
        flapPhase: time * b.flapHz * Math.PI * 2 + b.phaseOffset,
        bank: b.bank,
        isFlipped: false,
        glowAlpha: 0.8,
      });
    }
    return rigs;
  }
}
