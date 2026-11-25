/*
# Enforce the 5-friend circle limit

- Accepted friendships are counted by distinct other user.
- Pending requests do not count.
- A user at 5 accepted friends cannot send a new pending request.
- A friendship cannot become accepted if either side already has 5.
- Existing users with more than 5 accepted friends keep their rows; the
  trigger only blocks new requests/acceptances until they are back under 5.
*/

CREATE OR REPLACE FUNCTION public.enforce_friendship_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max constant integer := 5;
  v_count integer;
  v_me uuid := auth.uid();
  v_old_status text;
  v_old_user uuid;
  v_old_friend uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_old_status := NULL;
    v_old_user := NULL;
    v_old_friend := NULL;
  ELSE
    v_old_status := OLD.status;
    v_old_user := OLD.user_id;
    v_old_friend := OLD.friend_id;
  END IF;

  -- Sending a new request: the sender must have room.
  IF NEW.status = 'pending'
     AND (
       TG_OP = 'INSERT'
       OR (TG_OP = 'UPDATE' AND v_old_status IS DISTINCT FROM 'pending')
     ) THEN
    SELECT count(DISTINCT CASE
             WHEN f.user_id = NEW.user_id THEN f.friend_id
             ELSE f.user_id
           END)
      INTO v_count
      FROM public.friendships f
     WHERE f.status = 'accepted'
       AND (f.user_id = NEW.user_id OR f.friend_id = NEW.user_id)
       AND f.id IS DISTINCT FROM NEW.id;

    IF v_count >= v_max THEN
      RAISE EXCEPTION 'Your circle is full (5 friends). Remove a friend to add a new one.';
    END IF;
  END IF;

  -- Accepting: both people must have room. Check the receiver first so the
  -- current user gets the clear "your circle" message when they are full.
  IF NEW.status = 'accepted'
     AND (
       TG_OP = 'INSERT'
       OR v_old_status IS DISTINCT FROM 'accepted'
       OR v_old_user IS DISTINCT FROM NEW.user_id
       OR v_old_friend IS DISTINCT FROM NEW.friend_id
     ) THEN
    SELECT count(DISTINCT CASE
             WHEN f.user_id = NEW.friend_id THEN f.friend_id
             ELSE f.user_id
           END)
      INTO v_count
      FROM public.friendships f
     WHERE f.status = 'accepted'
       AND (f.user_id = NEW.friend_id OR f.friend_id = NEW.friend_id)
       AND f.id IS DISTINCT FROM NEW.id;

    IF v_count >= v_max THEN
      IF v_me IS NOT DISTINCT FROM NEW.friend_id THEN
        RAISE EXCEPTION 'Your circle is full (5 friends). Remove a friend to add a new one.';
      ELSE
        RAISE EXCEPTION 'This person''s circle is full.';
      END IF;
    END IF;

    SELECT count(DISTINCT CASE
             WHEN f.user_id = NEW.user_id THEN f.friend_id
             ELSE f.user_id
           END)
      INTO v_count
      FROM public.friendships f
     WHERE f.status = 'accepted'
       AND (f.user_id = NEW.user_id OR f.friend_id = NEW.user_id)
       AND f.id IS DISTINCT FROM NEW.id;

    IF v_count >= v_max THEN
      IF v_me IS NOT DISTINCT FROM NEW.user_id THEN
        RAISE EXCEPTION 'Your circle is full (5 friends). Remove a friend to add a new one.';
      ELSE
        RAISE EXCEPTION 'This person''s circle is full.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_friendship_limit ON public.friendships;
CREATE TRIGGER enforce_friendship_limit
BEFORE INSERT OR UPDATE OF status, user_id, friend_id ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.enforce_friendship_limit();

