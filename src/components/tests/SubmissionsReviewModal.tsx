import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAppContext } from '../../context/AppContext';
import {
  countAllSubmissionsForTest,
  loadPendingSubmissionsForTest,
  SUBMISSIONS_RLS_HINT,
  updateSubmissionStatus,
} from '../../lib/submissionsApi';
import { TEST_GROUP_LABELS } from '../../utils/testLinks';
import { OPTION_LABELS } from '../../utils/validateQuestions';
import {
  buildResultFromQuestionPoints,
  clampQuestionPointsValue,
  findStudentByDisplayName,
  initialQuestionPointsFromSubmission,
  sumQuestionPoints,
} from '../../utils/finalizeSubmission';
import {
  getQuestionCorrectAnswer,
  mapQuestionsForGroup,
} from '../../utils/takeTest';
import { calculateGrade } from '../../utils/gradeCalculator';
import type { Submission, Test } from '../../types';
import './SubmissionsReviewModal.css';

interface SubmissionsReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  test: Test | null;
  onFinalized?: () => void;
}

function studentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export const SubmissionsReviewModal: React.FC<SubmissionsReviewModalProps> = ({
  isOpen,
  onClose,
  test,
  onFinalized,
}) => {
  const { students, results, addResult, updateResult } = useAppContext();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [questionPoints, setQuestionPoints] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [finalizing, setFinalizing] = useState(false);
  const [totalSubmissions, setTotalSubmissions] = useState<number | null>(null);

  const selected = useMemo(
    () => submissions.find(s => s.id === selectedId) ?? null,
    [submissions, selectedId]
  );

  const matchedStudent = useMemo(() => {
    if (!test || !selected) return null;
    return findStudentByDisplayName(students, test.class, selected.studentName);
  }, [test, selected, students]);

  const displayQuestions = useMemo(() => {
    if (!test || !selected) return [];
    return mapQuestionsForGroup(test.questions, selected.groupNumber, test.hasGroups);
  }, [test, selected]);

  const totalPoints = useMemo(() => sumQuestionPoints(questionPoints), [questionPoints]);

  const { grade: previewGrade, percentage: previewPercentage } = useMemo(() => {
    if (!test || totalPoints <= 0) {
      return { grade: '', percentage: 0 };
    }
    return calculateGrade(totalPoints, test.maxPoints, test.gradeScale);
  }, [test, totalPoints]);

  const loadSubmissions = useCallback(async () => {
    if (!test) return;
    setLoading(true);
    setError('');
    try {
      const rows = await loadPendingSubmissionsForTest(test.id);
      const total = await countAllSubmissionsForTest(test.id);
      setTotalSubmissions(total);
      setSubmissions(rows);
      if (rows.length > 0) {
        setSelectedId(rows[0].id);
        setQuestionPoints(
          initialQuestionPointsFromSubmission(test, rows[0].answers)
        );
      } else {
        setSelectedId(null);
        setQuestionPoints({});
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Грешка при зареждане на предаванията.';
      setError(message);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, [test]);

  useEffect(() => {
    if (!isOpen || !test) {
      setSubmissions([]);
      setSelectedId(null);
      setQuestionPoints({});
      setError('');
      return;
    }
    loadSubmissions();
  }, [isOpen, test?.id, loadSubmissions]);

  const selectSubmission = (submission: Submission) => {
    if (!test) return;
    setSelectedId(submission.id);
    setQuestionPoints(initialQuestionPointsFromSubmission(test, submission.answers));
    setError('');
  };

  const handlePointsChange = (questionId: string, value: string, maxPoints: number) => {
    const parsed = value === '' ? 0 : parseFloat(value);
    setQuestionPoints(prev => ({
      ...prev,
      [questionId]: clampQuestionPointsValue(parsed, maxPoints),
    }));
  };

  const formatStudentAnswer = (
    answer: string,
    type: string,
    options?: string[]
  ): string => {
    if (type !== 'multiple_choice' || !options?.length) {
      return answer || '—';
    }
    const index = OPTION_LABELS.indexOf(answer as (typeof OPTION_LABELS)[number]);
    if (index >= 0 && options[index]) {
      return `${answer}. ${options[index]}`;
    }
    return answer || '—';
  };

  const handleFinalize = async () => {
    if (!test || !selected || !matchedStudent) return;

    setFinalizing(true);
    setError('');

    try {
      const resultPayload = buildResultFromQuestionPoints(
        test,
        matchedStudent.id,
        questionPoints
      );

      const existing = results.find(
        r => r.testId === test.id && r.studentId === matchedStudent.id
      );

      if (existing) {
        await updateResult(existing.id, resultPayload);
      } else {
        await addResult(resultPayload);
      }

      await updateSubmissionStatus(selected.id, 'finalized');

      const remaining = submissions.filter(s => s.id !== selected.id);
      setSubmissions(remaining);
      onFinalized?.();

      if (remaining.length > 0) {
        selectSubmission(remaining[0]);
      } else {
        setSelectedId(null);
        setQuestionPoints({});
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Грешка при финализиране.';
      setError(message);
    } finally {
      setFinalizing(false);
    }
  };

  if (!test) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Преглед на предавания — ${test.name}`}
      size="xl"
    >
      <div className="submission-review">
        {loading && (
          <p className="submission-review__loading">Зареждане на предавания...</p>
        )}

        {!loading && submissions.length === 0 && !error && (
          <div className="submission-review__empty">
            <p>Няма предавания, чакащи преглед за този тест.</p>
            {totalSubmissions != null && totalSubmissions > 0 && (
              <p className="submission-review__hint submission-review__hint--warn">
                В базата има {totalSubmissions} предавания за този тест, но не са видими
                като чакащи — вероятно вече са финализирани.
              </p>
            )}
            {totalSubmissions === 0 && (
              <p className="submission-review__hint submission-review__hint--muted">
                В таблица submissions няма записи за този тест.
              </p>
            )}
            {totalSubmissions === -1 && (
              <p className="submission-review__hint submission-review__hint--error">
                {SUBMISSIONS_RLS_HINT}
              </p>
            )}
          </div>
        )}

        {error && submissions.length === 0 && !loading && (
          <p className="submission-review__error" role="alert">
            {error}
          </p>
        )}

        {!loading && submissions.length > 0 && selected && (
          <div className="submission-review__layout">
            <aside className="submission-review__sidebar">
              <p className="submission-review__sidebar-head">
                Чакат преглед · {submissions.length}
              </p>
              <ul className="submission-review__list">
                {submissions.map(sub => {
                  const active = sub.id === selectedId;
                  const groupLabel = test.hasGroups
                    ? TEST_GROUP_LABELS[sub.groupNumber]
                    : null;
                  return (
                    <li key={sub.id} className="submission-review__list-item">
                      <button
                        type="button"
                        onClick={() => selectSubmission(sub)}
                        className={`submission-review__list-btn${
                          active ? ' submission-review__list-btn--active' : ''
                        }`}
                      >
                        <span className="submission-review__list-name">
                          {sub.studentName}
                        </span>
                        <span className="submission-review__list-meta">
                          {groupLabel && (
                            <span className="submission-review__badge">{groupLabel}</span>
                          )}
                          <span className="submission-review__badge submission-review__badge--points">
                            Авто {sub.autoPoints} т.
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            <div className="submission-review__main">
              {error && (
                <p className="submission-review__error" role="alert">
                  {error}
                </p>
              )}

              <div className="submission-review__main-scroll">
              <div className="submission-review__student-card">
                <div className="submission-review__student-left">
                  <span className="submission-review__avatar" aria-hidden>
                    {studentInitials(selected.studentName)}
                  </span>
                  <div>
                    <h3 className="submission-review__student-title">
                      {selected.studentName}
                    </h3>
                    {test.hasGroups && (
                      <p className="submission-review__student-sub">
                        {TEST_GROUP_LABELS[selected.groupNumber]}
                      </p>
                    )}
                    {matchedStudent ? (
                      <p className="submission-review__student-sub submission-review__student-sub--ok">
                        № {matchedStudent.number} · {test.class}
                      </p>
                    ) : (
                      <p className="submission-review__student-sub submission-review__student-sub--warn">
                        Не е в класния списък — финализирането е блокирано
                      </p>
                    )}
                  </div>
                </div>
                <div className="submission-review__auto-score">
                  <div className="submission-review__auto-label">Автоматично</div>
                  <div className="submission-review__auto-value">
                    {selected.autoPoints} т.
                  </div>
                </div>
              </div>

              <div className="submission-review__questions">
                {displayQuestions.map(dq => {
                  const sourceQuestion = test.questions.find(q => q.id === dq.id);
                  if (!sourceQuestion) return null;

                  const submissionAnswer = selected.answers.find(
                    a => a.questionId === dq.id
                  );
                  const correct = getQuestionCorrectAnswer(
                    sourceQuestion,
                    selected.groupNumber,
                    test.hasGroups
                  );
                  const earned = questionPoints[dq.id] ?? 0;
                  const isMc = dq.type === 'multiple_choice';

                  return (
                    <article key={dq.id} className="submission-review__question">
                      <div className="submission-review__question-head">
                        <span className="submission-review__q-num">{dq.index}</span>
                        <span className="submission-review__q-meta">
                          {dq.points} {dq.points === 1 ? 'т.' : 'т.'}
                        </span>
                        <span
                          className={`submission-review__q-type${
                            isMc ? '' : ' submission-review__q-type--short'
                          }`}
                        >
                          {isMc ? 'Изборен' : 'Кратък'}
                        </span>
                      </div>
                      <div className="submission-review__question-body">
                        <p className="submission-review__q-text">{dq.text || '—'}</p>

                        <div className="submission-review__answers-grid">
                          <div className="submission-review__answer-box">
                            <span className="submission-review__answer-label">
                              Отговор на ученика
                            </span>
                            <span className="submission-review__answer-value">
                              {formatStudentAnswer(
                                submissionAnswer?.answer ?? '',
                                dq.type,
                                dq.options
                              )}
                            </span>
                          </div>
                          <div className="submission-review__answer-box submission-review__answer-box--correct">
                            <span className="submission-review__answer-label">
                              Верен отговор
                            </span>
                            <span className="submission-review__answer-value submission-review__answer-value--correct">
                              {correct || '—'}
                            </span>
                          </div>
                        </div>

                        {isMc && (
                          <p className="submission-review__auto-hint">
                            Автоматични точки: {submissionAnswer?.auto_points ?? 0} /{' '}
                            {dq.points}
                          </p>
                        )}

                        <div className="submission-review__points-row">
                          <span className="submission-review__points-label">
                            Точки за въпроса
                          </span>
                          <input
                            id={`points-${dq.id}`}
                            type="number"
                            className="submission-review__points-input"
                            min={0}
                            max={dq.points}
                            step={dq.points === 1 ? 1 : 0.5}
                            value={earned || ''}
                            onChange={e =>
                              handlePointsChange(dq.id, e.target.value, dq.points)
                            }
                          />
                          <span className="submission-review__points-max">
                            от {dq.points} т.
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              </div>

              <div className="submission-review__bottom">
              <div className="submission-review__summary">
                <div className="submission-review__summary-item">
                  <div className="submission-review__summary-label">Общо точки</div>
                  <div className="submission-review__summary-value">
                    {totalPoints.toFixed(1)} / {test.maxPoints}
                  </div>
                </div>
                <div className="submission-review__summary-item">
                  <div className="submission-review__summary-label">Процент</div>
                  <div className="submission-review__summary-value">
                    {previewPercentage > 0 ? `${Math.round(previewPercentage)}%` : '—'}
                  </div>
                </div>
                <div className="submission-review__summary-item">
                  <div className="submission-review__summary-label">Оценка</div>
                  <div className="submission-review__summary-value">
                    {previewGrade || '—'}
                  </div>
                </div>
              </div>

              <div className="submission-review__footer">
                <Button variant="secondary" onClick={onClose} disabled={finalizing}>
                  Затвори
                </Button>
                <Button
                  onClick={handleFinalize}
                  disabled={!matchedStudent || finalizing || test.questions.length === 0}
                >
                  {finalizing ? 'Финализиране...' : 'Финализирай в резултати'}
                </Button>
              </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
