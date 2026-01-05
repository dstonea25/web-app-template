import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Todo, Okr, MonthTheme, MonthThemeInput, YearTheme, YearThemeInput } from '../types';
import { tokens, cn } from '../theme/config';
import { HomeTodosTable } from '../components/HomeTodosTable';
import { OKRModule } from '../components/okrs/OKRModule';
import { QuarterlySetupModal } from '../components/okrs/QuarterlySetupModal';
import { DailyIntentionsModule } from '../components/intentions/DailyIntentionsModule';
import { SessionTimerInline } from '../components/intentions/SessionTimerInline';
import { CommittedPrioritiesModule } from '../components/CommittedPrioritiesModule';
import UpcomingCalendarModule, { type UpcomingCalendarModuleRef } from '../components/UpcomingCalendarModule';
import { StorageManager, stageComplete, getStagedChanges, getCachedData, setCachedData, applyStagedChangesToTodos, getWorkingTodos } from '../lib/storage';
import { fetchTodosFromWebhook, saveTodosBatchToWebhook } from '../lib/api';
import { useWorkMode } from '../contexts/WorkModeContext';
import { fetchCurrentOrRecentOkrs, getNextQuarter, createQuarterOKRs } from '../lib/okrs';
import { Sparkles, ChevronRight, Target, X, Trophy } from 'lucide-react';
import { apiClient } from '../lib/api';
import { toast } from '../lib/notifications/toast';

export const HomeTab: React.FC<{ isVisible?: boolean }> = ({ isVisible = true }) => {
  const { workMode } = useWorkMode();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [/* filter */, /* setFilter */] = useState('');
  const [sortBy, setSortBy] = useState<keyof Todo | ''>('priority');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [/* editingId */, /* setEditingId */] = useState<string | null>(null);
  const [stagedCount, setStagedCount] = useState<number>(0);
  const hasLoadedRef = useRef(false);
  
  // OKR quarter management
  const [currentQuarter, setCurrentQuarter] = useState<string | null>(null);
  const [nextQuarter, setNextQuarter] = useState<{ quarter: string; start_date: string; end_date: string } | null>(null);
  const [previousOkrs, setPreviousOkrs] = useState<Okr[]>([]);
  const [showQuarterlySetup, setShowQuarterlySetup] = useState(false);
  const [okrsKey, setOkrsKey] = useState(0); // Force OKR module refresh
  const [isPastQuarter, setIsPastQuarter] = useState(false);
  const [quarterInfo, setQuarterInfo] = useState<{ quarter: string; start_date: string; end_date: string } | null>(null);
  
  // Section visibility state
  const [sectionsVisible, setSectionsVisible] = useState({
    dailyIntentions: true,
    upcomingCalendar: true,
    committedPriorities: true,
    importantTasks: true,
    okrs: true,
  });
  
  // Calendar quick add state
  const [calendarNlInput, setCalendarNlInput] = useState('');
  const calendarModuleRef = useRef<UpcomingCalendarModuleRef>(null);
  
  // Month theme state
  const [currentMonthTheme, setCurrentMonthTheme] = useState<MonthTheme | null>(null);
  const [showMonthThemeEditor, setShowMonthThemeEditor] = useState(false);
  const [monthThemeForm, setMonthThemeForm] = useState<{
    theme: string;
    focusAreas: string[];
    nonFocusAreas: string[];
  }>({ theme: '', focusAreas: ['', '', ''], nonFocusAreas: ['', ''] });
  
  // Year theme state
  const [currentYearTheme, setCurrentYearTheme] = useState<YearTheme | null>(null);
  const [showYearThemeEditor, setShowYearThemeEditor] = useState(false);
  const [yearThemeForm, setYearThemeForm] = useState<{
    theme: string;
    focusAreas: string[];
    nonFocusAreas: string[];
  }>({ theme: '', focusAreas: ['', '', ''], nonFocusAreas: ['', ''] });
  
  const toggleSection = (section: keyof typeof sectionsVisible) => {
    setSectionsVisible(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  useEffect(() => {
    if (!isVisible || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadTodos();
    loadQuarterInfo();
    loadCurrentMonthTheme();
    loadCurrentYearTheme();
  }, [isVisible]);

  const loadQuarterInfo = async () => {
    try {
      const { okrs, isPastQuarter: isPast, quarterInfo: info } = await fetchCurrentOrRecentOkrs();
      
      console.log('[HomeTab] Quarter Info:', { isPast, quarterInfo: info, okrsCount: okrs.length });
      
      setIsPastQuarter(isPast);
      setQuarterInfo(info);
      
      if (okrs.length > 0) {
        const quarter = okrs[0].quarter;
        setCurrentQuarter(quarter || null);
        setPreviousOkrs(okrs);
      }
      
      const next = await getNextQuarter();
      console.log('[HomeTab] Next Quarter:', next);
      setNextQuarter(next);
    } catch (error) {
      console.error('Failed to load quarter info:', error);
    }
  };

  const loadCurrentMonthTheme = async () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1; // 1-12 (getMonth returns 0-11, so add 1)
      
      // Fetch all themes for the current year
      const themes = await apiClient.fetchMonthThemesForYear(year);
      
      // Find the theme for the current month
      const theme = themes.find(t => t.month === month) || null;
      
      setCurrentMonthTheme(theme);
    } catch (error) {
      console.error('Failed to load month theme:', error);
    }
  };

  const loadCurrentYearTheme = async () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const theme = await apiClient.fetchYearTheme(year);
      setCurrentYearTheme(theme);
    } catch (error) {
      console.error('Failed to load year theme:', error);
    }
  };

  const openMonthThemeEditor = () => {
    const theme = currentMonthTheme;
    setMonthThemeForm({
      theme: theme?.theme || '',
      focusAreas: theme?.focus_areas?.length ? [...theme.focus_areas] : ['', '', ''],
      nonFocusAreas: theme?.non_focus_areas?.length ? [...theme.non_focus_areas] : ['', ''],
    });
    setShowMonthThemeEditor(true);
  };

  const handleSaveMonthTheme = async () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      
      const input: MonthThemeInput = {
        year,
        month,
        theme: monthThemeForm.theme.trim() || null,
        focus_areas: monthThemeForm.focusAreas.filter(a => a.trim()),
        non_focus_areas: monthThemeForm.nonFocusAreas.filter(a => a.trim()),
      };
      
      const saved = await apiClient.upsertMonthTheme(input);
      setCurrentMonthTheme(saved);
      setShowMonthThemeEditor(false);
      toast.success('Month theme saved');
    } catch (error) {
      console.error('Failed to save month theme:', error);
      toast.error('Failed to save theme');
    }
  };

  const openYearThemeEditor = () => {
    const theme = currentYearTheme;
    setYearThemeForm({
      theme: theme?.theme || '',
      focusAreas: theme?.focus_areas?.length ? [...theme.focus_areas] : ['', '', ''],
      nonFocusAreas: theme?.non_focus_areas?.length ? [...theme.non_focus_areas] : ['', ''],
    });
    setShowYearThemeEditor(true);
  };

  const handleSaveYearTheme = async () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      
      const input: YearThemeInput = {
        year,
        theme: yearThemeForm.theme.trim() || null,
        focus_areas: yearThemeForm.focusAreas.filter(a => a.trim()),
        non_focus_areas: yearThemeForm.nonFocusAreas.filter(a => a.trim()),
      };
      
      const saved = await apiClient.upsertYearTheme(input);
      setCurrentYearTheme(saved);
      setShowYearThemeEditor(false);
      toast.success('Year theme saved');
    } catch (error) {
      console.error('Failed to save year theme:', error);
      toast.error('Failed to save theme');
    }
  };

  const handleCreateQuarterOKRs = async (okrsData: any[]) => {
    if (!nextQuarter) return;
    try {
      await createQuarterOKRs(
        nextQuarter.quarter,
        nextQuarter.start_date,
        nextQuarter.end_date,
        okrsData
      );
      // Refresh
      await loadQuarterInfo();
      setOkrsKey(prev => prev + 1); // Force OKR module refresh
      setShowQuarterlySetup(false);
    } catch (error) {
      console.error('Failed to create quarterly OKRs:', error);
      throw error;
    }
  };

  // Cross-tab sync: refresh when storage broadcasts updates
  useEffect(() => {
    const handler = () => {
      const working = getWorkingTodos();
      setTodos(working);
    };
    window.addEventListener('dashboard:todos-updated', handler as any);
    return () => window.removeEventListener('dashboard:todos-updated', handler as any);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (stagedCount > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [stagedCount]);

  // Listen for important updates from Todos tab (priority/complete changes)
  useEffect(() => {
    const refresh = () => {
      const working = getWorkingTodos();
      setTodos(working);
    };
    window.addEventListener('dashboard:todos-important-updated', refresh as any);
    window.addEventListener('dashboard:todos-working-updated', refresh as any);
    window.addEventListener('dashboard:todos-updated', refresh as any);
    return () => {
      window.removeEventListener('dashboard:todos-important-updated', refresh as any);
      window.removeEventListener('dashboard:todos-working-updated', refresh as any);
      window.removeEventListener('dashboard:todos-updated', refresh as any);
    };
  }, []);

  const loadTodos = async () => {
    try {
      setLoading(true);
      setError(null);

      const urlParams = new URLSearchParams(window.location.search);
      const forceRefresh = urlParams.get('refresh') === 'true' || (window.performance.getEntriesByType('navigation')[0] as any)?.type === 'reload';

      if (forceRefresh) {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('refresh');
        window.history.replaceState({}, '', newUrl.toString());
      }

      const cachedTodos = getCachedData<Todo[]>('todos-cache');
      if (cachedTodos && !forceRefresh) {
        const workingTodos = applyStagedChangesToTodos(cachedTodos);
        setTodos(workingTodos);
        const staged = getStagedChanges();
        setStagedCount(staged.fieldChangeCount);
        setLoading(false);
        return;
      }

      if (forceRefresh) {
        // no-op extra logging
      }

      // Do not clear localStorage pre-fetch; only update cache after successful fetch

      const webhookTodos = await fetchTodosFromWebhook();
      setCachedData('todos-cache', webhookTodos);
      StorageManager.saveTodos(webhookTodos);
      const workingTodos = applyStagedChangesToTodos(webhookTodos);
      setTodos(workingTodos);
      const staged = getStagedChanges();
      setStagedCount(staged.fieldChangeCount);
    } catch (error) {
      console.error('Failed to load todos (home):', error);
      setError(error instanceof Error ? error.message : 'Failed to load todos');
      setTodos([]);
    } finally {
      setLoading(false);
    }
  };

  // Home is read-only: complete goes straight to DB without Save
  const completeImmediately = async (id: string) => {
    try {
      setLoading(true);
      // Locally stage and optimistically hide
      stageComplete({ id });
      setTodos(prev => prev.filter(t => String(t.id) !== String(id)));
      const staged = getStagedChanges();
      setStagedCount(staged.fieldChangeCount);
      // Persist completes only
      await saveTodosBatchToWebhook([], [id]);
      // Refresh minimal
      const freshTodos = await fetchTodosFromWebhook();
      StorageManager.saveTodos(freshTodos);
      setCachedData('todos-cache', freshTodos);
      try {
        window.dispatchEvent(new CustomEvent('dashboard:todos-important-updated', { detail: { ts: Date.now() } }));
      } catch {}
    } catch (error) {
      console.error('Failed to complete (home):', error);
      alert(`Failed to complete: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // On failure, reload to reconcile
      loadTodos();
    } finally {
      setLoading(false);
    }
  };

  // no edit functions needed on Home

  // no separate complete handler; using completeImmediately

  // no inline edit state on Home

  const priorityFiltered = useMemo(() => {
    const base = todos.filter(t => t.priority === 'critical' || t.priority === 'high');
    if (!workMode) return base;
    return base.filter(t => String(t.category || '').toLowerCase() === 'work');
  }, [todos, workMode]);

  const daysLeftInQuarter = useMemo(() => {
    if (!quarterInfo || isPastQuarter) return 0;
    
    const now = new Date();
    const endDate = new Date(quarterInfo.end_date);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endMid = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    const diffMs = endMid.getTime() - today.getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    const days = Math.max(0, Math.ceil(diffMs / oneDay));
    return days;
  }, [quarterInfo, isPastQuarter]);

  if (loading && isVisible) {
    return (
      <div className={tokens.layout.container}>
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <div className={tokens.palette.dark.text_muted}>Loading home...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error && isVisible) {
    return (
      <div className={tokens.layout.container}>
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h3 className="text-lg font-semibold mb-2">Failed to Load</h3>
              <p className="text-sm text-gray-600 mb-4">{error}</p>
              <button onClick={loadTodos} className={cn(tokens.button.base, tokens.button.primary)}>
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(tokens.layout.container, !isVisible && 'hidden')}>
      <div className="grid gap-6">
        <section>
          <div className="flex items-center justify-between">
            <button
              onClick={() => toggleSection('dailyIntentions')}
              className="flex items-center gap-2 text-left text-neutral-100 hover:text-emerald-400 transition-colors"
            >
              <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
                Daily Intentions
              </h2>
              <svg
                className={cn(
                  "w-5 h-5 transition-transform duration-200",
                  sectionsVisible.dailyIntentions ? "rotate-180" : "rotate-0"
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <SessionTimerInline />
          </div>
          <div className="mt-4">
            <DailyIntentionsModule isVisible={sectionsVisible.dailyIntentions} />
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => toggleSection('upcomingCalendar')}
              className="flex items-center gap-2 text-left text-neutral-100 hover:text-emerald-400 transition-colors"
            >
              <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
                Upcoming
              </h2>
              <svg
                className={cn(
                  "w-5 h-5 transition-transform duration-200",
                  sectionsVisible.upcomingCalendar ? "rotate-180" : "rotate-0"
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Calendar Quick Add - Similar to Calendar Tab */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <input
                  type="text"
                  value={calendarNlInput}
                  onChange={(e) => setCalendarNlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && calendarNlInput.trim()) {
                      e.preventDefault();
                      calendarModuleRef.current?.createEventFromNl(calendarNlInput);
                      setCalendarNlInput('');
                    }
                  }}
                  placeholder="Quick add: 'Dentist 2pm' or 'Vacation Jan 11-15'"
                  className="w-full px-4 py-2 pl-10 pr-10 bg-neutral-900 border border-neutral-700 rounded-full text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
                <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                {calendarNlInput.trim() && (
                  <button
                    onClick={() => {
                      calendarModuleRef.current?.createEventFromNl(calendarNlInput);
                      setCalendarNlInput('');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                    title="Create event"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Month Theme Display */}
          {sectionsVisible.upcomingCalendar && (() => {
            const hasTheme = currentMonthTheme && (
              currentMonthTheme.theme || 
              (currentMonthTheme.focus_areas && currentMonthTheme.focus_areas.filter(a => a && a.trim()).length > 0) || 
              (currentMonthTheme.non_focus_areas && currentMonthTheme.non_focus_areas.filter(a => a && a.trim()).length > 0)
            );
            
            return (
              <div className="mt-4 p-3 bg-neutral-900/50 border border-neutral-800 rounded-lg">
                {hasTheme ? (
                <div className="space-y-2">
                  {/* Theme */}
                  {currentMonthTheme.theme && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-400">This Month's Theme:</span>
                      <button
                        onClick={openMonthThemeEditor}
                        className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        "{currentMonthTheme.theme}"
                      </button>
                    </div>
                  )}
                  
                  {/* Focus and Non-Focus Areas */}
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {/* Focus Areas */}
                    {currentMonthTheme.focus_areas?.filter(a => a).length > 0 && (
                      <>
                        <span className="text-xs text-neutral-500">Focus:</span>
                        {currentMonthTheme.focus_areas.filter(a => a).map((area, idx) => (
                          <button
                            key={`focus-${idx}`}
                            onClick={openMonthThemeEditor}
                            className="px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded-full text-xs hover:bg-neutral-700 transition-colors"
                          >
                            {area}
                          </button>
                        ))}
                      </>
                    )}
                    
                    {/* Non-Focus Areas */}
                    {currentMonthTheme.non_focus_areas?.filter(a => a).length > 0 && (
                      <>
                        <span className="text-xs text-neutral-500">Non Focus:</span>
                        {currentMonthTheme.non_focus_areas.filter(a => a).map((area, idx) => (
                          <button
                            key={`non-focus-${idx}`}
                            onClick={openMonthThemeEditor}
                            className="px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded-full text-xs hover:bg-neutral-700 transition-colors"
                          >
                            {area}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400">This Month's Theme:</span>
                  <button
                    onClick={openMonthThemeEditor}
                    className="text-sm text-neutral-500 hover:text-neutral-400 transition-colors flex items-center gap-1.5"
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>Set Theme</span>
                  </button>
                </div>
              )}
            </div>
          );
          })()}
          
          <div className={cn('mt-4', !sectionsVisible.upcomingCalendar && 'hidden')}>
            <UpcomingCalendarModule 
              ref={calendarModuleRef}
              isVisible={sectionsVisible.upcomingCalendar} 
            />
          </div>
        </section>

        <section>
          <button
            onClick={() => toggleSection('committedPriorities')}
            className="flex items-center gap-2 w-full text-left text-neutral-100 hover:text-emerald-400 transition-colors"
          >
            <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
              Current Priorities
            </h2>
            <svg
              className={cn(
                "w-5 h-5 transition-transform duration-200",
                sectionsVisible.committedPriorities ? "rotate-180" : "rotate-0"
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {sectionsVisible.committedPriorities && (
            <div className="mt-4 space-y-4">
              {/* Year Theme Display for Priorities */}
              {(() => {
                const hasTheme = currentYearTheme && (
                  currentYearTheme.theme || 
                  (currentYearTheme.focus_areas && currentYearTheme.focus_areas.filter(a => a && a.trim()).length > 0) || 
                  (currentYearTheme.non_focus_areas && currentYearTheme.non_focus_areas.filter(a => a && a.trim()).length > 0)
                );
                
                return (
                  <div className="p-3 bg-neutral-900/50 border border-neutral-800 rounded-lg">
                    {hasTheme ? (
                    <div className="space-y-2">
                      {/* Theme */}
                      {currentYearTheme.theme && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-neutral-400">This Year's Theme:</span>
                          <button
                            onClick={openYearThemeEditor}
                            className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                          >
                            "{currentYearTheme.theme}"
                          </button>
                        </div>
                      )}
                      
                      {/* Focus and Non-Focus Areas */}
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {/* Focus Areas */}
                        {currentYearTheme.focus_areas?.filter(a => a).length > 0 && (
                          <>
                            <span className="text-xs text-neutral-500">Focus:</span>
                            {currentYearTheme.focus_areas.filter(a => a).map((area, idx) => (
                              <button
                                key={`focus-${idx}`}
                                onClick={openYearThemeEditor}
                                className="px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded-full text-xs hover:bg-neutral-700 transition-colors"
                              >
                                {area}
                              </button>
                            ))}
                          </>
                        )}
                        
                        {/* Non-Focus Areas */}
                        {currentYearTheme.non_focus_areas?.filter(a => a).length > 0 && (
                          <>
                            <span className="text-xs text-neutral-500">Non Focus:</span>
                            {currentYearTheme.non_focus_areas.filter(a => a).map((area, idx) => (
                              <button
                                key={`non-focus-${idx}`}
                                onClick={openYearThemeEditor}
                                className="px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded-full text-xs hover:bg-neutral-700 transition-colors"
                              >
                                {area}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-400">This Year's Theme:</span>
                      <button
                        onClick={openYearThemeEditor}
                        className="text-sm text-neutral-500 hover:text-neutral-400 transition-colors flex items-center gap-1.5"
                      >
                        <Target className="w-3.5 h-3.5" />
                        <span>Set Theme</span>
                      </button>
                    </div>
                  )}
                </div>
              );
              })()}

              {/* This Month's Theme */}
              {(() => {
                const hasTheme = currentMonthTheme && (
                  currentMonthTheme.theme ||
                  (currentMonthTheme.focus_areas && currentMonthTheme.focus_areas.filter(a => a).length > 0) ||
                  (currentMonthTheme.non_focus_areas && currentMonthTheme.non_focus_areas.filter(a => a).length > 0)
                );
                
                return (
                  <div className="mt-4 p-3 bg-neutral-900/50 border border-neutral-800 rounded-lg">
                    {hasTheme ? (
                      <div className="space-y-2">
                        {/* Theme */}
                        {currentMonthTheme.theme && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-400">This Month's Theme:</span>
                            <button
                              onClick={openMonthThemeEditor}
                              className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                            >
                              "{currentMonthTheme.theme}"
                            </button>
                          </div>
                        )}
                        
                        {/* Focus and Non-Focus Areas */}
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {/* Focus Areas */}
                          {currentMonthTheme.focus_areas?.filter(a => a).length > 0 && (
                            <>
                              <span className="text-xs text-neutral-500">Focus:</span>
                              {currentMonthTheme.focus_areas.filter(a => a).map((area, idx) => (
                                <button
                                  key={`month-focus-${idx}`}
                                  onClick={openMonthThemeEditor}
                                  className="px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded-full text-xs hover:bg-neutral-700 transition-colors"
                                >
                                  {area}
                                </button>
                              ))}
                            </>
                          )}
                          
                          {/* Non-Focus Areas */}
                          {currentMonthTheme.non_focus_areas?.filter(a => a).length > 0 && (
                            <>
                              <span className="text-xs text-neutral-500">Non Focus:</span>
                              {currentMonthTheme.non_focus_areas.filter(a => a).map((area, idx) => (
                                <button
                                  key={`month-non-focus-${idx}`}
                                  onClick={openMonthThemeEditor}
                                  className="px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded-full text-xs hover:bg-neutral-700 transition-colors"
                                >
                                  {area}
                                </button>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-400">This Month's Theme:</span>
                        <button
                          onClick={openMonthThemeEditor}
                          className="text-sm text-neutral-500 hover:text-neutral-400 transition-colors flex items-center gap-1.5"
                        >
                          <Target className="w-3.5 h-3.5" />
                          <span>Set Theme</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
              
              <CommittedPrioritiesModule isVisible={sectionsVisible.committedPriorities} />
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => toggleSection('okrs')}
              className="flex items-center gap-2 text-left text-neutral-100 hover:text-emerald-400 transition-colors min-w-0 flex-1"
            >
              <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
                {currentQuarter ? currentQuarter.split(' ')[0] : ''} OKRs{isPastQuarter ? ' - Final Results' : ` - ${daysLeftInQuarter} ${daysLeftInQuarter === 1 ? 'Day' : 'Days'} Left`}
              </h2>
              <svg
                className={cn(
                  "w-5 h-5 transition-transform duration-200",
                  sectionsVisible.okrs ? "rotate-180" : "rotate-0"
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {(() => {
              console.log('[HomeTab Render] nextQuarter:', nextQuarter, 'isPastQuarter:', isPastQuarter);
              return nextQuarter && (
                <button
                  onClick={() => setShowQuarterlySetup(true)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap',
                    'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                  )}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Set {nextQuarter.quarter} OKRs
                </button>
              );
            })()}
          </div>
          {sectionsVisible.okrs && (
            <div className="mt-4 space-y-4">
              {/* Past Quarter Summary Banner */}
              {isPastQuarter && quarterInfo && (
                <div className="p-4 bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border border-amber-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Trophy className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-amber-400 mb-1">
                        {quarterInfo.quarter} Complete!
                      </h3>
                      <p className="text-xs text-neutral-300">
                        Here's how you finished the quarter.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Year Theme Display for OKRs - Only show when NOT past quarter */}
              {!isPastQuarter && (() => {
                const hasTheme = currentYearTheme && (
                  currentYearTheme.theme || 
                  (currentYearTheme.focus_areas && currentYearTheme.focus_areas.filter(a => a && a.trim()).length > 0) || 
                  (currentYearTheme.non_focus_areas && currentYearTheme.non_focus_areas.filter(a => a && a.trim()).length > 0)
                );
                
                return (
                  <div className="p-3 bg-neutral-900/50 border border-neutral-800 rounded-lg">
                    {hasTheme ? (
                    <div className="space-y-2">
                      {/* Theme */}
                      {currentYearTheme.theme && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-neutral-400">This Year's Theme:</span>
                          <button
                            onClick={openYearThemeEditor}
                            className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                          >
                            "{currentYearTheme.theme}"
                          </button>
                        </div>
                      )}
                      
                      {/* Focus and Non-Focus Areas */}
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {/* Focus Areas */}
                        {currentYearTheme.focus_areas?.filter(a => a).length > 0 && (
                          <>
                            <span className="text-xs text-neutral-500">Focus:</span>
                            {currentYearTheme.focus_areas.filter(a => a).map((area, idx) => (
                              <button
                                key={`okr-focus-${idx}`}
                                onClick={openYearThemeEditor}
                                className="px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded-full text-xs hover:bg-neutral-700 transition-colors"
                              >
                                {area}
                              </button>
                            ))}
                          </>
                        )}
                        
                        {/* Non-Focus Areas */}
                        {currentYearTheme.non_focus_areas?.filter(a => a).length > 0 && (
                          <>
                            <span className="text-xs text-neutral-500">Non Focus:</span>
                            {currentYearTheme.non_focus_areas.filter(a => a).map((area, idx) => (
                              <button
                                key={`okr-non-focus-${idx}`}
                                onClick={openYearThemeEditor}
                                className="px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded-full text-xs hover:bg-neutral-700 transition-colors"
                              >
                                {area}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-400">This Year's Theme:</span>
                      <button
                        onClick={openYearThemeEditor}
                        className="text-sm text-neutral-500 hover:text-neutral-400 transition-colors flex items-center gap-1.5"
                      >
                        <Target className="w-3.5 h-3.5" />
                        <span>Set Theme</span>
                      </button>
                    </div>
                  )}
                </div>
              );
              })()}
              
              <OKRModule key={okrsKey} isVisible={sectionsVisible.okrs} hideHeader={true} />
            </div>
          )}
        </section>

        <section>
          <button
            onClick={() => toggleSection('importantTasks')}
            className="flex items-center gap-2 w-full text-left text-neutral-100 hover:text-emerald-400 transition-colors"
          >
            <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
              Important Tasks ({priorityFiltered.length})
            </h2>
            <svg
              className={cn(
                "w-5 h-5 transition-transform duration-200",
                sectionsVisible.importantTasks ? "rotate-180" : "rotate-0"
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className={cn('mt-4', !sectionsVisible.importantTasks && 'hidden')}>
            <HomeTodosTable
              todos={priorityFiltered}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={setSortBy}
              onSortOrderChange={setSortOrder}
              onComplete={completeImmediately}
            />
          </div>
        </section>

        {showQuarterlySetup && nextQuarter && (
          <QuarterlySetupModal
            nextQuarter={nextQuarter.quarter}
            previousOkrs={previousOkrs}
            onClose={() => setShowQuarterlySetup(false)}
            onCreate={handleCreateQuarterOKRs}
          />
        )}
        
        {/* Month Theme Editor Modal/Bottom Sheet */}
        {showMonthThemeEditor && (
          <>
            {/* Desktop: Modal */}
            <div className="hidden sm:block fixed inset-0 bg-black/50 z-50" onClick={() => setShowMonthThemeEditor(false)} />
            <div className="hidden sm:block fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-neutral-100">
                  {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
                <button
                  onClick={() => setShowMonthThemeEditor(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Theme Section */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">Theme</label>
                  <input
                    type="text"
                    value={monthThemeForm.theme}
                    onChange={(e) => setMonthThemeForm(prev => ({ ...prev, theme: e.target.value }))}
                    placeholder="Theme"
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                
                {/* Focus Areas Section */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">Focus Areas</label>
                  <div className="space-y-2">
                    {[0, 1, 2].map(i => (
                      <input
                        key={i}
                        type="text"
                        value={monthThemeForm.focusAreas[i] || ''}
                        onChange={(e) => {
                          const newAreas = [...monthThemeForm.focusAreas];
                          newAreas[i] = e.target.value;
                          setMonthThemeForm(prev => ({ ...prev, focusAreas: newAreas }));
                        }}
                        placeholder={`Focus ${i + 1}`}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    ))}
                  </div>
                </div>
                
                {/* Non Focus Areas Section */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">Non Focus Areas</label>
                  <div className="space-y-2">
                    {[0, 1].map(i => (
                      <input
                        key={i}
                        type="text"
                        value={monthThemeForm.nonFocusAreas[i] || ''}
                        onChange={(e) => {
                          const newAreas = [...monthThemeForm.nonFocusAreas];
                          newAreas[i] = e.target.value;
                          setMonthThemeForm(prev => ({ ...prev, nonFocusAreas: newAreas }));
                        }}
                        placeholder={`Non-focus ${i + 1}`}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                      />
                    ))}
                  </div>
                </div>
                
                <button
                  onClick={handleSaveMonthTheme}
                  className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
            
            {/* Mobile: Bottom Sheet */}
            <div className="sm:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setShowMonthThemeEditor(false)} />
            <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 rounded-t-3xl shadow-2xl z-50 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 bg-neutral-700 rounded-full" />
              </div>
              
              <div className="sticky top-0 z-10 bg-neutral-900 border-b border-neutral-800 px-4 pb-3 pt-1 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-100">
                  {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
                <button
                  onClick={() => setShowMonthThemeEditor(false)}
                  className="p-2 text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 space-y-4 pb-8">
                {/* Theme Section */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">Theme</label>
                  <input
                    type="text"
                    value={monthThemeForm.theme}
                    onChange={(e) => setMonthThemeForm(prev => ({ ...prev, theme: e.target.value }))}
                    placeholder="Theme"
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                
                {/* Focus Areas Section */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">Focus Areas</label>
                  <div className="space-y-2">
                    {[0, 1, 2].map(i => (
                      <input
                        key={i}
                        type="text"
                        value={monthThemeForm.focusAreas[i] || ''}
                        onChange={(e) => {
                          const newAreas = [...monthThemeForm.focusAreas];
                          newAreas[i] = e.target.value;
                          setMonthThemeForm(prev => ({ ...prev, focusAreas: newAreas }));
                        }}
                        placeholder={`Focus ${i + 1}`}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    ))}
                  </div>
                </div>
                
                {/* Non Focus Areas Section */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">Non Focus Areas</label>
                  <div className="space-y-2">
                    {[0, 1].map(i => (
                      <input
                        key={i}
                        type="text"
                        value={monthThemeForm.nonFocusAreas[i] || ''}
                        onChange={(e) => {
                          const newAreas = [...monthThemeForm.nonFocusAreas];
                          newAreas[i] = e.target.value;
                          setMonthThemeForm(prev => ({ ...prev, nonFocusAreas: newAreas }));
                        }}
                        placeholder={`Non-focus ${i + 1}`}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                      />
                    ))}
                  </div>
                </div>
                
                <button
                  onClick={handleSaveMonthTheme}
                  className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </>
        )}
        
        {/* Year Theme Editor Modal/Bottom Sheet */}
        {showYearThemeEditor && (
          <>
            {/* Desktop: Modal */}
            <div className="hidden sm:block fixed inset-0 bg-black/50 z-50" onClick={() => setShowYearThemeEditor(false)} />
            <div className="hidden sm:block fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-neutral-100">
                  {new Date().getFullYear()}
                </h3>
                <button
                  onClick={() => setShowYearThemeEditor(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Theme Section */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">Theme</label>
                  <input
                    type="text"
                    value={yearThemeForm.theme}
                    onChange={(e) => setYearThemeForm(prev => ({ ...prev, theme: e.target.value }))}
                    placeholder="Theme"
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                
                {/* Focus Areas Section */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">Focus Areas</label>
                  <div className="space-y-2">
                    {[0, 1, 2].map(i => (
                      <input
                        key={i}
                        type="text"
                        value={yearThemeForm.focusAreas[i] || ''}
                        onChange={(e) => {
                          const newAreas = [...yearThemeForm.focusAreas];
                          newAreas[i] = e.target.value;
                          setYearThemeForm(prev => ({ ...prev, focusAreas: newAreas }));
                        }}
                        placeholder={`Focus ${i + 1}`}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    ))}
                  </div>
                </div>
                
                {/* Non Focus Areas Section */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">Non Focus Areas</label>
                  <div className="space-y-2">
                    {[0, 1].map(i => (
                      <input
                        key={i}
                        type="text"
                        value={yearThemeForm.nonFocusAreas[i] || ''}
                        onChange={(e) => {
                          const newAreas = [...yearThemeForm.nonFocusAreas];
                          newAreas[i] = e.target.value;
                          setYearThemeForm(prev => ({ ...prev, nonFocusAreas: newAreas }));
                        }}
                        placeholder={`Non-focus ${i + 1}`}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                      />
                    ))}
                  </div>
                </div>
                
                <button
                  onClick={handleSaveYearTheme}
                  className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
            
            {/* Mobile: Bottom Sheet */}
            <div className="sm:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setShowYearThemeEditor(false)} />
            <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 rounded-t-3xl shadow-2xl z-50 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 bg-neutral-700 rounded-full" />
              </div>
              
              <div className="sticky top-0 z-10 bg-neutral-900 border-b border-neutral-800 px-4 pb-3 pt-1 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-100">
                  {new Date().getFullYear()}
                </h3>
                <button
                  onClick={() => setShowYearThemeEditor(false)}
                  className="p-2 text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 space-y-4 pb-8">
                {/* Theme Section */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">Theme</label>
                  <input
                    type="text"
                    value={yearThemeForm.theme}
                    onChange={(e) => setYearThemeForm(prev => ({ ...prev, theme: e.target.value }))}
                    placeholder="Theme"
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                
                {/* Focus Areas Section */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">Focus Areas</label>
                  <div className="space-y-2">
                    {[0, 1, 2].map(i => (
                      <input
                        key={i}
                        type="text"
                        value={yearThemeForm.focusAreas[i] || ''}
                        onChange={(e) => {
                          const newAreas = [...yearThemeForm.focusAreas];
                          newAreas[i] = e.target.value;
                          setYearThemeForm(prev => ({ ...prev, focusAreas: newAreas }));
                        }}
                        placeholder={`Focus ${i + 1}`}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    ))}
                  </div>
                </div>
                
                {/* Non Focus Areas Section */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">Non Focus Areas</label>
                  <div className="space-y-2">
                    {[0, 1].map(i => (
                      <input
                        key={i}
                        type="text"
                        value={yearThemeForm.nonFocusAreas[i] || ''}
                        onChange={(e) => {
                          const newAreas = [...yearThemeForm.nonFocusAreas];
                          newAreas[i] = e.target.value;
                          setYearThemeForm(prev => ({ ...prev, nonFocusAreas: newAreas }));
                        }}
                        placeholder={`Non-focus ${i + 1}`}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                      />
                    ))}
                  </div>
                </div>
                
                <button
                  onClick={handleSaveYearTheme}
                  className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HomeTab;


