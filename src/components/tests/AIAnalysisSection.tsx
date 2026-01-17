import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { TestAnalysisButton } from '@/components/analytics/TestAnalysisButton';
import { AnalysisDisplay } from '@/components/analytics/AnalysisDisplay';
import { DownloadReportButton } from '@/components/analytics/DownloadReportButton';
import { supabase } from '@/lib/supabase';

interface AIAnalysisSectionProps {
  testId: string;
  classId: string; // Име на класа (9А, 11Б)
}

export const AIAnalysisSection: React.FC<AIAnalysisSectionProps> = ({ testId, classId }) => {
  const { classes } = useAppContext();
  const [aiAnalysis, setAiAnalysis] = useState<any | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Намери UUID на класа
  const classData = classes.find(c => c.name === classId);
  const classUuid = classData?.id;

  // Зареди съществуващ анализ
  useEffect(() => {
    async function fetchAnalysis() {
      if (!testId) return;
      
      try {
        const { data, error } = await supabase
          .from('test_analytics')
          .select('lowest_results_analysis, highest_results_analysis, gaps_analysis, results_analysis, improvement_measures')
          .eq('test_id', testId)
          .maybeSingle();

        if (data && !error) {
          const analyticsData = data as unknown as {
            lowest_results_analysis: string | null;
            highest_results_analysis: string | null;
            gaps_analysis: string | null;
            results_analysis: string | null;
            improvement_measures: string | null;
          };

          setAiAnalysis({
            lowest_results_analysis: analyticsData.lowest_results_analysis || '',
            highest_results_analysis: analyticsData.highest_results_analysis || '',
            gaps_analysis: analyticsData.gaps_analysis || '',
            results_analysis: analyticsData.results_analysis || '',
            improvement_measures: analyticsData.improvement_measures || '',
          });
        }
      } catch (err) {
        console.error('Грешка при зареждане на AI анализ:', err);
      }
    }
    
    if (isExpanded) {
      fetchAnalysis();
    }
  }, [testId, isExpanded]);

  return (
    <div className="mt-3 border-t border-gray-200 pt-3">
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded"
      >
        <span>🤖 AI Анализ</span>
        <span>{isExpanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-3 p-4 bg-gray-50 rounded-lg space-y-4">
          {!aiAnalysis ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Генерирайте AI анализ на резултатите от теста.
              </p>
              {classUuid && (
                <TestAnalysisButton
                  testId={testId}
                  classId={classUuid}
                  onAnalysisGenerated={(analysis) => setAiAnalysis(analysis)}
                />
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <AnalysisDisplay analysis={aiAnalysis} />
              <div className="flex justify-end">
                {classUuid && (
                  <DownloadReportButton testId={testId} classId={classUuid} />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
