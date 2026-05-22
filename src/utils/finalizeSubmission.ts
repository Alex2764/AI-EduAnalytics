import type {
  QuestionResult,
  Result,
  Student,
  SubmissionAnswer,
  Test,
} from '../types';
import { calculateGrade } from './gradeCalculator';
import {
  formatStudentDisplayName,
  namesMatchExactly,
  type TakeNameInput,
} from './takeTest';

export function parseDisplayNameToNameInput(displayName: string): TakeNameInput {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: '', middleName: '', lastName: '' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], middleName: '', lastName: '' };
  }
  if (parts.length === 2) {
    return { firstName: parts[0], middleName: '', lastName: parts[1] };
  }
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

export function findStudentByDisplayName(
  students: Student[],
  className: string,
  displayName: string
): Student | null {
  const trimmed = displayName.trim();
  const classStudents = students.filter(s => s.class === className);

  const exact = classStudents.find(s => formatStudentDisplayName(s) === trimmed);
  if (exact) return exact;

  const input = parseDisplayNameToNameInput(trimmed);
  return classStudents.find(s => namesMatchExactly(input, s)) ?? null;
}

/** Начални точки за преглед: MC = auto_points, кратък отговор = 0. */
export function initialQuestionPointsFromSubmission(
  test: Test,
  submissionAnswers: SubmissionAnswer[]
): Record<string, number> {
  const points: Record<string, number> = {};
  for (const question of test.questions) {
    const answer = submissionAnswers.find(a => a.questionId === question.id);
    if (question.type === 'multiple_choice') {
      points[question.id] = answer?.auto_points ?? 0;
    } else {
      points[question.id] = 0;
    }
  }
  return points;
}

export function clampQuestionPointsValue(value: number, maxPoints: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(value, maxPoints));
}

export function sumQuestionPoints(points: Record<string, number>): number {
  return Object.values(points).reduce((sum, value) => sum + (value || 0), 0);
}

export function buildQuestionResults(
  test: Test,
  questionPoints: Record<string, number>
): QuestionResult[] {
  return test.questions.map(question => ({
    questionId: question.id,
    points: questionPoints[question.id] ?? 0,
  }));
}

export function buildResultFromQuestionPoints(
  test: Test,
  studentId: string,
  questionPoints: Record<string, number>
): Omit<Result, 'id'> {
  const totalPoints = sumQuestionPoints(questionPoints);
  const { grade, percentage } = calculateGrade(
    totalPoints,
    test.maxPoints,
    test.gradeScale
  );

  return {
    studentId,
    testId: test.id,
    points: totalPoints,
    grade,
    percentage,
    dateAdded: new Date().toISOString(),
    participated: true,
    cancelled: false,
    questionResults: buildQuestionResults(test, questionPoints),
  };
}
