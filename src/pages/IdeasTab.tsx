import React, { useState, useEffect, useRef } from 'react';
import type { Idea, IdeaPatch } from '../types';
import { tokens, cn } from '../theme/config';
import { IdeasTable } from '../components/IdeasTable';
import { IdeasCategoryTabs } from '../components/IdeasCategoryTabs';
import { StorageManager, stageIdeaEdit, stageIdeaComplete, getStagedIdeaChanges, clearStagedIdeaChanges, getCachedData, setCachedData, applyStagedChangesToIdeas } from '../lib/storage';
import { addIdea as storageAddIdea } from '../lib/storage';
import { fetchIdeasFromWebhook, saveIdeasBatchToWebhook } from '../lib/api';
import { toast } from '../lib/notifications/toast';

export const IdeasTab: React.FC<{ isVisible?: boolean }> = ({ isVisible = true }) => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<keyof Idea | ''>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [newIdea, setNewIdea] = useState<Partial<Idea>>({ idea: '', category: '', notes: '' });
  const [stagedCount, setStagedCount] = useState<number>(0);
  const commitTimerRef = useRef<number | null>(null);
  const UNDO_WINDOW_MS = 2500;
  const prevEditRef = useRef<Idea | null>(null);
  const hasLoadedRef = useRef(false);

  // Load initial data when tab mounts (only happens when tab is active)
  useEffect(() => {
    if (!isVisible || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadIdeas();
  }, [isVisible]);

  // Auto-commit staged changes after a short undo window
  const scheduleCommit = () => {
    if (commitTimerRef.current) {
      window.clearTimeout(commitTimerRef.current);
    }
    commitTimerRef.current = window.setTimeout(async () => {
      try {
        const staged = getStagedIdeaChanges();
        if ((staged.updates.length + staged.completes.length) === 0) return;
        await saveIdeasBatchToWebhook(staged.updates, staged.completes);
        const fresh = await fetchIdeasFromWebhook();
        StorageManager.saveIdeas(fresh);
        const transformed = StorageManager.loadIdeas();
        setIdeas(transformed);
        setCachedData('ideas-cache', fresh);
        clearStagedIdeaChanges();
        setStagedCount(0);
      } catch (err) {
        console.error('Auto-save (ideas) failed:', err);
        toast.error('Auto-save failed');
      }
    }, UNDO_WINDOW_MS);
  };

  const loadIdeas = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if refresh was explicitly requested via URL parameter or hard refresh
      const urlParams = new URLSearchParams(window.location.search);
      const forceRefresh = urlParams.get('refresh') === 'true' || 
                          (window.performance.getEntriesByType('navigation')[0] as any)?.type === 'reload';
      
      if (forceRefresh) {
        console.log('🔄 Force refresh requested via URL parameter');
        // Remove the refresh parameter from URL without reloading
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('refresh');
        window.history.replaceState({}, '', newUrl.toString());
      }
      
      const cachedIdeas = getCachedData<Idea[]>('ideas-cache');
      
      // Always check cache first - only bypass if explicitly refreshing
      console.log('🔍 Debug: cachedIdeas length:', cachedIdeas?.length || 0);
      console.log('🔍 Debug: forceRefresh:', forceRefresh);
      
      if (cachedIdeas && !forceRefresh) {
        console.log('📦 Loading ideas from cache');
        console.log('🔍 Debug: cached ideas:', cachedIdeas);
        
        // Apply staged changes to cached data directly
        const workingIdeas = applyStagedChangesToIdeas(cachedIdeas);
        console.log('🔍 Debug: working ideas after staged changes:', workingIdeas);
        setIdeas(workingIdeas);
        
        const staged = getStagedIdeaChanges();
        console.log('🔍 Debug: staged changes:', staged);
        
        setStagedCount(staged.fieldChangeCount);
        setLoading(false);
        return;
      }
      
      if (forceRefresh) {
        console.log('🔄 Force refresh requested - clearing cache and loading fresh data');
      }
      
      // Do not clear all storage; preserve other tabs' data
      
      // Load from backend
      console.log('🌐 Loading ideas...');
      const webhookIdeas = await fetchIdeasFromWebhook();
      console.log('✅ Ideas loaded:', webhookIdeas);
      console.log('🔍 Debug: ideas length:', webhookIdeas?.length || 0);
      
      // Cache the data
      setCachedData('ideas-cache', webhookIdeas);
      
      // Ensure transforms on load by saving then reloading
      StorageManager.saveIdeas(webhookIdeas);
      
      // Apply staged changes to the backend data directly
      const workingIdeas = applyStagedChangesToIdeas(webhookIdeas);
      console.log('🔍 Debug: working ideas after staged changes:', workingIdeas);
      setIdeas(workingIdeas);
      
      const staged = getStagedIdeaChanges();
      console.log('🔍 Debug: staged changes:', staged);
      setStagedCount(staged.fieldChangeCount);
    } catch (error) {
      console.error('Failed to load ideas:', error);
      setError(error instanceof Error ? error.message : 'Failed to load ideas');
      setIdeas([]); // Clear ideas on error
      // Clear cache on error to prevent stale data
      setCachedData('ideas-cache', null);
    } finally {
      setLoading(false);
    }
  };

  // Remove explicit save flow; commits happen automatically via scheduleCommit

  const addIdea = () => {
    if (!newIdea.idea?.trim()) return;
    const updatedIdeas = storageAddIdea(ideas, {
      idea: newIdea.idea!,
      category: (newIdea.category as string) || null,
      notes: newIdea.notes || '',
    });
    setIdeas(updatedIdeas);
    
    // Stage the new idea for saving (get the last added idea)
    const newIdeaItem = updatedIdeas[updatedIdeas.length - 1];
    if (newIdeaItem) {
      stageIdeaEdit({ id: newIdeaItem.id || '', patch: { id: newIdeaItem.id || '', idea: newIdeaItem.idea, category: newIdeaItem.category, notes: newIdeaItem.notes, status: newIdeaItem.status, _isNew: true } });
      const staged = getStagedIdeaChanges();
      setStagedCount(staged.fieldChangeCount);
      scheduleCommit();
    }
    
    setNewIdea({ idea: '', category: '', notes: '' });
  };

  const updateIdea = (id: string, updates: Partial<Idea>) => {
    const prev = ideas.find(i => i.id === id);
    setIdeas(is => is.map(i => (i.id === id ? { ...i, ...updates } : i)));
    // If editing free-text idea/notes, defer actual stage until commit end
    if (Object.prototype.hasOwnProperty.call(updates, 'idea') || Object.prototype.hasOwnProperty.call(updates, 'notes')) {
      return;
    }
    stageIdeaEdit({ id, patch: { id, ...updates } as IdeaPatch });
    const staged = getStagedIdeaChanges();
    setStagedCount(staged.fieldChangeCount);
    toast.info('Updated idea', {
      ttlMs: UNDO_WINDOW_MS,
      actionLabel: 'Undo',
      onAction: () => {
        if (!prev) return;
        setIdeas(ts => ts.map(t => (t.id === id ? { ...t, ...prev } : t)));
        stageIdeaEdit({ id, patch: { id, idea: prev.idea, category: prev.category ?? null, notes: prev.notes, status: prev.status } as IdeaPatch });
        const s = getStagedIdeaChanges();
        setStagedCount(s.fieldChangeCount);
      }
    });
    scheduleCommit();
  };

  const commitRowEdit = (id: string, patch: IdeaPatch) => {
    // Stage and schedule auto-commit once editing finishes
    stageIdeaEdit({ id, patch });
    const staged = getStagedIdeaChanges();
    setStagedCount(staged.fieldChangeCount);
    const prev = prevEditRef.current;
    toast.info('Updated idea', {
      ttlMs: UNDO_WINDOW_MS,
      actionLabel: 'Undo',
      onAction: () => {
        if (!prev) return;
        setIdeas(ts => ts.map(t => (t.id === id ? { ...t, ...prev } : t)));
        stageIdeaEdit({ id, patch: { id, idea: prev.idea, category: prev.category ?? null, notes: prev.notes, status: prev.status } as IdeaPatch });
        const s = getStagedIdeaChanges();
        setStagedCount(s.fieldChangeCount);
      }
    });
    scheduleCommit();
    setEditingId(null);
  };

  const removeIdea = (id: string) => {
    const removed = ideas.find(i => String(i.id) === String(id));
    stageIdeaComplete({ id });
    const staged = getStagedIdeaChanges();
    setStagedCount(staged.fieldChangeCount);
    setIdeas(prev => prev.filter(i => String(i.id) !== String(id)));
    toast.info('Removed idea', {
      ttlMs: UNDO_WINDOW_MS,
      actionLabel: 'Undo',
      onAction: () => {
        // Unstage completion by staging a no-op edit
        stageIdeaEdit({ id, patch: { id } as IdeaPatch });
        if (removed) setIdeas(prev => [...prev, removed].sort((a, b) => (a.id! < b.id! ? -1 : 1)));
        const s = getStagedIdeaChanges();
        setStagedCount(s.fieldChangeCount);
      }
    });
    scheduleCommit();
  };

  const handleEditStart = (id: string) => {
    setEditingId(id);
    const snapshot = ideas.find(t => t.id === id) || null;
    prevEditRef.current = snapshot ? { ...snapshot } : null;
  };

  const handleEditEnd = () => {
    setEditingId(null);
  };

  if (loading && isVisible) {
    return (
      <div className={tokens.layout.container}>
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <div className={tokens.palette.dark.text_muted}>Loading ideas...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error && isVisible) {
    return (
      <div className={tokens.layout.container}>
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h3 className="text-lg font-semibold mb-2">Failed to Load Ideas</h3>
              <p className="text-sm text-gray-600 mb-4">{error}</p>
              <button
                onClick={loadIdeas}
                className={cn(tokens.button.base, tokens.button.primary)}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Filter ideas by active category
  const filteredIdeas = activeCategory === 'All' 
    ? ideas 
    : ideas.filter(idea => idea.category === activeCategory);

  return (
    <div className={cn(tokens.layout.container, !isVisible && 'hidden')}>
      {/* Removed top manual add; inline add exists in filtered category views */}

      {/* Main ideas section */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
            Ideas ({filteredIdeas.length})
          </h2>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="mb-4">
        <IdeasCategoryTabs
          ideas={ideas}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />
      </div>

      {/* Inline quick add when filtered by a specific category (mirrors Todos) */}
      {activeCategory !== 'All' && (
        <div className="mb-4">
          <div className={cn(tokens.card.base, 'p-3')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 items-center w-full">
              <input
                type="text"
                placeholder={`Add to ${activeCategory}...`}
                value={(newIdea.idea as string) || ''}
                onChange={(e) => setNewIdea({ ...newIdea, idea: e.target.value, category: activeCategory })}
                onKeyDown={(e) => { if (e.key === 'Enter') addIdea(); }}
                className={cn(tokens.input.base, tokens.input.focus, 'w-full sm:col-span-2 lg:col-span-7')}
              />
              <input
                type="text"
                placeholder="Notes (optional)"
                value={(newIdea.notes as string) || ''}
                onChange={(e) => setNewIdea({ ...newIdea, notes: e.target.value, category: activeCategory })}
                onKeyDown={(e) => { if (e.key === 'Enter') addIdea(); }}
                className={cn(tokens.input.base, tokens.input.focus, 'w-full lg:col-span-4')}
              />
              <div className="sm:col-span-2 lg:col-span-1 flex justify-end">
                <button
                  onClick={addIdea}
                  className={cn(tokens.button.base, tokens.button.primary, 'w-full sm:w-auto')}
                  disabled={!String(newIdea.idea || '').trim()}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ideas table */}
      <IdeasTable
        ideas={filteredIdeas}
        filter={filter}
        sortBy={sortBy}
        sortOrder={sortOrder}
        editingId={editingId}
        onFilterChange={setFilter}
        onSortChange={setSortBy}
        onSortOrderChange={setSortOrder}
        onEditStart={handleEditStart}
        onEditEnd={handleEditEnd}
        onIdeaUpdate={updateIdea}
        onIdeaComplete={removeIdea}
        onCommitRowEdit={commitRowEdit}
      />
    </div>
  );
};