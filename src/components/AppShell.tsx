import React, { useState, useEffect } from 'react';
import { CheckSquare, Timer, Lightbulb, LogOut } from 'lucide-react';
import { TopBanner } from './TopBanner';
import { TopNav } from './TopNav';
import { Sidebar, type ModuleId } from './Sidebar';
import { MobileDrawer } from './MobileDrawer';
import { TodosTab } from '../pages/TodosTab';
import { IdeasTab } from '../pages/IdeasTab';
import { TimeTrackingTab } from '../pages/TimeTrackingTab';
import { AllocationsTab } from '../pages/AllocationsTab';
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
      const isValidSaved = savedTab && ['todos', 'ideas', 'time_tracking', 'allocations'].includes(savedTab);
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

  // Helper casts for passing visibility prop to tab components
  const TodosTabAny = TodosTab as React.FC<any>;
  const IdeasTabAny = IdeasTab as React.FC<any>;
  const TimeTrackingTabAny = TimeTrackingTab as React.FC<any>;
  const AllocationsTabAny = AllocationsTab as React.FC<any>;

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

  const openTimeTab = () => setActiveModule('time_tracking');

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
          <TopBanner onOpenTimeTab={openTimeTab} isOnTimeTab={activeModule === 'time_tracking'} />
          <main className="p-6">
            <div className={cn(activeModule === 'todos' ? 'block' : 'hidden')}>
              <TodosTabAny isVisible={activeModule === 'todos'} />
            </div>
            <div className={cn(activeModule === 'ideas' ? 'block' : 'hidden')}>
              <IdeasTabAny isVisible={activeModule === 'ideas'} />
            </div>
            <div className={cn(activeModule === 'time_tracking' ? 'block' : 'hidden')}>
              <TimeTrackingTabAny isVisible={activeModule === 'time_tracking'} />
            </div>
            <div className={cn(activeModule === 'allocations' ? 'block' : 'hidden')}>
              <AllocationsTabAny isVisible={activeModule === 'allocations'} />
            </div>
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
          <div className={cn(activeModule === 'todos' ? 'block' : 'hidden')}>
            <TodosTabAny isVisible={activeModule === 'todos'} />
          </div>
          <div className={cn(activeModule === 'ideas' ? 'block' : 'hidden')}>
            <IdeasTabAny isVisible={activeModule === 'ideas'} />
          </div>
          <div className={cn(activeModule === 'time_tracking' ? 'block' : 'hidden')}>
            <TimeTrackingTabAny isVisible={activeModule === 'time_tracking'} />
          </div>
          <div className={cn(activeModule === 'allocations' ? 'block' : 'hidden')}>
            <AllocationsTabAny isVisible={activeModule === 'allocations'} />
          </div>
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
