import type { Question, QuestionGroupContent, QuestionType } from '../types';

export const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

export const emptyQuestionOptions = (): string[] => ['', '', '', ''];

const GROUP_LABELS = { group1: 'I група', group2: 'II група' } as const;

function validateGroup(
  group: QuestionGroupContent | undefined,
  groupKey: keyof typeof GROUP_LABELS,
  questionIndex: number,
  type: QuestionType
): string | null {
  const label = GROUP_LABELS[groupKey];
  const prefix = `Въпрос ${questionIndex + 1}, ${label}`;

  if (!group?.text?.trim()) {
    return `${prefix}: попълнете текста на въпроса.`;
  }

  if (type === 'multiple_choice') {
    const opts = group.options ?? emptyQuestionOptions();
    const missingOpt = OPTION_LABELS.find((_, idx) => !opts[idx]?.trim());
    if (missingOpt) {
      return `${prefix}: попълнете всички варианти A–D.`;
    }
    if (!group.correctAnswer || !OPTION_LABELS.includes(group.correctAnswer as (typeof OPTION_LABELS)[number])) {
      return `${prefix}: изберете верен отговор.`;
    }
    return null;
  }

  if (!group.correctAnswer?.trim()) {
    return `${prefix}: попълнете верния отговор.`;
  }
  return null;
}

/** Returns error message or null if valid. */
export function validateQuestions(questions: Question[], hasGroups = false): string | null {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    if (hasGroups) {
      const err1 = validateGroup(q.group1, 'group1', i, q.type);
      if (err1) return err1;
      const err2 = validateGroup(q.group2, 'group2', i, q.type);
      if (err2) return err2;
      continue;
    }

    if (!q.text.trim()) {
      return `Въпрос ${i + 1}: попълнете текста на въпроса.`;
    }
    if (q.type === 'multiple_choice') {
      const opts = q.options ?? emptyQuestionOptions();
      const missingOpt = OPTION_LABELS.find((_, idx) => !opts[idx]?.trim());
      if (missingOpt) {
        return `Въпрос ${i + 1}: попълнете всички варианти A–D.`;
      }
      if (!q.correctAnswer || !OPTION_LABELS.includes(q.correctAnswer as (typeof OPTION_LABELS)[number])) {
        return `Въпрос ${i + 1}: изберете верен отговор.`;
      }
    } else if (!q.correctAnswer?.trim()) {
      return `Въпрос ${i + 1}: попълнете верния отговор.`;
    }
  }
  return null;
}
