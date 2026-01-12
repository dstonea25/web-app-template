import React, { useState } from 'react';
import { Menu, Bug, Lightbulb } from 'lucide-react';
import { tokens } from '../theme/config';
import { BugReportModal } from './BugReportModal';
import { FeatureIdeaModal } from './FeatureIdeaModal';

interface TopNavProps {
  onHamburger: () => void;
  rightSlot?: React.ReactNode;
  mobileOpen?: boolean;
  title?: string;
}

export const TopNav: React.FC<TopNavProps> = ({ onHamburger, rightSlot, mobileOpen, title = 'Geronimo' }) => {
  const [isBugModalOpen, setIsBugModalOpen] = useState(false);
  const [isFeatureIdeaModalOpen, setIsFeatureIdeaModalOpen] = useState(false);

  return (
    <>
      <nav className={`${tokens.topnav.base} overflow-x-hidden`}>
        <div className="flex items-center gap-3">
          <button
            onClick={onHamburger}
            className={tokens.topnav.burger}
            aria-label="Open navigation menu"
            aria-expanded={!!mobileOpen}
            aria-controls="mobile-drawer"
          >
            <Menu className={tokens.icon?.default || 'w-5 h-5 text-neutral-100'} />
          </button>
          <div className={tokens.topnav.brand}>
            <span>{title}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFeatureIdeaModalOpen(true)}
            className="p-2 text-neutral-400 hover:text-yellow-400 hover:bg-neutral-800 rounded-lg transition-colors"
            aria-label="Submit feature idea"
            title="Submit feature idea"
          >
            <Lightbulb className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsBugModalOpen(true)}
            className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors"
            aria-label="Report a bug"
            title="Report a bug"
          >
            <Bug className="w-5 h-5" />
          </button>
          {rightSlot && (
            <div className={tokens.topnav.right}>
              {rightSlot}
            </div>
          )}
        </div>
      </nav>
      
      <BugReportModal 
        isOpen={isBugModalOpen} 
        onClose={() => setIsBugModalOpen(false)} 
      />
      <FeatureIdeaModal 
        isOpen={isFeatureIdeaModalOpen} 
        onClose={() => setIsFeatureIdeaModalOpen(false)} 
      />
    </>
  );
};
