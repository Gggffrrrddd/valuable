import { useEffect, useState, useSyncExternalStore } from 'react';
import { Music, Play, Pause, Heart, Volume2, X } from 'lucide-react';
import { STUDY_TRACKS, type Mood } from './focus-visuals/model-core/studyMusicConfig';
import {
  subscribe,
  getSnapshot,
  currentTrack,
  playTrack,
  setVolume,
  toggleFav,
} from '@/lib/studyMusicEngine';
import { pushLayer } from '@/lib/backstack';

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

  // Browser-back closes the drawer first instead of exiting the app.
  useEffect(() => {
    if (!open) return;
    return pushLayer('music-drawer', () => setOpen(false));
  }, [open]);

  const activeTrackObj = currentTrack();
  const favTracks = STUDY_TRACKS.filter((t) => snap.favs.includes(t.id));
  const tabTracks = STUDY_TRACKS.filter((t) => t.mood === activeTab);

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
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <Music className="h-4 w-4 text-[#f6e3ba]" /> Focus music
            </h3>
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

          {/* Favorites Row */}
          {favTracks.length > 0 && (
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
            {tabTracks.map((t) => {
              const isActive = snap.trackId === t.id;
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
    </div>
  );
}
