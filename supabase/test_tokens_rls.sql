-- Allow backend/frontend (anon) to insert and read test_tokens for owned tests.
-- Run in Supabase SQL Editor if POST /api/tests fails with RLS on test_tokens.

ALTER TABLE test_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert test_tokens" ON test_tokens;
CREATE POLICY "Allow insert test_tokens"
  ON test_tokens
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow select test_tokens" ON test_tokens;
CREATE POLICY "Allow select test_tokens"
  ON test_tokens
  FOR SELECT
  TO anon, authenticated
  USING (true);
