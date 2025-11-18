import React, { useState, useMemo } from 'react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
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

interface TestFormProps {
  onSuccess?: () => void;
}

export const TestForm: React.FC<TestFormProps> = ({ onSuccess }) => {
  const { classes, addTest } = useAppContext();
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

  const classOptions = useMemo(() => classes.map(cls => ({
    value: cls.name,
    label: cls.name,
  })), [classes]);

  // Функция за изчисляване на стандартна скала
  const calculateDefaultScale = () => {
    const maxPointsNum = parseFloat(maxPoints);
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
          id: `q${i + 1}`,
          text: '',
          points: 0,
        });
      }
      
      setQuestions(newQuestions);
    }
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
    setQuestionCount(newQuestions.length.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const maxPointsNum = parseFloat(maxPoints);

    if (!testName || !selectedClass || !testDate || maxPoints === '' || isNaN(maxPointsNum) || maxPointsNum === 0) {
      setError('Моля попълнете всички полета!');
      return;
    }

    if (maxPointsNum <= 0) {
      setError('Максималните точки трябва да са по-големи от 0!');
      return;
    }

    // Валидация на скалата и преобразуване към number
    const grade2Num = typeof gradeScale.grade2 === 'string' ? parseFloat(gradeScale.grade2) || 0 : gradeScale.grade2;
    const grade3Num = typeof gradeScale.grade3 === 'string' ? parseFloat(gradeScale.grade3) || 0 : gradeScale.grade3;
    const grade4Num = typeof gradeScale.grade4 === 'string' ? parseFloat(gradeScale.grade4) || 0 : gradeScale.grade4;
    const grade5Num = typeof gradeScale.grade5 === 'string' ? parseFloat(gradeScale.grade5) || 0 : gradeScale.grade5;
    const grade6Num = typeof gradeScale.grade6 === 'string' ? parseFloat(gradeScale.grade6) || 0 : gradeScale.grade6;
    
    if (grade2Num < 0 || grade3Num <= grade2Num || grade4Num <= grade3Num || grade5Num <= grade4Num || grade6Num <= grade5Num) {
      setError('Скалата трябва да е в нарастващ ред: 2 < 3 < 4 < 5 < 6');
      return;
    }
    
    if (grade6Num > maxPointsNum) {
      setError('Точките за оценка 6 не могат да надвишават максималните точки!');
      return;
    }

    try {
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
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Грешка при създаване на тест!');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
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

      {/* Скала за оценяване */}
      {parseFloat(maxPoints) > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-md font-semibold text-gray-900">
              Скала за оценяване
            </h4>
            <Button
              type="button"
              onClick={calculateDefaultScale}
              className="bg-gray-500 hover:bg-gray-600 text-white text-sm py-1 px-3"
            >
              Изчисли стандартна скала
            </Button>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Задайте минимални точки за всяка оценка или натиснете бутона за стандартна скала (40%, 60%, 76%, 92%).
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Оценка 2 (от точки)
              </label>
              <Input
                type="text"
                value={String(gradeScale.grade2 || '')}
                onChange={(e) => {
                  const value = e.target.value;
                  setGradeScale(prev => ({ 
                    ...prev, 
                    grade2: value
                  }));
                }}
                onFocus={(e) => e.target.select()}
                placeholder="0"
                required
                className="mb-0"
              />
            </div>
            
            <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
              <label className="block text-sm font-medium text-orange-800 mb-2">
                Оценка 3 (от точки)
              </label>
              <Input
                type="text"
                value={String(gradeScale.grade3 || '')}
                onChange={(e) => {
                  const value = e.target.value;
                  setGradeScale(prev => ({ 
                    ...prev, 
                    grade3: value
                  }));
                }}
                onFocus={(e) => e.target.select()}
                placeholder="0"
                required
                className="mb-0"
              />
            </div>
            
            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
              <label className="block text-sm font-medium text-yellow-800 mb-2">
                Оценка 4 (от точки)
              </label>
              <Input
                type="text"
                value={String(gradeScale.grade4 || '')}
                onChange={(e) => {
                  const value = e.target.value;
                  setGradeScale(prev => ({ 
                    ...prev, 
                    grade4: value
                  }));
                }}
                onFocus={(e) => e.target.select()}
                placeholder="0"
                required
                className="mb-0"
              />
            </div>
            
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <label className="block text-sm font-medium text-blue-800 mb-2">
                Оценка 5 (от точки)
              </label>
              <Input
                type="text"
                value={String(gradeScale.grade5 || '')}
                onChange={(e) => {
                  const value = e.target.value;
                  setGradeScale(prev => ({ 
                    ...prev, 
                    grade5: value
                  }));
                }}
                onFocus={(e) => e.target.select()}
                placeholder="0"
                required
                className="mb-0"
              />
            </div>
            
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <label className="block text-sm font-medium text-green-800 mb-2">
                Оценка 6 (от точки)
              </label>
              <Input
                type="text"
                value={String(gradeScale.grade6 || '')}
                onChange={(e) => {
                  const value = e.target.value;
                  setGradeScale(prev => ({ 
                    ...prev, 
                    grade6: value
                  }));
                }}
                onFocus={(e) => e.target.select()}
                placeholder="0"
                required
                className="mb-0"
              />
            </div>
          </div>

          <div className="mt-4 bg-blue-50 p-3 rounded-lg">
            <p className="text-xs text-blue-800">
              💡 <strong>Пример:</strong> При тест с {maxPoints} точки, текущата скала е: 
              2 = {parseFloat(String(gradeScale.grade2 || '0')) || 0}-{((parseFloat(String(gradeScale.grade3 || '0')) || 0) - 0.5).toFixed(1)}т, 
              3 = {parseFloat(String(gradeScale.grade3 || '0')) || 0}-{((parseFloat(String(gradeScale.grade4 || '0')) || 0) - 0.5).toFixed(1)}т, 
              4 = {parseFloat(String(gradeScale.grade4 || '0')) || 0}-{((parseFloat(String(gradeScale.grade5 || '0')) || 0) - 0.5).toFixed(1)}т, 
              5 = {parseFloat(String(gradeScale.grade5 || '0')) || 0}-{((parseFloat(String(gradeScale.grade6 || '0')) || 0) - 0.5).toFixed(1)}т, 
              6 = {parseFloat(String(gradeScale.grade6 || '0')) || 0}+т
            </p>
          </div>
        </div>
      )}

      {/* Въпроси в теста */}
      {parseFloat(maxPoints) > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-md font-semibold text-gray-900 mb-3">
            Въпроси в теста
          </h4>
          <p className="text-sm text-gray-600 mb-4">
            Задайте броя въпроси и техните точки. Общите точки на всички въпроси трябва да съответстват на максималните точки на теста.
          </p>

          <div className="mb-4">
            <label className="field-label">Брой въпроси</label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={questionCount}
                onChange={(e) => setQuestionCount(e.target.value)}
                placeholder="Въведете брой въпроси"
                className="flex-1"
              />
              <Button
                type="button"
                onClick={addQuestion}
                disabled={!questionCount || parseInt(questionCount) <= 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Генерирай въпроси
              </Button>
            </div>
          </div>

          {questions.length > 0 && (
            <div className="space-y-3">
              <h5 className="text-sm font-medium text-gray-700">Въпроси:</h5>
              {questions.map((question, index) => (
                <div key={question.id} className="bg-gray-50 p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">
                      Въпрос {index + 1}
                    </span>
                    <Button
                      type="button"
                      onClick={() => removeQuestion(index)}
                      className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 text-xs"
                    >
                      Изтрий
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Текст на въпроса
                      </label>
                      <Input
                        type="text"
                        value={question.text}
                        onChange={(e) => updateQuestionText(index, e.target.value)}
                        placeholder={`Въпрос ${index + 1}`}
                        className="text-sm"
                      />
                    </div>
                    <div>
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
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-800">
                  💡 <strong>Общо точки:</strong> {
                    questions.reduce((sum, q) => sum + (q.points || 0), 0)
                  } / {maxPoints}
                  {questions.reduce((sum, q) => sum + (q.points || 0), 0) !== parseFloat(maxPoints) && (
                    <span className="text-red-600 ml-2">
                      (Трябва да бъде {maxPoints})
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button type="submit">
          Създай тест
        </Button>
      </div>
    </form>
  );
};