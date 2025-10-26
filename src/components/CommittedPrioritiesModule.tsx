import React, { useEffect, useState, useMemo } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
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
  const [expandedPriorities, setExpandedPriorities] = useState<Set<string>>(new Set());

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
      // Default all to expanded
      setExpandedPriorities(new Set(rows.map(r => r.priority_id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load committed priorities');
      setActiveFocus([]);
      setOverview([]);
    } finally {
      setLoading(false);
    }
  };

  const togglePriorityExpanded = (priorityId: string) => {
    setExpandedPriorities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(priorityId)) {
        newSet.delete(priorityId);
      } else {
        newSet.add(priorityId);
      }
      return newSet;
    });
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
        milestones: group.milestones.filter(m => m.milestone_id !== milestoneId)
      })));
    }

    try {
      await toggleComplete(milestoneId);
      if (nextVal === true) {
        // If completed, also decommit so it stays out of Current Priorities
        await toggleCommit(milestoneId);
      }
      toast.success('Milestone completed! 🎉');
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

  // Don't render when not visible, but don't reload on visibility change
  if (!isVisible) return null;

  if (loading) {
    return (
      <div className={cn(tokens.card.base, 'p-6')}>
        <div className="text-sm text-neutral-400">Loading committed priorities...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(tokens.card.base, 'p-6')}>
        <div className="text-sm text-red-400">⚠️ {error}</div>
      </div>
    );
  }

  if (displayData.length === 0) {
    return (
      <div className={cn(tokens.card.base, 'p-6')}>
        <div className="text-sm text-neutral-400">No committed priorities. Visit the Priorities tab to commit some!</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {displayData.map((pillar) => (
        <div key={pillar.pillar_id} className={tokens.card.base}>
          {/* Pillar Header */}
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden>{pillar.emoji || '🗂️'}</span>
            <h3 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, 'text-neutral-100')}>
              {pillar.pillar_name}
            </h3>
          </div>
          
          {/* Priorities under this pillar */}
          <div className="mt-3 space-y-3">
            {pillar.priorities.map((group) => (
              <div key={group.priority_id} className="rounded-2xl border border-neutral-800 p-3 bg-neutral-900">
                {/* Priority Header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="text-neutral-100 font-medium break-words">
                        {group.priority_title}
                      </div>
                    </div>
                  </div>
                  <button
                    className="text-neutral-400 hover:text-neutral-100 transition-colors cursor-pointer flex-shrink-0"
                    onClick={() => togglePriorityExpanded(group.priority_id)}
                    title={expandedPriorities.has(group.priority_id) ? 'Collapse milestones' : 'Expand milestones'}
                  >
                    {expandedPriorities.has(group.priority_id) ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>
                </div>
                
                {/* Milestones List (collapsible) */}
                {expandedPriorities.has(group.priority_id) && (
                  group.milestones.length === 0 ? (
                    <div className="mt-2 text-xs text-neutral-400">No committed milestones</div>
                  ) : (
                    <ul className="mt-3 pt-3 border-t border-neutral-800 space-y-2">
                      {group.milestones.map(m => (
                        <li 
                          key={m.milestone_id} 
                          className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950 p-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="min-w-0 text-neutral-100 break-words">{m.title}</div>
                          </div>
                          <button
                            className="text-green-500 hover:text-green-400 transition-colors cursor-pointer flex-shrink-0"
                            onClick={() => handleCompleteToggle(m.milestone_id, m.completed)}
                            title="Complete milestone"
                            aria-label="Complete milestone"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CommittedPrioritiesModule;

