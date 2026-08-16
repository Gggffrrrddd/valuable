import { useCallback, useEffect, useRef, useState } from 'react';
import { TIMER_PRESETS, SUBJECT_PRESETS, type TimerPreset } from '@/types';
import { Play, Pause, X, Check, ChevronDown, Clock3, Coffee, Zap } from 'lucide-react';
import FocusVisual from '@/components/focus-visuals/FocusVisual';
import FlipClock from '@/components/FlipClock';
import LeafPicker from '@/components/LeafPicker';
import { LEAF_OPTIONS, LEAF_STORAGE_KEY } from '@/components/leafOptions';
import { FOCUS_VISUAL_THEMES, type FocusVisualTheme } from '@/components/focus-visuals/types';
import {
  SESSION_START_KEY,
  SESSION_DURATION_KEY,
  SESSION_PAUSED_AT_KEY,
  SESSION_PAUSED_TOTAL_KEY,
  SESSION_SUBJECT_KEY,
  SESSION_BREAK_KEY,
} from '@/lib/localSession';

interface FocusTimerProps {
  onComplete: (durationSeconds: number, subjectTag: string | null, completedFully: boolean, breakMinutes: number) => void;
}

type Phase = 'config' | 'focus' | 'paused' | 'completing';

const VISUAL_STORAGE_KEY = 'valuable-focus-visual';

interface StoredSession {
  startMs: number;
  durationMs: number;
  pausedAtMs: number | null;
  pausedTotalMs: number;
  subjectTag: string | null;
  breakMinutes: number;
  paused: boolean;
  remainingMs: number;
  elapsedMs: number;
}

function readStoredSession(): StoredSession | null {
  const startRaw = sessionStorage.getItem(SESSION_START_KEY);
  if (!startRaw) return null;
  const startMs = Number(startRaw);
  const durationMs = Number(sessionStorage.getItem(SESSION_DURATION_KEY) ?? 0) * 1000;
  if (!Number.isFinite(startMs) || !Number.isFinite(durationMs) || durationMs <= 0) {
    return null;
  }
  const pausedAtRaw = sessionStorage.getItem(SESSION_PAUSED_AT_KEY);
  const pausedAtMs = pausedAtRaw ? Number(pausedAtRaw) : null;
  const pausedTotalMs = Number(sessionStorage.getItem(SESSION_PAUSED_TOTAL_KEY) ?? 0);
  const now = Date.now();
  const pausedNowMs = pausedAtMs !== null ? Math.max(0, now - pausedAtMs) : 0;
  const pausedMs = pausedTotalMs + pausedNowMs;
  const elapsedMs = Math.max(0, now - startMs - pausedMs);
  const remainingMs = Math.max(0, durationMs - elapsedMs);
  return {
    startMs,
    durationMs,
    pausedAtMs,
    pausedTotalMs,
    subjectTag: sessionStorage.getItem(SESSION_SUBJECT_KEY) || null,
    breakMinutes: Number(sessionStorage.getItem(SESSION_BREAK_KEY) ?? 5) || 5,
    paused: pausedAtMs !== null,
    remainingMs,
    elapsedMs,
  };
}

function clearSessionStorage() {
  sessionStorage.removeItem(SESSION_START_KEY);
  sessionStorage.removeItem(SESSION_DURATION_KEY);
  sessionStorage.removeItem(SESSION_PAUSED_AT_KEY);
  sessionStorage.removeItem(SESSION_PAUSED_TOTAL_KEY);
  sessionStorage.removeItem(SESSION_SUBJECT_KEY);
  sessionStorage.removeItem(SESSION_BREAK_KEY);
}

export default function FocusTimer({ onComplete }: FocusTimerProps) {
  const [preset, setPreset] = useState<TimerPreset>(TIMER_PRESETS[0]);
  const [customFocus, setCustomFocus] = useState(25);
  const [customBreak, setCustomBreak] = useState(5);
  const [isCustom, setIsCustom] = useState(false);
  const [subjectTag, setSubjectTag] = useState<string>('');
  const [showSubjects, setShowSubjects] = useState(false);

  const [phase, setPhase] = useState<Phase>(() => {
    const s = readStoredSession();
    if (!s) return 'config';
    return s.remainingMs <= 0 ? 'completing' : s.paused ? 'paused' : 'focus';
  });
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const s = readStoredSession();
    return s ? Math.ceil(s.remainingMs / 1000) : 25 * 60;
  });
  const [activeDurationSeconds, setActiveDurationSeconds] = useState(() => {
    const s = readStoredSession();
    return s ? s.durationMs / 1000 : 0;
  });
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [visualTheme, setVisualTheme] = useState<FocusVisualTheme>(() => {
    const saved = localStorage.getItem(VISUAL_STORAGE_KEY);
    return FOCUS_VISUAL_THEMES.some((theme) => theme.id === saved) ? saved as FocusVisualTheme : 'hourglass';
  });
  const [selectedLeaf, setSelectedLeaf] = useState<string>(() => {
    const saved = localStorage.getItem(LEAF_STORAGE_KEY);
    return LEAF_OPTIONS.some((option) => option.url === saved) ? (saved as string) : LEAF_OPTIONS[0].url;
  });
  const [showLeafPicker, setShowLeafPicker] = useState(false);

  function selectLeaf(asset: string) {
    setSelectedLeaf(asset);
    localStorage.setItem(LEAF_STORAGE_KEY, asset);
    setShowLeafPicker(false);
  }

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionSubjectRef = useRef<string | null>(null);
  const sessionBreakRef = useRef(5);
  const bootHandledRef = useRef(false);

  const focusMinutes = isCustom ? customFocus : preset.focusMinutes;
  const breakMinutes = isCustom ? customBreak : preset.breakMinutes;
  const totalFocusSeconds = focusMinutes * 60;

  const completeSession = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPhase('completing');
    completionRef.current = setTimeout(() => {
      const s = readStoredSession();
      const duration = s ? s.durationMs / 1000 : totalFocusSeconds;
      clearSessionStorage();
      onComplete(duration, sessionSubjectRef.current, true, sessionBreakRef.current);
    }, 1300);
  }, [onComplete, totalFocusSeconds]);

  useEffect(() => {
    if (bootHandledRef.current) return;
    bootHandledRef.current = true;
    const s = readStoredSession();
    if (!s) return;
    sessionSubjectRef.current = s.subjectTag;
    sessionBreakRef.current = s.breakMinutes;
    setActiveDurationSeconds(s.durationMs / 1000);
    if (s.remainingMs <= 0) {
      completeSession();
    }
  }, [completeSession]);

  useEffect(() => {
    if (phase === 'config') setSecondsLeft(totalFocusSeconds);
  }, [totalFocusSeconds, phase]);

  useEffect(() => {
    if (phase === 'focus') {
      intervalRef.current = setInterval(() => {
        const s = readStoredSession();
        if (!s) return;
        setSecondsLeft(Math.ceil(s.remainingMs / 1000));
        if (s.remainingMs <= 0) {
          completeSession();
        }
      }, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [phase, completeSession]);

  useEffect(() => () => {
    if (completionRef.current) clearTimeout(completionRef.current);
  }, []);

  function selectVisual(theme: FocusVisualTheme) {
    setVisualTheme(theme);
    localStorage.setItem(VISUAL_STORAGE_KEY, theme);
  }

  function handleStart() {
    sessionSubjectRef.current = subjectTag || null;
    sessionBreakRef.current = breakMinutes;
    sessionStorage.setItem(SESSION_START_KEY, String(Date.now()));
    sessionStorage.setItem(SESSION_DURATION_KEY, String(totalFocusSeconds));
    sessionStorage.removeItem(SESSION_PAUSED_AT_KEY);
    sessionStorage.setItem(SESSION_PAUSED_TOTAL_KEY, '0');
    sessionStorage.setItem(SESSION_SUBJECT_KEY, subjectTag || '');
    sessionStorage.setItem(SESSION_BREAK_KEY, String(breakMinutes));
    setActiveDurationSeconds(totalFocusSeconds);
    setSecondsLeft(totalFocusSeconds);
    setPhase('focus');
  }

  function handlePause() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    sessionStorage.setItem(SESSION_PAUSED_AT_KEY, String(Date.now()));
    setPhase('paused');
  }

  function handleResume() {
    const pausedAtRaw = sessionStorage.getItem(SESSION_PAUSED_AT_KEY);
    if (pausedAtRaw) {
      const prevTotal = Number(sessionStorage.getItem(SESSION_PAUSED_TOTAL_KEY) ?? 0);
      sessionStorage.setItem(SESSION_PAUSED_TOTAL_KEY, String(prevTotal + Math.max(0, Date.now() - Number(pausedAtRaw))));
      sessionStorage.removeItem(SESSION_PAUSED_AT_KEY);
    }
    setPhase('focus');
  }

  function handleQuitRequest() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    sessionStorage.setItem(SESSION_PAUSED_AT_KEY, String(Date.now()));
    setPhase('paused');
    setShowQuitConfirm(true);
  }

  function handleQuitConfirm(yes: boolean) {
    setShowQuitConfirm(false);
    if (yes) {
      const s = readStoredSession();
      const elapsedSeconds = s ? Math.max(0, Math.round(s.elapsedMs / 1000)) : Math.max(0, totalFocusSeconds - secondsLeft);
      clearSessionStorage();
      setPhase('config');
      onComplete(elapsedSeconds, sessionSubjectRef.current, false, sessionBreakRef.current);
    } else {
      handleResume();
    }
  }

  const progress = activeDurationSeconds > 0 ? Math.min(1, 1 - secondsLeft / activeDurationSeconds) : 0;

  if (phase === 'focus' || phase === 'paused' || phase === 'completing') {
    return (
      <div className={`fixed inset-0 z-50 bg-[#1A0E2E] ${visualTheme === 'tree' ? 'tree-focus-session' : ''} ${visualTheme === 'jar' ? 'jar-focus-session' : ''} ${visualTheme === 'blade' ? 'blade-focus-session' : ''} ${visualTheme === 'horse' ? 'horse-focus-session' : ''}`}>
        {visualTheme === 'tree' && <img className="tree-focus-background" src="/visuals/tree/tree-scene.png" alt="" aria-hidden="true" />}
        {/* Restrained architectural backdrop; the hourglass keeps its own ambient glow. */}
        <div className="focus-atmosphere" aria-hidden="true" />
        <div className="focus-grid" aria-hidden="true" />
        <div className="focus-orbit focus-orbit-left" aria-hidden="true" />
        <div className="focus-orbit focus-orbit-right" aria-hidden="true" />
        <div className="focus-vignette" aria-hidden="true" />

        {/* Subject tag */}
        {subjectTag && (
          <div className="absolute left-1/2 top-7 z-20 -translate-x-1/2 rounded-full border border-white/[.08] bg-black/35 px-5 py-2 text-[11px] font-bold uppercase tracking-[.16em] text-lime-300 backdrop-blur-xl sm:top-9">
            {subjectTag}
          </div>
        )}

        {/* Premium split-layout: hourglass left/center, flip-clock right */}
        <div className={`relative z-10 flex h-full w-full flex-col items-center justify-center px-6 pb-36 pt-24 lg:flex-row lg:items-center lg:justify-center lg:pb-20 lg:pt-16 ${visualTheme === 'tree' ? 'tree-focus-layout' : ''} ${visualTheme === 'jar' ? 'jar-focus-layout' : ''} ${visualTheme === 'blade' ? 'blade-focus-layout' : ''} ${visualTheme === 'horse' ? 'horse-focus-layout' : ''}`}>
          {/* Left / center zone: hourglass visual */}
          <div className="flex w-full flex-1 items-center justify-center lg:w-7/12 lg:justify-end lg:pr-10 xl:pr-20">
            <div className="relative flex max-h-[48vh] w-full max-w-xl items-center justify-center lg:max-h-[76vh] lg:max-w-2xl">
              <FocusVisual theme={visualTheme} progress={progress} duration={activeDurationSeconds} running={phase === 'focus'} leafAsset={visualTheme === 'tree' ? selectedLeaf : undefined} />
            </div>
          </div>

          {/* Right zone: flip-clock timer */}
          <div className="mt-7 flex w-full items-center justify-center lg:mt-0 lg:w-5/12 lg:justify-start lg:pl-8 xl:pl-14">
            <div className="pointer-events-none transition-opacity duration-700 ease-out" style={{ opacity: activeDurationSeconds > 0 && secondsLeft <= 5 && secondsLeft > 0 ? 0 : 1 }}>
              <FlipClock secondsLeft={secondsLeft} />
            </div>
          </div>
        </div>

        {/* Session status */}
        <div className="absolute bottom-32 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/[.07] bg-black/30 px-5 py-2 text-[11px] font-bold uppercase tracking-[.18em] text-stone-400 backdrop-blur-xl md:bottom-[7.5rem]">
          {phase === 'paused' ? 'Session paused' : phase === 'completing' ? 'Focus complete' : FOCUS_VISUAL_THEMES.find((theme) => theme.id === visualTheme)?.label}
        </div>

        {/* Session controls */}
        {phase !== 'completing' && (
          <div className="absolute bottom-12 left-1/2 z-20 -translate-x-1/2 flex items-center gap-4 rounded-full border border-white/[.08] bg-black/35 p-2 backdrop-blur-xl shadow-[0_14px_50px_rgba(0,0,0,.35)]">
            {phase === 'focus' ? (
              <button
                onClick={handlePause}
                className="group h-[3.75rem] w-[3.75rem] rounded-full bg-white/[.06] flex items-center justify-center text-stone-100 transition hover:bg-white/[.10] hover:scale-105 active:scale-95"
                aria-label="Pause"
              >
                <Pause className="h-7 w-7 transition group-hover:scale-105" strokeWidth={1.8} />
              </button>
            ) : (
              <button
                onClick={handleResume}
                className="group h-[3.75rem] w-[3.75rem] rounded-full bg-lime-300 flex items-center justify-center text-[#241536] transition hover:bg-lime-200 hover:scale-105 active:scale-95"
                aria-label="Resume"
              >
                <Play className="h-7 w-7 ml-0.5 transition group-hover:scale-105" strokeWidth={1.8} />
              </button>
            )}
            <button
              onClick={handleQuitRequest}
              className="group h-[3.75rem] w-[3.75rem] rounded-full bg-white/[.06] flex items-center justify-center text-stone-300 transition hover:bg-white/[.10] hover:text-red-400 hover:scale-105 active:scale-95"
              aria-label="Quit session"
            >
              <X className="h-7 w-7 transition group-hover:scale-105" strokeWidth={1.8} />
            </button>
          </div>
        )}

        {showQuitConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1A0E2E]/90 px-6 backdrop-blur-sm">
            <div className="bg-slate-900 rounded-2xl p-6 max-w-sm w-full border border-slate-800 animate-grow-in">
              <h3 className="text-lg font-semibold text-white mb-2">End this session?</h3>
              <p className="text-slate-400 text-sm mb-6">
                Your progress so far will still be saved. No pressure — you can always start another.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleQuitConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors"
                >
                  Keep Going
                </button>
                <button
                  onClick={() => handleQuitConfirm(true)}
                  className="flex-1 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-medium hover:bg-red-500/20 transition-colors"
                >
                  End Session
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full pt-5 sm:pt-6">
      <div className="surface relative overflow-visible p-4 sm:p-7 lg:p-8">
      <div className="pointer-events-none absolute right-8 top-0 hidden h-px w-48 bg-gradient-to-r from-transparent via-lime-300/50 to-transparent lg:block" />
      <div className="mb-5 flex items-center justify-between px-1">
        <div><div className="text-xs font-bold uppercase tracking-[.18em] text-stone-500">Session setup</div><h2 className="mt-1 text-xl font-bold text-stone-50">Choose your rhythm</h2></div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime-300/[.08] text-lime-300"><Zap className="h-5 w-5" /></div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {TIMER_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => { setPreset(p); setIsCustom(false); }}
            className={`group flex min-h-24 flex-col items-start justify-between rounded-2xl border p-3.5 text-left transition-all sm:min-h-28 sm:p-4 ${
              !isCustom && preset.label === p.label
                ? 'border-lime-300/40 bg-lime-300/[.08] text-stone-50 shadow-[inset_0_0_30px_rgba(212,175,127,.045),0_8px_30px_rgba(0,0,0,.15)]'
                : 'border-white/[.07] bg-white/[.025] text-stone-400 hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[.045]'
            }`}
          >
            <span className="font-display text-2xl font-extrabold tabular-nums">{p.focusMinutes}<span className="ml-0.5 text-xs font-semibold text-stone-500">min</span></span>
            <span className="text-xs font-semibold leading-tight">{p.label}</span>
          </button>
        ))}
      </div>
      <div className="mb-6">
        <button
          onClick={() => setIsCustom(true)}
          className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-colors ${
            isCustom
              ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <span className="font-semibold">Custom session</span>
          <span className="text-sm tabular-nums">
            {customFocus}m focus · {customBreak}m break
          </span>
        </button>
      </div>

      <div className="mb-6">
        <div className="mb-3 flex items-end justify-between px-1">
          <div><div className="text-xs font-bold uppercase tracking-[.18em] text-stone-500">Choose your focus visual</div><p className="mt-1 text-xs text-stone-600">Your visual unfolds as the session progresses.</p></div>
          <span className="hidden text-[10px] font-bold uppercase tracking-[.16em] text-stone-700 sm:block">Saved automatically</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {FOCUS_VISUAL_THEMES.map((theme, index) => {
            return (
              <div key={theme.id} className="relative">
                <button type="button" onClick={() => selectVisual(theme.id)} aria-pressed={visualTheme === theme.id} className={`group block w-full overflow-hidden rounded-2xl border p-2 text-left transition-all ${visualTheme === theme.id ? 'border-lime-300/40 bg-lime-300/[.075] shadow-[inset_0_0_30px_rgba(212,175,127,.035)]' : 'border-white/[.07] bg-white/[.02] hover:-translate-y-0.5 hover:border-white/15'}`}>
                  <div className="flex h-24 items-center justify-center overflow-hidden rounded-xl bg-black/20 sm:h-28">{theme.id === 'horse' ? <img src="/visuals/horse/real-horse.png" alt={theme.label} className="h-full w-full object-contain" draggable={false} /> : theme.id === 'hourglass' ? <img src="/visuals/hourglass/hourglass-preview.png" alt={theme.label} className="h-[97%] w-[97%] object-contain brightness-[.72] transition-all duration-500 group-hover:scale-[1.1] group-hover:brightness-[.8]" draggable={false} /> : theme.id === 'tree' ? <img src="/visuals/tree/tree-preview.png" alt={theme.label} className="h-[97%] w-[97%] object-contain brightness-[.72] transition-all duration-500 group-hover:scale-[1.1] group-hover:brightness-[.82]" draggable={false} /> : theme.id === 'jar' ? <img src="/visuals/jar/jar-preview.png" alt={theme.label} className="h-[90%] w-[90%] object-contain brightness-[.98] transition-all duration-500 group-hover:scale-[1.1] group-hover:brightness-[1]" draggable={false} /> : theme.id === 'blade' ? <img src="/visuals/blade/blade-preview.png" alt={theme.label} className="h-[80%] w-[80%] object-contain transition-transform duration-500 group-hover:scale-[1.1]" draggable={false} /> : <FocusVisual theme={theme.id} progress={[.35, .3, .5, .42, .4, .46][index]} leafAsset={theme.id === 'tree' ? selectedLeaf : undefined} />}</div>
                  <div className="px-1 pb-1 pt-2.5"><div className={`text-xs font-bold ${visualTheme === theme.id ? 'text-lime-300' : 'text-stone-300'}`}>{theme.label}</div><div className="mt-1 hidden text-[10px] leading-4 text-stone-600 sm:block">{theme.description}</div></div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {isCustom && (
        <div className="grid grid-cols-2 gap-3 mb-6 animate-fade-in">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Focus (min)</label>
            <input
              type="number"
              min={1}
              max={180}
              value={customFocus}
              onChange={(e) => setCustomFocus(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-center focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Break (min)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={customBreak}
              onChange={(e) => setCustomBreak(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-center focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      )}

      <div className="mb-6">
        <label className="mb-2 block text-xs font-bold uppercase tracking-[.14em] text-stone-500">What are you focusing on?</label>
        <div className="relative">
          <input
            type="text"
            value={subjectTag}
            onChange={(e) => setSubjectTag(e.target.value)}
            onFocus={() => setShowSubjects(true)}
            onBlur={() => setTimeout(() => setShowSubjects(false), 150)}
            placeholder="e.g. Maths, Physics, Revision…"
            className="premium-input pr-10"
          />
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          {showSubjects && (
            <div className="absolute z-20 mt-1 w-full bg-slate-900 border border-slate-800 rounded-xl shadow-xl py-1 max-h-48 overflow-auto">
              {SUBJECT_PRESETS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={() => { setSubjectTag(s); setShowSubjects(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleStart}
        className="primary-button flex w-full items-center justify-center gap-2 py-4 text-base"
      >
        <Play className="w-5 h-5" />
        Start {focusMinutes}m focus
      </button>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-stone-500 text-xs">
        <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-lime-300/60" /> {focusMinutes}m uninterrupted</span>
        <span className="flex items-center gap-1.5"><Coffee className="h-3.5 w-3.5 text-lime-300/60" /> {breakMinutes}m intentional break</span>
        <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-lime-300/60" /> Progress saved</span>
      </div>
      </div>
      {showLeafPicker && (
        <LeafPicker
          selectedAsset={selectedLeaf}
          onSelect={selectLeaf}
          onClose={() => setShowLeafPicker(false)}
        />
      )}
    </div>
  );
}
