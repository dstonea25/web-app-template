import React from 'react';
import { cn, tokens } from '../theme/config';
import { msToTimerDisplay } from '../lib/time';

interface TimerCardProps {
  running: boolean;
  elapsedMs: number;
  selectedCategory: string | null;
  onStart: () => void;
  onStop: () => void;
}

export const TimerCard: React.FC<TimerCardProps> = ({
  running,
  elapsedMs,
  selectedCategory,
  onStart,
  onStop,
}) => {
  return (
    <div className={tokens.time.timerCard.wrapper}>
      <div className={tokens.time.timerCard.time} aria-live="polite">
        {msToTimerDisplay(elapsedMs)}
      </div>
      <div className={tokens.time.timerCard.state}>
        {running ? 'Running' : selectedCategory ? 'Ready' : 'Select a category to start'}
      </div>
      <div className={tokens.time.timerCard.actions}>
        {running ? (
          <button
            onClick={onStop}
            className={cn(tokens.button.base, tokens.button.primary)}
          >
            Stop
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={!selectedCategory}
            className={cn(tokens.button.base, tokens.button.primary, "disabled:opacity-50 disabled:cursor-not-allowed")}
          >
            Start
          </button>
        )}
      </div>
    </div>
  );
};
