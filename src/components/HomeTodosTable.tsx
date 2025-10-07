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
      case 'crucial': return 4;
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
      <div className={tokens.table.wrapper}>
        <table className={tokens.table.table}>
          <thead className={tokens.table.thead}>
            <tr>
              <th className={tokens.table.th} aria-sort="none">Task</th>
              <th className={tokens.table.th} aria-sort="none">Category</th>
              <th className={tokens.table.th} aria-sort={sortBy === 'priority' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
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
              <th className={tokens.table.th} aria-sort="none">Effort</th>
              <th className={tokens.table.th} aria-sort="none">Due Date</th>
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


