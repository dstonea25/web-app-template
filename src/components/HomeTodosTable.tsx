import React from 'react';
import type { Todo } from '../types';
import { tokens, cn } from '../theme/config';

interface HomeTodosTableProps {
  todos: Todo[];
  sortBy: keyof Todo | '';
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: keyof Todo | '') => void;
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  onComplete: (id: string) => void;
}

export const HomeTodosTable: React.FC<HomeTodosTableProps> = ({
  todos,
  sortBy,
  sortOrder,
  onSortChange,
  onSortOrderChange,
  onComplete,
}) => {
  const priorityRank = (p: Todo['priority']) => {
    switch (p) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  };

  const sorted = [...todos].sort((a, b) => {
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

  return (
    <div className="space-y-4">
      {/* Mobile cards (show on small screens only) */}
      <div className="sm:hidden space-y-3">
        {sorted.length === 0 ? (
          <div className={cn(tokens.card.base, 'text-center text-neutral-400')}>No todos found.</div>
        ) : (
          sorted.map((todo) => (
            <div key={todo.id} className={cn(tokens.card.base, 'flex flex-col gap-3 text-neutral-100')}>
              <div className="break-words">{todo.task || ''}</div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <div className={cn('text-neutral-100', 'text-xs mb-1')}>Category</div>
                  <div className={cn(tokens.badge.base, tokens.badge.neutral, 'max-w-full truncate')}>{todo.category || '—'}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-neutral-400 mr-1">Priority:</span>
                    <span className="text-neutral-100">{todo.priority || '—'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 mr-1">Effort:</span>
                    <span className="text-neutral-100">{todo.effort || '—'}</span>
                  </div>
                </div>
                <div>
                  <div className={cn('text-neutral-100', 'text-xs mb-1')}>Due Date</div>
                  <div className="text-neutral-100">{todo.due_date || '—'}</div>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => onComplete(String(todo.id!))}
                  className={cn(tokens.button.base, tokens.button.success, 'text-sm')}
                  aria-label="Complete task"
                >
                  Complete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table (hidden on small screens) */}
      <div className={cn(tokens.table.wrapper, 'hidden sm:block')}> 
        <table className={tokens.table.table}>
          <thead className={tokens.table.thead}>
            <tr>
              <th
                className={tokens.table.th}
                aria-sort={sortBy === 'task' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <button
                  type="button"
                  className={tokens.button.ghost}
                  aria-label="Sort by Task"
                  aria-pressed={sortBy === 'task'}
                  onClick={() => {
                    if (sortBy === 'task') {
                      onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      onSortChange('task');
                      onSortOrderChange('asc');
                    }
                  }}
                >
                  Task
                </button>
              </th>
              <th
                className={tokens.table.th}
                aria-sort={sortBy === 'category' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <button
                  type="button"
                  className={tokens.button.ghost}
                  aria-label="Sort by Category"
                  aria-pressed={sortBy === 'category'}
                  onClick={() => {
                    if (sortBy === 'category') {
                      onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      onSortChange('category');
                      onSortOrderChange('asc');
                    }
                  }}
                >
                  Category
                </button>
              </th>
              <th
                className={tokens.table.th}
                aria-sort={sortBy === 'priority' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <button
                  type="button"
                  className={tokens.button.ghost}
                  aria-label="Sort by Priority"
                  aria-pressed={sortBy === 'priority'}
                  onClick={() => {
                    if (sortBy === 'priority') {
                      onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      onSortChange('priority');
                      onSortOrderChange('desc');
                    }
                  }}
                >
                  Priority
                </button>
              </th>
              <th
                className={tokens.table.th}
                aria-sort={sortBy === 'effort' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <button
                  type="button"
                  className={tokens.button.ghost}
                  aria-label="Sort by Effort"
                  aria-pressed={sortBy === 'effort'}
                  onClick={() => {
                    if (sortBy === 'effort') {
                      onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      onSortChange('effort');
                      onSortOrderChange('asc');
                    }
                  }}
                >
                  Effort
                </button>
              </th>
              <th
                className={tokens.table.th}
                aria-sort={sortBy === 'due_date' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <button
                  type="button"
                  className={tokens.button.ghost}
                  aria-label="Sort by Due Date"
                  aria-pressed={sortBy === 'due_date'}
                  onClick={() => {
                    if (sortBy === 'due_date') {
                      onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      onSortChange('due_date');
                      onSortOrderChange('asc');
                    }
                  }}
                >
                  Due Date
                </button>
              </th>
              <th className={tokens.table.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className={tokens.table.empty_state}>No todos found.</td>
              </tr>
            ) : (
              sorted.map((todo) => (
                <tr key={todo.id} className={cn(tokens.table.tr_zebra, tokens.table.row_hover)}>
                  <td className={tokens.table.td}>{todo.task || ''}</td>
                  <td className={tokens.table.td}>{todo.category || ''}</td>
                  <td className={tokens.table.td}>{todo.priority || ''}</td>
                  <td className={tokens.table.td}>{todo.effort || ''}</td>
                  <td className={tokens.table.td}>{todo.due_date || ''}</td>
                  <td className={tokens.table.td}>
                    <button
                      onClick={() => onComplete(String(todo.id!))}
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

export default HomeTodosTable;


