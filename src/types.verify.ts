/**
 * Compile-time checks for Question / Test shapes (included in app typecheck).
 */
import type { Question, Test, QuestionType, QuestionGroupContent } from './types';

const questionTypes: QuestionType[] = ['multiple_choice', 'short_answer'];

const multipleChoice: Question = {
  id: 'q1',
  text: '2+2=?',
  points: 2,
  type: 'multiple_choice',
  options: ['3', '4', '5'],
  correctAnswer: '4',
};

const shortAnswer: Question = {
  id: 'q2',
  text: 'Capital of France?',
  points: 3,
  type: 'short_answer',
  correctAnswer: 'Paris',
};

const withGroups: Question = {
  id: 'q3',
  text: 'Match items',
  points: 4,
  type: 'short_answer',
  group1: { text: 'Group A', correctAnswer: 'a1' },
  group2: { text: 'Group B', correctAnswer: 'b1' },
};

const groupMc: QuestionGroupContent = {
  text: 'Pick one',
  options: ['x', 'y', 'z', 'w'],
  correctAnswer: 'D',
};

const sampleTest: Test = {
  id: 't1',
  name: 'Math test',
  class: '10A',
  type: 'Нормален тест',
  date: '2026-05-22',
  maxPoints: 10,
  gradeScale: { grade2: 0, grade3: 4, grade4: 6, grade5: 8, grade6: 9 },
  hasGroups: true,
  mode: 'offline',
  questions: [multipleChoice, shortAnswer, withGroups],
};

export const typeVerifyFixtures = {
  questionTypes,
  multipleChoice,
  shortAnswer,
  withGroups,
  groupMc,
  sampleTest,
};
