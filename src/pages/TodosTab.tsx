import React, { useState, useEffect, useRef } from 'react';
import type { Todo, Priority, TodoPatch, Effort } from '../types';
import { StorageManager, stageRowEdit, stageComplete, getStagedChanges, clearStagedChanges, getCachedData, setCachedData, applyStagedChangesToTodos } from '../lib/storage';
import { applyFileSave, getWorkingTodos } from '../lib/storage';
import { addTodo as storageAddTodo } from '../lib/storage';
import { fetchTodosFromWebhook, saveTodosToWebhook, saveTodosBatchToWebhook } from '../lib/api';
import { tokens, cn } from '../theme/config';
import SelectPriority from '../components/SelectPriority';
import { TodosTable } from '../components/TodosTable';
import { CategoryTabs } from '../components/CategoryTabs';
import { toast } from '../lib/notifications/toast';

export const TodosTab: React.FC<{ isVisible?: boolean }> = ({ isVisible = true }) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<keyof Todo | ''>('priority');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [newTodo, setNewTodo] = useState<Partial<Todo>>({ task: '', category: '', priority: 'medium', effort: 'S' });
  const [stagedCount, setStagedCount] = useState<number>(0);
  const commitTimerRef = useRef<number | null>(null);
  const UNDO_WINDOW_MS = 2500;
  const hasLoadedRef = useRef(false);

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
      } catch (err) {
        console.error('Auto-save failed:', err);
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

  const saveBatch = async () => {
    try {
      setLoading(true);
      
      // Get staged updates and completes directly and perform batch save
      const staged = getStagedChanges();
      // If nothing to save, bail
      if ((staged.updates.length + staged.completes.length) === 0) {
        setLoading(false);
        return;
      }
      await saveTodosBatchToWebhook(staged.updates, staged.completes);
      
      // Refresh data to get the latest state
      console.log('🔄 Refreshing data after save...');
      const freshTodos = await fetchTodosFromWebhook();
      
      // Update local state with fresh data
      StorageManager.saveTodos(freshTodos);
      const transformed = StorageManager.loadTodos();
      setTodos(transformed);
      
      // Update cache with fresh data
      setCachedData('todos-cache', freshTodos);
      
      // Clear staged changes
      clearStagedChanges();
      setStagedCount(0);
      
      console.log('✅ Save completed successfully');
    } catch (error) {
      console.error('Failed to save:', error);
      alert(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const addTodo = () => {
    if (!newTodo.task?.trim()) return;
    const updatedTodos = storageAddTodo(todos, {
      task: newTodo.task!,
      category: (newTodo.category as string | null) ?? null,
      priority: (newTodo.priority as Priority) ?? null,
      effort: (newTodo.effort as Effort) ?? null,
    });
    setTodos(updatedTodos);
    
    // Stage the new todo for saving (get the last added todo)
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
          _isNew: true // Mark as new todo - counts as 1 change
        } 
      });
      
      // Update staged count
      const staged = getStagedChanges();
      setStagedCount(staged.fieldChangeCount);
    }
    
    setNewTodo({ task: '', category: (newTodo.category as string) || '', priority: 'medium', effort: 'S' });
  };

  const updateTodo = (id: string, updates: Partial<Todo>) => {
    // Keep previous snapshot for undo
    const prev = todos.find(t => t.id === id);
    const updatedTodos = todos.map(todo => (todo.id === id ? { ...todo, ...updates } : todo));
    setTodos(updatedTodos);
    // Stage the change for auto-save
    stageRowEdit({ id, patch: { id, ...updates } as TodoPatch });
    const staged = getStagedChanges();
    setStagedCount(staged.fieldChangeCount);
    // Show undo toast for edits
    toast.info('Updated todo', {
      ttlMs: UNDO_WINDOW_MS,
      actionLabel: 'Undo',
      onAction: () => {
        if (!prev) return;
        // Revert local state
        setTodos(ts => ts.map(t => (t.id === id ? { ...t, ...prev } : t)));
        // Revert staged change back to previous values
        stageRowEdit({ id, patch: { id, task: prev.task, category: prev.category ?? null, priority: prev.priority, effort: prev.effort, due_date: prev.due_date } as TodoPatch });
        const s = getStagedChanges();
        setStagedCount(s.fieldChangeCount);
      }
    });
    // Schedule auto-commit
    scheduleCommit();
  };


  const completeTodo = (id: string) => {
    const removed = todos.find(t => String(t.id) === String(id));
    stageComplete({ id });
    const staged = getStagedChanges();
    setStagedCount(staged.updates.length + staged.completes.length);
    setTodos(prev => prev.filter(t => String(t.id) !== String(id)));
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
      }
    });
    scheduleCommit();
  };

  const handleEditStart = (id: string) => {
    setEditingId(id);
  };

  const handleEditEnd = () => {
    setEditingId(null);
  };

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

  // Filter todos by active category
  const filteredTodos = activeCategory === 'All' 
    ? todos 
    : todos.filter(todo => todo.category === activeCategory);

  return (
    <div className={cn(tokens.layout.container, !isVisible && 'hidden')}>
      {/* Add new todo form - moved to top as separate section */}
      <div className={cn(tokens.card.base, 'mb-6')}>
        <h3 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, 'mb-3', tokens.palette.dark.text)}>
          Add New Todo
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="Todo task"
            value={newTodo.task}
            onChange={(e) => setNewTodo({ ...newTodo, task: e.target.value })}
            className={cn(tokens.input.base, tokens.input.focus)}
          />
          <select
            value={(newTodo.category as string) || ''}
            onChange={(e) => setNewTodo({ ...newTodo, category: e.target.value })}
            className={cn(tokens.input.base, tokens.input.focus, !newTodo.category && 'text-neutral-400')}
            style={!newTodo.category ? { color: '#9ca3af' } : {}}
          >
            <option value="" style={{ color: '#9ca3af' }}>Select category</option>
            <option value="work">work</option>
            <option value="n8n">n8n</option>
            <option value="content">content</option>
            <option value="research">research</option>
            <option value="personal">personal</option>
          </select>
          <SelectPriority
            value={(newTodo.priority as Priority) ?? 'medium'}
            onChange={(p) => setNewTodo({ ...newTodo, priority: p || 'medium' })}
            ariaLabel="Set priority"
            placeholderLabel="Priority"
          />
          <select
            value={(newTodo.effort as Effort) || 'S'}
            onChange={(e) => setNewTodo({ ...newTodo, effort: (e.target.value as Effort) })}
            className={cn(tokens.input.base, tokens.input.focus, !newTodo.effort && 'text-neutral-400')}
            style={!newTodo.effort ? { color: '#9ca3af' } : {}}
          >
            <option value="S">S</option>
            <option value="M">M</option>
            <option value="L">L</option>
          </select>
          <button
            onClick={addTodo}
            className={cn(tokens.button.base, tokens.button.primary)}
          >
            Add Todo
          </button>
        </div>
      </div>

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
        onCommitRowEdit={() => {}} // No longer used
      />
    </div>
  );
};
