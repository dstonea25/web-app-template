import React, { useEffect, useRef, useState } from 'react';
import { cn, tokens } from '../theme/config';
import { loadLedgerAndAllotments, redeemItem, addAllocation, admitDefeat, undoAdmitDefeat, saveAllocationsItems, clearAllocationsOverrides, type AllocationState, type AllotmentItem, stageAllocationEdit, getStagedAllocationChanges, clearStagedAllocationChanges, applyStagedChangesToAllocations, stageAllocationRemove, fetchRecentRedemptions, deleteRedemptionById, unstageAllocationEdit, unstageAllocationRemove } from '../lib/allocations';
import RecentRedemptionsTable from '../components/RecentRedemptionsTable';
import { getCachedData, setCachedData } from '../lib/storage';
import { toast } from '../lib/notifications/toast';

export const AllocationsTab: React.FC<{ isVisible?: boolean }> = ({ isVisible = true }) => {
  const [state, setState] = useState<AllocationState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [recentRows, setRecentRows] = useState<{ id: string; item: string; ts: string; qty?: number }[]>([]);
  const UNDO_WINDOW_MS = 2500;
  const commitTimerRef = useRef<number | null>(null);
  const stateRef = useRef<AllocationState | null>(null);
  const prevEditRef = useRef<{ index: number; item: AllotmentItem } | null>(null);
  // Manual add inputs
  const [newItem, setNewItem] = useState('');
  const [newCadence, setNewCadence] = useState<'weekly'|'monthly'|'quarterly'|'yearly'>('monthly');
  const [newQuota, setNewQuota] = useState('');
  const [newMultiplier, setNewMultiplier] = useState('');
  const [editingCell, setEditingCell] = useState<{ index: number; field: 'type'|'quota'|'cadence'|'multiplier' } | null>(null);
  const handleSelectAll: React.FocusEventHandler<HTMLInputElement | HTMLSelectElement> = (e) => {
    // Small timeout ensures selection after focus paint
    setTimeout(() => {
      if ('select' in e.currentTarget) {
        try { (e.currentTarget as HTMLInputElement).select(); } catch {}
      }
    }, 0);
  };

  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!isVisible || hasLoadedRef.current) return;
    
    hasLoadedRef.current = true;
    (async () => {
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
        
        // Always check cache first - only bypass if explicitly refreshing
        const cachedState = getCachedData<AllocationState>('allocations-cache');
        if (cachedState && !forceRefresh) {
          console.log('📦 Loading allocations from cache');
          setState(cachedState);
          try {
            const list = await fetchRecentRedemptions(5);
            setRecentRows(list);
          } catch {}
          setLoading(false);
          return;
        }
        
        if (forceRefresh) {
          console.log('🔄 Force refresh requested - clearing cache and loading fresh data');
        }
        
        // Clear localStorage to force fresh data load
        localStorage.removeItem('allocations-cache');
        
        // Use the global loading function which handles duplicate calls
        console.log('🌐 Loading allocations...');
        const s = await loadLedgerAndAllotments();
        console.log('✅ Allocations loaded:', s);
        
        // Cache the data
        setCachedData('allocations-cache', s);
        setState(s);
        try {
          const list = await fetchRecentRedemptions(5);
          setRecentRows(list);
        } catch {}
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load allocations');
      } finally {
        setLoading(false);
      }
    })();
  }, [isVisible]);

  // Keep a ref of the latest state to avoid stale closures during auto-commit
  useEffect(() => { stateRef.current = state; }, [state]);

  // Auto-commit staged allocation changes after a short undo window
  const scheduleCommit = () => {
    if (commitTimerRef.current) {
      window.clearTimeout(commitTimerRef.current);
    }
    commitTimerRef.current = window.setTimeout(async () => {
      try {
        // Nothing to do if no staged field changes
        const staged = getStagedAllocationChanges();
        if ((staged.updates.length + staged.removes.length) === 0) return;
        // Save the current working items view derived from the latest base + staged changes
        const baseItems = stateRef.current ? stateRef.current.items : [];
        const itemsToSave = applyStagedChangesToAllocations(baseItems);
        await saveAllocationsItems(itemsToSave);
        const fresh = await loadLedgerAndAllotments();
        setState(fresh);
        setCachedData('allocations-cache', fresh);
        clearStagedAllocationChanges();
      } catch (err) {
        console.error('Allocations auto-save failed:', err);
        toast.error('Auto-save failed');
      }
    }, UNDO_WINDOW_MS);
  };

  // One-time recovery: if Chocolate Strawberry Bag is missing due to a saved override,
  // clear overrides and reload from file data.
  const recoveryRan = useRef(false);
  useEffect(() => {
    if (!state || recoveryRan.current) return;
    const hasChoco = state.items.some(i => i.type === 'Chocolate Strawberry Bag');
    if (!hasChoco) {
      (async () => {
        clearAllocationsOverrides();
        const fresh = await loadLedgerAndAllotments();
        setState(fresh);
      })();
    }
    recoveryRan.current = true;
  }, [state]);

  const handleRedeem = async (type: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Call redeemItem which now waits for webhook confirmation before returning
      const s = await redeemItem(type);
      setState(s);
      try {
        const list = await fetchRecentRedemptions(5);
        setRecentRows(list);
      } catch {}
      
      // Only show success toast after webhook confirms the save
      toast.success(`Redeemed: ${type}`, { ttlMs: 5000, actionLabel: 'Undo', onAction: async () => {
        const afterUndo = await addAllocation(type);
        setState(afterUndo);
      }, dismissible: true });
    } catch (e) {
      console.error('Failed to redeem:', e);
      setError(e instanceof Error ? e.message : 'Failed to redeem');
      toast.error(`Failed to redeem ${type}: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAdmitDefeat = async (type: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Call admitDefeat which now waits for webhook confirmation before returning
      const s = await admitDefeat(type);
      setState(s);
      try {
        const list = await fetchRecentRedemptions(5);
        setRecentRows(list);
      } catch {}
      
      // Only show success toast after webhook confirms the save
      toast.success(`😅 Heads up — you went over your ${type} limit. It happens but this fuck up has been logged.`, { 
        ttlMs: 8000, 
        actionLabel: 'Undo', 
        onAction: async () => {
          const afterUndo = await undoAdmitDefeat(type);
          setState(afterUndo);
        }, 
        dismissible: true 
      });
    } catch (e) {
      console.error('Failed to admit defeat:', e);
      setError(e instanceof Error ? e.message : 'Failed to admit defeat');
      toast.error(`Failed to log ${type} overage: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleManualAdd = async () => {
    if (!newItem.trim()) return;
    if (!state) return;
    const index = state.items.length;
    const prevState = state;
    const newAllocation: AllotmentItem = {
      type: newItem.trim(),
      quota: Number(newQuota) || 1,
      cadence: newCadence,
      multiplier: Number(newMultiplier) || 1,
    };
    // Stage as new row beyond base length and update working view
    stageAllocationEdit({ index, patch: { index, ...newAllocation, _isNew: true } as any });
    const working = applyStagedChangesToAllocations(state.items);
    setState({ ...state, items: working });
    toast.info('Added allocation', {
      ttlMs: UNDO_WINDOW_MS,
      actionLabel: 'Undo',
      onAction: () => {
        // Remove the staged new row and revert UI
        unstageAllocationEdit(index);
        setState(prev => prev ? { ...prev, items: prevState.items } : prev);
      }
    });
    scheduleCommit();
    // Reset form inputs
    setNewItem('');
    setNewQuota('1');
    setNewMultiplier('1');
    setNewCadence('monthly');
  };

  // Editable table helpers
  const updateItemUiOnly = (index: number, patch: Partial<AllotmentItem>) => {
    if (!state) return;
    setState(prev => {
      if (!prev) return prev;
      const items = prev.items.map((it, i) => (i === index ? { ...it, ...patch } : it));
      return { ...prev, items };
    });
  };

  const handleEditStart = (index: number, field: 'type'|'quota'|'cadence'|'multiplier') => {
    setEditingCell({ index, field });
    if (state) prevEditRef.current = { index, item: { ...state.items[index] } };
  };

  const commitItemEdit = (index: number) => {
    if (!state) return;
    const current = state.items[index];
    const prevSnapshot = prevEditRef.current && prevEditRef.current.index === index ? prevEditRef.current.item : null;
    stageAllocationEdit({ index, patch: { index, type: current.type, quota: current.quota, cadence: current.cadence, multiplier: current.multiplier } as any });
    toast.info('Updated allocation', {
      ttlMs: UNDO_WINDOW_MS,
      actionLabel: 'Undo',
      onAction: () => {
        if (!prevSnapshot) return;
        unstageAllocationEdit(index);
        setState(prev => prev ? { ...prev, items: prev.items.map((it, i) => (i === index ? prevSnapshot : it)) } : prev);
      }
    });
    scheduleCommit();
  };

  const removeItem = (index: number) => {
    if (!state) return;
    const prevItems = state.items;
    stageAllocationRemove(index);
    const working = applyStagedChangesToAllocations(state.items);
    setState({ ...state, items: working });
    toast.info('Removed allocation', {
      ttlMs: UNDO_WINDOW_MS,
      actionLabel: 'Undo',
      onAction: () => {
        unstageAllocationRemove(index);
        setState(prev => prev ? { ...prev, items: prevItems } : prev);
      }
    });
    scheduleCommit();
  };
  // Removed explicit commit and cancel flow in favor of auto-commit with undo window

  if (loading && isVisible) {
    return (
      <div className={tokens.layout.container}>
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            <div className={tokens.palette.dark.text_muted}>Loading allocations...</div>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={async ()=>{ clearAllocationsOverrides(); const fresh = await loadLedgerAndAllotments(); setState(fresh); }}
              className={cn(tokens.button.base, tokens.button.ghost, 'text-sm')}
            >
              Reset Overrides
            </button>
            <button
              onClick={async ()=>{ 
                const fresh = await loadLedgerAndAllotments(); 
                setState(fresh); 
              }}
              className={cn(tokens.button.base, tokens.button.ghost, 'text-sm')}
            >
              Reload
            </button>
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
            <div className="text-red-500 mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-neutral-100 mb-2">Failed to Load Allocations</h3>
            <p className="text-sm text-neutral-400 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className={cn(tokens.button.base, tokens.button.primary)}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!state) return null;

  // Sort items by cadence (weekly -> monthly -> yearly) then by quota (small to large)
  const sortedItems = [...state.items].sort((a, b) => {
    // First sort by cadence
    const cadenceOrder = { weekly: 1, monthly: 2, yearly: 3 };
    const cadenceDiff = (cadenceOrder[a.cadence as keyof typeof cadenceOrder] || 4) - 
                       (cadenceOrder[b.cadence as keyof typeof cadenceOrder] || 4);
    
    if (cadenceDiff !== 0) return cadenceDiff;
    
    // Then sort by quota (small to large)
    return a.quota - b.quota;
  });

  // const allTypes = state.items.map(i => i.type);
  // const availableTypes = new Set(state.available.map(item => item.type));
  const comingSoon = state.coming_up;
  const unavailableList = state.unavailable;

  return (
    <div className={cn(tokens.layout.container, !isVisible && 'hidden')}>
      {/* Available Section - Card layout grouped by cadence */}
      <div className={cn(tokens.card.base, 'mb-6')}>
        <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, 'mb-4', tokens.palette.dark.text)}>
          Available ({state.available.length})
        </h2>
        {(() => {
          // Group available items by cadence (weekly, monthly, yearly). Quarterly rolls into monthly.
          const cadenceByType = new Map(sortedItems.map(it => [it.type, it.cadence as 'weekly'|'monthly'|'quarterly'|'yearly']));
          const groups: Record<'weekly'|'monthly'|'yearly', typeof state.available> = {
            weekly: [],
            monthly: [],
            yearly: [],
          };
          state.available.forEach(av => {
            const cad = cadenceByType.get(av.type) || 'monthly';
            if (cad === 'yearly') groups.yearly.push(av);
            else if (cad === 'weekly') groups.weekly.push(av);
            else groups.monthly.push(av); // monthly or quarterly
          });

          const Section: React.FC<{ title: string; items: typeof state.available }> = ({ title, items }) => (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, 'text-neutral-100')}>{title}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.length === 0 ? (
                  <div className="col-span-full text-center text-neutral-400 py-6">No items</div>
                ) : (
                  items.map(item => (
                    <div key={item.type} className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900 flex flex-col items-center justify-center text-center min-h-[120px]">
                      <h4 className="font-semibold text-neutral-100 text-lg mb-2">{item.type}</h4>
                      <div className="text-neutral-400 mb-4">
                        <span className="font-semibold text-lg">{item.remaining} Available</span>
                      </div>
                      <button
                        onClick={() => handleRedeem(item.type)}
                        disabled={loading}
                        className={cn(tokens.button.base, tokens.button.success, 'text-sm')}
                      >
                        Redeem
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          );

          const hasAny = groups.weekly.length + groups.monthly.length + groups.yearly.length > 0;
          return (
            <div>
              {!hasAny && (
                <div className="text-center text-neutral-400 py-8">No available items</div>
              )}
              {groups.weekly.length > 0 && <Section title="Weekly" items={groups.weekly} />}
              {groups.monthly.length > 0 && <Section title="Monthly" items={groups.monthly} />}
              {groups.yearly.length > 0 && <Section title="Yearly" items={groups.yearly} />}
            </div>
          );
        })()}
      </div>

      {/* Coming Up Section - Card layout matching Available style */}
      <div className={cn(tokens.card.base, 'mb-6')}>
        <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, 'mb-4', tokens.palette.dark.text)}>
          Coming Up ({comingSoon.length})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {comingSoon.length === 0 ? (
            <div className="col-span-full text-center text-neutral-400 py-8">
              No items coming up soon
            </div>
          ) : (
            comingSoon.map(item => (
              <div key={item.type} className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900 flex flex-col justify-center min-h-[120px]">
                <h3 className="font-semibold text-neutral-100 text-lg mb-2">{item.type}</h3>
                <div className="text-amber-200">
                  <span className="font-semibold text-lg">{item.quotaAvailable}</span> available in <span className="font-semibold text-lg">{item.daysUntil}</span> days
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Unavailable Section - Compact list with last redeemed date and count */}
      <div className={cn(tokens.card.base)}>
        <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, 'mb-4', tokens.palette.dark.text)}>
          Unavailable ({unavailableList.length})
        </h2>
        <div className={tokens.table.wrapper}>
          <table className={tokens.table.table}>
            <thead className={tokens.table.thead}>
              <tr>
                <th className={tokens.table.th}>Item</th>
                <th className={tokens.table.th}>Last Redeemed</th>
                <th className={tokens.table.th}>Next Available</th>
                <th className={tokens.table.th}>Count This Year</th>
                <th className={tokens.table.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {unavailableList.length === 0 ? (
                <tr>
                  <td colSpan={5} className={tokens.table.empty_state}>
                    No unavailable items
                  </td>
                </tr>
              ) : (
                unavailableList.map(item => (
                  <tr key={item.type} className={cn(tokens.table.tr_zebra, tokens.table.row_hover)}>
                    <td className={tokens.table.td}>
                      <span className="font-medium text-neutral-400">{item.type}</span>
                    </td>
                    <td className={tokens.table.td}>
                      <span className="text-neutral-400">{item.lastRedeemed}</span>
                    </td>
                    <td className={tokens.table.td}>
                      <span className="text-neutral-400">{state.stats?.nextReset?.[item.type] || '-'}</span>
                    </td>
                    <td className={tokens.table.td}>
                      <span className="text-neutral-400">{item.countThisYear}</span>
                    </td>
                    <td className={tokens.table.td}>
                      <button
                        onClick={() => handleAdmitDefeat(item.type)}
                        disabled={loading}
                        className={cn(tokens.button.base, tokens.button.danger, 'text-sm')}
                      >
                        Admit Defeat
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Current Allocations + Manual Add */}
      <div className={cn(tokens.card.base, 'mt-6')}>
        <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, 'mb-4', tokens.palette.dark.text)}>
          Current Allocations
        </h2>

        {/* Manual Add Row */}
        <div className="mb-4">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.7fr)_auto] gap-3 items-end">
            <input
              type="text"
              placeholder="Item name"
              className={cn(tokens.input.base, tokens.input.focus, 'w-full')}
              value={newItem}
              onChange={(e)=>setNewItem(e.target.value)}
            />
            <input
              type="number"
              min={1}
              className={cn(tokens.input.base, tokens.input.focus, 'w-full')}
              placeholder="Quota"
              value={newQuota}
              onChange={(e)=>setNewQuota(e.target.value)}
              aria-label="Quota"
            />
            <select
              value={newCadence}
              onChange={(e)=>setNewCadence(e.target.value as any)}
              className={cn(tokens.input.base, tokens.input.focus, 'w-full')}
              aria-label="Cadence"
            >
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
              <option value="yearly">yearly</option>
            </select>
            <input
              type="number"
              min={1}
              className={cn(tokens.input.base, tokens.input.focus, 'w-full')}
              placeholder="Multiplier"
              value={newMultiplier}
              onChange={(e)=>setNewMultiplier(e.target.value)}
              aria-label="Multiplier"
            />
            <div className="flex justify-end">
              <button
                onClick={handleManualAdd}
                className={cn(tokens.button.base, tokens.button.primary)}
              >
                Add Allocation
              </button>
            </div>
          </div>
        </div>

        {/* Table (editable like Ideas) */}
        <div className={tokens.table.wrapper}>
          <table className={tokens.table.table}>
            <thead className={tokens.table.thead}>
              <tr>
                <th className={tokens.table.th}>Item</th>
                <th className={tokens.table.th}>Quota</th>
                <th className={tokens.table.th}>Cadence</th>
                <th className={tokens.table.th}>Multiplier</th>
                <th className={tokens.table.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((it, sortedIdx) => {
                // Find the original index in state.items
                const originalIdx = state.items.findIndex(item => item.type === it.type);
                return (
                  <tr key={it.type + sortedIdx} className={cn(tokens.table.tr_zebra, tokens.table.row_hover)}>
                    <td className={tokens.table.td}>
                      {editingCell?.index === originalIdx && editingCell?.field === 'type' ? (
                        <input
                          className={cn(tokens.input.base, tokens.input.focus)}
                          value={it.type}
                          onChange={(e)=>updateItemUiOnly(originalIdx, { type: e.target.value })}
                          onBlur={()=>{ commitItemEdit(originalIdx); setEditingCell(null); }}
                          onKeyDown={(e)=>{ if (e.key === 'Enter') { (e.currentTarget as HTMLInputElement).blur(); } }}
                          autoFocus
                        />
                      ) : (
                        <span className="cursor-pointer" onClick={()=>handleEditStart(originalIdx, 'type')}>{it.type}</span>
                      )}
                    </td>
                    <td className={tokens.table.td}>
                      {editingCell?.index === originalIdx && editingCell?.field === 'quota' ? (
                        <input
                          type="number"
                          min={0}
                          className={cn(tokens.input.base, tokens.input.focus, 'w-20')}
                          value={String(it.quota)}
                          onChange={(e)=>updateItemUiOnly(originalIdx, { quota: Number(e.target.value)||0 })}
                        onFocus={handleSelectAll}
                        ref={(el)=>{ if (el) { setTimeout(()=>{ try { el.select(); } catch {} }, 0); } }}
                        onBlur={()=>{ commitItemEdit(originalIdx); setEditingCell(null); }}
                        onKeyDown={(e)=>{ if (e.key === 'Enter') { (e.currentTarget as HTMLInputElement).blur(); } }}
                      />
                    ) : (
                      <span className="cursor-pointer" onClick={()=>handleEditStart(originalIdx, 'quota')}>{it.quota}</span>
                    )}
                  </td>
                  <td className={tokens.table.td}>
                    {editingCell?.index === originalIdx && editingCell?.field === 'cadence' ? (
                      <select
                        className={cn(tokens.input.base, tokens.input.focus)}
                        value={it.cadence}
                        onChange={(e)=>updateItemUiOnly(originalIdx, { cadence: e.target.value as any })}
                        autoFocus
                        onBlur={()=>{ commitItemEdit(originalIdx); setEditingCell(null); }}
                        onKeyDown={(e)=>{ if (e.key === 'Enter') { (e.currentTarget as HTMLSelectElement).blur(); } }}
                      >
                        <option value="weekly">weekly</option>
                        <option value="monthly">monthly</option>
                        <option value="yearly">yearly</option>
                      </select>
                    ) : (
                      <span className="cursor-pointer" onClick={()=>handleEditStart(originalIdx, 'cadence')}>{it.cadence}</span>
                    )}
                  </td>
                  <td className={tokens.table.td}>
                    {editingCell?.index === originalIdx && editingCell?.field === 'multiplier' ? (
                      <input
                        type="number"
                        min={1}
                        className={cn(tokens.input.base, tokens.input.focus, 'w-20')}
                        value={String(it.multiplier || 1)}
                        onChange={(e)=>updateItemUiOnly(originalIdx, { multiplier: Math.max(1, Number(e.target.value)||1) })}
                        onFocus={handleSelectAll}
                        ref={(el)=>{ if (el) { setTimeout(()=>{ try { el.select(); } catch {} }, 0); } }}
                        onBlur={()=>{ commitItemEdit(originalIdx); setEditingCell(null); }}
                        onKeyDown={(e)=>{ if (e.key === 'Enter') { (e.currentTarget as HTMLInputElement).blur(); } }}
                      />
                    ) : (
                      <span className="cursor-pointer" onClick={()=>handleEditStart(originalIdx, 'multiplier')}>{it.multiplier || 1}</span>
                    )}
                  </td>
                  <td className={tokens.table.td}>
                    <button
                      className={cn(tokens.button.base, tokens.button.secondary, 'text-sm')}
                      onClick={()=>removeItem(originalIdx)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Auto-commit active; explicit Save/Cancel removed */}
      </div>

      {/* Recent Redemptions */}
      <RecentRedemptionsTable
        rows={recentRows}
        onDelete={async (id) => {
          try {
            await deleteRedemptionById(id);
            const [s, list] = await Promise.all([
              loadLedgerAndAllotments(),
              fetchRecentRedemptions(5),
            ]);
            setState(s);
            setCachedData('allocations-cache', s);
            setRecentRows(list);
            toast.success('Redemption deleted');
          } catch (err) {
            console.error(err);
            toast.error('Failed to delete redemption');
          }
        }}
      />
    </div>
  );
};




