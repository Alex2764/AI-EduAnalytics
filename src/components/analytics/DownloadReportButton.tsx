import React, { useState } from 'react';
import { generateReport } from '@/lib/api';

interface DownloadReportButtonProps {
  testId: string;
  classId: string;
  disabled?: boolean;
}

export const DownloadReportButton: React.FC<DownloadReportButtonProps> = ({
  testId,
  classId,
  disabled = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      await generateReport({
        testId,
        classId,
      });
      
      // Log success
      console.log('Word документ изтеглен успешно');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестна грешка при изтегляне на документ';
      setError(errorMessage);
      console.error('Грешка при изтегляне на Word документ:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const isButtonDisabled = disabled || isLoading;

  return (
    <div className="download-report-button-wrapper">
      <button
        onClick={handleClick}
        disabled={isButtonDisabled}
        className={`download-report-button ${error ? 'download-report-button-error' : ''}`}
        title={isButtonDisabled ? 'Моля изчакайте...' : 'Изтегли Word документ с анализа'}
      >
        {isLoading ? (
          <span className="download-report-button-content">
            <svg className="download-report-button-spinner" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Изтегляне...</span>
          </span>
        ) : (
          <span className="download-report-button-content">
            <svg className="download-report-button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>Изтегли Word документ</span>
          </span>
        )}
      </button>
      {error && (
        <div className="download-report-button-error-message">
          {error}
        </div>
      )}
    </div>
  );
};
