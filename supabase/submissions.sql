-- Online test submissions from the public /take/:token page.
-- Run in Supabase SQL Editor after creating the table.

CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  token_id uuid NOT NULL REFERENCES test_tokens(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  group_number integer NOT NULL CHECK (group_number IN (1, 2)),
  answers jsonb NOT NULL,
  auto_points numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'finalized')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS submissions_test_id_idx ON submissions(test_id);
CREATE INDEX IF NOT EXISTS submissions_status_idx ON submissions(status);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon insert submissions from take page" ON submissions;
CREATE POLICY "Allow anon insert submissions from take page"
  ON submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated select submissions" ON submissions;
CREATE POLICY "Allow authenticated select submissions"
  ON submissions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow anon select submissions for teacher app" ON submissions;
CREATE POLICY "Allow anon select submissions for teacher app"
  ON submissions
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated update submissions" ON submissions;
CREATE POLICY "Allow authenticated update submissions"
  ON submissions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update submissions for teacher app" ON submissions;
CREATE POLICY "Allow anon update submissions for teacher app"
  ON submissions
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
