import React, { useState, useEffect } from 'react';
import { Button } from '../common/Button';
import { useAppContext } from '@/context/AppContext';
import { TestAnalysisButton } from '@/components/analytics/TestAnalysisButton';
import { AnalysisDisplay } from '@/components/analytics/AnalysisDisplay';
import { DownloadReportButton } from '@/components/analytics/DownloadReportButton';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import './AIAnalysisModal.css';

interface AIAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  testId: string;
  testName?: string;
  className?: string;
}

export const AIAnalysisModal: React.FC<AIAnalysisModalProps> = ({
  isOpen,
  onClose,
  testId,
  testName,
  className,
}) => {
  const { classes, tests } = useAppContext();
  const [aiAnalysis, setAiAnalysis] = useState<{
    lowest_results_analysis: string;
    highest_results_analysis: string;
    gaps_analysis: string;
    results_analysis: string;
    improvement_measures: string;
  } | null>(null);

  // Намери теста и класа
  const test = tests.find(t => t.id === testId);
  const classData = classes.find(c => c.name === (test?.class || className));
  const classUuid = classData?.id;

  // Управление на body scroll
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.setAttribute('data-scroll-y', scrollY.toString());
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
      const scrollY = document.body.getAttribute('data-scroll-y');
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY));
      }
      document.body.removeAttribute('data-scroll-y');
    }

    return () => {
      document.body.classList.remove('modal-open');
      const scrollY = document.body.getAttribute('data-scroll-y');
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY));
      }
      document.body.removeAttribute('data-scroll-y');
    };
  }, [isOpen]);

  // Зареди съществуващ анализ при отваряне на модала
  useEffect(() => {
    async function fetchAnalysis() {
      if (!testId || !isOpen) return;

      try {
        const { data, error } = await supabase
          .from('test_analytics')
          .select('ai_analysis')
          .eq('test_id', testId)
          .maybeSingle();

        if (data && !error) {
          const analyticsData = data as any;
          
          // Първо пробвай JSON полето ai_analysis (основен формат)
          if (analyticsData.ai_analysis && typeof analyticsData.ai_analysis === 'object') {
            const analysisObj = analyticsData.ai_analysis;
            setAiAnalysis({
              lowest_results_analysis: analysisObj.lowest_results_analysis || analysisObj.lowest_results || '',
              highest_results_analysis: analysisObj.highest_results_analysis || analysisObj.highest_results || '',
              gaps_analysis: analysisObj.gaps_analysis || analysisObj.gaps || '',
              results_analysis: analysisObj.results_analysis || analysisObj.results || '',
              improvement_measures: analysisObj.improvement_measures || analysisObj.improvements || '',
            });
          }
          // Fallback към отделни полета (ако съществуват в таблицата)
          else if (analyticsData.lowest_results_analysis || analyticsData.highest_results_analysis) {
            setAiAnalysis({
              lowest_results_analysis: analyticsData.lowest_results_analysis || '',
              highest_results_analysis: analyticsData.highest_results_analysis || '',
              gaps_analysis: analyticsData.gaps_analysis || '',
              results_analysis: analyticsData.results_analysis || '',
              improvement_measures: analyticsData.improvement_measures || '',
            });
          } else {
            setAiAnalysis(null);
          }
        } else {
          setAiAnalysis(null);
        }
      } catch (err) {
        logger.error('Грешка при зареждане на AI анализ:', err);
        setAiAnalysis(null);
      }
    }

    fetchAnalysis();
  }, [testId, isOpen]);

  // Функция за сваляне на текста от анализа като .txt файл
  const handleDownloadText = () => {
    if (!aiAnalysis) return;

    const separator = '='.repeat(50);
    const subSeparator = '-'.repeat(50);
    const dateStr = new Date().toLocaleString('bg-BG');
    
    const textContent = `AI Анализ на тест: ${testName || 'Неизвестен тест'}
${separator}

1. АНАЛИЗ НА НАЙ-НИСКИ РЕЗУЛТАТИ
${subSeparator}
${aiAnalysis.lowest_results_analysis}

2. АНАЛИЗ НА НАЙ-ВИСОКИ РЕЗУЛТАТИ
${subSeparator}
${aiAnalysis.highest_results_analysis}

3. АНАЛИЗ НА ПРОПУСКИ В ЗНАНИЯТА
${subSeparator}
${aiAnalysis.gaps_analysis}

4. АНАЛИЗ НА РЕЗУЛТАТИТЕ
${subSeparator}
${aiAnalysis.results_analysis}

5. МЕРКИ ЗА ПОДОБРЕНИЕ
${subSeparator}
${aiAnalysis.improvement_measures}

${separator}
Генерирано на: ${dateStr}
`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AI_Analiz_${testName || testId}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="ai-analysis-modal-overlay" onClick={onClose}>
      <div 
        className="ai-analysis-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ai-analysis-modal-header">
          <div className="ai-analysis-modal-header-content">
            <div className="ai-analysis-modal-icon">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="ai-analysis-modal-title-section">
              <h2 className="ai-analysis-modal-title">
                AI Анализ на тест
              </h2>
              {testName && (
                <p className="ai-analysis-modal-subtitle">{testName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ai-analysis-modal-close"
            title="Затвори"
          >
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="ai-analysis-modal-body">
          {!aiAnalysis ? (
            <div className="ai-analysis-modal-empty">
              <div className="ai-analysis-modal-empty-icon">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="ai-analysis-modal-empty-title">
                Генерирайте AI анализ
              </h3>
              <p className="ai-analysis-modal-empty-text">
                Генерирайте AI анализ на резултатите от теста за да видите детайлни препоръки и анализи.
              </p>
              {classUuid ? (
                <div className="ai-analysis-modal-empty-action">
                  <TestAnalysisButton
                    testId={testId}
                    classId={classUuid}
                    onAnalysisGenerated={(analysis) => {
                      setAiAnalysis(analysis);
                      // Dispatch event за обновяване на историята
                      window.dispatchEvent(new CustomEvent('ai-analysis-generated', {
                        detail: { testId, analysis }
                      }));
                    }}
                  />
                </div>
              ) : (
                <div className="ai-analysis-modal-error">
                  <p>Грешка: Не е намерен клас за този тест.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="ai-analysis-modal-content">
              <AnalysisDisplay analysis={aiAnalysis} />
              
              <div className="ai-analysis-modal-footer">
                <Button
                  onClick={handleDownloadText}
                  variant="secondary"
                  className="ai-analysis-modal-download-btn"
                >
                  <span>📄</span>
                  <span>Свали като .txt</span>
                </Button>
                
                {classUuid && (
                  <DownloadReportButton testId={testId} classId={classUuid} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
