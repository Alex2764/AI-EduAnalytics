-- Add tests.mode for online share links (/take/:token) and the "Линк" button in the app.
-- Run once in Supabase SQL Editor before UPDATE ... SET mode = 'online'.

ALTER TABLE tests
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'offline';

-- Tests that already have access tokens are online tests
UPDATE tests
SET mode = 'online'
WHERE id IN (SELECT DISTINCT test_id FROM test_tokens);

-- Optional: restrict values (skip if you already have a different check constraint)
DO $$
BEGIN
  ALTER TABLE tests
    ADD CONSTRAINT tests_mode_check CHECK (mode IN ('online', 'offline'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
