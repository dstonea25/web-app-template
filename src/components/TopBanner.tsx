import React from 'react';
import { LogOut } from 'lucide-react';
import { tokens, cn, theme, palette } from '../theme/config';
import { useAuth } from '../contexts/AuthContext';

interface TopBannerProps {
  title?: string;
  subtitle?: string;
  /** Optional slot for additional action buttons */
  rightSlot?: React.ReactNode;
}

export const TopBanner: React.FC<TopBannerProps> = ({ 
  title = theme.product_name, 
  subtitle = "Your app dashboard",
  rightSlot
}) => {
  const { logout } = useAuth();

  return (
    <header className={cn('py-6 border-b', palette.border)}>
      <div className={tokens.layout.container}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className={tokens.text.heading}>
              {title}
            </h1>
            {subtitle && (
              <p className={cn('mt-1', tokens.text.muted)}>
                {subtitle}
              </p>
            )}
          </div>
          <div className="mt-4 sm:mt-0 flex items-center gap-2">
            {rightSlot}
            <button
              onClick={logout}
              className={cn(tokens.iconButton.base, tokens.iconButton.danger)}
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
