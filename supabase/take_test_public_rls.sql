-- Public read access for the student-facing /take/:token page (anon key).
-- Run in Supabase SQL Editor if the take page cannot load tests or students.

-- test_tokens: see test_tokens_rls.sql

ALTER TABLE tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select online tests for take page" ON tests;
CREATE POLICY "Allow select online tests for take page"
  ON tests
  FOR SELECT
  TO anon, authenticated
  USING (mode = 'online');

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select students for take page" ON students;
CREATE POLICY "Allow select students for take page"
  ON students
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- submissions: see supabase/submissions.sql
