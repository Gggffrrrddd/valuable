/**
 * Browser-back unwinding for in-app layers (screens, drawers, modals).
 *
 * Problem: navigation lives in React state, so the browser has a single
 * history entry for the whole app — one back press dumps the user out.
 * Expected: layers peel off one by one, reverse order, and only the final
 * back (with nothing open) exits the app.
 *
 * Mechanism: a single guard history entry exists while ANY layer is open.
 * - Opening the first layer pushes the guard; deeper layers stack in memory.
 * - Browser-back pops the guard: we close the top layer and, if layers
 *   remain, re-arm a fresh guard.
 * - UI-driven close just drops the memory entry; if the stack empties we
 *   consume the guard with history.back() (its popstate arrives tagged with
 *   the old sequence and is ignored — no double-close, no loop).
 * - Guards carry a sequence number, so a stale guard pop (e.g. close +
 *   immediate re-open in the same tick) can never close the wrong layer.
 */

interface Layer {
  id: string;
  close: () => void;
}

let layers: Layer[] = [];
let seq = 0;
let installed = false;

function onPopState(e: PopStateEvent): void {
  const v = (e.state as { vback?: unknown } | null)?.vback;
  if (typeof v !== 'number' || v !== seq || layers.length === 0) {
    // Stale guard, foreign entry, or nothing open. If the browser really went
    // somewhere else, drop any phantom layers.
    if (typeof v !== 'number') layers = [];
    return;
  }
  const top = layers.pop();
  if (top) {
    try {
      top.close();
    } catch {
      /* a failing closer must never break back navigation */
    }
  }
  if (layers.length > 0) {
    seq += 1;
    try {
      history.pushState({ vback: seq }, '');
    } catch {
      /* history unavailable */
    }
  }
}

function ensureInstalled(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('popstate', onPopState);
}

/**
 * Open a layer. Returns a cleanup that closes it (use directly as an effect
 * return). Same id re-pushes (moves to top) instead of duplicating.
 */
export function pushLayer(id: string, close: () => void): () => void {
  ensureInstalled();
  layers = layers.filter((l) => l.id !== id);
  const wasEmpty = layers.length === 0;
  layers.push({ id, close });
  if (wasEmpty) {
    seq += 1;
    try {
      history.pushState({ vback: seq }, '');
    } catch {
      /* history unavailable */
    }
  }
  return () => removeLayer(id);
}

/** UI-driven close: drop the memory entry; consume the guard if stack empties. */
export function removeLayer(id: string): void {
  const had = layers.some((l) => l.id === id);
  if (!had) return;
  layers = layers.filter((l) => l.id !== id);
  if (layers.length === 0) {
    try {
      history.back();
    } catch {
      /* history unavailable */
    }
  }
}
