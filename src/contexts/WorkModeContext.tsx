import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface WorkModeContextValue {
  workMode: boolean;
  setWorkMode: (enabled: boolean) => void;
  toggleWorkMode: () => void;
}

const WorkModeContext = createContext<WorkModeContextValue | undefined>(undefined);

const STORAGE_KEY = 'dashboard.workMode.enabled';

export const WorkModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workMode, setWorkModeState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) === true : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workMode));
      // broadcast change for tabs to react if needed
      if (typeof window !== 'undefined' && 'dispatchEvent' in window) {
        const evt = new CustomEvent('dashboard:workmode-changed', { detail: { workMode } });
        window.dispatchEvent(evt);
      }
    } catch {}
  }, [workMode]);

  const setWorkMode = (enabled: boolean) => setWorkModeState(Boolean(enabled));
  const toggleWorkMode = () => setWorkModeState(prev => !prev);

  const value = useMemo(() => ({ workMode, setWorkMode, toggleWorkMode }), [workMode]);

  return (
    <WorkModeContext.Provider value={value}>
      {children}
    </WorkModeContext.Provider>
  );
};

export const useWorkMode = (): WorkModeContextValue => {
  const ctx = useContext(WorkModeContext);
  if (!ctx) throw new Error('useWorkMode must be used within WorkModeProvider');
  return ctx;
};


