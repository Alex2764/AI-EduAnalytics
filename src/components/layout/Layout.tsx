import React from 'react';
import { Header } from './Header';
import { ParticlesBackground } from '../common/ParticlesBackground';

type TabType = 'classes' | 'tests' | 'analytics';

interface LayoutProps {
  activeTab: TabType;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
  onOpenSettings?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ activeTab, onTabChange, children, onOpenSettings }) => {
  return (
    <div className="min-h-screen" style={{ position: 'relative', background: 'transparent', overflowX: 'hidden' }}>
      <ParticlesBackground />
      <div style={{ position: 'relative', zIndex: 1, overflowX: 'hidden' }}>
        <Header activeTab={activeTab} onTabChange={onTabChange} onOpenSettings={onOpenSettings} />
        
        <main className="container mx-auto px-4 py-8" style={{ overflowX: 'hidden' }}>
          {children}
        </main>
      </div>

      <footer className="footer-header-style">
        <div className="container mx-auto px-4">
          <div className="footer-wrapper">
            <div className="footer-brand">
              <span className="footer-title">GradeForgeAI</span>
              <p className="footer-tagline">Система за управление на ученици и тестове</p>
            </div>
            <div className="footer-copyright">
              <p>© 2025 GradeForgeAI</p>
              <p className="footer-rights">Всички права запазени</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
