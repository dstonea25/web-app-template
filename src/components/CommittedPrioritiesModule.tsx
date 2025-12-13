import React, { useEffect, useState, useMemo } from 'react';
import { Check } from 'lucide-react';
import { cn, tokens } from '../theme/config';
import type { ActiveFocusRow, PrioritiesOverviewResponse } from '../types';
import { refreshActiveFocus, toggleComplete, toggleCommit, getPrioritiesOverview } from '../lib/priorities';
import { toast } from '../lib/notifications/toast';

interface CommittedPrioritiesModuleProps {
  isVisible?: boolean;
}

export const CommittedPrioritiesModule: React.FC<CommittedPrioritiesModuleProps> = ({ isVisible = true }) => {
  const [activeFocus, setActiveFocus] = useState<ActiveFocusRow[]>([]);
  const [overview, setOverview] = useState<PrioritiesOverviewResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadActiveFocus = async () => {
    try {
      setLoading(true);
      setError(null);
      const [rows, overviewData] = await Promise.all([
        refreshActiveFocus(),
        getPrioritiesOverview()
      ]);
      setActiveFocus(rows);
      setOverview(overviewData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load current priorities');
      setActiveFocus([]);
      setOverview([]);
    } finally {
      setLoading(false);
    }
  };

  // Load data only once on mount, not on every tab switch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadActiveFocus();
  }, []); // Empty dependency array = only runs once on mount

  // Listen for refresh events from Priorities tab
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handleRefresh = (e: Event) => {
      console.log('[CommittedPrioritiesModule] Received event:', e.type);
      loadActiveFocus();
    };
    window.addEventListener('dashboard:priorities-refresh', handleRefresh);
    window.addEventListener('dashboard:active-focus-refresh', handleRefresh);
    window.addEventListener('dashboard:priorities-completed-updated', handleRefresh);
    window.addEventListener('dashboard:priorities-committed-updated', handleRefresh);
    window.addEventListener('dashboard:priorities-priority-committed-updated', handleRefresh);
    return () => {
      window.removeEventListener('dashboard:priorities-refresh', handleRefresh);
      window.removeEventListener('dashboard:active-focus-refresh', handleRefresh);
      window.removeEventListener('dashboard:priorities-completed-updated', handleRefresh);
      window.removeEventListener('dashboard:priorities-committed-updated', handleRefresh);
      window.removeEventListener('dashboard:priorities-priority-committed-updated', handleRefresh);
    };
  }, []); // Event listeners set up once, updates via loadActiveFocus callback

  const handleCompleteToggle = async (milestoneId: string, currentCompleted: boolean) => {
    const nextVal = !currentCompleted;
    const prevActiveFocus = JSON.parse(JSON.stringify(activeFocus)) as ActiveFocusRow[];

    console.log('[CommittedPrioritiesModule] Completing milestone:', milestoneId);

    // Optimistic UI: remove completed milestone from view immediately
    if (nextVal === true) {
      setActiveFocus(prev => prev.map(group => ({
        ...group,
        milestones: group.milestones.map(m => 
          m.milestone_id === milestoneId 
            ? { ...m, _removing: true } as any // Mark for fade-out animation
            : m
        )
      })));
      
      // After animation, actually remove it
      setTimeout(() => {
        setActiveFocus(prev => prev.map(group => ({
          ...group,
          milestones: group.milestones.filter(m => m.milestone_id !== milestoneId)
        })));
      }, 300); // Match transition duration
    }

    try {
      await toggleComplete(milestoneId);
      if (nextVal === true) {
        // If completed, also decommit so it stays out of Current Priorities
        await toggleCommit(milestoneId);
      }
      toast.success('Milestone completed! 🎉');
      // Don't reload - optimistic update already handled it
    } catch (e) {
      // Rollback on error
      setActiveFocus(prevActiveFocus);
      toast.error(`Failed to update: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  // Group by pillar (same logic as Priorities tab)
  const groupedByPillar = useMemo(() => {
    return activeFocus.reduce((acc, group) => {
      if (!acc[group.pillar_id]) {
        acc[group.pillar_id] = {
          pillar_name: group.pillar_name,
          emoji: group.emoji ?? null,
          priorities: []
        };
      }
      acc[group.pillar_id].priorities.push(group);
      return acc;
    }, {} as Record<string, { pillar_name: string; emoji: string | null; priorities: typeof activeFocus }>);
  }, [activeFocus]);

  // Maintain the same pillar order as the backlog (overview) and only show pillars with committed priorities
  const displayData = useMemo(() => {
    return overview
      .filter(pillar => groupedByPillar[pillar.pillar_id])
      .map(pillar => ({
        pillar_id: pillar.pillar_id,
        pillar_name: pillar.pillar_name,
        emoji: pillar.emoji,
        priorities: groupedByPillar[pillar.pillar_id].priorities
          .map(group => ({
            ...group,
            milestones: group.milestones.filter(m => !m.completed)
          }))
          .filter(group => group.milestones.length > 0)
      }))
      .filter(pillar => pillar.priorities.length > 0);
  }, [overview, groupedByPillar]);

  // Create a map of priority_id -> completion stats (all milestones, not just committed)
  // This must be here (before early returns) to follow React hooks rules
  const completionStats = useMemo(() => {
    const stats = new Map<string, { completed: number; total: number }>();
    // Use overview data which has ALL milestones (not just committed ones like activeFocus)
    overview.forEach(pillar => {
      pillar.priorities.forEach(priority => {
        const total = priority.milestones.length;
        const completed = priority.milestones.filter(m => m.completed).length;
        stats.set(priority.priority_id, { completed, total });
      });
    });
    return stats;
  }, [overview]);

  // Keep component mounted but hidden (don't unmount/remount on collapse/expand)
  if (loading) {
    return (
      <div className={cn(tokens.card.base, 'p-6', !isVisible && 'hidden')}>
        <div className="text-sm text-neutral-400">Loading current priorities...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(tokens.card.base, 'p-6', !isVisible && 'hidden')}>
        <div className="text-sm text-red-400">⚠️ {error}</div>
      </div>
    );
  }

  if (displayData.length === 0) {
    return (
      <div className={cn(tokens.card.base, 'p-6', !isVisible && 'hidden')}>
        <div className="text-sm text-neutral-400">No current priorities. Visit the Priorities tab to commit some!</div>
      </div>
    );
  }

  // Flatten all priorities into a single array for the grid
  const allPriorities = displayData.flatMap(pillar => 
    pillar.priorities.map(priority => ({
      ...priority,
      pillar_name: pillar.pillar_name,
      pillar_emoji: pillar.emoji,
      stats: completionStats.get(priority.priority_id) || { completed: 0, total: 0 }
    }))
  );

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4', !isVisible && 'hidden')}>
      {allPriorities.map((priority) => (
        <div key={priority.priority_id} className={cn(tokens.card.base, 'flex flex-col')}>
          {/* Priority title first - the hero content */}
          <h3 
            className={cn(
              tokens.typography.scale.h3, 
              tokens.typography.weights.semibold, 
              'text-neutral-100',
              'cursor-pointer hover:text-emerald-400 transition-colors'
            )}
            onClick={() => {
              // Switch to Priorities tab
              localStorage.setItem('dashboard-active-tab', 'priorities');
              window.history.pushState({ module: 'priorities' }, '', '/priorities');
              
              // Dispatch events to trigger tab switch and scroll
              window.dispatchEvent(new Event('popstate')); // Trigger tab change
              
              // Small delay to ensure tab is switched before scrolling
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('dashboard:navigate-to-priority', { 
                  detail: { priorityId: priority.priority_id } 
                }));
              }, 100);
            }}
            title="Click to view in Priorities tab"
          >
            {priority.priority_title}
          </h3>
          
          {/* Pillar as subtext with emoji and stats */}
          <div className="flex items-center justify-between gap-3 mt-2 mb-4">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs text-neutral-500 uppercase tracking-wide font-medium truncate">{priority.pillar_name}</span>
              <span className="text-sm flex-shrink-0" aria-hidden>{priority.pillar_emoji || '🗂️'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium flex-shrink-0">
              <span className="text-emerald-400">{priority.stats.completed}</span>
              <span className="text-neutral-500">/</span>
              <span className="text-neutral-400">{priority.stats.total}</span>
            </div>
          </div>
          
          {/* Simple milestone list - no collapsing, no heavy borders */}
          {priority.milestones.length === 0 ? (
            <div className="text-sm text-neutral-400">No milestones</div>
          ) : (
            <div className="space-y-2 flex-1">
              {priority.milestones.map(m => (
                <div 
                  key={m.milestone_id}
                  className={cn(
                    "flex items-center justify-between gap-3 p-3 rounded-xl",
                    "border border-neutral-800 bg-neutral-900/50",
                    "transition-all duration-300 ease-out",
                    "hover:bg-neutral-800/60 hover:border-neutral-700 hover:scale-[1.02] cursor-pointer",
                    (m as any)._removing 
                      ? "opacity-0 scale-95 h-0 p-0 my-0 overflow-hidden border-0" 
                      : "opacity-100 scale-100"
                  )}
                >
                  <span className="text-neutral-100 text-sm break-words flex-1">{m.title}</span>
                  <button
                    className="text-green-500 hover:text-green-400 transition-colors cursor-pointer flex-shrink-0"
                    onClick={() => handleCompleteToggle(m.milestone_id, m.completed)}
                    title="Complete milestone"
                    aria-label="Complete milestone"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default CommittedPrioritiesModule;

