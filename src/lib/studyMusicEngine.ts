import { STUDY_TRACKS, type TrackInfo } from '@/components/focus-visuals/model-core/studyMusicConfig';

/**
 * App-lifetime background-music engine (module singleton).
 *
 * Why this exists: the player UI lives inside the focus-session view, which
 * unmounts whenever the student peeks at the study table â€” but the focus
 * timer itself survives via sessionStorage wall-clock. Music must behave the
 * same way: this engine owns the Audio elements at module scope, so playback
 * continues across screen switches and only stops when the session ends
 * (pause / quit / complete), exactly like the timer rule.
 */

const FAVS_KEY = 'valuable-music-favs';
const LAST_ID_KEY = 'valuable-music-last';
const VOL_KEY = 'valuable-music-vol';
/** Own-track metas only (id + file name). Never audio bytes, never uploads. */
const OWN_KEY = 'valuable-music-own';
const OWN_DB = 'valuable-music';
const OWN_STORE = 'handles';
/** Brief limit: maximum 2 own tracks. */
export const MAX_OWN_TRACKS = 2;

export interface OwnTrack {
  id: string;
  /** Original file name (display only). */
  name: string;
  /** True when a persistable file handle is stored (survives restart). */
  persistent: boolean;
}

interface OwnMeta {
  id: string;
  name: string;
  persistent: boolean;
}

/** File System Access API handle (Chromium only) — everything guarded. */
type MaybeHandle = {
  getFile: () => Promise<File>;
  queryPermission?: (opts?: { mode?: string }) => Promise<string>;
  requestPermission?: (opts?: { mode?: string }) => Promise<string>;
  name?: string;
} | null;

function readOwnMetas(): OwnMeta[] {
  try {
    const raw = localStorage.getItem(OWN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is OwnMeta =>
          !!x && typeof x === 'object' && typeof (x as OwnMeta).id === 'string' && typeof (x as OwnMeta).name === 'string',
      )
      .slice(0, MAX_OWN_TRACKS)
      .map((x) => ({ id: x.id, name: x.name, persistent: x.persistent === true }));
  } catch {
    return [];
  }
}

function saveOwnMetas(list: OwnMeta[]): void {
  try {
    localStorage.setItem(OWN_KEY, JSON.stringify(list));
  } catch {
    /* persistence unavailable */
  }
}

function saveFavs(favs: string[]): void {
  try {
    localStorage.setItem(FAVS_KEY, JSON.stringify(favs));
  } catch {
    /* persistence unavailable */
  }
}

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(OWN_DB, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(OWN_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

async function idbPutHandle(id: string, handle: unknown): Promise<void> {
  const db = await idbOpen();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(OWN_STORE, 'readwrite');
      tx.objectStore(OWN_STORE).put(handle, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    try {
      db.close();
    } catch {
      /* ignore */
    }
  }
}

async function idbGetHandle(id: string): Promise<MaybeHandle> {
  try {
    const db = await idbOpen();
    try {
      const value: unknown = await new Promise((resolve, reject) => {
        const tx = db.transaction(OWN_STORE, 'readonly');
        const rq = tx.objectStore(OWN_STORE).get(id);
        rq.onsuccess = () => resolve(rq.result);
        rq.onerror = () => reject(rq.error);
      });
      if (value && typeof value === 'object' && typeof (value as MaybeHandle)?.getFile === 'function') {
        return value as MaybeHandle;
      }
      return null;
    } finally {
      try {
        db.close();
      } catch {
        /* ignore */
      }
    }
  } catch {
    return null;
  }
}

async function idbDeleteHandle(id: string): Promise<void> {
  try {
    const db = await idbOpen();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(OWN_STORE, 'readwrite');
        tx.objectStore(OWN_STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      try {
        db.close();
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

/** Session object URLs for own tracks (never persisted, revoked on remove). */
const ownUrls = new Map<string, string>();

export interface MusicSnapshot {
  trackId: string;
  playing: boolean;
  volume: number;
  favs: string[];
  ownTracks: OwnTrack[];
  /** Own-track ids whose file is currently unreachable (re-select state). */
  ownMissing: string[];
}

function readFavs(): string[] {
  try {
    const raw = localStorage.getItem(FAVS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function readLastId(ownIds: string[]): string {
  try {
    const id = localStorage.getItem(LAST_ID_KEY);
    if (!id) return STUDY_TRACKS[0].id;
    if (STUDY_TRACKS.some((t) => t.id === id)) return id;
    if (ownIds.includes(id)) return id;
    return STUDY_TRACKS[0].id;
  } catch {
    return STUDY_TRACKS[0].id;
  }
}

function readVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOL_KEY));
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
  } catch {
    return 0.5;
  }
}

const initialOwnMetas = readOwnMetas();

let snapshot: MusicSnapshot = {
  trackId: readLastId(initialOwnMetas.map((m) => m.id)),
  playing: false,
  volume: readVolume(),
  favs: readFavs(),
  ownTracks: initialOwnMetas,
  // Session-only picks (no persistable handle) need re-select after restart.
  ownMissing: initialOwnMetas.filter((m) => !m.persistent).map((m) => m.id),
};

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  snapshot = {
    ...snapshot,
    favs: [...snapshot.favs],
    ownTracks: [...snapshot.ownTracks],
    ownMissing: [...snapshot.ownMissing],
  };
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore listener errors */
    }
  });
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): MusicSnapshot {
  return snapshot;
}

export function currentTrack(): TrackInfo {
  const bundled = STUDY_TRACKS.find((t) => t.id === snapshot.trackId);
  if (bundled) return bundled;
  const own = snapshot.ownTracks.find((t) => t.id === snapshot.trackId);
  if (own) {
    return {
      id: own.id,
      mood: 'Lo-fi',
      title: own.name,
      artist: 'Your device',
      url: ownUrls.get(own.id) ?? '',
    };
  }
  return STUDY_TRACKS[0];
}

let a1: HTMLAudioElement | null = null;
let a2: HTMLAudioElement | null = null;
let activeSlot: 1 | 2 = 1;
let fadeTimer: ReturnType<typeof setInterval> | null = null;
let fadePair: { out: HTMLAudioElement; inn: HTMLAudioElement } | null = null;
let wasPlayingBeforePause = false;
let mediaBound = false;

function currentEl(): HTMLAudioElement | null {
  if (!a1 || !a2) return null;
  return activeSlot === 1 ? a1 : a2;
}

function setPlayingState(playing: boolean): void {
  if (snapshot.playing === playing) return;
  snapshot.playing = playing;
  emit();
}

function updateMediaMeta(t: TrackInfo): void {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title,
      artist: 'Valuable Focus',
      album: 'Study tunes',
      artwork: [{ src: '/visuals/solar-system/solar-preview.png', sizes: '1024x1024', type: 'image/png' }],
    });
  } catch {
    /* media session unavailable */
  }
}

function bindMediaSession(): void {
  if (mediaBound || !('mediaSession' in navigator)) return;
  mediaBound = true;
  try {
    navigator.mediaSession.setActionHandler('play', () => {
      void resume();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      pause();
    });
  } catch {
    /* action handlers unsupported */
  }
}

function ensureAudio(): boolean {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return false;
  if (!a1 || !a2) {
    const el1 = new Audio();
    const el2 = new Audio();
    el1.loop = true;
    el2.loop = true;
    el1.preload = 'auto';
    el2.preload = 'auto';
    el1.volume = snapshot.volume;
    el2.volume = 0;
    const firstUrl = currentTrack().url;
    if (firstUrl) el1.src = firstUrl;
    a1 = el1;
    a2 = el2;
    bindMediaSession();
  }
  return true;
}

function crossfadeTo(url: string): void {
  if (!a1 || !a2) return;
  if (fadeTimer) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
  const out = activeSlot === 1 ? a1 : a2;
  const inn = activeSlot === 1 ? a2 : a1;
  fadePair = { out, inn };
  inn.src = url;
  inn.volume = 0;
  inn.play().catch(() => setPlayingState(false));

  const steps = 20; // 20 x 20ms = 400ms crossfade
  const volStep = snapshot.volume / steps;
  let step = 0;
  fadeTimer = setInterval(() => {
    step += 1;
    inn.volume = Math.min(snapshot.volume, step * volStep);
    out.volume = Math.max(0, snapshot.volume - step * volStep);
    if (step >= steps) {
      if (fadeTimer) clearInterval(fadeTimer);
      fadeTimer = null;
      fadePair = null;
      out.pause();
      inn.volume = snapshot.volume;
      activeSlot = activeSlot === 1 ? 2 : 1;
    }
  }, 20);
}

/** Shared playback start (bundled + own tracks). Always user-initiated. */
function startPlayback(id: string, url: string, title: string, artist: string): void {
  if (!ensureAudio()) return;
  snapshot.trackId = id;
  try {
    localStorage.setItem(LAST_ID_KEY, id);
  } catch {
    /* persistence unavailable */
  }
  snapshot.playing = true;
  emit();
  updateMediaMeta({ id, mood: 'Lo-fi', title, artist, url });
  crossfadeTo(url);
}

/** Play a track (or toggle it if it's already active). Always user-initiated. */
export function playTrack(id: string): void {
  if (!ensureAudio()) return;
  const t = STUDY_TRACKS.find((x) => x.id === id);
  if (!t) {
    // Might be an own track — resolve its file URL first (may need permission).
    void playOwnTrack(id);
    return;
  }
  if (id === snapshot.trackId) {
    if (snapshot.playing) pause();
    else void resume();
    return;
  }
  startPlayback(t.id, t.url, t.title, t.artist);
}

/** Resume the current track (user tap or session resume). */
export function resume(): void {
  if (!ensureAudio()) return;
  const el = currentEl();
  if (!el) return;
  if (!el.src) {
    const url = currentTrack().url;
    if (!url) return;
    el.src = url;
  }
  el.volume = snapshot.volume;
  updateMediaMeta(currentTrack());
  el.play().then(
    () => setPlayingState(true),
    () => setPlayingState(false),
  );
}

/** Pause immediately (keeps position; resume continues the right track). */
export function pause(): void {
  if (fadeTimer) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
  if (fadePair) {
    // Snap to the incoming track so a later resume continues the new one.
    fadePair.out.pause();
    activeSlot = fadePair.inn === a1 ? 1 : 2;
    fadePair.inn.volume = snapshot.volume;
    fadePair = null;
  }
  if (a1) a1.pause();
  if (a2) a2.pause();
  setPlayingState(false);
}

/** Session pause/resume sync: pause with the timer, auto-resume with it. */
export function setSessionPaused(paused: boolean): void {
  if (paused) {
    wasPlayingBeforePause = snapshot.playing;
    if (snapshot.playing) pause();
  } else if (wasPlayingBeforePause) {
    wasPlayingBeforePause = false;
    resume();
  }
}

/** Session over (quit / complete): stop everything and reset position. */
export function stopAndReset(): void {
  wasPlayingBeforePause = false;
  if (fadeTimer) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
  fadePair = null;
  if (a1) {
    a1.pause();
    a1.currentTime = 0;
  }
  if (a2) {
    a2.pause();
    a2.currentTime = 0;
  }
  setPlayingState(false);
}

/** Independent music volume (persisted). */
export function setVolume(v: number): void {
  const vol = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : snapshot.volume;
  snapshot.volume = vol;
  try {
    localStorage.setItem(VOL_KEY, String(vol));
  } catch {
    /* persistence unavailable */
  }
  const el = currentEl();
  if (el && !fadeTimer) el.volume = vol;
  emit();
}

/** Optional favorite toggle (persisted, no limit). */
export function toggleFav(id: string): void {
  const has = snapshot.favs.includes(id);
  snapshot.favs = has ? snapshot.favs.filter((x) => x !== id) : [...snapshot.favs, id];
  try {
    localStorage.setItem(FAVS_KEY, JSON.stringify(snapshot.favs));
  } catch {
    /* persistence unavailable */
  }
  emit();
}

/* ── Own tracks (user's device audio, max 2, Favourites only) ──────────── */

function markMissing(id: string): void {
  if (!snapshot.ownMissing.includes(id)) {
    snapshot.ownMissing = [...snapshot.ownMissing, id];
    emit();
  }
}

function clearMissing(id: string): void {
  if (snapshot.ownMissing.includes(id)) {
    snapshot.ownMissing = snapshot.ownMissing.filter((x) => x !== id);
    emit();
  }
}

/** True while another own track can be added (brief: max 2, then hide plus). */
export function canAddOwnTrack(): boolean {
  return snapshot.ownTracks.length < MAX_OWN_TRACKS;
}

/** Resolve a stored file handle to a playable File (permission-aware). */
async function ensureHandleFile(id: string): Promise<File | null> {
  const handle = await idbGetHandle(id);
  if (!handle) return null;
  try {
    const qp = handle.queryPermission
      ? await handle.queryPermission({ mode: 'read' })
      : 'granted';
    if (qp === 'granted') return await handle.getFile();
    if (qp === 'denied') return null;
    // 'prompt' — the play tap is a user gesture, so requesting is allowed.
    const rp = handle.requestPermission
      ? await handle.requestPermission({ mode: 'read' })
      : 'denied';
    if (rp !== 'granted') return null;
    return await handle.getFile();
  } catch {
    return null;
  }
}

function registerOwnTrack(id: string, name: string, url: string, persistent: boolean): void {
  ownUrls.set(id, url);
  snapshot.ownTracks = [...snapshot.ownTracks, { id, name, persistent }];
  saveOwnMetas(snapshot.ownTracks);
  clearMissing(id);
  if (!snapshot.favs.includes(id)) {
    snapshot.favs = [...snapshot.favs, id];
    saveFavs(snapshot.favs);
  }
  emit();
}

/**
 * Add an own track from a picked File (plain input fallback).
 * Session-only unless a persistable handle is attached separately.
 * Returns false when the 2-track cap is already reached.
 */
export function addOwnTrackFromFile(file: File): boolean {
  if (!canAddOwnTrack()) return false;
  try {
    const id = 'own-' + Date.now();
    const url = URL.createObjectURL(file);
    registerOwnTrack(id, file.name || 'My track', url, false);
    return true;
  } catch {
    return false;
  }
}

/**
 * Add an own track from a File System Access handle (Chromium).
 * The handle is stored (IndexedDB) + permission persisted, so the track
 * survives restarts without re-picking.
 */
export async function addOwnTrackFromHandle(handle: {
  getFile: () => Promise<File>;
  name?: string;
}): Promise<boolean> {
  if (!canAddOwnTrack()) return false;
  try {
    const file = await handle.getFile();
    const id = 'own-' + Date.now();
    const url = URL.createObjectURL(file);
    try {
      await idbPutHandle(id, handle);
    } catch {
      /* handle not storable — falls back to session-only */
    }
    const stored = await idbGetHandle(id);
    registerOwnTrack(id, file.name || handle.name || 'My track', url, stored !== null);
    return true;
  } catch {
    return false;
  }
}

/** Play an own track, resolving its file URL (permission-aware). */
export async function playOwnTrack(id: string): Promise<void> {
  const meta = snapshot.ownTracks.find((t) => t.id === id);
  if (!meta) return;
  let url = ownUrls.get(id);
  if (!url) {
    if (!meta.persistent) {
      // Session-only pick from a previous load — file is gone.
      markMissing(id);
      return;
    }
    const file = await ensureHandleFile(id);
    if (!file) {
      // Missing file or lost permission — friendly re-select, no crash.
      markMissing(id);
      return;
    }
    try {
      url = URL.createObjectURL(file);
    } catch {
      markMissing(id);
      return;
    }
    ownUrls.set(id, url);
  }
  clearMissing(id);
  if (id === snapshot.trackId) {
    if (snapshot.playing) pause();
    else {
      if (!ensureAudio()) return;
      startPlayback(id, url, meta.name, 'Your device');
    }
    return;
  }
  if (!ensureAudio()) return;
  startPlayback(id, url, meta.name, 'Your device');
}

/**
 * Re-pick the file for an own track (missing/permission-lost state).
 * Accepts a File (plain input) or a persistable handle (FS API).
 */
export async function reselectOwnTrack(
  id: string,
  fileOrHandle: File | { getFile: () => Promise<File>; name?: string },
): Promise<boolean> {
  const meta = snapshot.ownTracks.find((t) => t.id === id);
  if (!meta) return false;
  try {
    const isHandle =
      !(fileOrHandle instanceof File) &&
      typeof (fileOrHandle as { getFile?: unknown }).getFile === 'function';
    const file = isHandle
      ? await (fileOrHandle as { getFile: () => Promise<File> }).getFile()
      : (fileOrHandle as File);
    const oldUrl = ownUrls.get(id);
    if (oldUrl) {
      try {
        URL.revokeObjectURL(oldUrl);
      } catch {
        /* ignore */
      }
    }
    const url = URL.createObjectURL(file);
    ownUrls.set(id, url);
    let persistent = false;
    if (isHandle) {
      try {
        await idbPutHandle(id, fileOrHandle);
        persistent = (await idbGetHandle(id)) !== null;
      } catch {
        persistent = false;
      }
    }
    snapshot.ownTracks = snapshot.ownTracks.map((t) =>
      t.id === id ? { ...t, name: file.name || t.name, persistent } : t,
    );
    saveOwnMetas(snapshot.ownTracks);
    clearMissing(id);
    emit();
    return true;
  } catch {
    return false;
  }
}

/** Remove an own track fully (URL revoked, handle deleted, plus returns). */
export function removeOwnTrack(id: string): void {
  const url = ownUrls.get(id);
  if (url) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
    ownUrls.delete(id);
  }
  void idbDeleteHandle(id);
  const wasPlaying = snapshot.trackId === id && snapshot.playing;
  snapshot.ownTracks = snapshot.ownTracks.filter((t) => t.id !== id);
  snapshot.ownMissing = snapshot.ownMissing.filter((x) => x !== id);
  snapshot.favs = snapshot.favs.filter((x) => x !== id);
  saveFavs(snapshot.favs);
  saveOwnMetas(snapshot.ownTracks);
  if (wasPlaying) {
    pause();
    snapshot.trackId = STUDY_TRACKS[0].id;
    try {
      localStorage.setItem(LAST_ID_KEY, snapshot.trackId);
    } catch {
      /* ignore */
    }
  }
  emit();
}
