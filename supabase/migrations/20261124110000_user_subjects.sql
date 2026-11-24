-- Account-owned subject chips with soft delete (archive).
-- Run after 20261124100000_premium_config_entitlements.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CONSTRAINT user_subjects_name_check
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 20)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_subjects_active_name_uidx
  ON public.user_subjects (user_id, lower(btrim(name)))
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_subjects_user
  ON public.user_subjects (user_id, created_at);

CREATE OR REPLACE FUNCTION public.enforce_user_subject_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.archived_at IS NULL THEN
    IF (
      SELECT count(*) FROM public.user_subjects
      WHERE user_id = NEW.user_id
        AND archived_at IS NULL
        AND id <> NEW.id
    ) >= 5 THEN
      RAISE EXCEPTION 'Maximum of 5 active subjects';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_user_subject_limit ON public.user_subjects;
CREATE TRIGGER enforce_user_subject_limit
  BEFORE INSERT OR UPDATE ON public.user_subjects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_subject_limit();

ALTER TABLE public.user_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_own_subjects" ON public.user_subjects;
CREATE POLICY "read_own_subjects" ON public.user_subjects
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_subjects" ON public.user_subjects;
CREATE POLICY "insert_own_subjects" ON public.user_subjects
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_subjects" ON public.user_subjects;
CREATE POLICY "update_own_subjects" ON public.user_subjects
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_subjects" ON public.user_subjects;
CREATE POLICY "delete_own_subjects" ON public.user_subjects
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

COMMIT;
