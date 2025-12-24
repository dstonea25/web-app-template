import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Okr, OkrKeyResult, OkrPillar } from '../../types';
import { tokens, cn } from '../../theme/config';
import { fetchOkrsWithProgress, fetchOkrById, updateKeyResultValue, updateObjective, updateKrDescription, updateKrTarget, updateKrBaseline, updateKrDirection, updateKrDataSource, syncHabitToKR, normalizeKrProgress } from '../../lib/okrs';
import toast from '../../lib/notifications/toast';
import { Pencil, TrendingUp, TrendingDown, Settings } from 'lucide-react';

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
  const rounded = Math.max(0, Math.round(value || 0));
  const isOverAchieved = rounded > 100;
  
  // For over-achievement, show full bar with special styling
  const displayWidth = Math.min(100, rounded);
  const overColor = isOverAchieved ? '#34D399' : color; // Emerald-400 for over-achievement
  
  return (
    <div className={cn('h-2 w-full rounded-full bg-neutral-800 overflow-hidden relative', flash && 'ring-2 ring-offset-2 ring-offset-neutral-950', isOverAchieved && 'ring-1 ring-emerald-400/50')} style={flash ? { boxShadow: `0 0 0 2px ${color}` } : undefined} aria-valuemin={0} aria-valuemax={100} aria-valuenow={rounded} role="progressbar">
      <div className={cn('h-full transition-[width]', isOverAchieved && 'animate-pulse')} style={{ width: `${displayWidth}%`, backgroundColor: overColor }} />
      {isOverAchieved && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
      )}
    </div>
  );
}

function OKRSettingsModal({ okr, pillar, onClose, onUpdateDirection, onUpdateBaseline, onUpdateDataSource }: { okr: Okr | null; pillar: OkrPillar; onClose: () => void; onUpdateDirection: (kr: OkrKeyResult, direction: 'up' | 'down') => void; onUpdateBaseline: (kr: OkrKeyResult, baseline: number) => void; onUpdateDataSource: (kr: OkrKeyResult, data_source: 'manual' | 'habit', linked_habit_id?: string | null) => void; }) {
  const [habits, setHabits] = useState<Array<{ id: string; name: string }>>([]);
  
  useEffect(() => {
    const loadHabits = async () => {
      const { supabase } = await import('../../lib/supabase');
      if (!supabase) return;
      const { data } = await supabase.from('habits').select('id, name').order('name');
      if (data) setHabits(data);
    };
    loadHabits();
  }, []);
  
  if (!okr) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-neutral-400">{pillar}</div>
            <h3 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, 'text-neutral-100 mt-1')}>
              OKR Settings
            </h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-100 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <div className="text-sm text-neutral-400 mb-4">
            Configure direction and baseline values for each key result
          </div>

          {(okr.key_results || []).map((kr) => (
            <div key={kr.id} className="bg-neutral-800/50 rounded-lg p-4 space-y-3">
              <div className="font-medium text-neutral-100">{kr.description}</div>
              
              {kr.kind !== 'boolean' && (
                <>
                  {/* Direction Toggle */}
                  <div className="flex items-center gap-4">
                    <label className="text-sm text-neutral-400 w-24">Direction:</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onUpdateDirection(kr, 'up')}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                          kr.direction !== 'down'
                            ? 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/50'
                            : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600'
                        )}
                      >
                        <TrendingUp className="w-4 h-4" />
                        <span>Count Up</span>
                      </button>
                      <button
                        onClick={() => onUpdateDirection(kr, 'down')}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                          kr.direction === 'down'
                            ? 'bg-orange-500/20 text-orange-400 ring-2 ring-orange-500/50'
                            : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600'
                        )}
                      >
                        <TrendingDown className="w-4 h-4" />
                        <span>Countdown</span>
                      </button>
                    </div>
                  </div>

                  {/* Baseline (only for countdown) */}
                  {kr.direction === 'down' && (
                    <div className="flex items-center gap-4">
                      <label className="text-sm text-neutral-400 w-24">Baseline:</label>
                      <input
                        type="number"
                        value={kr.baseline_value || 0}
                        onChange={(e) => onUpdateBaseline(kr, Number(e.target.value))}
                        className="w-20 px-2 py-2 border rounded-lg bg-neutral-900 border-neutral-800 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-neutral-950"
                        placeholder="Start"
                        min={0}
                        step={1}
                      />
                      <span className="text-xs text-neutral-500">Starting value before goal</span>
                    </div>
                  )}

                  {/* Data Source Selection */}
                  <div className="flex items-center gap-4">
                    <label className="text-sm text-neutral-400 w-24">Data Source:</label>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name={`data-source-${kr.id}`}
                          checked={kr.data_source !== 'habit'}
                          onChange={() => onUpdateDataSource(kr, 'manual')}
                          className="w-4 h-4"
                        />
                        <span className="text-neutral-300">Manual tracking</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name={`data-source-${kr.id}`}
                          checked={kr.data_source === 'habit'}
                          onChange={() => {
                            if (habits.length > 0) {
                              onUpdateDataSource(kr, 'habit', habits[0].id);
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-neutral-300">Link to habit:</span>
                        {kr.data_source === 'habit' && (
                          <select
                            value={kr.linked_habit_id || ''}
                            onChange={(e) => onUpdateDataSource(kr, 'habit', e.target.value)}
                            className="px-2 py-1 text-xs rounded border bg-neutral-900 border-neutral-700 text-neutral-100"
                          >
                            {habits.map((habit) => (
                              <option key={habit.id} value={habit.id}>
                                {habit.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="text-xs text-neutral-500 bg-neutral-900/50 rounded p-2">
                    {kr.data_source === 'habit' ? (
                      <>
                        <span className="font-medium text-teal-400">🔗 Habit-linked:</span> Auto-syncs from habit tracker. Current value updates automatically.
                      </>
                    ) : kr.direction === 'down' ? (
                      <>
                        <span className="font-medium text-orange-400">Countdown:</span> Progress from baseline ({kr.baseline_value || '?'}) down to target ({kr.target_value || 0})
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-emerald-400">Count-up:</span> Progress from 0 up to target ({kr.target_value || 0}), can exceed 100%
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-neutral-900 border-t border-neutral-800 px-6 py-4">
          <button
            onClick={onClose}
            className={cn(tokens.button.base, tokens.button.primary, 'w-full')}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function PillarCard({ pillar, okr, onUpdateKr, onUpdateObjective, onUpdateDesc, onUpdateTarget, onUpdateDirection, onUpdateBaseline, onUpdateDataSource, onRefresh }: { pillar: OkrPillar; okr: Okr | null; onUpdateKr: (kr: OkrKeyResult, value: number | boolean) => Promise<void>; onUpdateObjective: (okrId: string, value: string) => void; onUpdateDesc: (kr: OkrKeyResult, value: string) => void; onUpdateTarget: (kr: OkrKeyResult, value: number) => void; onUpdateDirection: (kr: OkrKeyResult, direction: 'up' | 'down') => void; onUpdateBaseline: (kr: OkrKeyResult, baseline: number) => void; onUpdateDataSource: (kr: OkrKeyResult, data_source: 'manual' | 'habit', linked_habit_id?: string | null) => void; onRefresh: () => Promise<void>; }) {
  const accent = PILLAR_COLORS[pillar]?.base || '#5EEAD4';
  const [editingObjective, setEditingObjective] = useState(false);
  const [objectiveDraft, setObjectiveDraft] = useState<string>(okr?.objective || '');
  const objectiveRef = useRef<HTMLInputElement | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => { setObjectiveDraft(okr?.objective || ''); }, [okr?.id, okr?.objective]);

  const handleCloseSettings = async () => {
    setShowSettings(false);
    // Refresh OKRs after settings changes
    await onRefresh();
  };

  const commitObjective = () => {
    if (!okr) return;
    const value = (objectiveDraft || '').trim();
    if (value === (okr.objective || '')) { setEditingObjective(false); return; }
    onUpdateObjective(okr.id, value);
    setEditingObjective(false);
  };
  return (
    <>
      {showSettings && (
        <OKRSettingsModal
          okr={okr}
          pillar={pillar}
          onClose={handleCloseSettings}
          onUpdateDirection={onUpdateDirection}
          onUpdateBaseline={onUpdateBaseline}
          onUpdateDataSource={onUpdateDataSource}
        />
      )}
      
      <div className={cn(tokens.card.base, 'relative')}>
      <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
          {/* Objective first - the hero content */}
          <div className="sm:min-h-[72px] flex items-start">
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
              <div className="flex-1">
                <div
                  className={cn('text-neutral-100 line-clamp-2', tokens.typography.scale.h3, tokens.typography.weights.semibold, 'cursor-text')}
                  onClick={() => setEditingObjective(true)}
                  title="Click to edit objective"
                >
                  {okr?.objective || 'No objective set'}
                </div>
                {/* Pillar name as subtext with settings cog */}
                <div className="flex items-center gap-2 mt-2.5">
                  <div className={cn('text-xs text-neutral-500 uppercase tracking-wide font-medium')}>{pillar}</div>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="text-neutral-500 hover:text-neutral-300 transition-colors p-0.5 rounded hover:bg-neutral-800"
                    title="OKR Settings"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-2.5 space-y-3">
        {(okr?.key_results || []).map((kr) => (
          <KeyResultRow key={kr.id} kr={kr} accent={accent} onUpdate={(v) => onUpdateKr(kr, v)} onUpdateDesc={onUpdateDesc} onUpdateTarget={onUpdateTarget} onUpdateDirection={onUpdateDirection} onUpdateBaseline={onUpdateBaseline} />
        ))}
        {(!okr || !okr.key_results || okr.key_results.length === 0) && (
          <div className="py-3 text-sm text-neutral-400">No key results.</div>
        )}
        {/* Desktop-only spacer to help align card bottoms when counts differ */}
        <div className="hidden sm:block h-2" aria-hidden></div>
      </div>
    </div>
    </>
  );
}

function KeyResultRow({ kr, onUpdate, saving, accent, onUpdateDesc, onUpdateTarget, onUpdateBaseline }: { kr: OkrKeyResult; onUpdate: (val: number | boolean) => void; saving?: boolean; accent: string; onUpdateDesc?: (kr: OkrKeyResult, value: string) => void; onUpdateTarget?: (kr: OkrKeyResult, value: number) => void; onUpdateDirection?: (kr: OkrKeyResult, direction: 'up' | 'down') => void; onUpdateBaseline?: (kr: OkrKeyResult, baseline: number) => void; }) {
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
  const [editingBaseline, setEditingBaseline] = useState(false);
  const [baselineDraft, setBaselineDraft] = useState<number>(Number(kr.baseline_value || 0));
  const baselineRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (kr.kind === 'boolean') setLocalValue(Boolean(kr.current_value));
    else setLocalValue(Number(kr.current_value || 0));
    setDescDraft(kr.description || '');
    setTargetDraft(Number(kr.target_value || 0));
    setBaselineDraft(Number(kr.baseline_value || 0));
  }, [kr.id, kr.current_value, kr.kind, kr.baseline_value]);

  const clampNumber = (val: number) => {
    if (kr.kind === 'percent') {
      // Allow over 100% for percent type
      return Math.max(0, val);
    }
    // For count type, allow over-achievement (no upper cap)
    return Math.max(0, val);
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
    if (kr.kind === 'percent') {
      // Allow over 100% for percent type
      return Math.max(0, Math.round(Number(isEditingCurrent ? localValue : kr.current_value || 0)));
    }
    
    const currentNum = Number(isEditingCurrent ? localValue || 0 : kr.current_value || 0);
    const targetNumLive = Number(editingTarget ? targetDraft || 0 : kr.target_value || 0);
    
    // Countdown direction (minimize)
    if (kr.direction === 'down') {
      const baseline = Number(kr.baseline_value || 0);
      if (baseline === 0 || baseline === targetNumLive) return 0;
      // Progress = (baseline - current) / (baseline - target)
      const progress = ((baseline - currentNum) / (baseline - targetNumLive)) * 100;
      return Math.max(0, Math.round(progress)); // Can exceed 100%
    }
    
    // Count up direction (maximize) - NO CAP for over-achievement
    if (targetNumLive <= 0) return 0;
    return Math.max(0, Math.round((currentNum / targetNumLive) * 100));
  };
  const progress = calcProgress();

  return (
    <div className={cn(
      "p-3 rounded-xl border border-neutral-800 bg-neutral-900/30",
      "sm:min-h-[104px] sm:flex sm:flex-col sm:justify-between",
      "transition-all duration-200",
      "hover:bg-neutral-800/40 hover:border-neutral-700 hover:shadow-md",
      "overflow-visible"
    )}>
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
        <div className="flex items-center gap-2">
          <div className="text-neutral-100 font-medium line-clamp-2 leading-[1.3] cursor-text pb-2 flex-1" onClick={() => setEditingDesc(true)} title="Click to edit">
            {kr.description}
          </div>
          {kr.data_source === 'habit' && kr.linked_habit_id && (
            <span className="text-teal-400 text-sm shrink-0" title="Auto-synced from habit tracker">
              🔗
            </span>
          )}
        </div>
      )}
      {/* Line 2: Progress bar */}
      <div className="mt-2 sm:mt-2">
        <ProgressBar value={progress} color={accent} />
      </div>
      {/* Line 3: left percent, right current/target or control */}
      <div className="mt-2 sm:mt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <div className={cn('text-xs font-medium', progress > 100 ? 'text-emerald-400' : '')} style={progress <= 100 ? { color: accent } : undefined}>
            {progress}%
          </div>
          {progress > 100 && (
            <div className="text-xs text-emerald-400 font-bold" title="Over-achieved!">
              🎉
            </div>
          )}
        </div>
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
                className="w-16 px-2 py-2 border rounded-lg bg-neutral-900 border-neutral-800 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-neutral-950 cursor-text"
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
          ) : kr.direction === 'down' ? (
            // Countdown display: baseline → current → target (e.g., 252 → 250 → 245)
            <div role="group" tabIndex={0} className="flex items-center gap-1.5 text-sm group cursor-text outline-none" onClick={() => inputRef.current?.focus()} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.focus(); } }}>
              {editingBaseline ? (
                <input
                  ref={baselineRef}
                  type="number"
                  value={String(baselineDraft)}
                  onChange={(e) => setBaselineDraft(Number(e.target.value || 0))}
                  onBlur={() => { onUpdateBaseline && onUpdateBaseline(kr, Math.max(0, Number(baselineDraft || 0))); setEditingBaseline(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { onUpdateBaseline && onUpdateBaseline(kr, Math.max(0, Number(baselineDraft || 0))); setEditingBaseline(false); } if (e.key === 'Escape') { setBaselineDraft(Number(kr.baseline_value || 0)); setEditingBaseline(false); } }}
                  className="w-16 px-2 py-2 border rounded-lg bg-neutral-900 border-neutral-800 text-neutral-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-neutral-950"
                  min={0}
                  step={1}
                  aria-label="Baseline value"
                  autoFocus
                />
              ) : (
                <span className="text-neutral-500 text-xs cursor-pointer hover:text-neutral-400" onClick={(e) => { e.stopPropagation(); setEditingBaseline(true); }} title="Click to edit baseline">
                  {kr.baseline_value ?? '?'}
                </span>
              )}
              <span className="text-neutral-600">→</span>
              <input
                type="number"
                className="w-16 px-2 py-2 border rounded-lg bg-neutral-900 border-neutral-800 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-neutral-950 cursor-text"
                value={String(localValue)}
                onChange={(e) => setLocalValue(e.target.value === '' ? '' : Number(e.target.value))}
                onFocus={() => setIsEditingCurrent(true)}
                onBlur={() => { setIsEditingCurrent(false); commitIfChanged(); }}
                onKeyDown={(e) => { if (e.key === 'Enter') commitIfChanged(); }}
                min={0}
                step={1}
                disabled={saving}
                aria-label="Current value"
                ref={inputRef}
                inputMode="numeric"
                pattern="[0-9]*"
              />
              <span className="text-neutral-600">→</span>
              {editingTarget ? (
                <input
                  ref={targetRef}
                  type="number"
                  value={String(targetDraft)}
                  onChange={(e) => setTargetDraft(Number(e.target.value || 0))}
                  onBlur={() => { onUpdateTarget && onUpdateTarget(kr, Math.max(0, Number(targetDraft || 0))); setEditingTarget(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { onUpdateTarget && onUpdateTarget(kr, Math.max(0, Number(targetDraft || 0))); setEditingTarget(false); } if (e.key === 'Escape') { setTargetDraft(Number(kr.target_value || 0)); setEditingTarget(false); } }}
                  className="w-16 px-2 py-2 border rounded-lg bg-neutral-900 border-neutral-800 text-neutral-100 text-right focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-neutral-950"
                  min={0}
                  step={1}
                  aria-label="Target value"
                  autoFocus
                />
              ) : (
                <span className="text-emerald-400 font-medium cursor-text" aria-label="Target value" onClick={() => setEditingTarget(true)} title="Click to edit target">{String(kr.target_value ?? 0)}</span>
              )}
              <Pencil className="w-3.5 h-3.5 text-neutral-500 opacity-0 group-hover:opacity-100" aria-hidden />
            </div>
          ) : (
            // Count up display: current / target (can exceed target)
            <div role="group" tabIndex={0} className="flex items-center gap-2 text-sm group cursor-text outline-none" onClick={() => inputRef.current?.focus()} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.focus(); } }}>
              <input
                type="number"
                className="w-16 px-2 py-2 border rounded-lg bg-neutral-900 border-neutral-800 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-neutral-950 cursor-text"
                value={String(localValue)}
                onChange={(e) => setLocalValue(e.target.value === '' ? '' : Number(e.target.value))}
                onFocus={() => setIsEditingCurrent(true)}
                onBlur={() => { setIsEditingCurrent(false); commitIfChanged(); }}
                onKeyDown={(e) => { if (e.key === 'Enter') commitIfChanged(); }}
                min={0}
                max={undefined} // No max - allow over-achievement!
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
                  className="w-16 px-2 py-2 border rounded-lg bg-neutral-900 border-neutral-800 text-neutral-100 text-right focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-neutral-950"
                  min={0}
                  step={1}
                  aria-label="Target value"
                  autoFocus
                />
              ) : (
                <span className="text-neutral-300 cursor-text" aria-label="Target value" onClick={() => setEditingTarget(true)} title="Click to edit target">{String(kr.target_value ?? 0)}</span>
              )}
              <Pencil className="w-3.5 h-3.5 text-neutral-500 opacity-0 group-hover:opacity-100" aria-hidden />
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
      
      // Sync habit-linked KRs after data is loaded
      // Find all habit-linked KRs from the loaded data
      const habitLinkedKRs = data.flatMap(o => 
        (o.key_results || []).filter(kr => kr.data_source === 'habit' && kr.auto_sync)
      );
      
      // If there are habit-linked KRs, sync them all then reload once
      if (habitLinkedKRs.length > 0) {
        // Sync all habit-linked KRs (in background, don't block UI)
        Promise.all(habitLinkedKRs.map(kr => syncHabitToKR(kr.id)))
          .then(() => {
            // Reload all OKRs once after all syncs complete to maintain sort order
            fetchOkrsWithProgress().then(refreshedData => {
              setOkrs(refreshedData);
            });
          })
          .catch(e => console.error('Failed to sync habit KRs:', e));
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load OKRs');
      setOkrs([]);
    } finally {
      setLoading(false);
    }
  };

  // Load data only once on mount, not on visibility changes
  const hasLoadedRef = useRef(false);
  useEffect(() => { 
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      load();
    }
  }, []); // Empty deps = load once on mount
  
  // Listen for refresh events to reload when needed
  useEffect(() => {
    const handleRefresh = () => {
      load();
    };
    window.addEventListener('dashboard:okrs-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard:okrs-refresh', handleRefresh);
  }, []);

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

  const handleUpdateDirection = (kr: OkrKeyResult, direction: 'up' | 'down') => {
    // Optimistic update
    setOkrs(prevOkrs => prevOkrs.map(o => (
      o.key_results?.some(k => k.id === kr.id)
        ? { ...o, key_results: (o.key_results || []).map(k => k.id === kr.id ? { ...k, direction, progress: normalizeKrProgress({ ...k, direction } as any) } : k) }
        : o
    )));
    
    toast.info(`Changed to ${direction === 'down' ? 'countdown' : 'count-up'} mode`, { ttlMs: 1500 });
    
    // Immediate save (no undo for direction changes)
    updateKrDirection(kr.id, direction).then(() => refetchSingle(kr.okr_id)).catch((e: any) => {
      toast.error(e?.message || 'Failed to update direction');
    });
  };

  const handleUpdateBaseline = (kr: OkrKeyResult, baseline: number) => {
    // Optimistic update
    setOkrs(prevOkrs => prevOkrs.map(o => (
      o.key_results?.some(k => k.id === kr.id)
        ? { ...o, key_results: (o.key_results || []).map(k => k.id === kr.id ? { ...k, baseline_value: baseline, progress: normalizeKrProgress({ ...k, baseline_value: baseline } as any) } : k) }
        : o
    )));
    
    toast.info(`Baseline set to ${baseline}`, { ttlMs: 1500 });
    
    // Immediate save
    updateKrBaseline(kr.id, baseline).then(() => refetchSingle(kr.okr_id)).catch((e: any) => {
      toast.error(e?.message || 'Failed to update baseline');
    });
  };

  const handleUpdateDataSource = async (kr: OkrKeyResult, data_source: 'manual' | 'habit', linked_habit_id?: string | null) => {
    // Optimistic update
    setOkrs(prevOkrs => prevOkrs.map(o => (
      o.key_results?.some(k => k.id === kr.id)
        ? { ...o, key_results: (o.key_results || []).map(k => k.id === kr.id ? { ...k, data_source, linked_habit_id: linked_habit_id || null, auto_sync: data_source === 'habit' } : k) }
        : o
    )));
    
    try {
      await updateKrDataSource(kr.id, data_source, linked_habit_id, data_source === 'habit');
      
      if (data_source === 'habit' && linked_habit_id) {
        // Sync immediately
        const count = await syncHabitToKR(kr.id);
        toast.info(`Linked to habit! Synced ${count} completions`, { ttlMs: 2000 });
      } else {
        toast.info('Changed to manual tracking', { ttlMs: 1500 });
      }
      
      await refetchSingle(kr.okr_id);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update data source');
    }
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 auto-rows-fr">
          {PILLARS.map((p) => (
            <PillarCard key={p} pillar={p} okr={byPillar[p]} onUpdateKr={handleUpdateKr} onUpdateObjective={handleUpdateObjective} onUpdateDesc={handleUpdateDesc} onUpdateTarget={handleUpdateTarget} onUpdateDirection={handleUpdateDirection} onUpdateBaseline={handleUpdateBaseline} onUpdateDataSource={handleUpdateDataSource} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  );
};

export default OKRModule;


