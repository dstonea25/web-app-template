import React, { useState, useEffect } from 'react';
import type { Todo, Priority, TodoPatch } from '../types';
import { StorageManager, stageRowEdit, stageComplete, getStagedChanges } from '../lib/storage';
import { applyFileSave, getWorkingTodos } from '../lib/storage';
import { addTodo as storageAddTodo } from '../lib/storage';
import { tokens, cn } from '../theme/config';
import SelectPriority from '../components/SelectPriority';
import { TodosTable } from '../components/TodosTable';
import { CategoryTabs } from '../components/CategoryTabs';
// Example only: toast.success('Saved N items')
// import { toast } from '../lib/notifications/toast';

export const TodosTab: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<keyof Todo>('created_at');
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
      // Clear localStorage to force fresh data load
      StorageManager.clearAll();
      
      // Load from seed data
      console.log('Loading from seed data...');
      const response = await fetch('/data/todos.json');
      const seedTodos = await response.json();
      console.log('Seed todos loaded:', seedTodos);
      // Ensure transforms on load (priority/id/status handling) by saving then reloading
      StorageManager.saveTodos(seedTodos);
      const transformed = StorageManager.loadTodos();
      setTodos(transformed);
      const staged = getStagedChanges();
      setStagedCount(staged.updates.length + staged.completes.length);
    } catch (error) {
      console.error('Failed to load todos:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveBatch = async () => {
    try {
      const result = await applyFileSave();
      if (result.ok) {
        const next = getWorkingTodos();
        setTodos(next);
        setStagedCount(0);
      } else {
        alert('Failed to save');
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      alert('Failed to save');
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
    setNewTodo({ task: '', category: '', priority: null });
  };

  const updateTodo = (id: string, updates: Partial<Todo>) => {
    // Local working copy update
    const updatedTodos = todos.map(todo =>
      todo.id === id ? { ...todo, ...updates, _dirty: true } : todo
    );
    setTodos(updatedTodos);
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
          <div className="text-slate-400">Loading todos...</div>
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
          <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, 'text-slate-100')}>
            To-Dos ({filteredTodos.length})
          </h2>
          <button
            onClick={saveBatch}
            disabled={stagedCount === 0}
            className={cn(tokens.button.base, tokens.button.primary, stagedCount === 0 && 'opacity-50 cursor-not-allowed')}
          >
            {stagedCount > 0 ? `Save (${stagedCount})` : 'Save'}
          </button>
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
        <h3 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, 'mb-3 text-slate-100')}>
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
          <input
            type="text"
            placeholder="Category"
            value={(newTodo.category as string) || ''}
            onChange={(e) => setNewTodo({ ...newTodo, category: e.target.value })}
            className={cn(tokens.input.base, tokens.input.focus)}
          />
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
