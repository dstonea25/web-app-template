import React from 'react';
import { LogOut } from 'lucide-react';
import { tokens, cn } from '../theme/config';
import { useAuth } from '../contexts/AuthContext';

interface TopBannerProps {
  title?: string;
  subtitle?: string;
}

export const TopBanner: React.FC<TopBannerProps> = ({ 
  title = "Geronimo", 
  subtitle = "Your personal productivity app" 
}) => {
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
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
          <div className="mt-4 sm:mt-0">
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
  );
};
