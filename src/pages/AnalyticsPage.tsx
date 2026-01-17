import React, { useState, useMemo } from 'react';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { GenerateReportModal } from '../components/tests/GenerateReportModal';
import { AISettingsModal } from '../components/settings/AISettingsModal';
import { AIAnalysisHistory } from '../components/analytics/AIAnalysisHistory';
import { AIAnalysisModal } from '../components/tests/AIAnalysisModal';
import { useAppContext } from '../context/AppContext';
import type { Test } from '../types';
import './AnalyticsPage.css';

export const AnalyticsPage: React.FC = () => {
  const { classes, tests, results } = useAppContext();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [selectedAnalysisTestId, setSelectedAnalysisTestId] = useState<string | null>(null);
  const [selectedAnalysisTestName, setSelectedAnalysisTestName] = useState<string | null>(null);
  const [selectedAnalysisClassName, setSelectedAnalysisClassName] = useState<string | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  // Filter tests for selected class
  const classTests = useMemo(() => {
    if (!selectedClass) return [];
    return tests.filter(t => t.class === selectedClass);
  }, [selectedClass, tests]);

  // Filter tests that have results
  const testsWithResults = useMemo(() => {
    return classTests.filter(test => {
      const testResults = results.filter(r => r.testId === test.id);
      return testResults.length > 0;
    });
  }, [classTests, results, selectedClass, tests]);

  const classOptions = classes.map(cls => ({
    value: cls.name,
    label: cls.name,
  }));

  const testOptions = testsWithResults.map(test => ({
    value: test.id,
    label: `${test.name} (${new Date(test.date).toLocaleDateString('bg-BG')})`,
  }));
  

  const getClassId = (className: string): string | null => {
    const classRecord = classes.find(c => c.name === className);
    return classRecord?.id || null;
  };

  const handleClassChange = (className: string) => {
    setSelectedClass(className);
    setSelectedTest(null); // Reset test when class changes
  };

  return (
    <div className="analytics-page-container">
      {/* Header */}
      <div className="analytics-header">
        <h2>
          <span className="gradient-text">AI Анализ на тестове</span>
        </h2>
        <p>Генерирай автоматичен AI анализ на тестове с детайлни препоръки</p>
      </div>

      {/* Main Action Buttons */}
      <div className="analytics-main-button-container">
        <Button onClick={() => setShowFormModal(true)}>
          🤖 Генерирай AI анализ
        </Button>
        <Button onClick={() => setShowAISettings(true)} variant="secondary">
          ⚙️ AI Settings
        </Button>
      </div>

      {/* Features Section */}
      <div className="analytics-features-section">
        <h3 className="analytics-features-title">
          Включени функционалности
        </h3>
        
        <div className="analytics-features-grid">
          <div className="analytics-feature-item">
            <span>✅ Автоматичен AI анализ на тестове</span>
          </div>
          
          <div className="analytics-feature-item">
            <span>✅ Препоръки за пропуските от учениците</span>
          </div>
          
          <div className="analytics-feature-item">
            <span>✅ Интелигентен анализ на успеваемостта</span>
          </div>
          
          <div className="analytics-feature-item">
            <span>✅ AI препоръки за подобряване на резултатите</span>
          </div>
          
          <div className="analytics-feature-item">
            <span>✅ Автоматично генериране на Word отчети</span>
          </div>
          
          <div className="analytics-feature-item">
            <span>✅ Анализ на най-добрите и най-слабите резултати</span>
          </div>
        </div>
      </div>

      {/* AI Analysis History Section */}
      <div className="analytics-history-section" style={{ marginTop: '2rem' }}>
        <div className="analytics-history-header">
          <div className="analytics-history-icon">
            🤖
          </div>
          <div>
            <h3 className="analytics-history-title">
              AI Анализ на тестове
            </h3>
            <p className="analytics-history-subtitle">
              Преглед на всички генерирани AI анализи
            </p>
          </div>
        </div>
        <AIAnalysisHistory 
          onEntryClick={(entry) => {
            setSelectedAnalysisTestId(entry.testId);
            setSelectedAnalysisTestName(entry.testName);
            setSelectedAnalysisClassName(entry.className);
            setShowAnalysisModal(true);
          }}
        />
      </div>

      {/* Form Modal with all fields */}
      <Modal 
        isOpen={showFormModal} 
        onClose={() => {
          setShowFormModal(false);
          setSelectedClass('');
          setSelectedTest(null);
        }} 
        title="Генерирай AI анализ"
        size="lg"
      >
        <GenerateReportModal
          isOpen={true}
          onClose={() => {
            setShowFormModal(false);
            setSelectedClass('');
            setSelectedTest(null);
          }}
          test={selectedTest}
          classId={selectedClass ? getClassId(selectedClass) : null}
          showClassTestSelection={true}
          classOptions={classOptions}
          testOptions={testOptions}
          selectedClass={selectedClass}
          selectedTest={selectedTest}
          onClassChange={handleClassChange}
          onTestChange={(testId) => {
            const test = testsWithResults.find(t => t.id === testId);
            setSelectedTest(test || null);
          }}
          testsWithResultsLength={testsWithResults.length}
          getClassIdCallback={getClassId}
        />
      </Modal>

      {/* AI Settings Modal */}
      <AISettingsModal 
        isOpen={showAISettings} 
        onClose={() => setShowAISettings(false)} 
      />

      {/* AI Analysis Modal */}
      {selectedAnalysisTestId && (
        <AIAnalysisModal
          isOpen={showAnalysisModal}
          onClose={() => {
            setShowAnalysisModal(false);
            setSelectedAnalysisTestId(null);
            setSelectedAnalysisTestName(null);
            setSelectedAnalysisClassName(null);
          }}
          testId={selectedAnalysisTestId}
          testName={selectedAnalysisTestName || undefined}
          className={selectedAnalysisClassName || undefined}
        />
      )}
    </div>
  );
};
