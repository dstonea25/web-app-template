import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Todo, Priority, TodoPatch, Effort } from '../types';
import { StorageManager, stageRowEdit, stageComplete, getStagedChanges, clearStagedChanges, getCachedData, setCachedData, applyStagedChangesToTodos, getWorkingTodos } from '../lib/storage';
import { addTodo as storageAddTodo } from '../lib/storage';
import { fetchTodosFromWebhook, saveTodosBatchToWebhook } from '../lib/api';
import { tokens, cn } from '../theme/config';
import SelectPriority from '../components/SelectPriority';
import { TodosTable } from '../components/TodosTable';
import { CategoryTabs } from '../components/CategoryTabs';
import { toast } from '../lib/notifications/toast';
import { useWorkMode } from '../contexts/WorkModeContext';

export const TodosTab: React.FC<{ isVisible?: boolean }> = ({ isVisible = true }) => {
  const { workMode } = useWorkMode();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<keyof Todo | ''>('priority');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  
  const [quickTask, setQuickTask] = useState<string>('');
  const [quickPriority, setQuickPriority] = useState<Priority>('medium');
  const [quickEffort, setQuickEffort] = useState<Effort>('S');
  const [/* stagedCount */, setStagedCount] = useState<number>(0);
  const commitTimerRef = useRef<number | null>(null);
  const UNDO_WINDOW_MS = 2500;
  const prevEditRef = useRef<Todo | null>(null);
  const hasLoadedRef = useRef(false);

  // Ensure UI category selection reflects Work Mode so inline add appears
  useEffect(() => {
    if (workMode) {
      if (activeCategory !== 'work') setActiveCategory('work');
    } else {
      if (activeCategory === 'work') setActiveCategory('All');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workMode]);

  // Load initial data when tab mounts (only happens when tab is active)
  useEffect(() => {
    if (!isVisible || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadTodos();
  }, [isVisible]);

  // Cross-tab sync: refresh when storage broadcasts updates
  useEffect(() => {
    const handler = () => {
      const working = getWorkingTodos();
      setTodos(working);
    };
    window.addEventListener('dashboard:todos-updated', handler as any);
    return () => window.removeEventListener('dashboard:todos-updated', handler as any);
  }, []);

  // Auto-commit staged changes after a short undo window
  const scheduleCommit = () => {
    if (commitTimerRef.current) {
      window.clearTimeout(commitTimerRef.current);
    }
    commitTimerRef.current = window.setTimeout(async () => {
      try {
        const staged = getStagedChanges();
        if ((staged.updates.length + staged.completes.length) === 0) return;
        await saveTodosBatchToWebhook(staged.updates, staged.completes);
        const freshTodos = await fetchTodosFromWebhook();
        StorageManager.saveTodos(freshTodos);
        const transformed = StorageManager.loadTodos();
        setTodos(transformed);
        setCachedData('todos-cache', freshTodos);
        clearStagedChanges();
        setStagedCount(0);
        try {
          window.dispatchEvent(new CustomEvent('dashboard:todos-important-updated', { detail: { ts: Date.now() } }));
        } catch {}
      } catch (err) {
        console.error('Auto-save failed:', err);
        // Only show error if we truly had pending changes (avoid id-only patches or emptied staged by undo)
        toast.error('Auto-save failed');
      }
    }, UNDO_WINDOW_MS);
  };

  const loadTodos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if refresh was explicitly requested via URL parameter or hard refresh
      const urlParams = new URLSearchParams(window.location.search);
      const forceRefresh = urlParams.get('refresh') === 'true' || 
                          (window.performance.getEntriesByType('navigation')[0] as any)?.type === 'reload';
      
      if (forceRefresh) {
        console.log('🔄 Force refresh requested via URL parameter');
        // Remove the refresh parameter from URL without reloading
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('refresh');
        window.history.replaceState({}, '', newUrl.toString());
      }
      
      // Always check cache first - only bypass if explicitly refreshing
      const cachedTodos = getCachedData<Todo[]>('todos-cache');
      if (cachedTodos && !forceRefresh) {
        console.log('📦 Loading todos from cache');
        
        // Apply staged changes to cached data directly
        const workingTodos = applyStagedChangesToTodos(cachedTodos);
        setTodos(workingTodos);
        
        const staged = getStagedChanges();
        setStagedCount(staged.fieldChangeCount);
        setLoading(false);
        return;
      }
      
      if (forceRefresh) {
        console.log('🔄 Force refresh requested - clearing cache and loading fresh data');
      }
      
      // Do not clear localStorage pre-fetch; only update cache after successful fetch
      
      // Load from backend
      console.log('🌐 Loading todos...');
      const webhookTodos = await fetchTodosFromWebhook();
      console.log('✅ Todos loaded:', webhookTodos);
      
      // Cache the data
      setCachedData('todos-cache', webhookTodos);
      
      // Ensure transforms on load (priority/id/status handling) by saving then reloading
      StorageManager.saveTodos(webhookTodos);
      
      // Apply staged changes to the backend data directly
      const workingTodos = applyStagedChangesToTodos(webhookTodos);
      setTodos(workingTodos);
      
      const staged = getStagedChanges();
      setStagedCount(staged.fieldChangeCount);
    } catch (error) {
      console.error('Failed to load todos:', error);
      setError(error instanceof Error ? error.message : 'Failed to load todos');
      setTodos([]); // Clear todos on error
    } finally {
      setLoading(false);
    }
  };

  // legacy save removed; auto-commit is used

  

  // Inline quick-add when filtered by a specific category
  const addQuickTodo = () => {
    if (activeCategory === 'All') return;
    const task = quickTask.trim();
    if (!task) return;
    const updatedTodos = storageAddTodo(todos, {
      task,
      category: activeCategory,
      priority: quickPriority || null,
      effort: quickEffort || null,
    });
    setTodos(updatedTodos);
    const newTodoItem = updatedTodos[updatedTodos.length - 1];
    if (newTodoItem) {
      stageRowEdit({
        id: newTodoItem.id || '',
        patch: {
          id: newTodoItem.id || '',
          task: newTodoItem.task,
          category: newTodoItem.category,
          priority: newTodoItem.priority,
          effort: newTodoItem.effort,
          statusUi: newTodoItem.statusUi,
          _isNew: true
        } as TodoPatch,
      });
      const staged = getStagedChanges();
      setStagedCount(staged.fieldChangeCount);
      scheduleCommit();
    }
    setQuickTask('');
    setQuickPriority('medium');
    setQuickEffort('S');
  };

  const updateTodo = (id: string, updates: Partial<Todo>) => {
    // Update UI
    const prev = todos.find(t => t.id === id);
    setTodos(ts => ts.map(t => (t.id === id ? { ...t, ...updates } : t)));
    // If this is a task text change, defer staging until commit
    if (Object.prototype.hasOwnProperty.call(updates, 'task')) {
      return;
    }
    // Stage non-text changes immediately and show undo
    stageRowEdit({ id, patch: { id, ...updates } as TodoPatch });
    const staged = getStagedChanges();
    setStagedCount(staged.fieldChangeCount);
    try { window.dispatchEvent(new CustomEvent('dashboard:todos-working-updated', { detail: { ts: Date.now(), id, type: 'update' } })); } catch {}
    toast.info('Updated todo', {
      ttlMs: UNDO_WINDOW_MS,
      actionLabel: 'Undo',
      onAction: () => {
        if (!prev) return;
        setTodos(ts => ts.map(t => (t.id === id ? { ...t, ...prev } : t)));
        stageRowEdit({ id, patch: { id, task: prev.task, category: prev.category ?? null, priority: prev.priority, effort: prev.effort, due_date: prev.due_date } as TodoPatch });
        const s = getStagedChanges();
        setStagedCount(s.fieldChangeCount);
      }
    });
    scheduleCommit();
  };


  const completeTodo = (id: string) => {
    const removed = todos.find(t => String(t.id) === String(id));
    stageComplete({ id });
    const staged = getStagedChanges();
    setStagedCount(staged.updates.length + staged.completes.length);
    setTodos(prev => prev.filter(t => String(t.id) !== String(id)));
    try { window.dispatchEvent(new CustomEvent('dashboard:todos-working-updated', { detail: { ts: Date.now(), id, type: 'complete' } })); } catch {}
    toast.info('Completed todo', {
      ttlMs: UNDO_WINDOW_MS,
      actionLabel: 'Undo',
      onAction: () => {
        // Unstage completion by staging a no-op edit
        stageRowEdit({ id, patch: { id } as TodoPatch });
        // Restore locally
        if (removed) setTodos(prev => [...prev, removed].sort((a, b) => (a.id! < b.id! ? -1 : 1)));
        const s = getStagedChanges();
        setStagedCount(s.fieldChangeCount);
        try { window.dispatchEvent(new CustomEvent('dashboard:todos-working-updated', { detail: { ts: Date.now(), id, type: 'undo-complete' } })); } catch {}
      }
    });
    scheduleCommit();
  };

  const handleEditStart = (id: string) => {
    setEditingId(id);
    // Capture snapshot at start of editing for undo on commit
    const snapshot = todos.find(t => t.id === id) || null;
    prevEditRef.current = snapshot ? { ...snapshot } : null;
  };

  const handleEditEnd = () => {
    setEditingId(null);
  };

  // Compute filtered view (must be before any early returns to keep hooks order stable)
  const effectiveActiveCategory = useMemo(() => (workMode ? 'work' : activeCategory), [workMode, activeCategory]);
  const filteredTodos = useMemo(() => {
    if (workMode) return todos.filter(todo => String(todo.category || '').toLowerCase() === 'work');
    return effectiveActiveCategory === 'All' ? todos : todos.filter(todo => todo.category === effectiveActiveCategory);
  }, [todos, workMode, effectiveActiveCategory]);

  if (loading && isVisible) {
    return (
      <div className={tokens.layout.container}>
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <div className={tokens.palette.dark.text_muted}>Loading todos...</div>
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
              <h3 className="text-lg font-semibold mb-2">Failed to Load Todos</h3>
              <p className="text-sm text-gray-600 mb-4">{error}</p>
              <button
                onClick={loadTodos}
                className={cn(tokens.button.base, tokens.button.primary)}
              >
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
      

      {/* Main todos section */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
            To-Dos ({filteredTodos.length})
          </h2>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="mb-4">
        <CategoryTabs
          todos={todos}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />
      </div>

      {/* Inline quick add when filtered by a specific category */}
      {activeCategory !== 'All' && (
        <div className="mb-4">
          <div className={cn(tokens.card.base, 'p-3')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 items-center w-full">
              <input
                type="text"
                placeholder={`Add to ${activeCategory}...`}
                value={quickTask}
                onChange={(e) => setQuickTask(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addQuickTodo(); }}
                className={cn(tokens.input.base, tokens.input.focus, 'w-full sm:col-span-2 lg:col-span-6')}
              />
              <div className="flex items-center gap-2 lg:col-span-3">
                <span className={cn(tokens.palette.dark.text_muted, 'text-sm')}>Priority</span>
                <SelectPriority
                  value={quickPriority as Priority}
                  onChange={(p) => setQuickPriority((p || 'medium') as Priority)}
                  ariaLabel="Set quick add priority"
                  className="w-full min-w-[10rem]"
                />
              </div>
              <div className="flex items-center gap-2 lg:col-span-2">
                <span className={cn(tokens.palette.dark.text_muted, 'text-sm')}>Effort</span>
                <select
                  value={quickEffort || ''}
                  onChange={(e) => setQuickEffort((e.target.value || null) as Effort)}
                  className={cn(tokens.input.base, tokens.input.focus, !quickEffort && 'text-neutral-400')}
                  style={!quickEffort ? { color: '#9ca3af' } : {}}
                  aria-label="Set quick add effort"
                >
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-1 flex justify-end">
                <button
                  onClick={addQuickTodo}
                  className={cn(tokens.button.base, tokens.button.primary, 'w-full sm:w-auto')}
                  disabled={!quickTask.trim()}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Todos table */}
      <TodosTable
        todos={filteredTodos}
        filter={filter}
        sortBy={sortBy}
        sortOrder={sortOrder}
        editingId={editingId}
        onFilterChange={setFilter}
        onSortChange={setSortBy}
        onSortOrderChange={setSortOrder}
        onEditStart={handleEditStart}
        onEditEnd={handleEditEnd}
        onTodoUpdate={updateTodo}
        onTodoComplete={completeTodo}
        onCommitRowEdit={(id, patch) => {
          // Stage and schedule auto-commit once editing finishes
          stageRowEdit({ id, patch });
          const staged = getStagedChanges();
          setStagedCount(staged.fieldChangeCount);
      try { window.dispatchEvent(new CustomEvent('dashboard:todos-working-updated', { detail: { ts: Date.now(), id, type: 'commit' } })); } catch {}
          // Undo toast based on snapshot
          const prev = prevEditRef.current;
          toast.info('Updated todo', {
            ttlMs: UNDO_WINDOW_MS,
            actionLabel: 'Undo',
            onAction: () => {
              if (!prev) return;
              setTodos(ts => ts.map(t => (t.id === id ? { ...t, ...prev } : t)));
              stageRowEdit({ id, patch: { id, task: prev.task, category: prev.category ?? null, priority: prev.priority, effort: prev.effort, due_date: prev.due_date } as TodoPatch });
              const s = getStagedChanges();
              setStagedCount(s.fieldChangeCount);
              try { window.dispatchEvent(new CustomEvent('dashboard:todos-working-updated', { detail: { ts: Date.now(), id, type: 'undo-commit' } })); } catch {}
            }
          });
          scheduleCommit();
        }}
      />
    </div>
  );
};
