/*
# Fix friend-code lookup and harden code generation

1. Why
- `profiles` SELECT is intentionally limited to your own row and accepted
  friends. The old add-by-code screen queried `profiles` directly, so RLS hid
  every non-friend row and the client saw `data = null` (not an error).
- This adds a SECURITY DEFINER lookup that returns only id, display name and
  avatar character for an exact normalized code.

2. Code format
- New codes use an unambiguous 6-character alphabet (no 0/O, 1/I/L).
- Existing persisted codes are left untouched so already-shared codes keep
  working; lookup is case-insensitive and strips spaces/punctuation.

3. Security
- The lookup function is executable by authenticated users only.
- It never exposes emails, premium fields or other profile columns.
- Accepted-friend profile reads continue to use the existing scoped policy.
*/

-- The Compete character column is needed by the lookup response. Safe if the
-- earlier migration already added it.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_character text NOT NULL DEFAULT 'boy';

-- 6 chars from 31 unambiguous symbols: no 0, O, 1, I or L.
CREATE OR REPLACE FUNCTION public.generate_friend_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Replace the old generator (it could emit confusing 0/O/1/I/L characters).
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
    new_code := public.generate_friend_code();
    BEGIN
      INSERT INTO public.profiles (id, display_name, friend_code)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', 'Student'),
        new_code
      );
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

-- Exact, case-insensitive lookup without opening the profiles table to
-- everyone. Only the three fields needed by the add-by-code UI are returned.
CREATE OR REPLACE FUNCTION public.lookup_profile_by_friend_code(p_code text)
RETURNS TABLE (
  profile_id uuid,
  display_name text,
  avatar_character text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.display_name,
    COALESCE(p.avatar_character, 'boy')
  FROM public.profiles p
  WHERE p.friend_code = upper(
    regexp_replace(COALESCE(p_code, ''), '[^A-Za-z0-9]', '', 'g')
  )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_profile_by_friend_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_profile_by_friend_code(text) TO authenticated;
