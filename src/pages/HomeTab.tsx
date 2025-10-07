import React, { useEffect, useRef, useState } from 'react';
import type { Todo, Priority, TodoPatch, Effort } from '../types';
import { tokens, cn } from '../theme/config';
import { TodosTable } from '../components/TodosTable';
import { StorageManager, stageRowEdit, stageComplete, getStagedChanges, clearStagedChanges, getCachedData, setCachedData, applyStagedChangesToTodos, applyFileSave, getWorkingTodos } from '../lib/storage';
import { fetchTodosFromWebhook, saveTodosBatchToWebhook } from '../lib/api';

export const HomeTab: React.FC<{ isVisible?: boolean }> = ({ isVisible = true }) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<keyof Todo | ''>('priority');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stagedCount, setStagedCount] = useState<number>(0);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!isVisible || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadTodos();
  }, [isVisible]);

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

  const saveBatch = async () => {
    try {
      setLoading(true);
      const staged = getStagedChanges();
      if ((staged.updates.length + staged.completes.length) === 0) {
        setLoading(false);
        return;
      }
      await saveTodosBatchToWebhook(staged.updates, staged.completes);
      const freshTodos = await fetchTodosFromWebhook();
      StorageManager.saveTodos(freshTodos);
      const transformed = StorageManager.loadTodos();
      setTodos(transformed);
      setCachedData('todos-cache', freshTodos);
      clearStagedChanges();
      setStagedCount(0);
    } catch (error) {
      console.error('Failed to save (home):', error);
      alert(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const updateTodo = (id: string, updates: Partial<Todo>) => {
    const updatedTodos = todos.map(todo => (todo.id === id ? { ...todo, ...updates } : todo));
    setTodos(updatedTodos);
    stageRowEdit({ id, patch: { id, ...updates } as TodoPatch });
    const staged = getStagedChanges();
    setStagedCount(staged.fieldChangeCount);
  };

  const completeTodo = (id: string) => {
    stageComplete({ id });
    const staged = getStagedChanges();
    setStagedCount(staged.updates.length + staged.completes.length);
    setTodos(prev => prev.filter(t => String(t.id) !== String(id)));
  };

  const handleEditStart = (id: string) => setEditingId(id);
  const handleEditEnd = () => setEditingId(null);

  const priorityFiltered = todos.filter(t => t.priority === 'crucial' || t.priority === 'high');

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
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
            Home · High-Priority To-Dos ({priorityFiltered.length})
          </h2>
          <div className="flex gap-2">
            <button
              onClick={saveBatch}
              disabled={stagedCount === 0 || loading}
              className={cn(tokens.button.base, tokens.button.primary, (stagedCount === 0 || loading) && 'opacity-50 cursor-not-allowed')}
            >
              {loading ? 'Saving...' : (stagedCount > 0 ? `Save (${stagedCount})` : 'Save')}
            </button>
            {stagedCount > 0 && (
              <button
                onClick={() => {
                  clearStagedChanges();
                  setStagedCount(0);
                  loadTodos();
                }}
                disabled={loading}
                className={cn(tokens.button.base, tokens.button.ghost, 'border border-gray-500 text-gray-500 hover:bg-gray-500 hover:text-white')}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <TodosTable
        todos={priorityFiltered}
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
        onCommitRowEdit={() => {}}
        showCategory
      />
    </div>
  );
};

export default HomeTab;


