import React, { useRef, useEffect } from 'react';
import { ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import type { Idea, IdeaPatch } from '../types';
import { tokens, cn } from '../theme/config';

interface IdeasTableProps {
  ideas: Idea[];
  filter: string;
  sortBy: keyof Idea | '';
  sortOrder: 'asc' | 'desc';
  editingId: string | null;
  onFilterChange: (filter: string) => void;
  onSortChange: (sortBy: keyof Idea | '') => void;
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  onEditStart: (id: string) => void;
  onEditEnd: () => void;
  onIdeaUpdate: (id: string, updates: Partial<Idea>) => void;
  onIdeaComplete: (id: string) => void;
  onCommitRowEdit: (id: string, patch: IdeaPatch) => void;
}

export const IdeasTable: React.FC<IdeasTableProps> = ({
  ideas,
  filter,
  sortBy,
  sortOrder,
  editingId,
  onFilterChange,
  onSortChange,
  onSortOrderChange,
  onEditStart,
  onEditEnd,
  onIdeaUpdate,
  onIdeaComplete,
  onCommitRowEdit,
}) => {
  const tableRef = useRef<HTMLTableElement>(null);
  const editingCellRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const filteredAndSortedIdeas = ideas
    .filter(idea => {
      // Add safety check for idea object
      if (!idea || typeof idea !== 'object') {
        console.warn('Invalid idea object:', idea);
        return false;
      }
      return (idea.idea || '').toLowerCase().includes(filter.toLowerCase()) ||
             (idea.category || '').toLowerCase().includes(filter.toLowerCase()) ||
             (idea.notes || '').toLowerCase().includes(filter.toLowerCase());
    })
    .sort((a, b) => {
      // If no sort is selected, keep original order
      if (!sortBy) return 0;
      
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
  const handleKeyDown = (e: React.KeyboardEvent, ideaObj: Idea) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      
      const currentIndex = filteredAndSortedIdeas.findIndex(idea => idea.id === ideaObj.id);
      const nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
      
      if (nextIndex >= 0 && nextIndex < filteredAndSortedIdeas.length) {
        const nextIdea = filteredAndSortedIdeas[nextIndex];
        onEditStart(String(nextIdea.id!));
      } else {
        // If at the end/beginning, commit current edit and move to next/previous row
        onCommitRowEdit(String(ideaObj.id!), { 
          id: String(ideaObj.id!), 
          idea: ideaObj.idea, 
          category: ideaObj.category ?? null, 
          notes: ideaObj.notes 
        });
        if (nextIndex >= 0 && nextIndex < filteredAndSortedIdeas.length) {
          const nextIdea = filteredAndSortedIdeas[nextIndex];
          onEditStart(String(nextIdea.id!));
        }
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onCommitRowEdit(String(ideaObj.id!), { 
        id: String(ideaObj.id!), 
        idea: ideaObj.idea, 
        category: ideaObj.category ?? null, 
        notes: ideaObj.notes 
      });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onEditEnd();
    }
  };

  const handleBlurCommit = (ideaObj: Idea) => {
    onCommitRowEdit(String(ideaObj.id!), { id: String(ideaObj.id!), idea: ideaObj.idea, category: ideaObj.category ?? null, notes: ideaObj.notes });
  };


  return (
    <div className="space-y-4">
      {/* Live region for announcing sort changes */}
      <div className="sr-only" role="status" aria-live="polite">
        {sortBy ? `Sorted by ${sortBy === 'created_at' ? 'Created' : sortBy}, ${sortOrder === 'asc' ? 'ascending' : 'descending'}. ${filteredAndSortedIdeas.length} items.` : `${filteredAndSortedIdeas.length} items.`}
      </div>
      {/* Filter and Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Filter ideas..."
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className={cn(tokens.input.base, tokens.input.focus)}
        />
        <select
          value={sortBy || ''}
          onChange={(e) => onSortChange(e.target.value as keyof Idea | '')}
          className={cn(tokens.input.base, tokens.input.focus, !sortBy && 'text-neutral-400')}
          style={!sortBy ? { color: '#9ca3af' } : {}}
        >
          <option value="" style={{ color: '#9ca3af' }}>Sort by...</option>
          <option value="idea">Sort by Idea</option>
          <option value="category">Sort by Category</option>
          <option value="created_at">Sort by Created</option>
        </select>
        <button
          onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
          className={cn(tokens.button.base, tokens.button.secondary)}
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {/* Ideas Table */}
      <div className={tokens.table.wrapper}>
        <table ref={tableRef} className={tokens.table.table}>
          <thead className={tokens.table.thead}>
            <tr>
              <th className={tokens.table.th} aria-sort="none">Idea</th>
              <th className={tokens.table.th} aria-sort="none">Notes</th>
              {/* Created sortable header */}
              <th
                className={tokens.table.th}
                aria-sort={sortBy === 'created_at' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <button
                  type="button"
                  className={tokens.button.ghost}
                  aria-label="Sort by Created"
                  aria-pressed={sortBy === 'created_at'}
                  aria-describedby="created-sort-description"
                  onClick={() => {
                    if (sortBy === 'created_at') {
                      onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      onSortChange('created_at');
                      onSortOrderChange('desc');
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      if (sortBy === 'created_at') {
                        onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        onSortChange('created_at');
                        onSortOrderChange('desc');
                      }
                    }
                  }}
                >
                  <span className="inline-flex items-center gap-1">
                    Created
                    {sortBy === 'created_at' ? (
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
                <span id="created-sort-description" className="sr-only">
                  {sortBy === 'created_at' ? `Currently sorted ${sortOrder === 'asc' ? 'ascending' : 'descending'}` : 'Not sorted'}
                </span>
              </th>
              <th className={tokens.table.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedIdeas.length === 0 ? (
              <tr>
                <td colSpan={4} className={tokens.table.empty_state}>
                  No ideas found. Add one above!
                </td>
              </tr>
            ) : (
              filteredAndSortedIdeas.map((idea) => (
                <tr key={idea.id} className={cn(tokens.table.tr_zebra, tokens.table.row_hover)}>
                  <td className={cn(tokens.table.td)}>
                    <div className={cn(tokens.editable?.cell, 'rounded-none')}>
                      {editingId === idea.id ? (
                        <input
                          ref={(el) => { editingCellRef.current = el; }}
                          type="text"
                          value={idea.idea || ''}
                          onChange={(e) => onIdeaUpdate(String(idea.id!), { idea: e.target.value })}
                          className={cn(tokens.editable?.input || tokens.input.base, tokens.input.focus)}
                          onBlur={() => handleBlurCommit(idea)}
                          onKeyDown={(e) => handleKeyDown(e, idea)}
                          autoFocus
                        />
                      ) : (
                        <span
                          className={cn('cursor-pointer', tokens.accent.text_hover)}
                          onClick={() => onEditStart(String(idea.id!))}
                          aria-label="Edit idea"
                        >
                          {idea.idea || ''}
                        </span>
                      )}
                    </div>
                  </td>
                  
                  <td className={tokens.table.td}>
                    <div className={cn(tokens.editable?.cell, 'rounded-none')}>
                      {editingId === idea.id ? (
                        <textarea
                          ref={(el) => { editingCellRef.current = el; }}
                          value={idea.notes || ''}
                          onChange={(e) => onIdeaUpdate(String(idea.id!), { notes: e.target.value })}
                          className={cn(tokens.editable?.input || tokens.input.base, tokens.input.focus, 'resize-none min-h-[100px]')}
                          onBlur={() => handleBlurCommit(idea)}
                          onKeyDown={(e) => handleKeyDown(e, idea)}
                          rows={idea.notes && idea.notes.length > 50 ? 5 : 3}
                        />
                      ) : (
                        <span
                          className={cn('cursor-pointer block', tokens.accent.text_hover)}
                          onClick={() => onEditStart(String(idea.id!))}
                          aria-label="Edit notes"
                          style={{ 
                            minHeight: idea.notes && idea.notes.length > 50 ? '60px' : 'auto',
                            whiteSpace: 'pre-wrap'
                          }}
                        >
                          {idea.notes || ''}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={tokens.table.td}>
                    {idea.created_at ? new Date(idea.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className={tokens.table.td}>
                    <button
                      onClick={() => onIdeaComplete(String(idea.id!))}
                      className={cn(tokens.button.base, tokens.button.danger, 'text-sm')}
                      aria-label="Remove idea"
                    >
                      Remove
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
