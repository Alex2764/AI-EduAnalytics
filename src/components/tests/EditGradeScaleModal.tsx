import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useAppContext } from '../../context/AppContext';
import { calculateGrade } from '../../utils/gradeCalculator';
import type { Test, GradeScale } from '../../types';

interface EditGradeScaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  test: Test | null;
}

export const EditGradeScaleModal: React.FC<EditGradeScaleModalProps> = ({ isOpen, onClose, test }) => {
  const { updateTest } = useAppContext();
  const [gradeScale, setGradeScale] = useState<GradeScale>({
    grade2: '',
    grade3: '',
    grade4: '',
    grade5: '',
    grade6: '',
  });
  const [errors, setErrors] = useState<string[]>([]);

  // Initialize gradeScale when test changes
  useEffect(() => {
    if (test) {
      // Преобразуване към string за по-лесно редактиране
      setGradeScale({
        grade2: typeof test.gradeScale.grade2 === 'string' ? test.gradeScale.grade2 : String(test.gradeScale.grade2 || ''),
        grade3: typeof test.gradeScale.grade3 === 'string' ? test.gradeScale.grade3 : String(test.gradeScale.grade3 || ''),
        grade4: typeof test.gradeScale.grade4 === 'string' ? test.gradeScale.grade4 : String(test.gradeScale.grade4 || ''),
        grade5: typeof test.gradeScale.grade5 === 'string' ? test.gradeScale.grade5 : String(test.gradeScale.grade5 || ''),
        grade6: typeof test.gradeScale.grade6 === 'string' ? test.gradeScale.grade6 : String(test.gradeScale.grade6 || ''),
      });
    }
  }, [test]);

  // Helper function to get grade for specific points
  const getGradeForPoints = (points: number, scale: GradeScale) => {
    if (!test) return '0';
    const { grade } = calculateGrade(points, test.maxPoints, scale);
    return grade;
  };

  const handleSave = async () => {
    if (!test) return;

    setErrors([]);
    // Преобразуване към number за валидация
    const grade2 = typeof gradeScale.grade2 === 'string' ? parseFloat(gradeScale.grade2) || 0 : gradeScale.grade2;
    const grade3 = typeof gradeScale.grade3 === 'string' ? parseFloat(gradeScale.grade3) || 0 : gradeScale.grade3;
    const grade4 = typeof gradeScale.grade4 === 'string' ? parseFloat(gradeScale.grade4) || 0 : gradeScale.grade4;
    const grade5 = typeof gradeScale.grade5 === 'string' ? parseFloat(gradeScale.grade5) || 0 : gradeScale.grade5;
    const grade6 = typeof gradeScale.grade6 === 'string' ? parseFloat(gradeScale.grade6) || 0 : gradeScale.grade6;
    
    // Validation
    if (grade2 < 0 || grade3 <= grade2 || grade4 <= grade3 || grade5 <= grade4 || grade6 <= grade5) {
      setErrors(['Скалата трябва да е в нарастващ ред: 2 < 3 < 4 < 5 < 6']);
      return;
    }
    
    if (grade6 > test.maxPoints) {
      setErrors(['Точките за оценка 6 не могат да надвишават максималните точки!']);
      return;
    }

    // Преобразуване към number преди запазване
    const gradeScaleToSave: GradeScale = {
      grade2: grade2,
      grade3: grade3,
      grade4: grade4,
      grade5: grade5,
      grade6: grade6,
    };

    // Update test
    try {
      await updateTest(test.id, { gradeScale: gradeScaleToSave });
      onClose();
    } catch (err: any) {
      setErrors([err.message || 'Грешка при запазване на скалата!']);
    }
  };

  const resetToDefault = () => {
    if (!test) return;
    
    setGradeScale({
      grade2: '0',
      grade3: Math.round(test.maxPoints * 0.40).toString(),
      grade4: Math.round(test.maxPoints * 0.60).toString(),
      grade5: Math.round(test.maxPoints * 0.76).toString(),
      grade6: Math.round(test.maxPoints * 0.92).toString(),
    });
  };

  if (!test) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Редактиране на скала за оценяване" size="lg">
      <div className="space-y-6">
        {/* Test Info */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Тест: {test.name}</h3>
          <div className="text-sm text-blue-800">
            <div>Клас: {test.class}</div>
            <div>Максимални точки: {test.maxPoints}</div>
            <div>Тип: {test.type}</div>
          </div>
        </div>

        {/* Current Scale Display */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-900 mb-3">Текуща скала за оценяване:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
            <div className="bg-gray-200 p-3 rounded text-center border-2 border-gray-400">
              <div className="font-bold text-lg">2</div>
              <div className="text-gray-700">
                <div className="font-medium">От {typeof gradeScale.grade2 === 'string' ? parseFloat(gradeScale.grade2) || 0 : gradeScale.grade2} до {(typeof gradeScale.grade3 === 'string' ? parseFloat(gradeScale.grade3) || 0 : gradeScale.grade3) - 0.5} точки</div>
                <div className="text-xs text-gray-600">
                  {typeof gradeScale.grade2 === 'string' ? (parseFloat(gradeScale.grade2) || 0) : gradeScale.grade2} - {(typeof gradeScale.grade3 === 'string' ? parseFloat(gradeScale.grade3) || 0 : gradeScale.grade3) - 0.5}т
                </div>
              </div>
            </div>
            <div className="bg-orange-200 p-3 rounded text-center border-2 border-orange-400">
              <div className="font-bold text-lg">3</div>
              <div className="text-orange-800">
                <div className="font-medium">От {typeof gradeScale.grade3 === 'string' ? parseFloat(gradeScale.grade3) || 0 : gradeScale.grade3} до {(typeof gradeScale.grade4 === 'string' ? parseFloat(gradeScale.grade4) || 0 : gradeScale.grade4) - 0.5} точки</div>
                <div className="text-xs text-orange-700">
                  {typeof gradeScale.grade3 === 'string' ? (parseFloat(gradeScale.grade3) || 0) : gradeScale.grade3} - {(typeof gradeScale.grade4 === 'string' ? parseFloat(gradeScale.grade4) || 0 : gradeScale.grade4) - 0.5}т
                </div>
              </div>
            </div>
            <div className="bg-yellow-200 p-3 rounded text-center border-2 border-yellow-400">
              <div className="font-bold text-lg">4</div>
              <div className="text-yellow-800">
                <div className="font-medium">От {typeof gradeScale.grade4 === 'string' ? parseFloat(gradeScale.grade4) || 0 : gradeScale.grade4} до {(typeof gradeScale.grade5 === 'string' ? parseFloat(gradeScale.grade5) || 0 : gradeScale.grade5) - 0.5} точки</div>
                <div className="text-xs text-yellow-700">
                  {typeof gradeScale.grade4 === 'string' ? (parseFloat(gradeScale.grade4) || 0) : gradeScale.grade4} - {(typeof gradeScale.grade5 === 'string' ? parseFloat(gradeScale.grade5) || 0 : gradeScale.grade5) - 0.5}т
                </div>
              </div>
            </div>
            <div className="bg-blue-200 p-3 rounded text-center border-2 border-blue-400">
              <div className="font-bold text-lg">5</div>
              <div className="text-blue-800">
                <div className="font-medium">От {typeof gradeScale.grade5 === 'string' ? parseFloat(gradeScale.grade5) || 0 : gradeScale.grade5} до {(typeof gradeScale.grade6 === 'string' ? parseFloat(gradeScale.grade6) || 0 : gradeScale.grade6) - 0.5} точки</div>
                <div className="text-xs text-blue-700">
                  {typeof gradeScale.grade5 === 'string' ? (parseFloat(gradeScale.grade5) || 0) : gradeScale.grade5} - {(typeof gradeScale.grade6 === 'string' ? parseFloat(gradeScale.grade6) || 0 : gradeScale.grade6) - 0.5}т
                </div>
              </div>
            </div>
            <div className="bg-green-200 p-3 rounded text-center border-2 border-green-400">
              <div className="font-bold text-lg">6</div>
              <div className="text-green-800">
                <div className="font-medium">От {typeof gradeScale.grade6 === 'string' ? parseFloat(gradeScale.grade6) || 0 : gradeScale.grade6} до {test.maxPoints} точки</div>
                <div className="text-xs text-green-700">
                  {typeof gradeScale.grade6 === 'string' ? (parseFloat(gradeScale.grade6) || 0) : gradeScale.grade6} - {test.maxPoints}т
                </div>
              </div>
            </div>
          </div>
          
          {/* Example with specific points */}
          <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
            <h5 className="font-semibold text-blue-900 mb-2">Примери за изчисляване:</h5>
            <div className="text-sm text-blue-800 space-y-1">
              <div>• {typeof gradeScale.grade2 === 'string' ? parseFloat(gradeScale.grade2) || 0 : gradeScale.grade2} точки = <strong>Оценка {getGradeForPoints(typeof gradeScale.grade2 === 'string' ? parseFloat(gradeScale.grade2) || 0 : gradeScale.grade2, gradeScale)}</strong> (минимум за 2)</div>
              <div>• {typeof gradeScale.grade3 === 'string' ? parseFloat(gradeScale.grade3) || 0 : gradeScale.grade3} точки = <strong>Оценка {getGradeForPoints(typeof gradeScale.grade3 === 'string' ? parseFloat(gradeScale.grade3) || 0 : gradeScale.grade3, gradeScale)}</strong> (минимум за 3)</div>
              <div>• {typeof gradeScale.grade4 === 'string' ? parseFloat(gradeScale.grade4) || 0 : gradeScale.grade4} точки = <strong>Оценка {getGradeForPoints(typeof gradeScale.grade4 === 'string' ? parseFloat(gradeScale.grade4) || 0 : gradeScale.grade4, gradeScale)}</strong> (минимум за 4)</div>
              <div>• {typeof gradeScale.grade5 === 'string' ? parseFloat(gradeScale.grade5) || 0 : gradeScale.grade5} точки = <strong>Оценка {getGradeForPoints(typeof gradeScale.grade5 === 'string' ? parseFloat(gradeScale.grade5) || 0 : gradeScale.grade5, gradeScale)}</strong> (минимум за 5)</div>
              <div>• {typeof gradeScale.grade6 === 'string' ? parseFloat(gradeScale.grade6) || 0 : gradeScale.grade6} точки = <strong>Оценка {getGradeForPoints(typeof gradeScale.grade6 === 'string' ? parseFloat(gradeScale.grade6) || 0 : gradeScale.grade6, gradeScale)}</strong> (минимум за 6)</div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-blue-300">
              <h6 className="font-semibold text-blue-900 mb-1">Тестови примери:</h6>
              <div className="text-sm text-blue-800 space-y-1">
                <div>• 8 точки = <strong>Оценка {getGradeForPoints(8, gradeScale)}</strong></div>
                <div>• 15 точки = <strong>Оценка {getGradeForPoints(15, gradeScale)}</strong></div>
                <div>• 25 точки = <strong>Оценка {getGradeForPoints(25, gradeScale)}</strong></div>
                <div>• {Math.floor(test.maxPoints * 0.5)} точки = <strong>Оценка {getGradeForPoints(Math.floor(test.maxPoints * 0.5), gradeScale)}</strong></div>
              </div>
            </div>
          </div>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="text-red-800 font-medium mb-2">Грешки:</h4>
            <ul className="text-red-700 text-sm space-y-1">
              {errors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Edit Form */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Редактиране на скалата:</h4>
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
                className="mb-0"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between">
          <Button
            variant="secondary"
            onClick={resetToDefault}
            className="bg-gray-500 hover:bg-gray-600"
          >
            Върни към стандартна скала
          </Button>
          
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Откажи
            </Button>
            <Button onClick={handleSave}>
              Запази промените
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
