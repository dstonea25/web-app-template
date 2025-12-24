import React, { useState } from 'react';
import type { Okr, OkrPillar } from '../../types';
import { tokens, cn } from '../../theme/config';
import { X, Plus, Trash2 } from 'lucide-react';

interface QuarterlySetupModalProps {
  nextQuarter: string;
  previousOkrs: Okr[];
  onClose: () => void;
  onCreate: (okrsData: any[]) => Promise<void>;
}

interface KRDraft {
  description: string;
  type: string;
  target_value: number;
  direction: 'up' | 'down';
  baseline_value: number | null;
  data_source: 'manual' | 'habit' | 'metric';
  linked_habit_id: string | null;
  auto_sync: boolean;
}

interface OkrDraft {
  pillar: OkrPillar;
  objective: string;
  key_results: KRDraft[];
}

const PILLARS: OkrPillar[] = ['Power', 'Passion', 'Purpose', 'Production'];
const PILLAR_COLORS: Record<OkrPillar, string> = {
  Power: '#6EE7B7',
  Passion: '#FDA4AF',
  Purpose: '#A3E635',
  Production: '#5EEAD4',
};

export const QuarterlySetupModal: React.FC<QuarterlySetupModalProps> = ({
  nextQuarter,
  previousOkrs,
  onClose,
  onCreate,
}) => {
  // Initialize drafts from previous OKRs
  const [drafts, setDrafts] = useState<OkrDraft[]>(() => {
    return PILLARS.map((pillar) => {
      const prevOkr = previousOkrs.find((o) => o.pillar === pillar);
      return {
        pillar,
        objective: prevOkr?.objective || '',
        key_results: (prevOkr?.key_results || []).map((kr) => ({
          description: kr.description || '',
          type: (kr.kind as string) || 'count',
          target_value: Number(kr.target_value || 0),
          direction: kr.direction || 'up',
          baseline_value: kr.baseline_value || null,
          data_source: kr.data_source || 'manual',
          linked_habit_id: kr.linked_habit_id || null,
          auto_sync: kr.auto_sync || false,
        })),
      };
    });
  });

  const [creating, setCreating] = useState(false);

  const updateObjective = (pillar: OkrPillar, objective: string) => {
    setDrafts((prev) =>
      prev.map((d) => (d.pillar === pillar ? { ...d, objective } : d))
    );
  };

  const updateKR = (pillar: OkrPillar, index: number, updates: Partial<KRDraft>) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.pillar === pillar
          ? {
              ...d,
              key_results: d.key_results.map((kr, i) =>
                i === index ? { ...kr, ...updates } : kr
              ),
            }
          : d
      )
    );
  };

  const addKR = (pillar: OkrPillar) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.pillar === pillar
          ? {
              ...d,
              key_results: [
                ...d.key_results,
                {
                  description: '',
                  type: 'count',
                  target_value: 10,
                  direction: 'up' as const,
                  baseline_value: null,
                  data_source: 'manual' as const,
                  linked_habit_id: null,
                  auto_sync: false,
                },
              ],
            }
          : d
      )
    );
  };

  const removeKR = (pillar: OkrPillar, index: number) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.pillar === pillar
          ? {
              ...d,
              key_results: d.key_results.filter((_, i) => i !== index),
            }
          : d
      )
    );
  };

  const handleCreate = async () => {
    try {
      setCreating(true);
      await onCreate(drafts);
      onClose();
    } catch (error) {
      console.error('Failed to create quarterly OKRs:', error);
      alert(error instanceof Error ? error.message : 'Failed to create OKRs');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, 'text-neutral-100')}>
              Create {nextQuarter} OKRs
            </h3>
            <p className="text-sm text-neutral-400 mt-1">
              Pre-filled from previous quarter - edit as needed
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-100 transition-colors p-1"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {drafts.map((draft) => {
            const color = PILLAR_COLORS[draft.pillar];
            return (
              <div key={draft.pillar} className="space-y-3">
                <h4
                  className="text-lg font-semibold flex items-center gap-2"
                  style={{ color }}
                >
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  {draft.pillar}
                </h4>

                {/* Objective */}
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Objective:</label>
                  <input
                    type="text"
                    value={draft.objective}
                    onChange={(e) => updateObjective(draft.pillar, e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-neutral-900 border-neutral-800 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="What do you want to achieve this quarter?"
                  />
                </div>

                {/* Key Results */}
                <div className="space-y-2">
                  <label className="block text-sm text-neutral-400">Key Results:</label>
                  {draft.key_results.map((kr, index) => (
                    <div
                      key={index}
                      className="bg-neutral-800/50 rounded-lg p-3 flex items-center gap-3"
                    >
                      <span className="text-neutral-400 text-sm">{index + 1}.</span>
                      <input
                        type="text"
                        value={kr.description}
                        onChange={(e) =>
                          updateKR(draft.pillar, index, { description: e.target.value })
                        }
                        className="flex-1 px-2 py-1 border rounded bg-neutral-900 border-neutral-700 text-neutral-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        placeholder="Key result description"
                      />
                      <input
                        type="number"
                        value={kr.target_value}
                        onChange={(e) =>
                          updateKR(draft.pillar, index, { target_value: Number(e.target.value) })
                        }
                        className="w-16 px-2 py-1 border rounded bg-neutral-900 border-neutral-700 text-neutral-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        min={0}
                      />
                      {kr.linked_habit_id && (
                        <span className="text-xs text-teal-400" title="Habit-linked">
                          🔗
                        </span>
                      )}
                      <button
                        onClick={() => removeKR(draft.pillar, index)}
                        className="text-neutral-500 hover:text-rose-400 transition-colors p-1"
                        title="Remove key result"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addKR(draft.pillar)}
                    className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Key Result
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-neutral-900 border-t border-neutral-800 px-6 py-4 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={creating}
            className={cn(tokens.button.base, tokens.button.secondary)}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className={cn(tokens.button.base, tokens.button.primary)}
          >
            {creating ? 'Creating...' : `Create ${nextQuarter} OKRs`}
          </button>
        </div>
      </div>
    </div>
  );
};

