import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { tokens, cn } from '../theme/config';

export type ModuleId = 'home' | 'todos' | 'ideas' | 'priorities' | 'time_tracking' | 'allocations' | 'habit_tracker' | 'challenges' | 'calendar' | 'growth';

interface SidebarItem {
  id: ModuleId;
  label: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  items: SidebarItem[];
  activeModule: ModuleId;
  collapsed: boolean;
  onModuleChange: (module: ModuleId) => void;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  activeModule,
  collapsed,
  onModuleChange,
  onToggleCollapse,
}) => {
  return (
    <aside
      className={cn(
        tokens.sidebar.wrapper,
        tokens.sidebar.surface,
        collapsed ? tokens.sidebar.collapsed : tokens.sidebar.expanded
      )}
    >
      {/* Collapse Toggle */}
      <button
        onClick={onToggleCollapse}
        className={tokens.sidebar.collapse_toggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
      >
        {collapsed ? (
          <ChevronRight className={cn('w-3 h-3', tokens.icon?.default)} />
        ) : (
          <ChevronLeft className={cn('w-3 h-3', tokens.icon?.default)} />
        )}
      </button>

      {/* Navigation Items */}
      <nav className="flex-1 p-3">
        <ul className="space-y-1">
          {items.map((item) => {
            const isActive = activeModule === item.id;
            return (
              <li key={item.id}>
                <div className="relative group">
                  <button
                    onClick={() => onModuleChange(item.id)}
                    className={cn(
                      tokens.sidebar.item_base,
                      tokens.sidebar.item_hover,
                      isActive && tokens.sidebar.item_active,
                      'w-full text-left focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-neutral-950'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={collapsed ? item.label : undefined}
                  >
                    <span className={tokens.sidebar.icon}>
                      {item.icon}
                    </span>
                    {!collapsed && (
                      <span className={tokens.sidebar.label}>
                        {item.label}
                      </span>
                    )}
                  </button>
                  {collapsed && (
                    <div className={cn(tokens.sidebar.tooltip, 'invisible group-hover:visible group-focus-within:visible opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 z-50')}>
                      {item.label}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};
