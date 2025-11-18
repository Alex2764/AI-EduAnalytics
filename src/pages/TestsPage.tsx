import React, { useState } from 'react';
import { TestForm } from '../components/tests/TestForm';
import { TestList } from '../components/tests/TestList';
import { ResultsModal } from '../components/tests/ResultsModal';
import { TestAnalytics } from '../components/tests/TestAnalytics';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import './TestsPage.css';

export const TestsPage: React.FC = () => {
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showTestFormModal, setShowTestFormModal] = useState(false);
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
    <div className="tests-page-container">
      <div className="tests-page-header">
        <div className="tests-page-header-content">
          <h2>Управление на тестове</h2>
          <p>Създаване и управление на тестове и резултати</p>
        </div>
        <Button onClick={() => setShowTestFormModal(true)} className="btn-success">
          + Създай нов тест
        </Button>
      </div>
      
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

      {/* Create Test Modal */}
      <Modal
        isOpen={showTestFormModal}
        onClose={() => setShowTestFormModal(false)}
        title="Създай нов тест"
        size="xl"
      >
        <TestForm onSuccess={() => setShowTestFormModal(false)} />
      </Modal>
    </div>
  );
};
