-- Persist the daily target that applied on each day.
-- Existing rows are backfilled from their goal's current target (historical
-- target changes cannot be reconstructed unless goal history is available).
-- New rows always receive the target snapshot from the client.

ALTER TABLE public.compete_daily_progress
  ADD COLUMN IF NOT EXISTS target_minutes numeric(6, 1);

UPDATE public.compete_daily_progress AS p
SET target_minutes = ROUND(g.daily_target_hours * 60, 1)
FROM public.compete_goals AS g
WHERE p.goal_id = g.id
  AND p.target_minutes IS NULL;

ALTER TABLE public.compete_daily_progress
  ALTER COLUMN target_minutes SET NOT NULL;

COMMENT ON COLUMN public.compete_daily_progress.target_minutes IS
  'Daily focus target snapshot in minutes for this date; never rewritten for past days.';
