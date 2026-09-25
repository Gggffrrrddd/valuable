import { useEffect, useState } from 'react';
import { Mountain, Flag, Clock3, Loader2 } from 'lucide-react';
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

export default function CompeteScreen() {
  const { session } = useAuth();
  const [goal, setGoal] = useState<CompeteGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayHours, setTodayHours] = useState(0);

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

  if (!goal) {
    return <SetupForm onCreated={setGoal} />;
  }

  const remaining = daysUntil(goal.exam_date);
  const pct = Math.min(100, Math.round((goal.current_step / goal.total_steps) * 100));

  return (
    <div className="mx-auto max-w-6xl animate-fade-in pt-7 sm:pt-12 lg:pt-16">
      <div className="px-1">
        <div className="page-kicker">The climb</div>
        <h1 className="text-4xl font-extrabold leading-[1.08] text-stone-50 sm:text-5xl">
          Every honest day <span className="text-lime-300">climbs.</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-stone-400">
          Hit your daily target of {goal.daily_target_hours}h of tracked focus and you rise one
          step. No manual check-ins — the mountain only moves when you actually study.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
        <MountainScene totalSteps={goal.total_steps} currentStep={goal.current_step} />

        <div className="space-y-4">
          <div className="rounded-[1.4rem] border border-white/[.07] bg-white/[.025] p-5">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-stone-600">
              <Mountain className="h-3.5 w-3.5" /> Progress
            </div>
            <div className="mt-3 font-display text-3xl font-extrabold text-stone-50">
              {goal.current_step}
              <span className="text-lg text-stone-600"> / {goal.total_steps}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[.06]">
              <div className="h-full rounded-full bg-lime-300 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="rounded-[1.4rem] border border-white/[.07] bg-white/[.025] p-5">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-stone-600">
              <Flag className="h-3.5 w-3.5" /> Exam
            </div>
            <div className="mt-3 font-display text-3xl font-extrabold text-stone-50">{remaining}</div>
            <div className="mt-1 text-xs text-stone-600">days remaining</div>
          </div>

          <div className="rounded-[1.4rem] border border-white/[.07] bg-white/[.025] p-5">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-stone-600">
              <Clock3 className="h-3.5 w-3.5" /> Today
            </div>
            <div className="mt-3 font-display text-3xl font-extrabold text-stone-50">
              {todayHours.toFixed(1)}
              <span className="text-lg text-stone-600"> / {goal.daily_target_hours}h</span>
            </div>
            <div className="mt-1 text-xs text-stone-600">tracked focus vs target</div>
          </div>
        </div>
      </div>
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
    <div className="mx-auto max-w-xl animate-fade-in pt-7 sm:pt-12 lg:pt-16">
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
