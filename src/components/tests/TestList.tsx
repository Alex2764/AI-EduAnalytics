import React from 'react';
import { Button } from '../common/Button';
import { Table } from '../common/Table';
import { useAppContext } from '../../context/AppContext';
import { formatDate } from '../../utils/dateFormatter';
import type { Test } from '../../types';

interface TestListProps {
  onOpenResults: (testId: string) => void;
  onShowAnalytics: (testId: string) => void;
}

export const TestList: React.FC<TestListProps> = ({ onOpenResults, onShowAnalytics }) => {
  const { tests, results, students, deleteTest } = useAppContext();

  const handleDeleteTest = (testId: string) => {
    const test = tests.find(t => t.id === testId);
    if (!test) return;

    if (window.confirm(`Сигурни ли сте, че искате да изтриете теста "${test.name}"?`)) {
      deleteTest(testId);
    }
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
    { key: 'index', label: '№' },
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
          <div className="space-y-2">
            {/* Action Buttons */}
            <div className="flex space-x-2">
              <Button
                onClick={() => onOpenResults(test.id)}
                className="text-xs py-1 px-3"
              >
                {hasResults ? 'Редактирай резултати' : 'Въведи резултати'}
              </Button>
              {hasResults && (
                <Button
                  onClick={() => onShowAnalytics(test.id)}
                  className="text-xs py-1 px-3 bg-purple-600 hover:bg-purple-700"
                >
                  Анализ
                </Button>
              )}
              <Button
                variant="danger"
                onClick={() => handleDeleteTest(test.id)}
                className="text-xs py-1 px-3"
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
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">Създадени тестове</h3>
      <Table
        columns={columns}
        data={sortedTests}
        renderRow={renderRow}
        emptyMessage="Няма създадени тестове"
      />
    </div>
  );
};
