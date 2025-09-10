import React from 'react';
import { Menu } from 'lucide-react';
import { tokens } from '../theme/config';

interface TopNavProps {
  onHamburger: () => void;
  rightSlot?: React.ReactNode;
  mobileOpen?: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({ onHamburger, rightSlot, mobileOpen }) => {
  return (
    <nav className={tokens.topnav.base}>
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
          <span>Geronimo</span>
        </div>
      </div>
      {rightSlot && (
        <div className={tokens.topnav.right}>
          {rightSlot}
        </div>
      )}
    </nav>
  );
};
