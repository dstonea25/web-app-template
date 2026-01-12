import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { tokens, cn } from '../theme/config';
import { toast } from '../lib/notifications/toast';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Plus, ChevronDown, Edit3, Check, X, Upload, User, Sparkles, Settings, Eye, EyeOff } from 'lucide-react';

// ============================================================================
// THE FOUR PILLARS (Fixed, non-editable)
// ============================================================================
type PillarId = 'power' | 'passion' | 'purpose' | 'production';

interface Pillar {
  id: PillarId;
  name: string;
  subtitle: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const PILLARS: Pillar[] = [
  { 
    id: 'power', 
    name: 'Power', 
    subtitle: 'Body',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/5',
    borderColor: 'border-rose-500/20'
  },
  { 
    id: 'passion', 
    name: 'Passion', 
    subtitle: 'Relationships',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/5',
    borderColor: 'border-amber-500/20'
  },
  { 
    id: 'purpose', 
    name: 'Purpose', 
    subtitle: 'Self-fulfillment',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/5',
    borderColor: 'border-violet-500/20'
  },
  { 
    id: 'production', 
    name: 'Production', 
    subtitle: 'Career & Value Creation',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/5',
    borderColor: 'border-emerald-500/20'
  },
];

// Default dimension → pillar mapping (can be user-configured later)
const DEFAULT_DIMENSION_PILLARS: Record<string, PillarId> = {
  'Health & Fitness': 'power',
  'Career & Skills': 'production',
  'Relationships': 'passion',
  'Mindset & Mental Health': 'purpose',
  'Finances': 'production',
  'Hobbies & Interests': 'passion',
  'Purpose & Values': 'purpose',
};

// Types
interface GrowthCard {
  id: string;
  card_type: 'current' | 'ideal' | 'year' | 'future';
  title: string;
  image_url: string | null;
  year: number | null;
  future_age: number | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface GrowthDimension {
  id: string;
  name: string;
  display_order: number;
  archived: boolean;
  hidden?: boolean;
  pillar?: PillarId;
  created_at: string;
  updated_at: string;
}

interface GrowthDimensionValue {
  id: string;
  card_id: string;
  dimension_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface GrowthTabProps {
  isVisible?: boolean;
}

// Removed CardSelector - no longer used in the UI

// Inline editable text component
const InlineEdit: React.FC<{
  value: string;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
}> = ({ value, onSave, placeholder = 'Click to edit...', className, multiline = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = async () => {
    if (editValue.trim() === value.trim()) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(editValue.trim());
      setIsEditing(false);
    } catch (error) {
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Enter' && e.metaKey && multiline) {
      e.preventDefault();
      handleSave();
    }
  };

  if (isEditing) {
    const InputComponent = multiline ? 'textarea' : 'input';
    return (
      <div className="flex items-start gap-2 w-full">
        <InputComponent
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          disabled={isSaving}
          className={cn(
            'flex-1 bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2',
            'text-neutral-100 placeholder:text-neutral-500',
            'focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent',
            'caret-neutral-100',  // Ensure cursor is visible
            multiline && 'min-h-[100px] resize-none',
            className
          )}
          placeholder={placeholder}
          style={{ 
            color: '#f5f5f5',  // Force text color to be visible
            WebkitTextFillColor: '#f5f5f5'  // Override any browser autocomplete styling
          }}
        />
        <div className="flex flex-col gap-1">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="p-1.5 rounded-lg bg-neutral-700/50 text-neutral-400 hover:bg-neutral-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={cn(
        'text-left w-full group block',  // Added 'block' to make button fill container
        !value && 'text-neutral-500 italic',
        className
      )}
    >
      <span className="block w-full">
        {value || placeholder}
        <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity inline-block ml-2" />
      </span>
    </button>
  );
};

// Card image component with upload - compact circular design
const CardImage: React.FC<{
  imageUrl: string | null;
  onUpdate: (url: string | null) => Promise<void>;
  cardTitle: string;
}> = ({ imageUrl, onUpdate, cardTitle }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    setIsUploading(true);
    try {
      await onUpdate(urlInput.trim());
      setShowUrlInput(false);
      setUrlInput('');
      toast.success('Image updated');
    } catch {
      toast.error('Failed to update image');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative group">
      <div className={cn(
        'w-full aspect-square rounded-full overflow-hidden',
        'bg-gradient-to-br from-neutral-800 to-neutral-900',
        'border-2 border-neutral-700/50',
        'flex items-center justify-center'
      )}>
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={cardTitle}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <User className="w-8 h-8 text-neutral-600" />
        )}
      </div>
      
      {/* Overlay on hover */}
      <div className={cn(
        'absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100',
        'flex items-center justify-center transition-opacity cursor-pointer'
      )}
        onClick={() => setShowUrlInput(true)}
      >
        <Upload className="w-5 h-5 text-white" />
      </div>

      {/* URL input modal */}
      {showUrlInput && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-50" 
            onClick={() => setShowUrlInput(false)} 
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-80">
            <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-4 shadow-xl">
              <label className="block text-sm text-neutral-400 mb-2">Image URL</label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://..."
                className={cn(
                  'w-full bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2',
                  'text-neutral-100 placeholder:text-neutral-500',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-400'
                )}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUrlSubmit();
                  if (e.key === 'Escape') setShowUrlInput(false);
                }}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleUrlSubmit}
                  disabled={isUploading || !urlInput.trim()}
                  className={cn(
                    tokens.button.base,
                    tokens.button.primary,
                    'flex-1 text-sm'
                  )}
                >
                  {isUploading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setShowUrlInput(false)}
                  className={cn(
                    tokens.button.base,
                    tokens.button.ghost,
                    'text-sm'
                  )}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Create card modal
const CreateCardModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCreated: (card: GrowthCard) => void;
}> = ({ isOpen, onClose, onCreated }) => {
  const [cardType, setCardType] = useState<'year' | 'future'>('year');
  const [yearValue, setYearValue] = useState(new Date().getFullYear() - 1);
  const [ageValue, setAgeValue] = useState(35);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!supabase) return;
    setIsCreating(true);
    try {
      const title = cardType === 'year' 
        ? `${yearValue} Me`
        : `${ageValue}-year-old Me`;
      
      const { data, error } = await supabase
        .from('growth_cards')
        .insert({
          card_type: cardType,
          title,
          year: cardType === 'year' ? yearValue : null,
          future_age: cardType === 'future' ? ageValue : null,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      toast.success(`Created "${title}"`);
      onCreated(data as GrowthCard);
      onClose();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error(cardType === 'year' ? 'A card for this year already exists' : 'A card for this age already exists');
      } else {
        toast.error('Failed to create card');
      }
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
          <h3 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, 'text-neutral-100 mb-6')}>
            Create New Card
          </h3>
          
          {/* Card type selector */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setCardType('year')}
              className={cn(
                'flex-1 px-4 py-3 rounded-xl border-2 transition-all',
                cardType === 'year'
                  ? 'border-emerald-400 bg-emerald-400/10 text-emerald-400'
                  : 'border-neutral-700 bg-neutral-800/50 text-neutral-300 hover:border-neutral-600'
              )}
            >
              <div className="font-semibold">Year-based</div>
              <div className="text-xs opacity-70">e.g., "2024 Me"</div>
            </button>
            <button
              onClick={() => setCardType('future')}
              className={cn(
                'flex-1 px-4 py-3 rounded-xl border-2 transition-all',
                cardType === 'future'
                  ? 'border-emerald-400 bg-emerald-400/10 text-emerald-400'
                  : 'border-neutral-700 bg-neutral-800/50 text-neutral-300 hover:border-neutral-600'
              )}
            >
              <div className="font-semibold">Future self</div>
              <div className="text-xs opacity-70">e.g., "35-year-old Me"</div>
            </button>
          </div>

          {/* Value input */}
          <div className="mb-6">
            {cardType === 'year' ? (
              <div>
                <label className="block text-sm text-neutral-400 mb-2">Year</label>
                <input
                  type="number"
                  value={yearValue}
                  onChange={(e) => setYearValue(parseInt(e.target.value) || new Date().getFullYear())}
                  min={1990}
                  max={new Date().getFullYear()}
                  className={cn(
                    'w-full bg-neutral-800 border border-neutral-600 rounded-lg px-4 py-3',
                    'text-neutral-100 text-lg font-medium',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-400'
                  )}
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm text-neutral-400 mb-2">Age</label>
                <input
                  type="number"
                  value={ageValue}
                  onChange={(e) => setAgeValue(parseInt(e.target.value) || 35)}
                  min={1}
                  max={120}
                  className={cn(
                    'w-full bg-neutral-800 border border-neutral-600 rounded-lg px-4 py-3',
                    'text-neutral-100 text-lg font-medium',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-400'
                  )}
                />
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={cn(tokens.button.base, tokens.button.ghost, 'flex-1')}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className={cn(tokens.button.base, tokens.button.primary, 'flex-1')}
            >
              {isCreating ? 'Creating...' : 'Create Card'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// Add Past Version Card - the entry point for creating new past-self cards
const AddPastVersionCard: React.FC<{
  onAdd: (year: number) => void;
  existingYears: number[];
}> = ({ onAdd, existingYears }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from(
    { length: 30 }, 
    (_, i) => currentYear - i - 1
  ).filter(year => !existingYears.includes(year));

  const handleCreate = () => {
    if (selectedYear) {
      onAdd(selectedYear);
      setIsExpanded(false);
      setSelectedYear(null);
    }
  };

  return (
    <div className={cn(
      'relative bg-neutral-900/30 border-2 border-dashed border-neutral-700/50 rounded-2xl',
      'flex flex-col items-center justify-center min-h-[280px]',
      'hover:border-neutral-600/70 hover:bg-neutral-900/50 transition-all duration-300',
      'cursor-pointer group'
    )}>
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full h-full flex flex-col items-center justify-center gap-4 p-6"
        >
          <div className="w-14 h-14 rounded-full bg-neutral-800/50 flex items-center justify-center group-hover:bg-neutral-700/50 transition-colors">
            <Plus className="w-7 h-7 text-neutral-500 group-hover:text-neutral-400 transition-colors" />
          </div>
          <div className="text-center">
            <p className="text-neutral-400 text-sm font-medium mb-1">Add a past version</p>
            <p className="text-neutral-600 text-xs">Capture who you were</p>
          </div>
        </button>
      ) : (
        <div className="w-full p-6">
          <div className="text-center mb-4">
            <p className="text-neutral-300 text-sm font-medium mb-1">Choose a year</p>
            <p className="text-neutral-500 text-xs">When was this version of you?</p>
          </div>
          
          <div className="max-h-40 overflow-y-auto mb-4 rounded-xl bg-neutral-800/50 p-2">
            <div className="grid grid-cols-3 gap-1">
              {availableYears.slice(0, 15).map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm transition-all',
                    selectedYear === year
                      ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40'
                      : 'text-neutral-400 hover:bg-neutral-700/50 hover:text-neutral-300'
                  )}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => {
                setIsExpanded(false);
                setSelectedYear(null);
              }}
              className="flex-1 px-3 py-2 rounded-lg text-sm text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!selectedYear}
              className={cn(
                'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                selectedYear
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  : 'bg-neutral-800/50 text-neutral-600 cursor-not-allowed'
              )}
            >
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Past Self Card - A standalone vertical card for the timeline
const PastSelfCard: React.FC<{
  card: GrowthCard;
  dimensionValues: GrowthDimensionValue[];
  onUpdateImage: (url: string | null) => Promise<void>;
  onUpdateTitle: (title: string) => Promise<void>;
  onUpdateDimensionValue: (dimensionId: string, content: string) => Promise<void>;
  dimensionsByPillar: Record<PillarId, (GrowthDimension & { pillar: PillarId })[]>;
}> = ({ 
  card, 
  dimensionValues, 
  onUpdateImage, 
  onUpdateTitle, 
  onUpdateDimensionValue,
  dimensionsByPillar 
}) => {
  const getDimensionValue = (dimensionId: string): string => {
    const value = dimensionValues.find(
      v => v.card_id === card.id && v.dimension_id === dimensionId
    );
    return value?.content || '';
  };

  // Get year display
  const yearDisplay = card.card_type === 'current' 
    ? new Date().getFullYear() 
    : (card.year || new Date(card.created_at).getFullYear());
  
  // Calculate time ago
  const currentYear = new Date().getFullYear();
  const yearsAgo = currentYear - yearDisplay;
  const timeAgoText = card.card_type === 'current' 
    ? 'Now' 
    : (yearsAgo === 1 ? '1 year ago' : `${yearsAgo} years ago`);

  return (
    <div className={cn(
      'relative bg-neutral-900/60 border border-neutral-800 rounded-2xl overflow-hidden',
      'hover:border-neutral-700 transition-all duration-300'
    )}>
      {/* Card Header */}
      <div className="p-5 pb-4 border-b border-neutral-800/30">
        {/* Year - Primary Anchor */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-3xl font-light text-neutral-200 tracking-tight mb-0.5">
              {yearDisplay}
            </div>
            <div className={cn(
              'text-xs',
              card.card_type === 'current' ? 'text-emerald-600/70' : 'text-neutral-600'
            )}>
              {timeAgoText}
            </div>
          </div>
          
          {/* Image */}
          <div className="w-14 h-14 shrink-0">
            <CardImage
              imageUrl={card.image_url}
              onUpdate={onUpdateImage}
              cardTitle={card.title}
            />
          </div>
        </div>

        {/* Optional Label/Context */}
        {card.card_type !== 'current' && (
          <div>
            <InlineEdit
              value={card.title.replace(/^\d{4}\s*/, '').replace(/\s*Me$/, '') || ''}
              onSave={async (val) => {
                await onUpdateTitle(val ? `${yearDisplay} ${val}` : `${yearDisplay} Me`);
              }}
              placeholder="Add a label..."
              className="text-sm text-neutral-400"
            />
          </div>
        )}
      </div>

      {/* Content - All Pillars and Dimensions Visible */}
      <div className="p-5 space-y-6">
        {PILLARS.map((pillar) => {
          const pillarDimensions = dimensionsByPillar[pillar.id];
          if (pillarDimensions.length === 0) return null;

          return (
            <div key={pillar.id} className="space-y-3">
              {/* Pillar Header */}
              <div className="flex items-center gap-2">
                <span className={cn('text-[9px] uppercase tracking-wide font-normal opacity-50', pillar.color)}>
                  {pillar.name}
                </span>
              </div>

              {/* Pillar Dimensions */}
              {pillarDimensions.map((dim) => {
                const value = getDimensionValue(dim.id);
                
                return (
                  <div key={dim.id} className="space-y-1.5">
                    <div className={cn(
                      'text-xs',
                      value.trim() ? 'text-neutral-400' : 'text-neutral-600'
                    )}>
                      {dim.name}
                    </div>
                    {value.trim() ? (
                      <InlineEdit
                        value={value}
                        onSave={(content) => onUpdateDimensionValue(dim.id, content)}
                        placeholder=""
                        multiline
                        className="text-sm text-neutral-300 leading-relaxed"
                      />
                    ) : (
                      <InlineEdit
                        value=""
                        onSave={(content) => onUpdateDimensionValue(dim.id, content)}
                        placeholder=""
                        multiline
                        className="text-sm text-neutral-800/50 opacity-0 hover:opacity-100 transition-opacity"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Dimension management modal - organized by pillars with reordering
const DimensionManagerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  dimensions: GrowthDimension[];
  onDimensionsChange: () => void;
}> = ({ isOpen, onClose, dimensions, onDimensionsChange }) => {
  const [addingToPillar, setAddingToPillar] = useState<PillarId | null>(null);
  const [newDimensionName, setNewDimensionName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingDimensionId, setEditingDimensionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Group dimensions by pillar
  const dimensionsByPillar = useMemo(() => {
    const grouped: Record<PillarId, GrowthDimension[]> = {
      power: [],
      passion: [],
      purpose: [],
      production: [],
    };

    dimensions.filter(d => !d.archived).forEach(dim => {
      const pillar = (dim.pillar || DEFAULT_DIMENSION_PILLARS[dim.name] || 'purpose') as PillarId;
      grouped[pillar].push(dim);
    });

    // Sort by display_order within each pillar
    Object.keys(grouped).forEach(key => {
      grouped[key as PillarId].sort((a, b) => a.display_order - b.display_order);
    });

    return grouped;
  }, [dimensions]);

  const archivedDimensions = dimensions.filter(d => d.archived);

  const handleAddDimension = async (pillarId: PillarId) => {
    if (!supabase || !newDimensionName.trim()) return;
    setIsAdding(true);
    try {
      // Get max order for this pillar
      const pillarDims = dimensionsByPillar[pillarId];
      const maxOrder = pillarDims.length > 0 
        ? Math.max(...pillarDims.map(d => d.display_order)) + 1 
        : 0;

      const { error } = await supabase
        .from('growth_dimensions')
        .insert({
          name: newDimensionName.trim(),
          display_order: maxOrder,
          pillar: pillarId,
        });
      
      if (error) throw error;
      
      toast.success('Dimension added');
      setNewDimensionName('');
      setAddingToPillar(null);
      onDimensionsChange();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('A dimension with this name already exists');
      } else {
        toast.error('Failed to add dimension');
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleArchive = async (dimension: GrowthDimension) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('growth_dimensions')
        .update({ archived: !dimension.archived })
        .eq('id', dimension.id);
      
      if (error) throw error;
      toast.success(dimension.archived ? 'Dimension restored' : 'Dimension archived');
      onDimensionsChange();
    } catch {
      toast.error('Failed to update dimension');
    }
  };

  const handleStartEdit = (dimension: GrowthDimension) => {
    setEditingDimensionId(dimension.id);
    setEditingName(dimension.name);
  };

  const handleCancelEdit = () => {
    setEditingDimensionId(null);
    setEditingName('');
  };

  const handleSaveRename = async (dimensionId: string) => {
    if (!supabase || !editingName.trim()) return;
    
    try {
      const { error } = await supabase
        .from('growth_dimensions')
        .update({ name: editingName.trim() })
        .eq('id', dimensionId);
      
      if (error) throw error;
      toast.success('Dimension renamed');
      setEditingDimensionId(null);
      setEditingName('');
      onDimensionsChange();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('A dimension with this name already exists');
      } else {
        toast.error('Failed to rename dimension');
      }
    }
  };

  const handleMoveUp = async (dimension: GrowthDimension, pillarId: PillarId) => {
    if (!supabase) return;
    const pillarDims = dimensionsByPillar[pillarId];
    const currentIndex = pillarDims.findIndex(d => d.id === dimension.id);
    if (currentIndex <= 0) return;

    const prevDim = pillarDims[currentIndex - 1];
    
    try {
      // Swap display_order values
      await supabase
        .from('growth_dimensions')
        .update({ display_order: prevDim.display_order })
        .eq('id', dimension.id);
      
      await supabase
        .from('growth_dimensions')
        .update({ display_order: dimension.display_order })
        .eq('id', prevDim.id);
      
      onDimensionsChange();
    } catch {
      toast.error('Failed to reorder');
    }
  };

  const handleMoveDown = async (dimension: GrowthDimension, pillarId: PillarId) => {
    if (!supabase) return;
    const pillarDims = dimensionsByPillar[pillarId];
    const currentIndex = pillarDims.findIndex(d => d.id === dimension.id);
    if (currentIndex >= pillarDims.length - 1) return;

    const nextDim = pillarDims[currentIndex + 1];
    
    try {
      // Swap display_order values
      await supabase
        .from('growth_dimensions')
        .update({ display_order: nextDim.display_order })
        .eq('id', dimension.id);
      
      await supabase
        .from('growth_dimensions')
        .update({ display_order: dimension.display_order })
        .eq('id', nextDim.id);
      
      onDimensionsChange();
    } catch {
      toast.error('Failed to reorder');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, 'text-neutral-100')}>
              Manage Dimensions
            </h3>
            <p className="text-xs text-neutral-500">Pillars are fixed • Reorder dimensions within each pillar</p>
          </div>
          
          {/* Pillars with their dimensions */}
          <div className="space-y-6">
            {PILLARS.map((pillar) => {
              const pillarDims = dimensionsByPillar[pillar.id];
              
              return (
                <div key={pillar.id} className={cn('rounded-xl border p-4', pillar.borderColor, pillar.bgColor)}>
                  {/* Pillar header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-baseline gap-2">
                      <h4 className={cn('text-sm font-semibold uppercase tracking-wider', pillar.color)}>
                        {pillar.name}
                      </h4>
                      <span className="text-xs text-neutral-500">{pillar.subtitle}</span>
                    </div>
                    <button
                      onClick={() => setAddingToPillar(addingToPillar === pillar.id ? null : pillar.id)}
                      className={cn(
                        'flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors',
                        addingToPillar === pillar.id
                          ? 'bg-neutral-700 text-neutral-200'
                          : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
                      )}
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </button>
                  </div>

                  {/* Add new dimension form */}
                  {addingToPillar === pillar.id && (
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={newDimensionName}
                        onChange={(e) => setNewDimensionName(e.target.value)}
                        placeholder="New dimension name..."
                        className={cn(
                          'flex-1 bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 text-sm',
                          'text-neutral-100 placeholder:text-neutral-500',
                          'focus:outline-none focus:ring-2 focus:ring-emerald-400'
                        )}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddDimension(pillar.id);
                          if (e.key === 'Escape') {
                            setAddingToPillar(null);
                            setNewDimensionName('');
                          }
                        }}
                      />
                      <button
                        onClick={() => handleAddDimension(pillar.id)}
                        disabled={isAdding || !newDimensionName.trim()}
                        className={cn(tokens.button.base, tokens.button.primary, 'text-sm px-3')}
                      >
                        {isAdding ? '...' : 'Add'}
                      </button>
                      <button
                        onClick={() => {
                          setAddingToPillar(null);
                          setNewDimensionName('');
                        }}
                        className={cn(tokens.button.base, tokens.button.ghost, 'text-sm px-2')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Dimensions list */}
                  {pillarDims.length > 0 ? (
                    <div className="space-y-1">
                      {pillarDims.map((dim, index) => (
                        <div
                          key={dim.id}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800/50 border border-neutral-700/50 group"
                        >
                          {/* Reorder buttons - hidden when editing */}
                          {editingDimensionId !== dim.id && (
                            <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleMoveUp(dim, pillar.id)}
                                disabled={index === 0}
                                className={cn(
                                  'p-0.5 rounded hover:bg-neutral-700 transition-colors',
                                  index === 0 && 'opacity-30 cursor-not-allowed'
                                )}
                                title="Move up"
                              >
                                <ChevronDown className="w-3 h-3 rotate-180 text-neutral-400" />
                              </button>
                              <button
                                onClick={() => handleMoveDown(dim, pillar.id)}
                                disabled={index === pillarDims.length - 1}
                                className={cn(
                                  'p-0.5 rounded hover:bg-neutral-700 transition-colors',
                                  index === pillarDims.length - 1 && 'opacity-30 cursor-not-allowed'
                                )}
                                title="Move down"
                              >
                                <ChevronDown className="w-3 h-3 text-neutral-400" />
                              </button>
                            </div>
                          )}
                          
                          {/* Dimension name - editable when in edit mode */}
                          {editingDimensionId === dim.id ? (
                            <>
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className={cn(
                                  'flex-1 bg-neutral-700 border border-neutral-600 rounded px-2 py-1 text-sm',
                                  'text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-400'
                                )}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRename(dim.id);
                                  if (e.key === 'Escape') handleCancelEdit();
                                }}
                              />
                              <button
                                onClick={() => handleSaveRename(dim.id)}
                                className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                                title="Save"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-sm text-neutral-200">{dim.name}</span>
                              
                              <button
                                onClick={() => handleStartEdit(dim)}
                                className="text-xs text-neutral-500 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1"
                                title="Rename"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleArchive(dim)}
                                className="text-xs text-neutral-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                Archive
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-500 italic py-2">
                      No dimensions yet. Click "Add" to create one.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Archived dimensions */}
          {archivedDimensions.length > 0 && (
            <div className="mt-6 pt-6 border-t border-neutral-800">
              <h4 className="text-sm text-neutral-500 uppercase tracking-wider mb-3">Archived</h4>
              <div className="space-y-1">
                {archivedDimensions.map((dim) => (
                  <div
                    key={dim.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-800/30 border border-neutral-800"
                  >
                    <span className="text-sm text-neutral-500">{dim.name}</span>
                    <button
                      onClick={() => handleArchive(dim)}
                      className="text-xs text-neutral-500 hover:text-emerald-400 transition-colors"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className={cn(tokens.button.base, tokens.button.secondary, 'w-full mt-6')}
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
};

// Main Growth Tab Component
export const GrowthTab: React.FC<GrowthTabProps> = ({ isVisible = true }) => {
  // State
  const [cards, setCards] = useState<GrowthCard[]>([]);
  const [dimensions, setDimensions] = useState<GrowthDimension[]>([]);
  const [dimensionValues, setDimensionValues] = useState<GrowthDimensionValue[]>([]);
  const [leftCard, setLeftCard] = useState<GrowthCard | null>(null);
  const [rightCard, setRightCard] = useState<GrowthCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDimensionModal, setShowDimensionModal] = useState(false);
  const [showCardSelector, setShowCardSelector] = useState(false);
  
  // Section visibility state
  const [sectionsVisible, setSectionsVisible] = useState({
    becoming: true,
    remembering: false,
  });
  
  const toggleSection = (section: keyof typeof sectionsVisible) => {
    setSectionsVisible(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Track if initial load has happened
  const hasLoadedRef = React.useRef(false);

  // Load data
  const loadData = useCallback(async (isInitialLoad = false) => {
    if (!supabase || !isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    try {
      // Fetch cards
      const { data: cardsData, error: cardsError } = await supabase
        .from('growth_cards')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (cardsError) throw cardsError;

      // Fetch dimensions
      const { data: dimensionsData, error: dimensionsError } = await supabase
        .from('growth_dimensions')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (dimensionsError) throw dimensionsError;

      // Fetch all dimension values
      const { data: valuesData, error: valuesError } = await supabase
        .from('growth_dimension_values')
        .select('*');
      
      if (valuesError) throw valuesError;

      const typedCards = cardsData as GrowthCard[];
      setCards(typedCards);
      setDimensions(dimensionsData as GrowthDimension[]);
      setDimensionValues(valuesData as GrowthDimensionValue[]);

      // Only set default cards on initial load
      if (isInitialLoad) {
        // Left card is ALWAYS "Current Me" (locked to current year)
        const currentCard = typedCards.find(c => c.card_type === 'current');
        if (currentCard) setLeftCard(currentCard);
        
        // Right card defaults to "Ideal Me"
        const idealCard = typedCards.find(c => c.card_type === 'ideal');
        if (idealCard) setRightCard(idealCard);
      }
    } catch (error) {
      console.error('Failed to load growth data:', error);
      toast.error('Failed to load growth data');
    } finally {
      setIsLoading(false);
    }
  }, []); // No dependencies - stable function

  useEffect(() => {
    if (isVisible && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadData(true); // Initial load with default card selection
    }
  }, [isVisible, loadData]);

  // Update selected cards when cards data changes
  useEffect(() => {
    if (cards.length > 0) {
      if (leftCard) {
        const updated = cards.find(c => c.id === leftCard.id);
        if (updated) setLeftCard(updated);
      }
      if (rightCard) {
        const updated = cards.find(c => c.id === rightCard.id);
        if (updated) setRightCard(updated);
      }
    }
  }, [cards]);

  // Get dimension value for a card
  const getDimensionValue = useCallback((cardId: string, dimensionId: string): string => {
    const value = dimensionValues.find(
      v => v.card_id === cardId && v.dimension_id === dimensionId
    );
    return value?.content || '';
  }, [dimensionValues]);

  // Toggle dimension visibility
  const toggleDimensionVisibility = useCallback(async (dimensionId: string) => {
    if (!supabase) return;
    
    const dimension = dimensions.find(d => d.id === dimensionId);
    if (!dimension) return;
    
    try {
      const { error } = await supabase
        .from('growth_dimensions')
        .update({ hidden: !dimension.hidden })
        .eq('id', dimensionId);
      
      if (error) throw error;
      
      // Reload data to reflect the change
      await loadData();
    } catch (error) {
      console.error('Failed to toggle dimension visibility:', error);
      toast.error('Failed to update visibility');
    }
  }, [dimensions, supabase, loadData]);

  // Update dimension value
  const updateDimensionValue = useCallback(async (cardId: string, dimensionId: string, content: string) => {
    if (!supabase) return;
    
    const existing = dimensionValues.find(
      v => v.card_id === cardId && v.dimension_id === dimensionId
    );

    try {
      if (existing) {
        const { error } = await supabase
          .from('growth_dimension_values')
          .update({ content })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('growth_dimension_values')
          .insert({ card_id: cardId, dimension_id: dimensionId, content });
        
        if (error) throw error;
      }

      // Refresh values
      const { data, error: refreshError } = await supabase
        .from('growth_dimension_values')
        .select('*');
      
      if (refreshError) throw refreshError;
      setDimensionValues(data as GrowthDimensionValue[]);
    } catch (error) {
      console.error('Failed to update dimension value:', error);
      throw error;
    }
  }, [dimensionValues]);

  // Update card title
  const updateCardTitle = useCallback(async (cardId: string, title: string) => {
    if (!supabase) return;
    
    try {
      const { error } = await supabase
        .from('growth_cards')
        .update({ title })
        .eq('id', cardId);
      
      if (error) throw error;
      
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, title } : c));
    } catch (error) {
      console.error('Failed to update card title:', error);
      throw error;
    }
  }, []);

  // Update card image
  const updateCardImage = useCallback(async (cardId: string, imageUrl: string | null) => {
    if (!supabase) return;
    
    try {
      const { error } = await supabase
        .from('growth_cards')
        .update({ image_url: imageUrl })
        .eq('id', cardId);
      
      if (error) throw error;
      
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, image_url: imageUrl } : c));
    } catch (error) {
      console.error('Failed to update card image:', error);
      throw error;
    }
  }, []);

  // Handle new card created
  const handleCardCreated = useCallback((card: GrowthCard) => {
    setCards(prev => [...prev, card]);
  }, []);

  // Helper functions for card labels
  const getCardLabel = (card: GrowthCard): string => {
    if (card.card_type === 'year' && card.year) {
      return `${card.year} Me`;
    }
    if (card.card_type === 'future' && card.future_age) {
      return `${card.future_age}-year-old Me`;
    }
    return card.title;
  };

  const getCardTypeLabel = (card: GrowthCard): string => {
    if (card.card_type === 'current') return 'Present';
    if (card.card_type === 'ideal') return 'Aspiration';
    if (card.card_type === 'year') return 'Past Year';
    if (card.card_type === 'future') return 'Future Self';
    return card.card_type;
  };

  // Get dimensions grouped by pillar
  const dimensionsByPillar = useMemo(() => {
    const activeDimensions = dimensions.filter(d => !d.archived);
    
    // Assign each dimension to a pillar
    const withPillars = activeDimensions.map(dim => ({
      ...dim,
      pillar: (dim.pillar || DEFAULT_DIMENSION_PILLARS[dim.name] || 'purpose') as PillarId
    }));

    // Group by pillar
    const grouped: Record<PillarId, typeof withPillars> = {
      power: [],
      passion: [],
      purpose: [],
      production: [],
    };

    withPillars.forEach(dim => {
      grouped[dim.pillar].push(dim);
    });

    // Sort dimensions within each pillar by display_order
    Object.keys(grouped).forEach(key => {
      grouped[key as PillarId].sort((a, b) => a.display_order - b.display_order);
    });

    return grouped;
  }, [dimensions]);

  // Removed hasDimensionContent - no longer used

  // Loading state
  if (!isVisible) return null;

  if (isLoading) {
    return (
      <div className={tokens.layout.container}>
        <div className="flex items-center justify-center py-20">
          <div className="text-neutral-400">Loading...</div>
        </div>
      </div>
    );
  }

  // Not configured state
  if (!isSupabaseConfigured) {
    return (
      <div className={tokens.layout.container}>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Sparkles className="w-16 h-16 text-neutral-600 mb-4" />
          <h2 className={cn(tokens.typography.scale.h2, 'text-neutral-400 mb-2')}>
            Growth Tab
          </h2>
          <p className="text-neutral-500">
            Supabase connection required. Please configure your environment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={tokens.layout.container}>
      <div className="grid gap-6">
        {/* Becoming Section */}
        <section>
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => toggleSection('becoming')}
              className="flex items-center gap-2 text-left text-neutral-100 hover:text-emerald-400 transition-colors"
            >
              <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
                Becoming
              </h2>
              <svg
                className={cn(
                  "w-5 h-5 transition-transform duration-200",
                  sectionsVisible.becoming ? "rotate-180" : "rotate-0"
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Edit dimensions cog */}
            <button
              onClick={() => setShowDimensionModal(true)}
              className="text-neutral-500 hover:text-neutral-300 transition-colors"
              title="Edit dimensions"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          <div className={cn('mt-4', !sectionsVisible.becoming && 'hidden')}>
            {/* Three-Column Reflective Surface */}
            {leftCard && rightCard ? (
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_1fr] gap-0 lg:gap-x-2 overflow-hidden">
          
          {/* Column Headers */}
          {/* Top-left: transparent/empty - first column will be shorter */}
          <div className="hidden lg:block">
          </div>
          
          {/* NOW column header - centered fight card style */}
          <div className="bg-neutral-950/80 p-6 border-t border-b border-l border-r border-neutral-800 rounded-t-xl flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 shrink-0">
              <CardImage
                imageUrl={leftCard.image_url}
                onUpdate={(url) => updateCardImage(leftCard.id, url)}
                cardTitle={leftCard.title}
              />
            </div>
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Now · {new Date().getFullYear()}</div>
            <div className="text-sm font-medium text-neutral-200">
              {leftCard.title}
            </div>
          </div>
          
          {/* BECOMING column header - centered fight card style */}
          <div className="bg-neutral-900/30 p-6 border-t border-b border-l border-r border-neutral-800 border-l-emerald-900/30 rounded-t-xl flex flex-col items-center justify-center text-center gap-3 relative">
            <div className="w-12 h-12 shrink-0">
              <CardImage
                imageUrl={rightCard.image_url}
                onUpdate={(url) => updateCardImage(rightCard.id, url)}
                cardTitle={rightCard.title}
              />
            </div>
            <div className="text-[10px] text-emerald-500/70 uppercase tracking-wider">Becoming</div>
            
            {/* Clickable title with dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowCardSelector(!showCardSelector)}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              >
                <span className="text-sm font-medium text-emerald-200/90">
                  {rightCard.title}
                </span>
                <ChevronDown className={cn(
                  'w-3 h-3 text-emerald-400 transition-transform',
                  showCardSelector && 'rotate-180'
                )} />
              </button>

              {/* Dropdown menu */}
              {showCardSelector && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowCardSelector(false)} 
                  />
                  <div className="absolute z-50 mt-2 w-56 rounded-xl border border-neutral-700 bg-neutral-900 shadow-xl right-0">
                    <div className="p-1.5 max-h-72 overflow-y-auto">
                      {cards.filter(c => c.card_type !== 'current').map((card) => (
                        <button
                          key={card.id}
                          onClick={() => {
                            setRightCard(card);
                            setShowCardSelector(false);
                          }}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-lg transition-colors',
                            'hover:bg-neutral-800',
                            rightCard?.id === card.id && 'bg-emerald-500/10 text-emerald-400'
                          )}
                        >
                          <div className="text-sm font-medium">{getCardLabel(card)}</div>
                          <div className="text-xs text-neutral-500">{getCardTypeLabel(card)}</div>
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-neutral-700 p-1.5">
                      <button
                        onClick={() => {
                          setShowCreateModal(true);
                          setShowCardSelector(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-emerald-400 hover:bg-neutral-800 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Create new card...</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Content Rows - Pillar by Pillar */}
          {PILLARS.map((pillar, pillarIndex) => {
            const pillarDimensions = dimensionsByPillar[pillar.id];
            if (pillarDimensions.length === 0) return null;
            
            // Check if this is the last pillar with dimensions
            const isLastPillar = pillarIndex === PILLARS.length - 1 || 
              PILLARS.slice(pillarIndex + 1).every(p => dimensionsByPillar[p.id].length === 0);
            
            // Check if this is the first pillar with dimensions
            const isFirstPillar = pillarIndex === 0 || 
              PILLARS.slice(0, pillarIndex).every(p => dimensionsByPillar[p.id].length === 0);

            return (
              <React.Fragment key={pillar.id}>
                {/* Dimension Rows */}
                {pillarDimensions.map((dim, dimIndex) => {
                  const currentValue = getDimensionValue(leftCard.id, dim.id);
                  const becomingValue = getDimensionValue(rightCard.id, dim.id);
                  const hasContent = !!(currentValue.trim() || becomingValue.trim());
                  const isLastInPillar = dimIndex === pillarDimensions.length - 1;
                  const isFirstInPillar = dimIndex === 0;
                  const isLastDimensionOverall = isLastPillar && isLastInPillar;

                  return (
                    <React.Fragment key={dim.id}>
                      {/* Left: Dimension Label */}
                      <div className={cn(
                        'hidden lg:flex flex-col items-start p-3 bg-neutral-900/50 border-l border-r border-neutral-800 group',
                        isFirstInPillar && isFirstPillar && 'rounded-t-xl border-t',
                        !isLastInPillar && 'border-b',
                        isLastInPillar && !isLastPillar && 'border-b-2 border-b-neutral-700',
                        isLastDimensionOverall && 'rounded-b-xl border-b',
                        isFirstInPillar && 'pt-4'
                      )}>
                        {/* Pillar label - quiet chapter heading on first dimension */}
                        {isFirstInPillar && (
                          <div className="mb-1.5">
                            <span className={cn('text-[9px] font-normal uppercase tracking-wide opacity-40', pillar.color)}>
                              {pillar.name}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className={cn(
                            'text-sm',
                            hasContent ? 'text-neutral-400' : 'text-neutral-600'
                          )}>
                            {dim.name}
                          </span>
                          <button
                            onClick={() => toggleDimensionVisibility(dim.id)}
                            className={cn(
                              "text-neutral-600 hover:text-neutral-400 transition-all shrink-0",
                              dim.hidden ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                            )}
                            title={dim.hidden ? 'Show dimension' : 'Hide dimension'}
                          >
                            {dim.hidden ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Middle: Current (darker, grounded) */}
                      <div className={cn(
                        'p-3 bg-neutral-950/80 border-l border-r border-neutral-800',
                        !isLastInPillar && 'border-b',
                        isLastInPillar && !isLastPillar && 'border-b-2 border-b-neutral-700',
                        isLastDimensionOverall && 'rounded-b-xl border-b',
                        isFirstInPillar && 'lg:pt-4'
                      )}>
                        {/* Mobile: show dimension label */}
                        <div className="lg:hidden text-xs text-neutral-500 mb-2">{dim.name}</div>
                        
                        {/* Add spacer to align with dimension label (not pillar) on desktop */}
                        {isFirstInPillar && (
                          <div className="hidden lg:block h-[1.125rem]" />
                        )}
                        
                        {dim.hidden ? (
                          <div className="flex items-center gap-2 text-neutral-700 text-sm italic">
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Hidden</span>
                          </div>
                        ) : currentValue.trim() ? (
                          <InlineEdit
                            value={currentValue}
                            onSave={(content) => updateDimensionValue(leftCard.id, dim.id, content)}
                            placeholder=""
                            multiline
                            className="text-neutral-300 text-sm leading-relaxed"
                          />
                        ) : (
                          <InlineEdit
                            value=""
                            onSave={(content) => updateDimensionValue(leftCard.id, dim.id, content)}
                            placeholder=""
                            multiline
                            className="text-neutral-800/50 text-sm opacity-0 hover:opacity-100 transition-opacity"
                          />
                        )}
                      </div>

                      {/* Right: Becoming (lighter, aspirational) */}
                      <div className={cn(
                        'p-3 bg-neutral-900/30 border-l border-r border-neutral-800 border-l-emerald-900/30',
                        !isLastInPillar && 'border-b',
                        isLastInPillar && !isLastPillar && 'border-b-2 border-b-neutral-700',
                        isLastDimensionOverall && 'rounded-b-xl border-b',
                        isFirstInPillar && 'lg:pt-4'
                      )}>
                        {/* Mobile: label for becoming */}
                        <div className="lg:hidden text-[10px] text-emerald-600/50 uppercase tracking-wider mb-2">Becoming</div>
                        
                        {/* Add spacer to align with dimension label (not pillar) on desktop */}
                        {isFirstInPillar && (
                          <div className="hidden lg:block h-[1.125rem]" />
                        )}
                        
                        {dim.hidden ? (
                          <div className="flex items-center gap-2 text-neutral-700 text-sm italic">
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Hidden</span>
                          </div>
                        ) : becomingValue.trim() ? (
                          <InlineEdit
                            value={becomingValue}
                            onSave={(content) => updateDimensionValue(rightCard.id, dim.id, content)}
                            placeholder=""
                            multiline
                            className="text-neutral-300 text-sm leading-relaxed"
                          />
                        ) : (
                          <InlineEdit
                            value=""
                            onSave={(content) => updateDimensionValue(rightCard.id, dim.id, content)}
                            placeholder=""
                            multiline
                            className="text-neutral-800/50 text-sm opacity-0 hover:opacity-100 transition-opacity"
                          />
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Sparkles className="w-12 h-12 text-neutral-700 mb-4" />
              <p className="text-neutral-500 text-sm mb-4">
                No cards to compare yet
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className={cn(tokens.button.base, tokens.button.ghost, 'text-sm')}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create your first card
              </button>
            </div>
          )}
          </div>
        </section>

        {/* Remembering Section - Timeline/Past Versions */}
        <section>
          <button
            onClick={() => toggleSection('remembering')}
            className="flex items-center gap-2 w-full text-left text-neutral-100 hover:text-amber-400/80 transition-colors"
          >
            <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
              Remembering
            </h2>
            <svg
              className={cn(
                "w-5 h-5 transition-transform duration-200",
                sectionsVisible.remembering ? "rotate-180" : "rotate-0"
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <div className={cn('mt-4', !sectionsVisible.remembering && 'hidden')}>
            {/* Section Intro */}
            <div className="mb-8 max-w-2xl">
              <p className="text-neutral-500 text-sm leading-relaxed">
                A space for looking back with compassion. See how you've evolved, appreciate progress through periods of change, 
                and understand patterns without judging earlier versions of yourself.
              </p>
            </div>

            {/* Timeline Container */}
            <div className="relative">
              {/* Timeline Cards Grid */}
              <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Build the ordered timeline array */}
                {(() => {
                  // Start with Add Past Version card
                  const timelineCards: Array<{ type: 'add' | 'year' | 'current', card?: GrowthCard, index: number }> = [
                    { type: 'add', index: 0 }
                  ];
                  
                  // Add past year cards sorted from oldest to newest
                  const yearCards = cards
                    .filter(c => c.card_type === 'year')
                    .sort((a, b) => (a.year || 0) - (b.year || 0));
                  
                  yearCards.forEach((card, i) => {
                    timelineCards.push({ type: 'year', card, index: i + 1 });
                  });
                  
                  // Add Current Me as the final bookend
                  if (leftCard) {
                    timelineCards.push({ type: 'current', card: leftCard, index: timelineCards.length });
                  }
                  
                  const cardsPerRow = 3;
                  
                  return timelineCards.map((item, globalIndex) => {
                    const row = Math.floor(globalIndex / cardsPerRow);
                    const col = globalIndex % cardsPerRow;
                    const isEvenRow = row % 2 === 0;
                    
                    // Calculate if this is the last card in its row
                    const isLastInRow = col === cardsPerRow - 1 || globalIndex === timelineCards.length - 1;
                    
                    // Determine line direction
                    const showHorizontalLine = !isLastInRow;
                    const showVerticalLine = isLastInRow && globalIndex < timelineCards.length - 1;
                    
                    return (
                      <div key={item.type === 'add' ? 'add-card' : item.card?.id} className="relative">
                        {/* Snaking Timeline Line */}
                        {showHorizontalLine && (
                          <div className={cn(
                            "hidden lg:block absolute top-6 h-0.5 bg-gradient-to-r from-amber-900/40 to-amber-900/40 z-0",
                            isEvenRow ? "left-full w-4 ml-4" : "right-full w-4 mr-4"
                          )} />
                        )}
                        
                        {showVerticalLine && (
                          <div className={cn(
                            "hidden lg:block absolute w-0.5 bg-gradient-to-b from-amber-900/40 to-amber-900/40 z-0",
                            isEvenRow 
                              ? "left-full top-6 h-[calc(100%+1rem)] ml-[1.9rem]"
                              : "right-full top-6 h-[calc(100%+1rem)] mr-[1.9rem]"
                          )} />
                        )}
                        
                        {/* Timeline dot */}
                        <div className={cn(
                          "hidden lg:block absolute top-6 w-3 h-3 rounded-full border-2 z-10",
                          item.type === 'current' 
                            ? "border-emerald-700/50 bg-emerald-500/20 -translate-x-1/2 -translate-y-1/2"
                            : "border-amber-700/50 bg-neutral-900 -translate-x-1/2 -translate-y-1/2",
                          isEvenRow ? "left-0 -ml-[1rem]" : "right-0 -mr-[1rem]"
                        )} />
                        
                        {/* Card Content */}
                        {item.type === 'add' ? (
                          <AddPastVersionCard
                            existingYears={cards.filter(c => c.card_type === 'year').map(c => c.year || 0)}
                            onAdd={async (year) => {
                              if (!supabase) return;
                              try {
                                const { data, error } = await supabase
                                  .from('growth_cards')
                                  .insert({
                                    card_type: 'year',
                                    title: `${year} Me`,
                                    year: year,
                                  })
                                  .select()
                                  .single();
                                
                                if (error) throw error;
                                
                                toast.success(`Created ${year} card`);
                                setCards(prev => [...prev, data as GrowthCard]);
                              } catch (error: any) {
                                if (error.code === '23505') {
                                  toast.error('A card for this year already exists');
                                } else {
                                  toast.error('Failed to create card');
                                }
                              }
                            }}
                          />
                        ) : item.card && (
                          <PastSelfCard
                            card={item.card}
                            dimensionValues={dimensionValues}
                            dimensionsByPillar={dimensionsByPillar}
                            onUpdateImage={(url) => updateCardImage(item.card!.id, url)}
                            onUpdateTitle={(title) => updateCardTitle(item.card!.id, title)}
                            onUpdateDimensionValue={(dimId, content) => updateDimensionValue(item.card!.id, dimId, content)}
                          />
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Timeline Footer */}
            <div className="mt-8 pt-6 border-t border-neutral-800/30">
              <p className="text-neutral-600 text-xs text-center italic">
                Each card represents a snapshot, not a frozen truth — feel free to revise your understanding.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Modals */}
      <CreateCardModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleCardCreated}
      />
      
      <DimensionManagerModal
        isOpen={showDimensionModal}
        onClose={() => setShowDimensionModal(false)}
        dimensions={dimensions}
        onDimensionsChange={loadData}
      />
    </div>
  );
};

export default GrowthTab;

