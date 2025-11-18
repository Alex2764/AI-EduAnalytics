import React from 'react';
import { Navigation } from './Navigation';
import { Button } from '../common/Button';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, onOpenSettings }) => {
  return (
    <header className="header">
      <img src="/logo.png" alt="GradeForgeAI Logo" className="header-logo" />
      <Navigation activeTab={activeTab} onTabChange={onTabChange} />
      {onOpenSettings && (
        <Button
          onClick={onOpenSettings}
          variant="secondary"
          className="ml-4"
          title="AI Settings"
        >
          ⚙️ Settings
        </Button>
      )}
    </header>
  );
};
