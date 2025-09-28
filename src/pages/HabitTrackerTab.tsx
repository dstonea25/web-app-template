import React from 'react';
import { tokens, cn } from '../theme/config';
import { toast } from '../lib/notifications/toast';
import type { Habit } from '../types';
import { apiClient } from '../lib/api';
import { isSupabaseConfigured } from '../lib/supabase';

interface HabitTrackerTabProps {
  isVisible?: boolean;
}

// Utilities
const getCurrentYear = () => new Date().getFullYear();
const formatDate = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Generate month labels for current year (for header row)
const useMonths = (year: number) => {
  return React.useMemo(() => {
    const months: { monthIndex: number; monthLabel: string }[] = [];
    for (let m = 0; m < 12; m++) {
      const monthLabel = new Date(year, m, 1).toLocaleString(undefined, { month: 'short' });
      months.push({ monthIndex: m, monthLabel });
    }
    return months;
  }, [year]);
};

// No dummy data: all data must come from database

export const HabitTrackerTab: React.FC<HabitTrackerTabProps> = ({ isVisible }) => {
  const year = getCurrentYear();
  const months = useMonths(year);
  const [, startTransition] = React.useTransition();
  const DEBUG = true;
  const debug = (...args: any[]) => { if (DEBUG) console.log('[HabitTracker]', ...args); };
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [selectedHabitId, setSelectedHabitId] = React.useState<string>('');
  const deferredSelectedHabitId = React.useDeferredValue(selectedHabitId);
  const [calendarData, setCalendarData] = React.useState<Record<string, Set<string>>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [isHabitLoading, setIsHabitLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [loadedHabits, setLoadedHabits] = React.useState<Set<string>>(new Set());
  const [hoveredDate, setHoveredDate] = React.useState<string | null>(null);
  const initialHabitsRef = React.useRef<Habit[]>(habits);
  const initStartRef = React.useRef<number | null>(null);
  const switchStartRef = React.useRef<number | null>(null);

  // Memoized derived data to avoid recomputing and re-rendering heavy grid unnecessarily
  const currentHabit = React.useMemo(() => habits.find(h => h.id === deferredSelectedHabitId), [habits, deferredSelectedHabitId]);
  const currentHabitDaysSet = React.useMemo(() => calendarData[deferredSelectedHabitId] || new Set<string>(), [calendarData, deferredSelectedHabitId]);
  const validDaysByMonth = React.useMemo(
    () => months.map(({ monthIndex }) => new Date(year, monthIndex + 1, 0).getDate()),
    [months, year]
  );
  const gridDates = React.useMemo(() => {
    const rows: { date: string; valid: boolean; monthIndex: number; day: number }[][] = [];
    for (let rowIdx = 0; rowIdx < 31; rowIdx++) {
      const day = rowIdx + 1;
      const row: { date: string; valid: boolean; monthIndex: number; day: number }[] = [];
      for (let m = 0; m < 12; m++) {
        const valid = day <= validDaysByMonth[m];
        const date = valid ? formatDate(year, m, day) : `${year}-${String(m + 1).padStart(2,'0')}-00`;
        row.push({ date, valid, monthIndex: m, day });
      }
      rows.push(row);
    }
    return rows;
  }, [validDaysByMonth, year]);

  // SVG-based calendar rendering for performance

  // Load habits and entries from Supabase (current year only). Fallback to defaults if not configured or empty.
  React.useEffect(() => {
    if (!isVisible) {
      // Defer loading while not visible; ensure we still have a sensible default selection
      if (!selectedHabitId && habits[0]?.id) setSelectedHabitId(habits[0].id);
      return;
    }
    let isCancelled = false;
    const load = async () => {
      initStartRef.current = performance.now();
      debug('init:start');
      try {
        if (!isSupabaseConfigured) {
          setErrorMessage('Supabase not configured. Cannot load habits.');
          if (!isCancelled) {
            setIsInitialLoading(false);
            requestAnimationFrame(() => {
              const ms = Math.round((performance.now() - (initStartRef.current || performance.now())));
              debug('init:paint (no-supabase) ms=', ms);
            });
          }
          return; // keep defaults/local storage
        }
        // Stale-while-revalidate: paint from localStorage cache immediately if available
        const cachedHabits = apiClient.getCachedHabits();
        const cachedEntriesSelected = selectedHabitId ? apiClient.getCachedHabitEntriesForHabit(year, selectedHabitId) : null;
        if ((cachedHabits && cachedHabits.length) || (cachedEntriesSelected && cachedEntriesSelected.length)) {
          const localRulesMap = new Map<string, string | undefined>(
            (initialHabitsRef.current || []).map(h => [h.id, h.rule])
          );
          const mergedHabitsCached = (cachedHabits && cachedHabits.length > 0)
            ? cachedHabits.map(h => {
                const rule = localRulesMap.get(h.id);
                return rule ? { ...h, rule } : h;
              })
            : habits;
          const nextCalendarCached: Record<string, Set<string>> = {};
          for (const h of mergedHabitsCached) nextCalendarCached[h.id] = new Set<string>();
          if (cachedEntriesSelected && selectedHabitId) {
            for (const e of cachedEntriesSelected) {
              if (e.complete) nextCalendarCached[selectedHabitId].add(e.date);
            }
            setLoadedHabits(prev => new Set(prev).add(selectedHabitId));
          }
          setHabits(mergedHabitsCached);
          setCalendarData(nextCalendarCached);
          const stillExistsCached = mergedHabitsCached.some(h => h.id === selectedHabitId);
          const nextSelectionCached = stillExistsCached ? selectedHabitId : (mergedHabitsCached[0]?.id ?? '');
          if (nextSelectionCached) setSelectedHabitId(nextSelectionCached);
          if (!isCancelled) {
            setIsInitialLoading(false);
            requestAnimationFrame(() => {
              const ms = Math.round((performance.now() - (initStartRef.current || performance.now())));
              debug('init:cache-paint ms=', ms);
            });
          }
        }

        // Fetch fresh data in background and update (deduped at API layer)
        const remoteHabits = await apiClient.fetchHabitsFromSupabase();
        if (!remoteHabits || remoteHabits.length === 0) {
          setErrorMessage('No habits found in database.');
          setHabits([]);
          setIsInitialLoading(false);
          return;
        }
        const selected = selectedHabitId || remoteHabits[0]?.id || '';
        const entriesSelected = selected ? await apiClient.fetchHabitEntriesForHabit(year, selected) : [];
        if (isCancelled) return;

        const localRulesMap = new Map<string, string | undefined>(
          (initialHabitsRef.current || []).map(h => [h.id, h.rule])
        );
        const mergedHabits: Habit[] = (remoteHabits && remoteHabits.length > 0)
          ? remoteHabits.map(h => {
              const rule = localRulesMap.get(h.id);
              return rule ? { ...h, rule } : h;
            })
          : habits; // should not happen due to guard above

        // Build calendar data from entries (Sets)
        const nextCalendar: Record<string, Set<string>> = {};
        for (const h of mergedHabits) nextCalendar[h.id] = new Set<string>();
        for (const e of entriesSelected) {
          if (e.complete) nextCalendar[selected].add(e.date);
        }

        setHabits(mergedHabits);
        setCalendarData(nextCalendar);
        setLoadedHabits(prev => new Set(prev).add(selected));
        const stillExists = mergedHabits.some(h => h.id === selectedHabitId);
        const nextSelection = stillExists ? selectedHabitId : (mergedHabits[0]?.id ?? '');
        if (nextSelection) setSelectedHabitId(nextSelection);
      } catch (err) {
        // Non-fatal: keep defaults
        // eslint-disable-next-line no-console
        console.warn('Failed to load habits from Supabase; using defaults', err);
        setErrorMessage('Failed to load from database.');
      } finally {
        if (!isCancelled) {
          setIsInitialLoading(false);
          requestAnimationFrame(() => {
            const ms = Math.round((performance.now() - (initStartRef.current || performance.now())));
            debug('init:net-paint ms=', ms);
          });
        }
      }
    };
    load();
    return () => { isCancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  // Idle prefetch of other habits after first paint
  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (!habits.length || !selectedHabitId) return;
    const id = window.requestIdleCallback || ((cb: any) => setTimeout(cb, 300));
    const cancel = id(async () => {
      const others = habits.map(h => h.id).filter(id => id !== selectedHabitId);
      for (const hid of others) {
        try {
          const entries = await apiClient.fetchHabitEntriesForHabit(getCurrentYear(), hid);
          setCalendarData(prev => {
            const next: Record<string, Set<string>> = { ...prev };
            const set = new Set<string>();
            for (const e of entries) if (e.complete) set.add(e.date);
            next[hid] = set;
            return next;
          });
          setLoadedHabits(prev => new Set(prev).add(hid));
        } catch {}
      }
    });
    return () => {
      if (typeof cancel === 'number') clearTimeout(cancel as any);
      // requestIdleCallback cancellation not strictly needed here
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits, selectedHabitId]);

  const handleSelectHabit = (habitId: string) => {
    switchStartRef.current = performance.now();
    startTransition(() => setSelectedHabitId(habitId));
    // Trigger fetch if we don't have entries for this habit yet
    if (isSupabaseConfigured) {
      const isLoaded = loadedHabits.has(habitId);
      if (!isLoaded) {
        setIsHabitLoading(true);
        apiClient.fetchHabitEntriesForHabit(getCurrentYear(), habitId)
          .then(entries => {
            setCalendarData(prev => {
              const next: Record<string, Set<string>> = { ...prev };
              const set = new Set<string>();
              for (const e of entries) if (e.complete) set.add(e.date);
              next[habitId] = set;
              return next;
            });
            setLoadedHabits(prev => new Set(prev).add(habitId));
          })
          .catch(() => {
            toast.error('Failed to load habit entries');
          })
          .finally(() => setIsHabitLoading(false));
      }
    }
  };

  // Measure paint after habit switch
  React.useEffect(() => {
    if (!isVisible) return;
    if (switchStartRef.current == null) return;
    requestAnimationFrame(() => {
      const ms = Math.round(performance.now() - (switchStartRef.current || 0));
      debug('switch:paint ms=', ms, 'habit=', selectedHabitId);
      switchStartRef.current = null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredSelectedHabitId, currentHabitDaysSet]);

  // No rule editing in this view; rules are read-only labels sourced from DB

  const toggleDay = async (dateIso: string) => {
    if (isInitialLoading || isHabitLoading || !selectedHabitId || !loadedHabits.has(selectedHabitId) || errorMessage) return;
    const habitId = selectedHabitId;
    const prevHad = Boolean(calendarData[habitId]?.has(dateIso));
    const nextVal = !prevHad;
    const t0 = performance.now();
    startTransition(() => {
      setCalendarData(prev => {
        const next: Record<string, Set<string>> = { ...prev };
        const set = new Set<string>(next[habitId] || []);
        if (nextVal) set.add(dateIso); else set.delete(dateIso);
        next[habitId] = set;
        return next;
      });
    });
    setIsSaving(true);
    try {
      if (isSupabaseConfigured) {
        const res = await apiClient.upsertHabitEntry({ habitId, date: dateIso, isDone: nextVal, source: 'frontend' });
        if (!res.success) throw new Error(res.error || 'Failed');
      }
      requestAnimationFrame(() => debug('toggle:paint ms=', Math.round(performance.now() - t0), dateIso));
      toast.success('Saved');
    } catch (e) {
      // rollback
      setCalendarData(prev => {
        const next: Record<string, Set<string>> = { ...prev };
        const set = new Set<string>(next[habitId] || []);
        if (prevHad) set.add(dateIso); else set.delete(dateIso);
        next[habitId] = set;
        return next;
      });
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const renderPills = () => (
    <div className="flex flex-wrap gap-2 mb-2 justify-center">
      {habits.map(h => (
        <button
          key={h.id}
          onClick={() => handleSelectHabit(h.id)}
          className={cn(
            'px-3 py-1 rounded-full text-sm font-medium cursor-pointer',
            selectedHabitId === h.id ? 'bg-emerald-600 text-white' : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
          )}
          aria-pressed={selectedHabitId === h.id}
          title={h.rule || undefined}
        >
          {h.name}
        </button>
      ))}
    </div>
  );

  const renderRuleSubtext = () => {
    const current = habits.find(h => h.id === selectedHabitId);
    if (!current?.rule) return null;
    return (
      <div className="text-xs text-neutral-400 mb-3">{current.rule}</div>
    );
  };

  const renderCalendar = () => {
    // Visual constants (match approximate sizing from button grid)
    const size = 28; // px diameter
    const gap = 4; // px gap
    const headerH = 16; // px for month labels
    const cols = 12;
    const rows = 31;
    const width = cols * size + (cols - 1) * gap;
    const height = headerH + rows * size + (rows - 1) * gap;
    const disabled = isInitialLoading || isHabitLoading;

    return (
      <div className="space-y-2">
        <div className={cn('overflow-x-auto sm:overflow-visible -mx-2 sm:mx-0', disabled && 'opacity-50')}>
          <div className="flex justify-center">
            <div className="inline-block px-2 sm:px-0" style={{ contentVisibility: 'auto' as any }}>
            <svg
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={`${year} habit calendar`}
            >
                <defs>
                  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0  0 1 0 0 0.5  0 0 0 0 0.35  0 0 0 0.8 0"/>
                    <feMerge>
                      <feMergeNode />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
              {/* Month labels */}
              {months.map(({ monthLabel }, m) => {
                const x = m * (size + gap) + size / 2;
                const y = headerH - 2;
                return (
                  <text
                    key={`label-${m}`}
                    x={x}
                    y={y}
                    fontSize={10}
                    textAnchor="middle"
                    fill="#9CA3AF"
                    dominantBaseline="ideographic"
                  >
                    {monthLabel.toLowerCase()}
                  </text>
                );
              })}

              {/* Day circles */}
              {gridDates.flatMap((row, r) =>
                row.map(({ date, valid, day }, m) => {
                  if (!valid) return null;
                  const cx = m * (size + gap) + size / 2;
                  const cy = headerH + r * (size + gap) + size / 2;
                  const complete = currentHabitDaysSet.has(date);
                  const stroke = hoveredDate === date ? '#6ee7b7' : (complete ? '#34d399' : '#374151');
                  const textFill = complete ? '#34d399' : '#9ca3af';
                  const textOpacity = complete ? 1 : 0.22; // barely visible when off
                  return (
                    <g
                      key={date}
                      onClick={() => !disabled && toggleDay(date)}
                      onMouseEnter={() => setHoveredDate(date)}
                      onMouseLeave={() => setHoveredDate(null)}
                      style={{ cursor: disabled ? 'default' : 'pointer' }}
                      filter={complete ? 'url(#glow)' : undefined}
                    >
                      {/* Hexagon button (flat-top) */}
                      <polygon
                        points={`
                          ${cx - size * 0.5},${cy}
                          ${cx - size * 0.25},${cy - size * 0.433}
                          ${cx + size * 0.25},${cy - size * 0.433}
                          ${cx + size * 0.5},${cy}
                          ${cx + size * 0.25},${cy + size * 0.433}
                          ${cx - size * 0.25},${cy + size * 0.433}
                        `}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={2}
                      >
                        <title>{date}</title>
                      </polygon>
                      <text
                        x={cx}
                        y={cy + 3}
                        fontSize={12}
                        fontWeight={600}
                        textAnchor="middle"
                        fill={textFill}
                        opacity={textOpacity}
                        pointerEvents="none"
                      >
                        {day}
                      </text>
                    </g>
                  );
                })
              )}
            </svg>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={cn(tokens.layout.container, !isVisible && 'hidden')}>
      <div className="mb-6 p-6 rounded-2xl border border-neutral-800 bg-neutral-900">
        <header className="mb-4 relative">
          <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text, 'text-center')}>{year}</h2>
          {(isSaving || isInitialLoading || isHabitLoading) && (
            <div className="absolute right-0 top-0 text-xs text-neutral-400">
              {isInitialLoading ? 'Loading…' : (isHabitLoading ? 'Loading habit…' : 'Sending…')}
            </div>
          )}
        </header>
        {isInitialLoading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="text-sm text-neutral-400">Loading habits…</div>
          </div>
        ) : (
          <>
            {renderPills()}
            {renderRuleSubtext()}
            {errorMessage ? (
              <div className="py-8 text-center text-sm text-red-400">{errorMessage}</div>
            ) : (
              <div className={cn(isHabitLoading && 'opacity-60 pointer-events-none')}>{renderCalendar()}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default HabitTrackerTab;


