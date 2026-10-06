import { supabase } from './supabase';
import type { FocusSession } from '../types';

export interface Stats {
  todayMinutes: number;
  weekMinutes: number;
  lastWeekMinutes: number;
  monthMinutes: number;
  lastMonthMinutes: number;
  totalMinutes: number;

  currentStreak: number;
  longestStreak: number;

  sessionsCompleted: number;
  sessionsTotal: number;

  last30Days: { date: string; minutes: number }[];
  last90Days: { date: string; minutes: number }[];

  subjects: { name: string; minutes: number; percentage: number }[];
  timeOfDay: { morning: number; afternoon: number; evening: number; night: number; peak: string };

  writtenInsight: string;
  milestones: {
    id: string;
    title: string;
    description: string;
    unlocked: boolean;
    icon: string;
  }[];
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function fetchStats(userId: string): Promise<Stats> {
  // Fetch ALL sessions for this user to compute accurate all-time stats, streaks, etc.
  // In a massive production app, we'd paginate or use RPC, but this is fine for now.
  const { data, error } = await supabase
    .from('focus_sessions')
    .select('started_at, duration_seconds, completed_fully, subject_tag')
    .eq('user_id', userId)
    .order('started_at', { ascending: false });

  if (error) throw error;

  const sessions = (data || []) as Pick<FocusSession, 'started_at' | 'duration_seconds' | 'completed_fully' | 'subject_tag'>[];

  const now = new Date();
  const todayStr = dateKey(now);
  
  let todayMinutes = 0;
  let totalMinutes = 0;
  let weekMinutes = 0;
  let lastWeekMinutes = 0;
  let monthMinutes = 0;
  let lastMonthMinutes = 0;
  
  let sessionsCompleted = 0;
  const sessionsTotal = sessions.length;

  const dayMap = new Map<string, number>();
  const subjectMap = new Map<string, number>();
  
  let morning = 0;   // 6 AM - 12 PM
  let afternoon = 0; // 12 PM - 5 PM
  let evening = 0;   // 5 PM - 10 PM
  let night = 0;     // 10 PM - 6 AM

  // Calculate cutoffs for comparisons
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday as start
  
  const startOfLastWeek = new Date(startOfWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
  
  const startOfMonth = new Date(startOfToday);
  startOfMonth.setDate(startOfMonth.getDate() - 30); // Using 30 days rolling
  
  const startOfLastMonth = new Date(startOfMonth);
  startOfLastMonth.setDate(startOfLastMonth.getDate() - 30);

  for (const s of sessions) {
    const mins = s.duration_seconds / 60;
    const sessionDate = new Date(s.started_at);
    const key = dateKey(sessionDate);
    
    totalMinutes += mins;
    if (s.completed_fully) sessionsCompleted++;
    
    dayMap.set(key, (dayMap.get(key) || 0) + mins);
    
    if (key === todayStr) todayMinutes += mins;
    
    // Time categorizations
    if (sessionDate >= startOfWeek) {
      weekMinutes += mins;
    } else if (sessionDate >= startOfLastWeek) {
      lastWeekMinutes += mins;
    }
    
    if (sessionDate >= startOfMonth) {
      monthMinutes += mins;
    } else if (sessionDate >= startOfLastMonth) {
      lastMonthMinutes += mins;
    }
    
    // Subjects
    const subj = s.subject_tag || 'Untagged';
    subjectMap.set(subj, (subjectMap.get(subj) || 0) + mins);
    
    // Time of day
    const hour = sessionDate.getHours();
    if (hour >= 6 && hour < 12) morning += mins;
    else if (hour >= 12 && hour < 17) afternoon += mins;
    else if (hour >= 17 && hour < 22) evening += mins;
    else night += mins;
  }

  const last30Days = buildDayArray(30, dayMap);
  const last90Days = buildDayArray(90, dayMap);

  const { currentStreak, longestStreak } = computeStreaks(dayMap);

  // Subject formatting
  const sortedSubjects = Array.from(subjectMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, minutes]) => ({
      name,
      minutes: Math.round(minutes),
      percentage: totalMinutes > 0 ? (minutes / totalMinutes) * 100 : 0
    }));

  // Time of Day calculations
  let peak = 'Morning';
  let maxTime = morning;
  if (afternoon > maxTime) { peak = 'Afternoon'; maxTime = afternoon; }
  if (evening > maxTime) { peak = 'Evening'; maxTime = evening; }
  if (night > maxTime) { peak = 'Night'; maxTime = night; }

  // Generate Insights
  let writtenInsight = "Welcome to Valuable! Start focusing to build your metrics.";
  if (totalMinutes > 0) {
    if (currentStreak > 3) {
      writtenInsight = `You're on a ${currentStreak}-day roll. Keep the momentum going!`;
    } else if (weekMinutes > lastWeekMinutes && lastWeekMinutes > 0) {
      const pct = Math.round(((weekMinutes - lastWeekMinutes) / lastWeekMinutes) * 100);
      writtenInsight = `You're ${pct}% more focused than last week. Great job!`;
    } else {
      writtenInsight = `Your best focus window is usually in the ${peak.toLowerCase()}.`;
    }
  }

  // Generate Milestones
  const milestones = [
    { id: 'streak-7', title: '7-Day Streak', description: 'Focused for 7 days in a row.', unlocked: longestStreak >= 7, icon: 'flame' },
    { id: 'streak-30', title: '30-Day Streak', description: 'Focused for 30 days in a row.', unlocked: longestStreak >= 30, icon: 'flame' },
    { id: 'hours-10', title: '10 Hours Total', description: 'Reached 10 total hours of focus.', unlocked: totalMinutes >= 600, icon: 'hourglass' },
    { id: 'hours-50', title: '50 Hours Total', description: 'Reached 50 total hours of focus.', unlocked: totalMinutes >= 3000, icon: 'hourglass' },
    { id: 'sessions-10', title: '10 Sessions', description: 'Completed 10 focus sessions.', unlocked: sessionsCompleted >= 10, icon: 'check' },
    { id: 'subject-master', title: 'Subject Master', description: 'Spent 20+ hours on a single subject.', unlocked: sortedSubjects.some(s => s.minutes >= 1200), icon: 'star' }
  ];

  return {
    todayMinutes: Math.round(todayMinutes),
    weekMinutes: Math.round(weekMinutes),
    lastWeekMinutes: Math.round(lastWeekMinutes),
    monthMinutes: Math.round(monthMinutes),
    lastMonthMinutes: Math.round(lastMonthMinutes),
    totalMinutes: Math.round(totalMinutes),
    currentStreak,
    longestStreak,
    sessionsCompleted,
    sessionsTotal,
    last30Days,
    last90Days,
    subjects: sortedSubjects,
    timeOfDay: {
      morning: Math.round(morning),
      afternoon: Math.round(afternoon),
      evening: Math.round(evening),
      night: Math.round(night),
      peak
    },
    writtenInsight,
    milestones,
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
  
  // If today has 0, check if yesterday had >0. If not, streak is 0.
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
      const diff = Math.round((thisDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 1) run++;
      else run = 1;
    } else {
      run = 1;
    }
    longestStreak = Math.max(longestStreak, run);
    prev = day;
  }
  
  // Failsafe - current could be higher if bug in sorting
  longestStreak = Math.max(longestStreak, currentStreak);

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
