/*
# Create circle_presence (study-table live status) — pull-based presence

1. New Table
- circle_presence: one row per user, heartbeat-refreshed while the app is open.
  last_seen_at drives online/offline (fresh window enforced client-side);
  session_state drives book state on the study table ('idle' | 'focusing' | 'paused').
2. Security
- RLS: users upsert only their own row; accepted friends can SELECT each other's row
  (mirrors the profiles friends-lookup policy).
3. Notes
- No realtime/WebSocket: the study table polls this table every few seconds while open.
- Offline is never written — a stale last_seen_at simply ages out client-side.
*/

CREATE TABLE IF NOT EXISTS circle_presence (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  session_state text NOT NULL DEFAULT 'idle'
    CHECK (session_state IN ('idle', 'focusing', 'paused')),
  session_started_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE circle_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_presence" ON circle_presence;
CREATE POLICY "select_own_presence" ON circle_presence FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_friends_presence" ON circle_presence;
CREATE POLICY "select_friends_presence" ON circle_presence FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.user_id = auth.uid() AND f.friend_id = circle_presence.user_id)
          OR (f.friend_id = auth.uid() AND f.user_id = circle_presence.user_id)
        )
    )
  );

DROP POLICY IF EXISTS "insert_own_presence" ON circle_presence;
CREATE POLICY "insert_own_presence" ON circle_presence FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_presence" ON circle_presence;
CREATE POLICY "update_own_presence" ON circle_presence FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_circle_presence_last_seen ON circle_presence(last_seen_at DESC);
