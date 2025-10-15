import React from 'react';
import { Header } from './Header';
import { Navigation } from './Navigation';

type TabType = 'classes' | 'tests' | 'analytics';

interface LayoutProps {
  activeTab: TabType;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ activeTab, onTabChange, children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <Navigation activeTab={activeTab} onTabChange={onTabChange} />
      
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="bg-gray-800 text-white py-4 mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-gray-400">
            📊 Student Test Analysis System © 2025
          </p>
        </div>
      </footer>
    </div>
  );
};
