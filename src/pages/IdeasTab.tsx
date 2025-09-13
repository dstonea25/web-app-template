import React, { useState, useEffect } from 'react';
import type { Idea, IdeaPatch } from '../types';
import { tokens, cn } from '../theme/config';
import { IdeasTable } from '../components/IdeasTable';
import { IdeasCategoryTabs } from '../components/IdeasCategoryTabs';

export const IdeasTab: React.FC = () => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<keyof Idea | ''>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [newIdea, setNewIdea] = useState<Partial<Idea>>({ 
    idea: '', 
    category: '', 
    notes: '' 
  });

  // Load initial data
  useEffect(() => {
    loadIdeas();
  }, []);

  const loadIdeas = async () => {
    try {
      // Load from seed data
      console.log('Loading ideas from seed data...');
      const response = await fetch('/data/ideas.json');
      const seedIdeas = await response.json();
      console.log('Seed ideas loaded:', seedIdeas);
      
      // Transform the data to match our Idea interface
      const transformedIdeas = seedIdeas.map((item: any) => ({
        id: String(item.id),
        idea: item.idea,
        category: item.category || null,
        created_at: item.created_at,
        status: item.status || 'open',
        notes: item.notes || '',
      }));
      
      setIdeas(transformedIdeas);
    } catch (error) {
      console.error('Failed to load ideas:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveBatch = async () => {
    try {
      // Get only the dirty ideas that need saving
      const dirtyIdeas = ideas.filter(idea => idea._dirty);
      console.log('Saving ideas:', dirtyIdeas);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Clear dirty flags after successful save
      const cleanedIdeas = ideas.map(idea => ({ ...idea, _dirty: false }));
      setIdeas(cleanedIdeas);
    } catch (error) {
      console.error('Failed to save ideas:', error);
      alert('Failed to save');
    }
  };

  const addIdea = () => {
    if (!newIdea.idea?.trim()) return;
    
    const idea: Idea = {
      id: String(Date.now()), // Simple ID generation
      idea: newIdea.idea!,
      category: (newIdea.category as string) || null,
      created_at: new Date().toISOString(),
      status: 'open',
      notes: newIdea.notes || '',
    };
    
    const updatedIdeas = [...ideas, idea];
    setIdeas(updatedIdeas);
    setNewIdea({ idea: '', category: '', notes: '' });
  };

  const updateIdea = (id: string, updates: Partial<Idea>) => {
    // Local working copy update
    const updatedIdeas = ideas.map(idea =>
      idea.id === id ? { ...idea, ...updates, _dirty: true } : idea
    );
    setIdeas(updatedIdeas);
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
    // In a real app, this would stage the removal for batch saving
    console.log('Staging removal for idea:', id);
    // Hide row from current view
    setIdeas(prev => prev.filter(i => String(i.id) !== String(id)));
  };

  const handleEditStart = (id: string, field: string) => {
    setEditingId(id);
    setEditingField(field);
  };

  const handleEditEnd = () => {
    setEditingId(null);
    setEditingField(null);
  };

  if (loading) {
    return (
      <div className={tokens.layout.container}>
        <div className="flex justify-center items-center py-12">
          <div className={tokens.palette.dark.text_muted}>Loading ideas...</div>
        </div>
      </div>
    );
  }

  // Filter ideas by active category
  const filteredIdeas = activeCategory === 'All' 
    ? ideas 
    : ideas.filter(idea => idea.category === activeCategory);

  // Count dirty items for save button
  const dirtyCount = ideas.filter(idea => idea._dirty).length;

  return (
    <div className={tokens.layout.container}>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
            Ideas ({filteredIdeas.length})
          </h2>
          <button
            onClick={saveBatch}
            disabled={dirtyCount === 0}
            className={cn(tokens.button.base, tokens.button.primary, dirtyCount === 0 && 'opacity-50 cursor-not-allowed')}
          >
            {dirtyCount > 0 ? `Save (${dirtyCount})` : 'Save'}
          </button>
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
        editingField={editingField}
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