import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type ActiveSession = { startedAt: string; category: string } | null;

interface TimerContextValue {
  activeSession: ActiveSession;
  elapsedMs: number;
  setActive: (session: ActiveSession) => void;
  resetElapsed: () => void;
}

const TimerContext = createContext<TimerContextValue | undefined>(undefined);

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSession, setActiveSession] = useState<ActiveSession>(() => {
    try {
      const v = localStorage.getItem('geronimo.time.activeSession');
      return v ? (JSON.parse(v) as ActiveSession) : null;
    } catch {
      return null;
    }
  });
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const intervalRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    if (!activeSession) return;
    const now = new Date();
    const startTime = new Date(activeSession.startedAt);
    setElapsedMs(now.getTime() - startTime.getTime());
  }, [activeSession]);

  // Drive ticking when an active session exists
  useEffect(() => {
    if (activeSession) {
      tick();
      intervalRef.current = window.setInterval(tick, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setElapsedMs(0);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeSession, tick]);

  // Sync with storage events (if time tab updates localStorage)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'geronimo.time.activeSession') {
        try {
          const next = e.newValue ? (JSON.parse(e.newValue) as ActiveSession) : null;
          setActiveSession(next);
        } catch {
          setActiveSession(null);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setActive = useCallback((session: ActiveSession) => {
    setActiveSession(session);
  }, []);

  const resetElapsed = useCallback(() => setElapsedMs(0), []);

  const value = useMemo(() => ({ activeSession, elapsedMs, setActive, resetElapsed }), [activeSession, elapsedMs, setActive, resetElapsed]);

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
};

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used within TimerProvider');
  return ctx;
}


