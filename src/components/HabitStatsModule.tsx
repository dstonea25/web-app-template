import React from 'react';
import { cn } from '../theme/config';
import type { Habit, HabitYearlyStats, HabitRollingStats } from '../types';
import { apiClient } from '../lib/api';
import { toast } from '../lib/notifications/toast';
import { HabitWeeklyAchievementGrid } from './HabitWeeklyAchievementGrid';

interface HabitStatsModuleProps {
  habits: Habit[];
  year: number;
  isVisible?: boolean;
}

// Color palette matching the yearly and monthly views
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

interface CombinedStats {
  habit: Habit;
  yearly: HabitYearlyStats | null;
  rolling: HabitRollingStats;
}

export const HabitStatsModule: React.FC<HabitStatsModuleProps> = ({
  habits,
  year,
  isVisible = true
}) => {
  const [windowDays, setWindowDays] = React.useState<30 | 60 | 90>(90);
  const [yearlyStats, setYearlyStats] = React.useState<HabitYearlyStats[]>([]);
  const [rollingStatsMap, setRollingStatsMap] = React.useState<Map<string, HabitRollingStats>>(new Map());
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editingGoalFor, setEditingGoalFor] = React.useState<string | null>(null);
  const [goalInputValue, setGoalInputValue] = React.useState<string>('');

  // Color mapping function (same as other habit views)
  const colorForHabit = React.useCallback((habitId: string) => {
    const mapped = HABIT_COLOR_BY_ID[habitId];
    if (mapped) return mapped;
    const idx = Math.max(0, habits.findIndex(h => h.id === habitId));
    const i = (idx >= 0 ? idx : 0) % COLOR_CYCLE.length;
    return COLOR_CYCLE[i];
  }, [habits]);

  // Fetch stats on mount and when window changes
  React.useEffect(() => {
    if (!isVisible || habits.length === 0) {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    const loadStats = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const [yearly, rollingMap] = await Promise.all([
          apiClient.fetchHabitYearlyStats(year),
          apiClient.fetchAllHabitsRollingStats(
            habits.map(h => h.id),
            windowDays
          )
        ]);

        if (!isCancelled) {
          setYearlyStats(yearly);
          setRollingStatsMap(rollingMap);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to load habit stats:', err);
          // More detailed error message
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error('Error details:', errorMsg);
          setError(`Failed to load statistics: ${errorMsg}`);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadStats();

    return () => {
      isCancelled = true;
    };
  }, [habits, year, windowDays, isVisible]);

  // Combine stats for display (preserve habit order from overview)
  const displayStats = React.useMemo<CombinedStats[]>(() => {
    const yearlyMap = new Map(yearlyStats.map(s => [s.habit_id, s]));

    return habits.map(habit => ({
      habit,
      yearly: yearlyMap.get(habit.id) || null,
      rolling: rollingStatsMap.get(habit.id) || { monthly_average: 0, weekly_average: 0 }
    }));
  }, [habits, yearlyStats, rollingStatsMap]);

  // Handle goal editing
  const handleStartEditGoal = (habitId: string, currentGoal: number | null) => {
    setEditingGoalFor(habitId);
    setGoalInputValue(currentGoal?.toString() || '');
  };

  const handleSaveGoal = async (habitId: string) => {
    const newGoal = goalInputValue.trim() === '' ? null : parseInt(goalInputValue, 10);
    
    if (newGoal !== null && (isNaN(newGoal) || newGoal < 0)) {
      toast.error('Please enter a valid positive number');
      return;
    }

    try {
      await apiClient.updateHabitWeeklyGoal(habitId, newGoal);
      
      // Update local state
      setYearlyStats(prev => prev.map(stat => 
        stat.habit_id === habitId 
          ? { ...stat, weekly_goal: newGoal }
          : stat
      ));
      
      setEditingGoalFor(null);
      toast.success('Goal updated');
    } catch (err) {
      console.error('Failed to update goal:', err);
      toast.error('Failed to update goal');
    }
  };

  const handleCancelEditGoal = () => {
    setEditingGoalFor(null);
    setGoalInputValue('');
  };

  const handleGoalKeyDown = (e: React.KeyboardEvent, habitId: string) => {
    if (e.key === 'Enter') {
      handleSaveGoal(habitId);
    } else if (e.key === 'Escape') {
      handleCancelEditGoal();
    }
  };

  if (!isVisible) return null;

  return (
    <div className="space-y-6">
      {/* Rolling Stats Table */}
      <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900">
      {/* Header with window selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-neutral-200">
            Rolling Window
          </h3>
          <p className="text-xs text-neutral-500 mt-1">
            Averages based on last {windowDays} days of tracked activity
          </p>
        </div>
        <div className="flex gap-2">
          {([30, 60, 90] as const).map(days => (
            <button
              key={days}
              onClick={() => setWindowDays(days)}
              disabled={isLoading}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-all',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-neutral-900',
                windowDays === days
                  ? 'bg-emerald-500 text-neutral-900 shadow-lg'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="py-12 flex items-center justify-center">
          <div className="text-sm text-neutral-400">Loading statistics...</div>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="py-8 text-center">
          <div className="text-sm text-red-400">{error}</div>
        </div>
      )}

      {/* Stats table */}
      {!isLoading && !error && displayStats.length > 0 && (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-700">
                <th className="text-left py-3 px-3 text-neutral-400 font-medium">
                  Habit
                </th>
                <th className="text-right py-3 px-3 text-neutral-400 font-medium">
                  Monthly Avg
                  <span className="block text-xs font-normal text-neutral-500">
                    days/{windowDays === 30 ? 'mo' : windowDays === 60 ? '2mo' : '3mo'}
                  </span>
                </th>
                <th className="text-right py-3 px-3 text-neutral-400 font-medium">
                  Weekly Avg
                  <span className="block text-xs font-normal text-neutral-500">
                    days/week
                  </span>
                </th>
                <th className="text-right py-3 px-3 text-neutral-400 font-medium">
                  Weekly Goal
                  <span className="block text-xs font-normal text-neutral-500">
                    click to edit
                  </span>
                </th>
                <th className="text-right py-3 px-3 text-neutral-400 font-medium">
                  Hot Streak
                  <span className="block text-xs font-normal text-neutral-500">
                    {year} max
                  </span>
                </th>
                <th className="text-right py-3 px-3 text-neutral-400 font-medium">
                  Cold Streak
                  <span className="block text-xs font-normal text-neutral-500">
                    {year} max
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {displayStats.map(stat => {
                const color = colorForHabit(stat.habit.id);
                const hotStreak = stat.yearly?.longest_hot_streak || 0;
                const coldStreak = stat.yearly?.longest_cold_streak || 0;

                return (
                  <tr 
                    key={stat.habit.id} 
                    className="border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors"
                  >
                    {/* Habit name */}
                    <td className="py-3 px-3 font-medium" style={{ color: color.base }}>
                      {stat.habit.name}
                    </td>

                    {/* Monthly average */}
                    <td className="text-right py-3 px-3 text-neutral-300 tabular-nums">
                      {stat.rolling.monthly_average.toFixed(1)}
                    </td>

                    {/* Weekly average */}
                    <td className="text-right py-3 px-3 text-neutral-300 tabular-nums">
                      {stat.rolling.weekly_average.toFixed(1)}
                    </td>

                    {/* Weekly goal - editable */}
                    <td className="text-right py-3 px-3">
                      {editingGoalFor === stat.habit.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min="0"
                            value={goalInputValue}
                            onChange={(e) => setGoalInputValue(e.target.value)}
                            onKeyDown={(e) => handleGoalKeyDown(e, stat.habit.id)}
                            onBlur={() => handleSaveGoal(stat.habit.id)}
                            autoFocus
                            className="w-16 px-2 py-1 text-sm text-right text-white bg-neutral-800 border border-neutral-600 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEditGoal(stat.habit.id, stat.yearly?.weekly_goal || null)}
                          className={cn(
                            'text-sm tabular-nums transition-colors',
                            stat.yearly?.weekly_goal
                              ? stat.rolling.weekly_average >= stat.yearly.weekly_goal
                                ? 'text-emerald-400 font-medium'
                                : 'text-neutral-300'
                              : 'text-neutral-500 hover:text-neutral-300'
                          )}
                          title="Click to edit goal"
                        >
                          {stat.yearly?.weekly_goal ? (
                            <span>
                              {stat.yearly.weekly_goal}
                              {stat.rolling.weekly_average >= stat.yearly.weekly_goal && ' ✓'}
                            </span>
                          ) : (
                            '—'
                          )}
                        </button>
                      )}
                    </td>

                    {/* Hot streak */}
                    <td className="text-right py-3 px-3">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-neutral-300 tabular-nums">
                          {hotStreak}d
                        </span>
                        {hotStreak > 0 && <span className="text-base">🔥</span>}
                      </span>
                    </td>

                    {/* Cold streak */}
                    <td className="text-right py-3 px-3">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-neutral-300 tabular-nums">
                          {coldStreak}d
                        </span>
                        {coldStreak > 0 && <span className="text-base">❄️</span>}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && displayStats.length === 0 && (
        <div className="py-12 text-center">
          <div className="text-sm text-neutral-500">No habits to display</div>
        </div>
      )}
      </div>

      {/* Weekly Achievement Grid */}
      <HabitWeeklyAchievementGrid
        habits={habits}
        year={year}
        isVisible={isVisible}
      />
    </div>
  );
};

export default HabitStatsModule;







