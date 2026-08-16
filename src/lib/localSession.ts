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
