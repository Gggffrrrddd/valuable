-- Archive completed Compete goals additively. Existing rows remain active.
ALTER TABLE public.compete_goals
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_summary jsonb;

CREATE INDEX IF NOT EXISTS compete_goals_user_completed_idx
  ON public.compete_goals (user_id, completed_at);
