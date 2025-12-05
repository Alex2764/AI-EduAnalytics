import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { calculateGrade } from '../../utils/gradeCalculator';
import type { Test, Student, QuestionResult } from '../../types';

interface QuestionResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  test: Test;
  student: Student;
  initialQuestionResults?: QuestionResult[];
  onSave: (questionResults: QuestionResult[], totalPoints: number, grade: string, percentage: number) => void;
}

export const QuestionResultsModal: React.FC<QuestionResultsModalProps> = ({
  isOpen,
  onClose,
  test,
  student,
  initialQuestionResults,
  onSave,
}) => {
  // Changed from boolean to number - stores actual points for each question
  const [questionPoints, setQuestionPoints] = useState<{ [questionId: string]: number }>({});
  const [totalPoints, setTotalPoints] = useState(0);
  const [calculatedGrade, setCalculatedGrade] = useState('');
  const [calculatedPercentage, setCalculatedPercentage] = useState(0);

  // Initialize with existing data - load actual points, not boolean
  useEffect(() => {
    if (!isOpen) return;

    const initialPoints: { [questionId: string]: number } = {};
    
    if (initialQuestionResults && initialQuestionResults.length > 0) {
      initialQuestionResults.forEach(qr => {
        // Load actual points from saved data (supports partial points)
        initialPoints[qr.questionId] = qr.points || 0;
      });
    }

    setQuestionPoints(initialPoints);
  }, [isOpen, initialQuestionResults]);

  // Calculate total whenever question points change
  useEffect(() => {
    let total = 0;
    Object.values(questionPoints).forEach((points) => {
      // Sum up actual points (not boolean anymore)
      total += points || 0;
    });

    setTotalPoints(total);

    // Calculate grade
    if (total > 0) {
      const { grade, percentage } = calculateGrade(total, test.maxPoints, test.gradeScale);
      setCalculatedGrade(grade);
      setCalculatedPercentage(percentage);
    } else {
      setCalculatedGrade('');
      setCalculatedPercentage(0);
    }
  }, [questionPoints, test.maxPoints, test.gradeScale]);

  // Toggle handler for 1-point questions (all or nothing)
  const handleQuestionToggle = (questionId: string) => {
    const question = test.questions.find(q => q.id === questionId);
    if (!question) return;
    
    setQuestionPoints(prev => {
      const currentPoints = prev[questionId] || 0;
      // Toggle: if has points, set to 0; if 0, set to max points
      return {
        ...prev,
        [questionId]: currentPoints > 0 ? 0 : question.points,
      };
    });
  };

  // Handler for multi-point questions - update points value
  const handlePointsChange = (questionId: string, value: string) => {
    const question = test.questions.find(q => q.id === questionId);
    if (!question) return;

    const numValue = parseFloat(value);
    const maxPoints = question.points;

    // Validate: must be between 0 and max points
    let points = 0;
    if (!isNaN(numValue) && value !== '') {
      points = Math.max(0, Math.min(numValue, maxPoints));
    }

    setQuestionPoints(prev => ({
      ...prev,
      [questionId]: points,
    }));
  };

  const handleSave = () => {
    // Convert questionPoints to QuestionResult format
    const questionResults: QuestionResult[] = test.questions
      .map(question => ({
        questionId: question.id,
        points: questionPoints[question.id] || 0,
      }))
      .filter(qr => qr.points > 0); // Only include questions with points

    onSave(questionResults, totalPoints, calculatedGrade, calculatedPercentage);
    onClose();
  };

  const handleClearAll = () => {
    setQuestionPoints({});
  };

  const handleMarkAll = () => {
    const allPoints: { [questionId: string]: number } = {};
    test.questions.forEach(q => {
      allPoints[q.id] = q.points; // Give full points to all
    });
    setQuestionPoints(allPoints);
  };

  const getGradeColorClass = (grade: string) => {
    const gradeValue = parseFloat(grade);
    if (gradeValue >= 6) return 'bg-green-100 text-green-800 border-green-300';
    if (gradeValue >= 5) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (gradeValue >= 4) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (gradeValue >= 3) return 'bg-orange-100 text-orange-800 border-orange-300';
    if (gradeValue >= 2) return 'bg-red-100 text-red-800 border-red-300';
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getTotalColor = () => {
    if (test.maxPoints <= 0) return 'text-gray-600';
    const percentage = (totalPoints / test.maxPoints) * 100;
    if (percentage >= 92) return 'text-green-600';
    if (percentage >= 76) return 'text-blue-600';
    if (percentage >= 60) return 'text-yellow-600';
    if (percentage >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Детайлно въвеждане по въпроси" size="lg">
      <div className="space-y-6">
        {/* Student Info */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {student.firstName} {student.middleName} {student.lastName}
              </h3>
              <p className="text-sm text-gray-600">
                № {student.number} • {student.class}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Тест:</div>
              <div className="font-medium text-gray-900">{test.name}</div>
            </div>
          </div>
        </div>

        {/* Questions List */}
        {test.questions && test.questions.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-semibold text-gray-900">Въпроси</h4>
              <div className="flex gap-2">
                <Button 
                  onClick={handleMarkAll} 
                  variant="primary"
                  className="text-sm"
                >
                  ✅ Маркирай всички
                </Button>
                <Button 
                  onClick={handleClearAll} 
                  variant="secondary"
                  className="text-sm"
                >
                  Изчисти всички
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {test.questions.map((question, index) => {
                const earnedPoints = questionPoints[question.id] || 0;
                const isOnePoint = question.points === 1;
                const hasPoints = earnedPoints > 0;
                
                return (
                  <div 
                    key={question.id} 
                    className={`p-4 rounded-lg border-2 transition-all ${
                      hasPoints 
                        ? 'bg-green-50 border-green-400 shadow-md' 
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    } ${isOnePoint ? 'cursor-pointer' : ''}`}
                    onClick={isOnePoint ? () => handleQuestionToggle(question.id) : undefined}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                        hasPoints ? 'bg-green-500' : 'bg-blue-100'
                      }`}>
                        {hasPoints ? (
                          <span className="text-2xl">✓</span>
                        ) : (
                          <span className="text-lg font-bold text-blue-700">{index + 1}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {question.text || `Въпрос ${index + 1}`}
                            </p>
                            <p className="text-xs text-gray-500">
                              Макс: {question.points} {question.points === 1 ? 'точка' : 'точки'}
                            </p>
                          </div>
                          
                          {/* For 1-point questions: Show toggle button */}
                          {isOnePoint && (
                            <button
                              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                                hasPoints
                                  ? 'bg-green-500 text-white hover:bg-green-600'
                                  : 'bg-red-100 text-red-700 hover:bg-red-200'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuestionToggle(question.id);
                              }}
                            >
                              {hasPoints ? '✅ Решен' : '❌ Нерешен'}
                            </button>
                          )}
                          
                          {/* For multi-point questions: Show input field */}
                          {!isOnePoint && (
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <label className="text-xs text-gray-500 block mb-1">
                                  Точки
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max={question.points}
                                  step="0.5"
                                  value={earnedPoints || ''}
                                  onChange={(e) => handlePointsChange(question.id, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  onFocus={(e) => e.stopPropagation()}
                                  className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  placeholder="0"
                                />
                                <span className="text-xs text-gray-500 ml-1">
                                  / {question.points}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Show earned points summary */}
                        {hasPoints && (
                          <div className="flex items-center gap-2 text-sm text-green-700 mt-2">
                            <span className="font-semibold">
                              {earnedPoints === question.points 
                                ? `+${earnedPoints} точки (пълно)` 
                                : `+${earnedPoints} от ${question.points} точки`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-800">
              ⚠️ Този тест няма дефинирани въпроси. Моля, първо добавете въпроси към теста.
            </p>
          </div>
        )}

        {/* Results Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border-2 border-blue-200">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Резултат</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="text-xs text-gray-600 mb-1">Общо точки</div>
              <div className={`text-2xl font-bold ${getTotalColor()}`}>
                {totalPoints.toFixed(1)} / {test.maxPoints}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="text-xs text-gray-600 mb-1">Процент</div>
              <div className={`text-2xl font-bold ${getTotalColor()}`}>
                {Math.round(calculatedPercentage)}%
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="text-xs text-gray-600 mb-1">Оценка</div>
              {calculatedGrade ? (
                <div className={`text-2xl font-bold px-3 py-1 rounded border-2 inline-block ${getGradeColorClass(calculatedGrade)}`}>
                  {calculatedGrade}
                </div>
              ) : (
                <div className="text-2xl font-bold text-gray-400">—</div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>
            Откажи
          </Button>
          <Button 
            onClick={handleSave}
            disabled={test.questions.length === 0 || totalPoints === 0}
          >
            Запази резултати
          </Button>
        </div>
      </div>
    </Modal>
  );
};

