/*
# Add friends-lookup SELECT policy to profiles

1. Security
- profiles: accepted friends can SELECT each other's profile row (for stats lookup: today's focus minutes, streak).
- Uses the now-existing friendships table to verify an accepted bidirectional connection.
*/

DROP POLICY IF EXISTS "select_friends_profile" ON profiles;
CREATE POLICY "select_friends_profile" ON profiles FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.user_id = auth.uid() AND f.friend_id = profiles.id)
          OR (f.friend_id = auth.uid() AND f.user_id = profiles.id)
        )
    )
  );
