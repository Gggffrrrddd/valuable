export type AvatarCharacter = "boy" | "girl";

export interface Profile {
  id: string;
  display_name: string;
  friend_code: string;
  is_premium: boolean;
  premium_expires_at: string | null;
  /** Server-owned entitlement. Optional while older rows/migrations exist. */
  plan?: "free" | "premium";
  premium_until?: string | null;
  source?: "play" | "trial" | "founder" | null;
  /** Which 3D character the user appears as at the circle table. Always set. */
  avatar_character: AvatarCharacter;
  /** False until the first-time character picker has been resolved. */
  character_chosen: boolean;
  /** True once the Compete guided tour has been completed or skipped. */
  compete_tour_seen: boolean;
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
  | "Motivational"
  | "Study-Tips"
  | "Quick-Facts"
  | "Success-Stories"
  | "Mindfulness";

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
  status: "pending" | "accepted";
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
  /** Set when the goal is archived; active goals leave this null. */
  completed_at?: string | null;
  completed_summary?: {
    daysTicked: number;
    daysMissed: number;
    totalMinutes: number;
    longestTickStreak: number;
  } | null;
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
  target_minutes: number;
  target_met: boolean;
}

export interface TimerPreset {
  label: string;
  focusMinutes: number;
  breakMinutes: number;
}

export const TIMER_PRESETS: TimerPreset[] = [
  { label: "Classic Pomodoro", focusMinutes: 25, breakMinutes: 5 },
  { label: "Deep Focus", focusMinutes: 50, breakMinutes: 10 },
  { label: "Short Sprint", focusMinutes: 15, breakMinutes: 3 },
  { label: "Long Study", focusMinutes: 90, breakMinutes: 20 },
];

export const SUBJECT_PRESETS = [
  "Maths",
  "Physics",
  "Chemistry",
  "Biology",
  "Revision",
  "Assignment",
  "Reading",
  "Practice",
];

export const CATEGORIES: ContentCategory[] = [
  "Motivational",
  "Study-Tips",
  "Quick-Facts",
  "Success-Stories",
  "Mindfulness",
];
