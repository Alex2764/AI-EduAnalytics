import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { TEST_GROUP_LABELS } from '../utils/testLinks';
import { OPTION_LABELS } from '../utils/validateQuestions';
import {
  buildSubmissionPayload,
  formatDisplayNameFromInput,
  formatStudentDisplayName,
  mapQuestionsForGroup,
  readTakeLockState,
  recordFailedTakeAttempt,
  TAKE_MAX_FAILED_ATTEMPTS,
  verifyTakeTestIdentity,
  type TakeDisplayQuestion,
  type TakeNameInput,
} from '../utils/takeTest';
import {
  hasSubmissionForStudent,
  loadStudentsForClass,
  loadTakeTestByToken,
  loadTestTokenIdForGroup,
  submitTakeTest,
  TAKE_ALREADY_SUBMITTED_MESSAGE,
} from '../lib/takeTestApi';
import type { Student } from '../types';
import type { TakeTestContext } from '../lib/takeTestApi';
import './TakeTestPage.css';

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

function TakeNameField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled: boolean;
}) {
  return (
    <div className="take-test__field">
      <label>{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required
        disabled={disabled}
        autoComplete="name"
      />
    </div>
  );
}

export function TakeTestPage() {
  const { token: tokenParam } = useParams<{ token: string }>();
  const token = tokenParam?.trim() ?? '';

  const [phase, setPhase] = useState<PagePhase>('loading');
  const [loadError, setLoadError] = useState('');
  const [context, setContext] = useState<TakeTestContext | null>(null);
  const [displayQuestions, setDisplayQuestions] = useState<TakeDisplayQuestion[]>([]);
  const [verifiedStudent, setVerifiedStudent] = useState<Student | null>(null);
  /** Set after name check: I/II from № in class list (not from URL). */
  const [studentGroupNumber, setStudentGroupNumber] = useState<number | null>(null);
  const [submitTokenId, setSubmitTokenId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nameError, setNameError] = useState('');
  const [identifyAlert, setIdentifyAlert] = useState('');
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

  useEffect(() => {
    setIdentifyAlert('');
    setNameError('');
  }, [firstName, middleName, lastName]);

  const groupLabel = useMemo(() => {
    if (!context?.test.hasGroups || studentGroupNumber == null) return undefined;
    return TEST_GROUP_LABELS[studentGroupNumber];
  }, [context, studentGroupNumber]);

  const answeredCount = useMemo(
    () => displayQuestions.filter(q => (answers[q.id] ?? '').trim()).length,
    [displayQuestions, answers]
  );

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
      setIdentifyAlert('');
      setSubmitting(true);

      try {
        const alreadySubmitted = await hasSubmissionForStudent(
          context.test.id,
          formatDisplayNameFromInput(input)
        );
        if (alreadySubmitted) {
          setIdentifyAlert(TAKE_ALREADY_SUBMITTED_MESSAGE);
          return;
        }

        const rows = await loadStudentsForClass(context.test.className);
        const students = rows.map(toStudent);
        const identity = verifyTakeTestIdentity(
          students,
          context.test.className,
          context.test.hasGroups,
          input
        );

        if (identity.status !== 'ok') {
          const nextLock = recordFailedTakeAttempt(token);
          const left = Math.max(0, TAKE_MAX_FAILED_ATTEMPTS - nextLock.failedAttempts);
          setRemainingAttempts(left);
          if (nextLock.blocked) {
            setPhase('blocked');
            return;
          }
          setNameError(
            `Името не съвпада с ученик от ${context.test.className}. Провери правописа. Остават ${left} опита.`
          );
          return;
        }

        const tokenId = await loadTestTokenIdForGroup(
          context.test.id,
          identity.groupNumber
        );

        setVerifiedStudent(identity.student);
        setStudentGroupNumber(identity.groupNumber);
        setSubmitTokenId(tokenId);
        setDisplayQuestions(
          mapQuestionsForGroup(
            context.test.questions,
            identity.groupNumber,
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
    [context, token, firstName, middleName, lastName]
  );

  const setAnswer = useCallback((questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    setSubmitError('');
  }, []);

  const handleSubmitTest = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!context || !verifiedStudent || studentGroupNumber == null || !submitTokenId) return;

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
          studentGroupNumber,
          context.test.hasGroups,
          answers
        );

        await submitTakeTest({
          testId: context.test.id,
          tokenId: submitTokenId,
          studentName: formatStudentDisplayName(verifiedStudent),
          groupNumber: studentGroupNumber,
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
    [context, verifiedStudent, studentGroupNumber, submitTokenId, displayQuestions, answers]
  );

  if (!tokenParam) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="take-test">
      <header className="take-test__header">
        <div className="take-test__header-inner">
          <p className="take-test__eyebrow">Онлайн тест</p>
          <h1 className="take-test__title">{context?.test.name ?? 'Зареждане...'}</h1>
          {context && (
            <div className="take-test__meta">
              <span className="take-test__meta-pill">
                Клас <strong>{context.test.className}</strong>
              </span>
              {groupLabel && (
                <span className="take-test__meta-pill">
                  Вариант <strong>{groupLabel}</strong>
                </span>
              )}
              <span className="take-test__meta-pill">
                Макс. <strong>{context.test.maxPoints} т.</strong>
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="take-test__main">
        <div className="take-test__main-inner">
          {phase === 'loading' && (
            <p className="take-test__loading">Зареждане на теста...</p>
          )}

          {phase === 'error' && (
            <div className="take-test__alert take-test__alert--error" role="alert">
              <p>{loadError}</p>
            </div>
          )}

          {phase === 'blocked' && (
            <div className="take-test__alert take-test__alert--warn">
              <h2 className="take-test__alert-title">Достъпът е блокиран</h2>
              <p>
                Направихте {TAKE_MAX_FAILED_ATTEMPTS} неуспешни опита за идентификация. Моля,
                обърнете се към учителя си за нов линк или помощ.
              </p>
            </div>
          )}

          {phase === 'submitted' && (
            <div className="take-test__alert take-test__alert--ok">
              <h2 className="take-test__alert-title">Готово</h2>
              <p>Твоят тест е предаден успешно. Можеш да затвориш тази страница.</p>
            </div>
          )}

          {phase === 'identify' && context && (
            <section className="take-test__card">
              <h2 className="take-test__card-title">Преди да започнеш</h2>
              <p className="take-test__card-lead">
                Въведете трите си имена точно както са в класния списък. След проверката
                системата автоматично определя варианта на теста (I или II група) по номера
                ви в списъка.
                {context.test.hasGroups && (
                  <span className="take-test__card-hint">
                    Нечетен № → I група · Четен № → II група
                  </span>
                )}
              </p>

              <form onSubmit={handleVerifyName}>
                {identifyAlert && (
                  <div
                    className="take-test__alert take-test__alert--warn take-test__identify-alert"
                    role="alert"
                  >
                    <p>{identifyAlert}</p>
                  </div>
                )}

                <div className="take-test__name-grid">
                  <TakeNameField
                    label="Име"
                    value={firstName}
                    onChange={setFirstName}
                    placeholder="Иван"
                    disabled={submitting}
                  />
                  <TakeNameField
                    label="Презиме"
                    value={middleName}
                    onChange={setMiddleName}
                    placeholder="Петров"
                    disabled={submitting}
                  />
                  <TakeNameField
                    label="Фамилия"
                    value={lastName}
                    onChange={setLastName}
                    placeholder="Георгиев"
                    disabled={submitting}
                  />
                </div>

                {nameError && (
                  <p className="take-test__inline-error" role="alert">
                    {nameError}
                  </p>
                )}

                {remainingAttempts < TAKE_MAX_FAILED_ATTEMPTS && remainingAttempts > 0 && (
                  <p className="take-test__footer-hint" style={{ marginTop: '0.75rem' }}>
                    Оставащи опити: {remainingAttempts}
                  </p>
                )}

                <div className="take-test__actions">
                  <Button type="submit" disabled={submitting} className="take-test__submit">
                    {submitting ? 'Проверка...' : 'Започни теста'}
                  </Button>
                </div>
              </form>
            </section>
          )}

          {phase === 'questions' && context && verifiedStudent && (
            <form onSubmit={handleSubmitTest}>
              <div className="take-test__welcome">
                <span className="take-test__welcome-icon" aria-hidden>
                  ✓
                </span>
                <p>
                  Здравей,{' '}
                  <strong>
                    {verifiedStudent.firstName} {verifiedStudent.middleName}{' '}
                    {verifiedStudent.lastName}
                  </strong>
                  !
                  {groupLabel && (
                    <>
                      {' '}
                      Вариант: <strong>{groupLabel}</strong> (№{verifiedStudent.number} в
                      списъка).
                    </>
                  )}
                  {' '}
                  Попълни всички въпроси и натисни „Предай“ в края.
                </p>
              </div>

              {displayQuestions.length === 0 ? (
                <p className="take-test__loading">Няма въпроси в този тест.</p>
              ) : (
                <>
                  <p className="take-test__progress">
                    Отговорени {answeredCount} от {displayQuestions.length} въпроса
                  </p>
                  <ol className="take-test__questions">
                    {displayQuestions.map(q => (
                      <li key={q.id} className="take-test__question">
                        <div className="take-test__question-head">
                          <span className="take-test__question-num">{q.index}</span>
                          <div className="take-test__question-tags">
                            <span className="take-test__tag">
                              {q.points} {q.points === 1 ? 'т.' : 'т.'}
                            </span>
                            {q.type === 'multiple_choice' && (
                              <span className="take-test__tag take-test__tag--mc">
                                Изборен
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="take-test__question-body">
                          <p className="take-test__question-text">{q.text || '—'}</p>

                          {q.type === 'multiple_choice' && q.options && q.options.length > 0 && (
                            <fieldset className="take-test__options">
                              <legend className="sr-only">
                                Изберете отговор за въпрос {q.index}
                              </legend>
                              {q.options.map((opt, optIndex) => {
                                const letter = OPTION_LABELS[optIndex] ?? String(optIndex + 1);
                                const selected = answers[q.id] === letter;
                                return (
                                  <label
                                    key={optIndex}
                                    className={`take-test__option${selected ? ' take-test__option--selected' : ''}`}
                                  >
                                    <input
                                      type="radio"
                                      name={`question-${q.id}`}
                                      value={letter}
                                      checked={selected}
                                      onChange={() => setAnswer(q.id, letter)}
                                      disabled={submitting}
                                      required
                                    />
                                    <span className="take-test__option-letter">{letter}.</span>
                                    <span className="take-test__option-text">{opt}</span>
                                  </label>
                                );
                              })}
                            </fieldset>
                          )}

                          {q.type === 'short_answer' && (
                            <textarea
                              className="take-test__short-input"
                              rows={2}
                              value={answers[q.id] ?? ''}
                              onChange={e => setAnswer(q.id, e.target.value)}
                              placeholder="Напиши отговора си тук..."
                              required
                              disabled={submitting}
                            />
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </>
              )}

              {submitError && (
                <p className="take-test__inline-error" style={{ textAlign: 'center' }} role="alert">
                  {submitError}
                </p>
              )}

              <div className="take-test__footer">
                <p className="take-test__footer-hint">
                  Провери отговорите си преди да предадеш.
                </p>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="take-test__submit w-full sm:w-auto"
                >
                  {submitting ? 'Предаване...' : 'Предай теста'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
