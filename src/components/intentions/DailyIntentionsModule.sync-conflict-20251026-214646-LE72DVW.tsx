import React, { useEffect, useMemo, useState } from 'react';
import { cn, tokens } from '../../theme/config';
import type { IntentionPillar, IntentionStatsRow } from '../../types';
import { fetchCurrentIntentions, resetIntentionsIfNewDay, upsertIntentions, pingIntentionsCommitted, fetchIntentionStats, getTodayCompletionStatus, markIntentionCompleted } from '../../lib/api';
import { toast } from '../../lib/notifications/toast';
import { SessionTimer } from './SessionTimer';

const PILLARS: { key: IntentionPillar; label: string; emoji: string }[] = [
  { key: 'Power', label: 'Power', emoji: '💪' },
  { key: 'Passion', label: 'Passion', emoji: '❤️' },
  { key: 'Purpose', label: 'Purpose', emoji: '🧠' },
  { key: 'Production', label: 'Production', emoji: '⚙️' },
];

const PLACEHOLDERS: Record<IntentionPillar, string> = {
  Power: 'What will you do for your body?',
  Passion: 'What will you do for your soul?',
  Purpose: 'How will you grow or build today?',
  Production: 'What will you focus on today?',
};

const getTodayLocalDate = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const DailyIntentionsModule: React.FC<{ isVisible?: boolean }>= ({ isVisible = true }) => {
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<IntentionPillar, string>>({ Power: '', Passion: '', Purpose: '', Production: '' });
  const [lockedIn, setLockedIn] = useState<boolean>(false);
  const [streakStats, setStreakStats] = useState<IntentionStatsRow[]>([]);
  const [completionStatus, setCompletionStatus] = useState<Record<IntentionPillar, boolean>>({ Power: false, Passion: false, Purpose: false, Production: false });

  const today = useMemo(() => getTodayLocalDate(), []);
  const isSameLocalDay = (iso: string, ymd: string): boolean => {
    try {
      const d = new Date(iso);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}` === ymd;
    } catch { return false; }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        await resetIntentionsIfNewDay();
        const [current, stats, completion] = await Promise.all([
          fetchCurrentIntentions(),
          fetchIntentionStats(),
          getTodayCompletionStatus()
        ]);
        if (!mounted) return;
        
        setStreakStats(stats);
        setCompletionStatus(completion);
        
        // Determine lock based on DB (all 4 set today) or local lock for today
        const lockedByDb = Array.isArray(current) && current.length === 4 && current.every((r: any) => ((r.intention || '').trim().length > 0) && isSameLocalDay((r as any).updated_at, today));
        let lockedLocal = false;
        try { lockedLocal = localStorage.getItem('intentions.lockedDate') === today; } catch {}
        const isLocked = lockedByDb || lockedLocal;
        setLockedIn(isLocked);

        // Prefill only when locked. Otherwise start from local drafts for today or blanks.
        if (isLocked) {
          const prefill: Record<IntentionPillar, string> = { Power: '', Passion: '', Purpose: '', Production: '' };
          for (const r of current as any[]) prefill[(r as any).pillar as IntentionPillar] = (r as any).intention || '';
          setDrafts(prefill);
        } else {
          try {
            const raw = localStorage.getItem(`intentions.drafts.${today}`);
            if (raw) {
              const parsed = JSON.parse(raw) as Record<IntentionPillar, string>;
              setDrafts(parsed);
            } else {
              setDrafts({ Power: '', Passion: '', Purpose: '', Production: '' });
            }
          } catch {
            setDrafts({ Power: '', Passion: '', Purpose: '', Production: '' });
          }
        }
      } catch (e) {
        console.error('Failed to load intentions:', e);
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const allFilled = PILLARS.every(p => (drafts[p.key] || '').trim().length > 0);

  // Helper function to get compact streak display
  const getCompactStreakDisplay = (pillar: IntentionPillar): string => {
    const stat = streakStats.find(s => s.pillar === pillar);
    if (!stat) return '';
    // Show nothing for 0 or 1; show single flame when >1
    return stat.current_streak > 1 ? '🔥' : '';
  };

  const onChangeDraft = (pillar: IntentionPillar, value: string) => {
    setDrafts(prev => {
      const next = { ...prev, [pillar]: value } as Record<IntentionPillar, string>;
      try { localStorage.setItem(`intentions.drafts.${today}`, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleCompletionToggle = async (pillar: IntentionPillar) => {
    if (!lockedIn) return; // Only allow completion if intentions are locked in
    
    try {
      await markIntentionCompleted(pillar);
      
      // Refresh streak stats and completion status
      const [newStats, newCompletion] = await Promise.all([
        fetchIntentionStats(),
        getTodayCompletionStatus()
      ]);
      
      setStreakStats(newStats);
      setCompletionStatus(newCompletion);
      
      toast.success(`${pillar} intention completed! 🔥`);
    } catch (error) {
      console.error('Failed to mark intention as completed:', error);
      toast.error('Failed to mark as completed');
    }
  };

  const onLockIn = async () => {
    if (!allFilled) return;
    try {
      const payload = PILLARS.map(p => ({ pillar: p.key, intention: (drafts[p.key] || '').trim() }));
      await upsertIntentions(payload);
      setLockedIn(true);
      try { localStorage.setItem('intentions.lockedDate', today); } catch {}
      try { localStorage.removeItem(`intentions.drafts.${today}`); } catch {}
      toast.success('Intentions locked for today ✅');
      // Non-blocking webhook ping
      pingIntentionsCommitted('home');
      // v2 webhook will be added later
    } catch (e) {
      console.error('Failed to lock in intentions:', e);
      toast.error('Failed to lock in.');
    }
  };

  return (
    <div className={cn('grid gap-4', !isVisible && 'hidden')}>
      <div className={cn(tokens.card.base, 'p-6')}> {/* Single unified card */}
        <SessionTimer embedded />

        <div className="mt-6 flex items-center justify-between">
          <h3 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, 'text-neutral-100')}>
            Daily Intentions
          </h3>
        </div>
        <div className="mt-3" />

        {loading ? (
          <div className="py-4 text-center text-neutral-100">Loading intentions…</div>
        ) : (
          <div className="mt-2 grid gap-3">
            {PILLARS.map(p => (
              <div key={p.key} className="flex items-center gap-3">
                <div className={cn(tokens.typography.weights.semibold, 'text-neutral-100', 'text-sm', 'w-24', 'whitespace-nowrap')}>
                  {p.emoji} {p.label}
                </div>
                <div className={cn(tokens.typography.weights.medium, 'text-neutral-300', 'text-sm', 'w-12', 'text-center')}>
                  {getCompactStreakDisplay(p.key)}
                </div>
                <input
                  type="text"
                  className={cn(tokens.input.base, tokens.input.focus, 'text-neutral-100 placeholder:text-neutral-300', 'flex-1')}
                  placeholder={PLACEHOLDERS[p.key]}
                  value={drafts[p.key]}
                  onChange={(e) => onChangeDraft(p.key, e.target.value)}
                  readOnly={lockedIn}
                />
                {lockedIn && (
                  <button
                    onClick={() => handleCompletionToggle(p.key)}
                    className={cn(
                      'w-6 h-6 rounded border-2 flex items-center justify-center transition-colors',
                      completionStatus[p.key]
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'border-neutral-500 hover:border-green-500 hover:bg-green-500/20'
                    )}
                  >
                    {completionStatus[p.key] && '✓'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end">
          <button
            className={cn(tokens.button.base, tokens.button.primary, 'disabled:opacity-50 disabled:cursor-not-allowed')}
            disabled={lockedIn || !allFilled}
            onClick={onLockIn}
          >
            {lockedIn ? 'Committed' : 'Commit'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DailyIntentionsModule;


