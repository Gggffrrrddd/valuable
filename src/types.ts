export interface Profile {
  id: string;
  display_name: string;
  friend_code: string;
  is_premium: boolean;
  premium_expires_at: string | null;
  created_at: string;
}

export interface FocusSession {
  id: string;
  user_id: string;
  subject_tag: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  completed_fully: boolean;
  created_at: string;
}

export type ContentCategory =
  | 'Motivational'
  | 'Study-Tips'
  | 'Quick-Facts'
  | 'Success-Stories'
  | 'Mindfulness';

export interface ContentItem {
  id: string;
  title: string;
  category: ContentCategory;
  youtube_video_id: string;
  duration_seconds: number;
  active: boolean;
  created_at: string;
}

export interface ContentView {
  id: string;
  user_id: string;
  content_item_id: string;
  viewed_at: string;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  created_at: string;
}

/** One active goal per user (latest row wins client-side). */
export interface CompeteGoal {
  id: string;
  user_id: string;
  exam_date: string;
  daily_target_hours: number;
  /** Day the daily-tree ritual began; each day restarts from a seedling. */
  start_date: string;
  /** Up to 3 public-URLs of uploaded dream images crowning the tree. */
  dream_images?: string[] | null;
  created_at: string;
  updated_at: string;
}

/** One row per goal per day — single source of truth for the heatmap. */
export interface CompeteDailyProgress {
  id: string;
  user_id: string;
  goal_id: string;
  date: string;
  minutes_completed: number;
  target_met: boolean;
}

export interface TimerPreset {
  label: string;
  focusMinutes: number;
  breakMinutes: number;
}

export const TIMER_PRESETS: TimerPreset[] = [
  { label: 'Classic Pomodoro', focusMinutes: 25, breakMinutes: 5 },
  { label: 'Deep Focus', focusMinutes: 50, breakMinutes: 10 },
  { label: 'Short Sprint', focusMinutes: 15, breakMinutes: 3 },
  { label: 'Long Study', focusMinutes: 90, breakMinutes: 20 },
];

export const SUBJECT_PRESETS = [
  'Maths',
  'Physics',
  'Chemistry',
  'Biology',
  'Revision',
  'Assignment',
  'Reading',
  'Practice',
];

export const CATEGORIES: ContentCategory[] = [
  'Motivational',
  'Study-Tips',
  'Quick-Facts',
  'Success-Stories',
  'Mindfulness',
];
