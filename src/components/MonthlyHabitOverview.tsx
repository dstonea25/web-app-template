import React from 'react';
import { toast } from '../lib/notifications/toast';
import type { Habit } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';

interface HabitStreak {
  habit_id: string;
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
  weekly_goal: number | null;
}

interface MonthlyHabitOverviewProps {
  habits: Habit[];
  calendarData: Record<string, Set<string>>;
  onToggleDay: (habitId: string, dateIso: string) => Promise<void>;
  isVisible?: boolean;
}

// Global color scheme - single emerald green for all habits
const HABIT_COLOR = {
  base: '#6EE7B7',  // emerald green
  glow: '#A7F3D0'   // lighter emerald for glow
};

export const MonthlyHabitOverview: React.FC<MonthlyHabitOverviewProps> = ({
  habits,
  calendarData,
  onToggleDay,
  isVisible = true
}) => {
  const [selectedMonth, setSelectedMonth] = React.useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [hoveredCell, setHoveredCell] = React.useState<{ habitId: string; dateIso: string } | null>(null);
  const [habitStreaks, setHabitStreaks] = React.useState<Record<string, HabitStreak>>({});
  const [rollingStats, setRollingStats] = React.useState<Record<string, { monthly: number }>>({});

  // Generate month options for selector (2025 onwards - when data starts)
  const monthOptions = React.useMemo(() => {
    const options = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Show all months from 2025 to current month of current year
    for (let year = 2025; year <= currentYear; year++) {
      const endMonth = year === currentYear ? currentMonth : 11;
      for (let month = 0; month <= endMonth; month++) {
        const date = new Date(year, month, 1);
        options.push({
          value: `${year}-${month}`,
          label: date.toLocaleString(undefined, { month: 'long', year: 'numeric' }),
          year,
          month
        });
      }
    }
    // Reverse so most recent months appear first
    return options.reverse();
  }, []);

  // Get days in selected month
  const daysInMonth = React.useMemo(() => {
    const { year, month } = selectedMonth;
    return new Date(year, month + 1, 0).getDate();
  }, [selectedMonth]);

  // Generate day cells for the month
  const dayCells = React.useMemo(() => {
    const { year, month } = selectedMonth;
    const cells = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateIso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ day, dateIso });
    }
    
    return cells;
  }, [selectedMonth, daysInMonth]);

  // Color mapping function - returns single global color
  const colorForHabit = React.useCallback((_habitId: string) => {
    return HABIT_COLOR;
  }, []);

  // Fetch habit streaks
  const fetchHabitStreaks = React.useCallback(async () => {
    if (!isSupabaseConfigured) return;
    
    try {
      const mod = await import('../lib/supabase');
      const supabase = (mod as any).supabase;
      if (!supabase) return;

      const { data, error } = await supabase
        .from('habit_streaks')
        .select('habit_id, current_streak, longest_streak, last_completed_date, weekly_goal');

      if (error) throw error;

      const streaksMap: Record<string, HabitStreak> = {};
      (data || []).forEach((streak: any) => {
        streaksMap[streak.habit_id] = streak;
      });

      setHabitStreaks(streaksMap);
    } catch (error) {
      console.error('Failed to fetch habit streaks:', error);
    }
  }, []);

  // Refresh a single habit's streak after a toggle/backfill to avoid refetching all
  const refreshHabitStreakForHabit = React.useCallback(async (habitId: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const mod = await import('../lib/supabase');
      const supabase = (mod as any).supabase;
      if (!supabase) return;

      const { data, error } = await supabase
        .from('habit_streaks')
        .select('habit_id, current_streak, longest_streak, last_completed_date, weekly_goal')
        .eq('habit_id', habitId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setHabitStreaks(prev => ({ ...prev, [habitId]: data as HabitStreak }));
      }
    } catch (error) {
      console.error('Failed to refresh habit streak:', error);
    }
  }, []);

  // Load streaks when component mounts
  React.useEffect(() => {
    fetchHabitStreaks();
  }, [fetchHabitStreaks]);

  // Track if stats have been loaded
  const hasLoadedStats = React.useRef(false);

  // Fetch 90-day rolling stats for monthly average (only once)
  React.useEffect(() => {
    if (habits.length === 0 || hasLoadedStats.current) return;

    let isCancelled = false;

    const loadStats = async () => {
      try {
        const { apiClient } = await import('../lib/api');
        
        const statsPromises = habits.map(async (habit) => {
          const stats = await apiClient.calculateRollingHabitStats(habit.id, 90);
          return { habitId: habit.id, stats };
        });

        const statsResults = await Promise.all(statsPromises);
        if (!isCancelled) {
          const statsMap: Record<string, { monthly: number }> = {};
          statsResults.forEach(({ habitId, stats }) => {
            statsMap[habitId] = {
              monthly: stats.monthly_average
            };
          });
          setRollingStats(statsMap);
          hasLoadedStats.current = true;
        }
      } catch (err) {
        console.error('Failed to load habit monthly stats:', err);
      }
    };

    loadStats();

    return () => {
      isCancelled = true;
    };
  }, [habits]);

  // Get streak emoji (1/2/3 progression based on length)
  const getStreakEmoji = (streak: number): string => {
    if (streak <= 5) return '🔥';
    if (streak <= 10) return '🔥🔥';
    return '🔥🔥🔥';
  };

  // Get cold streak emoji (1/2/3 progression based on length)
  const getColdStreakEmoji = (daysSince: number): string => {
    if (daysSince <= 5) return '❄️';
    if (daysSince <= 10) return '❄️❄️';
    return '❄️❄️❄️';
  };

  // Get days since last completed, excluding the current day
  const getDaysSinceLastCompleted = (lastCompletedDate: string | null): number => {
    if (!lastCompletedDate) return 999; // Never completed
    const last = new Date(lastCompletedDate + 'T00:00:00');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.floor((today.getTime() - last.getTime()) / msPerDay);
    // Exclude the current day from the count
    return Math.max(0, diffDays - 1);
  };

  // Handle day toggle
  const handleToggleDay = async (habitId: string, dateIso: string) => {
    try {
      await onToggleDay(habitId, dateIso);
      // Streaks are automatically updated by database trigger
      // Incrementally refresh only the affected habit's streak
      refreshHabitStreakForHabit(habitId);
    } catch (error) {
      toast.error('Failed to update habit');
    }
  };

  // Handle month change
  const handleMonthChange = (value: string) => {
    const [yearStr, monthStr] = value.split('-');
    setSelectedMonth({
      year: parseInt(yearStr, 10),
      month: parseInt(monthStr, 10)
    });
  };

  if (!isVisible) return null;

  return (
    <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900">
      <header className="mb-6">
        {/* Month Selector */}
        <div className="flex items-center gap-3">
          <select
            id="month-selector"
            value={`${selectedMonth.year}-${selectedMonth.month}`}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="px-3 py-1 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Habits Grid */}
      <div className="space-y-6">
        {habits.map((habit) => {
          const { base: habitColor, glow: habitGlow } = colorForHabit(habit.id);
          const allHabitDays = calendarData[habit.id] || new Set<string>();
          
           // Filter to only days in the selected month
           const habitDays = new Set<string>();
           allHabitDays.forEach(date => {
             if (dayCells.some(cell => cell.dateIso === date)) {
               habitDays.add(date);
             }
           });
           
           // Calculate current day in month for denominator
           const today = new Date();
           const { year, month } = selectedMonth;
           const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
           const currentDay = today.getDate();
           
           let currentDayInMonth = dayCells.length; // Default to total days in month
           
           if (isCurrentMonth) {
             // Check if this specific habit was completed today
             const todayDateIso = `${year}-${String(month + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
             const wasCompletedToday = habitDays.has(todayDateIso);
             
             if (wasCompletedToday) {
               // If completed today, denominator is current day
               currentDayInMonth = currentDay;
             } else {
               // If not completed today, denominator is current day - 1
               currentDayInMonth = Math.max(1, currentDay - 1);
             }
           }
          
          return (
            <div key={habit.id} className="space-y-2">
              {/* Habit Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                {/* Left: Habit name + streak */}
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 
                    className="text-sm font-medium"
                    style={{ color: habitColor }}
                  >
                    {habit.name}
                  </h4>
                  {/* Streak */}
                  {habitStreaks[habit.id] && (
                    <div className="flex items-center gap-1">
                      {habitStreaks[habit.id].current_streak === 0 ? (
                        getDaysSinceLastCompleted(habitStreaks[habit.id].last_completed_date) > 0 ? (
                          <>
                            <span className="text-white text-sm font-medium">
                              {getDaysSinceLastCompleted(habitStreaks[habit.id].last_completed_date)}x
                            </span>
                            <span className="text-sm">
                              {getColdStreakEmoji(getDaysSinceLastCompleted(habitStreaks[habit.id].last_completed_date))}
                            </span>
                          </>
                        ) : null
                      ) : habitStreaks[habit.id].current_streak === 1 ? (
                        <span className="text-sm">
                          {getStreakEmoji(habitStreaks[habit.id].current_streak)}
                        </span>
                      ) : (
                        <>
                          <span className="text-white text-sm font-medium">
                            {habitStreaks[habit.id].current_streak}x
                          </span>
                          <span className="text-sm">
                            {getStreakEmoji(habitStreaks[habit.id].current_streak)}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                  {habit.rule && (
                    <span className="text-xs text-neutral-400 italic hidden sm:inline">
                      {habit.rule}
                    </span>
                  )}
                </div>
                
                {/* Right: All stats with fixed-width labels */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:gap-4">
                  {/* Monthly average */}
                  <div className="flex items-center gap-1">
                    <span className="text-neutral-500">Monthly Avg</span>
                    <span className="font-medium tabular-nums text-neutral-300 w-[28px] text-right">
                      {rollingStats[habit.id]?.monthly.toFixed(1) ?? '—'}
                    </span>
                  </div>
                  {/* Completion percentage */}
                  <div className="flex items-center gap-1">
                    <span className="text-neutral-500">Cmp%</span>
                    <span className="font-medium tabular-nums text-neutral-300 w-[28px] text-right">
                      {Math.round((habitDays.size / Math.max(1, currentDayInMonth)) * 100)}%
                    </span>
                  </div>
                  {/* Goal % */}
                  {(() => {
                    const weeklyGoal = habitStreaks[habit.id]?.weekly_goal;
                    if (!weeklyGoal) return null;
                    
                    const weeksInMonth = daysInMonth / 7;
                    const monthlyTarget = Math.round(weeklyGoal * weeksInMonth);
                    const isComplete = habitDays.size >= monthlyTarget;
                    const goalPercent = Math.round((habitDays.size / monthlyTarget) * 100);
                    
                    return (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-neutral-500">Goal%</span>
                        <span className={`font-medium tabular-nums w-[36px] text-right ${isComplete ? 'text-emerald-400' : 'text-neutral-300'}`}>
                          {goalPercent}%
                        </span>
                        <span className="text-neutral-500">(</span>
                        <span className={`tabular-nums ${isComplete ? 'text-emerald-400' : 'text-neutral-300'}`}>
                          {habitDays.size} of {monthlyTarget}
                        </span>
                        <span className="text-neutral-500">)</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
              
               {/* Day Cells Grid - Horizontal with tight spacing */}
               <div className="flex flex-wrap gap-1 max-w-full">
                 {dayCells.map(({ day, dateIso }) => {
                   const isComplete = habitDays.has(dateIso);
                   const isHovered = hoveredCell?.habitId === habit.id && hoveredCell?.dateIso === dateIso;
                   
                   // More robust today detection
                   const today = new Date();
                   const cellDate = new Date(dateIso + 'T00:00:00');
                   const isToday = today.getFullYear() === cellDate.getFullYear() && 
                                  today.getMonth() === cellDate.getMonth() && 
                                  today.getDate() === cellDate.getDate();
                   
                   // Use exact same size and coordinates as yearly view
                   const size = 28;
                   const cx = size / 2;
                   const cy = size / 2;
                   const offStroke = '#6b7280';
                   const stroke = isHovered ? habitGlow : (isComplete ? habitColor : (isToday ? '#ffffff' : offStroke));
                   const textFill = isComplete ? habitColor : (isToday ? '#ffffff' : offStroke);
                   
                   return (
                     <div
                       key={dateIso}
                       className="relative"
                       style={{ width: '28px', height: '28px' }}
                     >
                       {/* EXACT copy of yearly view SVG */}
                       <svg
                         width="28"
                         height="28"
                         viewBox="0 0 28 28"
                         className="absolute inset-0 cursor-pointer transition-all duration-150 hover:scale-105 active:scale-95"
                         onClick={() => handleToggleDay(habit.id, dateIso)}
                         onMouseEnter={() => setHoveredCell({ habitId: habit.id, dateIso })}
                         onMouseLeave={() => setHoveredCell(null)}
                       >
                         <defs>
                           <filter id={`monthly-glow-${habit.id}`} x="-60%" y="-60%" width="220%" height="220%">
                             <feGaussianBlur stdDeviation="3.5" result="blur" />
                             <feMerge>
                               <feMergeNode in="blur" />
                               <feMergeNode in="SourceGraphic" />
                             </feMerge>
                           </filter>
                         </defs>
                         
                         {/* Hexagon button (flat-top) - EXACT copy from yearly */}
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
                           filter={isComplete ? `url(#monthly-glow-${habit.id})` : undefined}
                           pointerEvents="none"
                         />
                         
                         {/* Inner white stroke for completed days - EXACT copy */}
                         {isComplete && (
                           <polygon
                             points={`
                               ${cx - size * 0.44},${cy}
                               ${cx - size * 0.22},${cy - size * 0.384}
                               ${cx + size * 0.22},${cy - size * 0.384}
                               ${cx + size * 0.44},${cy}
                               ${cx + size * 0.22},${cy + size * 0.384}
                               ${cx - size * 0.22},${cy + size * 0.384}
                             `}
                             fill="none"
                             stroke="#ffffff"
                             strokeOpacity={0.35}
                             strokeWidth={1}
                             pointerEvents="none"
                           />
                         )}
                         
                         {/* Invisible hit target for easier clicks - EXACT copy */}
                         <circle
                           cx={cx}
                           cy={cy}
                           r={size * 0.48}
                           fill="#000"
                           fillOpacity={0.001}
                           pointerEvents="all"
                         />
                         
                         {/* Day number - EXACT copy from yearly */}
                         <text
                           x={cx}
                           y={cy + 3}
                           fontSize={12}
                           fontWeight={isComplete ? 600 : 500}
                           textAnchor="middle"
                           fill={textFill}
                           opacity={1}
                           pointerEvents="none"
                         >
                           {day}
                         </text>
                       </svg>
                     </div>
                   );
                 })}
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthlyHabitOverview;
