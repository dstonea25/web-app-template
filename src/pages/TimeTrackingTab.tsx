import React, { useState, useEffect, useRef } from 'react';
import type { Session } from '../types';
import { apiClient } from '../lib/api';
import { StorageManager } from '../lib/storage';
import { tokens, cn } from '../theme/config';
import { nowIso, msToHms, computeDurationMs, formatDateTime } from '../lib/time';
import { SessionEditor } from '../components/SessionEditor';
import { TimerCard } from '../components/TimerCard';

export const TimeTrackingTab: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<number | null>(null);

  // Load initial data
  useEffect(() => {
    loadSessions();
  }, []);

  // Timer effect
  useEffect(() => {
    if (currentSession && !currentSession.ended_at) {
      intervalRef.current = setInterval(() => {
        const now = new Date();
        const startTime = new Date(currentSession.started_at);
        setElapsedTime(now.getTime() - startTime.getTime());
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [currentSession]);

  const loadSessions = async () => {
    try {
      // Try localStorage first, then fallback to seed data
      const storedSessions = StorageManager.loadSessions();
      if (storedSessions.length > 0) {
        setSessions(storedSessions);
      } else {
        // Load from seed data
        const response = await fetch('/data/sessions.json');
        const seedSessions = await response.json();
        setSessions(seedSessions);
        StorageManager.saveSessions(seedSessions);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSessions = async () => {
    try {
      const response = await apiClient.saveSessions({ sessions });
      if (response.success) {
        alert('Sessions saved successfully! (Mock API)');
      }
    } catch (error) {
      console.error('Failed to save sessions:', error);
      alert('Failed to save sessions');
    }
  };

  const startTimer = () => {
    const newSession: Session = {
      id: Date.now().toString(),
      started_at: nowIso(),
      note: '',
    };
    setCurrentSession(newSession);
    setElapsedTime(0);
  };

  const stopTimer = () => {
    if (!currentSession) return;
    
    const completedSession: Session = {
      ...currentSession,
      ended_at: nowIso(),
      duration_ms: computeDurationMs(currentSession.started_at),
    };
    
    const updatedSessions = [...sessions, completedSession];
    setSessions(updatedSessions);
    StorageManager.saveSessions(updatedSessions);
    setCurrentSession(null);
    setElapsedTime(0);
  };

  const updateSession = (id: string, updates: Partial<Session>) => {
    const updatedSessions = sessions.map(session => {
      if (session.id === id) {
        const updated = { ...session, ...updates };
        // Recalculate duration if times changed
        if (updated.started_at && updated.ended_at) {
          const startMs = new Date(updated.started_at).getTime();
          const endMs = new Date(updated.ended_at).getTime();
          updated.duration_ms = Math.max(0, endMs - startMs);
        }
        return updated;
      }
      return session;
    });
    setSessions(updatedSessions);
    StorageManager.saveSessions(updatedSessions);
    // Editing handled by SessionEditor component
  };

  const deleteSession = (id: string) => {
    const updatedSessions = sessions.filter(session => session.id !== id);
    setSessions(updatedSessions);
    StorageManager.saveSessions(updatedSessions);
  };

  const [editingSession, setEditingSession] = useState<Session | null>(null);

  const handleEditSession = (session: Session) => {
    setEditingSession(session);
  };

  const handleConfirmEdit = (updatedSession: Session) => {
    updateSession(updatedSession.id!, updatedSession);
    setEditingSession(null);
  };

  const handleCancelEdit = () => {
    setEditingSession(null);
  };

  if (loading) {
    return (
      <div className={tokens.layout.container}>
        <div className="flex justify-center items-center py-12">
          <div className={tokens.palette.dark.text_muted}>Loading sessions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={tokens.layout.container}>
      {/* Timer Section */}
      <div className="mb-6">
        <TimerCard
          running={!!currentSession}
          elapsedMs={elapsedTime}
          onStart={startTimer}
          onStop={stopTimer}
        />
        
        {currentSession && (
          <div className="mt-4">
            <input
              type="text"
              placeholder="Add a note for this session..."
              value={currentSession.note || ''}
              onChange={(e) => setCurrentSession({ ...currentSession, note: e.target.value })}
              className={cn(tokens.input.base, tokens.input.focus, 'w-full')}
            />
          </div>
        )}
      </div>

      {/* Sessions List */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
            Sessions ({sessions.length})
          </h2>
          <button
            onClick={saveSessions}
            className={cn(tokens.button.base, tokens.button.primary)}
          >
            Submit to API (Mock)
          </button>
        </div>
      </div>

      {/* Sessions table */}
      <div className={tokens.table.wrapper}>
        <table className={tokens.table.table}>
          <thead className={tokens.table.thead}>
            <tr>
              <th className={tokens.table.th}>Start Time</th>
              <th className={tokens.table.th}>End Time</th>
              <th className={tokens.table.th}>Duration</th>
              <th className={tokens.table.th}>Note</th>
              <th className={tokens.table.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={5} className={tokens.table.empty_state}>
                  No sessions yet. Start a timer above!
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr key={session.id} className={cn(tokens.table.tr_zebra, tokens.table.row_hover)}>
                  <td className={tokens.table.td}>
                      <span
                        className={cn('cursor-pointer', tokens.accent.text_hover)}
                        onClick={() => handleEditSession(session)}
                      >
                        {formatDateTime(session.started_at)}
                      </span>
                  </td>
                  <td className={tokens.table.td}>
                    {session.ended_at ? (
                      <span
                        className={cn('cursor-pointer', tokens.accent.text_hover)}
                        onClick={() => handleEditSession(session)}
                      >
                        {formatDateTime(session.ended_at)}
                      </span>
                    ) : (
                      <span className={tokens.palette.dark.text_muted}>Running...</span>
                    )}
                  </td>
                  <td className={tokens.table.td}>
                    {session.duration_ms ? msToHms(session.duration_ms) : '--'}
                  </td>
                  <td className={tokens.table.td}>
                    <span
                      className={cn('cursor-pointer', tokens.accent.text_hover)}
                      onClick={() => handleEditSession(session)}
                    >
                      {session.note || 'Click to add note'}
                    </span>
                  </td>
                  <td className={tokens.table.td}>
                    <button
                      onClick={() => deleteSession(session.id!)}
                      className={cn(tokens.button.base, tokens.button.danger, 'text-sm')}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Session Editor Modal */}
      {editingSession && (
        <SessionEditor
          session={editingSession}
          onConfirm={handleConfirmEdit}
          onCancel={handleCancelEdit}
        />
      )}
    </div>
  );
};
