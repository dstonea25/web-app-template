import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Okr, OkrKeyResult, OkrPillar } from '../../types';
import { tokens, cn } from '../../theme/config';
import { fetchOkrsWithProgress, fetchOkrById, updateKeyResultValue, updateObjective, updateKrDescription, updateKrTarget, normalizeKrProgress } from '../../lib/okrs';
import toast from '../../lib/notifications/toast';
import { Pencil } from 'lucide-react';

interface OKRModuleProps {
  isVisible?: boolean;
  hideHeader?: boolean;
}

const PILLARS: OkrPillar[] = ['Power', 'Passion', 'Purpose', 'Production'];
// Reuse Habit palette hues for pillar accents
const PILLAR_COLORS: Record<OkrPillar, { base: string; glow: string }> = {
  Power: { base: '#6EE7B7', glow: '#A7F3D0' },      // emerald
  Passion: { base: '#FDA4AF', glow: '#FECDD3' },    // rose
  Purpose: { base: '#A3E635', glow: '#D9F99D' },    // olive/lime
  Production: { base: '#5EEAD4', glow: '#99F6E4' }, // teal
};

function ProgressBar({ value, flash, color }: { value: number; flash?: boolean; color: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div className={cn('h-2 w-full rounded-full bg-neutral-800 overflow-hidden', flash && 'ring-2 ring-offset-2 ring-offset-neutral-950')} style={flash ? { boxShadow: `0 0 0 2px ${color}` } : undefined} aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped} role="progressbar">
      <div className={cn('h-full transition-[width]')} style={{ width: `${clamped}%`, backgroundColor: color }} />
    </div>
  );
}

function PillarCard({ pillar, okr, onUpdateKr, onUpdateObjective, onUpdateDesc, onUpdateTarget }: { pillar: OkrPillar; okr: Okr | null; onUpdateKr: (kr: OkrKeyResult, value: number | boolean) => Promise<void>; onUpdateObjective: (okrId: string, value: string) => void; onUpdateDesc: (kr: OkrKeyResult, value: string) => void; onUpdateTarget: (kr: OkrKeyResult, value: number) => void; }) {
  const accent = PILLAR_COLORS[pillar]?.base || '#5EEAD4';
  const [editingObjective, setEditingObjective] = useState(false);
  const [objectiveDraft, setObjectiveDraft] = useState<string>(okr?.objective || '');
  const objectiveRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setObjectiveDraft(okr?.objective || ''); }, [okr?.id, okr?.objective]);

  const commitObjective = () => {
    if (!okr) return;
    const value = (objectiveDraft || '').trim();
    if (value === (okr.objective || '')) { setEditingObjective(false); return; }
    onUpdateObjective(okr.id, value);
    setEditingObjective(false);
  };
  return (
    <div className={cn(tokens.card.base)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn('text-sm text-neutral-400')}>{pillar}</div>
          <div className="mt-1 sm:min-h-[72px] flex items-end">
            {editingObjective ? (
              <textarea
                ref={objectiveRef as any}
                value={objectiveDraft}
                onChange={(e) => setObjectiveDraft(e.target.value)}
                onBlur={commitObjective}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitObjective(); } if (e.key === 'Escape') { setObjectiveDraft(okr?.objective || ''); setEditingObjective(false); } }}
                className={cn(tokens.input.base, tokens.input.focus, 'w-full min-h-[96px] resize-vertical')}
                rows={3}
                autoFocus
              />
            ) : (
              <div
                className={cn('text-neutral-100 line-clamp-2', tokens.typography.scale.h3, tokens.typography.weights.semibold, 'cursor-text pb-1')}
                onClick={() => setEditingObjective(true)}
                title="Click to edit objective"
              >
                {okr?.objective || 'No objective set'}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 divide-y divide-neutral-800">
        {(okr?.key_results || []).map((kr) => (
          <KeyResultRow key={kr.id} kr={kr} accent={accent} onUpdate={(v) => onUpdateKr(kr, v)} onUpdateDesc={onUpdateDesc} onUpdateTarget={onUpdateTarget} />
        ))}
        {(!okr || !okr.key_results || okr.key_results.length === 0) && (
          <div className="py-3 text-sm text-neutral-400">No key results.</div>
        )}
        {/* Desktop-only spacer to help align card bottoms when counts differ */}
        <div className="hidden sm:block h-2" aria-hidden></div>
      </div>
    </div>
  );
}

function KeyResultRow({ kr, onUpdate, saving, accent, onUpdateDesc, onUpdateTarget }: { kr: OkrKeyResult; onUpdate: (val: number | boolean) => void; saving?: boolean; accent: string; onUpdateDesc?: (kr: OkrKeyResult, value: string) => void; onUpdateTarget?: (kr: OkrKeyResult, value: number) => void; }) {
  const [localValue, setLocalValue] = useState<number | boolean | ''>(() => {
    if (kr.kind === 'boolean') return Boolean(kr.current_value);
    if (kr.kind === 'percent') return Number(kr.current_value || 0);
    return Number(kr.current_value || 0);
  });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState<string>(kr.description || '');
  const descRef = useRef<HTMLInputElement | null>(null);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState<number>(Number(kr.target_value || 0));
  const targetRef = useRef<HTMLInputElement | null>(null);
  const [isEditingCurrent, setIsEditingCurrent] = useState(false);

  useEffect(() => {
    if (kr.kind === 'boolean') setLocalValue(Boolean(kr.current_value));
    else setLocalValue(Number(kr.current_value || 0));
    setDescDraft(kr.description || '');
    setTargetDraft(Number(kr.target_value || 0));
  }, [kr.id, kr.current_value, kr.kind]);

  const clampNumber = (val: number) => {
    if (kr.kind === 'percent') return Math.max(0, Math.min(100, val));
    const target = Number(kr.target_value || 0);
    const max = Number.isFinite(target) && target > 0 ? target : Infinity;
    return Math.max(0, Math.min(max, val));
  };

  const commitIfChanged = () => {
    if (kr.kind === 'boolean') {
      onUpdate(Boolean(localValue));
    } else {
      const parsed = Number(localValue || 0);
      const num = Number.isNaN(parsed) ? 0 : clampNumber(parsed);
      setLocalValue(num);
      onUpdate(num);
    }
  };

  const calcProgress = () => {
    if (kr.kind === 'boolean') return Boolean(isEditingCurrent ? localValue : kr.current_value) ? 100 : 0;
    if (kr.kind === 'percent') return Math.max(0, Math.min(100, Math.round(Number(isEditingCurrent ? localValue : kr.current_value || 0))));
    const currentNum = Number(isEditingCurrent ? localValue || 0 : kr.current_value || 0);
    const targetNumLive = Number(editingTarget ? targetDraft || 0 : kr.target_value || 0);
    if (targetNumLive <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((currentNum / targetNumLive) * 100)));
  };
  const progress = calcProgress();
  const targetNum = Number(kr.target_value || 0);

  return (
    <div className="py-3 sm:min-h-[104px] sm:flex sm:flex-col sm:justify-between overflow-visible">
      {/* Line 1: KR title (click-to-edit) */}
      {editingDesc ? (
        <textarea
          ref={descRef as any}
          value={descDraft}
          onChange={(e) => setDescDraft(e.target.value)}
          onBlur={() => { onUpdateDesc && onUpdateDesc(kr, (descDraft || '').trim()); setEditingDesc(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onUpdateDesc && onUpdateDesc(kr, (descDraft || '').trim()); setEditingDesc(false); } if (e.key === 'Escape') { setDescDraft(kr.description || ''); setEditingDesc(false); } }}
          className={cn(tokens.input.base, tokens.input.focus, 'w-full font-medium min-h-[60px] resize-vertical')}
          rows={2}
          autoFocus
        />
      ) : (
        <div className="text-neutral-100 font-medium line-clamp-2 leading-[1.3] cursor-text pb-2" onClick={() => setEditingDesc(true)} title="Click to edit">
          {kr.description}
        </div>
      )}
      {/* Line 2: Progress bar */}
      <div className="mt-2 sm:mt-2">
        <ProgressBar value={progress} color={accent} />
      </div>
      {/* Line 3: left percent, right current/target or control */}
      <div className="mt-2 sm:mt-2 flex items-center justify-between gap-3">
        <div className="text-xs" style={{ color: accent }}>{progress}%</div>
        <div className="flex items-center gap-2">
          {kr.kind === 'boolean' ? (
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={Boolean(localValue)}
              onChange={(e) => { setLocalValue(e.target.checked); onUpdate(e.target.checked); }}
              disabled={saving}
              aria-label="Mark complete"
            />
          ) : kr.kind === 'percent' ? (
            <div role="group" tabIndex={0} className="flex items-center gap-2 text-sm group cursor-text outline-none" onClick={() => inputRef.current?.focus()} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.focus(); } }}>
              <input
                type="number"
                className={cn(tokens.input.base, tokens.input.focus, 'w-20 cursor-text pointer-events-auto relative z-10')}
                value={String(localValue)}
                onChange={(e) => setLocalValue(e.target.value === '' ? '' : Number(e.target.value))}
                onFocus={() => setIsEditingCurrent(true)}
                onBlur={() => { setIsEditingCurrent(false); commitIfChanged(); }}
                onKeyDown={(e) => { if (e.key === 'Enter') commitIfChanged(); }}
                min={0}
                max={100}
                step={1}
                disabled={saving}
                aria-label="Percent value"
                ref={inputRef}
                inputMode="numeric"
                pattern="[0-9]*"
              />
              <span className="text-neutral-400">%</span>
              <Pencil className="w-3.5 h-3.5 text-neutral-500 opacity-0 group-hover:opacity-100" aria-hidden />
            </div>
          ) : (
            <div role="group" tabIndex={0} className="flex items-center gap-2 text-sm group cursor-text outline-none" onClick={() => inputRef.current?.focus()} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.focus(); } }}>
              <input
                type="number"
                className={cn(tokens.input.base, tokens.input.focus, 'w-24 cursor-text pointer-events-auto relative z-10')}
                value={String(localValue)}
                onChange={(e) => setLocalValue(e.target.value === '' ? '' : Number(e.target.value))}
                onFocus={() => setIsEditingCurrent(true)}
                onBlur={() => { setIsEditingCurrent(false); commitIfChanged(); }}
                onKeyDown={(e) => { if (e.key === 'Enter') commitIfChanged(); }}
                min={0}
                max={Number.isFinite(targetNum) && targetNum > 0 ? targetNum : undefined}
                step={1}
                disabled={saving}
                aria-label="Current value"
                ref={inputRef}
                inputMode="numeric"
                pattern="[0-9]*"
              />
              <span className="text-neutral-500">/</span>
              {editingTarget ? (
                <input
                  ref={targetRef}
                  type="number"
                  value={String(targetDraft)}
                  onChange={(e) => setTargetDraft(Number(e.target.value || 0))}
                  onBlur={() => { onUpdateTarget && onUpdateTarget(kr, Math.max(0, Number(targetDraft || 0))); setEditingTarget(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { onUpdateTarget && onUpdateTarget(kr, Math.max(0, Number(targetDraft || 0))); setEditingTarget(false); } if (e.key === 'Escape') { setTargetDraft(Number(kr.target_value || 0)); setEditingTarget(false); } }}
                  className={cn(tokens.input.base, tokens.input.focus, 'w-20 text-right')}
                  min={0}
                  step={1}
                  aria-label="Target value"
                  autoFocus
                />
              ) : (
                <span className="text-neutral-300 cursor-text" aria-label="Target value" onClick={() => setEditingTarget(true)} title="Click to edit target">{String(kr.target_value ?? 0)}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const OKRModule: React.FC<OKRModuleProps> = ({ isVisible = true, hideHeader = false }) => {
  const [okrs, setOkrs] = useState<Okr[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // const [flashKrId, setFlashKrId] = useState<string | null>(null);

  const UNDO_WINDOW_MS = 2500;
  const commitTimersRef = useRef<Record<string, number>>({});
  const prevValuesRef = useRef<Record<string, number | boolean>>({});
  const descTimersRef = useRef<Record<string, number>>({});
  const prevDescRef = useRef<Record<string, string>>({});
  const targetTimersRef = useRef<Record<string, number>>({});
  const prevTargetRef = useRef<Record<string, number>>({});
  const objectiveTimersRef = useRef<Record<string, number>>({});
  const prevObjectiveRef = useRef<Record<string, string>>({});

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchOkrsWithProgress();
      setOkrs(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load OKRs');
      setOkrs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isVisible) load(); }, [isVisible]);

  const byPillar: Record<OkrPillar, Okr | null> = useMemo(() => {
    const map: Record<OkrPillar, Okr | null> = { Power: null, Passion: null, Purpose: null, Production: null };
    for (const o of okrs) map[o.pillar] = o;
    return map;
  }, [okrs]);

  const refetchSingle = async (okrId: string) => {
    try {
      const updated = await fetchOkrById(okrId);
      if (!updated) return;
      setOkrs((prev) => prev.map((o) => (o.id === okrId ? updated : o)));
    } catch {}
  };

  const handleUpdateKr = async (kr: OkrKeyResult, value: number | boolean) => {
    // Clear any existing pending commit for this KR
    const existing = commitTimersRef.current[kr.id];
    if (existing) {
      window.clearTimeout(existing);
      delete commitTimersRef.current[kr.id];
    }

    // Capture previous for undo
    const prevVal = (okrs.find(o => o.id === kr.okr_id)?.key_results || []).find(k => k.id === kr.id)?.current_value;
    prevValuesRef.current[kr.id] = prevVal as any;

    // Optimistic local update
    setOkrs((prev) => prev.map((o) => (
      o.key_results?.some((k) => k.id === kr.id)
        ? { ...o, key_results: (o.key_results || []).map((k) => (k.id === kr.id ? { ...k, current_value: value, progress: normalizeKrProgress({ ...k, current_value: value } as any) } : { ...k, progress: normalizeKrProgress(k as any) })) }
        : o
    )));

    const valueLabel = kr.kind === 'percent' ? `${value}%` : kr.kind === 'boolean' ? (value ? 'Complete' : 'Incomplete') : `${value} / ${kr.target_value ?? 0}`;
    toast.info(`Updated “${kr.description}” to ${valueLabel}`, {
      ttlMs: UNDO_WINDOW_MS,
      actionLabel: 'Undo',
      onAction: () => {
        // Revert
        const prev = prevValuesRef.current[kr.id];
        setOkrs((p) => p.map((o) => (
          o.key_results?.some((k) => k.id === kr.id)
            ? { ...o, key_results: (o.key_results || []).map((k) => (k.id === kr.id ? { ...k, current_value: prev } : k)) }
            : o
        )));
        const t = commitTimersRef.current[kr.id];
        if (t) {
          window.clearTimeout(t);
          delete commitTimersRef.current[kr.id];
        }
      }
    });

    // Schedule commit after undo window
    commitTimersRef.current[kr.id] = window.setTimeout(async () => {
      try {
        await updateKeyResultValue(kr.id, value);
        // Visual flash removed for build cleanliness
        await refetchSingle(kr.okr_id);
      } catch (e: any) {
        toast.error(e?.message || 'Failed to update');
      } finally {
        delete commitTimersRef.current[kr.id];
      }
    }, UNDO_WINDOW_MS);
  };

  const handleUpdateObjective = (okrId: string, value: string) => {
    // Capture prev
    const prev = okrs.find(o => o.id === okrId)?.objective || '';
    prevObjectiveRef.current[okrId] = prev;
    // Optimistic update
    setOkrs(prevOkrs => prevOkrs.map(o => (o.id === okrId ? { ...o, objective: value } : o)));
    // Toast with undo
    toast.info('Updated objective', {
      ttlMs: UNDO_WINDOW_MS,
      actionLabel: 'Undo',
      onAction: () => {
        const prevVal = prevObjectiveRef.current[okrId] ?? prev;
        setOkrs(prevOkrs => prevOkrs.map(o => (o.id === okrId ? { ...o, objective: prevVal } : o)));
        const t = objectiveTimersRef.current[okrId];
        if (t) { window.clearTimeout(t); delete objectiveTimersRef.current[okrId]; }
      }
    });
    // schedule commit
    const existing = objectiveTimersRef.current[okrId];
    if (existing) window.clearTimeout(existing);
    objectiveTimersRef.current[okrId] = window.setTimeout(async () => {
      try {
        await updateObjective(okrId, value);
        await refetchSingle(okrId);
      } catch (e: any) {
        toast.error(e?.message || 'Failed to update objective');
      } finally {
        delete objectiveTimersRef.current[okrId];
      }
    }, UNDO_WINDOW_MS);
  };

  const handleUpdateDesc = (kr: OkrKeyResult, value: string) => {
    // prev + optimistic
    prevDescRef.current[kr.id] = kr.description;
    setOkrs(prevOkrs => prevOkrs.map(o => (
      o.key_results?.some(k => k.id === kr.id)
        ? { ...o, key_results: (o.key_results || []).map(k => k.id === kr.id ? { ...k, description: value } : k) }
        : o
    )));
    toast.info('Updated key result', {
      ttlMs: UNDO_WINDOW_MS,
      actionLabel: 'Undo',
      onAction: () => {
        const prevVal = prevDescRef.current[kr.id] ?? kr.description;
        setOkrs(prevOkrs => prevOkrs.map(o => (
          o.key_results?.some(k => k.id === kr.id)
            ? { ...o, key_results: (o.key_results || []).map(k => k.id === kr.id ? { ...k, description: prevVal } : k) }
            : o
        )));
        const t = descTimersRef.current[kr.id];
        if (t) { window.clearTimeout(t); delete descTimersRef.current[kr.id]; }
      }
    });
    const existing = descTimersRef.current[kr.id];
    if (existing) window.clearTimeout(existing);
    descTimersRef.current[kr.id] = window.setTimeout(async () => {
      try {
        await updateKrDescription(kr.id, value);
        await refetchSingle(kr.okr_id);
      } catch (e: any) {
        toast.error(e?.message || 'Failed to update key result');
      } finally {
        delete descTimersRef.current[kr.id];
      }
    }, UNDO_WINDOW_MS);
  };

  const handleUpdateTarget = (kr: OkrKeyResult, value: number) => {
    prevTargetRef.current[kr.id] = Number(kr.target_value || 0);
    setOkrs(prevOkrs => prevOkrs.map(o => (
      o.key_results?.some(k => k.id === kr.id)
        ? { ...o, key_results: (o.key_results || []).map(k => k.id === kr.id ? { ...k, target_value: value, progress: normalizeKrProgress({ ...k, target_value: value } as any) } : { ...k, progress: normalizeKrProgress(k as any) }) }
        : o
    )));
    toast.info('Updated target', {
      ttlMs: UNDO_WINDOW_MS,
      actionLabel: 'Undo',
      onAction: () => {
        const prevVal = prevTargetRef.current[kr.id];
        setOkrs(prevOkrs => prevOkrs.map(o => (
          o.key_results?.some(k => k.id === kr.id)
            ? { ...o, key_results: (o.key_results || []).map(k => k.id === kr.id ? { ...k, target_value: prevVal } : k) }
            : o
        )));
        const t = targetTimersRef.current[kr.id];
        if (t) { window.clearTimeout(t); delete targetTimersRef.current[kr.id]; }
      }
    });
    const existing = targetTimersRef.current[kr.id];
    if (existing) window.clearTimeout(existing);
    targetTimersRef.current[kr.id] = window.setTimeout(async () => {
      try {
        await updateKrTarget(kr.id, value);
        await refetchSingle(kr.okr_id);
      } catch (e: any) {
        toast.error(e?.message || 'Failed to update target');
      } finally {
        delete targetTimersRef.current[kr.id];
      }
    }, UNDO_WINDOW_MS);
  };

  const daysLeftInQuarter = useMemo(() => {
    const now = new Date();
    const startMonth = Math.floor(now.getMonth() / 3) * 3; // 0,3,6,9
    const end = new Date(now.getFullYear(), startMonth + 3, 0); // last day of quarter
    // normalize to local midnight
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endMid = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const diffMs = endMid.getTime() - today.getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    const days = Math.max(0, Math.ceil(diffMs / oneDay));
    return days;
  }, []);

  return (
    <div className={cn(!isVisible && 'hidden')}>
      {!hideHeader && (
        <div className="mb-4">
          <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
            Quarterly OKRs - {daysLeftInQuarter} {daysLeftInQuarter === 1 ? 'Day' : 'Days'} Left
          </h2>
        </div>
      )}
      {loading ? (
        <div className={cn(tokens.card.base, 'flex items-center justify-center py-8 text-neutral-400')}>Loading OKRs…</div>
      ) : error ? (
        <div className={cn(tokens.card.base, 'text-red-400')}>{error}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PILLARS.map((p) => (
            <PillarCard key={p} pillar={p} okr={byPillar[p]} onUpdateKr={handleUpdateKr} onUpdateObjective={handleUpdateObjective} onUpdateDesc={handleUpdateDesc} onUpdateTarget={handleUpdateTarget} />
          ))}
        </div>
      )}
    </div>
  );
};

export default OKRModule;


