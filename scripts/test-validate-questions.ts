import assert from 'node:assert/strict';
import type { Question } from '../src/types';
import { validateQuestions } from '../src/utils/validateQuestions';

function run() {
  const cases: {
    name: string;
    questions: Question[];
    expectError: string | null;
    hasGroups?: boolean;
  }[] = [
    {
      name: 'empty list passes',
      questions: [],
      expectError: null,
    },
    {
      name: 'valid short answer',
      questions: [
        {
          id: 'q1',
          text: 'Столица на България?',
          points: 2,
          type: 'short_answer',
          correctAnswer: 'София',
        },
      ],
      expectError: null,
    },
    {
      name: 'valid multiple choice',
      questions: [
        {
          id: 'q1',
          text: '2+2=?',
          points: 1,
          type: 'multiple_choice',
          options: ['3', '4', '5', '6'],
          correctAnswer: 'B',
        },
      ],
      expectError: null,
    },
    {
      name: 'missing text',
      questions: [
        { id: 'q1', text: '  ', points: 1, type: 'short_answer', correctAnswer: 'x' },
      ],
      expectError: 'Въпрос 1: попълнете текста на въпроса.',
    },
    {
      name: 'MC missing option D',
      questions: [
        {
          id: 'q1',
          text: 'Q?',
          points: 1,
          type: 'multiple_choice',
          options: ['a', 'b', 'c', ''],
          correctAnswer: 'A',
        },
      ],
      expectError: 'Въпрос 1: попълнете всички варианти A–D.',
    },
    {
      name: 'MC missing correct answer',
      questions: [
        {
          id: 'q1',
          text: 'Q?',
          points: 1,
          type: 'multiple_choice',
          options: ['a', 'b', 'c', 'd'],
        },
      ],
      expectError: 'Въпрос 1: изберете верен отговор.',
    },
    {
      name: 'short answer missing correct',
      questions: [
        { id: 'q1', text: 'Q?', points: 1, type: 'short_answer', correctAnswer: '' },
      ],
      expectError: 'Въпрос 1: попълнете верния отговор.',
    },
    {
      name: 'two groups valid',
      questions: [
        {
          id: 'q1',
          text: '',
          points: 2,
          type: 'short_answer',
          group1: { text: 'I група въпрос', correctAnswer: 'а' },
          group2: { text: 'II група въпрос', correctAnswer: 'б' },
        },
      ],
      expectError: null,
      hasGroups: true,
    },
    {
      name: 'two groups missing group2 text',
      questions: [
        {
          id: 'q1',
          text: '',
          points: 2,
          type: 'short_answer',
          group1: { text: 'OK', correctAnswer: 'а' },
          group2: { text: '', correctAnswer: 'б' },
        },
      ],
      expectError: 'Въпрос 1, II група: попълнете текста на въпроса.',
      hasGroups: true,
    },
    {
      name: 'two groups missing group1 answer',
      questions: [
        {
          id: 'q1',
          text: '',
          points: 2,
          type: 'short_answer',
          group1: { text: 'OK', correctAnswer: '' },
          group2: { text: 'OK2', correctAnswer: 'б' },
        },
      ],
      expectError: 'Въпрос 1, I група: попълнете верния отговор.',
      hasGroups: true,
    },
    {
      name: 'two groups valid multiple choice',
      questions: [
        {
          id: 'q1',
          text: '',
          points: 2,
          type: 'multiple_choice',
          group1: {
            text: 'I MC',
            options: ['1', '2', '3', '4'],
            correctAnswer: 'A',
          },
          group2: {
            text: 'II MC',
            options: ['a', 'b', 'c', 'd'],
            correctAnswer: 'C',
          },
        },
      ],
      expectError: null,
      hasGroups: true,
    },
    {
      name: 'two groups MC missing group2 option',
      questions: [
        {
          id: 'q1',
          text: '',
          points: 2,
          type: 'multiple_choice',
          group1: {
            text: 'I',
            options: ['1', '2', '3', '4'],
            correctAnswer: 'B',
          },
          group2: {
            text: 'II',
            options: ['a', 'b', '', 'd'],
            correctAnswer: 'A',
          },
        },
      ],
      expectError: 'Въпрос 1, II група: попълнете всички варианти A–D.',
      hasGroups: true,
    },
  ];

  let passed = 0;
  for (const { name, questions, expectError, hasGroups } of cases) {
    const err = validateQuestions(questions, hasGroups ?? false);
    assert.equal(err, expectError, `case "${name}"`);
    passed++;
  }

  console.log(`✓ validateQuestions: ${passed}/${cases.length} cases passed`);
}

run();
