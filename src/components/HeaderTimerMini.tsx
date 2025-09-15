import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn, tokens } from '../theme/config';
import { msToTimerDisplay } from '../lib/time';
import { useTimer } from '../contexts/TimerContext';

interface HeaderTimerMiniProps {
  onOpenTimeTab: () => void;
  isOnTimeTab?: boolean;
}

type ActiveSessionStore = { startedAt: string; category: string } | null;

export const HeaderTimerMini: React.FC<HeaderTimerMiniProps> = ({ onOpenTimeTab, isOnTimeTab = false }) => {
  const [hidden, setHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem('geronimo.timerMini.hidden') === '1';
    } catch {
      return false;
    }
  });
  const { activeSession: active, elapsedMs } = useTimer();

  const toggleHidden = () => {
    const next = !hidden;
    setHidden(next);
    try {
      localStorage.setItem('geronimo.timerMini.hidden', next ? '1' : '0');
    } catch {}
  };

  const display = useMemo(() => {
    if (!active) return '';
    const time = msToTimerDisplay(elapsedMs);
    return `${active.category} timer: ${time}`;
  }, [active, elapsedMs]);

  // Don't show if no active timer or on timer tab
  if (!active || isOnTimeTab) return null;

  return (
    <div className={cn('flex items-center gap-2')}> 
      <button
        type="button"
        onClick={toggleHidden}
        title={hidden ? 'Show timer' : 'Hide timer'}
        className={cn(tokens.button.base, tokens.button.ghost, 'p-2')}
        aria-pressed={hidden}
      >
        {hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>
      {!hidden && (
        <button
          type="button"
          onClick={onOpenTimeTab}
          className={cn(tokens.button.base, tokens.button.ghost, 'flex items-center gap-2 px-3')}
          title="Open timer"
        >
          <span className="tabular-nums">{display}</span>
        </button>
      )}
    </div>
  );
};


