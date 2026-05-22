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
        mode: 'offline',
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

  return (
    <div>
      {/* Използваме div вместо form, за да предотвратим автоматично submit */}
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          return false;
        }}
        onKeyDown={(e) => {
          // Предотвратяваме Enter да submit-ва формата автоматично
          if (e.key === 'Enter') {
            e.preventDefault();
            // Ако сме на последната стъпка, не правим нищо (трябва да се натисне бутонът)
            // Ако сме на друга стъпка, преминаваме напред
            if (currentStep < STEPS.length) {
              handleNext();
            }
          }
        }}
      >
      {/* Stepper */}
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

      {/* Step 1: Основна информация */}
      {currentStep === 1 && (
        <div className="step-content">
          <div className="step-header">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Основна информация</h3>
            <p className="text-sm text-gray-600">Попълнете основната информация за теста</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            <Input
              label="Име на тест"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="Въведете име на теста"
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
              placeholder="Въведете точки"
            />
          </div>

          <div className="mt-6">
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-3">
                Групи в теста
              </legend>
              <div className="flex flex-wrap gap-6">
                <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="radio"
                    name="test-groups"
                    checked={!hasGroups}
                    onChange={() => handleHasGroupsChange(false)}
                    className="text-blue-600"
                  />
                  <span className="font-medium">Една група</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="radio"
                    name="test-groups"
                    checked={hasGroups}
                    onChange={() => handleHasGroupsChange(true)}
                    className="text-blue-600"
                  />
                  <span className="font-medium">Две групи</span>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                При „Две групи" всеки въпрос в стъпка 3 има отделни полета за I и II група.
              </p>
            </fieldset>
          </div>
        </div>
      )}

      {/* Step 2: Скала за оценяване */}
      {currentStep === 2 && (
        <div className="step-content">
          <div className="step-header">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Скала за оценяване</h3>
            <p className="text-sm text-gray-600">Задайте минимални точки за всяка оценка</p>
          </div>

          {maxPointsNum > 0 ? (
            <>
              <div className="mt-6 flex justify-end mb-4">
                <Button
                  type="button"
                  onClick={calculateDefaultScale}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  ✨ Изчисли стандартна скала (40%, 60%, 76%, 92%)
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

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-300">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Оценка 2 (от точки)
                  </label>
                  <Input
                    type="text"
                    value={String(gradeScale.grade2 || '')}
                    onChange={(e) => {
                      const value = e.target.value;
                      setGradeScale(prev => ({ ...prev, grade2: value }));
                    }}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    required
                    className="mb-0"
                  />
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-300">
                  <label className="block text-sm font-medium text-orange-800 mb-2">
                    Оценка 3 (от точки)
                  </label>
                  <Input
                    type="text"
                    value={String(gradeScale.grade3 || '')}
                    onChange={(e) => {
                      const value = e.target.value;
                      setGradeScale(prev => ({ ...prev, grade3: value }));
                    }}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    required
                    className="mb-0"
                  />
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-300">
                  <label className="block text-sm font-medium text-yellow-800 mb-2">
                    Оценка 4 (от точки)
                  </label>
                  <Input
                    type="text"
                    value={String(gradeScale.grade4 || '')}
                    onChange={(e) => {
                      const value = e.target.value;
                      setGradeScale(prev => ({ ...prev, grade4: value }));
                    }}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    required
                    className="mb-0"
                  />
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-300">
                  <label className="block text-sm font-medium text-blue-800 mb-2">
                    Оценка 5 (от точки)
                  </label>
                  <Input
                    type="text"
                    value={String(gradeScale.grade5 || '')}
                    onChange={(e) => {
                      const value = e.target.value;
                      setGradeScale(prev => ({ ...prev, grade5: value }));
                    }}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    required
                    className="mb-0"
                  />
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg border-2 border-green-300">
                  <label className="block text-sm font-medium text-green-800 mb-2">
                    Оценка 6 (от точки)
                  </label>
                  <Input
                    type="text"
                    value={String(gradeScale.grade6 || '')}
                    onChange={(e) => {
                      const value = e.target.value;
                      setGradeScale(prev => ({ ...prev, grade6: value }));
                    }}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    required
                    className="mb-0"
                  />
                </div>
              </div>

              <div className="mt-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Текуща скала:</strong> 2 = {grade2Num}-{grade3Num > 0 ? (grade3Num - 0.5).toFixed(1) : 0}т, 
                  3 = {grade3Num}-{grade4Num > 0 ? (grade4Num - 0.5).toFixed(1) : 0}т, 
                  4 = {grade4Num}-{grade5Num > 0 ? (grade5Num - 0.5).toFixed(1) : 0}т, 
                  5 = {grade5Num}-{grade6Num > 0 ? (grade6Num - 0.5).toFixed(1) : 0}т, 
                  6 = {grade6Num}+т
                </p>
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

      {/* Step 3: Въпроси */}
      {currentStep === 3 && (
        <div className="step-content">
          <div className="step-header">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Въпроси в теста</h3>
            <p className="text-sm text-gray-600">Задайте въпросите, типа, вариантите и верния отговор</p>
          </div>

          {maxPointsNum > 0 ? (
            <>
              <div className="mt-6 space-y-4">
                {/* Бързо добавяне */}
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Брой въпроси за добавяне
                      </label>
                      <Input
                        type="text"
                        value={questionCount}
                        onChange={(e) => setQuestionCount(e.target.value)}
                        placeholder="Въведете брой"
                        className="mb-0"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button
                        type="button"
                        onClick={addQuestion}
                        disabled={!questionCount || parseInt(questionCount) <= 0}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Добави {questionCount || ''} въпроса
                      </Button>
                      <Button
                        type="button"
                        onClick={addSingleQuestion}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        + Добави един
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Автоматично разпределение */}
                {questions.length > 0 && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={distributePointsEvenly}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-sm"
                    >
                      ⚡ Равномерно разпредели точките
                    </Button>
                  </div>
                )}

                {/* Grid с въпроси */}
                {questions.length > 0 && (
                  <div className="questions-grid-container">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {questions.map((question, index) => {
                        const opts = question.options ?? emptyQuestionOptions();
                        const isMultipleChoice = question.type === 'multiple_choice';
                        const activeGroup = getQuestionGroupTab(question.id);
                        const activeGroupData = question[activeGroup] ?? emptyQuestionGroup();
                        const activeGroupOpts = activeGroupData.options ?? emptyQuestionOptions();

                        return (
                        <div key={question.id} className="question-card bg-white p-4 rounded-lg border-2 border-gray-200 hover:border-blue-300 transition-all">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                              Въпрос {index + 1}
                            </span>
                            <Button
                              type="button"
                              onClick={() => removeQuestion(index)}
                              className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 text-xs"
                            >
                              ✕
                            </Button>
                          </div>

                          <div className="space-y-3">
                            <Select
                              label="Тип въпрос"
                              value={question.type}
                              onChange={(e) => updateQuestionType(index, e.target.value as QuestionType)}
                              options={questionTypeOptions}
                              required
                              className="mb-0"
                            />

                            {hasGroups ? (
                              <>
                                <div className="flex justify-end">
                                  <div className="w-24">
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
                                      className="mb-0 text-sm"
                                    />
                                  </div>
                                </div>

                                <div className="nav-tabs w-full">
                                  <button
                                    type="button"
                                    className={`nav-tab flex-1 ${activeGroup === 'group1' ? 'active' : ''}`}
                                    onClick={() => setQuestionGroupTab(question.id, 'group1')}
                                  >
                                    I група
                                  </button>
                                  <button
                                    type="button"
                                    className={`nav-tab flex-1 ${activeGroup === 'group2' ? 'active' : ''}`}
                                    onClick={() => setQuestionGroupTab(question.id, 'group2')}
                                  >
                                    II група
                                  </button>
                                </div>

                                <Input
                                  label="Текст на въпроса"
                                  type="text"
                                  value={activeGroupData.text}
                                  onChange={(e) =>
                                    updateQuestionGroup(index, activeGroup, 'text', e.target.value)
                                  }
                                  placeholder={`Въпрос ${index + 1} — ${activeGroup === 'group1' ? 'I' : 'II'} група`}
                                  required
                                  className="mb-0 text-sm"
                                />

                                {isMultipleChoice && (
                                  <div className="grid grid-cols-2 gap-2">
                                    {OPTION_LABELS.map((label, optIdx) => (
                                      <Input
                                        key={`${activeGroup}-${label}`}
                                        label={`Вариант ${label}`}
                                        type="text"
                                        value={activeGroupOpts[optIdx] ?? ''}
                                        onChange={(e) =>
                                          updateQuestionGroupOption(index, activeGroup, optIdx, e.target.value)
                                        }
                                        placeholder={`Отговор ${label}`}
                                        required
                                        className="mb-0 text-sm"
                                      />
                                    ))}
                                  </div>
                                )}

                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-2">
                                    Верен отговор <span className="text-red-600">*</span>
                                  </label>
                                  {isMultipleChoice ? (
                                    <div className="flex flex-wrap gap-3">
                                      {OPTION_LABELS.map((label, optIdx) => (
                                        <label
                                          key={`${activeGroup}-correct-${label}`}
                                          className="inline-flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer"
                                        >
                                          <input
                                            type="radio"
                                            name={`correct-${question.id}-${activeGroup}`}
                                            value={label}
                                            checked={activeGroupData.correctAnswer === label}
                                            onChange={() =>
                                              updateQuestionGroup(index, activeGroup, 'correctAnswer', label)
                                            }
                                            className="text-blue-600"
                                          />
                                          <span className="font-medium">{label}</span>
                                          {activeGroupOpts[optIdx]?.trim() && (
                                            <span className="text-gray-500 truncate max-w-[120px]">
                                              — {activeGroupOpts[optIdx]}
                                            </span>
                                          )}
                                        </label>
                                      ))}
                                    </div>
                                  ) : (
                                    <Input
                                      type="text"
                                      value={activeGroupData.correctAnswer}
                                      onChange={(e) =>
                                        updateQuestionGroup(index, activeGroup, 'correctAnswer', e.target.value)
                                      }
                                      placeholder="Очакван верен отговор"
                                      required
                                      className="mb-0 text-sm"
                                    />
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex gap-3 items-end">
                                  <div className="flex-1">
                                    <Input
                                      label="Текст на въпроса"
                                      type="text"
                                      value={question.text}
                                      onChange={(e) => updateQuestion(index, { text: e.target.value })}
                                      placeholder={`Въпрос ${index + 1}`}
                                      required
                                      className="mb-0 text-sm"
                                    />
                                  </div>
                                  <div className="w-24">
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
                                      className="mb-0 text-sm"
                                    />
                                  </div>
                                </div>

                                {isMultipleChoice && (
                                  <div className="grid grid-cols-2 gap-2">
                                    {OPTION_LABELS.map((label, optIdx) => (
                                      <Input
                                        key={label}
                                        label={`Вариант ${label}`}
                                        type="text"
                                        value={opts[optIdx] ?? ''}
                                        onChange={(e) => updateQuestionOption(index, optIdx, e.target.value)}
                                        placeholder={`Отговор ${label}`}
                                        required
                                        className="mb-0 text-sm"
                                      />
                                    ))}
                                  </div>
                                )}

                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-2">
                                    Верен отговор <span className="text-red-600">*</span>
                                  </label>
                                  {isMultipleChoice ? (
                                    <div className="flex flex-wrap gap-3">
                                      {OPTION_LABELS.map((label, optIdx) => (
                                        <label
                                          key={label}
                                          className="inline-flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer"
                                        >
                                          <input
                                            type="radio"
                                            name={`correct-${question.id}`}
                                            value={label}
                                            checked={question.correctAnswer === label}
                                            onChange={() => updateQuestion(index, { correctAnswer: label })}
                                            className="text-blue-600"
                                          />
                                          <span className="font-medium">{label}</span>
                                          {opts[optIdx]?.trim() && (
                                            <span className="text-gray-500 truncate max-w-[120px]">
                                              — {opts[optIdx]}
                                            </span>
                                          )}
                                        </label>
                                      ))}
                                    </div>
                                  ) : (
                                    <Input
                                      type="text"
                                      value={question.correctAnswer ?? ''}
                                      onChange={(e) => updateQuestion(index, { correctAnswer: e.target.value })}
                                      placeholder="Очакван верен отговор"
                                      required
                                      className="mb-0 text-sm"
                                    />
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Индикатор за общи точки */}
                {questions.length > 0 && (
                  <div className={`p-4 rounded-lg border-2 ${totalQuestionPoints === maxPointsNum ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-medium ${totalQuestionPoints === maxPointsNum ? 'text-green-800' : 'text-yellow-800'}`}>
                        <strong>Общо точки:</strong> {totalQuestionPoints.toFixed(2)} / {maxPointsNum}
                      </p>
                      {totalQuestionPoints !== maxPointsNum && (
                        <span className="text-sm text-yellow-800">
                          {totalQuestionPoints < maxPointsNum 
                            ? `Остават ${(maxPointsNum - totalQuestionPoints).toFixed(2)} точки`
                            : `Надхвърлят с ${(totalQuestionPoints - maxPointsNum).toFixed(2)} точки`
                          }
                        </span>
                      )}
                    </div>
                    {totalQuestionPoints === maxPointsNum && (
                      <p className="text-xs text-green-700 mt-1">✓ Точките съвпадат!</p>
                    )}
                  </div>
                )}

                {questions.length === 0 && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-center">
                    <p className="text-blue-800">Няма добавени въпроси. Можете да продължите без въпроси или да добавите такива.</p>
                  </div>
                )}
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

      {/* Step 4: Обобщение */}
      {currentStep === 4 && (
        <div className="step-content">
          <div className="step-header">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Обобщение на теста</h3>
            <p className="text-sm text-gray-600">Прегледайте всички данни преди създаване на теста</p>
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

      {/* Navigation Buttons */}
      <div className="mt-8 flex justify-between items-center pt-6 border-t border-gray-200">
        <div>
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
        <div className="flex gap-3">
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
              {loading ? 'Запазване...' : '✓ Създай тест'}
            </Button>
          )}
        </div>
      </div>
      </form>
    </div>
  );
};
