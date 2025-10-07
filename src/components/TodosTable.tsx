import React, { useRef, useEffect } from 'react';
import { ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import type { Todo, Priority, TodoPatch, Effort } from '../types';
import { tokens, cn } from '../theme/config';
// Removed unused import: stageRowEdit
import SelectPriority from './SelectPriority';

interface TodosTableProps {
  todos: Todo[];
  filter: string;
  sortBy: keyof Todo | '';
  sortOrder: 'asc' | 'desc';
  editingId: string | null;
  onFilterChange: (filter: string) => void;
  onSortChange: (sortBy: keyof Todo | '') => void;
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  onEditStart: (id: string) => void;
  onEditEnd: () => void;
  onTodoUpdate: (id: string, updates: Partial<Todo>) => void;
  onTodoComplete: (id: string) => void;
  onCommitRowEdit: (id: string, patch: TodoPatch) => void;
  showCategory?: boolean;
}

export const TodosTable: React.FC<TodosTableProps> = ({
  todos,
  filter,
  sortBy,
  sortOrder,
  editingId,
  onFilterChange,
  onSortChange,
  onSortOrderChange,
  onEditStart,
  onEditEnd,
  onTodoUpdate,
  onTodoComplete,
  onCommitRowEdit,
  showCategory = false,
}) => {
  const tableRef = useRef<HTMLTableElement>(null);
  const editingCellRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  const priorityRank = (p: Priority | undefined) => {
    switch (p) {
      case 'crucial': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  };

  const filteredAndSortedTodos = todos
    .filter(todo => {
      // Add safety check for todo object
      if (!todo || typeof todo !== 'object') {
        console.warn('Invalid todo object:', todo);
        return false;
      }
      return (todo.task || '').toLowerCase().includes(filter.toLowerCase()) ||
             (todo.category || '').toLowerCase().includes(filter.toLowerCase());
    })
    .sort((a, b) => {
      // If no sort is selected, keep original order
      if (!sortBy) return 0;
      
      if (sortBy === 'priority') {
        const cmp = priorityRank(a.priority) - priorityRank(b.priority);
        return sortOrder === 'asc' ? cmp : -cmp;
      }
      const aVal = (a as any)[sortBy] || '';
      const bVal = (b as any)[sortBy] || '';
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Focus the editing cell when editing starts
  useEffect(() => {
    if (editingId && editingCellRef.current) {
      editingCellRef.current.focus();
    }
  }, [editingId]);

  // Handle Tab/Shift+Tab navigation between editable cells
  const handleKeyDown = (e: React.KeyboardEvent, todoObj: Todo) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      
      const currentIndex = filteredAndSortedTodos.findIndex(todo => todo.id === todoObj.id);
      const nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
      
      if (nextIndex >= 0 && nextIndex < filteredAndSortedTodos.length) {
        const nextTodo = filteredAndSortedTodos[nextIndex];
        onEditStart(String(nextTodo.id!));
      } else {
        // If at the end/beginning, commit current edit and move to next/previous row
        onCommitRowEdit(String(todoObj.id!), { id: String(todoObj.id!), task: todoObj.task, category: todoObj.category ?? null, priority: todoObj.priority, statusUi: todoObj.statusUi });
        if (nextIndex >= 0 && nextIndex < filteredAndSortedTodos.length) {
          const nextTodo = filteredAndSortedTodos[nextIndex];
          onEditStart(String(nextTodo.id!));
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onCommitRowEdit(String(todoObj.id!), { id: String(todoObj.id!), task: todoObj.task, category: todoObj.category ?? null, priority: todoObj.priority, statusUi: todoObj.statusUi });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onEditEnd();
    }
  };

  const handleBlurCommit = (todoObj: Todo) => {
    // Stage the change for saving when editing ends
    onTodoUpdate(String(todoObj.id!), { task: todoObj.task });
  };

  return (
    <div className="space-y-4">
      {/* Live region for announcing sort changes */}
      <div className="sr-only" role="status" aria-live="polite">
        {sortBy ? `Sorted by ${sortBy === 'priority' ? 'Priority' : String(sortBy)}, ${sortOrder === 'asc' ? 'ascending' : 'descending'}. ${filteredAndSortedTodos.length} items.` : `${filteredAndSortedTodos.length} items.`}
      </div>
      {/* Filter and Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Filter todos..."
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className={cn(tokens.input.base, tokens.input.focus)}
        />
        <select
          value={sortBy || ''}
          onChange={(e) => onSortChange(e.target.value as keyof Todo | '')}
          className={cn(tokens.input.base, tokens.input.focus, !sortBy && 'text-neutral-400')}
          style={!sortBy ? { color: '#9ca3af' } : {}}
        >
          <option value="" style={{ color: '#9ca3af' }}>Sort by...</option>
          <option value="task">Sort by Task</option>
          <option value="priority">Sort by Priority</option>
        </select>
        <button
          onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
          className={cn(tokens.button.base, tokens.button.secondary)}
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {/* Todos Table */}
      <div className={tokens.table.wrapper}>
        <table ref={tableRef} className={tokens.table.table}>
          <thead className={tokens.table.thead}>
            <tr>
              <th className={tokens.table.th} aria-sort="none">Task</th>
              {showCategory && (
                <th className={tokens.table.th} aria-sort="none">Category</th>
              )}
              {/* Priority sortable header */}
              <th
                className={tokens.table.th}
                aria-sort={sortBy === 'priority' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <button
                  type="button"
                  className={tokens.button.ghost}
                  aria-label="Sort by Priority"
                  aria-pressed={sortBy === 'priority'}
                  aria-describedby="priority-sort-description"
                  onClick={() => {
                    if (sortBy === 'priority') {
                      onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      onSortChange('priority');
                      onSortOrderChange('desc');
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      if (sortBy === 'priority') {
                        onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        onSortChange('priority');
                        onSortOrderChange('desc');
                      }
                    }
                  }}
                >
                  <span className="inline-flex items-center gap-1">
                    Priority
                    {sortBy === 'priority' ? (
                      sortOrder === 'asc' ? (
                        <ChevronUp className={tokens.icon.default} />
                      ) : (
                        <ChevronDown className={tokens.icon.default} />
                      )
                    ) : (
                      <ChevronsUpDown className={tokens.icon.default} />
                    )}
                  </span>
                </button>
                <span id="priority-sort-description" className="sr-only">
                  {sortBy === 'priority' ? `Currently sorted ${sortOrder === 'asc' ? 'ascending' : 'descending'}` : 'Not sorted'}
                </span>
              </th>
              <th className={tokens.table.th} aria-sort="none">Effort</th>
              <th className={tokens.table.th} aria-sort="none">Due Date</th>
              <th className={tokens.table.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedTodos.length === 0 ? (
              <tr>
                <td colSpan={showCategory ? 6 : 5} className={tokens.table.empty_state}>
                  No todos found. Add one above!
                </td>
              </tr>
            ) : (
              filteredAndSortedTodos.map((todo) => (
                <tr key={todo.id} className={cn(tokens.table.tr_zebra, tokens.table.row_hover)}>
                  <td className={cn(tokens.table.td)}>
                    <div className={cn(tokens.editable?.cell, 'rounded-none')}>
                      {editingId === todo.id ? (
                        <input
                          ref={(el) => { editingCellRef.current = el; }}
                          type="text"
                          value={todo.task || ''}
                          onChange={(e) => onTodoUpdate(String(todo.id!), { task: e.target.value })}
                          className={cn(tokens.editable?.input || tokens.input.base, tokens.input.focus)}
                          onBlur={() => handleBlurCommit(todo)}
                          onKeyDown={(e) => handleKeyDown(e, todo)}
                          autoFocus
                        />
                      ) : (
                        <span
                          className={cn('cursor-pointer', tokens.accent.text_hover)}
                          onClick={() => onEditStart(String(todo.id!))}
                          aria-label="Edit task"
                        >
                          {todo.task || ''}
                        </span>
                      )}
                    </div>
                  </td>
                  {showCategory && (
                    <td className={tokens.table.td}>
                      <div className={cn(tokens.editable?.cell, 'rounded-none')}>
                        {editingId === todo.id ? (
                          <input
                            ref={(el) => { editingCellRef.current = el; }}
                            type="text"
                            value={todo.category || ''}
                            onChange={(e) => onTodoUpdate(String(todo.id!), { category: e.target.value || null })}
                            className={cn(tokens.editable?.input || tokens.input.base, tokens.input.focus)}
                            onKeyDown={(e) => handleKeyDown(e, todo)}
                          />
                        ) : (
                          <span
                            className={cn('cursor-pointer', tokens.accent.text_hover)}
                            onClick={() => onEditStart(String(todo.id!))}
                            aria-label="Edit category"
                          >
                            {todo.category || ''}
                          </span>
                        )}
                      </div>
                    </td>
                  )}
                  {/* Status column removed per request */}
                  <td className={tokens.table.td}>
                    <SelectPriority
                      value={todo.priority ?? null}
                      onChange={(p) => { onTodoUpdate(String(todo.id!), { priority: p, _dirty: true }); }}
                      ariaLabel="Set priority"
                    />
                  </td>
                  <td className={tokens.table.td}>
                    <select
                      value={todo.effort || ''}
                      onChange={(e) => { onTodoUpdate(String(todo.id!), { effort: (e.target.value || null) as Effort, _dirty: true }); }}
                      className={cn(tokens.input.base, tokens.input.focus, !todo.effort && 'text-neutral-400')}
                      style={!todo.effort ? { color: '#9ca3af' } : {}}
                      aria-label="Set effort"
                    >
                      <option value="" style={{ color: '#9ca3af' }}></option>
                      <option value="S">S</option>
                      <option value="M">M</option>
                      <option value="L">L</option>
                    </select>
                  </td>
                  <td className={tokens.table.td}>
                    <input
                      type="date"
                      value={todo.due_date || ''}
                      onChange={(e) => { onTodoUpdate(String(todo.id!), { due_date: e.target.value || null, _dirty: true }); }}
                      className={cn(tokens.input.base, tokens.input.focus, !todo.due_date && 'date-empty')}
                      onClick={(e) => { const el = e.currentTarget as HTMLInputElement; (el as any).showPicker && (el as any).showPicker(); }}
                      aria-label="Set due date"
                    />
                  </td>
                  <td className={tokens.table.td}>
                    <button
                      onClick={() => onTodoComplete(String(todo.id!))}
                      className={cn(tokens.button.base, tokens.button.success, 'text-sm')}
                      aria-label="Complete task"
                    >
                      Complete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
