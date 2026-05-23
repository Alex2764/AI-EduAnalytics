import React, { useState, useMemo } from 'react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Stepper } from '../common/Stepper';
import { useAppContext } from '../../context/AppContext';
import { getCurrentDate } from '../../utils/dateFormatter';
import {
  OPTION_LABELS,
  emptyQuestionOptions,
  validateQuestions,
} from '../../utils/validateQuestions';
import type { TestType, GradeScale, Question, QuestionType } from '../../types';
import './TestForm.css';

function CorrectAnswerPicker({
  selected,
  optionTexts,
  onSelect,
}: {
  selected: string;
  optionTexts?: string[];
  onSelect: (label: string) => void;
}) {
  return (
    <div className="test-form-answer-picker">
      {OPTION_LABELS.map((label, optIdx) => (
        <button
          type="button"
          key={label}
          className={`test-form-answer-btn ${selected === label ? 'is-selected' : ''}`}
          onClick={() => onSelect(label)}
          title={optionTexts?.[optIdx]?.trim() || undefined}
        >
          <span className="test-form-answer-letter">{label}</span>
          {optionTexts?.[optIdx]?.trim() ? (
            <span className="test-form-answer-preview">{optionTexts[optIdx]}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

const questionTypeOptions: { value: QuestionType; label: string }[] = [
  { value: 'short_answer', label: 'С кратък отговор' },
  { value: 'multiple_choice', label: 'С избираем отговор' },
];

const testTypeOptions: { value: TestType; label: string }[] = [
  { value: 'Нормален тест', label: 'Нормален тест' },
  { value: 'Класна работа', label: 'Класна работа' },
  { value: 'Входно ниво', label: 'Входно ниво' },
  { value: 'Изходно ниво', label: 'Изходно ниво' },
  { value: 'Междинно ниво', label: 'Междинно ниво' },
  { value: 'Текуща оценка', label: 'Текуща оценка' },
];

const STEPS = [
  { label: 'Основна информация' },
  { label: 'Скала за оценяване' },
  { label: 'Въпроси' },
  { label: 'Обобщение' },
];

interface TestFormProps {
  onSuccess?: () => void;
}

export const TestForm: React.FC<TestFormProps> = ({ onSuccess }) => {
  const { classes, addTest } = useAppContext();
  const [currentStep, setCurrentStep] = useState(1);
  const [testName, setTestName] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [testType, setTestType] = useState<TestType>('Нормален тест');
  const [testDate, setTestDate] = useState(getCurrentDate());
  const [maxPoints, setMaxPoints] = useState<string>('');
  const [error, setError] = useState('');
  const [gradeScale, setGradeScale] = useState<GradeScale>({
    grade2: '',
    grade3: '',
    grade4: '',
    grade5: '',
    grade6: '',
  });
  const [hasGroups, setHasGroups] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionCount, setQuestionCount] = useState<string>('');
  const [questionGroupTabs, setQuestionGroupTabs] = useState<Record<string, 'group1' | 'group2'>>({});
  const [loading, setLoading] = useState(false);

  const classOptions = useMemo(() => classes.map(cls => ({
    value: cls.name,
    label: cls.name,
  })), [classes]);

  const maxPointsNum = parseFloat(maxPoints) || 0;

  // Валидация на стъпки
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!testName || !selectedClass || !testDate || maxPoints === '' || isNaN(maxPointsNum) || maxPointsNum <= 0) {
          setError('Моля попълнете всички полета!');
          return false;
        }
        return true;
      case 2:
        const grade2Num = typeof gradeScale.grade2 === 'string' ? parseFloat(gradeScale.grade2) || 0 : gradeScale.grade2;
        const grade3Num = typeof gradeScale.grade3 === 'string' ? parseFloat(gradeScale.grade3) || 0 : gradeScale.grade3;
        const grade4Num = typeof gradeScale.grade4 === 'string' ? parseFloat(gradeScale.grade4) || 0 : gradeScale.grade4;
        const grade5Num = typeof gradeScale.grade5 === 'string' ? parseFloat(gradeScale.grade5) || 0 : gradeScale.grade5;
        const grade6Num = typeof gradeScale.grade6 === 'string' ? parseFloat(gradeScale.grade6) || 0 : gradeScale.grade6;
        
        if (grade2Num < 0 || grade3Num <= grade2Num || grade4Num <= grade3Num || grade5Num <= grade4Num || grade6Num <= grade5Num) {
          setError('Скалата трябва да е в нарастващ ред: 2 < 3 < 4 < 5 < 6');
          return false;
        }
        
        if (grade6Num > maxPointsNum) {
          setError('Точките за оценка 6 не могат да надвишават максималните точки!');
          return false;
        }
        return true;
      case 3: {
        const questionError = validateQuestions(questions, hasGroups);
        if (questionError) {
          setError(questionError);
          return false;
        }
        return true;
      }
      default:
        return true;
    }
  };

  const handleNext = () => {
    setError('');
    // Валидираме текущата стъпка преди да преминем напред
    if (validateStep(currentStep)) {
      if (currentStep < STEPS.length) {
        setCurrentStep(currentStep + 1);
        // Скролваме нагоре за да видим новата стъпка
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handlePrevious = () => {
    setError('');
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (step: number) => {
    setError('');
    // Позволяваме навигация до завършени стъпки, текущата, или стъпка 4 (обобщение) винаги
    if (step <= currentStep || step === 4) {
      setCurrentStep(step);
    }
  };

  // Функция за изчисляване на стандартна скала
  const calculateDefaultScale = () => {
    if (!isNaN(maxPointsNum) && maxPointsNum > 0) {
      setGradeScale({
        grade2: '0',
        grade3: Math.round(maxPointsNum * 0.40).toString(),
        grade4: Math.round(maxPointsNum * 0.60).toString(),
        grade5: Math.round(maxPointsNum * 0.76).toString(),
        grade6: Math.round(maxPointsNum * 0.92).toString(),
      });
    }
  };

  const emptyQuestionGroup = () => ({ text: '', correctAnswer: '' });

  const createEmptyQuestion = (id: string): Question => ({
    id,
    text: '',
    points: 0,
    type: 'short_answer',
    ...(hasGroups
      ? { group1: emptyQuestionGroup(), group2: emptyQuestionGroup() }
      : {}),
  });

  const normalizeGroupForType = (
    group: Question['group1'],
    newType: QuestionType,
    prevType: QuestionType
  ): NonNullable<Question['group1']> => {
    const base = group ?? emptyQuestionGroup();
    if (newType === 'multiple_choice') {
      return {
        ...base,
        options: base.options?.length === 4 ? base.options : emptyQuestionOptions(),
        correctAnswer: prevType === 'multiple_choice' ? base.correctAnswer : '',
      };
    }
    return {
      ...base,
      options: undefined,
      correctAnswer: prevType === 'short_answer' ? base.correctAnswer : '',
    };
  };

  const handleHasGroupsChange = (twoGroups: boolean) => {
    setHasGroups(twoGroups);
    if (twoGroups) {
      setQuestions(prev =>
        prev.map(q => ({
          ...q,
          group1: normalizeGroupForType(
            {
              text: q.group1?.text ?? q.text ?? '',
              correctAnswer: q.group1?.correctAnswer ?? q.correctAnswer ?? '',
              options: q.group1?.options ?? q.options,
            },
            q.type,
            q.type
          ),
          group2: normalizeGroupForType(q.group2 ?? emptyQuestionGroup(), q.type, q.type),
        }))
      );
    } else {
      setQuestions(prev =>
        prev.map(q => ({
          ...q,
          text: q.group1?.text ?? q.text ?? '',
          correctAnswer: q.group1?.correctAnswer ?? q.correctAnswer ?? '',
          options: q.group1?.options ?? q.options,
          group1: undefined,
          group2: undefined,
        }))
      );
      setQuestionGroupTabs({});
    }
  };

  const getQuestionGroupTab = (questionId: string): 'group1' | 'group2' =>
    questionGroupTabs[questionId] ?? 'group1';

  const setQuestionGroupTab = (questionId: string, tab: 'group1' | 'group2') => {
    setQuestionGroupTabs(prev => ({ ...prev, [questionId]: tab }));
  };

  const updateQuestionGroup = (
    index: number,
    group: 'group1' | 'group2',
    field: 'text' | 'correctAnswer',
    value: string
  ) => {
    const q = questions[index];
    const current = q[group] ?? emptyQuestionGroup();
    updateQuestion(index, { [group]: { ...current, [field]: value } });
  };

  // Функции за управление на въпросите
  const addQuestion = () => {
    const count = parseInt(questionCount);
    if (!isNaN(count) && count > 0) {
      const newQuestions: Question[] = [];
      
      for (let i = 0; i < count; i++) {
        newQuestions.push(createEmptyQuestion(`q${questions.length + i + 1}`));
      }
      
      setQuestions([...questions, ...newQuestions]);
      setQuestionCount('');
    }
  };

  const addSingleQuestion = () => {
    setQuestions([...questions, createEmptyQuestion(`q${questions.length + 1}`)]);
  };

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], ...updates };
    setQuestions(newQuestions);
  };

  const updateQuestionType = (index: number, type: QuestionType) => {
    const q = questions[index];
    if (hasGroups) {
      updateQuestion(index, {
        type,
        group1: normalizeGroupForType(q.group1, type, q.type),
        group2: normalizeGroupForType(q.group2, type, q.type),
      });
      return;
    }
    if (type === 'multiple_choice') {
      updateQuestion(index, {
        type,
        options: q.options?.length === 4 ? q.options : emptyQuestionOptions(),
        correctAnswer: q.type === 'multiple_choice' ? q.correctAnswer : '',
      });
    } else {
      updateQuestion(index, {
        type,
        options: undefined,
        correctAnswer: q.type === 'short_answer' ? q.correctAnswer : '',
      });
    }
  };

  const updateQuestionGroupOption = (
    index: number,
    group: 'group1' | 'group2',
    optionIndex: number,
    value: string
  ) => {
    const q = questions[index];
    const current = q[group] ?? emptyQuestionGroup();
    const opts = [...(current.options ?? emptyQuestionOptions())];
    opts[optionIndex] = value;
    updateQuestion(index, { [group]: { ...current, options: opts } });
  };

  const updateQuestionOption = (index: number, optionIndex: number, value: string) => {
    const opts = [...(questions[index].options ?? emptyQuestionOptions())];
    opts[optionIndex] = value;
    updateQuestion(index, { options: opts });
  };

  const removeQuestion = (index: number) => {
    const newQuestions = questions.filter((_, i) => i !== index);
    setQuestions(newQuestions);
  };

  const distributePointsEvenly = () => {
    if (questions.length > 0 && maxPointsNum > 0) {
      const pointsPerQuestion = Math.round((maxPointsNum / questions.length) * 100) / 100;
      const newQuestions = questions.map(q => ({ ...q, points: pointsPerQuestion }));
      setQuestions(newQuestions);
    }
  };

  const handleSubmit = async () => {
    // Защита: само ако сме на последната стъпка и е натиснат бутонът
    if (currentStep !== STEPS.length) {
      return;
    }
    
    setError('');

    if (!validateStep(1) || !validateStep(2)) {
      setCurrentStep(1);
      return;
    }
    if (!validateStep(3)) {
      setCurrentStep(3);
      return;
    }

    // Валидация на скалата и преобразуване към number
    const grade2Num = typeof gradeScale.grade2 === 'string' ? parseFloat(gradeScale.grade2) || 0 : gradeScale.grade2;
    const grade3Num = typeof gradeScale.grade3 === 'string' ? parseFloat(gradeScale.grade3) || 0 : gradeScale.grade3;
    const grade4Num = typeof gradeScale.grade4 === 'string' ? parseFloat(gradeScale.grade4) || 0 : gradeScale.grade4;
    const grade5Num = typeof gradeScale.grade5 === 'string' ? parseFloat(gradeScale.grade5) || 0 : gradeScale.grade5;
    const grade6Num = typeof gradeScale.grade6 === 'string' ? parseFloat(gradeScale.grade6) || 0 : gradeScale.grade6;

    try {
      setLoading(true);
      await addTest({
        name: testName,
        class: selectedClass,
        type: testType,
        date: testDate,
        maxPoints: maxPointsNum,
        gradeScale: {
          grade2: grade2Num,
          grade3: grade3Num,
          grade4: grade4Num,
          grade5: grade5Num,
          grade6: grade6Num,
        },
        hasGroups,
        mode: 'online',
        questions: questions,
      });

      // Reset form
      setTestName('');
      setSelectedClass('');
      setTestType('Нормален тест');
      setTestDate(getCurrentDate());
      setMaxPoints('');
      setHasGroups(false);
      setGradeScale({
        grade2: '',
        grade3: '',
        grade4: '',
        grade5: '',
        grade6: '',
      });
      setQuestions([]);
      setQuestionCount('');
      setQuestionGroupTabs({});
      setCurrentStep(1);
      
      // Call onSuccess callback if provided - САМО след успешно създаване
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Грешка при създаване на тест!');
    } finally {
      setLoading(false);
    }
  };

  // Изчисляване на стойности за визуализация
  const grade2Num = typeof gradeScale.grade2 === 'string' ? parseFloat(gradeScale.grade2) || 0 : gradeScale.grade2;
  const grade3Num = typeof gradeScale.grade3 === 'string' ? parseFloat(gradeScale.grade3) || 0 : gradeScale.grade3;
  const grade4Num = typeof gradeScale.grade4 === 'string' ? parseFloat(gradeScale.grade4) || 0 : gradeScale.grade4;
  const grade5Num = typeof gradeScale.grade5 === 'string' ? parseFloat(gradeScale.grade5) || 0 : gradeScale.grade5;
  const grade6Num = typeof gradeScale.grade6 === 'string' ? parseFloat(gradeScale.grade6) || 0 : gradeScale.grade6;

  const totalQuestionPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);

  // Процентни стойности за визуализация на скалата
  const getGradePercentage = (grade: number) => {
    return maxPointsNum > 0 ? (grade / maxPointsNum) * 100 : 0;
  };

  const pointsProgress =
    maxPointsNum > 0 ? Math.min(100, (totalQuestionPoints / maxPointsNum) * 100) : 0;
  const pointsMatch = questions.length > 0 && totalQuestionPoints === maxPointsNum;

  return (
    <div className="test-form">
      <form
        className="test-form-inner"
        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        onSubmit={(e) => {
          e.preventDefault();
          return false;
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (currentStep < STEPS.length) {
              handleNext();
            }
          }
        }}
      >
      <Stepper
        steps={STEPS}
        currentStep={currentStep}
        onStepClick={handleStepClick}
      />

      {error && (
        <div className="alert alert-error mb-4">
          {error}
        </div>
      )}

      <div className="test-form-body">

      {currentStep === 1 && (
        <div className="step-content">
          <div className="step-header">
            <h3>Основна информация</h3>
            <p>Име, клас и тип — отляво; дата, точки и групи — отдясно.</p>
          </div>

          <div className="test-form-panels">
            <section className="test-form-panel">
              <h4 className="test-form-panel-title">Данни за теста</h4>
              <Input
                label="Име на тест"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="Напр. Входно ниво — Информатика"
                required
              />
              <Select
                label="Клас"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                options={classOptions}
                placeholder="Изберете клас"
                required
              />
              <Select
                label="Тип тест"
                value={testType}
                onChange={(e) => setTestType(e.target.value as TestType)}
                options={testTypeOptions}
                required
              />
            </section>

            <section className="test-form-panel">
              <h4 className="test-form-panel-title">Параметри</h4>
              <Input
                label="Дата"
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                required
              />
              <Input
                label="Максимални точки"
                type="text"
                value={maxPoints}
                onChange={(e) => setMaxPoints(e.target.value)}
                required
                placeholder="Напр. 100"
              />
              <div>
                <span className="test-form-field-label">Групи в теста</span>
                <div className="test-form-groups">
                  <label className="test-form-group-chip">
                    <input
                      type="radio"
                      name="test-groups"
                      checked={!hasGroups}
                      onChange={() => handleHasGroupsChange(false)}
                    />
                    Една група
                  </label>
                  <label className="test-form-group-chip">
                    <input
                      type="radio"
                      name="test-groups"
                      checked={hasGroups}
                      onChange={() => handleHasGroupsChange(true)}
                    />
                    Две групи
                  </label>
                </div>
                <p className="test-form-hint">
                  При две групи — отделен текст и отговори за I и II група на всеки въпрос.
                </p>
              </div>
            </section>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="step-content">
          <div className="step-header">
            <h3>Скала за оценяване</h3>
            <p>Минимални точки за всяка оценка — използвайте бутона за автоматично попълване.</p>
          </div>

          {maxPointsNum > 0 ? (
            <>
              <div className="test-form-scale-toolbar">
                <span className="text-sm text-gray-600">
                  Максимум: <strong>{maxPointsNum}</strong> т.
                </span>
                <Button
                  type="button"
                  onClick={calculateDefaultScale}
                  className="bg-blue-600 hover:bg-blue-700 text-white btn-primary-scale"
                >
                  Изчисли стандартна скала
                </Button>
              </div>

              {/* Визуална лента на скалата */}
              <div className="mb-6">
                <div className="grade-scale-visualizer">
                  <div className="grade-scale-bar">
                    <div 
                      className="grade-segment grade-2" 
                      style={{ width: `${getGradePercentage(grade3Num)}%` }}
                      title={`Оценка 2: 0-${grade3Num - 0.5}т`}
                    />
                    <div 
                      className="grade-segment grade-3" 
                      style={{ width: `${getGradePercentage(grade4Num - grade3Num)}%` }}
                      title={`Оценка 3: ${grade3Num}-${grade4Num - 0.5}т`}
                    />
                    <div 
                      className="grade-segment grade-4" 
                      style={{ width: `${getGradePercentage(grade5Num - grade4Num)}%` }}
                      title={`Оценка 4: ${grade4Num}-${grade5Num - 0.5}т`}
                    />
                    <div 
                      className="grade-segment grade-5" 
                      style={{ width: `${getGradePercentage(grade6Num - grade5Num)}%` }}
                      title={`Оценка 5: ${grade5Num}-${grade6Num - 0.5}т`}
                    />
                    <div 
                      className="grade-segment grade-6" 
                      style={{ width: `${getGradePercentage(maxPointsNum - grade6Num)}%` }}
                      title={`Оценка 6: ${grade6Num}+т`}
                    />
                  </div>
                  <div className="grade-scale-labels">
                    <span className="grade-label">2</span>
                    <span className="grade-label">3</span>
                    <span className="grade-label">4</span>
                    <span className="grade-label">5</span>
                    <span className="grade-label">6</span>
                  </div>
                </div>
              </div>

              <div className="test-form-grade-row">
                {([
                  { key: 'grade2' as const, num: 2, className: 'test-form-grade-cell--2' },
                  { key: 'grade3' as const, num: 3, className: 'test-form-grade-cell--3' },
                  { key: 'grade4' as const, num: 4, className: 'test-form-grade-cell--4' },
                  { key: 'grade5' as const, num: 5, className: 'test-form-grade-cell--5' },
                  { key: 'grade6' as const, num: 6, className: 'test-form-grade-cell--6' },
                ]).map(({ key, num, className }) => (
                  <div key={key} className={`test-form-grade-cell ${className}`}>
                    <label htmlFor={`grade-${num}`}>Оценка {num}</label>
                    <Input
                      id={`grade-${num}`}
                      type="text"
                      value={String(gradeScale[key] || '')}
                      onChange={(e) => {
                        const value = e.target.value;
                        setGradeScale(prev => ({ ...prev, [key]: value }));
                      }}
                      onFocus={(e) => e.target.select()}
                      placeholder="от т."
                      required
                      className="mb-0"
                    />
                  </div>
                ))}
              </div>

              <div className="test-form-scale-summary">
                <strong>Обобщение:</strong>{' '}
                2 → {grade2Num}–{grade3Num > 0 ? (grade3Num - 0.5).toFixed(1) : 0} т. ·{' '}
                3 → {grade3Num}–{grade4Num > 0 ? (grade4Num - 0.5).toFixed(1) : 0} т. ·{' '}
                4 → {grade4Num}–{grade5Num > 0 ? (grade5Num - 0.5).toFixed(1) : 0} т. ·{' '}
                5 → {grade5Num}–{grade6Num > 0 ? (grade6Num - 0.5).toFixed(1) : 0} т. ·{' '}
                6 → {grade6Num}+ т.
              </div>
            </>
          ) : (
            <div className="mt-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <p className="text-yellow-800">
                Моля, първо въведете максимални точки в стъпка 1.
              </p>
            </div>
          )}
        </div>
      )}

      {currentStep === 3 && (
        <div className="step-content">
          <div className="step-header">
            <h3>Въпроси в теста</h3>
            <p>Един ред = един въпрос. Варианти A–D на един ред; верен отговор с един клик.</p>
          </div>

          {maxPointsNum > 0 ? (
            <>
              <div className="test-form-questions-toolbar">
                {questions.length > 0 && (
                  <div
                    className={`test-form-points-bar ${pointsMatch ? 'is-ok' : 'is-warn'}`}
                  >
                    <span>
                      <strong>{totalQuestionPoints.toFixed(1)}</strong> / {maxPointsNum} т.
                      {pointsMatch ? ' · OK' : totalQuestionPoints < maxPointsNum
                        ? ` · остават ${(maxPointsNum - totalQuestionPoints).toFixed(1)}`
                        : ` · с ${(totalQuestionPoints - maxPointsNum).toFixed(1)} над`}
                    </span>
                    <div className="test-form-points-progress">
                      <div
                        className="test-form-points-progress-fill"
                        style={{ width: `${pointsProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="test-form-add-row">
                  <Input
                    label="Брой"
                    type="text"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(e.target.value)}
                    placeholder="5"
                    className="mb-0"
                  />
                  <div className="test-form-add-actions">
                    <Button
                      type="button"
                      onClick={addQuestion}
                      disabled={!questionCount || parseInt(questionCount) <= 0}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      + {questionCount || '…'} въпроса
                    </Button>
                    <Button
                      type="button"
                      onClick={addSingleQuestion}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      + 1 въпрос
                    </Button>
                    {questions.length > 0 && (
                      <Button
                        type="button"
                        onClick={distributePointsEvenly}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        Разпредели точките
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {questions.length > 0 ? (
                <div className="test-form-questions-list">
                  {questions.map((question, index) => {
                    const opts = question.options ?? emptyQuestionOptions();
                    const isMultipleChoice = question.type === 'multiple_choice';
                    const activeGroup = getQuestionGroupTab(question.id);
                    const activeGroupData = question[activeGroup] ?? emptyQuestionGroup();
                    const activeGroupOpts = activeGroupData.options ?? emptyQuestionOptions();

                    return (
                      <article key={question.id} className="test-form-question-card">
                        <div className="test-form-question-head">
                          <span className="test-form-question-num">{index + 1}</span>
                          <Select
                            label="Тип"
                            value={question.type}
                            onChange={(e) =>
                              updateQuestionType(index, e.target.value as QuestionType)
                            }
                            options={questionTypeOptions}
                            required
                            className="test-form-question-type mb-0"
                          />
                          <Input
                            label="Точки"
                            type="text"
                            value={String(question.points || '')}
                            onChange={(e) => {
                              const value = e.target.value;
                              const points = value === '' ? 0 : parseFloat(value) || 0;
                              updateQuestion(index, { points });
                            }}
                            onFocus={(e) => e.target.select()}
                            placeholder="0"
                            className="test-form-question-points mb-0"
                          />
                          <Button
                            type="button"
                            onClick={() => removeQuestion(index)}
                            className="test-form-question-remove bg-red-500 hover:bg-red-600 text-white"
                          >
                            Изтрий
                          </Button>
                        </div>

                        {hasGroups && (
                          <div className="test-form-group-tabs">
                            <button
                              type="button"
                              className={`test-form-group-tab ${activeGroup === 'group1' ? 'active' : ''}`}
                              onClick={() => setQuestionGroupTab(question.id, 'group1')}
                            >
                              I група
                            </button>
                            <button
                              type="button"
                              className={`test-form-group-tab ${activeGroup === 'group2' ? 'active' : ''}`}
                              onClick={() => setQuestionGroupTab(question.id, 'group2')}
                            >
                              II група
                            </button>
                          </div>
                        )}

                        <div className="test-form-question-body">
                          {hasGroups ? (
                            <>
                              <Input
                                label="Текст на въпроса"
                                type="text"
                                value={activeGroupData.text}
                                onChange={(e) =>
                                  updateQuestionGroup(index, activeGroup, 'text', e.target.value)
                                }
                                placeholder={`Въпрос ${index + 1} — ${activeGroup === 'group1' ? 'I' : 'II'} група`}
                                required
                                className="mb-0"
                              />
                              {isMultipleChoice && (
                                <div>
                                  <span className="test-form-field-label">Варианти</span>
                                  <div className="test-form-options-grid">
                                    {OPTION_LABELS.map((label, optIdx) => (
                                      <Input
                                        key={`${activeGroup}-${label}`}
                                        label={label}
                                        type="text"
                                        value={activeGroupOpts[optIdx] ?? ''}
                                        onChange={(e) =>
                                          updateQuestionGroupOption(
                                            index,
                                            activeGroup,
                                            optIdx,
                                            e.target.value
                                          )
                                        }
                                        placeholder={`Отговор ${label}`}
                                        required
                                        className="mb-0"
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div>
                                <span className="test-form-field-label">
                                  Верен отговор <span className="text-red-600">*</span>
                                </span>
                                {isMultipleChoice ? (
                                  <CorrectAnswerPicker
                                    selected={activeGroupData.correctAnswer}
                                    optionTexts={activeGroupOpts}
                                    onSelect={(label) =>
                                      updateQuestionGroup(index, activeGroup, 'correctAnswer', label)
                                    }
                                  />
                                ) : (
                                  <Input
                                    type="text"
                                    value={activeGroupData.correctAnswer}
                                    onChange={(e) =>
                                      updateQuestionGroup(
                                        index,
                                        activeGroup,
                                        'correctAnswer',
                                        e.target.value
                                      )
                                    }
                                    placeholder="Очакван верен отговор"
                                    required
                                    className="mb-0"
                                  />
                                )}
                              </div>
                            </>
                          ) : (
                            <>
                              <Input
                                label="Текст на въпроса"
                                type="text"
                                value={question.text}
                                onChange={(e) => updateQuestion(index, { text: e.target.value })}
                                placeholder={`Въпрос ${index + 1}`}
                                required
                                className="mb-0"
                              />
                              {isMultipleChoice && (
                                <div>
                                  <span className="test-form-field-label">Варианти</span>
                                  <div className="test-form-options-grid">
                                    {OPTION_LABELS.map((label, optIdx) => (
                                      <Input
                                        key={label}
                                        label={label}
                                        type="text"
                                        value={opts[optIdx] ?? ''}
                                        onChange={(e) =>
                                          updateQuestionOption(index, optIdx, e.target.value)
                                        }
                                        placeholder={`Отговор ${label}`}
                                        required
                                        className="mb-0"
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div>
                                <span className="test-form-field-label">
                                  Верен отговор <span className="text-red-600">*</span>
                                </span>
                                {isMultipleChoice ? (
                                  <CorrectAnswerPicker
                                    selected={question.correctAnswer ?? ''}
                                    optionTexts={opts}
                                    onSelect={(label) =>
                                      updateQuestion(index, { correctAnswer: label })
                                    }
                                  />
                                ) : (
                                  <Input
                                    type="text"
                                    value={question.correctAnswer ?? ''}
                                    onChange={(e) =>
                                      updateQuestion(index, { correctAnswer: e.target.value })
                                    }
                                    placeholder="Очакван верен отговор"
                                    required
                                    className="mb-0"
                                  />
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="test-form-empty-hint">
                  Няма въпроси — въведете брой и натиснете „+ N въпроса“, или „+ 1 въпрос“.
                  Можете и да преминете напред без въпроси.
                </p>
              )}
            </>
          ) : (
            <div className="mt-2 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <p className="text-yellow-800 m-0">
                Първо въведете максимални точки в стъпка 1.
              </p>
            </div>
          )}
        </div>
      )}

      {currentStep === 4 && (
        <div className="step-content">
          <div className="step-header">
            <h3>Обобщение на теста</h3>
            <p>Прегледайте данните преди запис.</p>
          </div>

          <div className="mt-6 space-y-6">
            {/* Header with Test Info */}
            <div className="analytics-header bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-lg">
              <div className="test-title">
                <h2 className="test-name text-white">{testName || 'Име на тест'}</h2>
                <div className="test-badge bg-white/20">{selectedClass || 'Клас'}</div>
              </div>
              <div className="test-meta mt-4">
                <div className="meta-item">
                  <span className="meta-label text-white/80">Тип</span>
                  <span className="meta-value text-white">{testType}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label text-white/80">Дата</span>
                  <span className="meta-value text-white">{testDate || '-'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label text-white/80">Макс. точки</span>
                  <span className="meta-value text-white">{maxPointsNum || '-'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label text-white/80">Въпроси</span>
                  <span className="meta-value text-white">{questions.length}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label text-white/80">Групи</span>
                  <span className="meta-value text-white">{hasGroups ? 'Две групи' : 'Една група'}</span>
                </div>
              </div>
            </div>

            {/* Key Metrics Dashboard */}
            <div className="metrics-dashboard">
              <div className="metric-card primary">
                <div className="metric-icon"></div>
                <div className="metric-content">
                  <div className="metric-value">{maxPointsNum || 0}</div>
                  <div className="metric-label">Максимални точки</div>
                </div>
              </div>
              
              <div className="metric-card secondary">
                <div className="metric-icon"></div>
                <div className="metric-content">
                  <div className="metric-value">{questions.length}</div>
                  <div className="metric-label">Брой въпроси</div>
                </div>
              </div>
              
              <div className="metric-card success">
                <div className="metric-icon"></div>
                <div className="metric-content">
                  <div className="metric-value">{totalQuestionPoints.toFixed(1)}</div>
                  <div className="metric-label">Общо точки (въпроси)</div>
                </div>
              </div>
              
              <div className={`metric-card ${totalQuestionPoints === maxPointsNum ? 'success' : 'warning'}`}>
                <div className="metric-icon"></div>
                <div className="metric-content">
                  <div className="metric-value">
                    {totalQuestionPoints === maxPointsNum ? '✓' : '!'}
                  </div>
                  <div className="metric-label">
                    {totalQuestionPoints === maxPointsNum ? 'Точките съвпадат' : 'Точките не съвпадат'}
                  </div>
                </div>
              </div>
            </div>

            {/* Скала за оценяване */}
            <div className="grade-distribution">
              <h3 className="section-title">Скала за оценяване</h3>
              <div className="grade-grid">
                <div className="grade-card poor">
                  <div className="grade-number">2</div>
                  <div className="grade-label">Слаб</div>
                  <div className="grade-stats">
                    <div className="grade-count">{grade2Num}-{grade3Num > 0 ? (grade3Num - 0.5).toFixed(1) : 0}т</div>
                  </div>
                </div>
                
                <div className="grade-card satisfactory">
                  <div className="grade-number">3</div>
                  <div className="grade-label">Среден</div>
                  <div className="grade-stats">
                    <div className="grade-count">{grade3Num}-{grade4Num > 0 ? (grade4Num - 0.5).toFixed(1) : 0}т</div>
                  </div>
                </div>
                
                <div className="grade-card good">
                  <div className="grade-number">4</div>
                  <div className="grade-label">Добър</div>
                  <div className="grade-stats">
                    <div className="grade-count">{grade4Num}-{grade5Num > 0 ? (grade5Num - 0.5).toFixed(1) : 0}т</div>
                  </div>
                </div>
                
                <div className="grade-card very-good">
                  <div className="grade-number">5</div>
                  <div className="grade-label">Много добър</div>
                  <div className="grade-stats">
                    <div className="grade-count">{grade5Num}-{grade6Num > 0 ? (grade6Num - 0.5).toFixed(1) : 0}т</div>
                  </div>
                </div>
                
                <div className="grade-card excellent">
                  <div className="grade-number">6</div>
                  <div className="grade-label">Отличен</div>
                  <div className="grade-stats">
                    <div className="grade-count">{grade6Num}+т</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Въпроси */}
            {questions.length > 0 && (
              <div className="question-stats-section">
                <h3 className="section-title">Въпроси в теста</h3>
                <p className="section-subtitle">Преглед на всички въпроси и техните точки</p>
                
                <div className="stats-grid-container">
                  <div className="stats-grid">
                    {questions.map((question, index) => {
                      const percentage = maxPointsNum > 0 ? ((question.points || 0) / maxPointsNum) * 100 : 0;
                      const getCardClass = (percentage: number) => {
                        if (percentage >= 20) return 'stats-card excellent';
                        if (percentage >= 10) return 'stats-card good';
                        if (percentage >= 5) return 'stats-card average';
                        return 'stats-card poor';
                      };

                      return (
                        <div key={question.id} className={getCardClass(percentage)}>
                          <div className="question-info">
                            <span className="question-text">Въпрос {index + 1}</span>
                          </div>
                          <div className="percentage-display">
                            <span className="percentage-value">{question.points || 0}т</span>
                            <span className="percentage-label">{percentage.toFixed(1)}%</span>
                          </div>
                          {hasGroups ? (
                            <>
                              {question.group1?.text && (
                                <div className="mt-2 text-xs text-gray-600 truncate" title={question.group1.text}>
                                  I: {question.group1.text}
                                </div>
                              )}
                              {question.group2?.text && (
                                <div className="mt-1 text-xs text-gray-600 truncate" title={question.group2.text}>
                                  II: {question.group2.text}
                                </div>
                              )}
                              <div className="mt-1 text-xs text-gray-500">
                                {question.type === 'multiple_choice' ? 'Избираем отговор' : 'Кратък отговор'}
                                {question.group1?.correctAnswer && (
                                  <span> · I: {question.group1.correctAnswer}</span>
                                )}
                                {question.group2?.correctAnswer && (
                                  <span> · II: {question.group2.correctAnswer}</span>
                                )}
                              </div>
                            </>
                          ) : (
                            <>
                              {question.text && (
                                <div className="mt-2 text-xs text-gray-600 truncate" title={question.text}>
                                  {question.text}
                                </div>
                              )}
                              <div className="mt-1 text-xs text-gray-500">
                                {question.type === 'multiple_choice' ? 'Избираем отговор' : 'Кратък отговор'}
                                {question.correctAnswer && (
                                  <span> · Верен: {question.correctAnswer}</span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {questions.length === 0 && (
              <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200 text-center">
                <p className="text-blue-800 font-medium">Няма добавени въпроси</p>
                <p className="text-blue-600 text-sm mt-2">Въпросите са опционални и могат да бъдат добавени по-късно</p>
              </div>
            )}
          </div>
        </div>
      )}

      </div>

      <div className="test-form-nav">
        <div className="test-form-nav-actions">
          {currentStep > 1 && (
            <Button
              type="button"
              onClick={handlePrevious}
              className="bg-gray-500 hover:bg-gray-600 text-white"
            >
              ← Назад
            </Button>
          )}
        </div>
        <span className="test-form-step-indicator">
          Стъпка {currentStep} от {STEPS.length}
        </span>
        <div className="test-form-nav-actions">
          {currentStep < STEPS.length ? (
            <Button
              type="button"
              onClick={handleNext}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Напред →
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? 'Запазване...' : 'Създай тест'}
            </Button>
          )}
        </div>
      </div>
      </form>
    </div>
  );
};
