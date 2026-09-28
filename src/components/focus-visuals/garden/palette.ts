import { PALETTE, GARDEN_BAG_KEY, type SessionPalette } from './config';
import { SESSION_PALETTE_KEY } from '@/lib/localSession';

interface BagState {
  remaining: string[];
  last: string | null;
}

function readBag(): BagState {
  try {
    const raw = localStorage.getItem(GARDEN_BAG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BagState;
      if (Array.isArray(parsed.remaining) && typeof parsed.last === 'string') return parsed;
      if (Array.isArray(parsed.remaining)) return { remaining: parsed.remaining, last: null };
    }
  } catch {
    /* ignore malformed bag */
  }
  return { remaining: [], last: null };
}

function writeBag(state: BagState) {
  try {
    localStorage.setItem(GARDEN_BAG_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — bag simply restarts */
  }
}

export function paletteById(id: string | null | undefined): SessionPalette | null {
  if (!id) return null;
  return PALETTE.find((p) => p.id === id) ?? null;
}

/**
 * Shuffle-bag pick: never repeats until every palette has been used, and never
 * returns the same palette twice in a row.
 */
export function pickPalette(): SessionPalette {
  const bag = readBag();
  let remaining = bag.remaining.filter((id) => PALETTE.some((p) => p.id === id));
  if (remaining.length === 0) {
    remaining = PALETTE.map((p) => p.id);
  }
  const pool = remaining.length > 1 ? remaining.filter((id) => id !== bag.last) : remaining;
  const chosenId = pool[Math.floor(Math.random() * pool.length)];
  writeBag({
    remaining: remaining.filter((id) => id !== chosenId),
    last: chosenId,
  });
  return paletteById(chosenId) ?? PALETTE[0];
}

/** Resolve the palette for a session, reusing the persisted one when present. */
export function resolveSessionPalette(forcedId?: string | null): SessionPalette {
  const forced = paletteById(forcedId);
  if (forced) return forced;
  const stored = paletteById(sessionStorage.getItem(SESSION_PALETTE_KEY));
  if (stored) return stored;
  const picked = pickPalette();
  try {
    sessionStorage.setItem(SESSION_PALETTE_KEY, picked.id);
  } catch {
    /* ignore */
  }
  return picked;
}
