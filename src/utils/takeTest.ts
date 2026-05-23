import type { Question, QuestionType, Student, SubmissionAnswer } from '../types';

export const TAKE_MAX_FAILED_ATTEMPTS = 5;

export interface TakeNameInput {
  firstName: string;
  middleName: string;
  lastName: string;
}

export interface TakeLockState {
  blocked: boolean;
  failedAttempts: number;
}

export interface TakeDisplayQuestion {
  id: string;
  index: number;
  text: string;
  points: number;
  type: QuestionType;
  options?: string[];
}

/** localStorage key for failed name attempts on a token link. */
export function takeLockStorageKey(token: string): string {
  return `take-test-lock:${token}`;
}

export function readTakeLockState(token: string): TakeLockState {
  try {
    const raw = localStorage.getItem(takeLockStorageKey(token));
    if (!raw) {
      return { blocked: false, failedAttempts: 0 };
    }
    const parsed = JSON.parse(raw) as Partial<TakeLockState>;
    const failedAttempts =
      typeof parsed.failedAttempts === 'number' ? parsed.failedAttempts : 0;
    const blocked = Boolean(parsed.blocked) || failedAttempts >= TAKE_MAX_FAILED_ATTEMPTS;
    return { blocked, failedAttempts };
  } catch {
    return { blocked: false, failedAttempts: 0 };
  }
}

export function writeTakeLockState(token: string, state: TakeLockState): void {
  localStorage.setItem(takeLockStorageKey(token), JSON.stringify(state));
}

export function recordFailedTakeAttempt(token: string): TakeLockState {
  const current = readTakeLockState(token);
  const failedAttempts = current.failedAttempts + 1;
  const next: TakeLockState = {
    failedAttempts,
    blocked: failedAttempts >= TAKE_MAX_FAILED_ATTEMPTS,
  };
  writeTakeLockState(token, next);
  return next;
}

export function clearTakeLockState(token: string): void {
  localStorage.removeItem(takeLockStorageKey(token));
}

/** I група = нечетен № в списъка, II група = четен № (при тест с две групи). */
export function studentNumberToTestGroup(studentNumber: number): 1 | 2 {
  return studentNumber % 2 === 1 ? 1 : 2;
}

export function studentBelongsToTestGroup(
  studentNumber: number,
  groupNumber: number,
  hasGroups: boolean
): boolean {
  if (!hasGroups) {
    return true;
  }
  return studentNumberToTestGroup(studentNumber) === groupNumber;
}

export function namesMatchExactly(input: TakeNameInput, student: Student): boolean {
  const first = input.firstName.trim();
  const middle = input.middleName.trim();
  const last = input.lastName.trim();
  const studentMiddle = (student.middleName ?? '').trim();

  return (
    first === student.firstName.trim() &&
    middle === studentMiddle &&
    last === student.lastName.trim()
  );
}

export function findStudentInClassByName(
  students: Student[],
  className: string,
  input: TakeNameInput
): Student | null {
  return (
    students.find(
      student => student.class === className && namesMatchExactly(input, student)
    ) ?? null
  );
}

export function resolveGroupForStudent(student: Student, hasGroups: boolean): number {
  if (!hasGroups) {
    return 1;
  }
  return studentNumberToTestGroup(student.number);
}

export function findMatchingStudent(
  students: Student[],
  className: string,
  groupNumber: number,
  hasGroups: boolean,
  input: TakeNameInput
): Student | null {
  const student = findStudentInClassByName(students, className, input);
  if (!student) {
    return null;
  }
  if (!studentBelongsToTestGroup(student.number, groupNumber, hasGroups)) {
    return null;
  }
  return student;
}

export type TakeIdentityResult =
  | { status: 'ok'; student: Student; groupNumber: number }
  | { status: 'not_found' };

/** Match by name; group (I/II) is derived from № in class list (odd=I, even=II). */
export function verifyTakeTestIdentity(
  students: Student[],
  className: string,
  hasGroups: boolean,
  input: TakeNameInput
): TakeIdentityResult {
  const student = findStudentInClassByName(students, className, input);
  if (!student) {
    return { status: 'not_found' };
  }
  return {
    status: 'ok',
    student,
    groupNumber: resolveGroupForStudent(student, hasGroups),
  };
}

export function formatDisplayNameFromInput(input: TakeNameInput): string {
  return [input.firstName, input.middleName, input.lastName]
    .map(part => part.trim())
    .filter(Boolean)
    .join(' ');
}

export function formatStudentDisplayName(student: Student): string {
  const middle = (student.middleName ?? '').trim();
  return formatDisplayNameFromInput({
    firstName: student.firstName,
    middleName: middle,
    lastName: student.lastName,
  });
}

export function getQuestionCorrectAnswer(
  question: Question,
  groupNumber: number,
  hasGroups: boolean
): string {
  if (hasGroups) {
    const groupKey = groupNumber === 2 ? 'group2' : 'group1';
    const group = question[groupKey];
    return (group?.correctAnswer ?? question.correctAnswer ?? '').trim();
  }
  return (question.correctAnswer ?? '').trim();
}

/** auto_points за един въпрос: MC при верен отговор = points, иначе 0; кратък отговор винаги 0. */
export function computeAnswerAutoPoints(
  question: Question,
  groupNumber: number,
  hasGroups: boolean,
  studentAnswer: string
): number {
  if (question.type === 'short_answer') {
    return 0;
  }
  const correct = getQuestionCorrectAnswer(question, groupNumber, hasGroups);
  return studentAnswer.trim() === correct ? question.points : 0;
}

export interface BuiltSubmissionPayload {
  answers: SubmissionAnswer[];
  auto_points: number;
}

export function buildSubmissionPayload(
  questions: Question[],
  groupNumber: number,
  hasGroups: boolean,
  rawAnswers: Record<string, string>
): BuiltSubmissionPayload {
  const answers = questions.map(question => {
    const answer = (rawAnswers[question.id] ?? '').trim();
    const auto_points = computeAnswerAutoPoints(
      question,
      groupNumber,
      hasGroups,
      answer
    );
    return { questionId: question.id, answer, auto_points };
  });
  const auto_points = answers.reduce((sum, item) => sum + item.auto_points, 0);
  return { answers, auto_points };
}

export function mapQuestionsForGroup(
  questions: Question[],
  groupNumber: number,
  hasGroups: boolean
): TakeDisplayQuestion[] {
  const groupKey = groupNumber === 2 ? 'group2' : 'group1';

  return questions.map((question, index) => {
    if (hasGroups) {
      const groupContent = question[groupKey];
      return {
        id: question.id,
        index: index + 1,
        text: groupContent?.text?.trim() || question.text?.trim() || '',
        points: question.points,
        type: question.type,
        options: groupContent?.options ?? question.options,
      };
    }

    return {
      id: question.id,
      index: index + 1,
      text: question.text?.trim() || '',
      points: question.points,
      type: question.type,
      options: question.options,
    };
  });
}
