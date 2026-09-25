import { useEffect, useState } from 'react';
import { ArrowLeft, Mountain, Flag, Clock3, Loader2, TrendingUp, ArrowUpRight, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  fetchActiveGoal,
  createGoal,
  syncCompeteProgress,
  fetchHoursByDate,
  daysUntil,
  computeTotalSteps,
} from '@/lib/compete';
import type { CompeteGoal } from '@/types';
import MountainScene from '@/components/compete/MountainScene';
import EverestScene3D from '@/components/compete/EverestScene3D';
import MountainTuner from '@/components/compete/MountainTuner';
import {
  DEFAULT_MOUNTAIN_TRANSFORM,
  type MountainTransform,
} from '@/components/compete/mountainConfig';

export default function CompeteScreen() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState<CompeteGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayHours, setTodayHours] = useState(0);
  const [mountainTransform, setMountainTransform] = useState<MountainTransform>(
    DEFAULT_MOUNTAIN_TRANSFORM,
  );

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const existing = await fetchActiveGoal(session.user.id);
        let current = existing;
        if (current) {
          // Honesty check on mount: awards steps for yesterday/today from
          // real tracked focus time, then re-reads the goal.
          current = await syncCompeteProgress(session.user.id, current);
          const today = new Date().toISOString().slice(0, 10);
          const hours = await fetchHoursByDate(session.user.id, [today]);
          if (!cancelled) setTodayHours(hours.get(today) || 0);
        }
        if (!cancelled) setGoal(current);
      } catch (e) {
        console.error('Compete load error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-stone-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  // Entry state mirrors the Friend Circle "study table" card: the climb view
  // (setup + mountain) only opens on click.
  if (!open) {
    return (
      <div className="page-wrap pb-24">
        <div className="page-kicker">Compete</div>
        <h2 className="page-title">Look how much you have climbed</h2>
        <p className="page-copy mb-7">One honest day of tracked focus moves you one step up the mountain.</p>

        {/* Progress, exam and today's hours live on the entry screen. */}
        {goal && (
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/[.07] bg-white/[.025] p-5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[.2em] text-stone-600">
                <span className="flex items-center gap-2"><Mountain className="h-3.5 w-3.5" /> Progress</span>
                <span className="flex items-center gap-1 text-lime-300">
                  <TrendingUp className="h-3 w-3" /> {Math.min(100, Math.round((goal.current_step / goal.total_steps) * 100))}%
                </span>
              </div>
              <div className="mt-3 font-display text-4xl font-extrabold tracking-[-.03em] text-stone-50">
                {goal.current_step}
                <span className="text-lg text-stone-600"> / {goal.total_steps}</span>
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-white/[.07] bg-white/[.025] p-5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-stone-600">
                <Flag className="h-3.5 w-3.5" /> Exam
              </div>
              <div className="mt-3 font-display text-4xl font-extrabold tracking-[-.03em] text-stone-50">
                {daysUntil(goal.exam_date)}
              </div>
              <div className="mt-1 text-xs text-stone-600">days remaining</div>
            </div>

            <div className="rounded-[1.4rem] border border-white/[.07] bg-white/[.025] p-5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-stone-600">
                <Clock3 className="h-3.5 w-3.5" /> Today
              </div>
              <div className="mt-3 font-display text-4xl font-extrabold tracking-[-.03em] text-stone-50">
                {todayHours.toFixed(1)}
                <span className="text-lg text-stone-600"> / {goal.daily_target_hours}h</span>
              </div>
              <div className="mt-1 text-xs text-stone-600">tracked focus vs target</div>
            </div>
          </div>
        )}

        {/* Setup lives here too; once set, the details lock. */}
        {!goal && <SetupForm onCreated={setGoal} />}
        {goal && (
          <div className="mb-6 flex items-center gap-3 rounded-[1.4rem] border border-white/[.07] bg-white/[.025] p-4 text-xs text-stone-500">
            <Lock className="h-3.5 w-3.5 text-stone-600" />
            <span>
              Goal locked — exam {goal.exam_date}, {goal.daily_target_hours}h daily target.
              Set once so the climb stays honest.
            </span>
          </div>
        )}

        <button
          onClick={() => setOpen(true)}
          className="group flex w-full items-center justify-between rounded-[1.4rem] border border-lime-300/15 bg-lime-300/[.05] p-5 text-left transition hover:border-lime-300/35 hover:bg-lime-300/[.08] sm:p-6"
        >
          <span className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lime-300/10 text-lime-300">
              <Mountain className="h-5 w-5" />
            </span>
            <span>
              <span className="font-display block text-sm font-bold text-stone-100">
                {goal ? 'Your mountain' : 'Start your climb'}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-stone-500">
                {goal
                  ? `${goal.current_step} of ${goal.total_steps} steps climbed — open your mountain.`
                  : 'Set your exam date and daily target to begin.'}
              </span>
            </span>
          </span>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-lime-300 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
      </div>
    );
  }

  // The opened view is the mountain only — nothing else.
  if (!goal) {
    return (
      <ClimbShell onBack={() => setOpen(false)}>
        <div className="flex h-full items-center justify-center pt-16">
          <MountainScene totalSteps={1} currentStep={0} />
        </div>
      </ClimbShell>
    );
  }

  return (
    <ClimbShell onBack={() => setOpen(false)}>
      <div className="absolute inset-0">
        <EverestScene3D transform={mountainTransform} />
      </div>
      <div className="absolute bottom-4 right-4 z-20 w-60">
        <MountainTuner
          transform={mountainTransform}
          onChange={(patch) => setMountainTransform((t) => ({ ...t, ...patch }))}
        />
      </div>
    </ClimbShell>
  );
}

/** Full-screen climb view, mirroring StudyTableScreen's fixed chrome. */
function ClimbShell({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#090b0a]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-4 sm:p-6">
        <button
          onClick={onBack}
          className="icon-button pointer-events-auto flex h-10 items-center gap-2 px-3.5 text-xs font-bold"
          aria-label="Back to Compete"
        >
          <ArrowLeft className="h-4 w-4" />
          Compete
        </button>
      </div>
      {children}
    </div>
  );
}

function SetupForm({ onCreated }: { onCreated: (goal: CompeteGoal) => void }) {
  const { session } = useAuth();
  const [examDate, setExamDate] = useState('');
  const [hours, setHours] = useState('4');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const parsedHours = Number(hours);
  const valid = examDate && examDate >= today && parsedHours > 0;

  const submit = async () => {
    if (!session || !valid) return;
    setSubmitting(true);
    setError(null);
    try {
      const goal = await createGoal(session.user.id, examDate, parsedHours);
      onCreated(goal);
    } catch (e) {
      console.error('Create goal error:', e);
      setError('Could not create your goal. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-kicker">Set your climb</div>
      <h1 className="text-4xl font-extrabold leading-[1.08] text-stone-50 sm:text-5xl">
        Pick a summit. <span className="text-stone-600">Start climbing.</span>
      </h1>
      <p className="mt-3 text-sm leading-6 text-stone-400">
        Your exam date sets the mountain's height. Each day you hit your tracked focus target,
        you climb one step.
      </p>

      <div className="mt-8 space-y-5 rounded-[1.4rem] border border-white/[.07] bg-white/[.025] p-6">
        <div>
          <label htmlFor="exam-date" className="text-xs font-bold text-stone-300">When is your exam?</label>
          <input
            id="exam-date"
            type="date"
            min={today}
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/[.08] bg-black/30 px-4 py-3 text-sm text-stone-100 outline-none focus:border-lime-300/40"
          />
          {examDate && (
            <div className="mt-2 text-xs text-stone-500">
              {computeTotalSteps(examDate)} steps · {daysUntil(examDate)} days away
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
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Start the climb
        </button>
      </div>
    </div>
  );
}
