/**
 * Component Showcase Tab
 * 
 * This tab demonstrates the available UI components and design tokens.
 * Use it as a reference when building your app.
 */

import React, { useState } from 'react';
import { 
  Star, 
  Check, 
  X, 
  AlertCircle, 
  Info,
  ChevronDown,
  Plus,
  Trash2,
  Edit,
  Bell
} from 'lucide-react';
import { tokens, cn, palette, theme } from '../theme/config';
import { toast } from '../lib/notifications/toast';

interface ShowcaseTabProps {
  isVisible?: boolean;
}

export const ShowcaseTab: React.FC<ShowcaseTabProps> = ({ isVisible }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectValue, setSelectValue] = useState('option1');
  
  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [items, setItems] = useState([
    { id: '1', name: 'Click to edit this text', status: 'active' },
    { id: '2', name: 'Tab to navigate between rows', status: 'pending' },
    { id: '3', name: 'Enter to save, Escape to cancel', status: 'done' },
  ]);

  if (!isVisible) return null;

  const c = theme.colors;
  
  // Inline edit handlers
  const handleItemChange = (id: string, value: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, name: value } : item));
  };
  
  const handleCommit = (_id: string) => {
    setEditingId(null);
    toast.success('Saved changes');
  };
  
  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      handleCommit(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleCommit(id);
      const currentIndex = items.findIndex(item => item.id === id);
      const nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex >= 0 && nextIndex < items.length) {
        setEditingId(items[nextIndex].id);
      }
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Buttons Section */}
      <section className={tokens.card.base}>
        <h2 className={cn('text-xl font-semibold mb-4', palette.text)}>Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <button className={cn(tokens.button.base, tokens.button.primary)}>
            <Plus className="w-4 h-4 mr-2" />
            Primary
          </button>
          <button className={cn(tokens.button.base, tokens.button.secondary)}>
            Secondary
          </button>
          <button className={cn(tokens.button.base, tokens.button.ghost)}>
            Ghost
          </button>
          <button className={cn(tokens.button.base, tokens.button.danger)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Danger
          </button>
          <button className={cn(tokens.button.base, tokens.button.info)}>
            Info
          </button>
        </div>
        
        <h3 className={cn('text-lg font-medium mt-6 mb-3', `text-${c.neutral}-200`)}>Icon-only buttons</h3>
        <div className="flex gap-2">
          <button className={cn(tokens.button.base, tokens.button.secondary, 'px-2')}>
            <Edit className="w-4 h-4" />
          </button>
          <button className={cn(tokens.button.base, tokens.button.ghost, 'px-2')}>
            <Star className="w-4 h-4" />
          </button>
          <button className={cn(tokens.button.base, tokens.button.danger, 'px-2')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Toast Section */}
      <section className={tokens.card.base}>
        <h2 className={cn('text-xl font-semibold mb-4', palette.text)}>Toasts</h2>
        <p className={cn('mb-4', tokens.text.muted)}>
          Global notification system. Import <code className={palette.accentText}>toast</code> from <code className={palette.accentText}>lib/notifications/toast</code>.
        </p>
        <div className="flex flex-wrap gap-3">
          <button 
            className={cn(tokens.button.base, tokens.button.success)}
            onClick={() => toast.success('Changes saved successfully!')}
          >
            <Check className="w-4 h-4 mr-2" />
            Success Toast
          </button>
          <button 
            className={cn(tokens.button.base, tokens.button.danger)}
            onClick={() => toast.error('Something went wrong')}
          >
            <X className="w-4 h-4 mr-2" />
            Error Toast
          </button>
          <button 
            className={cn(tokens.button.base, tokens.button.info)}
            onClick={() => toast.info('Here is some information', { 
              actionLabel: 'Undo', 
              onAction: () => toast.success('Undone!') 
            })}
          >
            <Bell className="w-4 h-4 mr-2" />
            Info with Action
          </button>
        </div>
      </section>

      {/* Inline Editing Section */}
      <section className={tokens.card.base}>
        <h2 className={cn('text-xl font-semibold mb-4', palette.text)}>Inline Editing</h2>
        <p className={cn('mb-4', tokens.text.muted)}>
          Click text to edit. Tab to navigate. Enter/blur to save. Escape to cancel.
        </p>
        <div className={tokens.table.wrapper}>
          <table className={tokens.table.table}>
            <thead className={tokens.table.thead}>
              <tr>
                <th className={tokens.table.th}>Name (click to edit)</th>
                <th className={tokens.table.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={cn(tokens.table.tr_zebra, tokens.table.row_hover)}>
                  <td className={tokens.table.td}>
                    {editingId === item.id ? (
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemChange(item.id, e.target.value)}
                        onBlur={() => handleCommit(item.id)}
                        onKeyDown={(e) => handleKeyDown(e, item.id)}
                        className={cn(tokens.input.base, tokens.input.focus, 'py-1')}
                        autoFocus
                      />
                    ) : (
                      <span 
                        onClick={() => setEditingId(item.id)}
                        className={cn('cursor-pointer', palette.primaryTextHover)}
                      >
                        {item.name}
                      </span>
                    )}
                  </td>
                  <td className={tokens.table.td}>
                    <span className={cn(
                      tokens.badge.base,
                      item.status === 'active' ? tokens.badge.success :
                      item.status === 'pending' ? tokens.badge.warning :
                      tokens.badge.neutral
                    )}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Inputs Section */}
      <section className={tokens.card.base}>
        <h2 className={cn('text-xl font-semibold mb-4', palette.text)}>Form Inputs</h2>
        
        <div className="space-y-4 max-w-md">
          <div>
            <label className={cn('block mb-1', tokens.text.label)}>Text Input</label>
            <input 
              type="text" 
              placeholder="Enter text..."
              className={cn(tokens.input.base, tokens.input.focus)}
            />
          </div>
          
          <div>
            <label className={cn('block mb-1', tokens.text.label)}>Date Input</label>
            <input 
              type="date" 
              className={cn(tokens.input.date, tokens.input.focus)}
            />
          </div>
          
          <div>
            <label className={cn('block mb-1', tokens.text.label)}>Select</label>
            <div className={tokens.select.wrapper}>
              <select 
                className={tokens.select.base}
                value={selectValue}
                onChange={(e) => setSelectValue(e.target.value)}
              >
                <option value="option1">Option 1</option>
                <option value="option2">Option 2</option>
                <option value="option3">Option 3</option>
              </select>
              <ChevronDown className={tokens.select.chevron} />
            </div>
          </div>
          
          <div>
            <label className={cn('block mb-1', tokens.text.label)}>Textarea</label>
            <textarea 
              placeholder="Enter longer text..."
              rows={3}
              className={cn(tokens.input.base, tokens.input.focus)}
            />
          </div>
        </div>
      </section>

      {/* Badges Section */}
      <section className={tokens.card.base}>
        <h2 className={cn('text-xl font-semibold mb-4', palette.text)}>Badges</h2>
        <div className="flex flex-wrap gap-2">
          <span className={cn(tokens.badge.base, tokens.badge.neutral)}>Neutral</span>
          <span className={cn(tokens.badge.base, tokens.badge.success)}>
            <Check className="w-3 h-3 mr-1" />
            Success
          </span>
          <span className={cn(tokens.badge.base, tokens.badge.warning)}>
            <AlertCircle className="w-3 h-3 mr-1" />
            Warning
          </span>
          <span className={cn(tokens.badge.base, tokens.badge.danger)}>
            <X className="w-3 h-3 mr-1" />
            Danger
          </span>
        </div>
      </section>

      {/* Cards Section */}
      <section className={tokens.card.base}>
        <h2 className={cn('text-xl font-semibold mb-4', palette.text)}>Cards</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={tokens.card.base}>
            <h3 className={cn('font-medium mb-2', palette.text)}>Card Title</h3>
            <p className={tokens.text.muted}>
              This is a basic card component with the default styling.
            </p>
          </div>
          <div className={tokens.card.highlighted}>
            <h3 className={cn('font-medium mb-2', palette.primaryText)}>Highlighted Card</h3>
            <p className={tokens.text.muted}>
              Cards can have custom border colors for emphasis.
            </p>
          </div>
        </div>
      </section>

      {/* Table Section */}
      <section className={tokens.card.base}>
        <h2 className={cn('text-xl font-semibold mb-4', palette.text)}>Table</h2>
        <div className={tokens.table.wrapper}>
          <table className={tokens.table.table}>
            <thead className={tokens.table.thead}>
              <tr>
                <th className={tokens.table.th}>Name</th>
                <th className={tokens.table.th}>Status</th>
                <th className={tokens.table.th}>Date</th>
                <th className={tokens.table.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Item One', status: 'Active', date: '2026-01-28' },
                { name: 'Item Two', status: 'Pending', date: '2026-01-27' },
                { name: 'Item Three', status: 'Completed', date: '2026-01-26' },
              ].map((item, i) => (
                <tr key={i} className={cn(tokens.table.tr_zebra, tokens.table.row_hover)}>
                  <td className={tokens.table.td}>{item.name}</td>
                  <td className={tokens.table.td}>
                    <span className={cn(
                      tokens.badge.base,
                      item.status === 'Active' ? tokens.badge.success :
                      item.status === 'Pending' ? tokens.badge.warning :
                      tokens.badge.neutral
                    )}>
                      {item.status}
                    </span>
                  </td>
                  <td className={tokens.table.td}>{item.date}</td>
                  <td className={tokens.table.td}>
                    <button className={cn(tokens.button.base, tokens.button.ghost, 'px-2 py-1 text-sm')}>
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Section */}
      <section className={tokens.card.base}>
        <h2 className={cn('text-xl font-semibold mb-4', palette.text)}>Modal</h2>
        <button 
          className={cn(tokens.button.base, tokens.button.primary)}
          onClick={() => setModalOpen(true)}
        >
          Open Modal
        </button>
        
        {modalOpen && (
          <>
            <div 
              className={tokens.modal.overlay}
              onClick={() => setModalOpen(false)}
            />
            <div className={tokens.modal.content}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={cn('text-lg font-semibold', palette.text)}>Modal Title</h3>
                <button 
                  className={cn(tokens.button.base, tokens.button.ghost, 'px-2')}
                  onClick={() => setModalOpen(false)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className={cn('mb-4', `text-${c.neutral}-300`)}>
                This is a modal dialog. Click outside or the X to close.
              </p>
              <div className="flex justify-end gap-2">
                <button 
                  className={cn(tokens.button.base, tokens.button.secondary)}
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  className={cn(tokens.button.base, tokens.button.primary)}
                  onClick={() => setModalOpen(false)}
                >
                  Confirm
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Color Palette Section */}
      <section className={tokens.card.base}>
        <h2 className={cn('text-xl font-semibold mb-4', palette.text)}>Color Palette</h2>
        <p className={cn('mb-4', tokens.text.muted)}>
          Change colors in <code className={palette.accentText}>src/theme/config.ts</code> - 
          update the <code className={palette.accentText}>colors</code> object at the top.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-2">
            <div className={cn('h-12 rounded-lg', palette.primaryBg)} />
            <p className={tokens.text.muted}>Primary ({c.primary})</p>
          </div>
          <div className="space-y-2">
            <div className={cn('h-12 rounded-lg', palette.accentBg)} />
            <p className={tokens.text.muted}>Accent ({c.accent})</p>
          </div>
          <div className="space-y-2">
            <div className={cn('h-12 rounded-lg', palette.warningBg)} />
            <p className={tokens.text.muted}>Warning ({c.warning})</p>
          </div>
          <div className="space-y-2">
            <div className={cn('h-12 rounded-lg', palette.dangerBg)} />
            <p className={tokens.text.muted}>Danger ({c.danger})</p>
          </div>
        </div>
        
        <h3 className={cn('text-lg font-medium mt-6 mb-3', `text-${c.neutral}-200`)}>Neutrals</h3>
        <div className="flex gap-2">
          {[950, 900, 800, 700, 600, 400, 200, 100].map(shade => (
            <div 
              key={shade}
              className={`flex-1 h-8 rounded bg-${c.neutral}-${shade}`} 
              title={`${c.neutral}-${shade}`} 
            />
          ))}
        </div>
      </section>

      {/* Typography Section */}
      <section className={tokens.card.base}>
        <h2 className={cn('text-xl font-semibold mb-4', palette.text)}>Typography</h2>
        <div className="space-y-3">
          <h1 className={cn(theme.typography.scale.h1, 'font-bold', palette.text)}>Heading 1</h1>
          <h2 className={cn(theme.typography.scale.h2, 'font-semibold', palette.text)}>Heading 2</h2>
          <h3 className={cn(theme.typography.scale.h3, 'font-semibold', palette.text)}>Heading 3</h3>
          <p className={tokens.text.body}>Body text - regular</p>
          <p className={tokens.text.muted}>Muted text - smaller size</p>
        </div>
      </section>

      {/* Info Box */}
      <section className={cn(tokens.card.base, palette.accentBorder, palette.accentBgSubtle)}>
        <div className="flex gap-3">
          <Info className={cn('w-5 h-5 shrink-0 mt-0.5', palette.accentText)} />
          <div>
            <h3 className={cn('font-medium mb-1', `text-${c.accent}-300`)}>Using Components</h3>
            <p className={cn('text-sm', `text-${c.neutral}-300`)}>
              Import <code className={palette.accentText}>tokens</code> and <code className={palette.accentText}>palette</code> from 
              <code className={palette.accentText}> src/theme/config.ts</code>. Use the{' '}
              <code className={palette.accentText}>cn()</code> utility to combine class names.
              See <code className={palette.accentText}>AGENT.md</code> for full documentation.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
