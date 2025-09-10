import React, { useState } from 'react';
import type { Session } from '../types';
import { tokens, cn } from '../theme/config';
import { formatDateTimeLocal, parseDateTimeLocal } from '../lib/time';

interface SessionEditorProps {
  session: Session;
  onConfirm: (session: Session) => void;
  onCancel: () => void;
}

export const SessionEditor: React.FC<SessionEditorProps> = ({
  session,
  onConfirm,
  onCancel,
}) => {
  const [editedSession, setEditedSession] = useState<Session>({ ...session });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(editedSession);
  };

  const handleStartTimeChange = (value: string) => {
    const startedAt = parseDateTimeLocal(value);
    setEditedSession(prev => ({
      ...prev,
      started_at: startedAt,
    }));
  };

  const handleEndTimeChange = (value: string) => {
    const endedAt = parseDateTimeLocal(value);
    setEditedSession(prev => ({
      ...prev,
      ended_at: endedAt,
    }));
  };

  const handleNoteChange = (value: string) => {
    setEditedSession(prev => ({
      ...prev,
      note: value,
    }));
  };

  return (
    <div className={tokens.modal.overlay}>
      <div className={tokens.modal.content}>
        <h3 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, 'mb-4 text-slate-100')}>
          Edit Session
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-100">
              Start Time
            </label>
            <input
              type="datetime-local"
              value={formatDateTimeLocal(editedSession.started_at)}
              onChange={(e) => handleStartTimeChange(e.target.value)}
              className={cn(tokens.input.base, tokens.input.focus)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-100">
              End Time
            </label>
            <input
              type="datetime-local"
              value={editedSession.ended_at ? formatDateTimeLocal(editedSession.ended_at) : ''}
              onChange={(e) => handleEndTimeChange(e.target.value)}
              className={cn(tokens.input.base, tokens.input.focus)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-100">
              Note
            </label>
            <textarea
              value={editedSession.note || ''}
              onChange={(e) => handleNoteChange(e.target.value)}
              className={cn(tokens.input.base, tokens.input.focus)}
              rows={3}
              placeholder="Add a note for this session..."
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className={cn(tokens.button.base, tokens.button.primary)}
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={onCancel}
              className={cn(tokens.button.base, tokens.button.secondary)}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
