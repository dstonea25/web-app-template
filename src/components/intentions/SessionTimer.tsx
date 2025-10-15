import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn, tokens } from '../../theme/config';
import { toast } from '../../lib/notifications/toast';

const TEN_MIN_MS = 10 * 60 * 1000;

function formatMmSs(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  // Minutes: no leading zero (e.g., 9:55), Seconds: always two digits
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}

export const SessionTimer: React.FC<{ embedded?: boolean }>= ({ embedded = false }) => {
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

  const persist = () => {
    try {
      localStorage.setItem('intentions.timer', JSON.stringify({ running, remainingMs, startedAt: startedAtRef.current }));
    } catch {}
  };

  const tick = (now: number) => {
    if (!running || startedAtRef.current == null) return;
    const elapsed = now - startedAtRef.current;
    const nextRemaining = Math.max(0, TEN_MIN_MS - elapsed);
    setRemainingMs(nextRemaining);
    if (nextRemaining === 0) {
      setRunning(false);
      startedAtRef.current = null;
      try {
        // flag for completion animation
        localStorage.setItem('intentions.timer.completedAt', String(Date.now()));
      } catch {}
      // optional completion toast
      toast.success('Session complete');
    } else {
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  useEffect(() => {
    persist();
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
    // Resume from remaining time instead of resetting
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

  const completedRecently = (() => {
    try {
      const v = localStorage.getItem('intentions.timer.completedAt');
      if (!v) return false;
      const t = Number(v);
      return Number.isFinite(t) && (Date.now() - t < 8000);
    } catch { return false; }
  })();

  return (
    <div className={cn(
      embedded ? 'flex flex-col items-center justify-center text-center' : tokens.time.timerCard.wrapper,
      completedRecently && 'ring-2 ring-emerald-400/60'
    )}> {/* subtle success glow */}
      <div className={cn(tokens.typography.weights.semibold, 'mb-1 text-neutral-100')}>Daily Lock In Time</div>
      <div className={tokens.time.timerCard.time}>{timeLabel}</div>
      <div className={cn('mt-1 text-neutral-100')}>{running ? 'Running' : 'Ready'}</div>
      <div className={tokens.time.timerCard.actions}>
        {running ? (
          <button onClick={onPause} className={cn(tokens.button.base, tokens.button.primary)}>Pause</button>
        ) : (
          <button onClick={onStart} className={cn(tokens.button.base, tokens.button.primary)}>{remainingMs < TEN_MIN_MS ? 'Continue' : 'Start'}</button>
        )}
        <button onClick={onReset} className={cn(tokens.button.base, tokens.button.secondary)}>Reset</button>
      </div>
    </div>
  );
};

export default SessionTimer;


