import { supabase } from "./supabase";
import type { CompeteGoal } from "../types";

/**
 * Compete daily-tree data layer.
 *
 * The tree is a DAILY ritual: each calendar day it starts from a bare
 * seedling and grows with tracked focus minutes toward that day's target.
 * Numbers always come from real focus_sessions (never manual input); the
 * derived per-day records are persisted to compete_daily_progress so the
 * heatmap keeps real history across sessions.
 */

/** Date-math key (UTC-safe for parseDay/addDays). */
export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The user's local calendar key, used for "today" and session bucketing. */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(now: Date = new Date()): string {
  return localDateKey(now);
}

export function formatFocusDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
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
  return Math.round(
    (parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000,
  );
}

export interface DayRecord {
  date: string;
  minutesCompleted: number;
  /** Snapshot of the target on this date (never the current goal for old days). */
  targetMinutes: number;
  targetMet: boolean;
}

export async function fetchActiveGoal(
  userId: string,
): Promise<CompeteGoal | null> {
  const { data, error } = await supabase
    .from("compete_goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as CompeteGoal) ?? null;
}

export async function createGoal(
  userId: string,
  examDate: string,
  dailyTargetHours: number,
  dreamImages: string[] = [],
): Promise<CompeteGoal> {
  const { data, error } = await supabase
    .from("compete_goals")
    .insert({
      user_id: userId,
      exam_date: examDate,
      daily_target_hours: dailyTargetHours,
      start_date: todayKey(),
      dream_images: dreamImages.slice(0, 1),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CompeteGoal;
}

/** Summed tracked focus MINUTES per local day, from real focus_sessions only. */
export async function fetchMinutesByDate(
  userId: string,
  since: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  // Fetch one extra UTC day so a local-midnight boundary is never missed.
  const queryFrom = `${addDays(since, -1)}T00:00:00.000Z`;
  const { data, error } = await supabase
    .from("focus_sessions")
    .select("started_at, duration_seconds")
    .eq("user_id", userId)
    .gte("started_at", queryFrom);
  if (error) throw error;
  for (const s of data || []) {
    const key = localDateKey(new Date(s.started_at));
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
  today: string = todayKey(),
  savedTargets?: Map<string, number>,
): DayRecord[] {
  const start = goal.start_date || goal.created_at.slice(0, 10);
  const end = daysBetween(today, goal.exam_date) >= 0 ? today : goal.exam_date;
  const total = daysBetween(start, end);
  if (total < 0) return [];
  const currentTarget = Number(goal.daily_target_hours) * 60;
  const records: DayRecord[] = [];
  for (let i = 0; i <= total; i++) {
    const date = addDays(start, i);
    const minutes = Math.round(minutesByDate.get(date) || 0);
    // Past days keep their saved target. Today always uses the current goal so
    // a goal edit applies immediately; future days do too.
    const saved = date < today ? savedTargets?.get(date) : undefined;
    const targetMinutes = saved && saved > 0 ? saved : currentTarget;
    records.push({
      date,
      minutesCompleted: minutes,
      targetMinutes,
      targetMet: minutes >= targetMinutes,
    });
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
    target_minutes: r.targetMinutes,
    target_met: r.targetMet,
  }));
  let { error } = await supabase
    .from("compete_daily_progress")
    .upsert(payload, { onConflict: "goal_id,date" });
  // Graceful fallback before the target snapshot migration is applied.
  if (error && /target_minutes/i.test(error.message)) {
    const legacy = payload.map((r) => ({
      user_id: r.user_id,
      goal_id: r.goal_id,
      date: r.date,
      minutes_completed: r.minutes_completed,
      target_met: r.target_met,
    }));
    const retry = await supabase
      .from("compete_daily_progress")
      .upsert(legacy, { onConflict: "goal_id,date" });
    error = retry.error;
  }
  if (error) {
    console.warn(
      "Compete daily progress not persisted (apply the Supabase migration):",
      error.message,
    );
    return false;
  }
  return true;
}

/** Load day rows from Supabase; null when the table/migration is missing. */
export async function fetchDayRecords(
  goalId: string,
): Promise<DayRecord[] | null> {
  const { data, error } = await supabase
    .from("compete_daily_progress")
    .select("date, minutes_completed, target_minutes, target_met")
    .eq("goal_id", goalId)
    .order("date", { ascending: true });
  if (error) return null;
  return (data || []).map(
    (r: {
      date: string;
      minutes_completed: number;
      target_minutes: number | null;
      target_met: boolean;
    }) => ({
      date: r.date,
      minutesCompleted: Number(r.minutes_completed),
      targetMinutes: Number(r.target_minutes) || 0,
      targetMet: Boolean(r.target_met),
    }),
  );
}

export interface DaySession {
  startedAt: string;
  minutes: number;
  subject: string | null;
}

/** Real focus sessions for one local day, used by the day-detail sheet. */
export async function fetchDaySessions(
  userId: string,
  date: string,
): Promise<DaySession[]> {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T00:00:00`);
  end.setDate(end.getDate() + 1);
  const { data, error } = await supabase
    .from("focus_sessions")
    .select("started_at, duration_seconds, subject_tag")
    .eq("user_id", userId)
    .gte("started_at", start.toISOString())
    .lt("started_at", end.toISOString())
    .order("started_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((s) => ({
    startedAt: s.started_at,
    minutes: Number(s.duration_seconds) / 60,
    subject: s.subject_tag?.trim() || null,
  }));
}

/** Public bucket holding the Compete dream-image uploads. */
const DREAM_BUCKET = "dream-images";

/** Upload a dream image to storage; resolves to its public URL. */
export async function uploadDreamImage(
  userId: string,
  file: File,
): Promise<string> {
  const extRaw = (file.name.split(".").pop() || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const ext = extRaw || "jpg";
  const path = `${userId}/dream_${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(DREAM_BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw error;
  const { data } = supabase.storage.from(DREAM_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Persist the dream-image list on the goal row (UI enforces the max of 3). */
export async function saveDreamImages(
  goalId: string,
  images: string[],
): Promise<void> {
  const { error } = await supabase
    .from("compete_goals")
    .update({ dream_images: images.slice(0, 3) })
    .eq("id", goalId);
  if (error) throw error;
}

/** Best-effort storage cleanup when a dream circle is deleted. */
export async function deleteDreamImage(url: string): Promise<void> {
  const marker = `/object/public/${DREAM_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return;
  const path = url.slice(i + marker.length).split("?")[0];
  if (!path) return;
  try {
    await supabase.storage.from(DREAM_BUCKET).remove([path]);
  } catch {
    // orphaned objects are harmless; the row is already updated
  }
}

export interface GoalSummary {
  daysTicked: number;
  daysMissed: number;
  totalMinutes: number;
  longestTickStreak: number;
}

/** Real numbers only, from the goal's persisted/computed day records. */
export function buildGoalSummary(records: DayRecord[]): GoalSummary {
  let daysTicked = 0;
  let daysMissed = 0;
  let totalMinutes = 0;
  let current = 0;
  let longest = 0;
  for (const record of records) {
    totalMinutes += record.minutesCompleted;
    if (record.targetMet) {
      daysTicked += 1;
      current += 1;
      longest = Math.max(longest, current);
    } else {
      daysMissed += 1;
      current = 0;
    }
  }
  return {
    daysTicked,
    daysMissed,
    totalMinutes: Math.round(totalMinutes),
    longestTickStreak: longest,
  };
}

/** Completion starts the day AFTER the exam date (local calendar). */
export function isGoalComplete(
  goal: CompeteGoal,
  today: string = todayKey(),
): boolean {
  return Boolean(goal.completed_at) || today > goal.exam_date;
}

export async function archiveGoal(
  goalId: string,
  summary: GoalSummary,
): Promise<void> {
  const { error } = await supabase
    .from("compete_goals")
    .update({
      completed_at: new Date().toISOString(),
      completed_summary: summary,
    })
    .eq("id", goalId);
  if (error) throw error;
}
