/*
# Auto-create profile on signup via trigger

1. Changes
- Create function `handle_new_user()` that inserts a profile row with a random friend_code when a new auth.users row is created. Runs as SECURITY DEFINER so it bypasses RLS.
- Attach as a trigger `on_auth_user_created` AFTER INSERT on auth.users.
- This eliminates the frontend race condition where the client tries to insert a profile before the session is established.

2. Security
- The function is SECURITY DEFINER with search_path set to public, so it runs with elevated privileges and is not subject to RLS.
- It only inserts a row for the newly created user — no other data access.
- friend_code is generated randomly and retried on collision (up to 5 times).
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
  attempts integer := 0;
BEGIN
  LOOP
    new_code := substring(md5(random()::text || clock_timestamp()::text) from 1 for 6);
    new_code := upper(translate(new_code, 'ilo01', 'ILoO1'));
    BEGIN
      INSERT INTO public.profiles (id, display_name, friend_code)
      VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', 'Student'), new_code);
      RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
      attempts := attempts + 1;
      IF attempts > 5 THEN
        RAISE EXCEPTION 'Could not generate unique friend_code after 5 attempts';
      END IF;
    END;
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
