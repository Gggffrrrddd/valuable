import { PARTICLE_POOL, PHRASE, GARDEN_PHRASE_BAG_KEY } from './config';
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
}

/** One character of the phrase, with the particle points that make it up. */
export interface PhraseGlyph {
  index: number;
  char: string;
  /** Centre of the glyph (where its butterfly settles). */
  x: number;
  y: number;
  points: PhraseGlyphPoint[];
}

export interface PhraseLayout {
  glyphs: PhraseGlyph[];
  fontPx: number;
  lines: string[];
}

const LINE_HEIGHT = 1.28;
const PAD = 3;

function fontFor(px: number) {
  return `bold ${px}px Georgia, 'Times New Roman', serif`;
}

function wrapLines(ctx: CanvasRenderingContext2D, words: string[], maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Pixel points for a single character, positioned in canvas space. */
function rasterizeGlyph(
  measure: CanvasRenderingContext2D,
  scratch: CanvasRenderingContext2D,
  char: string,
  leftX: number,
  midY: number,
  fontPx: number,
): PhraseGlyphPoint[] {
  const w = Math.ceil(measure.measureText(char).width) + PAD * 2;
  const h = Math.ceil(fontPx * 1.7);
  if (scratch.canvas.width !== w || scratch.canvas.height !== h) {
    scratch.canvas.width = w;
    scratch.canvas.height = h;
  }
  scratch.clearRect(0, 0, w, h);
  scratch.font = fontFor(fontPx);
  scratch.textAlign = 'left';
  scratch.textBaseline = 'middle';
  scratch.fillStyle = '#ffffff';
  scratch.fillText(char, PAD, h / 2);

  let data: Uint8ClampedArray;
  try {
    data = scratch.getImageData(0, 0, w, h).data;
  } catch {
    return [];
  }

  const points: PhraseGlyphPoint[] = [];
  // Step 2px horizontally, 3px vertically — dense enough to read the letter,
  // sparse enough that 30 butterflies can visibly trace it.
  for (let y = 0; y < h; y += 3) {
    for (let x = 0; x < w; x += 2) {
      if (data[(y * w + x) * 4 + 3] > 110) {
        points.push({ x: leftX + x - PAD, y: midY + y - h / 2 });
      }
    }
  }
  return points;
}

/**
 * Lay the phrase out starting at the tuned first-letter position (PHRASE
 * config, set with the PhraseTuner): fixed font size, left-aligned flow from
 * the tuned X, first line centred on the tuned Y. Points are tagged with the
 * glyph they belong to, in reading order, so butterflies can write the phrase
 * one letter at a time.
 */
export function layoutPhrase(phrase: string, width: number, height: number): PhraseLayout {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { glyphs: [], fontPx: 0, lines: [] };

  const words = phrase.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { glyphs: [], fontPx: 0, lines: [] };

  // Tuned font size: fraction of the viewport height (same unit the tuner shows).
  const fontPx = Math.max(16, Math.round(PHRASE.fontVh * height));
  ctx.font = fontFor(fontPx);

  // Wrap width runs from the tuned start point to the right-hand limit
  // (the timer area stays clear of the text).
  const startX = width * PHRASE.centerX;
  const maxWidth = Math.max(1, width * PHRASE.rightLimit - startX);
  const lines = wrapLines(ctx, words, maxWidth);
  const lineH = fontPx * LINE_HEIGHT;

  // First line is centred vertically on the tuned Y; extra lines grow down.
  const blockTop = height * PHRASE.centerY - lineH / 2;

  // The phrase starts at the tuned letter: its centre sits on centerX.
  const originX = startX - ctx.measureText(words[0].charAt(0)).width / 2;

  const scratchCanvas = document.createElement('canvas');
  const scratch = scratchCanvas.getContext('2d');
  const glyphs: PhraseGlyph[] = [];
  if (!scratch) return { glyphs, fontPx, lines };

  let glyphIndex = 0;
  lines.forEach((line, li) => {
    const midY = blockTop + li * lineH + lineH / 2;
    let cursor = originX;
    const tokens = line.split(' ');

    tokens.forEach((token, ti) => {
      if (ti > 0) cursor += ctx.measureText(' ').width;
      for (const char of token) {
        const charWidth = ctx.measureText(char).width;
        const points = rasterizeGlyph(ctx, scratch, char, cursor, midY, fontPx);
        if (points.length > 0) {
          glyphs.push({
            index: glyphIndex++,
            char,
            x: cursor + charWidth / 2,
            y: midY,
            points,
          });
        }
        cursor += charWidth;
      }
    });
  });

  // Global cap on total particles, applied evenly and preserving write order.
  const total = glyphs.reduce((sum, g) => sum + g.points.length, 0);
  if (total > PARTICLE_POOL) {
    const step = total / PARTICLE_POOL;
    let seen = 0;
    let next = 0;
    for (const glyph of glyphs) {
      const kept: PhraseGlyphPoint[] = [];
      for (const pt of glyph.points) {
        if (seen >= next) {
          kept.push(pt);
          next += step;
        }
        seen++;
      }
      glyph.points = kept;
    }
  }

  return { glyphs, fontPx, lines };
}

/**
 * Give every butterfly a slice of the phrase to write, in reading order.
 *
 * `orderedButterflyIds` must be sorted by the moment each butterfly starts
 * writing, so the phrase is traced left-to-right: the earliest butterfly
 * writes the first letter, the next the following letter, and so on. With
 * fewer letters than butterflies, several butterflies share one letter
 * (tracing it together); with more letters, one butterfly covers a run of
 * consecutive letters.
 */
export function allocateButterfliesToPhrase(
  orderedButterflyIds: number[],
  layout: PhraseLayout,
): Map<number, PhraseGlyphPoint[]> {
  const map = new Map<number, PhraseGlyphPoint[]>();
  const glyphs = layout.glyphs;
  const butterflyCount = orderedButterflyIds.length;
  if (glyphs.length === 0 || butterflyCount === 0) return map;

  const groups = Math.min(glyphs.length, butterflyCount);
  const glyphsPerGroup = Math.floor(glyphs.length / groups);
  const extraGlyphs = glyphs.length % groups;
  const butterfliesPerGroup = Math.floor(butterflyCount / groups);
  const extraButterflies = butterflyCount % groups;

  let glyphCursor = 0;
  let butterflyCursor = 0;
  for (let g = 0; g < groups; g++) {
    const takeGlyphs = glyphsPerGroup + (g < extraGlyphs ? 1 : 0);
    const points: PhraseGlyphPoint[] = [];
    for (let k = 0; k < takeGlyphs; k++) {
      const glyph = glyphs[glyphCursor + k];
      if (glyph) points.push(...glyph.points);
    }
    glyphCursor += takeGlyphs;
    // Stable order so a butterfly draws its letter as one continuous stroke.
    points.sort((a, b) => (a.x - b.x) || (a.y - b.y));

    const takeButterflies = butterfliesPerGroup + (g < extraButterflies ? 1 : 0);
    for (let k = 0; k < takeButterflies && butterflyCursor < butterflyCount; k++, butterflyCursor++) {
      map.set(orderedButterflyIds[butterflyCursor], points);
    }
  }

  return map;
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
