import React, { useState, useEffect } from 'react';
import type { Idea, IdeaPatch } from '../types';
import { tokens, cn } from '../theme/config';
import { IdeasTable } from '../components/IdeasTable';
import { IdeasCategoryTabs } from '../components/IdeasCategoryTabs';
import { StorageManager, stageIdeaEdit, stageIdeaComplete, getStagedIdeaChanges, clearStagedIdeaChanges, getCachedData, setCachedData, applyStagedChangesToIdeas } from '../lib/storage';
import { applyIdeaFileSave, getWorkingIdeas } from '../lib/storage';
import { addIdea as storageAddIdea } from '../lib/storage';
import { fetchIdeasFromWebhook, saveIdeasToWebhook } from '../lib/api';

export const IdeasTab: React.FC = () => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<keyof Idea | ''>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [newIdea, setNewIdea] = useState<Partial<Idea>>({ 
    idea: '', 
    category: '', 
    notes: '' 
  });
  const [stagedCount, setStagedCount] = useState<number>(0);

  // Load initial data only on first mount
  useEffect(() => {
    loadIdeas();
  }, []); // Empty dependency array - only run once

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
        
        // TEMPORARY FIX: Clear staged completes to show all ideas
        if (staged.completes.length > 0) {
          console.log('🔧 TEMP FIX: Clearing staged completes to show ideas');
          clearStagedIdeaChanges();
          // Reapply staged changes without the completes
          const workingIdeas = applyStagedChangesToIdeas(cachedIdeas);
          setIdeas(workingIdeas);
        }
        
        setStagedCount(staged.fieldChangeCount);
        setLoading(false);
        return;
      }
      
      if (forceRefresh) {
        console.log('🔄 Force refresh requested - clearing cache and loading fresh data');
      }
      
      // Clear localStorage to force fresh data load
      StorageManager.clearAll();
      
      // Load from webhook
      console.log('🌐 Loading ideas from webhook...');
      const webhookIdeas = await fetchIdeasFromWebhook();
      console.log('✅ Webhook ideas loaded:', webhookIdeas);
      console.log('🔍 Debug: webhook ideas length:', webhookIdeas?.length || 0);
      
      // Cache the data
      setCachedData('ideas-cache', webhookIdeas);
      
      // Ensure transforms on load by saving then reloading
      StorageManager.saveIdeas(webhookIdeas);
      
      // Apply staged changes to the webhook data directly
      const workingIdeas = applyStagedChangesToIdeas(webhookIdeas);
      console.log('🔍 Debug: working ideas from webhook after staged changes:', workingIdeas);
      setIdeas(workingIdeas);
      
      const staged = getStagedIdeaChanges();
      console.log('🔍 Debug: staged changes from webhook:', staged);
      setStagedCount(staged.fieldChangeCount);
    } catch (error) {
      console.error('Failed to load ideas from webhook:', error);
      setError(error instanceof Error ? error.message : 'Failed to load ideas from webhook');
      setIdeas([]); // Clear ideas on error
      // Clear cache on error to prevent stale data
      setCachedData('ideas-cache', null);
    } finally {
      setLoading(false);
    }
  };

  const saveBatch = async () => {
    try {
      setLoading(true);
      
      // Apply staged changes to get the final state
      const result = await applyIdeaFileSave();
      if (!result.ok) {
        throw new Error('Failed to apply staged changes');
      }
      
      // Get the updated ideas after applying changes
      const updatedIdeas = getWorkingIdeas();
      
      // Save to n8n webhook
      await saveIdeasToWebhook(updatedIdeas);
      
      // Refresh data from webhook to get the latest state
      console.log('🔄 Refreshing data from webhook after save...');
      const freshIdeas = await fetchIdeasFromWebhook();
      
      // Update local state with fresh data
      StorageManager.saveIdeas(freshIdeas);
      const transformed = StorageManager.loadIdeas();
      setIdeas(transformed);
      
      // Update cache with fresh data
      setCachedData('ideas-cache', freshIdeas);
      
      // Clear staged changes
      setStagedCount(0);
      
      console.log('✅ Save completed successfully');
    } catch (error) {
      console.error('Failed to save:', error);
      alert(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

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
      stageIdeaEdit({ 
        id: newIdeaItem.id || '', 
        patch: { 
          id: newIdeaItem.id || '', 
          idea: newIdeaItem.idea, 
          category: newIdeaItem.category, 
          notes: newIdeaItem.notes,
          status: newIdeaItem.status,
          _isNew: true // Mark as new idea - counts as 1 change
        } 
      });
      
      // Update staged count
      const staged = getStagedIdeaChanges();
      setStagedCount(staged.fieldChangeCount);
    }
    
    setNewIdea({ idea: '', category: '', notes: '' });
  };

  const updateIdea = (id: string, updates: Partial<Idea>) => {
    console.log('🔄 updateIdea called:', { id, updates });
    
    // Local working copy update
    const updatedIdeas = ideas.map(idea =>
      idea.id === id ? { ...idea, ...updates } : idea
    );
    setIdeas(updatedIdeas);
    
    // Stage the change for saving
    stageIdeaEdit({ 
      id, 
      patch: { 
        id, 
        ...updates 
      } as IdeaPatch 
    });
    
    // Update staged count
    const staged = getStagedIdeaChanges();
    console.log('📊 Staged changes:', staged);
    setStagedCount(staged.fieldChangeCount);
  };

  const commitRowEdit = (id: string, patch: IdeaPatch) => {
    // Mark the row as having staged changes for batch saving
    console.log('Staging edit for idea:', id, patch);
    
    // Update the ideas state to reflect the final values
    const updatedIdeas = ideas.map(idea =>
      idea.id === id ? { ...idea, ...patch, _dirty: true } : idea
    );
    setIdeas(updatedIdeas);
    
    // Mark as not editing
    setEditingId(null);
  };

  const removeIdea = (id: string) => {
    stageIdeaComplete({ id });
    const staged = getStagedIdeaChanges();
    setStagedCount(staged.fieldChangeCount);
    // Hide row from current view
    setIdeas(prev => prev.filter(i => String(i.id) !== String(id)));
  };

  const handleEditStart = (id: string) => {
    setEditingId(id);
  };

  const handleEditEnd = () => {
    setEditingId(null);
  };

  if (loading) {
    return (
      <div className={tokens.layout.container}>
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <div className={tokens.palette.dark.text_muted}>Loading ideas from webhook...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
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
    <div className={tokens.layout.container}>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
            Ideas ({filteredIdeas.length})
          </h2>
          <div className="flex gap-2">
            <button
              onClick={saveBatch}
              disabled={stagedCount === 0 || loading}
              className={cn(tokens.button.base, tokens.button.primary, (stagedCount === 0 || loading) && 'opacity-50 cursor-not-allowed')}
            >
              {loading ? 'Saving...' : (stagedCount > 0 ? `Save (${stagedCount})` : 'Save')}
            </button>
            {stagedCount > 0 && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to discard all unsaved changes? This cannot be undone.')) {
                    clearStagedIdeaChanges();
                    setStagedCount(0);
                    // Reload data from webhook to get fresh state
                    loadIdeas();
                  }
                }}
                disabled={loading}
                className={cn(tokens.button.base, tokens.button.ghost, 'border border-red-500 text-red-500 hover:bg-red-500 hover:text-white')}
              >
                Cancel
              </button>
            )}
          </div>
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

      {/* Add new idea form (moved below table) */}
      <div className={cn(tokens.card.base, 'mt-6')}>
        <h3 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, 'mb-3', tokens.palette.dark.text)}>
          Add New Idea
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Idea description"
            value={newIdea.idea}
            onChange={(e) => setNewIdea({ ...newIdea, idea: e.target.value })}
            className={cn(tokens.input.base, tokens.input.focus)}
          />
          <select
            value={(newIdea.category as string) || ''}
            onChange={(e) => setNewIdea({ ...newIdea, category: e.target.value })}
            className={cn(tokens.input.base, tokens.input.focus, !newIdea.category && 'text-neutral-400')}
            style={!newIdea.category ? { color: '#9ca3af' } : {}}
          >
            <option value="" style={{ color: '#9ca3af' }}>Select category</option>
            <option value="work">work</option>
            <option value="projects">projects</option>
            <option value="videos">videos</option>
            <option value="writing">writing</option>
            <option value="health">health</option>
            <option value="business">business</option>
            <option value="life">life</option>
            <option value="future">future</option>
          </select>
          <input
            type="text"
            placeholder="Notes (optional)"
            value={(newIdea.notes as string) || ''}
            onChange={(e) => setNewIdea({ ...newIdea, notes: e.target.value })}
            className={cn(tokens.input.base, tokens.input.focus)}
          />
          <button
            onClick={addIdea}
            className={cn(tokens.button.base, tokens.button.primary)}
          >
            Add Idea
          </button>
        </div>
      </div>
    </div>
  );
};