import React from 'react';
import { tokens, cn } from '../theme/config';

interface TimerCardProps {
  running: boolean;
  elapsedMs: number;
  onStart: () => void;
  onStop: () => void;
}

export const TimerCard: React.FC<TimerCardProps> = ({
  running,
  elapsedMs,
  onStart,
  onStop,
}) => {
  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    const displaySeconds = seconds % 60;
    const displayMinutes = minutes % 60;
    const displayHours = hours;
    
    if (displayHours > 0) {
      return `${displayHours.toString().padStart(2, '0')}:${displayMinutes.toString().padStart(2, '0')}:${displaySeconds.toString().padStart(2, '0')}`;
    }
    return `${displayMinutes.toString().padStart(2, '0')}:${displaySeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={tokens.timer.card}>
      <div className={tokens.timer.time}>
        {formatTime(elapsedMs)}
      </div>
      <div className={tokens.timer.state}>
        {running ? 'Running' : 'Stopped'}
      </div>
      <div className={tokens.timer.actions}>
        {running ? (
          <button
            onClick={onStop}
            className={cn(tokens.button.base, tokens.button.danger)}
          >
            Stop
          </button>
        ) : (
          <button
            onClick={onStart}
            className={cn(tokens.button.base, tokens.button.primary)}
          >
            Start
          </button>
        )}
      </div>
    </div>
  );
};
