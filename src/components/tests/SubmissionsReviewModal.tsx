import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAppContext } from '../../context/AppContext';
import { loadPendingSubmissionsForTest, updateSubmissionStatus } from '../../lib/submissionsApi';
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

interface SubmissionsReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  test: Test | null;
  onFinalized?: () => void;
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
      <div className="space-y-4">
        {loading && (
          <p className="text-sm text-gray-600 text-center py-6">Зареждане...</p>
        )}

        {!loading && submissions.length === 0 && !error && (
          <p className="text-sm text-gray-600 text-center py-6">
            Няма предавания, чакащи преглед.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {!loading && submissions.length > 0 && selected && (
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 min-h-[420px]">
            <aside className="border border-gray-200 rounded-lg overflow-hidden">
              <p className="text-xs font-semibold text-gray-500 uppercase px-3 py-2 bg-gray-50 border-b">
                Чакат преглед ({submissions.length})
              </p>
              <ul className="max-h-[380px] overflow-y-auto">
                {submissions.map(sub => {
                  const active = sub.id === selectedId;
                  const groupLabel = test.hasGroups
                    ? TEST_GROUP_LABELS[sub.groupNumber]
                    : null;
                  return (
                    <li key={sub.id}>
                      <button
                        type="button"
                        onClick={() => selectSubmission(sub)}
                        className={`w-full text-left px-3 py-2.5 text-sm border-b border-gray-100 hover:bg-blue-50 ${
                          active ? 'bg-blue-100 font-medium' : ''
                        }`}
                      >
                        <div className="text-gray-900">{sub.studentName}</div>
                        {groupLabel && (
                          <div className="text-xs text-gray-500">{groupLabel}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-0.5">
                          Авто: {sub.autoPoints} т.
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            <div className="space-y-4 min-w-0">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{selected.studentName}</h3>
                    {test.hasGroups && (
                      <p className="text-sm text-gray-600">
                        {TEST_GROUP_LABELS[selected.groupNumber]}
                      </p>
                    )}
                    {matchedStudent ? (
                      <p className="text-xs text-green-700 mt-1">
                        Свързан с ученик № {matchedStudent.number} от {test.class}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700 mt-1">
                        Ученикът не е намерен в класния списък — финализирането е блокирано.
                      </p>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-gray-600">Автоматични точки</div>
                    <div className="font-semibold text-gray-900">{selected.autoPoints} т.</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                {displayQuestions.map(dq => {
                  const sourceQuestion = test.questions.find(q => q.id === dq.id);
                  if (!sourceQuestion) return null;

                  const submissionAnswer = selected.answers.find(a => a.questionId === dq.id);
                  const correct = getQuestionCorrectAnswer(
                    sourceQuestion,
                    selected.groupNumber,
                    test.hasGroups
                  );
                  const earned = questionPoints[dq.id] ?? 0;
                  const isMc = dq.type === 'multiple_choice';

                  return (
                    <div
                      key={dq.id}
                      className="border border-gray-200 rounded-lg p-4 bg-white"
                    >
                      <div className="flex flex-wrap gap-2 mb-2 text-sm">
                        <span className="font-semibold text-blue-700">
                          Въпрос {dq.index}
                        </span>
                        <span className="text-gray-500">
                          ({dq.points} т.)
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {isMc ? 'Изборен' : 'Кратък отговор'}
                        </span>
                      </div>

                      <p className="text-sm text-gray-900 mb-3 whitespace-pre-wrap">
                        {dq.text || '—'}
                      </p>

                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <dt className="text-gray-500">Отговор на ученика</dt>
                          <dd className="font-medium text-gray-900">
                            {formatStudentAnswer(
                              submissionAnswer?.answer ?? '',
                              dq.type,
                              dq.options
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Верен отговор</dt>
                          <dd className="font-medium text-green-800">{correct || '—'}</dd>
                        </div>
                        {isMc && (
                          <div>
                            <dt className="text-gray-500">Автоматични точки</dt>
                            <dd className="font-medium text-gray-900">
                              {submissionAnswer?.auto_points ?? 0} / {dq.points}
                            </dd>
                          </div>
                        )}
                      </dl>

                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={`points-${dq.id}`}
                          className="text-sm text-gray-700"
                        >
                          Точки:
                        </label>
                        <input
                          id={`points-${dq.id}`}
                          type="number"
                          min={0}
                          max={dq.points}
                          step={dq.points === 1 ? 1 : 0.5}
                          value={earned || ''}
                          onChange={e =>
                            handlePointsChange(dq.id, e.target.value, dq.points)
                          }
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-500">/ {dq.points}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-xs text-gray-600">Общо точки</div>
                    <div className="text-lg font-bold text-gray-900">
                      {totalPoints.toFixed(1)} / {test.maxPoints}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Процент</div>
                    <div className="text-lg font-bold text-gray-900">
                      {previewPercentage > 0 ? `${Math.round(previewPercentage)}%` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Оценка</div>
                    <div className="text-lg font-bold text-gray-900">
                      {previewGrade || '—'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t">
                <Button variant="secondary" onClick={onClose} disabled={finalizing}>
                  Затвори
                </Button>
                <Button
                  onClick={handleFinalize}
                  disabled={!matchedStudent || finalizing || test.questions.length === 0}
                >
                  {finalizing ? 'Финализиране...' : 'Финализирай'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
