import React from 'react';
import { cn } from '../theme/config';
import { toast } from '../lib/notifications/toast';
import type { Habit } from '../types';
import { apiClient } from '../lib/api';
import { isSupabaseConfigured } from '../lib/supabase';

interface MonthlyHabitOverviewProps {
  habits: Habit[];
  calendarData: Record<string, Set<string>>;
  onToggleDay: (habitId: string, dateIso: string) => Promise<void>;
  isVisible?: boolean;
}

// Color palette matching the yearly view
const PALETTE = {
  emerald:   { base: '#6EE7B7', glow: '#A7F3D0' },
  teal:      { base: '#5EEAD4', glow: '#99F6E4' },
  amber:     { base: '#FBBF24', glow: '#FDE68A' },
  olive:     { base: '#A3E635', glow: '#D9F99D' },
  terracotta:{ base: '#FDBA74', glow: '#FED7AA' },
  rose:      { base: '#FDA4AF', glow: '#FECDD3' },
};

const COLOR_CYCLE = [PALETTE.emerald, PALETTE.teal, PALETTE.amber, PALETTE.olive, PALETTE.terracotta, PALETTE.rose];

const HABIT_COLOR_BY_ID: Record<string, { base: string; glow: string }> = {
  workout: PALETTE.emerald,
  building: PALETTE.terracotta,
  reading: PALETTE.olive,
  writing: PALETTE.amber,
  fasting: PALETTE.teal,
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
  const [hoveredDate, setHoveredDate] = React.useState<string | null>(null);

  // Generate month options for selector
  const monthOptions = React.useMemo(() => {
    const options = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Show current year and previous year
    for (let year = currentYear - 1; year <= currentYear; year++) {
      for (let month = 0; month < 12; month++) {
        const date = new Date(year, month, 1);
        options.push({
          value: `${year}-${month}`,
          label: date.toLocaleString(undefined, { month: 'long', year: 'numeric' }),
          year,
          month
        });
      }
    }
    return options;
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
      const date = new Date(year, month, day);
      const dateIso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ day, dateIso });
    }
    
    return cells;
  }, [selectedMonth, daysInMonth]);

  // Color mapping function (same as yearly view)
  const colorForHabit = React.useCallback((habitId: string) => {
    const mapped = HABIT_COLOR_BY_ID[habitId];
    if (mapped) return mapped;
    const idx = Math.max(0, habits.findIndex(h => h.id === habitId));
    const i = (idx >= 0 ? idx : 0) % COLOR_CYCLE.length;
    return COLOR_CYCLE[i];
  }, [habits]);

  // Handle day toggle
  const handleToggleDay = async (habitId: string, dateIso: string) => {
    try {
      await onToggleDay(habitId, dateIso);
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
    <div className="mb-8 p-6 rounded-2xl border border-neutral-800 bg-neutral-900">
      <header className="mb-6">
        <h3 className="text-lg font-semibold text-neutral-100 mb-4">Monthly Overview</h3>
        
        {/* Month Selector */}
        <div className="flex items-center gap-3">
          <label htmlFor="month-selector" className="text-sm text-neutral-300">
            Month:
          </label>
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h4 
                    className="text-sm font-medium"
                    style={{ color: habitColor }}
                  >
                    {habit.name}
                  </h4>
                  {habit.rule && (
                    <span className="text-xs text-neutral-400 italic">
                      {habit.rule}
                    </span>
                  )}
                </div>
                
                 {/* Completion percentage with progress bar */}
                 <div className="flex items-center gap-2">
                   <div className="w-16 h-2 bg-neutral-700 rounded-full overflow-hidden">
                     <div 
                       className="h-full transition-all duration-300 rounded-full"
                       style={{ 
                         width: `${(habitDays.size / Math.max(1, currentDayInMonth)) * 100}%`,
                         backgroundColor: habitColor 
                       }}
                     />
                   </div>
                   <div className="text-xs text-neutral-400 min-w-0">
                     {habitDays.size}/{Math.max(1, currentDayInMonth)} ({Math.round((habitDays.size / Math.max(1, currentDayInMonth)) * 100)}%)
                   </div>
                 </div>
              </div>
              
               {/* Day Cells Grid - Horizontal with tight spacing */}
               <div className="flex flex-wrap gap-1 max-w-full">
                 {dayCells.map(({ day, dateIso }) => {
                   const isComplete = habitDays.has(dateIso);
                   const isHovered = hoveredDate === dateIso;
                   
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
                         onMouseEnter={() => setHoveredDate(dateIso)}
                         onMouseLeave={() => setHoveredDate(null)}
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
