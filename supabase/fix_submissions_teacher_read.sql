-- Run in Supabase SQL Editor if teacher app shows no submissions after students submit.
-- Inserts work from /take page but SELECT returns empty without these policies.

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon insert submissions from take page" ON submissions;
CREATE POLICY "Allow anon insert submissions from take page"
  ON submissions FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon select submissions for teacher app" ON submissions;
CREATE POLICY "Allow anon select submissions for teacher app"
  ON submissions FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated select submissions" ON submissions;
CREATE POLICY "Allow authenticated select submissions"
  ON submissions FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow anon update submissions for teacher app" ON submissions;
CREATE POLICY "Allow anon update submissions for teacher app"
  ON submissions FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update submissions" ON submissions;
CREATE POLICY "Allow authenticated update submissions"
  ON submissions FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
