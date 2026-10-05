-- Dream names: short label shown in the pill under each dream circle,
-- index-aligned with dream_images on the goal row.
-- Idempotent — safe to re-run.

ALTER TABLE compete_goals
  ADD COLUMN IF NOT EXISTS dream_names TEXT[] NOT NULL DEFAULT '{}';
