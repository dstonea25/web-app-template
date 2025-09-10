import React, { useState } from 'react';
import { CheckSquare, Timer } from 'lucide-react';
import { TopBanner } from './TopBanner';
import { TopNav } from './TopNav';
import { Sidebar, type ModuleId } from './Sidebar';
import { MobileDrawer } from './MobileDrawer';
import { TodosTab } from '../pages/TodosTab';
import { TimeTrackingTab } from '../pages/TimeTrackingTab';
import { tokens, cn } from '../theme/config';
import { ToastHost } from './notifications/ToastHost';

export const AppShell: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ModuleId>('todos');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const navigationItems = [
    { id: 'todos' as ModuleId, label: 'To-Dos', icon: <CheckSquare className={cn('w-5 h-5', tokens.icon?.default)} /> },
    { id: 'time_tracking' as ModuleId, label: 'Time Tracking', icon: <Timer className={cn('w-5 h-5', tokens.icon?.default)} /> },
  ];

  const renderActiveModule = () => {
    try {
      switch (activeModule) {
        case 'todos':
          return <TodosTab />;
        case 'time_tracking':
          return <TimeTrackingTab />;
        default:
          return <div>Default module</div>;
      }
    } catch (error) {
      console.error('Error rendering module:', error);
      return <div>Error loading module: {error instanceof Error ? error.message : String(error)}</div>;
    }
  };

  const handleModuleChange = (module: ModuleId) => {
    setActiveModule(module);
  };

  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleOpenMobileDrawer = () => {
    setMobileDrawerOpen(true);
  };

  const handleCloseMobileDrawer = () => {
    setMobileDrawerOpen(false);
  };

  return (
    <div className={cn('min-h-screen', tokens.palette.dark.bg)}>
      <ToastHost />
      {/* Desktop Layout */}
      <div className={cn(tokens.app_shell.grid, 'hidden sm:grid')}>
        <Sidebar
          items={navigationItems}
          activeModule={activeModule}
          collapsed={sidebarCollapsed}
          onModuleChange={handleModuleChange}
          onToggleCollapse={handleToggleSidebar}
        />
        <div className={tokens.app_shell.content}>
          <TopBanner />
          <main className="p-6">
            {renderActiveModule()}
          </main>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="sm:hidden">
        <TopNav onHamburger={handleOpenMobileDrawer} mobileOpen={mobileDrawerOpen} />
        <main className="p-4">
          {renderActiveModule()}
        </main>
        <MobileDrawer
          items={navigationItems}
          activeModule={activeModule}
          open={mobileDrawerOpen}
          onModuleChange={handleModuleChange}
          onClose={handleCloseMobileDrawer}
        />
      </div>
    </div>
  );
};
