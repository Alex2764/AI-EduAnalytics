import assert from 'node:assert/strict';
import {
  buildQuestionResults,
  buildResultFromQuestionPoints,
  findStudentByDisplayName,
  initialQuestionPointsFromSubmission,
  parseDisplayNameToNameInput,
  sumQuestionPoints,
} from '../src/utils/finalizeSubmission';
import type { Question, Student, SubmissionAnswer, Test } from '../src/types';

const gradeScale = {
  grade2: 0,
  grade3: 4,
  grade4: 6,
  grade5: 8,
  grade6: 9,
};

const test: Test = {
  id: 't1',
  name: 'Тест',
  class: '10А',
  type: 'Нормален тест',
  date: '2026-05-22',
  maxPoints: 10,
  gradeScale,
  hasGroups: false,
  mode: 'online',
  questions: [
    {
      id: 'q1',
      text: 'MC',
      points: 5,
      type: 'multiple_choice',
      options: ['A1', 'A2', 'A3', 'A4'],
      correctAnswer: 'A',
    },
    {
      id: 'q2',
      text: 'SA',
      points: 5,
      type: 'short_answer',
      correctAnswer: 'София',
    },
  ],
};

const student: Student = {
  id: 's1',
  firstName: 'Иван',
  middleName: 'Петров',
  lastName: 'Георгиев',
  class: '10А',
  number: 1,
  gender: 'male',
};

const submissionAnswers: SubmissionAnswer[] = [
  { questionId: 'q1', answer: 'A', auto_points: 5 },
  { questionId: 'q2', answer: 'Пловдив', auto_points: 0 },
];

function run() {
  const parsed = parseDisplayNameToNameInput('Иван Петров Георгиев');
  assert.equal(parsed.firstName, 'Иван');
  assert.equal(parsed.middleName, 'Петров');
  assert.equal(parsed.lastName, 'Георгиев');

  assert.ok(findStudentByDisplayName([student], '10А', 'Иван Петров Георгиев'));
  assert.equal(
    findStudentByDisplayName([student], '10А', 'Грешен Ученик'),
    null
  );

  const initial = initialQuestionPointsFromSubmission(test, submissionAnswers);
  assert.equal(initial.q1, 5);
  assert.equal(initial.q2, 0);

  const teacherPoints = { q1: 5, q2: 4 };
  assert.equal(sumQuestionPoints(teacherPoints), 9);

  const questionResults = buildQuestionResults(test, teacherPoints);
  assert.equal(questionResults.length, 2);
  assert.equal(questionResults[1].points, 4);

  const result = buildResultFromQuestionPoints(test, student.id, teacherPoints);
  assert.equal(result.points, 9);
  assert.equal(result.testId, 't1');
  assert.equal(result.studentId, 's1');
  assert.equal(result.participated, true);
  assert.equal(result.questionResults?.length, 2);
  assert.equal(result.grade, '6.00');
  assert.equal(result.percentage, 90);

  const mcOnly = buildResultFromQuestionPoints(test, student.id, { q1: 5, q2: 0 });
  assert.equal(mcOnly.points, 5);
  assert.ok(parseFloat(mcOnly.grade) >= 3);

  console.log('test-finalize-submission: all passed');
}

run();
