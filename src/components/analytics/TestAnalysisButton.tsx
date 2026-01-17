import React, { useState } from 'react';
import { generateAIAnalysis } from '@/lib/api';

interface TestAnalysisButtonProps {
  testId: string;
  classId: string;
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
  onAnalysisGenerated,
  disabled = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('🚀 Започвам генериране на AI анализ...');
      console.log('testId:', testId);
      console.log('classId:', classId);
      
      const analysis = await generateAIAnalysis(testId, classId);
      
      console.log('✅ Получих анализ от API:', analysis);
      console.log('Тип на analysis:', typeof analysis);
      console.log('Ключове в analysis:', Object.keys(analysis));
      
      // Call callback with analysis
      onAnalysisGenerated(analysis);
      
      // Dispatch event за обновяване на историята
      window.dispatchEvent(new CustomEvent('ai-analysis-generated', {
        detail: { testId, analysis }
      }));
      
      console.log('✅ Извиках onAnalysisGenerated callback и изпратих събитие за обновяване');
      
    } catch (err) {
      console.error('❌ ГРЕШКА:', err);
      const errorMessage = err instanceof Error ? err.message : 'Неизвестна грешка при генериране на AI анализ';
      setError(errorMessage);
      console.error('Грешка при генериране на AI анализ:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const isButtonDisabled = disabled || isLoading;

  return (
    <button
      onClick={handleClick}
      disabled={isButtonDisabled}
      className={`
        px-4 py-2 rounded-lg font-medium transition-all duration-200
        bg-blue-600 text-white
        hover:bg-blue-700 active:bg-blue-800
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${error ? 'border-2 border-red-500' : ''}
      `}
      title={isButtonDisabled ? 'Моля изчакайте...' : 'Генерирай AI анализ на резултатите'}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <span className="animate-spin">⏳</span>
          <span>Генериране...</span>
        </span>
      ) : (
        'Генерирай AI анализ'
      )}
    </button>
  );
};
