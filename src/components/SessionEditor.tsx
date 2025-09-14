import React, { useState } from 'react';
import type { Session } from '../types';
import { tokens, cn } from '../theme/config';

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
    const startedAt = new Date(value).toISOString();
    setEditedSession(prev => ({
      ...prev,
      startedAt: startedAt,
    }));
  };

  const handleEndTimeChange = (value: string) => {
    const endedAt = new Date(value).toISOString();
    setEditedSession(prev => ({
      ...prev,
      endedAt: endedAt,
    }));
  };

  return (
    <div className={tokens.modal.overlay}>
      <div className={tokens.modal.content}>
        <h3 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, 'mb-4', tokens.palette.dark.text)}>
          Edit Session
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={cn("block text-sm font-medium mb-1", tokens.palette.dark.text)}>
              Start Time
            </label>
            <input
              type="datetime-local"
              value={editedSession.startedAt ? new Date(editedSession.startedAt).toISOString().slice(0, 16) : ''}
              onChange={(e) => handleStartTimeChange(e.target.value)}
              className={cn(tokens.input.base, tokens.input.focus)}
              required
            />
          </div>

          <div>
            <label className={cn("block text-sm font-medium mb-1", tokens.palette.dark.text)}>
              End Time
            </label>
            <input
              type="datetime-local"
              value={editedSession.endedAt ? new Date(editedSession.endedAt).toISOString().slice(0, 16) : ''}
              onChange={(e) => handleEndTimeChange(e.target.value)}
              className={cn(tokens.input.base, tokens.input.focus)}
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
