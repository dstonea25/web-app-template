import React from 'react';
import { cn } from '../theme/config';
import type { Habit, HabitWeeklyAchievement } from '../types';
import { apiClient } from '../lib/api';

interface HabitWeeklyAchievementGridProps {
  habits: Habit[];
  year: number;
  isVisible?: boolean;
}

// Global color scheme - single emerald green for all habits
const HABIT_COLOR = {
  base: '#6EE7B7',  // emerald green
  glow: '#A7F3D0'   // lighter emerald for glow
};

export const HabitWeeklyAchievementGrid: React.FC<HabitWeeklyAchievementGridProps> = ({
  habits,
  year,
  isVisible = true
}) => {
  const [achievements, setAchievements] = React.useState<HabitWeeklyAchievement[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rollingStats, setRollingStats] = React.useState<Record<string, { monthly: number; weekly: number }>>({});
  const [isLoadingStats, setIsLoadingStats] = React.useState(true);
  const [editingGoalFor, setEditingGoalFor] = React.useState<string | null>(null);
  const [goalInputValue, setGoalInputValue] = React.useState<string>('');
  const [yearlyStats, setYearlyStats] = React.useState<Record<string, { weekly_goal: number | null }>>({});

  // Color mapping function - returns single global color
  const colorForHabit = React.useCallback((_habitId: string) => {
    return HABIT_COLOR;
  }, []);

  // Track if data has been loaded
  const hasLoadedAchievements = React.useRef(false);

  // Fetch achievements (only once)
  React.useEffect(() => {
    if (habits.length === 0 || hasLoadedAchievements.current) {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    const loadAchievements = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await apiClient.fetchHabitWeeklyAchievements(year);
        
        if (!isCancelled) {
          setAchievements(data);
          hasLoadedAchievements.current = true;
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to load weekly achievements:', err);
          setError('Failed to load achievements');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadAchievements();

    return () => {
      isCancelled = true;
    };
  }, [habits, year]);

  // Track if stats have been loaded
  const hasLoadedStats = React.useRef(false);

  // Fetch yearly stats (for weekly goals) and rolling stats (90-day averages) - only once
  React.useEffect(() => {
    if (habits.length === 0 || hasLoadedStats.current) {
      setIsLoadingStats(false);
      return;
    }

    let isCancelled = false;

    const loadStats = async () => {
      setIsLoadingStats(true);
      try {
        // Fetch yearly stats for weekly goals
        const yearlyData = await apiClient.fetchHabitYearlyStats(year);
        if (!isCancelled) {
          const yearlyMap: Record<string, { weekly_goal: number | null }> = {};
          yearlyData.forEach(stat => {
            yearlyMap[stat.habit_id] = { weekly_goal: stat.weekly_goal };
          });
          setYearlyStats(yearlyMap);
        }

        // Fetch 90-day rolling stats for each habit
        const statsPromises = habits.map(async (habit) => {
          const stats = await apiClient.calculateRollingHabitStats(habit.id, 90);
          return { habitId: habit.id, stats };
        });

        const statsResults = await Promise.all(statsPromises);
        if (!isCancelled) {
          const statsMap: Record<string, { monthly: number; weekly: number }> = {};
          statsResults.forEach(({ habitId, stats }) => {
            statsMap[habitId] = {
              monthly: stats.monthly_average,
              weekly: stats.weekly_average
            };
          });
          console.log('Rolling stats loaded:', statsMap);
          setRollingStats(statsMap);
          hasLoadedStats.current = true;
        }
      } catch (err) {
        console.error('Failed to load habit stats:', err);
        console.error('Error details:', err);
      } finally {
        if (!isCancelled) {
          setIsLoadingStats(false);
        }
      }
    };

    loadStats();

    return () => {
      isCancelled = true;
    };
  }, [habits, year]);

  // Organize achievements by habit
  const achievementsByHabit = React.useMemo(() => {
    const map = new Map<string, Map<number, HabitWeeklyAchievement>>();
    
    achievements.forEach(achievement => {
      if (!map.has(achievement.habit_id)) {
        map.set(achievement.habit_id, new Map());
      }
      map.get(achievement.habit_id)!.set(achievement.week_number, achievement);
    });
    
    return map;
  }, [achievements]);

  // Generate week numbers (1-52)
  const weekNumbers = React.useMemo(() => {
    return Array.from({ length: 52 }, (_, i) => i + 1);
  }, []);

  // Weekly goal editing handlers
  const handleStartEditGoal = React.useCallback((habitId: string, currentGoal: number | null) => {
    setEditingGoalFor(habitId);
    setGoalInputValue(currentGoal?.toString() || '');
  }, []);

  const handleSaveGoal = React.useCallback(async (habitId: string) => {
    const numValue = goalInputValue.trim() === '' ? null : parseInt(goalInputValue, 10);
    
    if (numValue !== null && (isNaN(numValue) || numValue < 0)) {
      setEditingGoalFor(null);
      return;
    }

    try {
      await apiClient.updateHabitWeeklyGoal(habitId, numValue);
      
      // Update local state
      setYearlyStats(prev => ({
        ...prev,
        [habitId]: { weekly_goal: numValue }
      }));
      
      setEditingGoalFor(null);
    } catch (err) {
      console.error('Failed to update weekly goal:', err);
    }
  }, [goalInputValue]);

  const handleCancelEditGoal = React.useCallback(() => {
    setEditingGoalFor(null);
    setGoalInputValue('');
  }, []);

  const handleGoalKeyDown = React.useCallback((e: React.KeyboardEvent, habitId: string) => {
    if (e.key === 'Enter') {
      handleSaveGoal(habitId);
    } else if (e.key === 'Escape') {
      handleCancelEditGoal();
    }
  }, [handleSaveGoal, handleCancelEditGoal]);

  // Get current ISO week number (matches database calculation)
  const currentWeekNumber = React.useMemo(() => {
    const now = new Date();
    
    // Get the Thursday of the current week (ISO week definition)
    const thursday = new Date(now);
    thursday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + 3);
    
    // Get the first Thursday of the year
    const jan4 = new Date(thursday.getFullYear(), 0, 4);
    const firstThursday = new Date(jan4);
    firstThursday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + 3);
    
    // Calculate week number
    const weekNumber = Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
    
    return weekNumber;
  }, []);

  if (!isVisible) return null;

  return (
    <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900">
      {/* Loading state */}
      {isLoading && (
        <div className="py-12 flex items-center justify-center">
          <div className="text-sm text-neutral-400">Loading achievements...</div>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="py-8 text-center">
          <div className="text-sm text-red-400">{error}</div>
        </div>
      )}

      {/* Achievement grid */}
      {!isLoading && !error && habits.length > 0 && (
        <div className="overflow-x-auto -mx-6 px-6">
          <div className="inline-block min-w-full">
            {/* Habit rows */}
            <div className="space-y-4">
              {habits.map(habit => {
                const color = colorForHabit(habit.id);
                const habitAchievements = achievementsByHabit.get(habit.id);
                const stats = rollingStats[habit.id];
                const weeklyGoal = yearlyStats[habit.id]?.weekly_goal;
                const isEditingGoal = editingGoalFor === habit.id;
                
                return (
                  <div key={habit.id} className="space-y-2">
                    {/* Habit header with stats */}
                    <div className="flex items-center justify-between gap-4">
                      {/* Left: Habit name */}
                      <div 
                        className="text-sm font-medium"
                        style={{ color: color.base }}
                      >
                        {habit.name}
                      </div>
                      
                      {/* Right: Stats and goal input */}
                      <div className="flex items-center gap-4 text-xs">
                        {/* Weekly average */}
                        {isLoadingStats ? (
                          <div className="text-neutral-500 text-xs">Loading...</div>
                        ) : stats ? (
                          <div className="flex items-center gap-1 text-xs">
                            <span className="text-neutral-500">Weekly Avg</span>
                            <span className="font-medium tabular-nums text-neutral-300">
                              {stats.weekly.toFixed(1)}
                            </span>
                          </div>
                        ) : (
                          <div className="text-neutral-600 text-xs">—</div>
                        )}
                        
                        {/* Weekly goal input */}
                        <div className="flex items-center gap-1">
                          <span className="text-neutral-500">Goal</span>
                          {isEditingGoal ? (
                            <input
                              type="number"
                              min="0"
                              value={goalInputValue}
                              onChange={(e) => setGoalInputValue(e.target.value)}
                              onKeyDown={(e) => handleGoalKeyDown(e, habit.id)}
                              onBlur={() => handleSaveGoal(habit.id)}
                              autoFocus
                              className="w-12 px-1 py-0.5 text-xs text-right text-white bg-neutral-800 border border-neutral-600 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          ) : (
                            <button
                              onClick={() => handleStartEditGoal(habit.id, weeklyGoal || null)}
                              className={cn(
                                'px-1 min-w-[1.5rem] text-center tabular-nums transition-colors rounded',
                                weeklyGoal
                                  ? stats && stats.weekly >= weeklyGoal
                                    ? 'text-emerald-400 font-medium'
                                    : 'text-neutral-300 hover:text-white'
                                  : 'text-neutral-500 hover:text-neutral-300'
                              )}
                              title="Click to edit goal"
                            >
                              {weeklyGoal || '—'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Week cells - circles */}
                    <div className="flex flex-wrap gap-[3px]">
                      {weekNumbers.map(weekNum => {
                        const achievement = habitAchievements?.get(weekNum);
                        const isCurrentWeek = weekNum === currentWeekNumber;
                        const goalMet = achievement && achievement.goal_at_week !== null && achievement.goal_met;
                        
                        const size = 24; // hexagon size
                        const cx = size / 2;
                        const cy = size / 2;
                        
                        const isPastWeek = weekNum < currentWeekNumber;
                        
                        const offStroke = '#6b7280'; // neutral-500 (no goal or not met)
                        const activeStroke = color.base;
                        const currentWeekStroke = '#ffffff'; // white for current week
                        const transparentStroke = 'transparent'; // no border for past weeks
                        
                        // Stroke logic: goal met = color, current week = white, past = transparent, future = gray
                        const stroke = goalMet 
                          ? activeStroke 
                          : (isCurrentWeek 
                              ? currentWeekStroke 
                              : (isPastWeek ? transparentStroke : offStroke));
                        
                        // Text always shows for reference, but color indicates status
                        const textFill = goalMet ? activeStroke : (isCurrentWeek ? currentWeekStroke : offStroke);
                        
                        return (
                          <div
                            key={weekNum}
                            className="relative"
                            style={{ width: '24px', height: '24px' }}
                          >
                            <svg
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              className="absolute inset-0"
                            >
                              {goalMet && (
                                <defs>
                                  <filter id={`week-glow-${habit.id}-${weekNum}`} x="-60%" y="-60%" width="220%" height="220%">
                                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                                    <feMerge>
                                      <feMergeNode in="blur" />
                                      <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                  </filter>
                                </defs>
                              )}
                              
                              {/* Circle (read-only indicator) */}
                              <circle
                                cx={cx}
                                cy={cy}
                                r={size * 0.4}
                                fill="none"
                                stroke={stroke}
                                strokeWidth={2}
                                filter={goalMet ? `url(#week-glow-${habit.id}-${weekNum})` : undefined}
                                pointerEvents="none"
                              />
                              
                              {/* Inner white stroke for goal met weeks */}
                              {goalMet && (
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={size * 0.35}
                                  fill="none"
                                  stroke="#ffffff"
                                  strokeOpacity={0.35}
                                  strokeWidth={1}
                                  pointerEvents="none"
                                />
                              )}
                              
                              {/* Week number */}
                              <text
                                x={cx}
                                y={cy + 3.5}
                                fontSize={weekNum >= 10 ? 9 : 10}
                                fontWeight={goalMet ? 600 : 500}
                                textAnchor="middle"
                                fill={textFill}
                                opacity={1}
                                pointerEvents="none"
                              >
                                {weekNum}
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
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && habits.length === 0 && (
        <div className="py-12 text-center">
          <div className="text-sm text-neutral-500">No habits to display</div>
        </div>
      )}
    </div>
  );
};

export default HabitWeeklyAchievementGrid;

