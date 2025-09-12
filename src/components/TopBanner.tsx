import React from 'react';
import { tokens, cn } from '../theme/config';

interface TopBannerProps {
  title?: string;
  subtitle?: string;
}

export const TopBanner: React.FC<TopBannerProps> = ({ 
  title = "Geronimo", 
  subtitle = "Your personal productivity app" 
}) => {
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
        </div>
      </div>
    </header>
  );
};
