import { supabase } from './supabase';
import type { Submission, SubmissionAnswer, SubmissionStatus } from '../types';

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const SUBMISSIONS_RLS_HINT =
  'Пуснете supabase/fix_submissions_teacher_read.sql в Supabase SQL Editor, или добавете SUPABASE_SERVICE_ROLE_KEY в backend/.env и рестартирайте backend.';

function mapSubmission(row: {
  id: string;
  test_id: string;
  student_name: string;
  group_number: number;
  answers: unknown;
  auto_points: number;
  status: string;
  created_at: string;
}): Submission {
  return {
    id: row.id,
    testId: row.test_id,
    studentName: row.student_name,
    groupNumber: row.group_number,
    answers: (row.answers as SubmissionAnswer[]) ?? [],
    autoPoints: Number(row.auto_points),
    status: row.status as SubmissionStatus,
    createdAt: row.created_at,
  };
}

async function fetchPendingCountsFromBackend(): Promise<Record<string, number> | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/submissions/pending-counts`);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as Record<string, number>;
  } catch {
    return null;
  }
}

async function fetchPendingSubmissionsFromBackend(
  testId: string
): Promise<Submission[] | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/tests/${encodeURIComponent(testId)}/submissions/pending`
    );
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { submissions?: unknown[] };
    const rows = body.submissions ?? [];
    return rows.map(row => mapSubmission(row as Parameters<typeof mapSubmission>[0]));
  } catch {
    return null;
  }
}

export async function loadPendingSubmissionCounts(): Promise<Record<string, number>> {
  const fromBackend = await fetchPendingCountsFromBackend();
  if (fromBackend) {
    return fromBackend;
  }

  const { data, error } = await supabase
    .from('submissions')
    .select('test_id')
    .eq('status', 'pending_review');

  if (error) {
    throw new Error(`${error.message}. ${SUBMISSIONS_RLS_HINT}`);
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.test_id] = (counts[row.test_id] ?? 0) + 1;
  }
  return counts;
}

export async function loadPendingSubmissionsForTest(testId: string): Promise<Submission[]> {
  const fromBackend = await fetchPendingSubmissionsFromBackend(testId);
  if (fromBackend) {
    return fromBackend;
  }

  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('test_id', testId)
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`${error.message}. ${SUBMISSIONS_RLS_HINT}`);
  }

  return (data ?? []).map(mapSubmission);
}

/** How many rows exist for this test (any status) — helps diagnose RLS vs finalized. */
export async function countAllSubmissionsForTest(testId: string): Promise<number> {
  const { count, error } = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('test_id', testId);

  if (error) {
    return -1;
  }
  return count ?? 0;
}

export async function updateSubmissionStatus(
  submissionId: string,
  status: SubmissionStatus
): Promise<void> {
  const { error } = await supabase
    .from('submissions')
    .update({ status })
    .eq('id', submissionId);

  if (error) {
    throw new Error(error.message);
  }
}
