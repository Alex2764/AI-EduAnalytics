import { useState } from 'react';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/layout/Layout';
import { ClassesPage } from './pages/ClassesPage';
import { TestsPage } from './pages/TestsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AISettingsModal } from './components/settings/AISettingsModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';

type TabType = 'classes' | 'tests' | 'analytics';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('classes');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabType);
  };

  const handleOpenSettings = () => {
    setShowSettingsModal(true);
  };

  const handleCloseSettings = () => {
    setShowSettingsModal(false);
  };

  return (
    <ErrorBoundary>
      <AppProvider>
        <Layout activeTab={activeTab} onTabChange={handleTabChange} onOpenSettings={handleOpenSettings}>
          {activeTab === 'classes' && <ClassesPage />}
          {activeTab === 'tests' && <TestsPage />}
          {activeTab === 'analytics' && <AnalyticsPage />}
        </Layout>
        
        {/* AI Settings Modal */}
        <AISettingsModal isOpen={showSettingsModal} onClose={handleCloseSettings} />
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
