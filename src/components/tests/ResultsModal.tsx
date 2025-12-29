import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useAppContext } from '../../context/AppContext';
import { calculateGrade } from '../../utils/gradeCalculator';
import { formatDate } from '../../utils/dateFormatter';
import { QuestionResultsModal } from './QuestionResultsModal';
import type { Student, Result, QuestionResult } from '../../types';

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
  cancelled: boolean;
  cancelReason?: string;
  questionResults?: QuestionResult[];
}

export const ResultsModal: React.FC<ResultsModalProps> = ({ isOpen, onClose, testId }) => {
  const { tests, students, results, saveResults } = useAppContext();
  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [bulkPoints, setBulkPoints] = useState('');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

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
        cancelled: existingResult ? existingResult.cancelled : false,
        cancelReason: existingResult?.cancelReason,
        questionResults: existingResult?.questionResults || [],
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
        const { grade, percentage } = calculateGrade(clampedPoints, test.maxPoints, test.gradeScale);
        
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
          // If marking as not participated, clear points and cancelled status
          points: newParticipated ? result.points : '',
          grade: newParticipated ? result.grade : '',
          percentage: newParticipated ? result.percentage : 0,
          cancelled: newParticipated ? result.cancelled : false,
        };
      }
      return result;
    }));
  };

  const handleCancelToggle = (studentId: string) => {
    setStudentResults(prev => prev.map(result => {
      if (result.studentId === studentId) {
        const newCancelled = !result.cancelled;
        
        if (newCancelled) {
          // When cancelling, prompt for reason
          const reason = window.prompt('Причина за анулиране на теста (напр. "Преписване"):');
          if (reason === null) return result; // User cancelled the prompt
          
          return {
            ...result,
            cancelled: true,
            cancelReason: reason || 'Анулиран',
          };
        } else {
          // When un-cancelling, clear the reason
          return {
            ...result,
            cancelled: false,
            cancelReason: undefined,
          };
        }
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

  const handleSave = async () => {
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
      cancelled: result.cancelled,
      cancelReason: result.cancelReason,
      questionResults: result.questionResults,
    }));

    try {
      await saveResults(testId, resultsToSave);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Грешка при запазване на резултати!');
    }
  };

  const handleOpenDetailModal = (studentId: string) => {
    setSelectedStudentId(studentId);
    setDetailModalOpen(true);
  };

  const handleSaveDetailedResults = (
    studentId: string,
    questionResults: QuestionResult[],
    totalPoints: number,
    grade: string,
    percentage: number
  ) => {
    setStudentResults(prev => prev.map(result => {
      if (result.studentId === studentId) {
        return {
          ...result,
          points: totalPoints.toString(),
          grade,
          percentage,
          questionResults,
        };
      }
      return result;
    }));
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

  const selectedStudent = selectedStudentId 
    ? studentResults.find(r => r.studentId === selectedStudentId)
    : null;

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
          <h3 className="section-title">Скала за оценяване на този тест</h3>
          <div className="grade-scale">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
              <div className="grade-item poor bg-gray-200 p-3 rounded text-center border-2 border-gray-400">
                <div className="font-bold text-lg text-gray-800">2</div>
                <div className="text-gray-700">
                  <div className="font-medium">От {typeof test.gradeScale.grade2 === 'string' ? parseFloat(test.gradeScale.grade2) || 0 : test.gradeScale.grade2} до {(typeof test.gradeScale.grade3 === 'string' ? parseFloat(test.gradeScale.grade3) || 0 : test.gradeScale.grade3) - 0.5} точки</div>
                  <div className="text-xs text-gray-600">
                    {typeof test.gradeScale.grade2 === 'string' ? (parseFloat(test.gradeScale.grade2) || 0) : test.gradeScale.grade2} - {(typeof test.gradeScale.grade3 === 'string' ? parseFloat(test.gradeScale.grade3) || 0 : test.gradeScale.grade3) - 0.5}т
                  </div>
                </div>
              </div>
              <div className="grade-item satisfactory bg-orange-200 p-3 rounded text-center border-2 border-orange-400">
                <div className="font-bold text-lg text-orange-800">3</div>
                <div className="text-orange-800">
                  <div className="font-medium">От {typeof test.gradeScale.grade3 === 'string' ? parseFloat(test.gradeScale.grade3) || 0 : test.gradeScale.grade3} до {(typeof test.gradeScale.grade4 === 'string' ? parseFloat(test.gradeScale.grade4) || 0 : test.gradeScale.grade4) - 0.5} точки</div>
                  <div className="text-xs text-orange-700">
                    {typeof test.gradeScale.grade3 === 'string' ? (parseFloat(test.gradeScale.grade3) || 0) : test.gradeScale.grade3} - {(typeof test.gradeScale.grade4 === 'string' ? parseFloat(test.gradeScale.grade4) || 0 : test.gradeScale.grade4) - 0.5}т
                  </div>
                </div>
              </div>
              <div className="grade-item good bg-yellow-200 p-3 rounded text-center border-2 border-yellow-400">
                <div className="font-bold text-lg text-yellow-800">4</div>
                <div className="text-yellow-800">
                  <div className="font-medium">От {typeof test.gradeScale.grade4 === 'string' ? parseFloat(test.gradeScale.grade4) || 0 : test.gradeScale.grade4} до {(typeof test.gradeScale.grade5 === 'string' ? parseFloat(test.gradeScale.grade5) || 0 : test.gradeScale.grade5) - 0.5} точки</div>
                  <div className="text-xs text-yellow-700">
                    {typeof test.gradeScale.grade4 === 'string' ? (parseFloat(test.gradeScale.grade4) || 0) : test.gradeScale.grade4} - {(typeof test.gradeScale.grade5 === 'string' ? parseFloat(test.gradeScale.grade5) || 0 : test.gradeScale.grade5) - 0.5}т
                  </div>
                </div>
              </div>
              <div className="grade-item very-good bg-blue-200 p-3 rounded text-center border-2 border-blue-400">
                <div className="font-bold text-lg text-blue-800">5</div>
                <div className="text-blue-800">
                  <div className="font-medium">От {typeof test.gradeScale.grade5 === 'string' ? parseFloat(test.gradeScale.grade5) || 0 : test.gradeScale.grade5} до {(typeof test.gradeScale.grade6 === 'string' ? parseFloat(test.gradeScale.grade6) || 0 : test.gradeScale.grade6) - 0.5} точки</div>
                  <div className="text-xs text-blue-700">
                    {typeof test.gradeScale.grade5 === 'string' ? (parseFloat(test.gradeScale.grade5) || 0) : test.gradeScale.grade5} - {(typeof test.gradeScale.grade6 === 'string' ? parseFloat(test.gradeScale.grade6) || 0 : test.gradeScale.grade6) - 0.5}т
                  </div>
                </div>
              </div>
              <div className="grade-item excellent bg-green-200 p-3 rounded text-center border-2 border-green-400">
                <div className="font-bold text-lg text-green-800">6</div>
                <div className="text-green-800">
                  <div className="font-medium">От {typeof test.gradeScale.grade6 === 'string' ? parseFloat(test.gradeScale.grade6) || 0 : test.gradeScale.grade6} до {test.maxPoints} точки</div>
                  <div className="text-xs text-green-700">
                    {typeof test.gradeScale.grade6 === 'string' ? (parseFloat(test.gradeScale.grade6) || 0) : test.gradeScale.grade6} - {test.maxPoints}т
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="bulk-actions">
          <h3 className="section-title">Бързо попълване</h3>
          <div className="bulk-form">
            <div className="bulk-input-group">
              <label className="bulk-label">Точки:</label>
              <Input
                type="text"
                value={bulkPoints}
                onChange={(e) => setBulkPoints(e.target.value)}
                placeholder="0"
                onFocus={(e) => e.target.select()}
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
                  <th className="col-number">№ в клас</th>
                  <th className="col-name">Име</th>
                  <th className="col-middle">Презире</th>
                  <th className="col-last">Фамилия</th>
                  <th className="col-participation">Участие</th>
                  <th className="col-status">Статус</th>
                  <th className="col-points">Точки</th>
                  <th className="col-grade">Оценка</th>
                  <th className="col-percentage">%</th>
                  <th className="col-actions">Детайли</th>
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
                        {result.participated ? 'Участва' : 'НЕ участва'}
                      </Button>
                    </td>
                    <td className="col-status">
                      {result.participated && (
                        <button
                          onClick={() => handleCancelToggle(result.studentId)}
                          className={`text-xs py-1 px-2 rounded ${result.cancelled ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                          title={result.cancelReason || 'Анулиране на теста'}
                        >
                          {result.cancelled ? 'АНУЛИРАН' : 'Анулирай'}
                        </button>
                      )}
                      {result.cancelled && result.cancelReason && (
                        <div className="text-xs text-red-600 mt-1" title={result.cancelReason}>
                          {result.cancelReason.length > 15 ? result.cancelReason.substring(0, 15) + '...' : result.cancelReason}
                        </div>
                      )}
                    </td>
                    <td className="col-points">
                      <Input
                        type="text"
                        value={result.points}
                        onChange={(e) => handlePointsChange(result.studentId, e.target.value)}
                        placeholder="0"
                        onFocus={(e) => e.target.select()}
                        className={`points-input ${!result.participated || result.cancelled ? 'disabled opacity-50' : ''}`}
                        disabled={result.cancelled}
                      />
                    </td>
                    <td className="col-grade">
                      {result.cancelled ? (
                        <div className="grade-badge bg-red-100 text-red-800 line-through">
                          {result.grade || '—'}
                        </div>
                      ) : result.grade ? (
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
                    <td className="col-actions">
                      {test.questions && test.questions.length > 0 ? (
                        <Button
                          onClick={() => handleOpenDetailModal(result.studentId)}
                          variant="secondary"
                          className="text-xs py-1 px-2"
                          disabled={!result.participated || result.cancelled}
                        >
                          По въпроси
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
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

      {/* Detail Entry Modal */}
      {selectedStudent && (
        <QuestionResultsModal
          isOpen={detailModalOpen}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedStudentId(null);
          }}
          test={test}
          student={selectedStudent.student}
          initialQuestionResults={selectedStudent.questionResults}
          onSave={(questionResults, totalPoints, grade, percentage) => {
            handleSaveDetailedResults(
              selectedStudent.studentId,
              questionResults,
              totalPoints,
              grade,
              percentage
            );
          }}
        />
      )}
    </Modal>
  );
};
