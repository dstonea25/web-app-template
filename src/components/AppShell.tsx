import React, { useState, useEffect } from 'react';
import { CheckSquare, Timer, Lightbulb, LogOut } from 'lucide-react';
import { TopBanner } from './TopBanner';
import { TopNav } from './TopNav';
import { Sidebar, type ModuleId } from './Sidebar';
import { MobileDrawer } from './MobileDrawer';
import { TodosTab } from '../pages/TodosTab';
import { IdeasTab } from '../pages/IdeasTab';
import { TimeTrackingTab } from '../pages/TimeTrackingTab';
import { tokens, cn } from '../theme/config';
import { ToastHost } from './notifications/ToastHost';
import { TAB_REGISTRY } from '../config/tabs';
import { useAuth } from '../contexts/AuthContext';

export const AppShell: React.FC = () => {
  const { logout } = useAuth();
  const [activeModule, setActiveModule] = useState<ModuleId>(() => {
    try {
      const savedTab = localStorage.getItem('dashboard-active-tab');
      const enabledTabs = TAB_REGISTRY.filter(tab => tab.enabled).sort((a, b) => a.order - b.order);
      const firstEnabledId = (enabledTabs[0]?.id === 'time' ? 'time_tracking' : enabledTabs[0]?.id) as ModuleId | undefined;
      const isValidSaved = savedTab && ['todos', 'ideas', 'time_tracking'].includes(savedTab);
      return (isValidSaved ? (savedTab as ModuleId) : (firstEnabledId || 'todos')) as ModuleId;
    } catch {
      return 'todos';
    }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Save tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('dashboard-active-tab', activeModule);
  }, [activeModule]);

  // Map TAB_REGISTRY to navigation items, filtering enabled tabs and sorting by order
  const enabledTabs = TAB_REGISTRY.filter(tab => tab.enabled).sort((a, b) => a.order - b.order);
  
  const navigationItems = enabledTabs.map(tab => {
    const iconMap = {
      'check-square': <CheckSquare className={cn('w-5 h-5', tokens.icon?.default)} />,
      'lightbulb': <Lightbulb className={cn('w-5 h-5', tokens.icon?.default)} />,
      'timer': <Timer className={cn('w-5 h-5', tokens.icon?.default)} />
    };
    
    return {
      id: tab.id === 'time' ? 'time_tracking' : tab.id as ModuleId, // Map 'time' to 'time_tracking' for compatibility
      label: tab.title,
      icon: iconMap[tab.icon as keyof typeof iconMap]
    };
  });

  const renderActiveModule = () => {
    try {
      switch (activeModule) {
        case 'todos':
          return <TodosTab />;
        case 'ideas':
          return <IdeasTab />;
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

  const handleLogout = () => {
    logout();
  };

  const LogoutButton = () => (
    <button
      onClick={handleLogout}
      className={`${tokens.button.base} ${tokens.button.ghost} text-sm`}
      title="Sign out"
    >
      <LogOut className="w-4 h-4" />
      <span className="hidden sm:inline ml-2">Sign out</span>
    </button>
  );

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
        <TopNav 
          onHamburger={handleOpenMobileDrawer} 
          mobileOpen={mobileDrawerOpen}
          rightSlot={<LogoutButton />}
        />
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
