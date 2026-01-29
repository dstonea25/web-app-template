import { toast } from './notifications/toast';
import { supabase, isSupabaseConfigured } from './supabase';

// Database-backed Allocations (no legacy file/webhook fallback)
// - Fetch: Supabase RPC get_allocation_state_json(_tz, target_year) returns
//   { year, items, ledger, available, coming_up, unavailable, stats } which
//   maps 1:1 to AllocationState consumed by the UI.
// - Writes: direct DB writes
//   • saveAllocationsItems -> upsert to public.allotments on conflict (item) and delete removed
//   • redeemItem/admitDefeat -> insert rows into public.allotment_ledger
//   • undoAdmitDefeat -> delete most recent failed row for the given item
// Notes:
//   • LocalStorage overrides (OVERRIDE_ITEMS_KEY / MANUAL_ADDITIONS_KEY) remain for optional dev tweaking.
//   • All timezone computations rely on deviceTZ and server timestamptz storage.

// Global loading state to prevent duplicate RPC calls
let isLoadingAllocations = false;
let loadingPromise: Promise<AllocationState> | null = null;

export type AllocationCadence = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface AllotmentItem {
  type: string;
  quota: number;
  cadence: AllocationCadence;
  multiplier?: number; // number of cadence units per window (e.g., 2 months)
}

export interface AllocationPatch {
  index: number; // row index in items array
  type?: string;
  quota?: number;
  cadence?: AllocationCadence;
  multiplier?: number;
  _changedFields?: string[];
  _isNew?: boolean;
}

export interface AllotmentsFile {
  year: number;
  items: AllotmentItem[];
}

export interface LedgerEvent {
  id: string;
  date: string; // YYYY-MM-DD
  type: string; // matches AllotmentItem.type
  ts?: string;  // original timestamp if provided
}

// Lightweight shape for recent redemption rows
export interface RedemptionRow {
  id: string;
  item: string;
  ts: string; // ISO timestamp
  qty?: number;
}

export interface AvailableItem {
  type: string;
  remaining: number;
  total: number;
}

export interface ComingUpItem {
  type: string;
  daysUntil: number;
  quotaAvailable: number;
}

export interface UnavailableItem {
  type: string;
  lastRedeemed: string;
  countThisYear: number;
}

export interface DerivedBuckets {
  available: AvailableItem[];
  coming_up: ComingUpItem[];
  unavailable: UnavailableItem[];
}

export interface AllocationState extends DerivedBuckets {
  year: number;
  items: AllotmentItem[];
  ledger: LedgerEvent[];
  stats: {
    usageCounts: Record<string, number>;
    percentages: Record<string, number>;
    nextReset: Record<string, string>; // ISO date string for next reset per item
  };
}

const OVERRIDE_ITEMS_KEY = 'allocations.items.override';
const MANUAL_ADDITIONS_KEY = 'allocations.manual.additions';

// (Coming up thresholds were used in local derivation; RPC now computes these.)

// ---- Staging system for allocations (mirrors Ideas/Todos) ----
const getStagedAllocationUpdates = (): Map<number, AllocationPatch> => {
  try {
    const stored = sessionStorage.getItem('dashboard-staged-alloc-updates');
    if (stored) return new Map(JSON.parse(stored));
  } catch {}
  return new Map();
};
const saveStagedAllocationUpdates = (updates: Map<number, AllocationPatch>) => {
  try { sessionStorage.setItem('dashboard-staged-alloc-updates', JSON.stringify([...updates])); } catch {}
};
let stagedAllocUpdates = getStagedAllocationUpdates();
const getStagedAllocRemovals = (): Set<number> => {
  try { const stored = sessionStorage.getItem('dashboard-staged-alloc-removes'); if (stored) return new Set(JSON.parse(stored)); } catch {}
  return new Set();
};
const saveStagedAllocRemovals = (rem: Set<number>) => { try { sessionStorage.setItem('dashboard-staged-alloc-removes', JSON.stringify([...rem])); } catch {} };
let stagedAllocRemovals = getStagedAllocRemovals();

export const clearStagedAllocationChanges = (): void => {
  stagedAllocUpdates.clear();
  stagedAllocRemovals.clear();
  sessionStorage.removeItem('dashboard-staged-alloc-updates');
  sessionStorage.removeItem('dashboard-staged-alloc-removes');
};

export const stageAllocationEdit = ({ index, patch }: { index: number; patch: AllocationPatch }): void => {
  const existing = stagedAllocUpdates.get(index) || { index, _changedFields: [] };
  const base = getCurrentAllocationItems();
  const original = base[index] || {} as AllotmentItem;
  const changed = new Set(existing._changedFields || []);
  (['type','quota','cadence','multiplier'] as const).forEach((k)=>{
    if (patch[k] !== undefined) {
      if ((original as any)[k] !== patch[k]) changed.add(k); else changed.delete(k);
    }
  });
  if (changed.size === 0 && !existing._isNew && !patch._isNew) {
    stagedAllocUpdates.delete(index);
  } else {
    stagedAllocUpdates.set(index, { ...existing, ...patch, _changedFields: Array.from(changed) });
  }
  saveStagedAllocationUpdates(stagedAllocUpdates);
};

export const stageAllocationRemove = (index: number): void => {
  stagedAllocRemovals.add(index);
  if (stagedAllocUpdates.has(index)) stagedAllocUpdates.delete(index);
  saveStagedAllocRemovals(stagedAllocRemovals);
  saveStagedAllocationUpdates(stagedAllocUpdates);
};

// Undo helpers mirror Todos' ability to unstage changes during the toast undo window
export const unstageAllocationEdit = (index: number): void => {
  if (stagedAllocUpdates.has(index)) {
    stagedAllocUpdates.delete(index);
    saveStagedAllocationUpdates(stagedAllocUpdates);
  }
};

export const unstageAllocationRemove = (index: number): void => {
  if (stagedAllocRemovals.has(index)) {
    stagedAllocRemovals.delete(index);
    saveStagedAllocRemovals(stagedAllocRemovals);
  }
};

export const getStagedAllocationChanges = (): { updates: AllocationPatch[]; removes: number[]; fieldChangeCount: number } => {
  const updates = Array.from(stagedAllocUpdates.values());
  const removes = Array.from(stagedAllocRemovals.values());
  const fieldChangeCount = updates.reduce((sum,u)=> sum + (u._isNew ? 1 : (u._changedFields?.length || 0)), 0) + removes.length;
  return { updates, removes, fieldChangeCount };
};

export const applyStagedChangesToAllocations = (baseItems: AllotmentItem[]): AllotmentItem[] => {
  const updatesByIndex = new Map<number, AllocationPatch>(Array.from(stagedAllocUpdates.values()).map(p=>[p.index,p]));
  const working: AllotmentItem[] = [];
  baseItems.forEach((it, idx)=>{
    if (stagedAllocRemovals.has(idx)) return; // remove
    const patch = updatesByIndex.get(idx);
    if (!patch) { working.push(it); return; }
    const { _changedFields, _isNew, ...data } = patch;
    working.push({ ...it, ...data } as AllotmentItem);
  });
  // Newly added rows beyond base length
  Array.from(stagedAllocUpdates.values())
    .filter(p=>p._isNew && p.index >= baseItems.length)
    .forEach(p=>{
      const { _changedFields, _isNew, index, ...data } = p;
      working.push({ type: data.type || 'New Item', quota: data.quota || 1, cadence: data.cadence || 'monthly', multiplier: data.multiplier || 1 });
    });
  return working;
};

function getCurrentAllocationItems(): AllotmentItem[] {
  try {
    const overrideRaw = localStorage.getItem(OVERRIDE_ITEMS_KEY);
    if (overrideRaw) return JSON.parse(overrideRaw);
  } catch {}
  return [];
}

// Normalize cadence labels from external data to internal enum
function normalizeCadence(value: string): AllocationCadence {
  const v = String(value || '').toLowerCase();
  if (v === 'week' || v === 'weekly') return 'weekly';
  if (v === 'month' || v === 'monthly') return 'monthly';
  if (v === 'quarter' || v === 'quarterly') return 'quarterly';
  if (v === 'year' || v === 'yearly') return 'yearly';
  return 'monthly';
}

// (legacy JSONL parser removed; state now sourced via RPC)

// ---- Device-timezone helpers (mirror backend behavior) ----
const deviceTZ = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
// Removed legacy timezone window helpers; RPC provides derived windows and stats.

export async function loadLedgerAndAllotments(): Promise<AllocationState> {
  // Fetch derived allocation state from Supabase RPC. The RPC already computes
  // available/coming_up/unavailable/stats and returns year/items/ledger.
  // If already loading, return the existing promise
  if (isLoadingAllocations && loadingPromise) {
    console.log('⏳ Allocations already loading, returning existing promise');
    return loadingPromise;
  }
  isLoadingAllocations = true;
  loadingPromise = (async () => {
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase not configured for Allocations');
      }
      const tz = deviceTZ();
      const year = new Date().getFullYear();
      console.log('🌐 Loading allocations from Supabase RPC...', { tz, year });
      const { data, error } = await supabase.rpc('get_allocation_state_json', { _tz: tz, target_year: year });
      if (error) throw error;
      if (!data) throw new Error('No data returned from RPC');
      const state = data as AllocationState;
      // Optionally merge local overrides/additions for stub editing, preserving DB as source
      try {
        const overrideRaw = localStorage.getItem(OVERRIDE_ITEMS_KEY);
        const additionsRaw = localStorage.getItem(MANUAL_ADDITIONS_KEY);
        if (overrideRaw) {
          const overrideItems = JSON.parse(overrideRaw) as AllotmentItem[];
          state.items = overrideItems.map(i => ({ ...i, cadence: normalizeCadence(i.cadence as unknown as string), multiplier: Number(i.multiplier || 1), quota: Number(i.quota || 0) }));
        } else if (additionsRaw) {
          const additions = JSON.parse(additionsRaw) as AllotmentItem[];
          state.items = [...state.items, ...additions.map(i => ({ ...i, cadence: normalizeCadence(i.cadence as unknown as string), multiplier: Number(i.multiplier || 1), quota: Number(i.quota || 0) }))];
        }
      } catch { /* ignore */ }
      return state;
    } finally {
      isLoadingAllocations = false;
      loadingPromise = null;
    }
  })();
  return loadingPromise;
}

export async function redeemItem(type: string): Promise<AllocationState> {
  // Record a successful redemption event directly in public.allotment_ledger
  // and then reload state from RPC.
  // First check if the item is actually available before redeeming
  const currentState = await loadLedgerAndAllotments();
  const isAvailable = currentState.available.some(item => item.type === type && item.remaining > 0);
  
  if (!isAvailable) {
    throw new Error(`Cannot redeem ${type} - not available`);
  }
  
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured for Allocations');
  const id = `evt_${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_')}_${Math.random().toString(36).substr(2, 9)}`;
  const payload = [{ id, type: 'redeem', item: type, qty: 1, ts: new Date().toISOString() }];
  const { error } = await supabase.from('allotment_ledger').insert(payload);
  if (error) throw error;
  return await loadLedgerAndAllotments();
}

export async function addAllocation(type: string): Promise<AllocationState> {
  // Placeholder UX action: simply reload current state.
  // If we later support a true "undo" for redeem, handle it via a ledger row.
  toast.success(`Added back: ${type}`);
  return await loadLedgerAndAllotments();
}

export async function admitDefeat(type: string): Promise<AllocationState> {
  // Record an overage/failed event directly in public.allotment_ledger
  // and then reload state from RPC.
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured for Allocations');
  const id = `evt_${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_')}_${Math.random().toString(36).substr(2, 9)}`;
  const payload = [{ id, type: 'failed', item: type, qty: 1, ts: new Date().toISOString() }];
  const { error } = await supabase.from('allotment_ledger').insert(payload);
  if (error) throw error;
  return await loadLedgerAndAllotments();
}

export async function undoAdmitDefeat(type: string): Promise<AllocationState> {
  // Undo the most recent failed event for the item by deleting its row
  // and then reload state from RPC.
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured for Allocations');
  // Delete the most recent failed event for this item
  const { data: rows, error: selErr } = await supabase
    .from('allotment_ledger')
    .select('id, ts')
    .eq('type', 'failed')
    .eq('item', type)
    .order('ts', { ascending: false })
    .limit(1);
  if (selErr) throw selErr;
  const targetId = rows && rows[0]?.id;
  if (targetId) {
    const { error: delErr } = await supabase
      .from('allotment_ledger')
      .delete()
      .eq('id', targetId);
    if (delErr) throw delErr;
  }
  return await loadLedgerAndAllotments();
}

// getStats helper was used when deriving locally; with RPC it is redundant.
// export function getStats(state: AllocationState) { return state.stats; }

// ---- Recent redemptions helpers ----
export async function fetchRecentRedemptions(limit: number = 5): Promise<RedemptionRow[]> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured for Allocations');
  const { data, error } = await supabase
    .from('allotment_ledger')
    .select('id, item, ts, qty, type')
    .eq('type', 'redeem')
    .order('ts', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map((r: any) => ({ id: String(r.id), item: String(r.item), ts: String(r.ts), qty: r.qty })) as RedemptionRow[];
}

export async function deleteRedemptionById(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured for Allocations');
  const { error } = await supabase
    .from('allotment_ledger')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ---- Persistence helpers for editing allocations list ----
export async function saveAllocationsItems(items: AllotmentItem[]): Promise<void> {
  // Persist the editable items table into public.allotments using an upsert-on-item,
  // and delete any rows that are no longer present locally to keep DB as source of truth.
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured for Allocations');
  // Fetch existing items to compute deletions
  const { data: existing, error: selErr } = await supabase
    .from('allotments')
    .select('item');
  if (selErr) throw selErr;
  const existingItems = new Set<string>((existing || []).map((r: any) => String(r.item)));
  const upserts = items.map(it => ({
    item: it.type,
    quota: Number(it.quota || 0),
    cadence: it.cadence,
    multiplier: Number(it.multiplier || 1),
  }));
  if (upserts.length > 0) {
    const { error: upErr } = await supabase
      .from('allotments')
      .upsert(upserts, { onConflict: 'item' });
    if (upErr) throw upErr;
  }
  const newSet = new Set<string>(upserts.map(u => u.item));
  const toDelete: string[] = [];
  existingItems.forEach(it => { if (!newSet.has(it)) toDelete.push(it); });
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from('allotments')
      .delete()
      .in('item', toDelete);
    if (delErr) throw delErr;
  }
}

export function clearAllocationsOverrides(): void {
  try {
    localStorage.removeItem(OVERRIDE_ITEMS_KEY);
    localStorage.removeItem(MANUAL_ADDITIONS_KEY);
  } catch {}
}

// Local recomputeDerived removed; RPC is the single source of truth for derived state.




