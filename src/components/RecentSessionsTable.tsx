import React, { useEffect, useState } from 'react';
import type { Session } from '../types';
import { tokens, cn } from '../theme/config';
import { getDateAtMidnight, addMinutes } from '../lib/time';

interface RecentSessionsTableProps {
  sessions: Session[];
  categories: ReadonlyArray<Session['category']>;
  onUpsert: (session: Session) => void;
  onDelete: (id: string) => void;
}

export const RecentSessionsTable: React.FC<RecentSessionsTableProps> = ({
  sessions,
  categories,
  onUpsert,
  onDelete,
}) => {
  type Draft = { date: string; category: Session['category']; hours: string; minutes: string };
  const [draftById, setDraftById] = useState<Record<string, Draft>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  // Build initial drafts from sessions
  useEffect(() => {
    const next: Record<string, Draft> = {};
    for (const s of sessions) {
      const d = new Date(s.startedAt);
      const date = d.toISOString().slice(0, 10); // yyyy-mm-dd
      const hrs = Math.floor((s.minutes || 0) / 60);
      const mins = (s.minutes || 0) % 60;
      next[s.id] = {
        date,
        category: s.category,
        hours: String(hrs),
        minutes: String(mins),
      };
    }
    setDraftById(next);
  }, [sessions]);

  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  const commit = (id: string) => {
    const s = sessions.find((x) => String(x.id) === String(id));
    if (!s) return;
    const d = draftById[id];
    if (!d) return;
    const hours = clamp(parseInt(d.hours || '0') || 0, 0, 23);
    const minutes = clamp(parseInt(d.minutes || '0') || 0, 0, 59);
    const totalMinutes = hours * 60 + minutes;
    const startedAt = getDateAtMidnight(d.date);
    const endedAt = addMinutes(startedAt, totalMinutes);
    const updated: Session = {
      id: String(s.id),
      category: d.category,
      startedAt,
      endedAt,
      minutes: totalMinutes,
    };
    onUpsert(updated);
    setEditingId(null);
  };

  const resetDraftFromSession = (id: string) => {
    const s = sessions.find((x) => String(x.id) === String(id));
    if (!s) return;
    const d = new Date(s.startedAt).toISOString().slice(0, 10);
    const hrs = Math.floor((s.minutes || 0) / 60);
    const mins = (s.minutes || 0) % 60;
    setDraftById((prev) => ({
      ...prev,
      [id]: { date: d, category: s.category, hours: String(hrs), minutes: String(mins) },
    }));
  };

  return (
    <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900">
      {/* Mobile cards (show on small screens only) */}
      <div className="sm:hidden space-y-3">
        {(!sessions || sessions.length === 0) ? (
          <div className={cn(tokens.card.base, 'text-center text-neutral-400')}>No recent sessions.</div>
        ) : (
          sessions.map((s) => {
            const isEditing = editingId === String(s.id);
            const hrs = Math.floor((s.minutes || 0) / 60);
            const mins = (s.minutes || 0) % 60;
            return (
              <div key={s.id} className={cn(tokens.card.base, 'flex flex-col gap-3 text-neutral-100')}>
                {/* Date */}
                <div>
                  <div className="text-xs mb-1">Date</div>
                  {isEditing ? (
                    <input
                      type="date"
                      value={draftById[s.id]?.date || ''}
                      onChange={(e) => setDraftById((prev) => ({ ...prev, [s.id]: { ...prev[s.id], date: e.target.value } }))}
                      className={tokens.input.date}
                      onKeyDown={(e) => { if (e.key === 'Enter') commit(String(s.id)); if (e.key === 'Escape') { resetDraftFromSession(String(s.id)); setEditingId(null); } }}
                    />
                  ) : (
                    <button
                      type="button"
                      className={cn('text-left w-full', tokens.accent?.text_hover || '')}
                      onClick={() => { resetDraftFromSession(String(s.id)); setEditingId(String(s.id)); }}
                      title="Edit session"
                    >
                      {new Date(s.startedAt).toLocaleDateString()}
                    </button>
                  )}
                </div>

                {/* Category */}
                <div>
                  <div className="text-xs mb-1">Category</div>
                  {isEditing ? (
                    <select
                      value={draftById[s.id]?.category || s.category}
                      onChange={(e) => setDraftById((prev) => ({ ...prev, [s.id]: { ...prev[s.id], category: e.target.value as Session['category'] } }))}
                      className={tokens.input.base}
                      onKeyDown={(e) => { if (e.key === 'Enter') commit(String(s.id)); if (e.key === 'Escape') { resetDraftFromSession(String(s.id)); setEditingId(null); } }}
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    <button
                      type="button"
                      className={cn('text-left w-full', tokens.accent?.text_hover || '')}
                      onClick={() => { resetDraftFromSession(String(s.id)); setEditingId(String(s.id)); }}
                      title="Edit session"
                    >
                      {s.category}
                    </button>
                  )}
                </div>

                {/* Duration */}
                <div>
                  <div className="text-xs mb-1">Duration</div>
                  {isEditing ? (
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        value={draftById[s.id]?.hours ?? '0'}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9-]/g, '');
                          setDraftById((prev) => ({ ...prev, [s.id]: { ...prev[s.id], hours: val } }));
                        }}
                        className={cn(tokens.input.base, 'w-16')}
                        placeholder="0"
                        min="0"
                        max="23"
                        onKeyDown={(e) => { if (e.key === 'Enter') commit(String(s.id)); if (e.key === 'Escape') { resetDraftFromSession(String(s.id)); setEditingId(null); } }}
                      />
                      <span className="text-sm text-neutral-400">h</span>
                      <input
                        type="number"
                        value={draftById[s.id]?.minutes ?? '0'}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9-]/g, '');
                          setDraftById((prev) => ({ ...prev, [s.id]: { ...prev[s.id], minutes: val } }));
                        }}
                        className={cn(tokens.input.base, 'w-16')}
                        placeholder="0"
                        min="0"
                        max="59"
                        onKeyDown={(e) => { if (e.key === 'Enter') commit(String(s.id)); if (e.key === 'Escape') { resetDraftFromSession(String(s.id)); setEditingId(null); } }}
                      />
                      <span className="text-sm text-neutral-400">m</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={cn('text-left w-full', tokens.accent?.text_hover || '')}
                      onClick={() => { resetDraftFromSession(String(s.id)); setEditingId(String(s.id)); }}
                      title="Edit session"
                    >
                      {hrs}h {mins}m
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => commit(String(s.id))}
                        className={cn(tokens.button.base, tokens.button.primary, 'text-sm')}
                        aria-label="Save session"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { resetDraftFromSession(String(s.id)); setEditingId(null); }}
                        className={cn(tokens.button.base, tokens.button.secondary, 'text-sm')}
                        aria-label="Cancel edit"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => onDelete(String(s.id))}
                      className={cn(tokens.button.base, tokens.button.danger, 'text-sm')}
                      aria-label="Delete session"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop table (hidden on small screens) */}
      <div className="hidden sm:block overflow-x-auto">
        <table className={cn(tokens.table.table)}>
          <thead className={tokens.table.thead}>
            <tr>
              <th className={tokens.table.th}>Date</th>
              <th className={tokens.table.th}>Category</th>
              <th className={tokens.table.th}>Duration</th>
              <th className={tokens.table.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(!sessions || sessions.length === 0) ? (
              <tr>
                <td colSpan={4} className={tokens.table.empty_state}>No recent sessions.</td>
              </tr>
            ) : (
              sessions.map((s) => {
                const isEditing = editingId === String(s.id);
                const dateDisplay = new Date(s.startedAt).toLocaleDateString();
                const hrs = Math.floor((s.minutes || 0) / 60);
                const mins = (s.minutes || 0) % 60;
                return (
                  <tr key={s.id} className={cn(tokens.table.tr_zebra, tokens.table.row_hover)}>
                    <td className={tokens.table.td}>
                      {isEditing ? (
                        <input
                          type="date"
                          value={draftById[s.id]?.date || ''}
                          onChange={(e) => setDraftById((prev) => ({ ...prev, [s.id]: { ...prev[s.id], date: e.target.value } }))}
                          className={tokens.input.date}
                          onKeyDown={(e) => { if (e.key === 'Enter') commit(String(s.id)); if (e.key === 'Escape') { resetDraftFromSession(String(s.id)); setEditingId(null); } }}
                        />
                      ) : (
                        <span
                          className={cn('cursor-pointer', tokens.accent?.text_hover || '')}
                          onClick={() => { resetDraftFromSession(String(s.id)); setEditingId(String(s.id)); }}
                          title="Edit session"
                        >
                          {dateDisplay}
                        </span>
                      )}
                    </td>
                    <td className={tokens.table.td}>
                      {isEditing ? (
                        <select
                          value={draftById[s.id]?.category || s.category}
                          onChange={(e) => setDraftById((prev) => ({ ...prev, [s.id]: { ...prev[s.id], category: e.target.value as Session['category'] } }))}
                          className={tokens.input.base}
                          onKeyDown={(e) => { if (e.key === 'Enter') commit(String(s.id)); if (e.key === 'Escape') { resetDraftFromSession(String(s.id)); setEditingId(null); } }}
                        >
                          {categories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={cn('cursor-pointer', tokens.accent?.text_hover || '')}
                          onClick={() => { resetDraftFromSession(String(s.id)); setEditingId(String(s.id)); }}
                          title="Edit session"
                        >
                          {s.category}
                        </span>
                      )}
                    </td>
                    <td className={tokens.table.td}>
                      {isEditing ? (
                        <div className="flex gap-2 items-center">
                          <input
                            type="number"
                            value={draftById[s.id]?.hours ?? '0'}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9-]/g, '');
                              setDraftById((prev) => ({ ...prev, [s.id]: { ...prev[s.id], hours: val } }));
                            }}
                            className={cn(tokens.input.base, 'w-16')}
                            placeholder="0"
                            min="0"
                            max="23"
                            onKeyDown={(e) => { if (e.key === 'Enter') commit(String(s.id)); if (e.key === 'Escape') { resetDraftFromSession(String(s.id)); setEditingId(null); } }}
                          />
                          <span className="text-sm text-neutral-400">h</span>
                          <input
                            type="number"
                            value={draftById[s.id]?.minutes ?? '0'}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9-]/g, '');
                              setDraftById((prev) => ({ ...prev, [s.id]: { ...prev[s.id], minutes: val } }));
                            }}
                            className={cn(tokens.input.base, 'w-16')}
                            placeholder="0"
                            min="0"
                            max="59"
                            onKeyDown={(e) => { if (e.key === 'Enter') commit(String(s.id)); if (e.key === 'Escape') { resetDraftFromSession(String(s.id)); setEditingId(null); } }}
                          />
                          <span className="text-sm text-neutral-400">m</span>
                        </div>
                      ) : (
                        <span
                          className={cn('cursor-pointer', tokens.accent?.text_hover || '')}
                          onClick={() => { resetDraftFromSession(String(s.id)); setEditingId(String(s.id)); }}
                          title="Edit session"
                        >
                          {hrs}h {mins}m
                        </span>
                      )}
                    </td>
                    <td className={tokens.table.td}>
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => commit(String(s.id))}
                            className={cn(tokens.button.base, tokens.button.primary, 'text-sm')}
                            aria-label="Save session"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { resetDraftFromSession(String(s.id)); setEditingId(null); }}
                            className={cn(tokens.button.base, tokens.button.secondary, 'text-sm')}
                            aria-label="Cancel edit"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onDelete(String(s.id))}
                          className={cn(tokens.button.base, tokens.button.danger, 'text-sm')}
                          aria-label="Delete session"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentSessionsTable;


