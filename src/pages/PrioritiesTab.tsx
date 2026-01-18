import React, { useMemo, useState } from 'react';
import { Plus, MoreVertical, Check, X, Square, CheckSquare, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, ChevronsRight } from 'lucide-react';
import { tokens, cn } from '../theme/config';
import type { PrioritiesOverviewResponse, PriorityRecord, MilestoneRecord, ActiveFocusRow } from '../types';
import { toast } from '../lib/notifications/toast';
import { useWorkMode } from '../contexts/WorkModeContext';
import {
  usePrioritiesOverview,
  refreshActiveFocus,
  toggleCommit,
  toggleComplete,
  togglePriorityCommit,
  createPriority as apiCreatePriority,
  updatePriority as apiUpdatePriority,
  deletePriority as apiDeletePriority,
  createMilestone as apiCreateMilestone,
  updateMilestone as apiUpdateMilestone,
  deleteMilestone as apiDeleteMilestone,
} from '../lib/priorities';

export const PrioritiesTab: React.FC<{ isVisible?: boolean }> = ({ isVisible: _isVisible = true }) => {
  const { data: overview, loading, error, setData: setOverview } = usePrioritiesOverview();
  const [activeFocus, setActiveFocus] = useState<ActiveFocusRow[]>([]);
  const [afLoading, setAfLoading] = useState<boolean>(false);
  const [afError, setAfError] = useState<string | null>(null);
  const { workMode } = useWorkMode();
  
  // State for expanded/collapsed items
  const [expandedPillars, setExpandedPillars] = useState<Set<string>>(new Set());
  const [expandedPriorities, setExpandedPriorities] = useState<Set<string>>(new Set());
  
  // State for Current Priorities side - separate from backlog, defaults to all expanded
  const [expandedCurrentPriorities, setExpandedCurrentPriorities] = useState<Set<string>>(new Set());
  
  // State for backlog panel: 'full' (1/3), 'half' (1/2), 'collapsed' (hidden/minimal)
  const [backlogSize, setBacklogSize] = useState<'full' | 'half' | 'collapsed'>('full');
  

  const loadActiveFocus = async () => {
    try {
      setAfLoading(true);
      setAfError(null);
      const rows = await refreshActiveFocus();
      setActiveFocus(rows);
      // Default all current priorities to expanded
      setExpandedCurrentPriorities(new Set(rows.map(r => r.priority_id)));
    } catch (e) {
      setAfError(e instanceof Error ? e.message : 'Failed to load Active Focus');
    } finally {
      setAfLoading(false);
    }
  };

  // Toggle functions for expand/collapse
  const togglePillarExpanded = (pillarId: string) => {
    setExpandedPillars(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pillarId)) {
        newSet.delete(pillarId);
      } else {
        newSet.add(pillarId);
      }
      return newSet;
    });
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

  const toggleCurrentPriorityExpanded = (priorityId: string) => {
    setExpandedCurrentPriorities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(priorityId)) {
        newSet.delete(priorityId);
      } else {
        newSet.add(priorityId);
      }
      return newSet;
    });
  };

  const toggleAllCurrentPriorities = () => {
    const allPriorityIds = filteredActiveFocus.map(r => r.priority_id);
    const allExpanded = allPriorityIds.every(id => expandedCurrentPriorities.has(id));
    
    if (allExpanded) {
      // Collapse all
      setExpandedCurrentPriorities(new Set());
    } else {
      // Expand all
      setExpandedCurrentPriorities(new Set(allPriorityIds));
    }
  };

  const scrollToPriorityInBacklog = (priorityId: string) => {
    // Find which pillar this priority belongs to
    let pillarId: string | null = null;
    for (const pillar of filteredOverview) {
      if (pillar.priorities.some(p => p.priority_id === priorityId)) {
        pillarId = pillar.pillar_id;
        break;
      }
    }
    
    if (!pillarId) return;
    
    // Expand the pillar
    setExpandedPillars(prev => {
      const newSet = new Set(prev);
      newSet.add(pillarId);
      return newSet;
    });
    
    // Expand the priority
    setExpandedPriorities(prev => {
      const newSet = new Set(prev);
      newSet.add(priorityId);
      return newSet;
    });
    
    // Scroll to the priority after state updates
    setTimeout(() => {
      const element = priorityRefs.current[priorityId];
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Optional: add a brief highlight effect
        element.style.transition = 'background-color 0.5s ease';
        element.style.backgroundColor = 'rgba(34, 197, 94, 0.1)'; // subtle green highlight
        setTimeout(() => {
          element.style.backgroundColor = '';
        }, 1500);
      }
    }, 100); // Small delay to ensure state updates have rendered
  };

  // Milestones are terminal nodes; no expand/collapse at this level

  React.useEffect(() => { 
    loadActiveFocus(); 
    const handleAF = () => loadActiveFocus();
    window.addEventListener('dashboard:active-focus-refresh', handleAF);
    return () => window.removeEventListener('dashboard:active-focus-refresh', handleAF);
  }, []);

  // Listen for navigation from other components (e.g., Current Priorities on Home tab)
  React.useEffect(() => {
    const handleNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<{ priorityId: string }>;
      if (customEvent.detail?.priorityId) {
        scrollToPriorityInBacklog(customEvent.detail.priorityId);
      }
    };
    window.addEventListener('dashboard:navigate-to-priority', handleNavigate);
    return () => window.removeEventListener('dashboard:navigate-to-priority', handleNavigate);
  }, [scrollToPriorityInBacklog]);

  // Listen for refresh events
  React.useEffect(() => {
    const handleRefresh = () => {
      loadActiveFocus();
    };
    window.addEventListener('dashboard:priorities-refresh', handleRefresh);
    window.addEventListener('dashboard:active-focus-refresh', handleRefresh);
    return () => {
      window.removeEventListener('dashboard:priorities-refresh', handleRefresh);
      window.removeEventListener('dashboard:active-focus-refresh', handleRefresh);
    };
  }, []);

  // State for UI interactions
  const [showPriorityMenu, setShowPriorityMenu] = useState<Record<string, boolean>>({});
  const [showMilestoneMenu, setShowMilestoneMenu] = useState<Record<string, boolean>>({});
  const [showRenamePriority, setShowRenamePriority] = useState<Record<string, boolean>>({});
  const [showRenameMilestone, setShowRenameMilestone] = useState<Record<string, boolean>>({});
  const [editingPriorityTitle, setEditingPriorityTitle] = useState<Record<string, string>>({});
  const [editingMilestoneTitle, setEditingMilestoneTitle] = useState<Record<string, string>>({});
  const [newPriorityByPillar, setNewPriorityByPillar] = useState<Record<string, { title: string }>>({});
  const [newMilestoneByPriority, setNewMilestoneByPriority] = useState<Record<string, { title: string }>>({});
  
  // Refs for scrolling to priorities in backlog
  const priorityRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const backlogCount = useMemo(() => {
    return overview.reduce((total, pillar) => total + pillar.priorities.length, 0);
  }, [overview]);

  // Filter data based on work mode (show only Production pillar when work mode is enabled)
  const filteredOverview = useMemo(() => {
    if (!workMode) return overview;
    return overview.filter(pillar => pillar.pillar_name === 'Production');
  }, [overview, workMode]);

  const filteredActiveFocus = useMemo(() => {
    if (!workMode) return activeFocus;
    return activeFocus.filter(group => group.pillar_name === 'Production');
  }, [activeFocus, workMode]);

  // Sort milestones: committed → uncommitted → completed, then by created_at (newest first)
  const sortMilestones = (milestones: typeof overview[0]['priorities'][0]['milestones']) => {
    return [...milestones].sort((a, b) => {
      // Primary sort: status (committed → uncommitted → completed)
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1; // completed goes to bottom
      }
      if (a.committed !== b.committed) {
        return a.committed ? -1 : 1; // committed goes to top
      }
      
      // Secondary sort: by created_at (newest first, oldest at bottom)
      if (a.created_at && b.created_at) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return 0;
    });
  };

  // Sort priorities: committed first, then by number of milestones (descending)
  const sortPriorities = (priorities: typeof overview[0]['priorities']) => {
    return [...priorities].sort((a, b) => {
      // Primary sort: committed priorities first
      if (a.committed !== b.committed) {
        return a.committed ? -1 : 1;
      }
      
      // Secondary sort: by number of milestones (descending)
      return b.milestones.length - a.milestones.length;
    });
  };

  // Calculate grid columns based on backlog size (must be before early returns)
  const gridCols = useMemo(() => {
    if (backlogSize === 'collapsed') {
      return 'lg:grid-cols-[auto_minmax(0,1fr)]'; // collapsed: just button width + rest
    } else if (backlogSize === 'half') {
      return 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'; // half: 50/50
    } else {
      return 'lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]'; // full: 1/3 - 2/3
    }
  }, [backlogSize]);


  const handleCommitToggle = async (milestoneId: string, nextVal: boolean) => {
    // Capture previous state
    const prevOverview = JSON.parse(JSON.stringify(overview)) as PrioritiesOverviewResponse[];
    const prevActiveFocus = JSON.parse(JSON.stringify(activeFocus)) as ActiveFocusRow[];

    // Optimistic UI - update backlog
    setOverview(prev => prev.map(p => ({
      ...p,
      priorities: p.priorities.map(pr => ({
        ...pr,
        milestones: pr.milestones.map(m => m.milestone_id === milestoneId ? { ...m, committed: nextVal } : m)
      }))
    })) as PrioritiesOverviewResponse[]);
    
    // Optimistic UI - update activeFocus to preserve scroll position
    if (nextVal === false) {
      // Uncommitting: remove milestone from activeFocus view
      setActiveFocus(prev => prev.map(group => ({
        ...group,
        milestones: group.milestones.filter(m => m.milestone_id !== milestoneId)
      })));
    } else {
      // Committing: update milestone in activeFocus view
      setActiveFocus(prev => prev.map(group => ({
        ...group,
        milestones: group.milestones.map(m => m.milestone_id === milestoneId ? { ...m, committed: nextVal } : m)
      })));
    }

    try {
      await toggleCommit(milestoneId);
      // Don't call loadActiveFocus() to preserve scroll position
      // The optimistic updates above handle the UI
    } catch (e) {
      // Rollback
      setOverview(prevOverview);
      setActiveFocus(prevActiveFocus);
      toast.error(`Failed to update committed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const handleCompleteToggle = async (milestoneId: string, nextVal: boolean) => {
    const prevOverview = JSON.parse(JSON.stringify(overview)) as PrioritiesOverviewResponse[];
    const prevActiveFocus = JSON.parse(JSON.stringify(activeFocus)) as ActiveFocusRow[];
    
    console.log('[PrioritiesTab] Completing milestone:', milestoneId, 'nextVal:', nextVal);
    
    // Optimistic: mark completed in backlog, and if completing, also decommit
    setOverview(list => list.map(p => ({
      ...p,
      priorities: p.priorities.map(pr => ({
        ...pr,
        milestones: pr.milestones.map(m => m.milestone_id === milestoneId 
          ? { ...m, completed: nextVal, committed: nextVal ? false : m.committed } 
          : m)
      }))
    })) as PrioritiesOverviewResponse[]);
    
    // Optimistic: update activeFocus state directly to avoid re-render and scroll jump
    if (nextVal === true) {
      // Remove completed milestone from activeFocus view (it's filtered out)
      setActiveFocus(prev => prev.map(group => ({
        ...group,
        milestones: group.milestones.filter(m => m.milestone_id !== milestoneId)
      })));
    }
    
    try {
      await toggleComplete(milestoneId);
      console.log('[PrioritiesTab] toggleComplete done');
      if (nextVal === true) {
        // If completed, also decommit so it stays out of Current Priorities
        await toggleCommit(milestoneId);
        console.log('[PrioritiesTab] toggleCommit done');
        // Don't call loadActiveFocus() to preserve scroll position
        // The optimistic update above handles the UI
      }
    } catch (e) {
      // Rollback on error
      setOverview(prevOverview);
      setActiveFocus(prevActiveFocus);
      toast.error(`Failed to update completed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const handlePriorityCommitToggle = async (pillarId: string, priorityId: string, nextVal: boolean) => {
    const prevOverview = JSON.parse(JSON.stringify(overview)) as PrioritiesOverviewResponse[];
    const prevActiveFocus = JSON.parse(JSON.stringify(activeFocus)) as ActiveFocusRow[];
    
    // Optimistic UI - update backlog
    setOverview(list => list.map(p => p.pillar_id === pillarId ? {
      ...p,
      priorities: p.priorities.map(pr => pr.priority_id === priorityId ? { ...pr, committed: nextVal } : pr)
    } : p) as PrioritiesOverviewResponse[]);
    
    // Optimistic UI - update activeFocus to preserve scroll position
    if (nextVal === false) {
      // Uncommitting: remove priority from activeFocus view
      setActiveFocus(prev => prev.filter(group => group.priority_id !== priorityId));
      // Also remove from expanded state
      setExpandedCurrentPriorities(prev => {
        const newSet = new Set(prev);
        newSet.delete(priorityId);
        return newSet;
      });
    }
    
    try {
      await togglePriorityCommit(priorityId);
      // Don't call loadActiveFocus() to preserve scroll position
      // The optimistic updates above handle the UI
    } catch (e) {
      // Rollback
      setOverview(prevOverview);
      setActiveFocus(prevActiveFocus);
      toast.error(`Failed to update priority committed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const handleCreatePriority = async (pillarId: string) => {
    const title = newPriorityByPillar[pillarId]?.title?.trim();
    if (!title) return;

    try {
      const newPriority: PriorityRecord = {
        pillar_id: pillarId,
        title,
        description: null,
        status: 'backlog',
        importance: null,
        committed: false,
      };
      const priorityId = await apiCreatePriority(newPriority);
      
      // Add to UI optimistically
      setOverview(prev => prev.map(p => p.pillar_id === pillarId ? {
        ...p,
        priorities: [...p.priorities, {
          priority_id: priorityId,
          title,
          description: null,
          status: 'backlog',
          importance: null,
          committed: false,
          milestones: []
        }]
      } : p) as PrioritiesOverviewResponse[]);
      
      setNewPriorityByPillar(prev => ({ ...prev, [pillarId]: { title: '' } }));
      toast.success('Priority created');
    } catch (e) {
      toast.error('Failed to create priority');
    }
  };

  const handleCreateMilestone = async (priorityId: string) => {
    const title = newMilestoneByPriority[priorityId]?.title?.trim();
    if (!title) return;

    try {
      const newMilestone: MilestoneRecord = {
        priority_id: priorityId,
        title,
        notes: null,
        committed: false,
        completed: false,
        order_index: null,
        definition_of_done: null,
        due_date: null,
      };
      const milestoneId = await apiCreateMilestone(newMilestone);
      
      // Add to UI optimistically
      setOverview(prev => prev.map(p => ({
        ...p,
        priorities: p.priorities.map(pr => pr.priority_id === priorityId ? {
          ...pr,
          milestones: [...pr.milestones, {
            milestone_id: milestoneId,
            title,
            notes: null,
            committed: false,
            completed: false,
            order_index: null,
            definition_of_done: null,
            due_date: null,
            created_at: new Date().toISOString(),
          }]
        } : pr)
      })) as PrioritiesOverviewResponse[]);
      
      setNewMilestoneByPriority(prev => ({ ...prev, [priorityId]: { title: '' } }));
      toast.success('Milestone created');
    } catch (e) {
      toast.error('Failed to create milestone');
    }
  };

  const handleUpdatePriorityTitle = async (priorityId: string) => {
    const newTitle = editingPriorityTitle[priorityId]?.trim();
    if (!newTitle) return;

    try {
      await apiUpdatePriority(priorityId, { title: newTitle });
      
      setOverview(prev => prev.map(p => ({
        ...p,
        priorities: p.priorities.map(pr => pr.priority_id === priorityId ? { ...pr, title: newTitle } : pr)
      })) as PrioritiesOverviewResponse[]);
      
      setEditingPriorityTitle(prev => ({ ...prev, [priorityId]: '' }));
      toast.success('Priority updated');
    } catch (e) {
      toast.error('Failed to update priority');
    }
  };

  const handleUpdateMilestoneTitle = async (priorityId: string, milestoneId: string) => {
    const newTitle = editingMilestoneTitle[milestoneId]?.trim();
    if (!newTitle) return;

    try {
      await apiUpdateMilestone(milestoneId, { title: newTitle });
      
      setOverview(prev => prev.map(p => ({
        ...p,
        priorities: p.priorities.map(pr => pr.priority_id === priorityId ? {
          ...pr,
          milestones: pr.milestones.map(m => m.milestone_id === milestoneId ? { ...m, title: newTitle } : m)
        } : pr)
      })) as PrioritiesOverviewResponse[]);
      
      setEditingMilestoneTitle(prev => ({ ...prev, [milestoneId]: '' }));
      toast.success('Milestone updated');
    } catch (e) {
      toast.error('Failed to update milestone');
    }
  };

  const handleDeletePriority = async (pillarId: string, priorityId: string) => {
    try {
      await apiDeletePriority(priorityId);
      
      setOverview(prev => prev.map(p => p.pillar_id === pillarId ? {
        ...p,
        priorities: p.priorities.filter(pr => pr.priority_id !== priorityId)
      } : p) as PrioritiesOverviewResponse[]);
      
      toast.success('Priority deleted');
    } catch (e) {
      toast.error('Failed to delete priority');
    }
  };

  const handleDeleteMilestone = async (priorityId: string, milestoneId: string) => {
    try {
      await apiDeleteMilestone(milestoneId);
      
      setOverview(prev => prev.map(p => ({
        ...p,
        priorities: p.priorities.map(pr => pr.priority_id === priorityId ? {
          ...pr,
          milestones: pr.milestones.filter(m => m.milestone_id !== milestoneId)
        } : pr)
      })) as PrioritiesOverviewResponse[]);
      
      toast.success('Milestone deleted');
    } catch (e) {
      toast.error('Failed to delete milestone');
    }
  };

  if (loading) {
    return (
      <div className={cn(tokens.layout.container)}>
        <div className="text-sm text-neutral-400">Loading priorities...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(tokens.layout.container)}>
        <div className="text-sm text-red-400">⚠️ Failed to Load Priorities {error}</div>
      </div>
    );
  }

  return (
    <div className={cn(tokens.layout.container)}>
      {/* Mobile: flex-col-reverse to show Current Priorities first, Backlog second. Desktop: grid with dynamic columns */}
      <div className={cn('flex flex-col-reverse gap-6 lg:grid', gridCols)}>
        {/* Left: Backlog (shows second on mobile, left on desktop) */}
        <section className={cn('lg:max-h-[80vh] lg:overflow-y-auto', backlogSize === 'collapsed' && 'lg:max-w-[60px]')}>
          {backlogSize === 'collapsed' ? (
            // Collapsed view: just a button to expand
            <div className="flex flex-col items-center gap-2 sticky top-0">
              <button
                className={cn(tokens.button.base, tokens.button.secondary, 'px-2 py-2')}
                onClick={() => setBacklogSize('full')}
                title="Expand Backlog"
              >
                <PanelLeftOpen className="w-5 h-5" />
              </button>
              <div className="text-xs text-neutral-400 [writing-mode:vertical-rl] rotate-180">
                Backlog ({backlogCount})
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
                  Backlog ({backlogCount})
                </h2>
                {/* Desktop only: size toggle icons */}
                <div className="hidden lg:flex items-center gap-3">
                  {backlogSize === 'full' ? (
                    <>
                      {/* Full mode: show both collapse (left) and expand (right) options */}
                      <button
                        className="text-neutral-400 hover:text-neutral-100 transition-colors cursor-pointer"
                        onClick={() => setBacklogSize('collapsed')}
                        title="Collapse to sidebar"
                      >
                        <PanelLeftClose className="w-5 h-5" />
                      </button>
                      <button
                        className="text-neutral-400 hover:text-neutral-100 transition-colors cursor-pointer"
                        onClick={() => setBacklogSize('half')}
                        title="Expand to half width"
                      >
                        <ChevronsRight className="w-5 h-5" />
                      </button>
                    </>
                  ) : (
                    /* Half mode: show button to return to full */
                    <button
                      className="text-neutral-400 hover:text-neutral-100 transition-colors cursor-pointer"
                      onClick={() => setBacklogSize('full')}
                      title="Return to 1/3 width"
                    >
                      <PanelLeftOpen className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
          {backlogSize !== 'collapsed' && (
          <div className="mt-4 space-y-4">
            {filteredOverview.map((pillar) => (
              <div key={pillar.pillar_id} className={tokens.card.base}>
                <div className={cn('w-full text-left flex items-center justify-between')}>
                  <div className="flex items-center gap-2">
                    <button
                      className="text-neutral-400 hover:text-neutral-100 transition-colors cursor-pointer"
                      onClick={() => togglePillarExpanded(pillar.pillar_id)}
                      title={expandedPillars.has(pillar.pillar_id) ? 'Collapse priorities' : 'Expand priorities'}
                    >
                      {expandedPillars.has(pillar.pillar_id) ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                    <h3 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, 'text-neutral-100')}>{pillar.pillar_name}</h3>
                  </div>
                </div>
                {expandedPillars.has(pillar.pillar_id) && (
                  <div className="mt-3 space-y-3">
                    {/* Add priority: compact */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="New priority"
                        className={cn(tokens.input.base, tokens.input.focus, 'w-full')}
                        value={newPriorityByPillar[pillar.pillar_id]?.title || ''}
                        onChange={(e) => setNewPriorityByPillar(s => ({ ...s, [pillar.pillar_id]: { title: e.target.value } }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePriority(pillar.pillar_id); }}
                        aria-label={`Add priority under ${pillar.pillar_name}`}
                      />
                      <button 
                        className={cn(
                          'transition-colors cursor-pointer',
                          !String(newPriorityByPillar[pillar.pillar_id]?.title || '').trim()
                            ? 'text-neutral-600 cursor-not-allowed'
                            : 'text-neutral-400 hover:text-neutral-100'
                        )}
                        onClick={() => handleCreatePriority(pillar.pillar_id)} 
                        disabled={!String(newPriorityByPillar[pillar.pillar_id]?.title || '').trim()} 
                        title="Add priority"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>

                    {pillar.priorities.length === 0 ? (
                      <div className="text-sm text-neutral-400">No priorities yet</div>
                    ) : (
                      sortPriorities(pillar.priorities).map((pr) => (
                        <div 
                          key={pr.priority_id} 
                          ref={(el) => { priorityRefs.current[pr.priority_id] = el; }}
                          className="rounded-2xl border border-neutral-800 p-4 bg-neutral-900"
                        >
                          {/* Priority Header */}
                          <div className="flex flex-col gap-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                {/* Left: commit toggle icon for priority */}
                                <button
                                  className={cn(
                                    'transition-colors cursor-pointer',
                                    pr.committed ? 'text-green-500 hover:text-green-400' : 'text-neutral-400 hover:text-neutral-100'
                                  )}
                                  onClick={() => handlePriorityCommitToggle(pillar.pillar_id, pr.priority_id, !pr.committed)}
                                  aria-pressed={!!pr.committed}
                                  aria-label={pr.committed ? 'Uncommit priority' : 'Commit priority'}
                                  title={pr.committed ? 'Uncommit priority' : 'Commit priority'}
                                >
                                  {pr.committed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                </button>
                                <div className="min-w-0 flex-1">
                                  <button 
                                    className={cn(
                                      tokens.typography.scale.h3, 
                                      tokens.typography.weights.semibold, 
                                      'text-neutral-100 break-words text-left hover:text-emerald-400 transition-colors cursor-pointer'
                                    )}
                                    onClick={() => {
                                      setShowRenamePriority(s => ({ ...s, [pr.priority_id]: true }));
                                      setEditingPriorityTitle(s => ({ ...s, [pr.priority_id]: pr.title }));
                                    }}
                                    title="Click to rename"
                                  >
                                    {pr.title}
                                  </button>
                                  <div className="text-xs text-neutral-400 mt-1">
                                    {pillar.pillar_name} • {pr.milestones.length} milestone{pr.milestones.length === 1 ? '' : 's'}
                                    {pr.committed && <span className="ml-2 inline-block align-middle">| <span className={cn(tokens.badge.base, tokens.badge.success, 'ml-2')}>Committed</span></span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {/* Expand/collapse button for priority */}
                                <button
                                  className="text-neutral-400 hover:text-neutral-100 transition-colors cursor-pointer"
                                  onClick={() => togglePriorityExpanded(pr.priority_id)}
                                  title={expandedPriorities.has(pr.priority_id) ? 'Collapse milestones' : 'Expand milestones'}
                                >
                                  {expandedPriorities.has(pr.priority_id) ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                </button>
                                {/* More menu */}
                                <div className="relative">
                                  <button 
                                    className="text-neutral-400 hover:text-neutral-100 transition-colors cursor-pointer"
                                    onClick={() => setShowPriorityMenu(s => ({ ...s, [pr.priority_id]: !s[pr.priority_id] }))} 
                                    title="More"
                                  >
                                    <MoreVertical className="w-5 h-5" />
                                  </button>
                                  {showPriorityMenu[pr.priority_id] && (
                                    <div className="absolute right-0 mt-2 w-44 rounded-lg border border-neutral-800 bg-neutral-900 shadow-xl z-10">
                                      <button 
                                        className="w-full text-left px-3 py-2 text-sm text-neutral-100 hover:bg-neutral-800" 
                                        onClick={() => { 
                                          setShowRenamePriority(s => ({ ...s, [pr.priority_id]: true })); 
                                          setShowPriorityMenu(s => ({ ...s, [pr.priority_id]: false })); 
                                        }}
                                      >
                                        Rename
                                      </button>
                                      <button 
                                        className="w-full text-left px-3 py-2 text-sm text-neutral-100 hover:bg-neutral-800" 
                                        onClick={() => { 
                                          setShowPriorityMenu(s => ({ ...s, [pr.priority_id]: false })); 
                                          handleDeletePriority(pillar.pillar_id, pr.priority_id); 
                                        }}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {showRenamePriority[pr.priority_id] && (
                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  type="text"
                                  className={cn(tokens.input.base, tokens.input.focus, 'w-full')}
                                  placeholder="Rename priority"
                                  value={editingPriorityTitle[pr.priority_id] || ''}
                                  onChange={(e) => setEditingPriorityTitle(s => ({ ...s, [pr.priority_id]: e.target.value }))}
                                  onKeyDown={(e) => { 
                                    if (e.key === 'Enter') { 
                                      handleUpdatePriorityTitle(pr.priority_id); 
                                      setShowRenamePriority(s => ({ ...s, [pr.priority_id]: false })); 
                                    } 
                                  }}
                                  aria-label={`Rename priority ${pr.title}`}
                                />
                                <button 
                                  className="text-neutral-400 hover:text-neutral-100 transition-colors cursor-pointer"
                                  onClick={() => { 
                                    handleUpdatePriorityTitle(pr.priority_id); 
                                    setShowRenamePriority(s => ({ ...s, [pr.priority_id]: false })); 
                                  }}
                                >
                                  <Check className="w-5 h-5" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Milestones List */}
                          {expandedPriorities.has(pr.priority_id) && (
                            <ul className="mt-3 space-y-3">
                              {sortMilestones(pr.milestones).map((m) => (
                                <li key={m.milestone_id} className="rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
                                  <div className="grid grid-cols-[auto_1fr_auto_auto] items-start gap-3">
                                    {/* Left: commit toggle (backlog behavior) */}
                                    <div>
                                      <button
                                        className={cn(
                                          'transition-colors cursor-pointer',
                                          m.completed 
                                            ? 'text-neutral-600 cursor-not-allowed opacity-50'
                                            : m.committed 
                                              ? 'text-green-500 hover:text-green-400' 
                                              : 'text-neutral-400 hover:text-neutral-100'
                                        )}
                                        onClick={() => !m.completed && handleCommitToggle(m.milestone_id, !m.committed)}
                                        disabled={m.completed}
                                        aria-pressed={!!m.committed}
                                        aria-label={m.completed ? 'Completed milestones cannot be committed' : (m.committed ? 'Uncommit milestone' : 'Commit milestone')}
                                        title={m.completed ? 'Completed milestones cannot be committed' : (m.committed ? 'Uncommit milestone' : 'Commit milestone')}
                                      >
                                        {m.committed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                      </button>
                                    </div>
                                    {/* Middle: content */}
                                    <div className="min-w-0">
                                      {showRenameMilestone[m.milestone_id] ? (
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="text"
                                            value={editingMilestoneTitle[m.milestone_id] ?? m.title}
                                            onChange={(e) => setEditingMilestoneTitle(s => ({ ...s, [m.milestone_id]: e.target.value }))}
                                            onKeyDown={(e) => { 
                                              if (e.key === 'Enter') { 
                                                handleUpdateMilestoneTitle(pr.priority_id, m.milestone_id); 
                                                setShowRenameMilestone(s => ({ ...s, [m.milestone_id]: false })); 
                                              } 
                                            }}
                                            className={cn(tokens.input.base, tokens.input.focus, 'w-full')}
                                            aria-label={`Rename milestone ${m.title}`}
                                          />
                                          <button 
                                            className="text-neutral-400 hover:text-neutral-100 transition-colors cursor-pointer"
                                            onClick={() => { 
                                              handleUpdateMilestoneTitle(pr.priority_id, m.milestone_id); 
                                              setShowRenameMilestone(s => ({ ...s, [m.milestone_id]: false })); 
                                            }}
                                          >
                                            <Check className="w-5 h-5" />
                                          </button>
                                        </div>
                                      ) : (
                                        <>
                                          <button
                                            className={cn(
                                              'text-sm text-neutral-100 break-words text-left hover:text-emerald-400 transition-colors cursor-pointer',
                                              m.completed && 'line-through text-neutral-400 hover:text-neutral-300'
                                            )}
                                            onClick={() => {
                                              setShowRenameMilestone(s => ({ ...s, [m.milestone_id]: true }));
                                              setEditingMilestoneTitle(s => ({ ...s, [m.milestone_id]: m.title }));
                                            }}
                                            title="Click to rename"
                                          >
                                            {m.title}
                                          </button>
                                      {(m.definition_of_done || m.due_date) && (
                                            <div className="mt-1 text-xs text-neutral-400">
                                              {m.definition_of_done && <span>DoD: {m.definition_of_done}</span>}
                                              {m.definition_of_done && m.due_date && <span className="mx-2">•</span>}
                                              {m.due_date && <span>Due: {m.due_date}</span>}
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                    {/* Right: complete as check icon */}
                                    <div>
                                      <button
                                        className="text-green-500 hover:text-green-400 transition-colors cursor-pointer"
                                        title={m.completed ? 'Undo complete' : 'Complete'}
                                        onClick={() => handleCompleteToggle(m.milestone_id, !m.completed)}
                                      >
                                        <Check className="w-5 h-5" />
                                      </button>
                                    </div>
                                    {/* More menu */}
                                    <div className="relative">
                                      <button 
                                        className="text-neutral-400 hover:text-neutral-100 transition-colors cursor-pointer"
                                        onClick={() => setShowMilestoneMenu(s => ({ ...s, [m.milestone_id]: !s[m.milestone_id] }))} 
                                        title="More"
                                      >
                                        <MoreVertical className="w-5 h-5" />
                                      </button>
                                      {showMilestoneMenu[m.milestone_id] && (
                                        <div className="absolute right-0 mt-2 w-40 rounded-lg border border-neutral-800 bg-neutral-900 shadow-xl z-10">
                                          <button 
                                            className="w-full text-left px-3 py-2 text-sm text-neutral-100 hover:bg-neutral-800" 
                                            onClick={() => { 
                                              setShowRenameMilestone(s => ({ ...s, [m.milestone_id]: true })); 
                                              setShowMilestoneMenu(s => ({ ...s, [m.milestone_id]: false })); 
                                            }}
                                          >
                                            Rename
                                          </button>
                                          <button 
                                            className="w-full text-left px-3 py-2 text-sm text-neutral-100 hover:bg-neutral-800" 
                                            onClick={() => { 
                                              setShowMilestoneMenu(s => ({ ...s, [m.milestone_id]: false })); 
                                              handleDeleteMilestone(pr.priority_id, m.milestone_id); 
                                            }}
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </li>
                              ))}
                              {/* Add milestone: compact */}
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="+ New milestone"
                                  className={cn(tokens.input.base, tokens.input.focus, 'w-full')}
                                  value={newMilestoneByPriority[pr.priority_id]?.title || ''}
                                  onChange={(e) => setNewMilestoneByPriority(s => ({ ...s, [pr.priority_id]: { title: e.target.value } }))}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateMilestone(pr.priority_id); }}
                                  aria-label={`Add milestone under ${pr.title}`}
                                />
                                <button 
                                  className={cn(
                                    'transition-colors cursor-pointer',
                                    !String(newMilestoneByPriority[pr.priority_id]?.title || '').trim()
                                      ? 'text-neutral-600 cursor-not-allowed'
                                      : 'text-neutral-400 hover:text-neutral-100'
                                  )}
                                  onClick={() => handleCreateMilestone(pr.priority_id)} 
                                  disabled={!String(newMilestoneByPriority[pr.priority_id]?.title || '').trim()} 
                                  title="Add milestone"
                                >
                                  <Plus className="w-5 h-5" />
                                </button>
                              </div>
                            </ul>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          )}
        </section>

        {/* Right: Active Focus (committed priorities with their committed milestones) */}
        <section className="lg:max-h-[80vh] lg:overflow-y-auto">
          <div className="flex items-center justify-between gap-4">
            <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
              Current Priorities
            </h2>
            {filteredActiveFocus.length > 0 && (
              <button
                className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors cursor-pointer"
                onClick={toggleAllCurrentPriorities}
              >
                {filteredActiveFocus.every(r => expandedCurrentPriorities.has(r.priority_id)) ? 'Collapse All' : 'Expand All'}
              </button>
            )}
          </div>
          <div className="mt-4 space-y-4">
            {afLoading ? (
              <div className="text-sm text-neutral-400">Loading…</div>
            ) : afError ? (
              <div className="text-sm text-red-400">{afError}</div>
            ) : filteredActiveFocus.length === 0 ? (
              <div className="text-sm text-neutral-400">No committed priorities</div>
            ) : (
              (() => {
                // Group by pillar
                const groupedByPillar = filteredActiveFocus.reduce((acc, group) => {
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

                // Maintain the same pillar order as the backlog (overview)
                return filteredOverview
                  .filter(pillar => groupedByPillar[pillar.pillar_id]) // Only show pillars that have committed priorities
                  .map((pillar) => {
                    const pillarData = groupedByPillar[pillar.pillar_id];
                    return (
                  <div key={pillar.pillar_id} className={tokens.card.base}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl" aria-hidden>{pillar.emoji || '🗂️'}</span>
                      <h3 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, 'text-neutral-100')}>{pillar.pillar_name}</h3>
                    </div>
                    <div className="mt-3 space-y-3">
                      {pillarData.priorities.map((group) => (
                        <div key={group.priority_id} className="rounded-2xl border border-neutral-800 p-3 bg-neutral-900">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <button
                                className="text-neutral-400 hover:text-neutral-100 transition-colors cursor-pointer flex-shrink-0"
                                onClick={() => handlePriorityCommitToggle(group.pillar_id, group.priority_id, false)}
                                title="Uncommit Priority"
                              >
                                <X className="w-5 h-5" />
                              </button>
                              <div className="min-w-0">
                                <button
                                  className="text-neutral-100 font-medium break-words text-left hover:text-green-400 transition-colors"
                                  onClick={() => scrollToPriorityInBacklog(group.priority_id)}
                                  title="Jump to this priority in Backlog"
                                >
                                  {group.priority_title}
                                </button>
                              </div>
                            </div>
                            <button
                              className="text-neutral-400 hover:text-neutral-100 transition-colors cursor-pointer flex-shrink-0"
                              onClick={() => toggleCurrentPriorityExpanded(group.priority_id)}
                              title={expandedCurrentPriorities.has(group.priority_id) ? 'Collapse milestones' : 'Expand milestones'}
                            >
                              {expandedCurrentPriorities.has(group.priority_id) ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                            </button>
                          </div>
                          {expandedCurrentPriorities.has(group.priority_id) && (
                            group.milestones.length === 0 ? (
                              <div className="mt-2 text-xs text-neutral-400">No committed milestones</div>
                            ) : (
                              <ul className="mt-3 pt-3 border-t border-neutral-800 space-y-2">
                                {group.milestones.filter(m => !m.completed).map(m => (
                                  <li key={m.milestone_id} className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <button 
                                        className="text-neutral-400 hover:text-neutral-100 transition-colors cursor-pointer flex-shrink-0"
                                        onClick={() => handleCommitToggle(m.milestone_id, !m.committed)} 
                                        title="Uncommit milestone"
                                      >
                                        <X className="w-5 h-5" />
                                      </button>
                                      <div className={cn("min-w-0 text-neutral-100 break-words", m.completed && "line-through opacity-60")}>{m.title}</div>
                                    </div>
                                    <button 
                                      className="text-green-500 hover:text-green-400 transition-colors cursor-pointer flex-shrink-0"
                                      onClick={() => handleCompleteToggle(m.milestone_id, !m.completed)} 
                                      title={m.completed ? 'Undo complete' : 'Complete milestone'}
                                    >
                                      {m.completed ? <X className="w-5 h-5" /> : <Check className="w-5 h-5" />}
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
                    );
                  });
              })()
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default PrioritiesTab;