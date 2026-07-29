import { useCallback, useEffect, useRef, useState } from 'react';
import { TIMER_PRESETS, SUBJECT_PRESETS, type TimerPreset } from '@/types';
import { Play, Pause, X, Check, ChevronDown, Clock3, Coffee, Zap } from 'lucide-react';
import FocusVisual from '@/components/focus-visuals/FocusVisual';
import { FOCUS_VISUAL_THEMES, type FocusVisualTheme } from '@/components/focus-visuals/types';

interface FocusTimerProps {
  onComplete: (durationSeconds: number, subjectTag: string | null, completedFully: boolean, breakMinutes: number) => void;
}

type Phase = 'config' | 'focus' | 'paused' | 'completing';

const VISUAL_STORAGE_KEY = 'valuable-focus-visual';

export default function FocusTimer({ onComplete }: FocusTimerProps) {
  const [preset, setPreset] = useState<TimerPreset>(TIMER_PRESETS[0]);
  const [customFocus, setCustomFocus] = useState(25);
  const [customBreak, setCustomBreak] = useState(5);
  const [isCustom, setIsCustom] = useState(false);
  const [subjectTag, setSubjectTag] = useState<string>('');
  const [showSubjects, setShowSubjects] = useState(false);

  const [phase, setPhase] = useState<Phase>('config');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [visualTheme, setVisualTheme] = useState<FocusVisualTheme>(() => {
    const saved = localStorage.getItem(VISUAL_STORAGE_KEY);
    return FOCUS_VISUAL_THEMES.some((theme) => theme.id === saved) ? saved as FocusVisualTheme : 'hourglass';
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const focusMinutes = isCustom ? customFocus : preset.focusMinutes;
  const breakMinutes = isCustom ? customBreak : preset.breakMinutes;
  const totalFocusSeconds = focusMinutes * 60;

  useEffect(() => {
    if (phase === 'focus' || phase === 'paused' || phase === 'completing') return;
    setSecondsLeft(totalFocusSeconds);
  }, [totalFocusSeconds, phase]);

  const tick = useCallback(() => {
    setSecondsLeft((s) => {
      if (s <= 1) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setPhase('completing');
        completionRef.current = setTimeout(() => {
          onComplete(totalFocusSeconds, subjectTag || null, true, breakMinutes);
        }, 1300);
        return 0;
      }
      return s - 1;
    });
  }, [breakMinutes, onComplete, subjectTag, totalFocusSeconds]);

  useEffect(() => {
    if (phase === 'focus') {
      intervalRef.current = setInterval(tick, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [phase, tick]);

  useEffect(() => () => {
    if (completionRef.current) clearTimeout(completionRef.current);
  }, []);

  function selectVisual(theme: FocusVisualTheme) {
    setVisualTheme(theme);
    localStorage.setItem(VISUAL_STORAGE_KEY, theme);
  }

  function handleStart() {
    setSecondsLeft(totalFocusSeconds);
    setPhase('focus');
  }

  function handlePause() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhase('paused');
  }

  function handleResume() {
    setPhase('focus');
  }

  function handleQuitRequest() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhase('paused');
    setShowQuitConfirm(true);
  }

  function handleQuitConfirm(yes: boolean) {
    setShowQuitConfirm(false);
    if (yes) {
      const totalElapsed = totalFocusSeconds - secondsLeft;
      setPhase('config');
      onComplete(totalElapsed, subjectTag || null, false, breakMinutes);
    } else {
      setPhase('focus');
    }
  }

  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;
  const timeStr = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  const progress = totalFocusSeconds > 0 ? 1 - secondsLeft / totalFocusSeconds : 0;

  if (phase === 'focus' || phase === 'paused' || phase === 'completing') {
    return (
      <div className="fixed inset-0 z-50 bg-[#090b0a]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(197,255,84,.11),transparent_32rem)]" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background:
               'radial-gradient(circle at 50% 40%, rgba(197,255,84,0.1), transparent 60%)',
          }}
        />

        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-4 rounded-full bg-lime-300/[.025] blur-3xl" />
          <FocusVisual theme={visualTheme} progress={progress} duration={totalFocusSeconds} running={phase === 'focus'} />
        </div>

        <div className="absolute right-5 top-5 z-20 rounded-xl border border-white/[.08] bg-black/40 px-3 py-2 font-display text-sm font-bold tabular-nums text-stone-400 backdrop-blur sm:right-8 sm:top-8">
          {timeStr}
        </div>

        {subjectTag && (
          <div className="absolute left-1/2 top-8 z-20 -translate-x-1/2 rounded-full border border-white/[.08] bg-black/40 px-4 py-1.5 text-xs font-bold uppercase tracking-[.14em] text-lime-300 backdrop-blur sm:top-9">
            {subjectTag}
          </div>
        )}

        <div className="absolute bottom-28 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/40 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[.22em] text-stone-400 backdrop-blur">
          {phase === 'paused' ? 'Session paused' : phase === 'completing' ? 'Focus complete' : FOCUS_VISUAL_THEMES.find((theme) => theme.id === visualTheme)?.label}
        </div>

        {phase !== 'completing' && (
          <div className="absolute bottom-12 left-1/2 z-20 -translate-x-1/2 flex items-center gap-4">
            {phase === 'focus' ? (
              <button
                onClick={handlePause}
                className="w-14 h-14 rounded-full bg-black/50 border border-white/[.12] flex items-center justify-center text-white backdrop-blur hover:bg-black/70 transition-colors"
                aria-label="Pause"
              >
                <Pause className="w-6 h-6" />
              </button>
            ) : (
              <button
                onClick={handleResume}
                className="w-14 h-14 rounded-full bg-emerald-500/80 flex items-center justify-center text-slate-950 backdrop-blur hover:bg-emerald-400 transition-colors"
                aria-label="Resume"
              >
                <Play className="w-6 h-6 ml-0.5" />
              </button>
            )}
            <button
              onClick={handleQuitRequest}
              className="w-14 h-14 rounded-full bg-black/50 border border-white/[.12] flex items-center justify-center text-white/70 backdrop-blur hover:text-red-400 hover:bg-black/70 transition-colors"
              aria-label="Quit session"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        )}

        {showQuitConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#090b0a]/90 px-6 backdrop-blur-sm">
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
                ? 'border-lime-300/40 bg-lime-300/[.08] text-stone-50 shadow-[inset_0_0_30px_rgba(197,255,84,.03),0_8px_30px_rgba(0,0,0,.15)]'
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
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {FOCUS_VISUAL_THEMES.map((theme, index) => (
            <button key={theme.id} type="button" onClick={() => selectVisual(theme.id)} aria-pressed={visualTheme === theme.id} className={`group overflow-hidden rounded-2xl border p-2 text-left transition-all ${visualTheme === theme.id ? 'border-lime-300/40 bg-lime-300/[.075] shadow-[inset_0_0_30px_rgba(197,255,84,.025)]' : 'border-white/[.07] bg-white/[.02] hover:-translate-y-0.5 hover:border-white/15'}`}>
              <div className="flex h-24 items-center justify-center rounded-xl bg-black/20 sm:h-28"><FocusVisual theme={theme.id} progress={[.35, .3, .5, .42][index]} /></div>
              <div className="px-1 pb-1 pt-2.5"><div className={`text-xs font-bold ${visualTheme === theme.id ? 'text-lime-300' : 'text-stone-300'}`}>{theme.label}</div><div className="mt-1 hidden text-[10px] leading-4 text-stone-600 sm:block">{theme.description}</div></div>
            </button>
          ))}
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
    </div>
  );
}
