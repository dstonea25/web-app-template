import React, { useEffect, useMemo, useState } from 'react';
import { cn, tokens } from '../theme/config';
import type { IntentionPillar } from '../types';
import { fetchCurrentIntentions, resetIntentionsIfNewDay, upsertIntentions, pingIntentionsCommitted } from '../lib/api';
import { toast } from '../lib/notifications/toast';

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

function getTodayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseRedirect(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('redirect');
  } catch {
    return null;
  }
}

export const PublicIntentionsPage: React.FC = () => {
  const today = useMemo(() => getTodayLocalDate(), []);
  const redirect = useMemo(parseRedirect, []);

  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<IntentionPillar, string>>({ Power: '', Passion: '', Purpose: '', Production: '' });
  const [lockedIn, setLockedIn] = useState<boolean>(false);

  // Helper to check same local day
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
        const current = await fetchCurrentIntentions();
        if (!mounted) return;
        const lockedByDb = Array.isArray(current) && current.length === 4 && current.every((r: any) => ((r.intention || '').trim().length > 0) && isSameLocalDay((r as any).updated_at, today));
        let lockedLocal = false;
        try { lockedLocal = localStorage.getItem('intentions.lockedDate') === today; } catch {}
        const isLocked = lockedByDb || lockedLocal;
        setLockedIn(isLocked);

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
        // eslint-disable-next-line no-console
        console.error('Failed to load intentions (public):', e);
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const allFilled = PILLARS.every(p => (drafts[p.key] || '').trim().length > 0);

  const onChangeDraft = (pillar: IntentionPillar, value: string) => {
    setDrafts(prev => {
      const next = { ...prev, [pillar]: value } as Record<IntentionPillar, string>;
      try { localStorage.setItem(`intentions.drafts.${today}`, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const onCommit = async () => {
    if (!allFilled) return;
    try {
      const payload = PILLARS.map(p => ({ pillar: p.key, intention: (drafts[p.key] || '').trim() }));
      await upsertIntentions(payload);
      setLockedIn(true);
      try { localStorage.setItem('intentions.lockedDate', today); } catch {}
      try { localStorage.removeItem(`intentions.drafts.${today}`); } catch {}
      toast.success('Intentions committed ✅');
      // Fire-and-forget ping
      pingIntentionsCommitted('public');
      // Optional redirect
      if (redirect) {
        try { window.location.assign(redirect); } catch { window.location.href = redirect; }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to commit intentions (public):', e);
      toast.error('Failed to commit.');
    }
  };

  return (
    <div className={cn('min-h-screen', tokens.palette?.dark?.bg)}>
      <div className={cn(tokens.layout?.container || 'container mx-auto', 'py-8')}>
        <div className={cn(tokens.card?.base || 'rounded-xl bg-neutral-900 border border-neutral-800', 'p-6 max-w-3xl mx-auto')}>
          <h1 className={cn(tokens.typography?.scale?.h3 || 'text-xl', tokens.typography?.weights?.semibold || 'font-semibold', 'text-neutral-100')}>Daily Intentions</h1>
          <div className="mt-1 text-neutral-400">{today}</div>

          {lockedIn && (
            <div className="mt-3">
              <div className={cn(tokens.badge?.base, tokens.badge?.success)}>Intentions already set for today</div>
            </div>
          )}

          {loading ? (
            <div className="py-6 text-center text-neutral-100">Loading…</div>
          ) : (
            <div className="mt-4">
              <div className="grid gap-3">
                {PILLARS.map(p => (
                  <div key={p.key} className="grid grid-cols-1 sm:grid-cols-[140px_minmax(0,1fr)] items-center gap-2">
                    <div className={cn(tokens.typography?.weights?.semibold || 'font-semibold', 'text-neutral-100')}>{`${p.emoji} ${p.label}`}</div>
                    <input
                      type="text"
                      className={cn(tokens.input?.base, tokens.input?.focus, 'text-neutral-100 placeholder:text-neutral-300')}
                      placeholder={PLACEHOLDERS[p.key]}
                      value={drafts[p.key]}
                      onChange={(e) => onChangeDraft(p.key, e.target.value)}
                      readOnly={lockedIn}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end">
                {lockedIn ? (
                  <a href="/home" className={cn(tokens.button?.base, tokens.button?.primary)}>Open Home</a>
                ) : (
                  <button
                    className={cn(tokens.button?.base, tokens.button?.primary, 'disabled:opacity-50 disabled:cursor-not-allowed')}
                    disabled={!allFilled}
                    onClick={onCommit}
                  >
                    Commit
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicIntentionsPage;


