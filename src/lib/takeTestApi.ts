import { supabase } from './supabase';
import type { Question, SubmissionAnswer } from '../types';

export interface TakeTestContext {
  token: string;
  /** UUID row in test_tokens (required for submissions.token_id). */
  tokenId: string;
  groupNumber: number;
  test: {
    id: string;
    name: string;
    className: string;
    hasGroups: boolean;
    maxPoints: number;
    questions: Question[];
  };
}

function mapQuestions(raw: unknown): Question[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((q: Question) => ({
    ...q,
    type: q.type ?? 'short_answer',
  }));
}

type TakeTestRow = {
  id: string;
  name: string;
  class_name: string;
  questions: unknown;
  has_groups: boolean | null;
  max_points: number;
  mode?: string | null;
};

function buildTakeTestContext(
  tokenRow: { id: string; token: string; group_number: number },
  testRow: TakeTestRow
): TakeTestContext {
  const questions = mapQuestions(testRow.questions);
  const hasGroups =
    Boolean(testRow.has_groups) ||
    questions.some(q => Boolean(q.group1?.text && q.group2?.text));

  return {
    token: tokenRow.token,
    tokenId: tokenRow.id,
    groupNumber: tokenRow.group_number,
    test: {
      id: testRow.id,
      name: testRow.name,
      className: testRow.class_name,
      hasGroups,
      maxPoints: testRow.max_points,
      questions,
    },
  };
}

export async function loadTakeTestByToken(token: string): Promise<TakeTestContext> {
  const { data: tokenRow, error: tokenError } = await supabase
    .from('test_tokens')
    .select('id, test_id, group_number, token')
    .eq('token', token)
    .maybeSingle();

  if (tokenError) {
    throw new Error(tokenError.message);
  }
  if (!tokenRow) {
    throw new Error('Невалиден или изтекъл линк за тест.');
  }

  const { data: testRow, error: testError } = await supabase
    .from('tests')
    .select('id, name, class_name, questions, has_groups, max_points, mode')
    .eq('id', tokenRow.test_id)
    .maybeSingle();

  if (testError) {
    const missingMode =
      testError.message?.includes('mode') &&
      (testError.message?.includes('does not exist') ||
        testError.code === '42703');
    if (missingMode) {
      const { data: fallbackRow, error: fallbackError } = await supabase
        .from('tests')
        .select('id, name, class_name, questions, has_groups, max_points')
        .eq('id', tokenRow.test_id)
        .maybeSingle();
      if (fallbackError) throw new Error(fallbackError.message);
      if (!fallbackRow) throw new Error('Тестът не е намерен.');
      return buildTakeTestContext(tokenRow, fallbackRow);
    }
    throw new Error(testError.message);
  }
  if (!testRow) {
    throw new Error('Тестът не е намерен.');
  }
  if (testRow.mode === 'offline') {
    throw new Error('Този линк е само за онлайн тестове.');
  }

  return buildTakeTestContext(tokenRow, testRow);
}

export interface TakeStudentRow {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  className: string;
  number: number;
}

/** Token row for submissions when group is known after name verification. */
export async function loadTestTokenIdForGroup(
  testId: string,
  groupNumber: number
): Promise<string> {
  const { data, error } = await supabase
    .from('test_tokens')
    .select('id')
    .eq('test_id', testId)
    .eq('group_number', groupNumber)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.id) {
    throw new Error('Липсва достъп за тази група. Обърнете се към учителя.');
  }
  return data.id;
}

export async function loadStudentsForClass(className: string): Promise<TakeStudentRow[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, first_name, middle_name, last_name, class_name, number')
    .eq('class_name', className)
    .order('number', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(row => ({
    id: row.id,
    firstName: row.first_name,
    middleName: row.middle_name ?? '',
    lastName: row.last_name,
    className: row.class_name,
    number: row.number,
  }));
}

export const TAKE_ALREADY_SUBMITTED_MESSAGE =
  'Вече си предал този тест. Повторно влизане не е възможно. Обърни се към учителя си, ако има проблем.';

export async function hasSubmissionForStudent(
  testId: string,
  studentName: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('submissions')
    .select('id')
    .eq('test_id', testId)
    .eq('student_name', studentName.trim())
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return Boolean(data?.id);
}

export interface SubmitTakeTestInput {
  testId: string;
  tokenId: string;
  studentName: string;
  groupNumber: number;
  answers: SubmissionAnswer[];
  auto_points: number;
}

function isDuplicateSubmissionError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '23505' ||
    Boolean(error.message?.includes('submissions_test_id_student_name_key')) ||
    Boolean(error.message?.toLowerCase().includes('duplicate key'))
  );
}

export async function submitTakeTest(input: SubmitTakeTestInput): Promise<void> {
  const { error } = await supabase.from('submissions').insert({
    test_id: input.testId,
    token_id: input.tokenId,
    student_name: input.studentName,
    group_number: input.groupNumber,
    answers: input.answers,
    auto_points: input.auto_points,
    status: 'pending_review',
  });

  if (error) {
    if (isDuplicateSubmissionError(error)) {
      throw new Error(TAKE_ALREADY_SUBMITTED_MESSAGE);
    }
    throw new Error(error.message);
  }
}
