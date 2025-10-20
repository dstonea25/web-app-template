import React, { useMemo, useState } from 'react';
import { Plus, MoreVertical, Check, X, Square, CheckSquare, ChevronDown, ChevronRight } from 'lucide-react';
import { tokens, cn } from '../theme/config';
import type { PrioritiesOverviewResponse, PriorityRecord, MilestoneRecord, ActiveFocusRow } from '../types';
import { toast } from '../lib/notifications/toast';
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
  
  // State for expanded/collapsed items
  const [expandedPillars, setExpandedPillars] = useState<Set<string>>(new Set());
  const [expandedPriorities, setExpandedPriorities] = useState<Set<string>>(new Set());
  

  const loadActiveFocus = async () => {
    try {
      setAfLoading(true);
      setAfError(null);
      const rows = await refreshActiveFocus();
      setActiveFocus(rows);
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

  // Milestones are terminal nodes; no expand/collapse at this level

  React.useEffect(() => { 
    loadActiveFocus(); 
    const handleAF = () => loadActiveFocus();
    window.addEventListener('dashboard:active-focus-refresh', handleAF);
    return () => window.removeEventListener('dashboard:active-focus-refresh', handleAF);
  }, []);

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

  const backlogCount = useMemo(() => {
    return overview.reduce((total, pillar) => total + pillar.priorities.length, 0);
  }, [overview]);

  const handleCommitToggle = async (milestoneId: string, nextVal: boolean) => {
    // Capture previous state
    const prevOverview = JSON.parse(JSON.stringify(overview)) as PrioritiesOverviewResponse[];
    const prevActiveFocus = JSON.parse(JSON.stringify(activeFocus)) as ActiveFocusRow[];

    // Optimistic UI
    setOverview(prev => prev.map(p => ({
      ...p,
      priorities: p.priorities.map(pr => ({
        ...pr,
        milestones: pr.milestones.map(m => m.milestone_id === milestoneId ? { ...m, committed: nextVal } : m)
      }))
    })) as PrioritiesOverviewResponse[]);
    // Right pane will revalidate from get_active_focus

    try {
      await toggleCommit(milestoneId);
      await loadActiveFocus();
      // Also refresh the overview to get latest committed states
      window.dispatchEvent(new CustomEvent('dashboard:priorities-refresh'));
    } catch (e) {
      // Rollback
      setOverview(prevOverview);
      setActiveFocus(prevActiveFocus);
      toast.error(`Failed to update committed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const handleCompleteToggle = async (milestoneId: string, nextVal: boolean) => {
    const prev = JSON.parse(JSON.stringify(overview)) as PrioritiesOverviewResponse[];
    // Optimistic: mark completed, and if completing, also decommit
    setOverview(list => list.map(p => ({
      ...p,
      priorities: p.priorities.map(pr => ({
        ...pr,
        milestones: pr.milestones.map(m => m.milestone_id === milestoneId 
          ? { ...m, completed: nextVal, committed: nextVal ? false : m.committed } 
          : m)
      }))
    })) as PrioritiesOverviewResponse[]);
    try {
      await toggleComplete(milestoneId);
      if (nextVal === true) {
        // If completed, also decommit so it disappears from Current Priorities
        await toggleCommit(milestoneId);
        await loadActiveFocus();
        window.dispatchEvent(new CustomEvent('dashboard:priorities-refresh'));
      }
    } catch (e) {
      setOverview(prev);
      toast.error(`Failed to update completed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const handlePriorityCommitToggle = async (pillarId: string, priorityId: string, nextVal: boolean) => {
    const prev = JSON.parse(JSON.stringify(overview)) as PrioritiesOverviewResponse[];
    setOverview(list => list.map(p => p.pillar_id === pillarId ? {
      ...p,
      priorities: p.priorities.map(pr => pr.priority_id === priorityId ? { ...pr, committed: nextVal } : pr)
    } : p) as PrioritiesOverviewResponse[]);
    try {
      await togglePriorityCommit(priorityId);
      await loadActiveFocus();
      // Also refresh the overview to get latest committed states
      window.dispatchEvent(new CustomEvent('dashboard:priorities-refresh'));
    } catch (e) {
      setOverview(prev);
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
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-6">
        {/* Left: Backlog */}
        <section className="lg:max-h-[80vh] lg:overflow-y-auto">
          <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
            Backlog ({backlogCount})
          </h2>
          <div className="mt-4 space-y-4">
            {overview.map((pillar) => (
              <div key={pillar.pillar_id} className={tokens.card.base}>
                <div className={cn('w-full text-left flex items-center justify-between')}>
                  <div className="flex items-center gap-2">
                    <button
                      className={cn(tokens.button.base, tokens.button.secondary, 'px-2 py-1')}
                      onClick={() => togglePillarExpanded(pillar.pillar_id)}
                      title={expandedPillars.has(pillar.pillar_id) ? 'Collapse priorities' : 'Expand priorities'}
                    >
                      {expandedPillars.has(pillar.pillar_id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <span className="text-xl" aria-hidden>{pillar.emoji || '🗂️'}</span>
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
                        className={cn(tokens.button.base, tokens.button.primary, 'min-w-[36px] p-0 w-9 h-9 flex items-center justify-center')} 
                        onClick={() => handleCreatePriority(pillar.pillar_id)} 
                        disabled={!String(newPriorityByPillar[pillar.pillar_id]?.title || '').trim()} 
                        title="Add priority"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {pillar.priorities.length === 0 ? (
                      <div className="text-sm text-neutral-400">No priorities yet</div>
                    ) : (
                      pillar.priorities.map((pr) => (
                        <div key={pr.priority_id} className="rounded-2xl border border-neutral-800 p-4 bg-neutral-900">
                          {/* Priority Header */}
                          <div className="flex flex-col gap-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                {/* Left: commit toggle icon for priority */}
                                <button
                                  className={cn(tokens.button.base, pr.committed ? tokens.button.success : tokens.button.secondary, 'px-2 py-1')}
                                  onClick={() => handlePriorityCommitToggle(pillar.pillar_id, pr.priority_id, !pr.committed)}
                                  aria-pressed={!!pr.committed}
                                  aria-label={pr.committed ? 'Uncommit priority' : 'Commit priority'}
                                  title={pr.committed ? 'Uncommit priority' : 'Commit priority'}
                                >
                                  {pr.committed ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                </button>
                                <div className="min-w-0">
                                  <div className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, 'text-neutral-100 break-words')}>{pr.title}</div>
                                  <div className="text-xs text-neutral-400 mt-1">
                                    {pillar.pillar_name} • {pr.milestones.length} milestone{pr.milestones.length === 1 ? '' : 's'}
                                    {pr.committed && <span className="ml-2 inline-block align-middle">| <span className={cn(tokens.badge.base, tokens.badge.success, 'ml-2')}>Committed</span></span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {/* Expand/collapse button for priority */}
                                <button
                                  className={cn(tokens.button.base, tokens.button.secondary, 'px-2 py-1')}
                                  onClick={() => togglePriorityExpanded(pr.priority_id)}
                                  title={expandedPriorities.has(pr.priority_id) ? 'Collapse milestones' : 'Expand milestones'}
                                >
                                  {expandedPriorities.has(pr.priority_id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                {/* More menu */}
                                <div className="relative">
                                  <button 
                                    className={cn(tokens.button.base, tokens.button.secondary, 'px-2 py-1')} 
                                    onClick={() => setShowPriorityMenu(s => ({ ...s, [pr.priority_id]: !s[pr.priority_id] }))} 
                                    title="More"
                                  >
                                    <MoreVertical className="w-4 h-4" />
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
                                  className={cn(tokens.button.base, tokens.button.primary)} 
                                  onClick={() => { 
                                    handleUpdatePriorityTitle(pr.priority_id); 
                                    setShowRenamePriority(s => ({ ...s, [pr.priority_id]: false })); 
                                  }}
                                >
                                  Save
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Milestones List */}
                          {expandedPriorities.has(pr.priority_id) && (
                            <ul className="mt-3 space-y-3">
                              {pr.milestones.map((m) => (
                                <li key={m.milestone_id} className="rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
                                  <div className="grid grid-cols-[auto_1fr_auto_auto] items-start gap-3">
                                    {/* Left: commit toggle (backlog behavior) */}
                                    <div>
                                      <button
                                        className={cn(tokens.button.base, m.committed ? tokens.button.success : tokens.button.secondary, 'px-2 py-1')}
                                        onClick={() => handleCommitToggle(m.milestone_id, !m.committed)}
                                        aria-pressed={!!m.committed}
                                        aria-label={m.committed ? 'Uncommit milestone' : 'Commit milestone'}
                                        title={m.committed ? 'Uncommit milestone' : 'Commit milestone'}
                                      >
                                        {m.committed ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
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
                                            className={cn(tokens.button.base, tokens.button.primary, 'px-2 py-1 text-xs')} 
                                            onClick={() => { 
                                              handleUpdateMilestoneTitle(pr.priority_id, m.milestone_id); 
                                              setShowRenameMilestone(s => ({ ...s, [m.milestone_id]: false })); 
                                            }}
                                          >
                                            Save
                                          </button>
                                        </div>
                                      ) : (
                                        <>
                                          <div className={cn('text-sm text-neutral-100 break-words', m.completed && 'line-through text-neutral-400')}>{m.title}</div>
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
                                        className={cn(tokens.button.base, tokens.button.success, 'px-2 py-1')}
                                        title={m.completed ? 'Undo complete' : 'Complete'}
                                        onClick={() => handleCompleteToggle(m.milestone_id, !m.completed)}
                                      >
                                        <Check className="w-4 h-4" />
                                      </button>
                                    </div>
                                    {/* More menu */}
                                    <div className="relative">
                                      <button 
                                        className={cn(tokens.button.base, tokens.button.secondary, 'px-2 py-1')} 
                                        onClick={() => setShowMilestoneMenu(s => ({ ...s, [m.milestone_id]: !s[m.milestone_id] }))} 
                                        title="More"
                                      >
                                        <MoreVertical className="w-4 h-4" />
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
                                  className={cn(tokens.button.base, tokens.button.primary, 'min-w-[36px] p-0 w-9 h-9 flex items-center justify-center')} 
                                  onClick={() => handleCreateMilestone(pr.priority_id)} 
                                  disabled={!String(newMilestoneByPriority[pr.priority_id]?.title || '').trim()} 
                                  title="Add milestone"
                                >
                                  <Plus className="w-4 h-4" />
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
        </section>

        {/* Right: Active Focus (committed priorities with their committed milestones) */}
        <section className="lg:max-h-[80vh] lg:overflow-y-auto">
          <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
            Current Priorities
          </h2>
          <div className="mt-4 space-y-4">
            {afLoading ? (
              <div className="text-sm text-neutral-400">Loading…</div>
            ) : afError ? (
              <div className="text-sm text-red-400">{afError}</div>
            ) : activeFocus.length === 0 ? (
              <div className="text-sm text-neutral-400">No committed priorities</div>
            ) : (
              (() => {
                // Group by pillar
                const groupedByPillar = activeFocus.reduce((acc, group) => {
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

                return Object.entries(groupedByPillar).map(([pillarId, pillarData]) => (
                  <div key={pillarId} className={tokens.card.base}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl" aria-hidden>{pillarData.emoji || '🗂️'}</span>
                      <h3 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, 'text-neutral-100')}>{pillarData.pillar_name}</h3>
                    </div>
                    <div className="mt-3 space-y-3">
                      {pillarData.priorities.map((group) => (
                        <div key={group.priority_id} className="rounded-2xl border border-neutral-800 p-3 bg-neutral-900">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <div className="text-neutral-100 font-medium break-words">{group.priority_title}</div>
                            </div>
                            <button
                              className={cn(tokens.button.base, tokens.button.secondary, 'px-2 py-1')}
                              onClick={() => handlePriorityCommitToggle(group.pillar_id, group.priority_id, false)}
                              title="Uncommit Priority"
                            >
                              <CheckSquare className="w-4 h-4" />
                            </button>
                          </div>
                          {group.milestones.length === 0 ? (
                            <div className="mt-2 text-xs text-neutral-400">No committed milestones</div>
                          ) : (
                            <ul className="mt-3 pt-3 border-t border-neutral-800 space-y-2">
                              {group.milestones.filter(m => !m.completed).map(m => (
                                <li key={m.milestone_id} className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                                  <div className={cn("min-w-0 text-neutral-100 break-words", m.completed && "line-through opacity-60")}>{m.title}</div>
                                  <div className="flex items-center gap-2">
                                    <button 
                                      className={cn(tokens.button.base, tokens.button.success, 'px-2 py-1 text-xs')} 
                                      onClick={() => handleCompleteToggle(m.milestone_id, !m.completed)} 
                                      title={m.completed ? 'Undo complete' : 'Complete milestone'}
                                    >
                                      {m.completed ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                                    </button>
                                    {/* Commitment toggle disabled for completed milestones */}
                                    <button 
                                      className={cn(tokens.button.base, m.committed ? tokens.button.secondary : tokens.button.success, 'px-2 py-1 text-xs', 'disabled:opacity-50 disabled:cursor-not-allowed')} 
                                      onClick={() => handleCommitToggle(m.milestone_id, !m.committed)} 
                                      title={m.completed ? 'Completed milestones cannot be committed' : (m.committed ? 'Uncommit milestone' : 'Commit milestone')}
                                      disabled={m.completed}
                                    >
                                      {m.committed ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default PrioritiesTab;