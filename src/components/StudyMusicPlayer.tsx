import { useEffect, useRef, useState } from 'react';
import { Music, Play, Pause, Heart, Volume2, X } from 'lucide-react';
import { STUDY_TRACKS, type Mood, type TrackInfo } from './focus-visuals/model-core/studyMusicConfig';

const MUSIC_FAVS_KEY = 'valuable-music-favs';
const MUSIC_LAST_ID_KEY = 'valuable-music-last';
const MUSIC_VOLUME_KEY = 'valuable-music-vol';

interface StudyMusicPlayerProps {
  /** If the focus session is paused, we pause music. If resumed, we resume (if it was playing). */
  sessionPaused: boolean;
}

export default function StudyMusicPlayer({ sessionPaused }: StudyMusicPlayerProps) {
  const [open, setOpen] = useState(false);
  
  // Persisted state
  const [favs, setFavs] = useState<string[]>(() => {
    const saved = localStorage.getItem(MUSIC_FAVS_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [activeId, setActiveId] = useState<string>(() => {
    return localStorage.getItem(MUSIC_LAST_ID_KEY) || STUDY_TRACKS[0].id;
  });
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem(MUSIC_VOLUME_KEY);
    return saved ? Number(saved) : 0.5;
  });

  // Player state
  const [playing, setPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<Mood>('Lo-fi');
  
  // Audio refs for crossfading
  const audio1Ref = useRef<HTMLAudioElement | null>(null);
  const audio2Ref = useRef<HTMLAudioElement | null>(null);
  const activeAudioRef = useRef<1 | 2>(1);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync session pause
  const wasPlayingBeforeSessionPause = useRef<boolean>(false);

  // Initialize active tab based on last played
  useEffect(() => {
    const track = STUDY_TRACKS.find(t => t.id === activeId);
    if (track) setActiveTab(track.mood);
  }, []); // Only on mount

  // Sync to local storage
  useEffect(() => localStorage.setItem(MUSIC_FAVS_KEY, JSON.stringify(favs)), [favs]);
  useEffect(() => localStorage.setItem(MUSIC_LAST_ID_KEY, activeId), [activeId]);
  useEffect(() => localStorage.setItem(MUSIC_VOLUME_KEY, String(volume)), [volume]);

  // Audio elements setup
  useEffect(() => {
    const a1 = new Audio();
    const a2 = new Audio();
    a1.loop = true;
    a2.loop = true;
    a1.volume = volume;
    a2.volume = 0; // Starts silent
    audio1Ref.current = a1;
    audio2Ref.current = a2;

    const track = STUDY_TRACKS.find(t => t.id === activeId) || STUDY_TRACKS[0];
    a1.src = track.url;
    
    // Media session setup
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => handlePlay());
      navigator.mediaSession.setActionHandler('pause', () => handlePause());
    }

    return () => {
      a1.pause();
      a2.pause();
      a1.src = '';
      a2.src = '';
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    };
  }, []); // Mount only

  // Apply volume changes to current active track instantly
  useEffect(() => {
    const a1 = audio1Ref.current;
    const a2 = audio2Ref.current;
    if (!a1 || !a2) return;
    
    if (activeAudioRef.current === 1) a1.volume = volume;
    else a2.volume = volume;
  }, [volume]);

  // Handle Session Pause/Resume
  useEffect(() => {
    if (sessionPaused) {
      wasPlayingBeforeSessionPause.current = playing;
      if (playing) handlePause();
    } else {
      if (wasPlayingBeforeSessionPause.current) handlePlay();
    }
  }, [sessionPaused]);

  function updateMediaSession(track: TrackInfo) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: 'Valuable Focus',
        artwork: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      });
    }
  }

  function crossfadeTo(newUrl: string) {
    const a1 = audio1Ref.current;
    const a2 = audio2Ref.current;
    if (!a1 || !a2) return;

    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);

    const fadingOut = activeAudioRef.current === 1 ? a1 : a2;
    const fadingIn = activeAudioRef.current === 1 ? a2 : a1;
    
    fadingIn.src = newUrl;
    fadingIn.volume = 0;
    fadingIn.play().catch(e => console.warn('Play blocked:', e));

    const steps = 20;
    const intervalMs = 20; // 400ms total fade
    const volStep = volume / steps;
    let step = 0;

    fadeIntervalRef.current = setInterval(() => {
      step++;
      fadingIn.volume = Math.min(volume, step * volStep);
      fadingOut.volume = Math.max(0, volume - (step * volStep));

      if (step >= steps) {
        if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
        fadingOut.pause();
        fadingIn.volume = volume;
        activeAudioRef.current = activeAudioRef.current === 1 ? 2 : 1;
      }
    }, intervalMs);
  }

  function handlePlayTrack(track: TrackInfo) {
    if (track.id === activeId) {
      if (playing) handlePause();
      else handlePlay();
      return;
    }

    setActiveId(track.id);
    setPlaying(true);
    updateMediaSession(track);
    crossfadeTo(track.url);
  }

  function handlePlay() {
    const a = activeAudioRef.current === 1 ? audio1Ref.current : audio2Ref.current;
    if (a) {
      a.play().catch(e => console.warn('Play blocked:', e));
      setPlaying(true);
      const track = STUDY_TRACKS.find(t => t.id === activeId);
      if (track) updateMediaSession(track);
    }
  }

  function handlePause() {
    const a = activeAudioRef.current === 1 ? audio1Ref.current : audio2Ref.current;
    if (a) {
      a.pause();
      setPlaying(false);
    }
  }

  function toggleFav(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setFavs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const activeTrackObj = STUDY_TRACKS.find(t => t.id === activeId) || STUDY_TRACKS[0];
  const favTracks = STUDY_TRACKS.filter(t => favs.includes(t.id));
  const tabTracks = STUDY_TRACKS.filter(t => t.mood === activeTab);

  return (
    <div className="relative">
      {/* Collapsed Pill */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border border-white/[.08] bg-black/40 px-3 py-2 text-xs font-bold text-stone-400 backdrop-blur-xl transition hover:bg-black/60 hover:text-stone-200"
        >
          {playing ? (
            <div className="flex h-3 items-end gap-[2px]">
              <div className="w-[3px] animate-[bounce_0.8s_ease-in-out_infinite_alternate] bg-[#f6e3ba]" />
              <div className="w-[3px] animate-[bounce_1.1s_ease-in-out_infinite_alternate] bg-[#f6e3ba]" style={{ animationDelay: '0.2s' }} />
              <div className="w-[3px] animate-[bounce_0.9s_ease-in-out_infinite_alternate] bg-[#f6e3ba]" style={{ animationDelay: '0.4s' }} />
            </div>
          ) : (
            <Music className="h-3.5 w-3.5" />
          )}
          <span className={playing ? 'text-[#f6e3ba]' : ''}>
            {playing ? activeTrackObj.title : 'Focus music'}
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
              value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#f6e3ba]"
            />
          </div>

          {/* Favorites Row */}
          {favTracks.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-stone-500">Favorites</div>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {favTracks.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handlePlayTrack(t)}
                    className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                      activeId === t.id
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
            {(['Lo-fi', 'Piano', 'Ambient', 'Nature'] as Mood[]).map(m => (
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
            {tabTracks.map(t => {
              const isActive = activeId === t.id;
              const isFav = favs.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => handlePlayTrack(t)}
                  className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                    isActive ? 'bg-[#f6e3ba]/10' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                      isActive ? 'bg-[#f6e3ba] text-black shadow-[0_0_15px_rgba(246,227,186,.4)]' : 'bg-white/10 text-stone-400 group-hover:bg-white/20 group-hover:text-white'
                    }`}>
                      {isActive && playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${isActive ? 'text-[#f6e3ba]' : 'text-stone-200'}`}>
                        {t.title}
                      </div>
                      <div className="text-[10px] text-stone-500">{t.artist}</div>
                    </div>
                  </div>
                  <div
                    onClick={(e) => toggleFav(t.id, e)}
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
