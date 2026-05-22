import { supabase } from './supabase';
import type { Question, SubmissionAnswer } from '../types';

export interface TakeTestContext {
  token: string;
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

export async function loadTakeTestByToken(token: string): Promise<TakeTestContext> {
  const { data: tokenRow, error: tokenError } = await supabase
    .from('test_tokens')
    .select('test_id, group_number, token')
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
    throw new Error(testError.message);
  }
  if (!testRow) {
    throw new Error('Тестът не е намерен.');
  }
  if (testRow.mode !== 'online') {
    throw new Error('Този линк е само за онлайн тестове.');
  }

  const questions = mapQuestions(testRow.questions);
  const hasGroups =
    Boolean(testRow.has_groups) ||
    questions.some(q => Boolean(q.group1?.text && q.group2?.text));

  return {
    token: tokenRow.token,
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

export interface TakeStudentRow {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  className: string;
  number: number;
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

export interface SubmitTakeTestInput {
  testId: string;
  studentName: string;
  groupNumber: number;
  answers: SubmissionAnswer[];
  auto_points: number;
}

export async function submitTakeTest(input: SubmitTakeTestInput): Promise<void> {
  const { error } = await supabase.from('submissions').insert({
    test_id: input.testId,
    student_name: input.studentName,
    group_number: input.groupNumber,
    answers: input.answers,
    auto_points: input.auto_points,
    status: 'pending_review',
  });

  if (error) {
    throw new Error(error.message);
  }
}
