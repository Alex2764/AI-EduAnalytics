import assert from 'node:assert/strict';
import {
  buildSubmissionPayload,
  computeAnswerAutoPoints,
  findMatchingStudent,
  getQuestionCorrectAnswer,
  mapQuestionsForGroup,
  namesMatchExactly,
  readTakeLockState,
  recordFailedTakeAttempt,
  studentBelongsToTestGroup,
  TAKE_MAX_FAILED_ATTEMPTS,
  takeLockStorageKey,
  writeTakeLockState,
} from '../src/utils/takeTest';
import type { Question, Student } from '../src/types';

const student: Student = {
  id: 's1',
  firstName: 'Иван',
  middleName: 'Петров',
  lastName: 'Георгиев',
  class: '10А',
  number: 1,
  gender: 'male',
};

/** 2 MC + 1 short answer: само верните MC дават auto_points; краткият отговор винаги 0. */
function testAutoPointsThreeQuestions() {
  const mcCorrect: Question = {
    id: 'mc-correct',
    text: 'MC верен',
    points: 5,
    type: 'multiple_choice',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
  };
  const mcWrong: Question = {
    id: 'mc-wrong',
    text: 'MC грешен',
    points: 4,
    type: 'multiple_choice',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'B',
  };
  const shortAnswer: Question = {
    id: 'sa-1',
    text: 'Кратък отговор',
    points: 10,
    type: 'short_answer',
    correctAnswer: 'очакван текст',
  };
  const testQuestions = [mcCorrect, mcWrong, shortAnswer];
  const rawAnswers = {
    [mcCorrect.id]: 'A',
    [mcWrong.id]: 'C',
    [shortAnswer.id]: 'очакван текст',
  };

  assert.equal(computeAnswerAutoPoints(mcCorrect, 1, false, 'A'), 5);
  assert.equal(computeAnswerAutoPoints(mcWrong, 1, false, 'C'), 0);
  assert.equal(computeAnswerAutoPoints(shortAnswer, 1, false, 'очакван текст'), 0);

  const { answers, auto_points } = buildSubmissionPayload(
    testQuestions,
    1,
    false,
    rawAnswers
  );

  assert.equal(answers.length, 3);
  assert.deepEqual(
    answers.map(a => ({ questionId: a.questionId, auto_points: a.auto_points })),
    [
      { questionId: 'mc-correct', auto_points: 5 },
      { questionId: 'mc-wrong', auto_points: 0 },
      { questionId: 'sa-1', auto_points: 0 },
    ]
  );
  assert.equal(auto_points, 5);
}

function run() {
  assert.equal(studentBelongsToTestGroup(1, 1, true), true);
  assert.equal(studentBelongsToTestGroup(2, 1, true), false);
  assert.equal(studentBelongsToTestGroup(2, 2, true), true);
  assert.equal(studentBelongsToTestGroup(1, 2, false), true);

  assert.equal(
    namesMatchExactly(
      { firstName: 'Иван', middleName: 'Петров', lastName: 'Георгиев' },
      student
    ),
    true
  );
  assert.equal(
    namesMatchExactly(
      { firstName: 'иван', middleName: 'Петров', lastName: 'Георгиев' },
      student
    ),
    false
  );

  const students = [student, { ...student, id: 's2', number: 2, firstName: 'Мария' }];
  assert.ok(
    findMatchingStudent(students, '10А', 1, true, {
      firstName: 'Иван',
      middleName: 'Петров',
      lastName: 'Георгиев',
    })
  );
  assert.equal(
    findMatchingStudent(students, '10А', 2, true, {
      firstName: 'Иван',
      middleName: 'Петров',
      lastName: 'Георгиев',
    }),
    null
  );

  const questions: Question[] = [
    {
      id: 'q1',
      text: 'fallback',
      points: 2,
      type: 'short_answer',
      group1: { text: 'G1 text', correctAnswer: 'a' },
      group2: { text: 'G2 text', correctAnswer: 'b' },
    },
  ];
  const g1 = mapQuestionsForGroup(questions, 1, true);
  assert.equal(g1[0].text, 'G1 text');
  const g2 = mapQuestionsForGroup(questions, 2, true);
  assert.equal(g2[0].text, 'G2 text');

  const mcQuestion: Question = {
    id: 'mc1',
    text: 'Pick one',
    points: 3,
    type: 'multiple_choice',
    options: ['a', 'b', 'c', 'd'],
    correctAnswer: 'B',
  };
  assert.equal(getQuestionCorrectAnswer(mcQuestion, 1, false), 'B');
  assert.equal(computeAnswerAutoPoints(mcQuestion, 1, false, 'B'), 3);
  assert.equal(computeAnswerAutoPoints(mcQuestion, 1, false, 'A'), 0);
  assert.equal(computeAnswerAutoPoints(questions[0], 1, true, 'anything'), 0);

  const groupedMc: Question = {
    id: 'mcg',
    text: 'x',
    points: 2,
    type: 'multiple_choice',
    group1: {
      text: 'g1',
      correctAnswer: 'A',
      options: ['1', '2', '3', '4'],
    },
    group2: {
      text: 'g2',
      correctAnswer: 'C',
      options: ['1', '2', '3', '4'],
    },
  };
  assert.equal(getQuestionCorrectAnswer(groupedMc, 2, true), 'C');
  assert.equal(computeAnswerAutoPoints(groupedMc, 2, true, 'C'), 2);

  const payload = buildSubmissionPayload(
    [questions[0], mcQuestion],
    1,
    false,
    { [questions[0].id]: 'мой отговор', [mcQuestion.id]: 'B' }
  );
  assert.equal(payload.answers.length, 2);
  assert.equal(payload.answers[0].auto_points, 0);
  assert.equal(payload.answers[1].auto_points, 3);
  assert.equal(payload.auto_points, 3);

  testAutoPointsThreeQuestions();

  const mem = new Map<string, string>();
  const storage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => mem.set(k, v),
    removeItem: (k: string) => mem.delete(k),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });

  const key = takeLockStorageKey('tok-abc');
  assert.equal(readTakeLockState('tok-abc').blocked, false);
  for (let i = 0; i < TAKE_MAX_FAILED_ATTEMPTS - 1; i++) {
    recordFailedTakeAttempt('tok-abc');
  }
  assert.equal(readTakeLockState('tok-abc').blocked, false);
  recordFailedTakeAttempt('tok-abc');
  assert.equal(readTakeLockState('tok-abc').blocked, true);
  writeTakeLockState('tok-abc', { blocked: false, failedAttempts: 0 });
  assert.equal(mem.has(key), true);

  console.log('test-take-test: all passed');
}

run();
