import React, { useState, useEffect } from 'react';
import { Home, LayoutGrid, Layers, Settings, LogOut } from 'lucide-react';
import { TopBanner } from './TopBanner';
import { TopNav } from './TopNav';
import { Sidebar, type ModuleId } from './Sidebar';
import { MobileDrawer } from './MobileDrawer';
import { HomeTab } from '../pages/HomeTab';
import { ShowcaseTab } from '../pages/ShowcaseTab';
import { PatternsTab } from '../pages/PatternsTab';
import { SettingsTab } from '../pages/SettingsTab';
import { tokens, cn, theme, palette } from '../theme/config';
import { ToastHost } from './notifications/ToastHost';
import { TAB_REGISTRY } from '../config/tabs';
import { useAuth } from '../contexts/AuthContext';

export const AppShell: React.FC = () => {
  const { logout } = useAuth();
  
  // URL <-> module mapping helpers
  const normalizePath = (path: string) => path.replace(/\/+$/, '') || '/';
  
  const moduleToPath = (module: ModuleId): string => {
    if (module === 'home') return '/';
    const tab = TAB_REGISTRY.find(t => t.id === module);
    return tab?.route || '/';
  };
  
  const pathToModule = (pathname: string): ModuleId | null => {
    const clean = normalizePath(pathname);
    if (clean === '/' || clean === '/home') return 'home';
    const enabledTabs = TAB_REGISTRY.filter(tab => tab.enabled);
    for (const tab of enabledTabs) {
      if (normalizePath(tab.route) === clean) return tab.id as ModuleId;
    }
    return null;
  };

  const [activeModule, setActiveModule] = useState<ModuleId>(() => {
    try {
      const urlModule = pathToModule(typeof window !== 'undefined' ? window.location.pathname : '/');
      if (urlModule) return urlModule;
      const savedTab = localStorage.getItem('dashboard-active-tab');
      const enabledTabs = TAB_REGISTRY.filter(tab => tab.enabled).sort((a, b) => a.order - b.order);
      const firstEnabledId = enabledTabs[0]?.id as ModuleId | undefined;
      const validTabs = TAB_REGISTRY.map(t => t.id);
      const isValidSaved = savedTab && validTabs.includes(savedTab as any);
      return (isValidSaved ? (savedTab as ModuleId) : (firstEnabledId || 'home')) as ModuleId;
    } catch {
      return 'home';
    }
  });
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar-collapsed');
      return saved === 'true';
    } catch {
      return false;
    }
  });
  
  const [visitedTabs, setVisitedTabs] = useState<Set<ModuleId>>(() => new Set<ModuleId>([activeModule]));
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('dashboard-active-tab', activeModule);
  }, [activeModule]);

  useEffect(() => {
    try {
      const nextPath = moduleToPath(activeModule);
      if (typeof window !== 'undefined' && window.location.pathname !== nextPath) {
        window.history.pushState({ module: activeModule }, '', nextPath + window.location.search);
      }
    } catch {}
  }, [activeModule]);

  useEffect(() => {
    const onPop = () => {
      const mod = pathToModule(typeof window !== 'undefined' ? window.location.pathname : '/');
      if (mod && mod !== activeModule) {
        setActiveModule(mod);
        setVisitedTabs(prev => (prev.has(mod) ? prev : new Set(prev).add(mod)));
      }
    };
    if (typeof window !== 'undefined') window.addEventListener('popstate', onPop);
    return () => { if (typeof window !== 'undefined') window.removeEventListener('popstate', onPop); };
  }, [activeModule]);

  const enabledTabs = TAB_REGISTRY.filter(tab => tab.enabled).sort((a, b) => a.order - b.order);
  
  const iconMap: Record<string, React.ReactNode> = {
    'home': <Home className={tokens.icon.default} />,
    'layout-grid': <LayoutGrid className={tokens.icon.default} />,
    'layers': <Layers className={tokens.icon.default} />,
    'settings': <Settings className={tokens.icon.default} />,
  };
  
  const navigationItems = enabledTabs.map(tab => ({
    id: tab.id as ModuleId,
    label: tab.title,
    icon: iconMap[tab.icon] || <Home className={tokens.icon.default} />
  }));

  const handleModuleChange = (module: ModuleId) => {
    setActiveModule(module);
    setVisitedTabs(prev => {
      if (prev.has(module)) return prev;
      const next = new Set(prev);
      next.add(module);
      return next;
    });
    setMobileDrawerOpen(false);
  };

  const handleToggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const newValue = !prev;
      try {
        localStorage.setItem('sidebar-collapsed', String(newValue));
      } catch {}
      return newValue;
    });
  };

  const getCurrentTabTitle = (): string => {
    if (activeModule === 'home') {
      return `Welcome to ${theme.product_name}`;
    }
    const tab = TAB_REGISTRY.find(t => t.id === activeModule);
    return tab?.title || theme.product_name;
  };

  const getCurrentTabSubtitle = (): string => {
    const subtitles: Record<ModuleId, string> = {
      home: 'Your app dashboard',
      showcase: 'Explore available UI components',
      patterns: 'Live demos of UI patterns from scaffolds',
      settings: 'Profile, preferences, and account',
    };
    return subtitles[activeModule] || '';
  };

  const LogoutButton = () => (
    <button
      onClick={logout}
      className={cn(tokens.iconButton.base, tokens.iconButton.danger)}
      title="Sign out"
    >
      <LogOut className="w-5 h-5" />
    </button>
  );

  return (
    <div className={cn('h-screen overflow-hidden', palette.bg)}>
      <ToastHost />
      
      {/* Desktop Layout */}
      <div className={cn(tokens.app_shell.grid, 'hidden sm:grid h-full')}>
        <div className="relative z-30">
          <Sidebar
            items={navigationItems}
            activeModule={activeModule}
            collapsed={sidebarCollapsed}
            onModuleChange={handleModuleChange}
            onToggleCollapse={handleToggleSidebar}
          />
        </div>
        <div className={cn(tokens.app_shell.content, 'overflow-y-auto')}>
          <TopBanner 
            title={getCurrentTabTitle()} 
            subtitle={getCurrentTabSubtitle()} 
          />
          <main className="p-6">
            {visitedTabs.has('home') && (
              <section style={{ display: activeModule === 'home' ? 'block' : 'none' }}>
                <HomeTab isVisible={activeModule === 'home'} />
              </section>
            )}
            
            {visitedTabs.has('showcase') && (
              <section style={{ display: activeModule === 'showcase' ? 'block' : 'none' }}>
                <ShowcaseTab isVisible={activeModule === 'showcase'} />
              </section>
            )}
            
            {visitedTabs.has('patterns') && (
              <section style={{ display: activeModule === 'patterns' ? 'block' : 'none' }}>
                <PatternsTab isVisible={activeModule === 'patterns'} />
              </section>
            )}
            
            {visitedTabs.has('settings') && (
              <section style={{ display: activeModule === 'settings' ? 'block' : 'none' }}>
                <SettingsTab isVisible={activeModule === 'settings'} />
              </section>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="sm:hidden h-screen overflow-hidden flex flex-col">
        <TopNav 
          onHamburger={() => setMobileDrawerOpen(true)} 
          mobileOpen={mobileDrawerOpen}
          title={getCurrentTabTitle()}
          rightSlot={<LogoutButton />}
        />
        <main className="p-4 flex-1 overflow-y-auto">
          {visitedTabs.has('home') && (
            <section style={{ display: activeModule === 'home' ? 'block' : 'none' }}>
              <HomeTab isVisible={activeModule === 'home'} />
            </section>
          )}
          
          {visitedTabs.has('showcase') && (
            <section style={{ display: activeModule === 'showcase' ? 'block' : 'none' }}>
              <ShowcaseTab isVisible={activeModule === 'showcase'} />
            </section>
          )}
          
          {visitedTabs.has('patterns') && (
            <section style={{ display: activeModule === 'patterns' ? 'block' : 'none' }}>
              <PatternsTab isVisible={activeModule === 'patterns'} />
            </section>
          )}
          
          {visitedTabs.has('settings') && (
            <section style={{ display: activeModule === 'settings' ? 'block' : 'none' }}>
              <SettingsTab isVisible={activeModule === 'settings'} />
            </section>
          )}
        </main>
        <MobileDrawer
          items={navigationItems}
          activeModule={activeModule}
          open={mobileDrawerOpen}
          onModuleChange={handleModuleChange}
          onClose={() => setMobileDrawerOpen(false)}
        />
      </div>
    </div>
  );
};
