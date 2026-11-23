/*
 * Shared read-only view of the focus session that FocusTimer persists in
 * sessionStorage. The study table's own seat (seat 1) reflects this state
 * directly instead of going through presence polling.
 *
 * The keys below are the storage contract with FocusTimer — keep values in sync
 * (FocusTimer imports them from here).
 */

export const SESSION_START_KEY = 'valuable-session-start';
export const SESSION_DURATION_KEY = 'valuable-session-duration';
export const SESSION_PAUSED_AT_KEY = 'valuable-session-paused-at';
export const SESSION_PAUSED_TOTAL_KEY = 'valuable-session-paused-total';
export const SESSION_SUBJECT_KEY = 'valuable-session-subject';
export const SESSION_BREAK_KEY = 'valuable-session-break';
/** Garden finale choices, persisted so a mid-session refresh keeps them. */
export const SESSION_PALETTE_KEY = 'valuable-session-palette';
export const SESSION_PHRASE_KEY = 'valuable-session-phrase';

export type LocalFocusState = 'idle' | 'focusing' | 'paused';

export interface LocalFocusSnapshot {
  state: LocalFocusState;
  /** ISO timestamp of the running/paused session's start, when one exists. */
  sessionStartedAt: string | null;
}

export function readLocalFocusState(): LocalFocusState {
  const startRaw = sessionStorage.getItem(SESSION_START_KEY);
  if (!startRaw) return 'idle';
  const pausedAtRaw = sessionStorage.getItem(SESSION_PAUSED_AT_KEY);
  if (pausedAtRaw) return 'paused';
  return 'focusing';
}

export function readLocalFocusSnapshot(): LocalFocusSnapshot {
  const state = readLocalFocusState();
  if (state === 'idle') return { state, sessionStartedAt: null };
  const startMs = Number(sessionStorage.getItem(SESSION_START_KEY));
  return {
    state,
    sessionStartedAt: Number.isFinite(startMs) && startMs > 0 ? new Date(startMs).toISOString() : null,
  };
}

/* --------------------------------------------------------------------------
   Cross-tab live focus marker.
   FocusTimer owns sessionStorage (per tab). This tiny localStorage mirror lets
   the Compete tab show live growth while a session runs in another tab.
   -------------------------------------------------------------------------- */
export const LIVE_FOCUS_KEY = 'valuable-live-focus';

export interface LiveFocusMarker {
  startMs: number;
  durationMs: number;
  pausedAtMs: number | null;
  pausedTotalMs: number;
}

/** Mirror the current sessionStorage timer state for other tabs. */
export function syncLiveFocus(): void {
  try {
    const startMs = Number(sessionStorage.getItem(SESSION_START_KEY));
    const durationMs = Number(sessionStorage.getItem(SESSION_DURATION_KEY) ?? 0) * 1000;
    if (!Number.isFinite(startMs) || startMs <= 0 || !Number.isFinite(durationMs) || durationMs <= 0) {
      localStorage.removeItem(LIVE_FOCUS_KEY);
      return;
    }
    const pausedAtRaw = sessionStorage.getItem(SESSION_PAUSED_AT_KEY);
    const marker: LiveFocusMarker = {
      startMs,
      durationMs,
      pausedAtMs: pausedAtRaw ? Number(pausedAtRaw) : null,
      pausedTotalMs: Number(sessionStorage.getItem(SESSION_PAUSED_TOTAL_KEY) ?? 0),
    };
    localStorage.setItem(LIVE_FOCUS_KEY, JSON.stringify(marker));
  } catch {
    /* storage can be unavailable in private mode */
  }
}

export function clearLiveFocus(): void {
  try {
    localStorage.removeItem(LIVE_FOCUS_KEY);
  } catch {
    /* non-fatal */
  }
}

/** Elapsed focus milliseconds for a live session, or 0 when none is running. */
export function readLiveFocusElapsedMs(now = Date.now()): number {
  try {
    const raw = localStorage.getItem(LIVE_FOCUS_KEY);
    if (!raw) return 0;
    const marker = JSON.parse(raw) as LiveFocusMarker;
    if (
      !Number.isFinite(marker.startMs) ||
      !Number.isFinite(marker.durationMs) ||
      marker.startMs <= 0 ||
      marker.durationMs <= 0
    ) {
      return 0;
    }
    // A session that crossed midnight should not leak into today's tree.
    if (new Date(marker.startMs).toDateString() !== new Date(now).toDateString()) return 0;
    const pausedNow = marker.pausedAtMs ? Math.max(0, now - marker.pausedAtMs) : 0;
    const elapsed = now - marker.startMs - marker.pausedTotalMs - pausedNow;
    return Math.max(0, Math.min(marker.durationMs, elapsed));
  } catch {
    return 0;
  }
}
