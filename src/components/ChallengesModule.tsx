/**
 * ChallengesModule - Weekly Challenges display and management
 * 
 * Displays 3 weekly challenges with simple checkbox + action_text UI.
 * Challenges are fetched from Supabase RPC (single source of truth).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Settings, RefreshCw, Check, AlertTriangle, X, ChevronDown, ChevronRight, Zap, RefreshCcw } from 'lucide-react';
import { tokens, cn } from '../theme/config';
import { challengesService } from '../lib/challenges';
import { apiClient } from '../lib/api';
import { supabase } from '../lib/supabase';
import toast from '../lib/notifications/toast';
import type { 
  WeeklyChallenge, 
  SlippingHabitData, 
  HabitYearlyStats,
  ChallengeProtocol,
  HabitsSlippingConfig,
  PrioritiesProgressConfig,
  OkrsProgressConfig,
  Habit
} from '../types';

interface KeyResult {
  id: string;
  description: string;
  current_value: number;
  target_value: number;
  progress: number;
  okr_id: string;
  okr_objective: string;
  okr_pillar: string;
  punted?: boolean;
  punted_at?: string | null;
}

const PILLAR_OPTIONS = ['Power', 'Passion', 'Purpose', 'Production'] as const;

interface ChallengesModuleProps {
  className?: string;
  habitStats?: Record<string, HabitYearlyStats>;
}

export const ChallengesModule: React.FC<ChallengesModuleProps> = ({ className, habitStats = {} }) => {
  const [challenges, setChallenges] = useState<WeeklyChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  // Rolling stats for weekly averages (keyed by habit_id)
  const [rollingStats, setRollingStats] = useState<Record<string, { weekly_average: number }>>({});
  
  // Protocol configuration state
  const [protocols, setProtocols] = useState<ChallengeProtocol[]>([]);
  const [protocolsLoading, setProtocolsLoading] = useState(false);
  const [allHabits, setAllHabits] = useState<Habit[]>([]);
  const [allKeyResults, setAllKeyResults] = useState<KeyResult[]>([]);
  const [expandedProtocols, setExpandedProtocols] = useState<Set<string>>(new Set());
  const [savingProtocol, setSavingProtocol] = useState<string | null>(null);
  const [protocolsChanged, setProtocolsChanged] = useState(false);
  const [rerollingId, setRerollingId] = useState<string | null>(null);
  const [hoveredChallengeId, setHoveredChallengeId] = useState<string | null>(null);
  const [totalChallenges, setTotalChallenges] = useState<number>(3);
  const [randomizationStrategy, setRandomizationStrategy] = useState<'slot_by_slot' | 'guaranteed_diversity'>('guaranteed_diversity');
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchChallenges = useCallback(async (showToast = false) => {
    try {
      setError(null);
      const data = await challengesService.fetchWeeklyChallenges();
      
      // Sort by slot_index to ensure consistent order (0 → 2)
      const sorted = [...data.challenges].sort((a, b) => a.slot_index - b.slot_index);
      setChallenges(sorted);
      
      // Update config values if present
      if (data.config?.total_challenges) {
        setTotalChallenges(data.config.total_challenges);
      }
      if (data.config?.randomization_strategy) {
        setRandomizationStrategy(data.config.randomization_strategy);
      }
      
      // Fetch rolling stats for slipping habits
      const habitIds = sorted
        .filter((c): c is WeeklyChallenge & { story_data: SlippingHabitData } => 
          c.story_type === 'slipping_habit' && 'habit_id' in c.story_data
        )
        .map(c => c.story_data.habit_id);
      
      if (habitIds.length > 0) {
        const statsPromises = habitIds.map(async (habitId) => {
          const stats = await apiClient.calculateRollingHabitStats(habitId, 90);
          return { habitId, stats };
        });
        
        const results = await Promise.all(statsPromises);
        const statsMap: Record<string, { weekly_average: number }> = {};
        results.forEach(({ habitId, stats }) => {
          statsMap[habitId] = { weekly_average: stats.weekly_average };
        });
        setRollingStats(statsMap);
      }
      
      if (showToast) {
        toast.success('Challenges refreshed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load challenges';
      setError(message);
      console.error('Failed to fetch challenges:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  // Fetch protocols, habits, and OKRs when settings modal opens
  const fetchProtocols = useCallback(async () => {
    setProtocolsLoading(true);
    try {
      const [protocolsData, habitsData] = await Promise.all([
        challengesService.fetchProtocols(),
        apiClient.fetchHabitsFromSupabase()
      ]);
      setProtocols(protocolsData);
      setAllHabits(habitsData);
      setProtocolsChanged(false);
      
      // Fetch Key Results separately
      if (supabase) {
        const { data: krData, error: krError } = await supabase
          .from('okr_key_results')
          .select(`
            id, 
            description, 
            current_value, 
            target_value, 
            progress,
            okr_id,
            punted,
            punted_at,
            okrs(id, objective, pillar, status, archived)
          `);
        
        if (krError) {
          console.error('Failed to fetch key results:', krError);
        } else if (krData) {
          // Filter to only include KRs from active, non-archived OKRs
          const filteredKRs = krData.filter(kr => {
            const okrs = kr.okrs as any;
            const okr = Array.isArray(okrs) ? okrs[0] : okrs;
            return okr && okr.status === 'active' && (okr.archived === false || okr.archived === null);
          });
          
          setAllKeyResults(filteredKRs.map(kr => {
            const okrs = kr.okrs as any;
            const okr = Array.isArray(okrs) ? okrs[0] : okrs;
            return {
              id: kr.id,
              description: kr.description,
              current_value: parseFloat(String(kr.current_value)) || 0,
              target_value: parseFloat(String(kr.target_value)) || 0,
              progress: parseFloat(String(kr.progress)) || 0,
              okr_id: kr.okr_id,
              okr_objective: okr.objective,
              okr_pillar: okr.pillar,
              punted: kr.punted || false,
              punted_at: kr.punted_at || null,
            };
          }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch protocols:', err);
      toast.error('Failed to load protocol settings');
    } finally {
      setProtocolsLoading(false);
    }
  }, []);

  // Handle opening settings modal
  const handleOpenSettings = () => {
    setShowSettings(true);
    fetchProtocols();
  };

  // Handle protocol enable toggle
  const handleToggleProtocolEnabled = async (protocolKey: string, currentEnabled: boolean) => {
    setSavingProtocol(protocolKey);
    try {
      const updated = await challengesService.updateProtocol(protocolKey, {
        is_enabled: !currentEnabled
      });
      setProtocols(prev => prev.map(p => p.protocol_key === protocolKey ? updated : p));
      setProtocolsChanged(true);
      toast.success(`${updated.display_name} ${updated.is_enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      console.error('Failed to update protocol:', err);
      toast.error('Failed to update protocol');
    } finally {
      setSavingProtocol(null);
    }
  };

  // Handle max_per_week change
  const handleChangeMaxPerWeek = async (protocolKey: string, newMax: number) => {
    setSavingProtocol(protocolKey);
    try {
      const updated = await challengesService.updateProtocol(protocolKey, {
        max_per_week: newMax
      });
      setProtocols(prev => prev.map(p => p.protocol_key === protocolKey ? updated : p));
      setProtocolsChanged(true);
    } catch (err) {
      console.error('Failed to update protocol:', err);
      toast.error('Failed to update max per week');
    } finally {
      setSavingProtocol(null);
    }
  };

  // Handle habit toggle for habits_slipping protocol
  const handleToggleHabitEnabled = async (habitId: string, currentlyEnabled: boolean) => {
    const protocol = protocols.find(p => p.protocol_key === 'habits_slipping');
    if (!protocol) return;

    const config = protocol.config as HabitsSlippingConfig;
    const currentHabitIds = config.enabled_habit_ids || [];
    
    let newHabitIds: string[];
    if (currentlyEnabled) {
      newHabitIds = currentHabitIds.filter(id => id !== habitId);
    } else {
      newHabitIds = [...currentHabitIds, habitId];
    }

    setSavingProtocol('habits_slipping');
    try {
      const updated = await challengesService.updateProtocol('habits_slipping', {
        config: { enabled_habit_ids: newHabitIds }
      });
      setProtocols(prev => prev.map(p => p.protocol_key === 'habits_slipping' ? updated : p));
      setProtocolsChanged(true);
    } catch (err) {
      console.error('Failed to update habit:', err);
      toast.error('Failed to update habit selection');
    } finally {
      setSavingProtocol(null);
    }
  };

  // Toggle protocol expansion
  const toggleProtocolExpanded = (protocolKey: string) => {
    setExpandedProtocols(prev => {
      const next = new Set(prev);
      if (next.has(protocolKey)) {
        next.delete(protocolKey);
      } else {
        next.add(protocolKey);
      }
      return next;
    });
  };

  // Get enabled habit IDs for habits_slipping protocol
  const getEnabledHabitIds = (): string[] => {
    const protocol = protocols.find(p => p.protocol_key === 'habits_slipping');
    if (!protocol) return [];
    const config = protocol.config as HabitsSlippingConfig;
    return config.enabled_habit_ids || [];
  };

  // Get enabled pillars for priorities_progress protocol
  const getEnabledPillars = (): string[] => {
    const protocol = protocols.find(p => p.protocol_key === 'priorities_progress');
    if (!protocol) return [];
    const config = protocol.config as PrioritiesProgressConfig;
    return config.enabled_pillars || [];
  };

  // Handle pillar toggle for priorities_progress protocol
  const handleTogglePillarEnabled = async (pillarName: string, currentlyEnabled: boolean) => {
    const protocol = protocols.find(p => p.protocol_key === 'priorities_progress');
    if (!protocol) return;

    const config = protocol.config as PrioritiesProgressConfig;
    const currentPillars = config.enabled_pillars || [];
    
    let newPillars: string[];
    if (currentlyEnabled) {
      newPillars = currentPillars.filter(p => p !== pillarName);
    } else {
      newPillars = [...currentPillars, pillarName];
    }

    setSavingProtocol('priorities_progress');
    try {
      const updated = await challengesService.updateProtocol('priorities_progress', {
        config: { enabled_pillars: newPillars }
      });
      setProtocols(prev => prev.map(p => p.protocol_key === 'priorities_progress' ? updated : p));
      setProtocolsChanged(true);
    } catch (err) {
      console.error('Failed to update pillar:', err);
      toast.error('Failed to update pillar selection');
    } finally {
      setSavingProtocol(null);
    }
  };

  // Get enabled KRs for okrs_progress protocol
  const getEnabledKRIds = (): string[] => {
    const protocol = protocols.find(p => p.protocol_key === 'okrs_progress');
    if (!protocol) return [];
    const config = protocol.config as OkrsProgressConfig;
    return config.enabled_kr_ids || [];
  };

  // Handle KR toggle for okrs_progress protocol
  const handleToggleKREnabled = async (krId: string, currentlyEnabled: boolean) => {
    const protocol = protocols.find(p => p.protocol_key === 'okrs_progress');
    if (!protocol) return;

    const config = protocol.config as OkrsProgressConfig;
    const currentKRIds = config.enabled_kr_ids || [];
    
    let newKRIds: string[];
    if (currentlyEnabled) {
      newKRIds = currentKRIds.filter(id => id !== krId);
    } else {
      newKRIds = [...currentKRIds, krId];
    }

    setSavingProtocol('okrs_progress');
    try {
      const updated = await challengesService.updateProtocol('okrs_progress', {
        config: { enabled_kr_ids: newKRIds }
      });
      setProtocols(prev => prev.map(p => p.protocol_key === 'okrs_progress' ? updated : p));
      setProtocolsChanged(true);
    } catch (err) {
      console.error('Failed to update KR:', err);
      toast.error('Failed to update KR selection');
    } finally {
      setSavingProtocol(null);
    }
  };

  // Auto-cleanup: Remove completed/punted KRs from enabled list when settings open
  useEffect(() => {
    if (!showSettings || allKeyResults.length === 0) return;
    
    const protocol = protocols.find(p => p.protocol_key === 'okrs_progress');
    if (!protocol) return;
    
    const config = protocol.config as OkrsProgressConfig;
    const currentKRIds = config.enabled_kr_ids || [];
    
    // Filter out completed (progress >= 1) or punted KRs
    const validKRIds = currentKRIds.filter(krId => {
      const kr = allKeyResults.find(k => k.id === krId);
      if (!kr) return false; // KR not found, remove it
      const isCompleted = kr.progress >= 1;
      const isPunted = kr.punted === true;
      return !isCompleted && !isPunted;
    });
    
    // If any KRs were filtered out, update the protocol
    if (validKRIds.length !== currentKRIds.length) {
      console.log(`Auto-removing ${currentKRIds.length - validKRIds.length} completed/punted KRs from okrs_progress protocol`);
      challengesService.updateProtocol('okrs_progress', {
        config: { enabled_kr_ids: validKRIds }
      }).then(updated => {
        setProtocols(prev => prev.map(p => p.protocol_key === 'okrs_progress' ? updated : p));
      }).catch(err => {
        console.error('Failed to auto-cleanup KRs:', err);
      });
    }
  }, [showSettings, allKeyResults, protocols]);

  // Handle reroll challenge
  const handleRerollChallenge = async (challengeId: string) => {
    setRerollingId(challengeId);
    try {
      const newChallenge = await challengesService.rerollChallenge(challengeId);
      
      // Update the challenge in state
      setChallenges(prev => prev.map(c => 
        c.id === challengeId 
          ? { ...c, action_text: newChallenge.action_text, story_data: newChallenge.story_data as unknown as WeeklyChallenge['story_data'] } 
          : c
      ));
      
      toast.success('Challenge rerolled!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reroll';
      toast.error(message);
      console.error('Failed to reroll challenge:', err);
    } finally {
      setRerollingId(null);
    }
  };

  // Check if a challenge can be rerolled
  const canReroll = (challenge: WeeklyChallenge): boolean => {
    return challenge.protocol_key === 'habits_slipping' || 
           challenge.protocol_key === 'priorities_progress' ||
           challenge.protocol_key === 'okrs_progress';
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const data = await challengesService.regenerateChallenges();
      
      // Sort by slot_index
      const sorted = [...data.challenges].sort((a, b) => a.slot_index - b.slot_index);
      setChallenges(sorted);
      
      // Refetch rolling stats for new challenges
      const habitIds = sorted
        .filter((c): c is WeeklyChallenge & { story_data: SlippingHabitData } => 
          c.story_type === 'slipping_habit' && 'habit_id' in c.story_data
        )
        .map(c => c.story_data.habit_id);
      
      if (habitIds.length > 0) {
        const statsPromises = habitIds.map(async (habitId) => {
          const stats = await apiClient.calculateRollingHabitStats(habitId, 90);
          return { habitId, stats };
        });
        
        const results = await Promise.all(statsPromises);
        const statsMap: Record<string, { weekly_average: number }> = {};
        results.forEach(({ habitId, stats }) => {
          statsMap[habitId] = { weekly_average: stats.weekly_average };
        });
        setRollingStats(statsMap);
      }
      
      toast.success('Challenges regenerated!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to regenerate';
      toast.error(message);
      console.error('Failed to regenerate challenges:', err);
    } finally {
      setRegenerating(false);
    }
  };

  const handleToggleComplete = async (challenge: WeeklyChallenge) => {
    setTogglingId(challenge.id);
    try {
      await challengesService.toggleChallengeCompletion(challenge.id, challenge.completed);
      // Re-fetch to get consistent state
      await fetchChallenges();
      toast.success(challenge.completed ? 'Unmarked' : 'Done! 🎉');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update challenge';
      toast.error(message);
      console.error('Failed to toggle challenge:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const isSlippingHabit = (challenge: WeeklyChallenge): challenge is WeeklyChallenge & { story_data: SlippingHabitData } => {
    return challenge.story_type === 'slipping_habit';
  };

  // Get habit stat for slipping habits: weekly_average / weekly_goal
  const getHabitStat = (challenge: WeeklyChallenge): { avg: number; goal: number } | null => {
    if (!isSlippingHabit(challenge)) return null;
    
    const habitId = challenge.story_data.habit_id;
    if (!habitId) return null;
    
    const weeklyAvg = rollingStats[habitId]?.weekly_average ?? 0;
    const weeklyGoal = habitStats[habitId]?.weekly_goal ?? 0;
    
    // Only show if we have a goal
    if (weeklyGoal <= 0) return null;
    
    return { avg: weeklyAvg, goal: weeklyGoal };
  };

  // Loading State - Skeleton Cards
  if (loading) {
    return (
      <div className={cn('bg-neutral-900 border border-neutral-800 rounded-lg p-4', className)}>
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 w-24 bg-neutral-800 rounded animate-pulse" />
          <div className="h-4 w-4 bg-neutral-800 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2 animate-pulse">
              <div className="w-5 h-5 bg-neutral-800 rounded" />
              <div className="h-4 flex-1 bg-neutral-800 rounded" style={{ maxWidth: `${60 + i * 15}%` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className={cn('bg-neutral-900 border border-neutral-800 rounded-lg p-4', className)}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-neutral-400">Challenges</h4>
        </div>
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <AlertTriangle className="w-6 h-6 text-amber-500 mb-2" />
          <p className="text-xs text-neutral-400 mb-3">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              fetchChallenges();
            }}
            className={cn(tokens.button.base, tokens.button.secondary, 'text-xs py-1.5 px-3')}
          >
            <RefreshCw className="w-3 h-3 mr-1.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={cn('bg-neutral-900 border border-neutral-800 rounded-lg p-4', className)}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-neutral-400">Challenges</h4>
          <button
            onClick={handleOpenSettings}
            className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors rounded"
            title="Challenge Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Challenge List - Clean checkbox + action_text */}
        <div className="space-y-1">
          {challenges.map((challenge) => {
            const isToggling = togglingId === challenge.id;
            const isRerolling = rerollingId === challenge.id;
            const isHovered = hoveredChallengeId === challenge.id;
            const stat = getHabitStat(challenge);
            const showReroll = canReroll(challenge) && !challenge.completed && isHovered;

            return (
              <div
                key={challenge.id}
                className={cn(
                  'group relative flex items-start gap-3 py-2 px-2 rounded-lg transition-all -mx-1',
                  challenge.completed 
                    ? 'opacity-60' 
                    : 'hover:bg-neutral-800/50'
                )}
                onMouseEnter={() => setHoveredChallengeId(challenge.id)}
                onMouseLeave={() => setHoveredChallengeId(null)}
              >
                {/* Checkbox */}
                <button
                  onClick={() => handleToggleComplete(challenge)}
                  disabled={isToggling || isRerolling}
                  className={cn(
                    'w-5 h-5 rounded border-2 shrink-0 transition-all flex items-center justify-center',
                    challenge.completed
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-neutral-600 hover:border-emerald-500',
                    (isToggling || isRerolling) && 'opacity-50 cursor-not-allowed'
                  )}
                  title={challenge.completed ? 'Mark incomplete' : 'Mark complete'}
                >
                  {isToggling ? (
                    <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                  ) : challenge.completed ? (
                    <Check className="w-3 h-3" />
                  ) : null}
                </button>

                {/* Action Text */}
                <span
                  className={cn(
                    'text-sm flex-1 break-words',
                    challenge.completed ? 'text-neutral-500 line-through' : 'text-neutral-100'
                  )}
                >
                  {challenge.action_text}
                </span>

                {/* Stat for slipping habits: weekly_avg / weekly_goal */}
                {stat && (
                  <span className={cn(
                    "text-xs text-neutral-500 tabular-nums shrink-0 transition-opacity",
                    showReroll && "opacity-0"
                  )}>
                    {stat.avg.toFixed(1)} / {stat.goal}
                  </span>
                )}

                {/* Reroll button - appears on hover, positioned absolutely on top right */}
                {showReroll && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRerollChallenge(challenge.id);
                    }}
                    disabled={isRerolling}
                    className={cn(
                      'absolute right-1 top-1/2 -translate-y-1/2',
                      'flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-all',
                      'bg-neutral-700/90 text-neutral-300 hover:bg-neutral-600 hover:text-neutral-100',
                      'shadow-lg backdrop-blur-sm',
                      isRerolling && 'opacity-50 cursor-not-allowed'
                    )}
                    title="Reroll this challenge"
                  >
                    <RefreshCcw className={cn('w-3 h-3', isRerolling && 'animate-spin')} />
                    {isRerolling ? '...' : 'Reroll'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty State (should never happen, but defensive) */}
        {challenges.length === 0 && (
          <div className="text-center py-4">
            <p className="text-xs text-neutral-500">No challenges for this week</p>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 shrink-0">
              <h3 className="text-base font-semibold text-neutral-100">Challenge Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="p-4 space-y-4 overflow-y-auto">
              {/* Total Challenges Setting */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Total Challenges</h4>
                <div className="bg-neutral-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-300">Per week</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          onClick={async () => {
                            if (n === totalChallenges) return;
                            setSavingConfig(true);
                            try {
                              await challengesService.updateConfig('total_challenges', n);
                              setTotalChallenges(n);
                              toast.success(`Set to ${n}`);
                              setProtocolsChanged(true);
                            } catch (err) {
                              toast.error('Failed to update');
                            } finally {
                              setSavingConfig(false);
                            }
                          }}
                          disabled={savingConfig}
                          className={cn(
                            'w-8 h-8 rounded text-sm font-medium transition-colors',
                            n === totalChallenges
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-neutral-700/50 text-neutral-400 hover:bg-neutral-600/50'
                          )}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Randomization Strategy Setting */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Randomization Strategy</h4>
                <div className="bg-neutral-800/50 rounded-lg p-3 space-y-3">
                  <div className="space-y-2">
                    <button
                      onClick={async () => {
                        if (randomizationStrategy === 'guaranteed_diversity') return;
                        setSavingConfig(true);
                        try {
                          await challengesService.updateRandomizationStrategy('guaranteed_diversity');
                          setRandomizationStrategy('guaranteed_diversity');
                          toast.success('Strategy set to Guaranteed Diversity');
                          setProtocolsChanged(true);
                        } catch (err) {
                          toast.error('Failed to update strategy');
                        } finally {
                          setSavingConfig(false);
                        }
                      }}
                      disabled={savingConfig}
                      className={cn(
                        'w-full text-left p-2 rounded-lg transition-colors',
                        randomizationStrategy === 'guaranteed_diversity'
                          ? 'bg-amber-500/20 border border-amber-500/30'
                          : 'bg-neutral-700/30 hover:bg-neutral-700/50 border border-transparent'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                          randomizationStrategy === 'guaranteed_diversity'
                            ? 'border-amber-500 bg-amber-500'
                            : 'border-neutral-500'
                        )}>
                          {randomizationStrategy === 'guaranteed_diversity' && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                        <span className={cn(
                          'text-sm font-medium',
                          randomizationStrategy === 'guaranteed_diversity' ? 'text-amber-400' : 'text-neutral-300'
                        )}>
                          Guaranteed Diversity
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1 ml-6">
                        Fills slots in priority order: Habits → Priorities → OKRs → Placeholder.
                        Ensures you see different types each week.
                      </p>
                    </button>

                    <button
                      onClick={async () => {
                        if (randomizationStrategy === 'slot_by_slot') return;
                        setSavingConfig(true);
                        try {
                          await challengesService.updateRandomizationStrategy('slot_by_slot');
                          setRandomizationStrategy('slot_by_slot');
                          toast.success('Strategy set to Slot-by-Slot Random');
                          setProtocolsChanged(true);
                        } catch (err) {
                          toast.error('Failed to update strategy');
                        } finally {
                          setSavingConfig(false);
                        }
                      }}
                      disabled={savingConfig}
                      className={cn(
                        'w-full text-left p-2 rounded-lg transition-colors',
                        randomizationStrategy === 'slot_by_slot'
                          ? 'bg-amber-500/20 border border-amber-500/30'
                          : 'bg-neutral-700/30 hover:bg-neutral-700/50 border border-transparent'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                          randomizationStrategy === 'slot_by_slot'
                            ? 'border-amber-500 bg-amber-500'
                            : 'border-neutral-500'
                        )}>
                          {randomizationStrategy === 'slot_by_slot' && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                        <span className={cn(
                          'text-sm font-medium',
                          randomizationStrategy === 'slot_by_slot' ? 'text-amber-400' : 'text-neutral-300'
                        )}>
                          Slot-by-Slot Random
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1 ml-6">
                        Each slot randomly picks from any eligible protocol.
                        More variety week-to-week, but may not always cover all types.
                      </p>
                    </button>
                  </div>
                </div>
              </div>

              {/* Protocols Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Protocols</h4>
                
                {protocolsLoading ? (
                  <div className="space-y-2">
                    {[0, 1].map(i => (
                      <div key={i} className="bg-neutral-800/50 rounded-lg p-3 animate-pulse">
                        <div className="h-4 w-32 bg-neutral-700 rounded" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {protocols.map((protocol) => {
                      const isExpanded = expandedProtocols.has(protocol.protocol_key);
                      const isSaving = savingProtocol === protocol.protocol_key;
                      const isHabitsProtocol = protocol.protocol_key === 'habits_slipping';
                      const isPrioritiesProtocol = protocol.protocol_key === 'priorities_progress';
                      const isOkrsProtocol = protocol.protocol_key === 'okrs_progress';
                      const hasExpandableConfig = isHabitsProtocol || isPrioritiesProtocol || isOkrsProtocol;
                      const enabledHabitIds = getEnabledHabitIds();
                      const enabledPillars = getEnabledPillars();
                      const enabledKRIds = getEnabledKRIds();

                      return (
                        <div
                          key={protocol.protocol_key}
                          className="bg-neutral-800/50 rounded-lg overflow-hidden"
                        >
                          {/* Protocol Header */}
                          <div className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {hasExpandableConfig && (
                                  <button
                                    onClick={() => toggleProtocolExpanded(protocol.protocol_key)}
                                    className="p-0.5 text-neutral-400 hover:text-neutral-200"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                                <span className="text-sm font-medium text-neutral-200">
                                  {protocol.display_name}
                                </span>
                                {isSaving && (
                                  <RefreshCw className="w-3 h-3 text-neutral-500 animate-spin" />
                                )}
                              </div>
                              
                              {/* Enable Toggle */}
                              <button
                                onClick={() => handleToggleProtocolEnabled(protocol.protocol_key, protocol.is_enabled)}
                                disabled={isSaving}
                                className={cn(
                                  'relative w-10 h-5 rounded-full transition-colors',
                                  protocol.is_enabled ? 'bg-emerald-600' : 'bg-neutral-600',
                                  isSaving && 'opacity-50'
                                )}
                              >
                                <span
                                  className={cn(
                                    'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform',
                                    protocol.is_enabled ? 'left-5' : 'left-0.5'
                                  )}
                                />
                              </button>
                            </div>

                            {/* Max Per Week Control */}
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-700/50">
                              <span className="text-xs text-neutral-400">Max per week</span>
                              <div className="flex items-center gap-1">
                                {[0, 1, 2, 3].map((num) => (
                                  <button
                                    key={num}
                                    onClick={() => handleChangeMaxPerWeek(protocol.protocol_key, num)}
                                    disabled={isSaving}
                                    className={cn(
                                      'w-6 h-6 text-xs rounded transition-colors',
                                      protocol.max_per_week === num
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600',
                                      isSaving && 'opacity-50'
                                    )}
                                  >
                                    {num}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Expanded Habits List (for habits_slipping) */}
                          {isHabitsProtocol && isExpanded && (
                            <div className="px-3 pb-3 pt-1 border-t border-neutral-700/50">
                              <p className="text-xs text-neutral-500 mb-2">Included habits:</p>
                              <div className="space-y-1">
                                {allHabits.map((habit) => {
                                  const isEnabled = enabledHabitIds.includes(habit.id);
                                  return (
                                    <button
                                      key={habit.id}
                                      onClick={() => handleToggleHabitEnabled(habit.id, isEnabled)}
                                      disabled={isSaving}
                                      className={cn(
                                        'flex items-center w-full gap-2 px-2 py-1.5 rounded text-sm transition-colors',
                                        isEnabled
                                          ? 'bg-emerald-900/30 text-emerald-200'
                                          : 'bg-neutral-700/30 text-neutral-400 hover:bg-neutral-700/50',
                                        isSaving && 'opacity-50'
                                      )}
                                    >
                                      <div
                                        className={cn(
                                          'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0',
                                          isEnabled
                                            ? 'bg-emerald-500 border-emerald-500'
                                            : 'border-neutral-500'
                                        )}
                                      >
                                        {isEnabled && <Check className="w-2.5 h-2.5 text-white" />}
                                      </div>
                                      <span>{habit.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Expanded Pillars List (for priorities_progress) */}
                          {isPrioritiesProtocol && isExpanded && (
                            <div className="px-3 pb-3 pt-1 border-t border-neutral-700/50">
                              <p className="text-xs text-neutral-500 mb-2">Enabled pillars:</p>
                              <div className="grid grid-cols-2 gap-1">
                                {PILLAR_OPTIONS.map((pillar) => {
                                  const isEnabled = enabledPillars.includes(pillar);
                                  const pillarEmoji = pillar === 'Power' ? '💪' : pillar === 'Passion' ? '❤️' : pillar === 'Purpose' ? '🧠' : '🎯';
                                  return (
                                    <button
                                      key={pillar}
                                      onClick={() => handleTogglePillarEnabled(pillar, isEnabled)}
                                      disabled={isSaving}
                                      className={cn(
                                        'flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors',
                                        isEnabled
                                          ? 'bg-emerald-900/30 text-emerald-200'
                                          : 'bg-neutral-700/30 text-neutral-400 hover:bg-neutral-700/50',
                                        isSaving && 'opacity-50'
                                      )}
                                    >
                                      <div
                                        className={cn(
                                          'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0',
                                          isEnabled
                                            ? 'bg-emerald-500 border-emerald-500'
                                            : 'border-neutral-500'
                                        )}
                                      >
                                        {isEnabled && <Check className="w-2.5 h-2.5 text-white" />}
                                      </div>
                                      <span>{pillarEmoji}</span>
                                      <span className="flex-1 text-left">{pillar}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Expanded Key Results List (for okrs_progress) */}
                          {isOkrsProtocol && isExpanded && (
                            <div className="px-3 pb-3 pt-1 border-t border-neutral-700/50">
                              <p className="text-xs text-neutral-500 mb-2">Enabled Key Results:</p>
                              <div className="space-y-1">
                                {allKeyResults.map((kr) => {
                                  const isPunted = kr.punted === true;
                                  const progressPercent = Math.round(kr.progress * 100);
                                  const isCompleted = progressPercent >= 100;
                                  const isUnavailable = isPunted || isCompleted;
                                  // Only show as enabled if in the list AND not completed/punted
                                  const isEnabled = enabledKRIds.includes(kr.id) && !isUnavailable;
                                  const pillarEmoji = kr.okr_pillar === 'Power' ? '💪' : kr.okr_pillar === 'Passion' ? '❤️' : kr.okr_pillar === 'Purpose' ? '🧠' : '🎯';
                                  return (
                                    <button
                                      key={kr.id}
                                      onClick={() => !isUnavailable && handleToggleKREnabled(kr.id, isEnabled)}
                                      disabled={isSaving || isUnavailable}
                                      className={cn(
                                        'flex items-center w-full gap-2 px-2 py-1.5 rounded text-sm transition-colors',
                                        isCompleted
                                          ? 'bg-emerald-900/10 text-neutral-500 cursor-not-allowed'
                                          : isPunted
                                            ? 'bg-amber-900/10 text-neutral-500 cursor-not-allowed'
                                            : isEnabled
                                              ? 'bg-emerald-900/30 text-emerald-200'
                                              : 'bg-neutral-700/30 text-neutral-400 hover:bg-neutral-700/50',
                                        isSaving && 'opacity-50'
                                      )}
                                      title={
                                        isCompleted 
                                          ? 'This KR is completed - it won\'t appear in challenges' 
                                          : isPunted 
                                            ? 'This KR is punted (deprioritized) - resume it from OKRs tab to include in challenges' 
                                            : undefined
                                      }
                                    >
                                      <div
                                        className={cn(
                                          'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0',
                                          isCompleted
                                            ? 'border-emerald-500/50 bg-emerald-500/20'
                                            : isPunted
                                              ? 'border-amber-500/50 bg-amber-500/20'
                                              : isEnabled
                                                ? 'bg-emerald-500 border-emerald-500'
                                                : 'border-neutral-500'
                                        )}
                                      >
                                        {/* Only show check icon if enabled AND available */}
                                        {isEnabled && !isUnavailable && <Check className="w-2.5 h-2.5 text-white" />}
                                        {/* Show special indicator icons for unavailable KRs - no checkmark */}
                                        {isCompleted && <span className="text-[8px] text-emerald-400/50">✓</span>}
                                        {isPunted && !isCompleted && <span className="text-[8px] text-amber-400/50">⏸</span>}
                                      </div>
                                      <span>{pillarEmoji}</span>
                                      <span className={cn(
                                        "flex-1 text-left truncate",
                                        isUnavailable && "line-through decoration-neutral-600"
                                      )}>
                                        {kr.description}
                                      </span>
                                      {isCompleted ? (
                                        <span className="text-[9px] text-emerald-400/70 bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase shrink-0">Done</span>
                                      ) : isPunted ? (
                                        <span className="text-[9px] text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded uppercase shrink-0">Punted</span>
                                      ) : (
                                        <span className="text-[10px] text-neutral-500 shrink-0">{progressPercent}%</span>
                                      )}
                                    </button>
                                  );
                                })}
                                {allKeyResults.length === 0 && (
                                  <p className="text-xs text-neutral-500 italic">No active Key Results found</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-neutral-800">
                {/* Apply Now / Regenerate button */}
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className={cn(
                    tokens.button.base,
                    'w-full justify-center',
                    protocolsChanged
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-amber-600 hover:bg-amber-500 text-white'
                  )}
                >
                  {protocolsChanged ? (
                    <>
                      <Zap className={cn('w-4 h-4 mr-2', regenerating && 'animate-pulse')} />
                      {regenerating ? 'Applying...' : 'Apply Changes Now'}
                    </>
                  ) : (
                    <>
                      <RefreshCw className={cn('w-4 h-4 mr-2', regenerating && 'animate-spin')} />
                      {regenerating ? 'Regenerating...' : 'Regenerate Challenges'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChallengesModule;
