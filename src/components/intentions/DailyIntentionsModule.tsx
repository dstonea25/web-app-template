import React, { useEffect, useMemo, useState } from 'react';
import { cn, tokens } from '../../theme/config';
import type { IntentionPillar } from '../../types';
import { fetchCurrentIntentions, resetIntentionsIfNewDay, upsertIntentions } from '../../lib/api';
import { toast } from '../../lib/notifications/toast';
import { SessionTimer } from './SessionTimer';
import { StreakDisplay } from './StreakDisplay';

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

  const today = useMemo(() => getTodayLocalDate(), []);

  // Determine locked state from localStorage per-day
  useEffect(() => {
    try {
      const v = localStorage.getItem('intentions.lockedDate');
      setLockedIn(v === today);
    } catch {}
  }, [today]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        await resetIntentionsIfNewDay();
        const current = await fetchCurrentIntentions();
        if (!mounted) return;
        const nextDrafts: Record<IntentionPillar, string> = { Power: '', Passion: '', Purpose: '', Production: '' };
        for (const r of current) nextDrafts[r.pillar] = r.intention || '';
        setDrafts(nextDrafts);
      } catch (e) {
        console.error('Failed to load intentions:', e);
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const allFilled = PILLARS.every(p => (drafts[p.key] || '').trim().length > 0);

  const onChangeDraft = (pillar: IntentionPillar, value: string) => {
    setDrafts(prev => ({ ...prev, [pillar]: value }));
  };

  const onLockIn = async () => {
    if (!allFilled) return;
    try {
      const payload = PILLARS.map(p => ({ pillar: p.key, intention: (drafts[p.key] || '').trim() }));
      await upsertIntentions(payload);
      setLockedIn(true);
      try { localStorage.setItem('intentions.lockedDate', today); } catch {}
      toast.success('Intentions locked for today ✅');
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
          <StreakDisplay />
        </div>
        <div className="mt-3" />

        {loading ? (
          <div className="py-4 text-center text-neutral-100">Loading intentions…</div>
        ) : (
          <div className="mt-2 grid gap-3">
            {PILLARS.map(p => (
              <div key={p.key} className="grid grid-cols-1 sm:grid-cols-[140px_minmax(0,1fr)] items-center gap-2">
                <div className={cn(tokens.typography.weights.semibold, 'text-neutral-100')}>{`${p.emoji} ${p.label}`}</div>
                <input
                  type="text"
                  className={cn(tokens.input.base, tokens.input.focus, 'text-neutral-100 placeholder:text-neutral-300')}
                  placeholder={PLACEHOLDERS[p.key]}
                  value={drafts[p.key]}
                  onChange={(e) => onChangeDraft(p.key, e.target.value)}
                  readOnly={lockedIn}
                />
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


