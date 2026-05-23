import { useState, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/layout/Layout';
import { ClassesPage } from './pages/ClassesPage';
import { TestsPage } from './pages/TestsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { TakeTestPage } from './pages/TakeTestPage';
import { AISettingsModal } from './components/settings/AISettingsModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';

type TabType = 'classes' | 'tests' | 'analytics';

/** Legacy share links: /take?token=... → /take/:token */
function TakeTestLegacyRedirect() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim();
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return <Navigate to={`/take/${encodeURIComponent(token)}`} replace />;
}

function TeacherApp() {
  const [activeTab, setActiveTab] = useState<TabType>('classes');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabType);
  };

  useEffect(() => {
    const openSettings = () => setShowSettingsModal(true);
    window.addEventListener('open-ai-settings', openSettings);
    return () => window.removeEventListener('open-ai-settings', openSettings);
  }, []);

  return (
    <AppProvider>
      <Layout activeTab={activeTab} onTabChange={handleTabChange} onOpenSettings={() => setShowSettingsModal(true)}>
        {activeTab === 'classes' && <ClassesPage />}
        {activeTab === 'tests' && <TestsPage />}
        {activeTab === 'analytics' && <AnalyticsPage />}
      </Layout>
      <AISettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
    </AppProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/take" element={<TakeTestLegacyRedirect />} />
      <Route path="/take/:token" element={<TakeTestPage />} />
      <Route path="/*" element={<TeacherApp />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
