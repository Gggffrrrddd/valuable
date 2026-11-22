/*
# One friendship row per unordered pair

1. Why
- The old accept flow inserted a reciprocal row, so an accepted pair had both
  A -> B and B -> A. The Circle list read both rows and showed the same friend
  twice.
- This migration keeps one row per pair, preferring an accepted row, then the
  oldest pending row, then rejected.

2. Changes
- Delete duplicate rows for the same unordered pair.
- Add a unique index on (least(user_id, friend_id), greatest(user_id, friend_id)).
- Replace accept_friend_request so it only flips the existing row to accepted;
  it must not insert a reciprocal row anymore.
*/

-- 1) Clean existing duplicates. Accepted wins; otherwise the oldest row wins.
WITH ranked AS (
  SELECT
    f.id,
    row_number() OVER (
      PARTITION BY least(f.user_id, f.friend_id), greatest(f.user_id, f.friend_id)
      ORDER BY
        CASE f.status
          WHEN 'accepted' THEN 0
          WHEN 'pending' THEN 1
          ELSE 2
        END,
        f.created_at ASC,
        f.id ASC
    ) AS rn
  FROM public.friendships f
)
DELETE FROM public.friendships f
USING ranked r
WHERE f.id = r.id
  AND r.rn > 1;

-- 2) Enforce one row per unordered pair. The old (user_id, friend_id) unique
-- constraint remains for direct inserts, and this index blocks the reciprocal.
CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_unique
  ON public.friendships (
    least(user_id, friend_id),
    greatest(user_id, friend_id)
  );

-- 3) Accept must only update the existing row. No reciprocal insert.
CREATE OR REPLACE FUNCTION public.accept_friend_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receiver uuid := auth.uid();
BEGIN
  IF v_receiver IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.friendships
  SET status = 'accepted'
  WHERE id = p_request_id
    AND friend_id = v_receiver
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_friend_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(uuid) TO authenticated;
