import { PARTICLE_POOL, GARDEN_PHRASE_BAG_KEY } from './config';
import { SESSION_PHRASE_KEY } from '@/lib/localSession';

export const PHRASE_POOL = [
  "Stay motivated", "Be strong", "Let's go up", "Stay focused", "Keep going",
  "Rise higher", "One more step", "Trust the process", "You've got this",
  "Never give up", "Small steps count", "Progress over perfection",
  "Focus, grow, fly", "Wings take time", "Bloom with effort",
  "Believe in yourself", "Dream, work, win", "Discipline wins",
  "Consistency is magic", "Emerge stronger", "Patience becomes wings",
  "Fly higher", "Almost there", "Keep shining", "Your time comes",
  "Earn your wings", "Hard work shines", "Keep believing",
  "Day by day", "Make it count"
];

export interface PhraseGlyphPoint {
  x: number;
  y: number;
  glyphIndex: number;
}

export function samplePhrase(phrase: string, width: number, height: number): PhraseGlyphPoint[] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  // Font setup matching "STAY FOCUSED" from circle-table
  ctx.font = 'bold 48px serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Render phrase (simplified, without multi-line logic for now)
  ctx.fillText(phrase, width / 2, height / 2);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  
  const points: PhraseGlyphPoint[] = [];
  
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] > 128) {
        // Estimate glyph index roughly by x position
        // This is a simplified fallback if actual per-glyph rendering isn't done.
        const glyphIndex = Math.floor((x / width) * phrase.length);
        points.push({ x, y, glyphIndex });
      }
    }
  }

  // Subsample to PARTICLE_POOL
  if (points.length > PARTICLE_POOL) {
    const step = points.length / PARTICLE_POOL;
    const sampled = [];
    for (let i = 0; i < PARTICLE_POOL; i++) {
      sampled.push(points[Math.floor(i * step)]);
    }
    return sampled;
  }
  
  return points;
}

export function allocateButterfliesToPhrase(
  butterflyCount: number, 
  points: PhraseGlyphPoint[]
): Map<number, PhraseGlyphPoint[]> {
  // Simplified allocation: map butterflies evenly across x-coordinates
  const sortedPoints = [...points].sort((a, b) => a.x - b.x);
  
  const allocation = new Map<number, PhraseGlyphPoint[]>();
  for (let i = 0; i < butterflyCount; i++) {
    allocation.set(i, []);
  }

  const chunk = sortedPoints.length / butterflyCount;
  sortedPoints.forEach((p, idx) => {
    const bId = Math.min(butterflyCount - 1, Math.floor(idx / chunk));
    allocation.get(bId)?.push(p);
  });
  
  return allocation;
}

interface PhraseBagState {
  remaining: string[];
  last: string | null;
}

function readPhraseBag(): PhraseBagState {
  try {
    const raw = localStorage.getItem(GARDEN_PHRASE_BAG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PhraseBagState;
      if (Array.isArray(parsed.remaining) && typeof parsed.last === 'string') return parsed;
      if (Array.isArray(parsed.remaining)) return { remaining: parsed.remaining, last: null };
    }
  } catch {
    /* ignore malformed bag */
  }
  return { remaining: [], last: null };
}

function writePhraseBag(state: PhraseBagState) {
  try {
    localStorage.setItem(GARDEN_PHRASE_BAG_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — bag simply restarts */
  }
}

/**
 * Shuffle-bag pick: never repeats until every phrase has been used, and never
 * returns the same phrase twice in a row.
 */
export function pickPhrase(): string {
  const bag = readPhraseBag();
  let remaining = bag.remaining.filter((p) => PHRASE_POOL.includes(p));
  if (remaining.length === 0) {
    remaining = [...PHRASE_POOL];
  }
  const pool = remaining.length > 1 ? remaining.filter((p) => p !== bag.last) : remaining;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  writePhraseBag({
    remaining: remaining.filter((p) => p !== chosen),
    last: chosen,
  });
  return chosen;
}

/** Resolve the phrase for a session; `forced` accepts a pool index or exact phrase text (dev tools). */
export function resolveSessionPhrase(forced?: string | null): string {
  if (forced) {
    const asIndex = Number(forced);
    if (Number.isInteger(asIndex) && asIndex >= 0 && asIndex < PHRASE_POOL.length) {
      return PHRASE_POOL[asIndex];
    }
    if (PHRASE_POOL.includes(forced)) return forced;
  }
  const stored = sessionStorage.getItem(SESSION_PHRASE_KEY);
  if (stored && PHRASE_POOL.includes(stored)) return stored;
  const picked = pickPhrase();
  try {
    sessionStorage.setItem(SESSION_PHRASE_KEY, picked);
  } catch {
    /* ignore */
  }
  return picked;
}
