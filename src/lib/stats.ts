import { supabase } from './supabase';
import type { FocusSession, QuickStartConfig } from '../types';
import type { FocusVisualTheme } from '../components/focus-visuals/types';

export type { QuickStartConfig } from '../types';

export interface Stats {
  todayMinutes: number;
  weekMinutes: number;
  monthMinutes: number;
  currentStreak: number;
  longestStreak: number;
  totalMinutes: number;
  last7Days: { date: string; minutes: number }[];
  last30Days: { date: string; minutes: number }[];
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function fetchStats(userId: string, extended: boolean): Promise<Stats> {
  const days = extended ? 30 : 7;
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('focus_sessions')
    .select('started_at, duration_seconds, completed_fully')
    .eq('user_id', userId)
    .gte('started_at', since.toISOString())
    .order('started_at', { ascending: false });

  if (error) throw error;

  const sessions = (data || []) as Pick<FocusSession, 'started_at' | 'duration_seconds' | 'completed_fully'>[];

  const now = new Date();
  const todayKey = dateKey(now);

  let todayMinutes = 0;
  let totalMinutes = 0;
  const dayMap = new Map<string, number>();

  for (const s of sessions) {
    const mins = s.duration_seconds / 60;
    totalMinutes += mins;
    const key = dateKey(new Date(s.started_at));
    dayMap.set(key, (dayMap.get(key) || 0) + mins);
    if (key === todayKey) todayMinutes += mins;
  }

  const last7Days = buildDayArray(7, dayMap);
  const last30Days = buildDayArray(30, dayMap);

  const weekMinutes = last7Days.reduce((a, d) => a + d.minutes, 0);
  const monthMinutes = last30Days.reduce((a, d) => a + d.minutes, 0);

  const { currentStreak, longestStreak } = computeStreaks(dayMap);

  return {
    todayMinutes: Math.round(todayMinutes),
    weekMinutes: Math.round(weekMinutes),
    monthMinutes: Math.round(monthMinutes),
    currentStreak,
    longestStreak,
    totalMinutes: Math.round(totalMinutes),
    last7Days,
    last30Days,
  };
}

function buildDayArray(days: number, dayMap: Map<string, number>) {
  const arr: { date: string; minutes: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    arr.push({ date: key, minutes: Math.round(dayMap.get(key) || 0) });
  }
  return arr;
}

function computeStreaks(dayMap: Map<string, number>): { currentStreak: number; longestStreak: number } {
  const activeDays = new Set<string>();
  for (const [key, mins] of dayMap.entries()) {
    if (mins > 0) activeDays.add(key);
  }

  let currentStreak = 0;
  const today = new Date();
  const cursor = new Date(today);
  if (!(dayMap.get(dateKey(cursor)) || 0 > 0)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while ((dayMap.get(dateKey(cursor)) || 0) > 0) {
    currentStreak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  let longestStreak = 0;
  let run = 0;
  const sortedDays = Array.from(activeDays).sort();
  let prev: string | null = null;
  for (const day of sortedDays) {
    if (prev) {
      const prevDate = new Date(prev + 'T00:00:00Z');
      const thisDate = new Date(day + 'T00:00:00Z');
      const diff = (thisDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) run++;
      else run = 1;
    } else {
      run = 1;
    }
    longestStreak = Math.max(longestStreak, run);
    prev = day;
  }

  return { currentStreak, longestStreak };
}

export interface FriendStat {
  profile: { id: string; display_name: string; friend_code: string };
  todayMinutes: number;
  currentStreak: number;
}

export async function fetchFriendStat(friendId: string): Promise<FriendStat> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, friend_code')
    .eq('id', friendId)
    .maybeSingle();

  if (!profile) throw new Error('Friend profile not found');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data: sessions } = await supabase
    .from('focus_sessions')
    .select('started_at, duration_seconds')
    .eq('user_id', friendId)
    .gte('started_at', today.toISOString());

  const sList = sessions || [];
  const todayMinutes = sList
    .filter((s) => dateKey(new Date(s.started_at)) === dateKey(new Date()))
    .reduce((a, s) => a + s.duration_seconds / 60, 0);

  const dayMap = new Map<string, number>();
  for (const s of sList) {
    const key = dateKey(new Date(s.started_at));
    dayMap.set(key, (dayMap.get(key) || 0) + s.duration_seconds / 60);
  }
  const { currentStreak } = computeStreaks(dayMap);

  return {
    profile: profile as { id: string; display_name: string; friend_code: string },
    todayMinutes: Math.round(todayMinutes),
    currentStreak,
  };
}

export async function fetchRecentSessions(userId: string, limit: number = 6): Promise<FocusSession[]> {
  const { data, error } = await supabase
    .from('focus_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as FocusSession[];
}

export async function fetchAcceptedFriends(userId: string): Promise<FriendStat[]> {
  const { data: friendships, error: fErr } = await supabase
    .from('friendships')
    .select('id, user_id, friend_id, status')
    .eq('status', 'accepted')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

  if (fErr) throw fErr;

  const friendIds = (friendships || []).map((f) =>
    f.user_id === userId ? f.friend_id : f.user_id
  );

  const statsPromises = friendIds.map((id) => fetchFriendStat(id).catch(() => null));
  const stats = await Promise.all(statsPromises);
  return stats.filter((s): s is FriendStat => s !== null);
}

export function getLastQuickStart(): QuickStartConfig | null {
  const raw = localStorage.getItem('valuable-last-session');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as QuickStartConfig;
  } catch {
    return null;
  }
}

export function setQuickStart(config: QuickStartConfig): void {
  localStorage.setItem('valuable-last-session', JSON.stringify(config));
}

export function consumeQuickStart(): QuickStartConfig | null {
  const raw = sessionStorage.getItem('valuable-quick-start');
  if (!raw) return null;
  try {
    const config = JSON.parse(raw) as QuickStartConfig;
    sessionStorage.removeItem('valuable-quick-start');
    return config;
  } catch {
    return null;
  }
}

export function requestQuickStart(config: QuickStartConfig): void {
  sessionStorage.setItem('valuable-quick-start', JSON.stringify(config));
}

export function isValidVisualTheme(theme: string): theme is FocusVisualTheme {
  return ['hourglass', 'tree', 'jar', 'blade', 'horse'].includes(theme);
}
