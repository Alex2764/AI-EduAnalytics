import React, { useEffect, useState } from 'react';
import { Button } from '../common/Button';
import { Table } from '../common/Table';
import { EditGradeScaleModal } from './EditGradeScaleModal';
import { AIAnalysisModal } from './AIAnalysisModal';
import { TestLinkModal } from './TestLinkModal';
import { SubmissionsReviewModal } from './SubmissionsReviewModal';
import { useAppContext } from '../../context/AppContext';
import { loadPendingSubmissionCounts } from '../../lib/submissionsApi';
import { formatDate } from '../../utils/dateFormatter';
import { logger } from '../../utils/logger';
import type { Test } from '../../types';

interface TestListProps {
  onOpenResults: (testId: string) => void;
  onShowAnalytics: (testId: string) => void;
}

export const TestList: React.FC<TestListProps> = ({ onOpenResults, onShowAnalytics }) => {
  const { tests, results, students, deleteTest } = useAppContext();
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [showEditScaleModal, setShowEditScaleModal] = useState(false);
  const [showAIAnalysisModal, setShowAIAnalysisModal] = useState(false);
  const [selectedTestForAI, setSelectedTestForAI] = useState<Test | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedTestForLink, setSelectedTestForLink] = useState<Test | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedTestForReview, setSelectedTestForReview] = useState<Test | null>(null);
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;

    const loadCounts = async () => {
      try {
        const counts = await loadPendingSubmissionCounts();
        if (!cancelled) {
          setPendingCounts(counts);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          logger.error('Error loading pending submission counts:', err);
        }
      }
    };

    loadCounts();

    return () => {
      cancelled = true;
    };
  }, [tests]);

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

  const handleOpenAIAnalysis = (test: Test) => {
    setSelectedTestForAI(test);
    setShowAIAnalysisModal(true);
  };

  const handleOpenLink = (test: Test) => {
    setSelectedTestForLink(test);
    setShowLinkModal(true);
  };

  const handleOpenReview = (test: Test) => {
    setSelectedTestForReview(test);
    setShowReviewModal(true);
  };

  const refreshPendingCounts = async () => {
    try {
      const counts = await loadPendingSubmissionCounts();
      setPendingCounts(counts);
    } catch (err: unknown) {
      logger.error('Error refreshing pending submission counts:', err);
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
    const isOnline = test.mode === 'online';
    const pendingCount = pendingCounts[test.id] ?? 0;

    return (
      <tr key={test.id} className="hover:bg-gray-50">
        <td className="px-6 py-4 text-sm text-gray-900">{index + 1}</td>
        <td className="px-6 py-4 text-sm font-medium text-gray-900">
          <div className="flex flex-wrap items-center gap-2">
            <span>{test.name}</span>
            {pendingCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 text-xs font-semibold">
                Чака преглед ({pendingCount})
              </span>
            )}
          </div>
        </td>
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
              {isOnline && pendingCount > 0 && (
                <Button
                  onClick={() => handleOpenReview(test)}
                  className="text-xs py-2 px-3 btn-warning"
                >
                  Чака преглед ({pendingCount})
                </Button>
              )}
              {isOnline && (
                <Button
                  onClick={() => handleOpenLink(test)}
                  className="text-xs py-2 px-3"
                  variant="secondary"
                >
                  Линк
                </Button>
              )}
              {hasResults ? (
                <>
                  <Button
                    onClick={() => onShowAnalytics(test.id)}
                    className="text-xs py-2 px-3 btn-primary-action"
                  >
                    Анализ
                  </Button>
                  <Button
                    onClick={() => handleOpenAIAnalysis(test)}
                    className="text-xs py-2 px-3"
                    variant="secondary"
                  >
                    AI Анализ
                  </Button>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Button
                      variant="danger"
                      onClick={() => handleDeleteTest(test.id)}
                      className="text-xs py-2 px-3 w-full"
                    >
                      Изтрий
                    </Button>
                  </div>
                </>
              ) : (
                <div style={{ gridColumn: '1 / -1' }}>
                  <Button
                    variant="danger"
                    onClick={() => handleDeleteTest(test.id)}
                    className="text-xs py-2 px-3 w-full"
                  >
                    Изтрий
                  </Button>
                </div>
              )}
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

      {/* AI Analysis Modal */}
      <AIAnalysisModal
        isOpen={showAIAnalysisModal}
        onClose={() => {
          setShowAIAnalysisModal(false);
          setSelectedTestForAI(null);
        }}
        testId={selectedTestForAI?.id || ''}
        testName={selectedTestForAI?.name}
        className={selectedTestForAI?.class}
      />

      {/* Online test link modal */}
      <TestLinkModal
        isOpen={showLinkModal}
        onClose={() => {
          setShowLinkModal(false);
          setSelectedTestForLink(null);
        }}
        test={selectedTestForLink}
      />

      <SubmissionsReviewModal
        isOpen={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          setSelectedTestForReview(null);
        }}
        test={selectedTestForReview}
        onFinalized={refreshPendingCounts}
      />
    </>
  );
};
