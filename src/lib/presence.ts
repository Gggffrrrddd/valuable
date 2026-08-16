/*
 * Pull-based presence for the study-circle table: each client heartbeats its own
 * row in `circle_presence` while the app is foregrounded, and the table screen
 * polls its friends' rows every few seconds. No realtime/WebSocket.
 *
 * Offline is never written — a stale last_seen_at simply ages out client-side.
 */

import { supabase } from './supabase';
import { readLocalFocusSnapshot, type LocalFocusSnapshot } from './localSession';

export type CirclePresenceStatus = 'offline' | 'online-idle' | 'focusing' | 'paused';

/** Fresh if seen within the last ~2 missed heartbeats. */
export const PRESENCE_ONLINE_WINDOW_MS = 45_000;
export const PRESENCE_HEARTBEAT_MS = 20_000;

interface PresenceRow {
  user_id: string;
  session_state: 'idle' | 'focusing' | 'paused';
  session_started_at: string | null;
  last_seen_at: string;
}

let warnedUnavailable = false;

function warnUnavailable(context: string, message: string) {
  if (warnedUnavailable) return;
  warnedUnavailable = true;
  console.warn(`circle_presence unavailable (${context}): ${message} — friends will show as offline until the migration runs.`);
}

/** Maps a presence row to a table status; anything older than the freshness window is offline. */
export function derivePresenceStatus(row: PresenceRow, nowMs: number = Date.now()): CirclePresenceStatus {
  const seenAt = Date.parse(row.last_seen_at);
  if (!Number.isFinite(seenAt) || nowMs - seenAt > PRESENCE_ONLINE_WINDOW_MS) return 'offline';
  if (row.session_state === 'focusing') return 'focusing';
  if (row.session_state === 'paused') return 'paused';
  return 'online-idle';
}

/**
 * Reads the current presence status for the given users. Returns {} (everyone
 * offline) when the table is missing or the read fails, so the table screen
 * still renders.
 */
export async function fetchCirclePresence(userIds: string[]): Promise<Record<string, CirclePresenceStatus>> {
  if (userIds.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from('circle_presence')
      .select('user_id, session_state, session_started_at, last_seen_at')
      .in('user_id', userIds);
    if (error) {
      warnUnavailable('fetch', error.message);
      return {};
    }
    const statuses: Record<string, CirclePresenceStatus> = {};
    for (const row of (data || []) as PresenceRow[]) {
      statuses[row.user_id] = derivePresenceStatus(row);
    }
    return statuses;
  } catch (e) {
    warnUnavailable('fetch', e instanceof Error ? e.message : String(e));
    return {};
  }
}

/** Upserts the caller's own presence row. Errors surface once, then stay quiet. */
export async function publishPresence(userId: string, snapshot: LocalFocusSnapshot): Promise<void> {
  try {
    const { error } = await supabase
      .from('circle_presence')
      .upsert(
        {
          user_id: userId,
          session_state: snapshot.state,
          session_started_at: snapshot.sessionStartedAt,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    if (error) warnUnavailable('heartbeat', error.message);
  } catch (e) {
    warnUnavailable('heartbeat', e instanceof Error ? e.message : String(e));
  }
}

/**
 * Heartbeats the user's presence while the app is foregrounded. Beats are
 * skipped entirely while the document is hidden; the first beat after
 * returning to the foreground is immediate.
 */
export function startPresenceHeartbeat(userId: string): () => void {
  const beat = () => {
    if (document.hidden) return;
    void publishPresence(userId, readLocalFocusSnapshot());
  };

  beat();
  const timer = setInterval(beat, PRESENCE_HEARTBEAT_MS);
  const onVisibility = () => {
    if (!document.hidden) beat();
  };
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
