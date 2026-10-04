import { useCallback, useEffect, useState } from 'react';
import { Loader2, Sprout } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import TreeVideo from '@/components/compete/TreeVideo';
import SoilOverlay from '@/components/compete/SoilOverlay';
import DreamPicker from '@/components/compete/DreamPicker';
import PlacementTuner from '@/components/compete/PlacementTuner';
import {
  DEFAULT_VIDEO_TRANSFORM,
  DEFAULT_IMAGE_TRANSFORM,
  DEFAULT_VIDEO_MASK,
  type SliderRow,
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

/** Slim Progress slider is hidden for now — the tree sits at a static 97%. */
const SHOW_PROGRESS_SLIDER = false;
/** Scrub cap: the slider never goes past 97%. */
const PROGRESS_CAP = 0.97;

/**
 * Dream tuner: independent zoom / move X / move Y per circle (0..2).
 * Identity until tuned — calibration only, values get hardcoded once final.
 */
const DREAM_TUNE_DEFAULTS: Record<string, number> = {
  d0zoom: 1, d0x: 0, d0y: 0,
  d1zoom: 1, d1x: 0, d1y: 0,
  d2zoom: 1, d2x: 0, d2y: 0,
};

/**
 * Compete: the daily-tree ritual.
 *
 * - Setup (tree wording) until a goal exists: exam date + daily hours.
 * - The tree view: the growth video seeks with today's tracked
 *   focus vs the daily target — every calendar day it starts over from a
 *   bare seedling, over a static soil overlay.
 * - Dream circles crown the tree (max 3) with a per-circle Dream tuner.
 *   Placement + progress are hardcoded (progress static 97%, slider hidden).
 *   Card + heatmap + other tuner panels stay hidden.
 */
export default function CompeteScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState<CompeteGoal | null>(null);
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [progressOverride, setProgressOverride] = useState<number | null>(null);
  const [dreamBusy, setDreamBusy] = useState(false);
  const [dreamTune, setDreamTune] = useState<Record<string, number>>(DREAM_TUNE_DEFAULTS);

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
  const todayMinutes = records.find((r) => r.date === today)?.minutesCompleted ?? 0;
  const autoProgress = Math.min(1, todayMinutes / targetMinutes);
  const scrubbed = Math.min(PROGRESS_CAP, progressOverride ?? autoProgress);
  const progress = SHOW_PROGRESS_SLIDER ? scrubbed : PROGRESS_CAP;

  // Dream tuner: one zoom/X/Y group per existing circle, all independent.
  const dreamCount = Math.min((goal.dream_images ?? []).length, 3);
  const dreamRows: SliderRow<Record<string, number>>[] = [];
  for (let i = 0; i < dreamCount; i++) {
    dreamRows.push(
      { key: `d${i}zoom`, label: `Circle ${i + 1} · Zoom`, min: 0.5, max: 3, step: 0.01 },
      { key: `d${i}x`, label: `Circle ${i + 1} · Move X (left / right)`, min: -100, max: 100, step: 1 },
      { key: `d${i}y`, label: `Circle ${i + 1} · Move Y (up / down)`, min: -100, max: 100, step: 1 },
    );
  }
  const dreamTransforms = [0, 1, 2].map((i) => ({
    x: dreamTune[`d${i}x`] ?? 0,
    y: dreamTune[`d${i}y`] ?? 0,
    zoom: dreamTune[`d${i}zoom`] ?? 1,
  }));

  return (
    <div className="relative flex h-full w-full flex-col overflow-y-auto">
      {/* ── Daily tree stage (full-bleed) ───────────────────────────────── */}
      <div className="relative h-full min-h-[480px] w-full shrink-0 overflow-hidden bg-[#090b0a]">
        <TreeVideo transform={DEFAULT_VIDEO_TRANSFORM} mask={DEFAULT_VIDEO_MASK} progress={progress} />
        <SoilOverlay transform={DEFAULT_IMAGE_TRANSFORM} />

        {/* Dream images: bare glow circles crowning the tree */}
        <DreamPicker
          images={goal.dream_images ?? []}
          transforms={dreamTransforms}
          busy={dreamBusy}
          onAdd={addDream}
          onRemove={removeDream}
        />

        {/* Slim progress slider — hidden for now, capped at 97% */}
        {SHOW_PROGRESS_SLIDER && (
          <div className="absolute bottom-4 left-4 z-20 w-44 sm:bottom-6 sm:left-6">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[.2em] text-stone-500">
              <span>Progress</span>
              <span className="font-mono text-stone-400">{Math.round(progress * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={PROGRESS_CAP}
              step={0.01}
              value={scrubbed}
              onChange={(e) => {
                const v = Number(e.target.value);
                console.log('[compete-progress]', `{ progress: ${v.toFixed(2)} }`);
                setProgressOverride(v === autoProgress ? null : v);
              }}
              className="mt-1.5 w-full accent-lime-300"
            />
          </div>
        )}

        {/* Dream tuner: per-circle zoom / move (visible once a circle exists) */}
        {dreamCount > 0 && (
          <div className="absolute bottom-4 right-4 z-20 flex w-60 flex-col gap-3 sm:bottom-6 sm:right-6">
            <PlacementTuner
              title="Dream tuner (per circle)"
              logTag="compete-dream"
              rows={dreamRows}
              defaults={DREAM_TUNE_DEFAULTS}
              transform={dreamTune}
              onChange={(patch) =>
                setDreamTune((t) => {
                  const next = { ...t };
                  for (const [k, v] of Object.entries(patch)) {
                    if (typeof v === 'number') next[k] = v;
                  }
                  return next;
                })
              }
            />
          </div>
        )}
      </div>
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
