import { supabase } from './supabase';
import type { CompeteGoal } from '../types';

/**
 * Compete daily-tree data layer.
 *
 * The tree is a DAILY ritual: each calendar day it starts from a bare
 * seedling and grows with tracked focus minutes toward that day's target.
 * Numbers always come from real focus_sessions (never manual input); the
 * derived per-day records are persisted to compete_daily_progress so the
 * heatmap keeps real history across sessions.
 */

/** Day key matching the app's existing convention (stats.ts): ISO UTC date. */
export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseDay(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function addDays(key: string, days: number): string {
  const d = parseDay(key);
  d.setUTCDate(d.getUTCDate() + days);
  return dateKey(d);
}

/** Signed whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);
}

export interface DayRecord {
  date: string;
  minutesCompleted: number;
  targetMet: boolean;
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
      start_date: dateKey(new Date()),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as CompeteGoal;
}

/** Summed tracked focus MINUTES per day, from real focus_sessions only. */
export async function fetchMinutesByDate(userId: string, since: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const { data, error } = await supabase
    .from('focus_sessions')
    .select('started_at, duration_seconds')
    .eq('user_id', userId)
    .gte('started_at', `${since}T00:00:00.000Z`);
  if (error) throw error;
  for (const s of data || []) {
    const key = dateKey(new Date(s.started_at));
    map.set(key, (map.get(key) || 0) + s.duration_seconds / 60);
  }
  return map;
}

/**
 * One record per day from the goal's start through today (never past the
 * exam date). target_met is minutes >= daily target — the single definition
 * used by both the tree's completion state and the heatmap.
 */
export function buildDayRecords(
  goal: CompeteGoal,
  minutesByDate: Map<string, number>,
  today: string = dateKey(new Date()),
): DayRecord[] {
  const start = goal.start_date || goal.created_at.slice(0, 10);
  const end = daysBetween(today, goal.exam_date) >= 0 ? today : goal.exam_date;
  const total = daysBetween(start, end);
  if (total < 0) return [];
  const targetMinutes = Number(goal.daily_target_hours) * 60;
  const records: DayRecord[] = [];
  for (let i = 0; i <= total; i++) {
    const date = addDays(start, i);
    const minutes = Math.round(minutesByDate.get(date) || 0);
    records.push({ date, minutesCompleted: minutes, targetMet: minutes >= targetMinutes });
  }
  return records;
}

/**
 * Persist the derived day rows (one per day: date, minutes, target_met).
 * Bulk upsert keyed on goal_id+date. Returns false if the schema is not
 * applied yet — callers fall back to the computed records, which are the
 * same numbers, so nothing breaks in the meantime.
 */
export async function persistDayRecords(
  userId: string,
  goal: CompeteGoal,
  records: DayRecord[],
): Promise<boolean> {
  if (records.length === 0) return true;
  const payload = records.map((r) => ({
    user_id: userId,
    goal_id: goal.id,
    date: r.date,
    minutes_completed: r.minutesCompleted,
    target_met: r.targetMet,
  }));
  const { error } = await supabase
    .from('compete_daily_progress')
    .upsert(payload, { onConflict: 'goal_id,date' });
  if (error) {
    console.warn('Compete daily progress not persisted (apply the Supabase migration):', error.message);
    return false;
  }
  return true;
}

/** Load day rows from Supabase; null when the table/migration is missing. */
export async function fetchDayRecords(goalId: string): Promise<DayRecord[] | null> {
  const { data, error } = await supabase
    .from('compete_daily_progress')
    .select('date, minutes_completed, target_met')
    .eq('goal_id', goalId)
    .order('date', { ascending: true });
  if (error) return null;
  return (data || []).map((r: { date: string; minutes_completed: number; target_met: boolean }) => ({
    date: r.date,
    minutesCompleted: Number(r.minutes_completed),
    targetMet: Boolean(r.target_met),
  }));
}

/** Public bucket holding the Compete dream-image uploads. */
const DREAM_BUCKET = 'dream-images';

/** Upload a dream image to storage; resolves to its public URL. */
export async function uploadDreamImage(userId: string, file: File): Promise<string> {
  const extRaw = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ext = extRaw || 'jpg';
  const path = `${userId}/dream_${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(DREAM_BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(DREAM_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Persist the dream-image list on the goal row (UI enforces the max of 3). */
export async function saveDreamImages(goalId: string, images: string[]): Promise<void> {
  const { error } = await supabase
    .from('compete_goals')
    .update({ dream_images: images.slice(0, 3) })
    .eq('id', goalId);
  if (error) throw error;
}

/** Persist the dream-name pills (index-aligned with dream_images). */
export async function saveDreamNames(goalId: string, names: string[]): Promise<void> {
  const { error } = await supabase
    .from('compete_goals')
    .update({ dream_names: names.slice(0, 3) })
    .eq('id', goalId);
  if (error) throw error;
}

/** Best-effort storage cleanup when a dream circle is deleted. */
export async function deleteDreamImage(url: string): Promise<void> {
  const marker = `/object/public/${DREAM_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return;
  const path = url.slice(i + marker.length).split('?')[0];
  if (!path) return;
  try {
    await supabase.storage.from(DREAM_BUCKET).remove([path]);
  } catch {
    // orphaned objects are harmless; the row is already updated
  }
}
