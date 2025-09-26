import React from 'react';
import { tokens, cn } from '../theme/config';
import { toast } from '../lib/notifications/toast';
import type { Habit, HabitEvent } from '../types';
import { saveLedgerToWebhook } from '../lib/api';

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

// Default habits per user request
const DEFAULT_HABITS: Habit[] = [
  { id: 'workout', name: 'Working Out', rule: '15 min activity that makes you sweat' },
  { id: 'building', name: 'Building', rule: '≥ 30 minutes on a personal project' },
  { id: 'reading', name: 'Reading', rule: '≥ 10 pages, non-work related' },
];

const buildInitialEvents = (habits: Habit[], year: number): Record<string, Record<string, boolean>> => {
  const state: Record<string, Record<string, boolean>> = {};
  for (const h of habits) state[h.id] = {};
  // Seed a simple diagonal pattern for demo
  const today = new Date();
  for (let i = 0; i < 40; i++) {
    const dt = new Date(today);
    dt.setDate(today.getDate() - i);
    const key = formatDate(dt.getFullYear(), dt.getMonth(), dt.getDate());
    for (const h of habits) {
      if (i % (h.id.length + 2) === 0 && dt.getFullYear() === year) state[h.id][key] = true;
    }
  }
  return state;
};

export const HabitTrackerTab: React.FC<HabitTrackerTabProps> = ({ isVisible }) => {
  const year = getCurrentYear();
  const months = useMonths(year);
  const [habits, setHabits] = React.useState<Habit[]>(() => {
    try {
      const raw = localStorage.getItem('habit-tracker-habits');
      if (raw) return JSON.parse(raw);
    } catch {}
    return DEFAULT_HABITS;
  });
  const [selectedHabitId, setSelectedHabitId] = React.useState<string>(habits[0]?.id ?? '');
  const [calendarData, setCalendarData] = React.useState<Record<string, Record<string, boolean>>>(
    () => buildInitialEvents(habits, year)
  );
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSelectHabit = (habitId: string) => {
    setSelectedHabitId(habitId);
  };

  const handleRuleChange = (habitId: string, rule: string) => {
    setHabits(prev => {
      const next = prev.map(h => (h.id === habitId ? { ...h, rule } : h));
      try { localStorage.setItem('habit-tracker-habits', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const toggleDay = async (dateIso: string) => {
    const habitId = selectedHabitId;
    const prevVal = Boolean(calendarData[habitId]?.[dateIso]);
    const nextVal = !prevVal;
    setCalendarData(prev => {
      const next = { ...prev };
      const habitDays = { ...(next[habitId] || {}) };
      habitDays[dateIso] = nextVal;
      next[habitId] = habitDays;
      return next;
    });
    setIsSaving(true);
    try {
      await saveLedgerToWebhook([{ habitId, date: dateIso, complete: nextVal }]);
      toast.success('Sent');
    } catch (e) {
      toast.error('Failed to send');
    } finally {
      setIsSaving(false);
    }
  };

  const renderPills = () => (
    <div className="flex flex-wrap gap-2 mb-2">
      {habits.map(h => (
        <button
          key={h.id}
          onClick={() => handleSelectHabit(h.id)}
          className={cn(
            'px-3 py-1 rounded-full text-sm font-medium',
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
    const colCount = 12;
    const rowCount = 31;
    // Use full width for grid; on mobile, enable horizontal scroll with larger tap targets.
    // IMPORTANT FOR FUTURE LLMS: Do NOT modify the mobile sizing below. The larger tap targets
    // (default classes without breakpoints) and the horizontal overflow are intentional for a11y.
    // Desktop and larger screens use smaller circles via sm:/md:/lg: overrides.
    const columnTemplate = `repeat(${colCount}, minmax(0, 1fr))`;
    const gapRem = '0.25rem';
    return (
      <div className="space-y-2">
        {/* Scroll container: horizontal scroll on mobile only */}
        <div className="overflow-x-auto sm:overflow-visible -mx-2 sm:mx-0">
          <div className="inline-block px-2 sm:px-0 min-w-[900px] sm:min-w-0 w-full">
            {/* Month header row */}
            <div className="grid text-[10px] text-neutral-400 mb-1" style={{ gridTemplateColumns: columnTemplate, gap: gapRem }}>
              {months.map(({ monthLabel, monthIndex }) => (
                <div key={monthIndex} className="text-center capitalize">{monthLabel.toLowerCase()}</div>
              ))}
            </div>
            {/* 31 rows by 12 columns - circles centered in each column */}
            <div className="grid" style={{ gridTemplateColumns: columnTemplate, gap: gapRem }}>
              {Array.from({ length: rowCount }).flatMap((_, rowIdx) => {
                const day = rowIdx + 1;
                return months.map(({ monthIndex }) => {
                  const valid = day <= new Date(year, monthIndex + 1, 0).getDate();
                  const date = valid ? formatDate(year, monthIndex, day) : `${year}-${String(monthIndex + 1).padStart(2,'0')}-00`;
                  const complete = valid && Boolean(calendarData[selectedHabitId]?.[date]);
                  const habitName = habits.find(h => h.id === selectedHabitId)?.name || 'Habit';
                  return (
                    <div key={`${monthIndex}-${day}`} className="flex items-center justify-center">
                      <button
                        onClick={() => valid && toggleDay(date)}
                        title={valid ? date : ''}
                        disabled={!valid}
                        aria-label={valid ? `${habitName} on ${date}` : ''}
                        className={cn(
                          'rounded-full flex items-center justify-center cursor-pointer leading-none transition-all duration-150 select-none',
                          // Mobile default: larger tap target
                          'w-8 h-8 text-[12px]',
                          // Shrink as screen size increases
                          'sm:w-5 sm:h-5 sm:text-[10px] md:w-6 md:h-6 lg:w-6 lg:h-6 xl:w-7 xl:h-7',
                          valid ? (complete ? 'bg-emerald-500 text-black shadow' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300') : 'opacity-20 cursor-default bg-transparent border border-transparent'
                        )}
                        aria-pressed={complete}
                      >
                        {valid ? day : ''}
                      </button>
                    </div>
                  );
                });
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={cn('max-w-6xl mx-auto px-4 sm:px-6 lg:px-8', !isVisible && 'hidden')}>
      <div className="mb-6 p-6 rounded-2xl border border-neutral-800 bg-neutral-900">
        <header className="mb-3 relative">
          <h2 className="text-lg font-semibold text-center text-neutral-100">{year}</h2>
          {isSaving && (
            <div className="absolute right-0 top-0 text-xs text-neutral-400">
              Sending…
            </div>
          )}
        </header>
        {renderPills()}
        {renderRuleSubtext()}
        {renderCalendar()}
      </div>
    </div>
  );
};

export default HabitTrackerTab;


