import { supabase } from './supabase';
import type { CompeteGoal } from '../types';

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Whole days from today until the exam date (0 if the exam is today). */
export function daysUntil(examDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exam = new Date(`${examDate}T00:00:00`);
  return Math.max(0, Math.round((exam.getTime() - today.getTime()) / 86_400_000));
}

/** Total climb steps: one per day from today through the exam date. */
export function computeTotalSteps(examDate: string): number {
  return Math.max(1, daysUntil(examDate) + 1);
}

export async function fetchActiveGoal(userId: string): Promise<CompeteGoal | null> {
  const { data, error } = await supabase
    .from('compete_goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as CompeteGoal) ?? null;
}

export async function createGoal(
  userId: string,
  examDate: string,
  dailyTargetHours: number,
): Promise<CompeteGoal> {
  const { data, error } = await supabase
    .from('compete_goals')
    .insert({
      user_id: userId,
      exam_date: examDate,
      daily_target_hours: dailyTargetHours,
      total_steps: computeTotalSteps(examDate),
      current_step: 0,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as CompeteGoal;
}

/** Summed tracked focus hours per date, from real focus_sessions only. */
export async function fetchHoursByDate(
  userId: string,
  dates: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (dates.length === 0) return result;

  const earliest = new Date(`${[...dates].sort()[0]}T00:00:00`);
  const { data, error } = await supabase
    .from('focus_sessions')
    .select('started_at, duration_seconds')
    .eq('user_id', userId)
    .gte('started_at', earliest.toISOString());
  if (error) throw error;

  for (const date of dates) result.set(date, 0);
  for (const s of data || []) {
    const key = dateKey(new Date(s.started_at));
    if (result.has(key)) {
      result.set(key, (result.get(key) || 0) + s.duration_seconds / 3600);
    }
  }
  return result;
}

/**
 * Daily honesty check: reads real tracked focus hours for yesterday + today
 * and awards at most one step per qualifying day. The step_awarded flip is an
 * atomic claim (update ... where step_awarded = false), so re-running this —
 * even from two tabs — can never double-increment a day.
 */
export async function syncCompeteProgress(userId: string, goal: CompeteGoal): Promise<CompeteGoal> {
  const today = new Date();
  const dates = [1, 0].map((offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    return dateKey(d);
  });

  const hoursByDate = await fetchHoursByDate(userId, dates);

  for (const date of dates) {
    const hours = hoursByDate.get(date) || 0;
    const { error: upsertError } = await supabase
      .from('compete_daily_progress')
      .upsert(
        { user_id: userId, goal_id: goal.id, date, hours_completed: Number(hours.toFixed(2)) },
        { onConflict: 'goal_id,date' },
      );
    if (upsertError) throw upsertError;

    if (hours < goal.daily_target_hours) continue;

    // Claim the day: only the request that flips false -> true earns the step.
    const { data: claimed, error: claimError } = await supabase
      .from('compete_daily_progress')
      .update({ step_awarded: true })
      .eq('goal_id', goal.id)
      .eq('date', date)
      .eq('step_awarded', false)
      .select('id');
    if (claimError) throw claimError;
    if (claimed && claimed.length > 0) {
      const { error: rpcError } = await supabase.rpc('increment_compete_step', {
        p_goal_id: goal.id,
      });
      if (rpcError) throw rpcError;
    }
  }

  const refreshed = await fetchActiveGoal(userId);
  return refreshed ?? goal;
}
