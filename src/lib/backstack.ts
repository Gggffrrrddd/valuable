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
 * - Browser-back consumes the guard: popstate arrives, we close the top
 *   layer and, if layers remain, re-arm a fresh guard.
 * - UI-driven close just drops the memory entry; if the stack empties we
 *   consume the guard ourselves with history.back().
 *
 * Correctness notes (learned the hard way):
 * - popstate's event.state is the entry ARRIVED AT (base/null), never the
 *   consumed guard — so guards are deliberately unidentifiable; ANY popstate
 *   while layers are open means "unwind one".
 * - Our own history.back() calls are counted (selfPops) so their popstate
 *   can never close a freshly opened layer — ordering is deterministic
 *   because popstate tasks arrive in call order.
 */

interface Layer {
  id: string;
  close: () => void;
}

let layers: Layer[] = [];
/** Popstate events caused by our own guard-consuming history.back(). */
let selfPops = 0;
let installed = false;

function onPopState(): void {
  if (selfPops > 0) {
    // Our own UI-close consumption arriving late — never touches layers.
    selfPops -= 1;
    return;
  }
  if (layers.length === 0) return; // stale guard pop or real nav: stay put
  const top = layers.pop();
  if (top) {
    try {
      top.close();
    } catch {
      /* a failing closer must never break back navigation */
    }
  }
  if (layers.length > 0) {
    try {
      history.pushState({ vback: 1 }, '');
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
    try {
      history.pushState({ vback: 1 }, '');
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
    selfPops += 1;
    try {
      history.back();
    } catch {
      selfPops = Math.max(0, selfPops - 1);
    }
  }
}
