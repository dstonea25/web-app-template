import React, { useState, useEffect } from 'react';
import { CheckSquare, Timer, Lightbulb, LogOut, Layers, Activity, Home } from 'lucide-react';
import { TopBanner } from './TopBanner';
import { TopNav } from './TopNav';
import { Sidebar, type ModuleId } from './Sidebar';
import { MobileDrawer } from './MobileDrawer';
import { TodosTab } from '../pages/TodosTab';
import { HomeTab } from '../pages/HomeTab';
import { IdeasTab } from '../pages/IdeasTab';
import { TimeTrackingTab } from '../pages/TimeTrackingTab';
import { AllocationsTab } from '../pages/AllocationsTab';
import { tokens, cn } from '../theme/config';
import { HabitTrackerTab } from '../pages/HabitTrackerTab';
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
      const isValidSaved = savedTab && ['home', 'todos', 'ideas', 'time_tracking', 'allocations', 'habit_tracker'].includes(savedTab);
      return (isValidSaved ? (savedTab as ModuleId) : (firstEnabledId || 'home')) as ModuleId;
    } catch {
      return 'home';
    }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [visitedTabs, setVisitedTabs] = useState<Set<ModuleId>>(() => new Set<ModuleId>([activeModule]));
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Save tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('dashboard-active-tab', activeModule);
  }, [activeModule]);

  // Map TAB_REGISTRY to navigation items, filtering enabled tabs and sorting by order
  const enabledTabs = TAB_REGISTRY.filter(tab => tab.enabled).sort((a, b) => a.order - b.order);
  
  const navigationItems = enabledTabs.map(tab => {
    const iconMap = {
      'home': <Home className={cn('w-5 h-5', tokens.icon?.default)} />,
      'check-square': <CheckSquare className={cn('w-5 h-5', tokens.icon?.default)} />,
      'lightbulb': <Lightbulb className={cn('w-5 h-5', tokens.icon?.default)} />,
      'timer': <Timer className={cn('w-5 h-5', tokens.icon?.default)} />,
      'layers': <Layers className={cn('w-5 h-5', tokens.icon?.default)} />,
      'activity': <Activity className={cn('w-5 h-5', tokens.icon?.default)} />
    };
    
    return {
      id: tab.id === 'time' ? 'time_tracking' : tab.id as ModuleId, // Map 'time' to 'time_tracking' for compatibility
      label: tab.title,
      icon: iconMap[tab.icon as keyof typeof iconMap]
    };
  });

  // Helper casts for passing visibility prop to tab components
  const TodosTabAny = TodosTab as React.FC<any>;
  const HomeTabAny = HomeTab as React.FC<any>;
  const IdeasTabAny = IdeasTab as React.FC<any>;
  const TimeTrackingTabAny = TimeTrackingTab as React.FC<any>;
  const AllocationsTabAny = AllocationsTab as React.FC<any>;
  const HabitTrackerTabAny = HabitTrackerTab as React.FC<any>;

  const handleModuleChange = (module: ModuleId) => {
    setActiveModule(module);
    setVisitedTabs(prev => {
      if (prev.has(module)) return prev;
      const next = new Set(prev);
      next.add(module);
      return next;
    });
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
            {visitedTabs.has('home') && (
              <section style={{ display: activeModule === 'home' ? 'block' : 'none' }}>
                <HomeTabAny isVisible={activeModule === 'home'} />
              </section>
            )}
            {visitedTabs.has('todos') && (
              <section style={{ display: activeModule === 'todos' ? 'block' : 'none' }}>
                <TodosTabAny isVisible={activeModule === 'todos'} />
              </section>
            )}
            {visitedTabs.has('ideas') && (
              <section style={{ display: activeModule === 'ideas' ? 'block' : 'none' }}>
                <IdeasTabAny isVisible={activeModule === 'ideas'} />
              </section>
            )}
            {visitedTabs.has('time_tracking') && (
              <section style={{ display: activeModule === 'time_tracking' ? 'block' : 'none' }}>
                <TimeTrackingTabAny isVisible={activeModule === 'time_tracking'} />
              </section>
            )}
            {visitedTabs.has('allocations') && (
              <section style={{ display: activeModule === 'allocations' ? 'block' : 'none' }}>
                <AllocationsTabAny isVisible={activeModule === 'allocations'} />
              </section>
            )}
            {visitedTabs.has('habit_tracker') && (
              <section style={{ display: activeModule === 'habit_tracker' ? 'block' : 'none' }}>
                <HabitTrackerTabAny isVisible={activeModule === 'habit_tracker'} />
              </section>
            )}
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
          {visitedTabs.has('home') && (
            <section style={{ display: activeModule === 'home' ? 'block' : 'none' }}>
              <HomeTabAny isVisible={activeModule === 'home'} />
            </section>
          )}
          {visitedTabs.has('todos') && (
            <section style={{ display: activeModule === 'todos' ? 'block' : 'none' }}>
              <TodosTabAny isVisible={activeModule === 'todos'} />
            </section>
          )}
          {visitedTabs.has('ideas') && (
            <section style={{ display: activeModule === 'ideas' ? 'block' : 'none' }}>
              <IdeasTabAny isVisible={activeModule === 'ideas'} />
            </section>
          )}
          {visitedTabs.has('time_tracking') && (
            <section style={{ display: activeModule === 'time_tracking' ? 'block' : 'none' }}>
              <TimeTrackingTabAny isVisible={activeModule === 'time_tracking'} />
            </section>
          )}
          {visitedTabs.has('allocations') && (
            <section style={{ display: activeModule === 'allocations' ? 'block' : 'none' }}>
              <AllocationsTabAny isVisible={activeModule === 'allocations'} />
            </section>
          )}
          {visitedTabs.has('habit_tracker') && (
            <section style={{ display: activeModule === 'habit_tracker' ? 'block' : 'none' }}>
              <HabitTrackerTabAny isVisible={activeModule === 'habit_tracker'} />
            </section>
          )}
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
