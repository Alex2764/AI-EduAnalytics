import React, { useState } from 'react';
import { TestForm } from '../components/tests/TestForm';
import { TestList } from '../components/tests/TestList';
import { ResultsModal } from '../components/tests/ResultsModal';
import { TestAnalytics } from '../components/tests/TestAnalytics';

export const TestsPage: React.FC = () => {
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState('');

  const handleOpenResults = (testId: string) => {
    setSelectedTestId(testId);
    setShowResultsModal(true);
  };

  const handleShowAnalytics = (testId: string) => {
    setSelectedTestId(testId);
    setShowAnalyticsModal(true);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Управление на тестове</h2>
      
      <TestForm />
      
      <TestList 
        onOpenResults={handleOpenResults}
        onShowAnalytics={handleShowAnalytics}
      />

      {/* Results Modal */}
      <ResultsModal
        isOpen={showResultsModal}
        onClose={() => setShowResultsModal(false)}
        testId={selectedTestId}
      />

      {/* Analytics Modal */}
      <TestAnalytics
        isOpen={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
        testId={selectedTestId}
      />
    </div>
  );
};
