-- Dream images: up to 3 uploaded references on the user's Compete goal,
-- plus a public storage bucket for the uploads. Idempotent — safe to re-run.

ALTER TABLE compete_goals
  ADD COLUMN IF NOT EXISTS dream_images TEXT[] NOT NULL DEFAULT '{}';

-- Public bucket (public URL reads need no policy; writes are owner-checked).
INSERT INTO storage.buckets (id, name, public)
VALUES ('dream-images', 'dream-images', true)
ON CONFLICT (id) DO NOTHING;

-- Uploads must live under the caller's own folder (path starts with their uid).
DROP POLICY IF EXISTS "Users upload own dream images" ON storage.objects;
CREATE POLICY "Users upload own dream images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dream-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own dream images" ON storage.objects;
CREATE POLICY "Users delete own dream images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'dream-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
