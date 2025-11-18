import React, { useState } from 'react';
import { Button } from '../common/Button';
import { Table } from '../common/Table';
import { EditGradeScaleModal } from './EditGradeScaleModal';
import { GenerateReportModal } from './GenerateReportModal';
import { useAppContext } from '../../context/AppContext';
import { formatDate } from '../../utils/dateFormatter';
import type { Test } from '../../types';

interface TestListProps {
  onOpenResults: (testId: string) => void;
  onShowAnalytics: (testId: string) => void;
}

export const TestList: React.FC<TestListProps> = ({ onOpenResults, onShowAnalytics }) => {
  const { tests, results, students, classes, deleteTest } = useAppContext();
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [showEditScaleModal, setShowEditScaleModal] = useState(false);
  const [showGenerateReportModal, setShowGenerateReportModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);

  const handleDeleteTest = async (testId: string) => {
    const test = tests.find(t => t.id === testId);
    if (!test) return;

    if (window.confirm(`Сигурни ли сте, че искате да изтриете теста "${test.name}"?`)) {
      try {
        await deleteTest(testId);
      } catch (err: any) {
        alert(err.message || 'Грешка при изтриване на тест!');
      }
    }
  };

  const handleEditScale = (test: Test) => {
    setEditingTest(test);
    setShowEditScaleModal(true);
  };

  const handleGenerateReport = (test: Test) => {
    setSelectedTest(test);
    setShowGenerateReportModal(true);
  };

  const getClassId = (className: string): string | null => {
    const classRecord = classes.find(c => c.name === className);
    return classRecord?.id || null;
  };

  const getTestStatistics = (test: Test) => {
    const testResults = results.filter(r => r.testId === test.id);
    const classStudents = students.filter(s => s.class === test.class);
    
    if (testResults.length === 0) {
      return {
        resultsCount: 0,
        totalStudents: classStudents.length,
        avgPoints: 0,
        avgPercentage: 0,
        avgGrade: '0.00',
      };
    }

    const avgPoints = testResults.reduce((sum, r) => sum + r.points, 0) / testResults.length;
    const avgPercentage = testResults.reduce((sum, r) => sum + r.percentage, 0) / testResults.length;
    const gradeValues = testResults.map(r => parseFloat(r.grade) || 0);
    const avgGrade = gradeValues.reduce((sum, g) => sum + g, 0) / gradeValues.length;

    return {
      resultsCount: testResults.length,
      totalStudents: classStudents.length,
      avgPoints: avgPoints.toFixed(1),
      avgPercentage: avgPercentage.toFixed(1),
      avgGrade: avgGrade.toFixed(2),
    };
  };

  const columns = [
    { key: 'index', label: '№ в клас' },
    { key: 'name', label: 'Име на тест' },
    { key: 'class', label: 'Клас' },
    { key: 'type', label: 'Тип' },
    { key: 'date', label: 'Дата' },
    { key: 'maxPoints', label: 'Макс. точки' },
    { key: 'actions', label: 'Действия' },
  ];

  const sortedTests = [...tests].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const renderRow = (test: Test, index: number) => {
    const stats = getTestStatistics(test);
    const hasResults = stats.resultsCount > 0;

    return (
      <tr key={test.id} className="hover:bg-gray-50">
        <td className="px-6 py-4 text-sm text-gray-900">{index + 1}</td>
        <td className="px-6 py-4 text-sm font-medium text-gray-900">{test.name}</td>
        <td className="px-6 py-4 text-sm text-gray-900">{test.class}</td>
        <td className="px-6 py-4 text-sm text-gray-900">{test.type}</td>
        <td className="px-6 py-4 text-sm text-gray-900">{formatDate(test.date)}</td>
        <td className="px-6 py-4 text-sm text-gray-900">{test.maxPoints}</td>
        <td className="px-6 py-4 text-sm text-gray-900">
          <div className="space-y-3">
            {/* Action Buttons - 2x2 Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', rowGap: '10px' }}>
              <Button
                onClick={() => onOpenResults(test.id)}
                className="text-xs py-2 px-3 btn-primary-action"
              >
                {hasResults ? 'Редактирай резултати' : 'Въведи резултати'}
              </Button>
              <Button
                onClick={() => handleEditScale(test)}
                className="text-xs py-2 px-3 btn-warning"
              >
                Скала
              </Button>
              {hasResults ? (
                <>
                  <Button
                    onClick={() => onShowAnalytics(test.id)}
                    className="text-xs py-2 px-3 btn-primary-action"
                  >
                    Анализ
                  </Button>
                  <Button
                    onClick={() => handleGenerateReport(test)}
                    className="text-xs py-2 px-3"
                    variant="secondary"
                  >
                    AI Анализ
                  </Button>
                </>
              ) : (
                <>
                  <div></div>
                  <Button
                    onClick={() => handleGenerateReport(test)}
                    className="text-xs py-2 px-3"
                    variant="secondary"
                    disabled={!hasResults}
                  >
                    AI Анализ
                  </Button>
                </>
              )}
              <Button
                variant="danger"
                onClick={() => handleDeleteTest(test.id)}
                className="text-xs py-2 px-3"
              >
                Изтрий
              </Button>
            </div>

            {/* Statistics */}
            {hasResults && (
              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                <div><strong>Резултати:</strong> {stats.resultsCount}/{stats.totalStudents} ученици</div>
                <div><strong>Средно:</strong> {stats.avgPoints}т/{test.maxPoints}т ({stats.avgPercentage}%)</div>
                <div><strong>Средна оценка:</strong> {stats.avgGrade}</div>
              </div>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <>
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 text-center">Създадени тестове</h3>
        <Table
          columns={columns}
          data={sortedTests}
          renderRow={renderRow}
          emptyMessage="Няма създадени тестове"
        />
      </div>

      {/* Edit Grade Scale Modal */}
      <EditGradeScaleModal
        isOpen={showEditScaleModal}
        onClose={() => {
          setShowEditScaleModal(false);
          setEditingTest(null);
        }}
        test={editingTest}
      />

      {/* Generate Report Modal */}
      <GenerateReportModal
        isOpen={showGenerateReportModal}
        onClose={() => {
          setShowGenerateReportModal(false);
          setSelectedTest(null);
        }}
        test={selectedTest}
        classId={selectedTest ? getClassId(selectedTest.class) : null}
      />
    </>
  );
};
