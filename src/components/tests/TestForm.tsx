import React, { useState, useMemo } from 'react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Stepper } from '../common/Stepper';
import { useAppContext } from '../../context/AppContext';
import { getCurrentDate } from '../../utils/dateFormatter';
import type { TestType, GradeScale, Question } from '../../types';

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
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionCount, setQuestionCount] = useState<string>('');
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
      case 3:
        // Въпросите са опционални, няма нужда от валидация
        return true;
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

  // Функции за управление на въпросите
  const addQuestion = () => {
    const count = parseInt(questionCount);
    if (!isNaN(count) && count > 0) {
      const newQuestions: Question[] = [];
      
      for (let i = 0; i < count; i++) {
        newQuestions.push({
          id: `q${questions.length + i + 1}`,
          text: '',
          points: 0,
        });
      }
      
      setQuestions([...questions, ...newQuestions]);
      setQuestionCount('');
    }
  };

  const addSingleQuestion = () => {
    const newQuestion: Question = {
      id: `q${questions.length + 1}`,
      text: '',
      points: 0,
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestionText = (index: number, text: string) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], text };
    setQuestions(newQuestions);
  };

  const updateQuestionPoints = (index: number, points: number) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], points };
    setQuestions(newQuestions);
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
        questions: questions,
      });

      // Reset form
      setTestName('');
      setSelectedClass('');
      setTestType('Нормален тест');
      setTestDate(getCurrentDate());
      setMaxPoints('');
      setGradeScale({
        grade2: '',
        grade3: '',
        grade4: '',
        grade5: '',
        grade6: '',
      });
      setQuestions([]);
      setQuestionCount('');
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
            <p className="text-sm text-gray-600">Задайте въпросите и техните точки (опционално)</p>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {questions.map((question, index) => (
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
                          <div className="flex gap-3 items-end">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Текст на въпроса
                              </label>
                              <Input
                                type="text"
                                value={question.text}
                                onChange={(e) => updateQuestionText(index, e.target.value)}
                                placeholder={`Въпрос ${index + 1}`}
                                className="mb-0 text-sm"
                              />
                            </div>
                            <div className="w-24">
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Точки
                              </label>
                              <Input
                                type="text"
                                value={String(question.points || '')}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  const points = value === '' ? 0 : parseFloat(value) || 0;
                                  updateQuestionPoints(index, points);
                                }}
                                onFocus={(e) => e.target.select()}
                                placeholder="0"
                                className="mb-0 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
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
                    <p className="text-blue-800">Няма добавени въпроси. Въпросите са опционални.</p>
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
                          {question.text && (
                            <div className="mt-2 text-xs text-gray-600 truncate" title={question.text}>
                              {question.text}
                            </div>
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
