/*
# Create compete_goals + compete_daily_progress (mountain climb tracking)

1. New Tables
- compete_goals: one active goal per user (latest row wins client-side).
  total_steps is computed once at setup: days between today and exam_date.
  current_step only ever moves via increment_compete_step().
- compete_daily_progress: one row per goal per date. hours_completed is the
  tracked focus time for that date (read from focus_sessions, never manual);
  step_awarded guards against double-incrementing the same day.
2. Security
- RLS: users can only touch their own rows in both tables.
3. Notes
- Daily check runs client-side on Compete screen mount (matches the pull-based
  pattern used by circle_presence) — no cron edge function yet.
- increment_compete_step is SECURITY DEFINER so the atomic
  step_awarded=false -> true claim + step increment stays race-safe.
*/

CREATE TABLE IF NOT EXISTS compete_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exam_date date NOT NULL,
  daily_target_hours numeric(4, 1) NOT NULL CHECK (daily_target_hours > 0),
  total_steps integer NOT NULL CHECK (total_steps > 0),
  current_step integer NOT NULL DEFAULT 0 CHECK (current_step >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compete_goal_step_range CHECK (current_step <= total_steps)
);

CREATE TABLE IF NOT EXISTS compete_daily_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES compete_goals(id) ON DELETE CASCADE,
  date date NOT NULL,
  hours_completed numeric(5, 2) NOT NULL DEFAULT 0,
  step_awarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (goal_id, date)
);

ALTER TABLE compete_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE compete_daily_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_compete_goals" ON compete_goals;
CREATE POLICY "select_own_compete_goals" ON compete_goals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_compete_goals" ON compete_goals;
CREATE POLICY "insert_own_compete_goals" ON compete_goals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_compete_goals" ON compete_goals;
CREATE POLICY "update_own_compete_goals" ON compete_goals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_compete_progress" ON compete_daily_progress;
CREATE POLICY "select_own_compete_progress" ON compete_daily_progress FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_compete_progress" ON compete_daily_progress;
CREATE POLICY "insert_own_compete_progress" ON compete_daily_progress FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_compete_progress" ON compete_daily_progress;
CREATE POLICY "update_own_compete_progress" ON compete_daily_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_compete_progress_goal_date
  ON compete_daily_progress(goal_id, date DESC);

-- Atomic step increment, bounded by total_steps. Caller must first claim the
-- day's step_awarded flip; this keeps double-runs from double-counting.
CREATE OR REPLACE FUNCTION increment_compete_step(p_goal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE compete_goals
  SET current_step = LEAST(current_step + 1, total_steps),
      updated_at = now()
  WHERE id = p_goal_id
    AND user_id = auth.uid();
END;
$$;
