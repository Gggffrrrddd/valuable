/*
# Friend requests: secure incoming/outgoing reads + accept/reject/cancel

1. Why
- The receiver's query could see the pending friendship row, but `profiles`
  RLS hides the sender until the friendship is accepted. The old UI therefore
  dropped every request whose profile lookup returned null.
- These SECURITY DEFINER functions return only the minimal fields needed by the
  request cards and perform the state changes after checking the caller.

2. Behaviour
- Incoming/outgoing requests are pending rows only.
- Accept creates/updates the reciprocal accepted row atomically.
- Reject marks both possible pending directions rejected, so the sender cannot
  immediately spam the same request again.
- Cancel deletes only the caller's own outgoing pending request.
*/

-- Safe if the earlier character migration already added it.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_character text NOT NULL DEFAULT 'boy';

CREATE OR REPLACE FUNCTION public.list_my_friend_requests()
RETURNS TABLE (
  request_id uuid,
  direction text,
  other_id uuid,
  display_name text,
  avatar_character text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    'incoming'::text,
    p.id,
    p.display_name,
    COALESCE(p.avatar_character, 'boy'),
    f.created_at
  FROM public.friendships f
  JOIN public.profiles p ON p.id = f.user_id
  WHERE f.friend_id = auth.uid()
    AND f.status = 'pending'

  UNION ALL

  SELECT
    f.id,
    'outgoing'::text,
    p.id,
    p.display_name,
    COALESCE(p.avatar_character, 'boy'),
    f.created_at
  FROM public.friendships f
  JOIN public.profiles p ON p.id = f.friend_id
  WHERE f.user_id = auth.uid()
    AND f.status = 'pending'

  ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.accept_friend_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receiver uuid := auth.uid();
  v_sender uuid;
BEGIN
  IF v_receiver IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT f.user_id
    INTO v_sender
  FROM public.friendships f
  WHERE f.id = p_request_id
    AND f.friend_id = v_receiver
    AND f.status = 'pending';

  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;

  UPDATE public.friendships
  SET status = 'accepted'
  WHERE id = p_request_id;

  INSERT INTO public.friendships (user_id, friend_id, status)
  VALUES (v_receiver, v_sender, 'accepted')
  ON CONFLICT (user_id, friend_id)
  DO UPDATE SET status = 'accepted';
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_friend_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receiver uuid := auth.uid();
  v_sender uuid;
BEGIN
  IF v_receiver IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT f.user_id
    INTO v_sender
  FROM public.friendships f
  WHERE f.id = p_request_id
    AND f.friend_id = v_receiver
    AND f.status = 'pending';

  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;

  -- Reject the incoming row and, if both users requested each other, the
  -- receiver's own outgoing row too. Rejected rows remain as an anti-spam
  -- marker but are hidden from both request lists.
  UPDATE public.friendships
  SET status = 'rejected'
  WHERE (id = p_request_id
      OR (user_id = v_receiver AND friend_id = v_sender))
    AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_friend_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender uuid := auth.uid();
BEGIN
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.friendships
  WHERE id = p_request_id
    AND user_id = v_sender
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.list_my_friend_requests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_friend_request(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_friend_request(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_friend_request(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_my_friend_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_friend_request(uuid) TO authenticated;
