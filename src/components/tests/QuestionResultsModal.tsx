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
  const [questionSolved, setQuestionSolved] = useState<{ [questionId: string]: boolean }>({});
  const [totalPoints, setTotalPoints] = useState(0);
  const [calculatedGrade, setCalculatedGrade] = useState('');
  const [calculatedPercentage, setCalculatedPercentage] = useState(0);

  // Initialize with existing data
  useEffect(() => {
    if (!isOpen) return;

    const initialSolved: { [questionId: string]: boolean } = {};
    
    if (initialQuestionResults && initialQuestionResults.length > 0) {
      initialQuestionResults.forEach(qr => {
        const question = test.questions.find(q => q.id === qr.questionId);
        // Consider solved if points equal max points for that question
        initialSolved[qr.questionId] = question ? qr.points === question.points : false;
      });
    }

    setQuestionSolved(initialSolved);
  }, [isOpen, initialQuestionResults, test.questions]);

  // Calculate total whenever question solved status changes
  useEffect(() => {
    let total = 0;
    Object.entries(questionSolved).forEach(([questionId, solved]) => {
      if (solved) {
        const question = test.questions.find(q => q.id === questionId);
        if (question) {
          total += question.points;
        }
      }
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
  }, [questionSolved, test.maxPoints, test.gradeScale, test.questions]);

  const handleQuestionToggle = (questionId: string) => {
    setQuestionSolved(prev => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const handleSave = () => {
    const questionResults: QuestionResult[] = Object.entries(questionSolved)
      .map(([questionId, solved]) => {
        const question = test.questions.find(q => q.id === questionId);
        const points = solved && question ? question.points : 0;
        return {
          questionId,
          points,
        };
      })
      .filter(qr => qr.points > 0 || questionSolved[qr.questionId] === false); // Include all marked questions

    onSave(questionResults, totalPoints, calculatedGrade, calculatedPercentage);
    onClose();
  };

  const handleClearAll = () => {
    setQuestionSolved({});
  };

  const handleMarkAll = () => {
    const allSolved: { [questionId: string]: boolean } = {};
    test.questions.forEach(q => {
      allSolved[q.id] = true;
    });
    setQuestionSolved(allSolved);
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
                const isSolved = questionSolved[question.id] || false;
                return (
                  <div 
                    key={question.id} 
                    className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      isSolved 
                        ? 'bg-green-50 border-green-400 shadow-md' 
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleQuestionToggle(question.id)}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                        isSolved ? 'bg-green-500' : 'bg-blue-100'
                      }`}>
                        {isSolved ? (
                          <span className="text-2xl">✓</span>
                        ) : (
                          <span className="text-lg font-bold text-blue-700">{index + 1}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {question.text || `Въпрос ${index + 1}`}
                            </p>
                            <p className="text-xs text-gray-500">
                              {question.points} {question.points === 1 ? 'точка' : 'точки'}
                            </p>
                          </div>
                          <button
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                              isSolved
                                ? 'bg-green-500 text-white hover:bg-green-600'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuestionToggle(question.id);
                            }}
                          >
                            {isSolved ? '✅ Решен' : '❌ Нерешен'}
                          </button>
                        </div>
                        {isSolved && (
                          <div className="flex items-center gap-2 text-sm text-green-700">
                            <span className="font-semibold">+{question.points} точки</span>
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

