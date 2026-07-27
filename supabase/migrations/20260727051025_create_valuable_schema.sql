/*
# Create Valuable schema (multi-user, owner-scoped) — part 1: tables + base policies

1. New Tables
- profiles, focus_sessions, content_items, content_views, friendships, payments
2. Security
- RLS on every table with owner-scoped CRUD.
- profiles friends-lookup SELECT policy added in part 2 (depends on friendships table existing).
- content_items: authenticated SELECT only (active=true); no user write policies.
3. Notes
- Owner columns default to auth.uid() so frontend inserts omitting user_id succeed.
*/

-- profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Student',
  friend_code text UNIQUE NOT NULL,
  is_premium boolean NOT NULL DEFAULT false,
  premium_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- focus_sessions
CREATE TABLE IF NOT EXISTS focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  subject_tag text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer NOT NULL,
  completed_fully boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sessions" ON focus_sessions;
CREATE POLICY "select_own_sessions" ON focus_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_sessions" ON focus_sessions;
CREATE POLICY "insert_own_sessions" ON focus_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_sessions" ON focus_sessions;
CREATE POLICY "update_own_sessions" ON focus_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_sessions" ON focus_sessions;
CREATE POLICY "delete_own_sessions" ON focus_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_started ON focus_sessions(user_id, started_at DESC);

-- content_items
CREATE TABLE IF NOT EXISTS content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL,
  youtube_video_id text NOT NULL,
  duration_seconds integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_active_content" ON content_items;
CREATE POLICY "select_active_content" ON content_items FOR SELECT
  TO authenticated USING (active = true);

CREATE INDEX IF NOT EXISTS idx_content_items_category ON content_items(category);

-- content_views
CREATE TABLE IF NOT EXISTS content_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE content_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_views" ON content_views;
CREATE POLICY "select_own_views" ON content_views FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_views" ON content_views;
CREATE POLICY "insert_own_views" ON content_views FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_views" ON content_views;
CREATE POLICY "delete_own_views" ON content_views FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_content_views_user ON content_views(user_id, viewed_at DESC);

-- friendships
CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_friendships" ON friendships;
CREATE POLICY "select_own_friendships" ON friendships FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "insert_own_friendships" ON friendships;
CREATE POLICY "insert_own_friendships" ON friendships FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_friendships" ON friendships;
CREATE POLICY "update_own_friendships" ON friendships FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR auth.uid() = friend_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "delete_own_friendships" ON friendships;
CREATE POLICY "delete_own_friendships" ON friendships FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);

-- payments
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'created',
  razorpay_order_id text,
  razorpay_payment_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_payments" ON payments;
CREATE POLICY "select_own_payments" ON payments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_payments" ON payments;
CREATE POLICY "insert_own_payments" ON payments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_payments" ON payments;
CREATE POLICY "update_own_payments" ON payments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
