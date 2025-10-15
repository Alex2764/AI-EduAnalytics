import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useAppContext } from '../../context/AppContext';
import { calculateGrade } from '../../utils/gradeCalculator';
import { formatDate } from '../../utils/dateFormatter';
import type { Student, Result } from '../../types';

interface ResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  testId: string;
}

interface StudentResult {
  studentId: string;
  student: Student;
  points: string;
  grade: string;
  percentage: number;
  participated: boolean;
}

export const ResultsModal: React.FC<ResultsModalProps> = ({ isOpen, onClose, testId }) => {
  const { tests, students, results, saveResults } = useAppContext();
  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [bulkPoints, setBulkPoints] = useState('');

  const test = tests.find(t => t.id === testId);

  useEffect(() => {
    if (!test || !isOpen) return;

    const classStudents = students
      .filter(s => s.class === test.class)
      .sort((a, b) => a.number - b.number);

    const initialResults: StudentResult[] = classStudents.map(student => {
      const existingResult = results.find(r => r.testId === testId && r.studentId === student.id);
      
      return {
        studentId: student.id,
        student,
        points: existingResult ? existingResult.points.toString() : '',
        grade: existingResult ? existingResult.grade : '',
        percentage: existingResult ? existingResult.percentage : 0,
        participated: existingResult ? existingResult.participated : true,
      };
    });

    setStudentResults(initialResults);
  }, [test?.id, testId, students, results, isOpen]);

  if (!test) return null;

  const handlePointsChange = (studentId: string, points: string) => {
    const pointsValue = parseFloat(points);
    
    setStudentResults(prev => prev.map(result => {
      if (result.studentId === studentId) {
        if (isNaN(pointsValue) || points === '') {
          return { ...result, points, grade: '', percentage: 0 };
        }
        
        const clampedPoints = Math.max(0, Math.min(pointsValue, test.maxPoints));
        const { grade, percentage } = calculateGrade(clampedPoints, test.maxPoints);
        
        return {
          ...result,
          points: clampedPoints.toString(),
          grade,
          percentage,
        };
      }
      return result;
    }));
  };

  const handleBulkFill = () => {
    const points = parseFloat(bulkPoints);
    if (isNaN(points)) return;

    studentResults.forEach(result => {
      handlePointsChange(result.studentId, points.toString());
    });
    setBulkPoints('');
  };

  const handleParticipationToggle = (studentId: string) => {
    setStudentResults(prev => prev.map(result => {
      if (result.studentId === studentId) {
        const newParticipated = !result.participated;
        return {
          ...result,
          participated: newParticipated,
          // If marking as not participated, clear points
          points: newParticipated ? result.points : '',
          grade: newParticipated ? result.grade : '',
          percentage: newParticipated ? result.percentage : 0,
        };
      }
      return result;
    }));
  };

  const handleClearAll = () => {
    if (!window.confirm('Сигурни ли сте, че искате да изчистите всички резултати?')) return;
    
    setStudentResults(prev => prev.map(result => ({
      ...result,
      points: '',
      grade: '',
      percentage: 0,
    })));
  };

  const handleSave = () => {
    // Save all results (both participated and non-participated)
    const allResults = studentResults.filter(result => {
      // Include results that either have points OR are marked as not participated
      const points = parseFloat(result.points);
      return result.participated ? (!isNaN(points) && points >= 0) : true;
    });

    if (allResults.length === 0) {
      alert('Няма резултати за запазване!');
      return;
    }

    const resultsToSave: Omit<Result, 'id'>[] = allResults.map(result => ({
      studentId: result.studentId,
      testId: testId,
      points: result.participated ? parseFloat(result.points) : 0,
      grade: result.participated ? result.grade : '2.00',
      percentage: result.participated ? result.percentage : 0,
      dateAdded: new Date().toISOString(),
      participated: result.participated,
    }));

    saveResults(testId, resultsToSave);
    onClose();
  };

  const getGradeColorClass = (grade: string) => {
    const gradeValue = parseFloat(grade);
    if (gradeValue >= 6) return 'bg-green-100 text-green-800';
    if (gradeValue >= 5) return 'bg-blue-100 text-blue-800';
    if (gradeValue >= 4) return 'bg-yellow-100 text-yellow-800';
    if (gradeValue >= 3) return 'bg-orange-100 text-orange-800';
    if (gradeValue >= 2) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Въвеждане на резултати" size="xl">
      <div className="results-container">
        {/* Header with Test Info */}
        <div className="results-header">
          <div className="test-title">
            <h2 className="test-name">{test.name}</h2>
            <div className="test-badge">{test.class}</div>
          </div>
          <div className="test-meta">
            <div className="meta-item">
              <span className="meta-label">Тип</span>
              <span className="meta-value">{test.type}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Дата</span>
              <span className="meta-value">{formatDate(test.date)}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Макс. точки</span>
              <span className="meta-value">{test.maxPoints}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Ученици</span>
              <span className="meta-value">{studentResults.length}</span>
            </div>
          </div>
        </div>

        {/* Grading System Info */}
        <div className="grading-system">
          <h3 className="section-title">Система за оценяване</h3>
          <div className="grade-scale">
            <div className="grade-item excellent">92%+ = 6</div>
            <div className="grade-item very-good">76-92% = 5</div>
            <div className="grade-item good">60-76% = 4</div>
            <div className="grade-item satisfactory">40-60% = 3</div>
            <div className="grade-item poor">До 40% = 2</div>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="bulk-actions">
          <h3 className="section-title">Бързо попълване</h3>
          <div className="bulk-form">
            <div className="bulk-input-group">
              <label className="bulk-label">Точки:</label>
              <Input
                type="number"
                value={bulkPoints}
                onChange={(e) => setBulkPoints(e.target.value)}
                placeholder="0"
                min={0}
                max={test.maxPoints}
                className="bulk-input"
              />
            </div>
            <div className="bulk-buttons">
              <Button onClick={handleBulkFill} className="bulk-btn-fill">
                Попълни всички
              </Button>
              <Button variant="secondary" onClick={handleClearAll} className="bulk-btn-clear">
                Изчисти всички
              </Button>
            </div>
          </div>
          <p className="bulk-help">Задайте еднакъв резултат на всички ученици</p>
        </div>

        {/* Results Table */}
        <div className="results-table-section">
          <h3 className="section-title">Резултати по ученици</h3>
          <div className="table-wrapper">
            <table className="results-table">
              <thead>
                <tr>
                  <th className="col-number">№</th>
                  <th className="col-name">Име</th>
                  <th className="col-middle">Презире</th>
                  <th className="col-last">Фамилия</th>
                  <th className="col-participation">Участие</th>
                  <th className="col-points">Точки</th>
                  <th className="col-grade">Оценка</th>
                  <th className="col-percentage">%</th>
                </tr>
              </thead>
              <tbody>
                {studentResults.map((result) => (
                  <tr key={result.studentId} className="student-row">
                    <td className="col-number">
                      <div className="student-number">{result.student.number}</div>
                    </td>
                    <td className="col-name">
                      <div className="student-name">{result.student.firstName}</div>
                    </td>
                    <td className="col-middle">
                      <div className="student-middle">{result.student.middleName}</div>
                    </td>
                    <td className="col-last">
                      <div className="student-last">{result.student.lastName}</div>
                    </td>
                    <td className="col-participation">
                      <Button
                        onClick={() => handleParticipationToggle(result.studentId)}
                        variant={result.participated ? "primary" : "danger"}
                        className={`participation-btn ${result.participated ? 'participated' : 'not-participated'}`}
                      >
                        {result.participated ? '✅ Участва' : '❌ НЕ участва'}
                      </Button>
                    </td>
                    <td className="col-points">
                      <Input
                        type="number"
                        value={result.points}
                        onChange={(e) => handlePointsChange(result.studentId, e.target.value)}
                        placeholder="0"
                        min={0}
                        max={test.maxPoints}
                        step={0.5}
                        className={`points-input ${!result.participated ? 'disabled' : ''}`}
                      />
                    </td>
                    <td className="col-grade">
                      {result.grade ? (
                        <div className={`grade-badge ${getGradeColorClass(result.grade)}`}>
                          {result.grade}
                        </div>
                      ) : (
                        <div className="grade-empty">—</div>
                      )}
                    </td>
                    <td className="col-percentage">
                      {result.percentage > 0 ? (
                        <div className="percentage-value">{Math.round(result.percentage)}%</div>
                      ) : (
                        <div className="percentage-empty">—</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="results-actions">
          <Button variant="secondary" onClick={onClose} className="action-btn-cancel">
            Откажи
          </Button>
          <Button onClick={handleSave} className="action-btn-save">
            Запази резултати
          </Button>
        </div>
      </div>
    </Modal>
  );
};
