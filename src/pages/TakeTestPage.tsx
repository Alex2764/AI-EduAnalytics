import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { TEST_GROUP_LABELS } from '../utils/testLinks';
import { OPTION_LABELS } from '../utils/validateQuestions';
import {
  buildSubmissionPayload,
  findMatchingStudent,
  formatStudentDisplayName,
  mapQuestionsForGroup,
  readTakeLockState,
  recordFailedTakeAttempt,
  TAKE_MAX_FAILED_ATTEMPTS,
  type TakeDisplayQuestion,
  type TakeNameInput,
} from '../utils/takeTest';
import { loadStudentsForClass, loadTakeTestByToken, submitTakeTest } from '../lib/takeTestApi';
import type { Student } from '../types';
import type { TakeTestContext } from '../lib/takeTestApi';

type PagePhase = 'loading' | 'error' | 'blocked' | 'identify' | 'questions' | 'submitted';

function toStudent(row: {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  className: string;
  number: number;
}): Student {
  return {
    id: row.id,
    firstName: row.firstName,
    middleName: row.middleName,
    lastName: row.lastName,
    class: row.className,
    number: row.number,
    gender: 'male',
  };
}

export function TakeTestPage() {
  const { token: tokenParam } = useParams<{ token: string }>();
  const token = tokenParam?.trim() ?? '';

  const [phase, setPhase] = useState<PagePhase>('loading');
  const [loadError, setLoadError] = useState('');
  const [context, setContext] = useState<TakeTestContext | null>(null);
  const [displayQuestions, setDisplayQuestions] = useState<TakeDisplayQuestion[]>([]);
  const [verifiedStudent, setVerifiedStudent] = useState<Student | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nameError, setNameError] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState(TAKE_MAX_FAILED_ATTEMPTS);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError('Липсва код за достъп до теста.');
      setPhase('error');
      return;
    }

    const lock = readTakeLockState(token);
    if (lock.blocked) {
      setPhase('blocked');
      return;
    }
    setRemainingAttempts(Math.max(0, TAKE_MAX_FAILED_ATTEMPTS - lock.failedAttempts));

    let cancelled = false;

    const load = async () => {
      setPhase('loading');
      setLoadError('');
      try {
        const loaded = await loadTakeTestByToken(token);
        if (cancelled) return;
        setContext(loaded);
        setPhase('identify');
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Грешка при зареждане на теста.';
        setLoadError(message);
        setPhase('error');
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const groupLabel = useMemo(() => {
    if (!context?.test.hasGroups) return undefined;
    return TEST_GROUP_LABELS[context.groupNumber];
  }, [context]);

  const handleVerifyName = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!context || !token) return;

      const lock = readTakeLockState(token);
      if (lock.blocked) {
        setPhase('blocked');
        return;
      }

      const input: TakeNameInput = { firstName, middleName, lastName };
      if (!firstName.trim() || !middleName.trim() || !lastName.trim()) {
        setNameError('Моля, въведете име, презиме и фамилия.');
        return;
      }

      setNameError('');
      setSubmitting(true);

      try {
        const rows = await loadStudentsForClass(context.test.className);
        const students = rows.map(toStudent);
        const match = findMatchingStudent(
          students,
          context.test.className,
          context.groupNumber,
          context.test.hasGroups,
          input
        );

        if (!match) {
          const nextLock = recordFailedTakeAttempt(token);
          const left = Math.max(0, TAKE_MAX_FAILED_ATTEMPTS - nextLock.failedAttempts);
          setRemainingAttempts(left);
          if (nextLock.blocked) {
            setPhase('blocked');
            return;
          }
          setNameError(
            `Името не съвпада с ученик от ${groupLabel ? `${groupLabel} на ` : ''}класа. Остават ${left} опита.`
          );
          return;
        }

        setVerifiedStudent(match);
        setDisplayQuestions(
          mapQuestionsForGroup(
            context.test.questions,
            context.groupNumber,
            context.test.hasGroups
          )
        );
        setAnswers({});
        setSubmitError('');
        setPhase('questions');
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Грешка при проверка на името.';
        setNameError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [context, token, firstName, middleName, lastName, groupLabel]
  );

  const setAnswer = useCallback((questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    setSubmitError('');
  }, []);

  const handleSubmitTest = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!context || !verifiedStudent) return;

      const unanswered = displayQuestions.filter(q => !(answers[q.id] ?? '').trim());
      if (unanswered.length > 0) {
        setSubmitError('Моля, отговорете на всички въпроси преди да предадете теста.');
        return;
      }

      setSubmitError('');
      setSubmitting(true);

      try {
        const { answers: submissionAnswers, auto_points } = buildSubmissionPayload(
          context.test.questions,
          context.groupNumber,
          context.test.hasGroups,
          answers
        );

        await submitTakeTest({
          testId: context.test.id,
          studentName: formatStudentDisplayName(verifiedStudent),
          groupNumber: context.groupNumber,
          answers: submissionAnswers,
          auto_points,
        });

        setPhase('submitted');
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Грешка при предаване на теста.';
        setSubmitError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [context, verifiedStudent, displayQuestions, answers]
  );

  if (!tokenParam) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="take-test-page min-h-screen bg-gray-50 flex flex-col">
      <header className="take-test-header bg-white border-b border-gray-200 px-4 py-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Онлайн тест</p>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {context?.test.name ?? 'Зареждане...'}
          </h1>
          {context && (
            <p className="text-sm text-gray-600 mt-1">
              Клас: <strong>{context.test.className}</strong>
              {groupLabel && (
                <>
                  {' '}
                  · Вариант: <strong>{groupLabel}</strong>
                </>
              )}
            </p>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:px-6">
        <div className="max-w-3xl mx-auto">
          {phase === 'loading' && (
            <p className="text-center text-gray-600 py-12">Зареждане на теста...</p>
          )}

          {phase === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <p className="text-red-800 font-medium">{loadError}</p>
            </div>
          )}

          {phase === 'blocked' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
              <h2 className="text-lg font-semibold text-amber-900 mb-2">Достъпът е блокиран</h2>
              <p className="text-amber-800 text-sm">
                Направихте {TAKE_MAX_FAILED_ATTEMPTS} неуспешни опита за идентификация. Моля,
                обърнете се към учителя си за нов линк или помощ.
              </p>
            </div>
          )}

          {phase === 'submitted' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <h2 className="text-lg font-semibold text-green-900 mb-2">Готово</h2>
              <p className="text-green-800">Твоят тест е предаден успешно.</p>
            </div>
          )}

          {phase === 'identify' && context && (
            <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Идентификация</h2>
              <p className="text-sm text-gray-600 mb-6">
                Въведете трите си имена точно както са записани в класния списък
                {groupLabel ? ` (${groupLabel})` : ''}.
              </p>

              <form onSubmit={handleVerifyName} className="space-y-4">
                <Input
                  label="Име"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Иван"
                  required
                  disabled={submitting}
                />
                <Input
                  label="Презиме"
                  value={middleName}
                  onChange={e => setMiddleName(e.target.value)}
                  placeholder="Петров"
                  required
                  disabled={submitting}
                />
                <Input
                  label="Фамилия"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Георгиев"
                  required
                  disabled={submitting}
                />

                {nameError && (
                  <p className="text-sm text-red-600" role="alert">
                    {nameError}
                  </p>
                )}

                {remainingAttempts < TAKE_MAX_FAILED_ATTEMPTS && remainingAttempts > 0 && (
                  <p className="text-xs text-gray-500">
                    Оставащи опити: {remainingAttempts}
                  </p>
                )}

                <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                  {submitting ? 'Проверка...' : 'Продължи към теста'}
                </Button>
              </form>
            </section>
          )}

          {phase === 'questions' && context && verifiedStudent && (
            <form onSubmit={handleSubmitTest} className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
                Здравей,{' '}
                <strong>
                  {verifiedStudent.firstName} {verifiedStudent.middleName}{' '}
                  {verifiedStudent.lastName}
                </strong>
                ! Отговорете на всички въпроси по-долу.
              </div>

              {displayQuestions.length === 0 ? (
                <p className="text-gray-600 text-center py-8">Няма въпроси в този тест.</p>
              ) : (
                <ol className="space-y-4 list-none p-0 m-0">
                  {displayQuestions.map(q => (
                    <li
                      key={q.id}
                      className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6"
                    >
                      <div className="flex flex-wrap items-baseline gap-2 mb-3">
                        <span className="text-sm font-semibold text-blue-700">
                          Въпрос {q.index}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({q.points} {q.points === 1 ? 'т.' : 'т.'})
                        </span>
                        {q.type === 'multiple_choice' && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            Изборен
                          </span>
                        )}
                      </div>
                      <p className="text-gray-900 whitespace-pre-wrap mb-4">{q.text || '—'}</p>

                      {q.type === 'multiple_choice' && q.options && q.options.length > 0 && (
                        <fieldset className="space-y-2">
                          <legend className="sr-only">Изберете отговор за въпрос {q.index}</legend>
                          {q.options.map((opt, optIndex) => {
                            const label = OPTION_LABELS[optIndex] ?? String(optIndex + 1);
                            return (
                              <label
                                key={optIndex}
                                className="flex items-start gap-3 text-sm text-gray-700 border border-gray-100 rounded-lg px-3 py-2 bg-gray-50 cursor-pointer hover:border-blue-200 has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50"
                              >
                                <input
                                  type="radio"
                                  name={`question-${q.id}`}
                                  value={label}
                                  checked={answers[q.id] === label}
                                  onChange={() => setAnswer(q.id, label)}
                                  disabled={submitting}
                                  className="mt-1"
                                  required
                                />
                                <span>
                                  {label}. {opt}
                                </span>
                              </label>
                            );
                          })}
                        </fieldset>
                      )}

                      {q.type === 'short_answer' && (
                        <Input
                          label="Вашият отговор"
                          value={answers[q.id] ?? ''}
                          onChange={e => setAnswer(q.id, e.target.value)}
                          placeholder="Въведете отговор"
                          required
                          disabled={submitting}
                        />
                      )}
                    </li>
                  ))}
                </ol>
              )}

              {submitError && (
                <p className="text-sm text-red-600 text-center" role="alert">
                  {submitError}
                </p>
              )}

              <div className="flex flex-col items-center gap-3 pt-2">
                <p className="text-xs text-gray-500">Макс. точки: {context.test.maxPoints}</p>
                <Button type="submit" disabled={submitting} className="w-full sm:w-auto min-w-[10rem]">
                  {submitting ? 'Предаване...' : 'Предай'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
