-- Google OAuth support:
-- 1) profile display-name fallback for Google metadata (full_name / name / email)
-- 2) remote switch for the Google button on the auth screen.

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
  attempts integer := 0;
  resolved_name text;
BEGIN
  resolved_name := COALESCE(
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), ''),
    'Student'
  );

  LOOP
    new_code := public.generate_friend_code();
    BEGIN
      INSERT INTO public.profiles (id, display_name, friend_code)
      VALUES (NEW.id, resolved_name, new_code);
      RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
      attempts := attempts + 1;
      IF attempts > 8 THEN
        RAISE EXCEPTION 'Could not generate unique friend_code after 8 attempts';
      END IF;
    END;
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.app_config (key, value)
VALUES ('auth_google_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMIT;
