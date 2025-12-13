import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn, tokens } from '../../theme/config';
import { toast } from '../../lib/notifications/toast';

const TEN_MIN_MS = 10 * 60 * 1000;

function formatMmSs(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}

export const SessionTimerInline: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number>(TEN_MIN_MS);
  const startedAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // restore state from localStorage in case of refresh
  useEffect(() => {
    try {
      const raw = localStorage.getItem('intentions.timer');
      if (raw) {
        const { running: r, remainingMs: rem, startedAt } = JSON.parse(raw);
        setRunning(!!r);
        setRemainingMs(typeof rem === 'number' ? rem : TEN_MIN_MS);
        startedAtRef.current = typeof startedAt === 'number' ? startedAt : null;
      }
    } catch {}
  }, []);

  const tick = (now: number) => {
    if (!running || startedAtRef.current == null) return;
    const elapsed = now - startedAtRef.current;
    const nextRemaining = Math.max(0, TEN_MIN_MS - elapsed);
    setRemainingMs(nextRemaining);
    if (nextRemaining === 0) {
      setRunning(false);
      startedAtRef.current = null;
      try {
        localStorage.setItem('intentions.timer.completedAt', String(Date.now()));
      } catch {}
      toast.success('Session complete');
    } else {
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem('intentions.timer', JSON.stringify({ running, remainingMs, startedAt: startedAtRef.current }));
    } catch {}
  }, [running, remainingMs]);

  useEffect(() => {
    if (running) {
      if (startedAtRef.current == null) startedAtRef.current = performance.now() - (TEN_MIN_MS - remainingMs);
      rafRef.current = requestAnimationFrame(tick);
    } else if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running]);

  const onStart = () => {
    if (remainingMs <= 0) setRemainingMs(TEN_MIN_MS);
    const safeRemaining = Math.min(Math.max(remainingMs, 0), TEN_MIN_MS);
    startedAtRef.current = performance.now() - (TEN_MIN_MS - safeRemaining);
    setRunning(true);
  };
  const onPause = () => setRunning(false);
  const onReset = () => {
    setRunning(false);
    startedAtRef.current = null;
    setRemainingMs(TEN_MIN_MS);
  };

  const timeLabel = useMemo(() => formatMmSs(remainingMs), [remainingMs]);

  return (
    <div className="flex items-center gap-3">
      <div className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, 'text-neutral-100', 'tabular-nums')}>
        {timeLabel}
      </div>
      <div className="flex items-center gap-2">
        {running ? (
          <button
            onClick={onPause}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            aria-label="Pause"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          </button>
        ) : (
          <button
            onClick={onStart}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            aria-label={remainingMs < TEN_MIN_MS ? 'Continue' : 'Start'}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        )}
        <button
          onClick={onReset}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white transition-colors"
          aria-label="Reset"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default SessionTimerInline;

