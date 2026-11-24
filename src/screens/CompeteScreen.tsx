import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Sprout } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { readLiveFocusElapsedMs } from '@/lib/localSession';
import TreeScene from '@/components/compete/TreeScene';
import DreamPicker from '@/components/compete/DreamPicker';
import PlacementTuner from '@/components/compete/PlacementTuner';
import GoalHeatmap from '@/components/compete/GoalHeatmap';
import CompeteTour from '@/components/compete/CompeteTour';
import CompeteHelp from '@/components/compete/CompeteHelp';
import {
  DEFAULT_DREAM_STRETCH,
  DEFAULT_RING,
  type PlacementTransform,
} from '@/components/compete/placementConfig';
import {
  fetchActiveGoal,
  createGoal,
  fetchMinutesByDate,
  buildDayRecords,
  persistDayRecords,
  uploadDreamImage,
  saveDreamImages,
  deleteDreamImage,
  dateKey,
  daysBetween,
  type DayRecord,
} from '@/lib/compete';
import type { CompeteGoal } from '@/types';

/** Stores the one-time guided-tour flag when the DB column is unavailable. */
const TOUR_SEEN_KEY = 'valuable.compete-tour-seen.v1';
/** The clip's full-bloom frame lives at 97%, not the very last frame. */
const TREE_PROGRESS_END = 0.97;
/** TEMP: pin the scene to full bloom until growth pacing is changed again. */
const FORCE_FULL_BLOOM = true;

/** Hardcoded per-circle placement — DESKTOP values (mobile overrides below). */
const DREAM_CIRCLE_TRANSFORMS: PlacementTransform[] = [
  { x: -281, y: 195, zoom: 1.5 },
  { x: 2, y: 108, zoom: 1.545 },
  { x: 238, y: 195, zoom: 1.5 },
];
/**
 * Mobile arc placement tuned on a reference portrait stage. Offsets are
 * stored as element-% (circle box = 56px) exactly as before, but at runtime
 * they are re-scaled against the *measured* stage so the crown tracks the
 * tree on any phone — never a fixed-px path for one device.
 */
/** Fixed portrait stage reference (~9:19). All scene geometry is authored
 *  in this box; the box itself is contain-fit scaled, never re-authored. */
const FIT_W = 405;
const FIT_H = 855;
const MOBILE_DREAM_CIRCLE_TRANSFORMS: PlacementTransform[] = [
  { x: -146, y: 722, zoom: 1.5 },
  { x: -2, y: 562, zoom: 1.6 },
  { x: 128, y: 722, zoom: 1.5 },
];
/** TEMPORARY — dream-circle tuner is HIDDEN (values hardcoded above). */
const SHOW_DREAM_XY_TUNER = false;

/**
 * Compete: the daily-tree ritual.
 *
 * - Setup (tree wording) until a goal exists: exam date + daily hours.
 * - The tree view: the growth video seeks with today's tracked
 *   focus vs the daily target — every calendar day it starts over from a
 *   bare seedling, over a static soil overlay.
 * - Dream circles crown the tree (max 3), placement hardcoded per circle.
 *   Video / image placement stays hardcoded; tree progress comes from
 *   today's tracked focus vs the goal's daily target. The Today's-tree card
 *   sits top-left and embeds the complete scene at 16:9. The growth calendar
 *   now sits inline on the page below the dreams. Dream circles are flat
 *   photo circles with a premium gold ring (hardcoded 0.55) + rose-pink glow.
 */
export default function CompeteScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState<CompeteGoal | null>(null);
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [dreamBusy, setDreamBusy] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [liveFocusSeconds, setLiveFocusSeconds] = useState(0);
  const [help, setHelp] = useState<{ type: 'dreams' | 'tracker'; anchor: HTMLElement } | null>(
    null,
  );
  const tourAutoRef = useRef(false);
  // Measure via callback ref (not useEffect+ref-object): it fires synchronously
  // on DOM attach/detach, so measurement can never run against a missing node
  // no matter the mount/branch-switch timing.
  const [stageBox, setStageBox] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth || 393 : 393,
    h: typeof window !== 'undefined' ? window.innerHeight || 852 : 852,
  }));
  const roRef = useRef<ResizeObserver | null>(null);
  const measureBox = useCallback((el: HTMLDivElement | null) => {
    if (!el) {
      roRef.current?.disconnect();
      roRef.current = null;
      return;
    }
    // Layout dims (transform-unaware): the fit container itself is never
    // transformed, so clientWidth/Height always equal its real box.
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w >= 1 && h >= 1) {
      setStageBox((prev) =>
        Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5 ? prev : { w, h },
      );
    }
    roRef.current?.disconnect();
    const ro = new ResizeObserver(([entry]) => {
      const rw = entry.contentRect.width;
      const rh = entry.contentRect.height;
      if (rw < 1 || rh < 1) return;
      setStageBox((prev) =>
        Math.abs(prev.w - rw) < 0.5 && Math.abs(prev.h - rh) < 0.5 ? prev : { w: rw, h: rh },
      );
    });
    ro.observe(el);
    roRef.current = ro;
  }, []);
  // Reactive viewport breakpoint (matchMedia + resize fallback): a bare
  // window resize / device-preset switch / rotation MUST re-render, otherwise
  // the branch never flips and the layout stays stale until hard refresh.
  const [isMobileVp, setIsMobileVp] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 1023.5px)').matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 1023.5px)');
    const sync = () => {
      setIsMobileVp(window.matchMedia('(max-width: 1023.5px)').matches);
    };
    const onMqChange = () => sync();
    try {
      mq.addEventListener('change', onMqChange);
    } catch {
      /* older engines — resize fallback below covers it */
    }
    window.addEventListener('resize', sync);
    return () => {
      try {
        mq.removeEventListener('change', onMqChange);
      } catch {
        /* ignore */
      }
      window.removeEventListener('resize', sync);
    };
  }, []);
  // Keep dream slots matched to the live branch (tuner is hidden, so there
  // are no user edits to lose — a breakpoint switch means a fresh branch).
  useEffect(() => {
    setDreamTune(isMobileVp ? MOBILE_DREAM_CIRCLE_TRANSFORMS : DREAM_CIRCLE_TRANSFORMS);
  }, [isMobileVp]);
  // Fit math (mobile only): contain-fit the fixed stage into the measured
  // box. Desktop never reads this (byte-identical branch below).
  const fitS = stageBox.w >= 1 && stageBox.h >= 1
    ? Math.min(stageBox.w / FIT_W, stageBox.h / FIT_H)
    : 1;
  const fitOX = stageBox.w >= 1 ? (stageBox.w - FIT_W * fitS) / 2 : 0;
  const fitOY = stageBox.h >= 1 ? (stageBox.h - FIT_H * fitS) / 2 : 0;
  // On portrait phones the 855px stage has a lot of empty air under the
  // dream row. Pull the inline tracker up over that empty area so it starts
  // just below the dreams, without rescaling or moving the scene itself.
  const dreamCount = goal?.dream_images?.length ?? 0;
  const mobileDreamBottom = dreamCount >= 2 ? 484 : 440;
  const compactTracker = isMobileVp && stageBox.h >= stageBox.w;
  const mobileTrackerOverlap = compactTracker
    ? Math.max(0, stageBox.h - (fitOY + mobileDreamBottom * fitS) - 12)
    : 0;
  /** TEMPORARY: live X/Y/zoom placement for the 3 dream circles (hardcode when final). */
  const [dreamTune, setDreamTune] = useState<PlacementTransform[]>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 1023.5px)').matches
      ? MOBILE_DREAM_CIRCLE_TRANSFORMS
      : DREAM_CIRCLE_TRANSFORMS
  );
  /** Which dream circle the single tuner is editing (0/1/2). */
  const [dreamTuneIdx, setDreamTuneIdx] = useState(0);

  // (Fit-box measurement lives in the callback ref above — no effect needed.)

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const g = await fetchActiveGoal(session.user.id);
      setGoal(g);
      if (g) {
        const since = g.start_date || g.created_at.slice(0, 10);
        const minutes = await fetchMinutesByDate(session.user.id, since);
        const recs = buildDayRecords(g, minutes);
        setRecords(recs);
        // Persist derived day rows (best-effort: the heatmap still works
        // from focus_sessions if the migration has not been applied yet).
        void persistDayRecords(session.user.id, g, recs);
      } else {
        setRecords([]);
      }
    } catch (e) {
      console.error('Compete load error:', e);
    }
  }, [session]);

  // Dream images: upload → optimistic row update → persist (max 3).
  const addDream = async (file: File) => {
    if (!session || !goal || dreamBusy) return;
    const current = goal.dream_images ?? [];
    if (current.length >= 3) return;
    setDreamBusy(true);
    try {
      const url = await uploadDreamImage(session.user.id, file);
      const next = [...current, url];
      setGoal({ ...goal, dream_images: next });
      await saveDreamImages(goal.id, next);
    } catch (e) {
      console.error('Dream image upload failed:', e);
    } finally {
      setDreamBusy(false);
    }
  };

  const removeDream = async (index: number) => {
    if (!session || !goal) return;
    const current = goal.dream_images ?? [];
    const target = current[index];
    if (!target) return;
    const next = current.filter((_, i) => i !== index);
    setGoal({ ...goal, dream_images: next });
    try {
      await saveDreamImages(goal.id, next);
      void deleteDreamImage(target);
    } catch (e) {
      console.error('Dream image remove failed:', e);
    }
  };

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();

    // Poll so an open session keeps growing the tree, and so the day
    // boundary resets progress to the bare seedling without a reload.
    const id = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 45_000);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session, refresh]);

  // Live focus growth for the Compete tab while a timer runs in another tab.
  useEffect(() => {
    const tick = () => setLiveFocusSeconds(readLiveFocusElapsedMs() / 1000);
    tick();
    const id = window.setInterval(tick, 1_000);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // One-time guided tour. The profile flag is authoritative; localStorage is
  // only a fallback for projects where the new migration has not run yet.
  useEffect(() => {
    if (!goal || !profile || tourAutoRef.current) return;
    tourAutoRef.current = true;
    let seenLocally = false;
    try {
      seenLocally = window.localStorage.getItem(TOUR_SEEN_KEY) === '1';
    } catch {
      /* storage can be unavailable in private mode */
    }
    if (!profile.compete_tour_seen && !seenLocally) setTourOpen(true);
  }, [goal, profile]);

  const dismissTour = useCallback(async () => {
    setTourOpen(false);
    try {
      window.localStorage.setItem(TOUR_SEEN_KEY, '1');
    } catch {
      /* non-fatal fallback */
    }
    if (!session) return;
    const { error } = await supabase
      .from('profiles')
      .update({ compete_tour_seen: true })
      .eq('id', session.user.id);
    if (!error) await refreshProfile();
  }, [session, refreshProfile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-stone-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  if (!goal) {
    return (
      <div className="h-full overflow-y-auto">
        <SetupForm
          onCreated={async (g) => {
            setGoal(g);
            await refresh();
          }}
        />
      </div>
    );
  }

  const today = dateKey(new Date());
  const targetMinutes = Number(goal.daily_target_hours) * 60;
  const todayMinutes =
    (records.find((r) => r.date === today)?.minutesCompleted ?? 0) + liveFocusSeconds / 60;
  const autoProgress = Math.min(1, todayMinutes / targetMinutes);
  // The tree stops on its full-bloom frame at 97%, not the final clip frame.
  const treeProgress = FORCE_FULL_BLOOM
    ? TREE_PROGRESS_END
    : autoProgress * TREE_PROGRESS_END;
  const todayHours = (todayMinutes / 60).toFixed(1);
  const targetHoursLabel = String(Number(goal.daily_target_hours));
  // Shared scene markup — identical on desktop and mobile; only the
  // wrappers differ (desktop keeps the original full-bleed layout exactly,
  // mobile wraps it in the fixed portrait stage below).
  const renderScene = (transforms: PlacementTransform[]) => (
    <>
      {/* Today's tree: the full scene now lives inside this left card. */}
      <div
        className="compete-today absolute left-4 top-4 z-20 sm:left-6 sm:top-6"
        style={{ transform: 'scale(0.9)', transformOrigin: 'top left' }}
        data-tour="tracker"
      >
        <div className="w-60 rounded-[1.2rem] border border-white/[.07] bg-[#090b0a] p-2 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2 px-1.5 pb-2 pt-0.5">
            <div className="text-[10px] font-bold uppercase tracking-[.2em] text-stone-500">
              Today's tree
            </div>
            <button
              type="button"
              aria-label="About today's tree"
              onClick={(e) => setHelp({ type: 'tracker', anchor: e.currentTarget })}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#f6e3ba]/30 text-[9px] font-bold leading-none text-[#f6e3ba]/80 transition hover:border-[#f6e3ba]/70 hover:text-[#f6e3ba]"
            >
              ?
            </button>
          </div>
          <div className="px-1.5 pb-2">
            <span className="font-display text-[20px] font-extrabold leading-none text-stone-100">
              {todayHours}
            </span>
            <span className="ml-1 text-[10px] font-semibold text-stone-500">/ {targetHoursLabel}h</span>
          </div>
          <div
            className="overflow-hidden rounded-[0.95rem] bg-[#090b0a]"
            data-tour="tree"
          >
            <TreeScene progress={treeProgress} className="aspect-[16/9] w-full" />
          </div>
        </div>
        <div className="mt-1.5 w-60 text-[10px] font-semibold uppercase tracking-[.18em] text-[#f6e3ba]/70">
          Grow your <span className="text-[#c5ff54]">tree</span> every day
        </div>
      </div>

      {/* Dream images: bare glow circles crowning the tree. */}
      <DreamPicker
        images={goal.dream_images ?? []}
        transforms={transforms}
        stretch={DEFAULT_DREAM_STRETCH}
        ringWidth={DEFAULT_RING.ring}
        busy={dreamBusy}
        onAdd={addDream}
        onRemove={removeDream}
        onHelp={(anchor) => setHelp({ type: 'dreams', anchor })}
      />

      {/* TEMPORARY — single dream-circle tuner (pick s1/s2/s3, then X/Y/Zoom).
          Overlaps the plant; mobile only; hardcode + flip off when final. */}
      {SHOW_DREAM_XY_TUNER && (goal.dream_images?.length ?? 0) > 0 && (
        <div className="compete-tuner absolute bottom-[28%] left-3 right-3 z-30 lg:hidden">
          <div className="mb-1 flex gap-1">
            {dreamTune.slice(0, goal.dream_images?.length ?? 0).map((_, i) => (
              <button
                key={`dream-tab-${i}`}
                type="button"
                onClick={() => setDreamTuneIdx(i)}
                className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider transition ${
                  dreamTuneIdx === i
                    ? 'border-lime-300/60 bg-lime-300/15 text-lime-200'
                    : 'border-white/10 bg-black/40 text-stone-500 hover:text-stone-300'
                }`}
              >
                s{i + 1}
              </button>
            ))}
          </div>
          <PlacementTuner
            title={`Dream ${dreamTuneIdx + 1} (temp)`}
            logTag={`compete-dream-${dreamTuneIdx}`}
            transform={dreamTune[dreamTuneIdx]}
            rows={[
              { key: 'x', label: 'Move X (left / right)', min: -800, max: 800, step: 1 },
              { key: 'y', label: 'Move Y (up / down)', min: -400, max: 1000, step: 1 },
              { key: 'zoom', label: 'Zoom (in / out)', min: 0.5, max: 3, step: 0.01 },
            ]}
            defaults={DREAM_CIRCLE_TRANSFORMS[dreamTuneIdx]}
            onChange={(patch) =>
              setDreamTune((prev) =>
                prev.map((p, j) => (j === dreamTuneIdx ? { ...p, ...patch } : p))
              )
            }
            compact
          />
        </div>
      )}
    </>
  );

  const renderDisciplineTracker = () => (
    <div
      className="relative z-10 w-full px-4 pb-28 pt-2 sm:px-6 lg:px-10 lg:pb-12"
      style={mobileTrackerOverlap > 0 ? { marginTop: -mobileTrackerOverlap } : undefined}
    >
      <div className="mx-auto w-full max-w-6xl" data-tour="discipline-tracker">
        <GoalHeatmap
          startDate={goal.start_date || goal.created_at.slice(0, 10)}
          examDate={goal.exam_date}
          targetHours={Number(goal.daily_target_hours)}
          records={records}
        />
      </div>
    </div>
  );

  const renderOverlays = () => (
    <>
      {tourOpen && <CompeteTour onClose={dismissTour} />}
      {help && (
        <CompeteHelp
          anchor={help.anchor}
          title={help.type === 'dreams' ? 'Your dreams' : "Today's tree"}
          body={
            help.type === 'dreams'
              ? (goal.dream_images?.length ?? 0) >= 3
                ? 'You already have three dreams. Tap × on a dream to remove one, and the + button returns. Seeing them every day keeps you going.'
                : 'Add what you are working toward — a car, a place, a goal. Tap + to add a dream, or × on a dream to remove it. Seeing it every day keeps you going.'
              : "This card shows today's tracked focus against your daily goal. It resets every midnight. The Discipline tracker below your dreams has your full history."
          }
          onClose={() => setHelp(null)}
          onReplay={() => {
            setHelp(null);
            setTourOpen(true);
          }}
        />
      )}
    </>
  );

  // DESKTOP: a compact hero keeps the inline tracker close to the dreams.
  if (!isMobileVp) {
    return (
      <div className="relative flex h-full w-full flex-col overflow-y-auto">
        <div className="compete-stage relative h-[clamp(300px,38vh,340px)] w-full shrink-0 overflow-hidden bg-[#090b0a]">
          {renderScene(dreamTune)}
        </div>
        {renderDisciplineTracker()}
        {renderOverlays()}
      </div>
    );
  }

  // MOBILE: fixed portrait stage (405×855 contain-fit, centered), then the
  // tracker scrolls in below it.
  return (
    <div className="relative flex h-full w-full flex-col overflow-y-auto">
      <div ref={measureBox} className="relative h-full min-h-0 w-full shrink-0 overflow-hidden bg-[#090b0a]">
        <div
          className="compete-fixed-stage bg-[#090b0a]"
          style={{
            width: FIT_W,
            height: FIT_H,
            left: fitOX,
            top: fitOY,
            transform: `scale(${fitS})`,
            transformOrigin: '0 0',
          }}
        >
          {renderScene(MOBILE_DREAM_CIRCLE_TRANSFORMS)}
        </div>
      </div>
      {renderDisciplineTracker()}
      {renderOverlays()}
    </div>
  );
}

/** Setup: exam date + daily hours, tree metaphor, same layout as before. */
function SetupForm({ onCreated }: { onCreated: (goal: CompeteGoal) => Promise<void> | void }) {
  const { session } = useAuth();
  const [examDate, setExamDate] = useState('');
  const [hours, setHours] = useState('4');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = dateKey(new Date());
  const parsedHours = Number(hours);
  const valid = Boolean(examDate) && examDate >= today && parsedHours > 0;

  const submit = async () => {
    if (!session || !valid) return;
    setSubmitting(true);
    setError(null);
    try {
      const goal = await createGoal(session.user.id, examDate, parsedHours);
      await onCreated(goal);
    } catch (e) {
      console.error('Create goal error:', e);
      setError('Could not plant your goal. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-wrap animate-fade-in px-4 pb-28 pt-8 sm:px-6 sm:pt-14 lg:px-10">
      <div className="page-kicker">Set your goal</div>
      <h1 className="text-4xl font-extrabold leading-[1.08] text-stone-50 sm:text-5xl">
        Plant your goal. <span className="text-stone-600">Watch it grow.</span>
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-stone-400">
        Your exam date sets how many days you'll tend it. Hit your daily focus target, and today's
        tree grows to full bloom.
      </p>

      <div className="mt-8 max-w-xl space-y-5 rounded-[1.4rem] border border-white/[.07] bg-white/[.025] p-6">
        <div>
          <label htmlFor="exam-date" className="text-xs font-bold text-stone-300">
            When is your exam?
          </label>
          <input
            id="exam-date"
            type="date"
            min={today}
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/[.08] bg-black/30 px-4 py-3 text-sm text-stone-100 outline-none focus:border-lime-300/40"
          />
          {examDate && examDate >= today && (
            <div className="mt-2 text-xs text-stone-500">
              {daysBetween(today, examDate)} days of daily tending · grows from today
            </div>
          )}
        </div>

        <div>
          <label htmlFor="daily-hours" className="text-xs font-bold text-stone-300">
            How many hours will you study each day?
          </label>
          <input
            id="daily-hours"
            type="number"
            min="0.5"
            step="0.5"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/[.08] bg-black/30 px-4 py-3 text-sm text-stone-100 outline-none focus:border-lime-300/40"
          />
        </div>

        {error && <div className="text-xs font-bold text-red-400">{error}</div>}

        <button
          onClick={submit}
          disabled={!valid || submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-300 px-5 py-3 text-sm font-extrabold text-[#11130f] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sprout className="h-4 w-4" />}
          Start growing
        </button>

        <p className="text-xs leading-5 text-stone-600">
          Progress comes straight from your tracked focus sessions — nothing entered by hand. Each
          new day starts the tree over as a bare seedling.
        </p>
      </div>
    </div>
  );
}

