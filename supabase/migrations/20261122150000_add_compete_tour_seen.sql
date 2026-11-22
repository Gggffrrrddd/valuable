ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS compete_tour_seen boolean NOT NULL DEFAULT false;
