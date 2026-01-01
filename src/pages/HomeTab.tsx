import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Todo, Okr } from '../types';
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
import { fetchOkrsWithProgress, getNextQuarter, createQuarterOKRs } from '../lib/okrs';
import { Sparkles, ChevronRight } from 'lucide-react';

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
  }, [isVisible]);

  const loadQuarterInfo = async () => {
    try {
      const okrs = await fetchOkrsWithProgress();
      if (okrs.length > 0) {
        const quarter = okrs[0].quarter;
        setCurrentQuarter(quarter || null);
        setPreviousOkrs(okrs);
      }
      const next = await getNextQuarter();
      setNextQuarter(next);
    } catch (error) {
      console.error('Failed to load quarter info:', error);
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
    const now = new Date();
    const startMonth = Math.floor(now.getMonth() / 3) * 3;
    const end = new Date(now.getFullYear(), startMonth + 3, 0);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endMid = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const diffMs = endMid.getTime() - today.getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    const days = Math.max(0, Math.ceil(diffMs / oneDay));
    return days;
  }, []);

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
          <div className="mt-4">
            <CommittedPrioritiesModule isVisible={sectionsVisible.committedPriorities} />
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => toggleSection('okrs')}
              className="flex items-center gap-2 text-left text-neutral-100 hover:text-emerald-400 transition-colors min-w-0 flex-1"
            >
              <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
                {currentQuarter ? currentQuarter.split(' ')[0] : ''} OKRs - {daysLeftInQuarter} {daysLeftInQuarter === 1 ? 'Day' : 'Days'} Left
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
            
            {nextQuarter && (
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
            )}
          </div>
          <div className="mt-4">
            <OKRModule key={okrsKey} isVisible={sectionsVisible.okrs} hideHeader={true} />
          </div>
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
      </div>
    </div>
  );
};

export default HomeTab;


