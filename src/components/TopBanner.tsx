import React, { useState } from 'react';
import { LogOut, Bug, Lightbulb } from 'lucide-react';
import { tokens, cn } from '../theme/config';
import { useAuth } from '../contexts/AuthContext';
import { HeaderTimerMini } from './HeaderTimerMini';
import WorkModeToggle from './WorkModeToggle';
import { BugReportModal } from './BugReportModal';
import { FeatureIdeaModal } from './FeatureIdeaModal';

interface TopBannerProps {
  title?: string;
  subtitle?: string;
  onOpenTimeTab?: () => void;
  isOnTimeTab?: boolean;
}

export const TopBanner: React.FC<TopBannerProps> = ({ 
  title = "Geronimo", 
  subtitle = "Your personal productivity app",
  onOpenTimeTab,
  isOnTimeTab = false
}) => {
  const { logout } = useAuth();
  const [isBugModalOpen, setIsBugModalOpen] = useState(false);
  const [isFeatureIdeaModalOpen, setIsFeatureIdeaModalOpen] = useState(false);

  const handleLogout = () => {
    logout();
  };

  return (
    <>
      <header className={cn('py-6 border-b', tokens.palette.dark.border)}>
        <div className={tokens.layout.container}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className={cn(tokens.typography.scale.h2, tokens.typography.weights.bold, tokens.palette.dark.text)}>
                {title}
              </h1>
              {subtitle && (
                <p className={cn(tokens.typography.scale.muted, 'mt-1', tokens.palette.dark.text_muted)}>
                  {subtitle}
                </p>
              )}
            </div>
            <div className="mt-4 sm:mt-0 flex items-center gap-4">
              <WorkModeToggle />
              {onOpenTimeTab && (
                <HeaderTimerMini onOpenTimeTab={onOpenTimeTab} isOnTimeTab={isOnTimeTab} />
              )}
              <button
                onClick={() => setIsFeatureIdeaModalOpen(true)}
                className="p-2 text-neutral-400 hover:text-yellow-400 hover:bg-neutral-800 rounded-lg transition-colors"
                title="Submit feature idea"
              >
                <Lightbulb className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsBugModalOpen(true)}
                className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors"
                title="Report a bug"
              >
                <Bug className="w-5 h-5" />
              </button>
              <button
                onClick={handleLogout}
                className={`${tokens.button.base} ${tokens.button.ghost} text-sm`}
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
                <span className="ml-2">Sign out</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      
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
