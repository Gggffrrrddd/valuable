import { useRef, useState, useSyncExternalStore } from 'react';
import { Music, Play, Pause, Heart, Volume2, X, Plus, RotateCcw } from 'lucide-react';
import { STUDY_TRACKS, type Mood } from './focus-visuals/model-core/studyMusicConfig';
import {
  subscribe,
  getSnapshot,
  currentTrack,
  playTrack,
  playOwnTrack,
  setVolume,
  toggleFav,
  addOwnTrackFromFile,
  addOwnTrackFromHandle,
  removeOwnTrack,
  reselectOwnTrack,
  MAX_OWN_TRACKS,
} from '@/lib/studyMusicEngine';
import { breadcrumb } from '@/lib/telemetry';

/**
 * Thin UI over the app-lifetime music engine: subscribes to engine state and
 * forwards taps. Unmounting this (e.g. peeking at the study table) never
 * stops playback — the engine owns the Audio elements at module scope.
 */
export default function StudyMusicPlayer() {
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Mood>(
    () => STUDY_TRACKS.find((t) => t.id === snap.trackId)?.mood ?? 'Lo-fi',
  );

  const activeTrackObj = currentTrack();
  const favTracks = STUDY_TRACKS.filter((t) => snap.favs.includes(t.id));
  const tabTracks = STUDY_TRACKS.filter((t) => t.mood === activeTab);
  const showPlus = snap.ownTracks.length < MAX_OWN_TRACKS;
  // Picker target: null = add new, string = re-select existing own track.
  const [pickTarget, setPickTarget] = useState<null | { reselectId: string | null }>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function supportsFileSystemPicker(): boolean {
    try {
      return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
    } catch {
      return false;
    }
  }

  async function handlePickedFile(file: File): Promise<void> {
    const target = pickTarget?.reselectId ?? null;
    setPickTarget(null);
    if (!file || file.size <= 0) return;
    if (target) {
      const ok = await reselectOwnTrack(target, file);
      breadcrumb('music', ok ? 'own track re-selected' : 'own track re-select failed', { id: target });
    } else {
      const ok = addOwnTrackFromFile(file);
      breadcrumb('music', ok ? 'own track added (session file)' : 'own track add rejected (cap)', {});
    }
  }

  async function handlePickedHandle(handle: { getFile: () => Promise<File>; name?: string }): Promise<void> {
    const target = pickTarget?.reselectId ?? null;
    setPickTarget(null);
    try {
      if (target) {
        const ok = await reselectOwnTrack(target, handle);
        breadcrumb('music', ok ? 'own track re-selected' : 'own track re-select failed', { id: target });
      } else {
        const ok = await addOwnTrackFromHandle(handle);
        breadcrumb('music', ok ? 'own track added (persisted)' : 'own track add rejected (cap)', {});
      }
    } catch {
      /* picker errors stay silent — user simply stays where they were */
    }
  }

  async function chooseAudioFile(): Promise<void> {
    // Prefer the File System Access picker (persistable permission) so the
    // track survives restarts; fall back to a plain file input everywhere
    // else (mobile browsers included) — session-only in that case.
    if (supportsFileSystemPicker()) {
      try {
        const picker = (window as unknown as {
          showOpenFilePicker: (opts?: unknown) => Promise<Array<{ getFile: () => Promise<File>; name?: string }>>;
        }).showOpenFilePicker;
        const [handle] = await picker({
          types: [
            {
              description: 'Audio',
              accept: { 'audio/*': ['.mp3', '.m4a', '.wav', '.ogg', '.opus', '.flac', '.aac'] },
            },
          ],
          multiple: false,
        });
        if (handle) {
          await handlePickedHandle(handle);
          return;
        }
      } catch (e) {
        // User cancelled the system picker — close quietly, don't chain
        // another dialog. Anything else falls through to the plain input.
        if (e instanceof DOMException && e.name === 'AbortError') {
          setPickTarget(null);
          return;
        }
        if (!fileInputRef.current) return;
      }
    }
    fileInputRef.current?.click();
  }

  return (
    <div className="relative">
      {/* Collapsed Pill */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border border-white/[.08] bg-black/40 px-3 py-2 text-xs font-bold text-stone-400 backdrop-blur-xl transition hover:bg-black/60 hover:text-stone-200"
        >
          {snap.playing ? (
            <div className="flex h-3 items-end gap-[2px]">
              <div className="w-[3px] animate-[bounce_0.8s_ease-in-out_infinite_alternate] bg-[#f6e3ba]" />
              <div className="w-[3px] animate-[bounce_1.1s_ease-in-out_infinite_alternate] bg-[#f6e3ba]" style={{ animationDelay: '0.2s' }} />
              <div className="w-[3px] animate-[bounce_0.9s_ease-in-out_infinite_alternate] bg-[#f6e3ba]" style={{ animationDelay: '0.4s' }} />
            </div>
          ) : (
            <Music className="h-3.5 w-3.5" />
          )}
          <span className={snap.playing ? 'text-[#f6e3ba]' : ''}>
            {snap.playing ? activeTrackObj.title : 'Focus music'}
          </span>
        </button>
      )}

      {/* Expanded Drawer */}
      {open && (
        <div className="absolute bottom-0 right-0 z-50 w-72 origin-bottom-right rounded-[1.4rem] border border-white/[.08] bg-[#090b0a]/95 p-4 shadow-2xl backdrop-blur-2xl sm:w-80">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {showPlus && (
                <button
                  onClick={() => setPickTarget({ reselectId: null })}
                  aria-label="Add your own music"
                  title="Add your own music"
                  className="rounded-lg p-1.5 text-stone-400 transition hover:bg-white/10 hover:text-[#f6e3ba]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <Music className="h-4 w-4 text-[#f6e3ba]" /> Focus music
              </h3>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-stone-500 transition hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Volume */}
          <div className="mb-5 flex items-center gap-3 px-1">
            <Volume2 className="h-4 w-4 shrink-0 text-stone-500" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={snap.volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#f6e3ba]"
            />
          </div>

          {/* Favorites Row (bundled + own tracks) */}
          {(favTracks.length > 0 || snap.ownTracks.length > 0) && (
            <div className="mb-4">
              <div className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-stone-500">Favorites</div>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {favTracks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => playTrack(t.id)}
                    className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                      snap.trackId === t.id
                        ? 'border-[#f6e3ba]/30 bg-[#f6e3ba]/10 text-[#f6e3ba]'
                        : 'border-white/10 bg-white/5 text-stone-300 hover:border-white/20'
                    }`}
                  >
                    {t.title}
                  </button>
                ))}
                {snap.ownTracks.map((o) => {
                  const missing = snap.ownMissing.includes(o.id);
                  const isActive = snap.trackId === o.id;
                  return (
                    <div
                      key={o.id}
                      className={`flex shrink-0 items-center gap-1 rounded-xl border px-2 py-1 text-xs font-semibold transition ${
                        missing
                          ? 'border-dashed border-amber-300/40 bg-amber-300/5 text-amber-200'
                          : isActive
                            ? 'border-[#f6e3ba]/30 bg-[#f6e3ba]/10 text-[#f6e3ba]'
                            : 'border-white/10 bg-white/5 text-stone-300'
                      }`}
                    >
                      <button
                        onClick={() => {
                          if (missing) setPickTarget({ reselectId: o.id });
                          else void playOwnTrack(o.id);
                        }}
                        title={missing ? 'File unreachable — tap to re-select' : o.name}
                        className="flex max-w-28 items-center gap-1.5 truncate"
                      >
                        {missing && <RotateCcw className="h-3 w-3 shrink-0" />}
                        <span className="truncate">{missing ? 'Re-select file' : o.name}</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeOwnTrack(o.id);
                          breadcrumb('music', 'own track removed', { id: o.id });
                        }}
                        aria-label={`Remove ${o.name}`}
                        title="Remove"
                        className="rounded p-0.5 text-stone-500 transition hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mood Tabs */}
          <div className="mb-3 flex rounded-xl bg-white/5 p-1">
            {(['Lo-fi', 'Ambient / Piano', 'Nature-blended'] as Mood[]).map((m) => (
              <button
                key={m}
                onClick={() => setActiveTab(m)}
                className={`flex-1 rounded-lg py-1.5 text-[11px] font-bold transition ${
                  activeTab === m ? 'bg-white/10 text-white shadow-sm' : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Track List */}
          <div className="space-y-1">
            {tabTracks.map((t) => {              const isActive = snap.trackId === t.id;
              const isFav = snap.favs.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => playTrack(t.id)}
                  className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                    isActive ? 'bg-[#f6e3ba]/10' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                      isActive ? 'bg-[#f6e3ba] text-black shadow-[0_0_15px_rgba(246,227,186,.4)]' : 'bg-white/10 text-stone-400 group-hover:bg-white/20 group-hover:text-white'
                    }`}>
                      {isActive && snap.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${isActive ? 'text-[#f6e3ba]' : 'text-stone-200'}`}>
                        {t.title}
                      </div>
                    </div>
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFav(t.id);
                    }}
                    className={`p-1.5 transition ${isFav ? 'text-[#f6e3ba]' : 'text-transparent group-hover:text-stone-500 hover:scale-110'}`}
                  >
                    <Heart className="h-4 w-4" fill={isFav ? 'currentColor' : 'none'} />
                  </div>
                </button>
              );
            })}
          </div>

        </div>
      )}

      {/* Hidden file input (fallback where the FS picker is unavailable). */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.wav,.ogg,.opus,.flac,.aac"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handlePickedFile(file);
          else setPickTarget(null);
        }}
      />

      {/* Own-music explainer modal */}
      {pickTarget && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 pb-8 backdrop-blur-sm sm:items-center sm:pb-4"
          role="dialog"
          aria-modal="true"
          aria-label={pickTarget.reselectId ? 'Re-select your audio file' : 'Add your own music'}
          onClick={() => setPickTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#101310] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="flex items-center gap-2 text-sm font-bold text-white">
              <Music className="h-4 w-4 text-[#f6e3ba]" />
              {pickTarget.reselectId ? 'Re-select your audio file' : 'Add your own music'}
            </h4>
            <ul className="mt-3 space-y-2.5 text-xs leading-5 text-stone-400">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#f6e3ba]" />
                <span><span className="font-bold text-stone-200">What to select:</span> an audio file already on your phone (MP3, M4A, WAV and more).</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#f6e3ba]" />
                <span><span className="font-bold text-stone-200">Why:</span> so you can study with your own favourite tune, right inside focus sessions.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#f6e3ba]" />
                <span><span className="font-bold text-stone-200">Private by design:</span> the file is never uploaded — it stays on your device and only plays for you.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#f6e3ba]" />
                <span><span className="font-bold text-stone-200">Fair use:</span> please use only music you own or have the right to play.</span>
              </li>
            </ul>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => void chooseAudioFile()}
                className="flex-1 rounded-xl bg-[#f6e3ba] py-2.5 text-xs font-extrabold text-black transition hover:brightness-110"
              >
                Choose audio file
              </button>
              <button
                onClick={() => setPickTarget(null)}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-stone-300 transition hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
            <p className="mt-3 text-center text-[10px] text-stone-600">
              Max {MAX_OWN_TRACKS} own tracks · appear in Favourites only
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
