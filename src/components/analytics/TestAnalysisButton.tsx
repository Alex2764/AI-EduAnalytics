import React, { useState } from 'react';
import { generateAIAnalysis } from '@/lib/api';
import { logger } from '@/utils/logger';
import { isAllGeminiKeysExhausted, isGeminiMinuteLimit, isGeminiQuotaError } from '@/utils/errorHandler';
import { QuotaExhaustedModal } from './QuotaExhaustedModal';

interface TestAnalysisButtonProps {
  testId: string;
  classId: string;
  /** When true, user must confirm before calling Gemini (costs API quota). */
  hasExistingAnalysis?: boolean;
  onAnalysisGenerated: (analysis: {
    lowest_results_analysis: string;
    highest_results_analysis: string;
    gaps_analysis: string;
    results_analysis: string;
    improvement_measures: string;
  }) => void;
  disabled?: boolean;
}

export const TestAnalysisButton: React.FC<TestAnalysisButtonProps> = ({
  testId,
  classId,
  hasExistingAnalysis = false,
  onAnalysisGenerated,
  disabled = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQuotaModal, setShowQuotaModal] = useState(false);

  const handleClick = async () => {
    if (disabled || isLoading) return;

    const force = hasExistingAnalysis
      ? window.confirm(
          'Прегенериране ще използва Gemini API отново (токени/квота). Продължавате ли?',
        )
      : false;
    if (hasExistingAnalysis && !force) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const analysis = await generateAIAnalysis(testId, classId, { force });
      onAnalysisGenerated(analysis);

      window.dispatchEvent(new CustomEvent('ai-analysis-generated', {
        detail: { testId, analysis }
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестна грешка при генериране на AI анализ';
      if (isAllGeminiKeysExhausted(errorMessage)) {
        setShowQuotaModal(true);
        setError(null);
      } else {
        setError(errorMessage);
      }
      logger.error('Грешка при генериране на AI анализ:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const isButtonDisabled = disabled || isLoading;
  const isMinuteLimit = error ? isGeminiMinuteLimit(error) : false;
  const isQuotaError = error ? isGeminiQuotaError(error) && !isMinuteLimit : false;

  const openAiSettings = () => {
    window.dispatchEvent(new CustomEvent('open-ai-settings'));
  };

  return (
    <>
    <QuotaExhaustedModal
      isOpen={showQuotaModal}
      onClose={() => setShowQuotaModal(false)}
    />
    <div className="flex flex-col items-center gap-3 w-full max-w-lg">
      <button
        onClick={handleClick}
        disabled={isButtonDisabled}
        className={`
          px-4 py-2 rounded-lg font-medium transition-all duration-200
          bg-blue-600 text-white
          hover:bg-blue-700 active:bg-blue-800
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        `}
        title={isButtonDisabled ? 'Моля изчакайте...' : 'Генерирай AI анализ на резултатите'}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin">⏳</span>
            <span>Генериране...</span>
          </span>
        ) : hasExistingAnalysis ? (
          'Прегенерирай AI анализ'
        ) : (
          'Генерирай AI анализ'
        )}
      </button>

      {error && (
        <div
          className={`w-full text-left px-4 py-3 rounded-lg text-sm ${
            isQuotaError
              ? 'bg-amber-50 border border-amber-200 text-amber-900'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
          role="alert"
        >
          <p className="font-medium mb-1">
            {isQuotaError ? 'Ограничение на Gemini API квотата' : 'Грешка при генериране'}
          </p>
          <p>{error}</p>
          {isQuotaError && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={openAiSettings}
                className="px-3 py-1.5 rounded-md bg-amber-700 text-white text-sm font-medium hover:bg-amber-800"
              >
                Отвори AI настройки (нов API ключ)
              </button>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-amber-800 underline hover:text-amber-900"
              >
                Създай ключ в Google AI Studio
              </a>
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
};
