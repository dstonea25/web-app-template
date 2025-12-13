import React, { useEffect, useMemo, useState } from 'react';
import { cn, tokens } from '../../theme/config';
import type { IntentionPillar, IntentionStatsRow } from '../../types';
import { fetchDailyIntentions, resetIntentionsIfNewDay, upsertIntentions, pingIntentionsCommitted, fetchIntentionStats, getTodayCompletionStatus, markIntentionCompleted } from '../../lib/api';
import { toast } from '../../lib/notifications/toast';

const PILLARS: { key: IntentionPillar; label: string; emoji: string }[] = [
  { key: 'Power', label: 'Power', emoji: '💪' },
  { key: 'Passion', label: 'Passion', emoji: '❤️' },
  { key: 'Purpose', label: 'Purpose', emoji: '🧠' },
  { key: 'Production', label: 'Production', emoji: '🎯' },
];

const PLACEHOLDERS: Record<IntentionPillar, string> = {
  Power: 'What will you do for your body?',
  Passion: 'What will you do for your soul?',
  Purpose: 'How will you grow or build today?',
  Production: 'What is the most impactful thing you will do today?',
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
          fetchDailyIntentions(),
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

  // Helper function to get compact streak display with both hot and cold streaks
  const getCompactStreakDisplay = (pillar: IntentionPillar): string => {
    const stat = streakStats.find(s => s.pillar === pillar);
    if (!stat) return ''; // Loading state
    
    // Show hot streak for > 1 day
    if (stat.current_streak > 1) {
      return '🔥';
    }
    
    // Show cold streak if streak is 0 and we have a last_completed_date
    if (stat.current_streak === 0 && stat.last_completed_date) {
      return '❄️';
    }
    
    // Default: no emoji (first day or just completed yesterday)
    return '';
  };

  // Helper function to get tooltip text for streaks
  const getStreakTooltip = (pillar: IntentionPillar): string => {
    const stat = streakStats.find(s => s.pillar === pillar);
    if (!stat) return '';
    
    if (stat.current_streak > 1) {
      return `${stat.current_streak}-day hot streak!`;
    }
    
    if (stat.current_streak === 0 && stat.last_completed_date) {
      const lastDate = new Date(stat.last_completed_date);
      const now = new Date();
      const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      return `Cold for ${daysSince} ${daysSince === 1 ? 'day' : 'days'}`;
    }
    
    if (stat.current_streak === 1) {
      return 'Completed yesterday!';
    }
    
    return '';
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
        {loading ? (
          <div className="py-4 text-center text-neutral-100">Loading intentions…</div>
        ) : (
          <div className="grid gap-3">
            {PILLARS.map(p => (
              <div 
                key={p.key} 
                className={cn(
                  'rounded-xl border p-4',
                  'flex items-center gap-4',
                  'transition-all duration-200 ease-out',
                  'cursor-pointer',
                  lockedIn 
                    ? 'border-neutral-800 bg-neutral-900/30 hover:bg-neutral-800/40 hover:border-neutral-700 hover:shadow-md'
                    : 'border-neutral-800 bg-neutral-900/50 hover:border-neutral-600 hover:bg-neutral-800/60 hover:shadow-lg hover:scale-[1.01]'
                )}
              >
                {/* Content: Question + Answer */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs uppercase tracking-wide font-semibold text-neutral-500',
                      'leading-relaxed'
                    )}>
                      {PLACEHOLDERS[p.key]}
                    </span>
                    {!lockedIn && (
                      <div className="w-6 text-center flex-shrink-0" title={getStreakTooltip(p.key)}>
                        {getCompactStreakDisplay(p.key)}
                      </div>
                    )}
                  </div>

                  <input
                    type="text"
                    className={cn(
                      'w-full text-base font-normal text-neutral-50',
                      'bg-transparent border-none outline-none px-0',
                      'placeholder:text-neutral-600',
                      !lockedIn && 'cursor-text',
                      lockedIn && 'cursor-default'
                    )}
                    placeholder=""
                    value={drafts[p.key]}
                    onChange={(e) => onChangeDraft(p.key, e.target.value)}
                    readOnly={lockedIn}
                  />
                </div>

                {/* Checkbox - Vertically Centered */}
                {lockedIn && (
                  <button
                    onClick={() => handleCompletionToggle(p.key)}
                    className={cn(
                      'w-8 h-8 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0',
                      completionStatus[p.key]
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-neutral-600 hover:border-emerald-400 hover:bg-emerald-500/10 hover:scale-110'
                    )}
                  >
                    {completionStatus[p.key] && (
                      <span className="text-sm font-bold">✓</span>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {!lockedIn && (
          <div className="mt-4 flex items-center justify-end">
            <button
              className={cn(tokens.button.base, tokens.button.primary, 'disabled:opacity-50 disabled:cursor-not-allowed')}
              disabled={!allFilled}
              onClick={onLockIn}
            >
              Commit
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyIntentionsModule;


