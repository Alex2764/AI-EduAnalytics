import { useState } from 'react';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/layout/Layout';
import { ClassesPage } from './pages/ClassesPage';
import { TestsPage } from './pages/TestsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';

type TabType = 'classes' | 'tests' | 'analytics';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('classes');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabType);
  };

  return (
    <AppProvider>
      <Layout activeTab={activeTab} onTabChange={handleTabChange}>
        {activeTab === 'classes' && <ClassesPage />}
        {activeTab === 'tests' && <TestsPage />}
        {activeTab === 'analytics' && <AnalyticsPage />}
      </Layout>
    </AppProvider>
  );
}

export default App;
