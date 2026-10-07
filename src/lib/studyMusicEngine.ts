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

export interface MusicSnapshot {
  trackId: string;
  playing: boolean;
  volume: number;
  favs: string[];
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

function readLastId(): string {
  try {
    const id = localStorage.getItem(LAST_ID_KEY);
    return id && STUDY_TRACKS.some((t) => t.id === id) ? id : STUDY_TRACKS[0].id;
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

let snapshot: MusicSnapshot = {
  trackId: readLastId(),
  playing: false,
  volume: readVolume(),
  favs: readFavs(),
};

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  snapshot = { ...snapshot, favs: [...snapshot.favs] };
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
  return STUDY_TRACKS.find((t) => t.id === snapshot.trackId) ?? STUDY_TRACKS[0];
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
    el1.src = currentTrack().url;
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

/** Play a track (or toggle it if it's already active). Always user-initiated. */
export function playTrack(id: string): void {
  if (!ensureAudio()) return;
  const t = STUDY_TRACKS.find((x) => x.id === id);
  if (!t) return;
  if (id === snapshot.trackId) {
    if (snapshot.playing) pause();
    else void resume();
    return;
  }
  snapshot.trackId = id;
  try {
    localStorage.setItem(LAST_ID_KEY, id);
  } catch {
    /* persistence unavailable */
  }
  snapshot.playing = true;
  emit();
  updateMediaMeta(t);
  crossfadeTo(t.url);
}

/** Resume the current track (user tap or session resume). */
export function resume(): void {
  if (!ensureAudio()) return;
  const el = currentEl();
  if (!el) return;
  if (!el.src) el.src = currentTrack().url;
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
