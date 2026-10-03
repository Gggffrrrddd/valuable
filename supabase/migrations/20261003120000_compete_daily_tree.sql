/*
# Compete: mountain steps -> daily tree (goal + daily progress)

1. compete_goals — drop step tracking, keep the goal:
   - add start_date (when the daily ritual began; backfilled from created_at)
   - drop total_steps, current_step (mountain concept removed)
2. compete_daily_progress — renamed semantics, one row per day:
   - hours_completed -> minutes_completed (numeric, integer-ish)
   - step_awarded -> target_met (boolean: daily target hit that day)
3. drop increment_compete_step() — steps no longer exist.
4. Idempotent: safe whether the original compete migration ran or not
   (creates missing tables in the new shape, alters old-shape tables).
5. RLS: users only touch their own rows in both tables.
*/

-- 1. Goals ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS compete_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exam_date date NOT NULL,
  daily_target_hours numeric(4, 1) NOT NULL CHECK (daily_target_hours > 0),
  start_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF to_regclass('public.compete_goals') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'compete_goals' AND column_name = 'start_date'
    ) THEN
      ALTER TABLE compete_goals ADD COLUMN start_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date;
      -- existing goals began when they were created
      UPDATE compete_goals SET start_date = created_at AT TIME ZONE 'utc';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'compete_goals' AND column_name = 'total_steps'
    ) THEN
      ALTER TABLE compete_goals DROP COLUMN total_steps;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'compete_goals' AND column_name = 'current_step'
    ) THEN
      ALTER TABLE compete_goals DROP COLUMN current_step;
    END IF;
  END IF;
END $$;

-- 2. Daily progress ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS compete_daily_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES compete_goals(id) ON DELETE CASCADE,
  date date NOT NULL,
  minutes_completed numeric(6, 1) NOT NULL DEFAULT 0,
  target_met boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (goal_id, date)
);

DO $$
BEGIN
  IF to_regclass('public.compete_daily_progress') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'compete_daily_progress' AND column_name = 'hours_completed'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'compete_daily_progress' AND column_name = 'minutes_completed'
    ) THEN
      ALTER TABLE compete_daily_progress
        ADD COLUMN minutes_completed numeric(6, 1) NOT NULL DEFAULT 0;
      UPDATE compete_daily_progress SET minutes_completed = hours_completed * 60;
      ALTER TABLE compete_daily_progress DROP COLUMN hours_completed;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'compete_daily_progress' AND column_name = 'step_awarded'
    ) THEN
      ALTER TABLE compete_daily_progress ADD COLUMN IF NOT EXISTS target_met boolean NOT NULL DEFAULT false;
      UPDATE compete_daily_progress SET target_met = step_awarded;
      ALTER TABLE compete_daily_progress DROP COLUMN step_awarded;
    END IF;
  END IF;
END $$;

-- 3. Steps are gone ---------------------------------------------------------

DROP FUNCTION IF EXISTS increment_compete_step(uuid);

-- 4. Security ---------------------------------------------------------------

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
