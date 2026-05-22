import { supabase } from './supabase';
import type { Submission, SubmissionAnswer, SubmissionStatus } from '../types';

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

export async function loadPendingSubmissionCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('submissions')
    .select('test_id')
    .eq('status', 'pending_review');

  if (error) {
    throw new Error(error.message);
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.test_id] = (counts[row.test_id] ?? 0) + 1;
  }
  return counts;
}

export async function loadPendingSubmissionsForTest(testId: string): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('test_id', testId)
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapSubmission);
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
