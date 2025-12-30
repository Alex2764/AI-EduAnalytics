import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Button } from '../common/Button';
import { generateReport } from '../../lib/api';
import type { Test } from '../../types';
import { logger } from '../../utils/logger';
import { getErrorMessage } from '../../utils/errorHandler';

interface GenerateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  test: Test | null;
  classId: string | null;
  showClassTestSelection?: boolean;
  classOptions?: Array<{ value: string; label: string }>;
  testOptions?: Array<{ value: string; label: string }>;
  selectedClass?: string;
  selectedTest?: Test | null;
  onClassChange?: (className: string) => void;
  onTestChange?: (testId: string) => void;
  testsWithResultsLength?: number;
  getClassIdCallback?: (className: string) => string | null;
}

export const GenerateReportModal: React.FC<GenerateReportModalProps> = ({
  isOpen,
  onClose,
  test,
  classId,
  showClassTestSelection = false,
  classOptions = [],
  testOptions = [],
  selectedClass = '',
  selectedTest = null,
  onClassChange,
  onTestChange,
  testsWithResultsLength = 0,
  getClassIdCallback,
}) => {
  const [teacherName, setTeacherName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleClose = () => {
    setTeacherName('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validation
    if (showClassTestSelection && (!selectedTest || !selectedClass)) {
      setError('Моля, изберете клас и тест');
      return;
    }
    if (!showClassTestSelection && (!test || !classId)) {
      setError('Моля, изберете тест');
      return;
    }

    // Get the actual class ID if we're using class selection
    let actualClassId: string | null = null;
    if (showClassTestSelection) {
      // Use callback to get class ID from class name
      if (getClassIdCallback && selectedClass) {
        actualClassId = getClassIdCallback(selectedClass);
      } else if (selectedClass) {
        // Fallback: try to use selectedClass as ID directly
        actualClassId = selectedClass;
      }
    } else {
      actualClassId = classId;
    }

    if (!actualClassId) {
      setError('Грешка при получаване на ID на класа');
      return;
    }

    const testId = showClassTestSelection ? selectedTest?.id : test?.id;
    
    if (!testId) {
      setError('Грешка при получаване на ID на теста');
      return;
    }

    try {
      setLoading(true);
      
      await generateReport({
        testId,
        classId: actualClassId,
        teacherName: teacherName.trim() || undefined,
      });

      setSuccess(true);
      
      // Close modal after a short delay
      setTimeout(() => {
        handleClose();
      }, 1500);
      
    } catch (err) {
      const errorMessage = getErrorMessage(err, 'Възникна грешка при генериране на анализа');
      setError(errorMessage);
      logger.error('Error generating report:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!showClassTestSelection && (!test || !classId)) {
    return null;
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
          ✓ Анализът е генериран успешно! Файлът се изтегля автоматично...
        </div>
      )}

      {/* Class and Test Selection */}
      {showClassTestSelection && (
        <>
          <Select
            label="Изберете клас"
            value={selectedClass}
            onChange={(e) => onClassChange?.(e.target.value)}
            options={classOptions}
            placeholder="Изберете клас"
          />

          <Select
            label="Изберете тест"
            value={selectedTest?.id || ''}
            onChange={(e) => onTestChange?.(e.target.value)}
            options={testOptions}
            placeholder={selectedClass ? "Изберете тест" : "Първо изберете клас"}
            disabled={!selectedClass}
          />

          {selectedClass && testsWithResultsLength === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded text-sm">
              Няма тестове с резултати за този клас. Моля, въведете резултати първо.
            </div>
          )}

          {/* Test Info (Read-only) - shown when test is selected */}
          {selectedTest && (
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600 mb-1">Тест:</div>
              <div className="font-medium text-gray-900">{selectedTest?.name}</div>
              <div className="text-sm text-gray-600 mt-2">Клас:</div>
              <div className="font-medium text-gray-900">{selectedClass}</div>
            </div>
          )}
        </>
      )}

      {/* Test Info (Read-only) - when not using class/test selection */}
      {!showClassTestSelection && test && (
        <div className="bg-gray-50 p-3 rounded">
          <div className="text-sm text-gray-600 mb-1">Тест:</div>
          <div className="font-medium text-gray-900">{test.name}</div>
          <div className="text-sm text-gray-600 mt-2">Клас:</div>
          <div className="font-medium text-gray-900">{test.class}</div>
        </div>
      )}

      {/* Teacher Name Input - always visible */}
      <Input
        label="Име на преподавател (опционално)"
        value={teacherName}
        onChange={(e) => setTeacherName(e.target.value)}
        placeholder="Въведете име на преподавател"
      />

      {/* Form Actions - always visible */}
      <div className="flex justify-end gap-3 pt-4">
        <Button 
          type="button" 
          variant="secondary" 
          onClick={handleClose}
          disabled={loading}
        >
          Отказ
        </Button>
        <Button 
          type="submit" 
          disabled={
            loading || 
            success ||
            (showClassTestSelection ? (!selectedTest?.id || !selectedClass) : (!test?.id || !classId))
          }
        >
          {loading ? 'Генериране...' : success ? 'Готово!' : 'Генерирай анализ'}
        </Button>
      </div>
    </form>
  );

  if (showClassTestSelection) {
    return formContent;
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Генерирай AI анализ" size="md">
      {formContent}
    </Modal>
  );
};

