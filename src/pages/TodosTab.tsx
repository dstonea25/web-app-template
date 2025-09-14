import React, { useState, useEffect } from 'react';
import type { Todo, Priority, TodoPatch } from '../types';
import { StorageManager, stageRowEdit, stageComplete, getStagedChanges, getCachedData, setCachedData } from '../lib/storage';
import { applyFileSave, getWorkingTodos } from '../lib/storage';
import { addTodo as storageAddTodo } from '../lib/storage';
import { fetchTodosFromWebhook, saveTodosToWebhook } from '../lib/api';
import { tokens, cn } from '../theme/config';
import SelectPriority from '../components/SelectPriority';
import { TodosTable } from '../components/TodosTable';
import { CategoryTabs } from '../components/CategoryTabs';
// Example only: toast.success('Saved N items')
// import { toast } from '../lib/notifications/toast';

export const TodosTab: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<keyof Todo | ''>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [newTodo, setNewTodo] = useState<Partial<Todo>>({ task: '', category: '', priority: null });
  const [stagedCount, setStagedCount] = useState<number>(0);

  // Load initial data
  useEffect(() => {
    loadTodos();
  }, []);

  const loadTodos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check cache first
      const cachedTodos = getCachedData<Todo[]>('todos-cache');
      if (cachedTodos) {
        console.log('📦 Loading todos from cache');
        setTodos(cachedTodos);
        const staged = getStagedChanges();
        setStagedCount(staged.updates.length + staged.completes.length);
        setLoading(false);
        return;
      }
      
      // Clear localStorage to force fresh data load
      StorageManager.clearAll();
      
      // Load from webhook
      console.log('🌐 Loading todos from webhook...');
      const webhookTodos = await fetchTodosFromWebhook();
      console.log('✅ Webhook todos loaded:', webhookTodos);
      
      // Cache the data
      setCachedData('todos-cache', webhookTodos);
      
      // Ensure transforms on load (priority/id/status handling) by saving then reloading
      StorageManager.saveTodos(webhookTodos);
      const transformed = StorageManager.loadTodos();
      setTodos(transformed);
      const staged = getStagedChanges();
      setStagedCount(staged.updates.length + staged.completes.length);
    } catch (error) {
      console.error('Failed to load todos from webhook:', error);
      setError(error instanceof Error ? error.message : 'Failed to load todos from webhook');
      setTodos([]); // Clear todos on error
    } finally {
      setLoading(false);
    }
  };

  const saveBatch = async () => {
    try {
      setLoading(true);
      
      // Apply staged changes to get the final state
      const result = await applyFileSave();
      if (!result.ok) {
        throw new Error('Failed to apply staged changes');
      }
      
      // Get the updated todos after applying changes
      const updatedTodos = getWorkingTodos();
      
      // Save to n8n webhook
      await saveTodosToWebhook(updatedTodos);
      
      // Refresh data from webhook to get the latest state
      console.log('🔄 Refreshing data from webhook after save...');
      const freshTodos = await fetchTodosFromWebhook();
      
      // Update local state with fresh data
      StorageManager.saveTodos(freshTodos);
      const transformed = StorageManager.loadTodos();
      setTodos(transformed);
      
      // Update cache with fresh data
      setCachedData('todos-cache', freshTodos);
      
      // Clear staged changes
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
    });
    setTodos(updatedTodos);
    
    // Stage the new todo for saving (get the last added todo)
    const newTodoItem = updatedTodos[updatedTodos.length - 1];
    if (newTodoItem) {
      stageRowEdit({ 
        id: newTodoItem.id, 
        patch: { 
          id: newTodoItem.id, 
          task: newTodoItem.task, 
          category: newTodoItem.category, 
          priority: newTodoItem.priority,
          statusUi: newTodoItem.statusUi
        } 
      });
      
      // Update staged count
      const staged = getStagedChanges();
      setStagedCount(staged.updates.length + staged.completes.length);
    }
    
    setNewTodo({ task: '', category: '', priority: null });
  };

  const updateTodo = (id: string, updates: Partial<Todo>) => {
    // Local working copy update
    const updatedTodos = todos.map(todo =>
      todo.id === id ? { ...todo, ...updates, _dirty: true } : todo
    );
    setTodos(updatedTodos);
    
    // Update staged count if this was a priority change
    if (updates.priority !== undefined) {
      const staged = getStagedChanges();
      setStagedCount(staged.updates.length + staged.completes.length);
    }
  };

  const commitRowEdit = (id: string, patch: TodoPatch) => {
    stageRowEdit({ id, patch });
    const staged = getStagedChanges();
    setStagedCount(staged.updates.length + staged.completes.length);
    // Mark as not editing
    setEditingId(null);
  };

  const completeTodo = (id: string) => {
    stageComplete({ id });
    const staged = getStagedChanges();
    setStagedCount(staged.updates.length + staged.completes.length);
    // Hide row from current view
    setTodos(prev => prev.filter(t => String(t.id) !== String(id)));
  };

  const handleEditStart = (id: string) => {
    setEditingId(id);
  };

  const handleEditEnd = () => {
    setEditingId(null);
  };

  if (loading) {
    return (
      <div className={tokens.layout.container}>
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <div className={tokens.palette.dark.text_muted}>Loading todos from webhook...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
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
    <div className={tokens.layout.container}>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
            To-Dos ({filteredTodos.length})
          </h2>
          <div className="flex gap-2">
            <button
              onClick={saveBatch}
              disabled={stagedCount === 0 || loading}
              className={cn(tokens.button.base, tokens.button.primary, (stagedCount === 0 || loading) && 'opacity-50 cursor-not-allowed')}
            >
              {loading ? 'Saving...' : (stagedCount > 0 ? `Save (${stagedCount})` : 'Save')}
            </button>
          </div>
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
        onCommitRowEdit={commitRowEdit}
      />

      {/* Add new todo form (moved below table) */}
      <div className={cn(tokens.card.base, 'mt-6')}>
        <h3 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, 'mb-3', tokens.palette.dark.text)}>
          Add New Todo
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
            value={(newTodo.priority as Priority) ?? null}
            onChange={(p) => setNewTodo({ ...newTodo, priority: p })}
            ariaLabel="Set priority"
            placeholderLabel="Priority"
          />
          <button
            onClick={addTodo}
            className={cn(tokens.button.base, tokens.button.primary)}
          >
            Add Todo
          </button>
        </div>
      </div>
    </div>
  );
};
