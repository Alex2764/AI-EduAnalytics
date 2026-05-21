import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/context/AppContext';
import { logger } from '@/utils/logger';

interface AIAnalysisEntry {
  testId: string;
  testName: string;
  className: string;
  generatedAt: string;
  hasAnalysis: boolean;
  averagePercentage?: number;
}

interface AIAnalysisHistoryProps {
  onEntryClick?: (entry: AIAnalysisEntry) => void;
}

export const AIAnalysisHistory: React.FC<AIAnalysisHistoryProps> = ({ onEntryClick }) => {
  const { tests, results } = useAppContext();
  const [analysisEntries, setAnalysisEntries] = useState<AIAnalysisEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshHistory = () => {
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    const handleAnalysisGenerated = () => {
      refreshHistory();
    };

    window.addEventListener('ai-analysis-generated', handleAnalysisGenerated);
    return () => {
      window.removeEventListener('ai-analysis-generated', handleAnalysisGenerated);
    };
  }, []);

  useEffect(() => {
    async function loadAnalysisHistory() {
      try {
        setLoading(true);

        const { data: allData, error: allError } = await supabase
          .from('test_analytics')
          .select('test_id, ai_generated_at, ai_analysis, updated_at');

        if (allError) {
          logger.error('Грешка при зареждане на история на AI анализи:', allError);
          setAnalysisEntries([]);
          setLoading(false);
          return;
        }

        const typedAllData = (allData || []) as Array<{
          test_id: string;
          ai_generated_at?: string | null;
          ai_analysis?: unknown;
          updated_at?: string | null;
        }>;

        const filteredData = typedAllData.filter(item => {
          const aiAnalysis = item.ai_analysis;
          return aiAnalysis &&
                 typeof aiAnalysis === 'object' &&
                 aiAnalysis !== null &&
                 Object.keys(aiAnalysis).length > 0;
        });

        if (!filteredData || filteredData.length === 0) {
          setAnalysisEntries([]);
          setLoading(false);
          return;
        }

        const entries: AIAnalysisEntry[] = [];

        for (const analyticsData of filteredData) {
          const testId = analyticsData.test_id;

          if (!testId) {
            continue;
          }

          const test = tests.find(t => t.id === testId);

          if (!test) {
            continue;
          }

          const aiAnalysis = analyticsData.ai_analysis;
          const hasAnalysis = aiAnalysis &&
            typeof aiAnalysis === 'object' &&
            aiAnalysis !== null &&
            Object.keys(aiAnalysis).length > 0;

          if (hasAnalysis) {
            const generatedAt = analyticsData.ai_generated_at ||
                               analyticsData.updated_at ||
                               new Date().toISOString();

            const testResults = results.filter(r => r.testId === testId);
            let averagePercentage = 0;
            if (testResults.length > 0) {
              const totalPercentage = testResults.reduce((sum, r) => sum + r.percentage, 0);
              averagePercentage = Math.round(totalPercentage / testResults.length);
            }

            entries.push({
              testId: testId,
              testName: test.name,
              className: test.class,
              generatedAt: generatedAt,
              hasAnalysis: true,
              averagePercentage: averagePercentage,
            });
          }
        }

        setAnalysisEntries(entries);
      } catch (err) {
        logger.error('Грешка при зареждане на история на анализи:', err);
        setAnalysisEntries([]);
      } finally {
        setLoading(false);
      }
    }

    if (tests.length > 0) {
      loadAnalysisHistory();
    }
  }, [tests, results, refreshKey]);

  const handleEntryClick = (entry: AIAnalysisEntry) => {
    if (onEntryClick) {
      onEntryClick(entry);
    }
  };

  const handleDeleteAnalysis = async (event: React.MouseEvent, entry: AIAnalysisEntry) => {
    event.stopPropagation();

    if (!window.confirm(`Сигурни ли сте, че искате да изтриете AI анализа за тест "${entry.testName}"?`)) {
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = supabase.from('test_analytics') as any;
      const { error } = await table
        .update({
          ai_analysis: null,
          ai_generated_at: null
        })
        .eq('test_id', entry.testId);

      if (error) {
        logger.error('Грешка при изтриване на анализ:', error);
        alert('Грешка при изтриване на анализа. Моля, опитайте отново.');
        return;
      }

      refreshHistory();
    } catch (err) {
      logger.error('Грешка при изтриване на анализ:', err);
      alert('Грешка при изтриване на анализа. Моля, опитайте отново.');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center gap-2 text-gray-500">
          <span className="animate-spin">⏳</span>
          <span>Зареждане на история...</span>
        </div>
      </div>
    );
  }

  if (analysisEntries.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <div className="inline-flex flex-col items-center gap-3 p-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 max-w-md mx-auto">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-3xl">🤖</span>
          </div>
          <div>
            <p className="text-gray-700 font-medium mb-1">
              Все още няма генерирани AI анализи
            </p>
            <p className="text-sm text-gray-500">
              Генерирайте първия анализ, за да се появи тук
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="analytics-history-list">
        {analysisEntries.map((entry) => (
          <div
            key={entry.testId}
            onClick={() => handleEntryClick(entry)}
            className="analytics-history-item"
          >
            <div className="analytics-history-item-left">
              <div className="analytics-history-item-icon">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>

              <div className="analytics-history-item-info">
                <h4>{entry.testName}</h4>
                <div className="analytics-history-item-meta">
                  <span>
                    <span className="dot"></span>
                    {entry.className}
                  </span>
                  <span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatDate(entry.generatedAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="analytics-history-item-right">
              <div className="analytics-history-score">
                <div className="analytics-history-score-value">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  {entry.averagePercentage || 0}%
                </div>
                <div className="analytics-history-score-label">Среден резултат</div>
              </div>

              <div className="analytics-history-status"></div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEntryClick(entry);
                }}
                className="analytics-btn-primary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                title="Отвори анализа"
                aria-label="Отвори анализа"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Виж
              </button>

              <button
                onClick={(e) => handleDeleteAnalysis(e, entry)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg p-2 transition-colors"
                title="Изтрий анализа"
                aria-label="Изтрий анализа"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
