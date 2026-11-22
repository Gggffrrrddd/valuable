/*
# Add avatar character preference to profiles

1. Changes
- `avatar_character`: which 3D character the user appears as at the circle table.
  Defaults to 'boy' so every profile always has a valid value.
- `character_chosen`: tracks whether the user has made the first-time choice, so
  the picker only appears once. Existing rows default to false.

2. Notes
- The app treats a missing/invalid value as 'boy' defensively, but the column is
  NOT NULL with a default so the database itself never stores an unset state.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_character text NOT NULL DEFAULT 'boy',
  ADD COLUMN IF NOT EXISTS character_chosen boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  ALTER TABLE profiles
    ADD CONSTRAINT profiles_avatar_character_check
    CHECK (avatar_character IN ('boy', 'girl'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
