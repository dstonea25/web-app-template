import { toast } from './notifications/toast';
import { supabase, isSupabaseConfigured } from './supabase';

// Global loading state to prevent duplicate webhook calls
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

// Shared thresholds for when to surface items in Coming Up
const WEEKLY_COMING_UP_DAYS = 3;
const NON_WEEKLY_COMING_UP_DAYS = 14; // monthly, quarterly, yearly

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

const parseJSONL = (text: string): LedgerEvent[] => {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const raw = JSON.parse(line);
      // Support both formats:
      // 1) { id, date, type }
      // 2) { type: 'redeem'|'failed', item, qty, ts, id }
      if (raw && typeof raw === 'object' && raw.item && raw.ts) {
        if (raw.type !== 'redeem') {
          // Ignore non-redeem events in MVP
          return null;
        }
        const iso = String(raw.ts);
        const date = iso.slice(0, 10);
        return { id: String(raw.id || crypto.randomUUID()), date, type: String(raw.item), ts: iso } as LedgerEvent;
      }
      return raw as LedgerEvent;
    })
    .filter((e): e is LedgerEvent => Boolean(e));
};

// ---- Device-timezone helpers (mirror backend behavior) ----
const MS_DAY = 24 * 60 * 60 * 1000;
const deviceTZ = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

function toISODateTZ(dUTC: Date, tz: string): string {
  // en-CA yields YYYY-MM-DD order
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(dUTC);
}

function partsTZ(dUTC: Date, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(dUTC).map(p => [p.type, p.value])
  );
  return { y: +parts.year, m: +parts.month, d: +parts.day, H: +parts.hour, M: +parts.minute, S: +parts.second };
}

function zonedUTC(tz: string, y: number, m: number, d: number, H = 0, M = 0, S = 0): Date {
  // Iteratively reach the UTC instant that corresponds to local wall-time in tz
  let t = Date.UTC(y, m - 1, d, H, M, S);
  for (let i = 0; i < 5; i++) {
    const got = partsTZ(new Date(t), tz);
    const dayDelta = (Date.UTC(y, m - 1, d) - Date.UTC(got.y, got.m - 1, got.d)) / MS_DAY;
    const secDelta = dayDelta * 86400 + (H - got.H) * 3600 + (M - got.M) * 60 + (S - got.S);
    if (secDelta === 0) break;
    t += secDelta * 1000;
  }
  return new Date(t);
}

function addLocalDays(y: number, m: number, d: number, days: number) {
  const dt = new Date(Date.UTC(y, m - 1, d + days, 0, 0, 0));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function mondayStart(nowUTC: Date, tz: string) {
  const p = partsTZ(nowUTC, tz);
  const today00 = zonedUTC(tz, p.y, p.m, p.d, 0, 0, 0);
  const localDow = today00.getUTCDay(); // 0=Sun..6=Sat (in local tz reference)
  const monIdx = (localDow + 6) % 7;    // 0=Mon..6=Sun
  const monDate = addLocalDays(p.y, p.m, p.d, -monIdx);
  return zonedUTC(tz, monDate.y, monDate.m, monDate.d, 0, 0, 0);
}
function monthStart(nowUTC: Date, tz: string) {
  const p = partsTZ(nowUTC, tz);
  return zonedUTC(tz, p.y, p.m, 1, 0, 0, 0);
}
function yearStart(nowUTC: Date, tz: string) {
  const p = partsTZ(nowUTC, tz);
  return zonedUTC(tz, p.y, 1, 1, 0, 0, 0);
}

function weekStartAt(dateUTC: Date, tz: string) {
  const p = partsTZ(dateUTC, tz);
  const day00 = zonedUTC(tz, p.y, p.m, p.d, 0, 0, 0);
  const localDow = day00.getUTCDay();
  const monIdx = (localDow + 6) % 7;
  const monDate = addLocalDays(p.y, p.m, p.d, -monIdx);
  return zonedUTC(tz, monDate.y, monDate.m, monDate.d, 0, 0, 0);
}
function monthStartAt(dateUTC: Date, tz: string) {
  const p = partsTZ(dateUTC, tz);
  return zonedUTC(tz, p.y, p.m, 1, 0, 0, 0);
}
function yearStartAt(dateUTC: Date, tz: string) {
  const p = partsTZ(dateUTC, tz);
  return zonedUTC(tz, p.y, 1, 1, 0, 0, 0);
}

function addWeeks(startUTC: Date, tz: string, weeks: number) {
  const p = partsTZ(startUTC, tz);
  const next = addLocalDays(p.y, p.m, p.d, weeks * 7);
  return zonedUTC(tz, next.y, next.m, next.d, 0, 0, 0);
}
function addMonths(startUTC: Date, tz: string, months: number) {
  const p = partsTZ(startUTC, tz);
  let y = p.y, m = p.m + months;
  y += Math.floor((m - 1) / 12);
  m = ((m - 1) % 12) + 1;
  return zonedUTC(tz, y, m, 1, 0, 0, 0);
}
function addYears(startUTC: Date, tz: string, years: number) {
  const p = partsTZ(startUTC, tz);
  return zonedUTC(tz, p.y + years, 1, 1, 0, 0, 0);
}

function buildWindow(nowUTC: Date, cadence: AllocationCadence, m: number, tz: string, eventsForItem: LedgerEvent[]) {
  const startNow = {
    weekly: (d: Date) => mondayStart(d, tz),
    monthly: (d: Date) => monthStart(d, tz),
    yearly: (d: Date) => yearStart(d, tz),
    quarterly: (d: Date) => monthStart(d, tz), // treat as month blocks of 3
  } as const;
  const startAt = {
    weekly: (d: Date) => weekStartAt(d, tz),
    monthly: (d: Date) => monthStartAt(d, tz),
    yearly: (d: Date) => yearStartAt(d, tz),
    quarterly: (d: Date) => monthStartAt(d, tz),
  } as const;
  const step = {
    weekly: (s: Date, n: number) => addWeeks(s, tz, n),
    monthly: (s: Date, n: number) => addMonths(s, tz, n),
    yearly: (s: Date, n: number) => addYears(s, tz, n),
    quarterly: (s: Date, n: number) => addMonths(s, tz, 3 * n),
  } as const;

  if (m <= 1) {
    const s = startNow[cadence](nowUTC);
    const e = step[cadence](s, 1);
    return { start: s, end: e };
  }

  const redemptions = (eventsForItem || [])
    .filter(e => e && e.type === 'redeem')
    .map(e => e.ts ? new Date(e.ts) : new Date(e.date + 'T00:00:00'))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (redemptions.length === 0) {
    const s = startNow[cadence](nowUTC);
    const e = step[cadence](s, cadence === 'quarterly' ? 3 * m / 3 : m);
    return { start: s, end: e };
  }

  // For multiplier > 1, find the current window based on the first redemption
  // but ensure we're not going backwards in time
  const first = redemptions[0];
  let s = startAt[cadence](first);
  
  // Find the current window that contains 'now'
  while (step[cadence](s, m) <= nowUTC) {
    s = step[cadence](s, m);
  }
  
  const e = step[cadence](s, m);
  return { start: s, end: e };
}

// Removed unused helpers startOfPeriodAfter and startOfCurrentPeriod

const daysUntil = (date: Date) => {
  const now = new Date();
  const ms = startOfDay(date).getTime() - startOfDay(now).getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export async function loadLedgerAndAllotments(): Promise<AllocationState> {
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
  // For webhook implementation, we'll need to handle this differently
  // Since we can't easily "undo" a webhook save, we'll just reload the current state
  // In a real implementation, you might want to add a "negative" ledger event
  toast.success(`Added back: ${type} (webhook reload)`);
  return await loadLedgerAndAllotments();
}

export async function admitDefeat(type: string): Promise<AllocationState> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured for Allocations');
  const id = `evt_${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_')}_${Math.random().toString(36).substr(2, 9)}`;
  const payload = [{ id, type: 'failed', item: type, qty: 1, ts: new Date().toISOString() }];
  const { error } = await supabase.from('allotment_ledger').insert(payload);
  if (error) throw error;
  return await loadLedgerAndAllotments();
}

export async function undoAdmitDefeat(type: string): Promise<AllocationState> {
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

export function getStats(state: AllocationState) {
  return state.stats;
}

// ---- Webhook persistence helpers for editing allocations list ----
export async function saveAllocationsItems(items: AllotmentItem[]): Promise<void> {
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

// Note: older helpers `calculateComingSoon` and `generateUnavailableList` were removed
// to keep a single source of truth in `recomputeDerived`.

function recomputeDerived(state: AllocationState): AllocationState {
  const now = new Date();
  const tz = deviceTZ();
  const available: AvailableItem[] = [];
  const coming_up: ComingUpItem[] = [];
  const unavailable: UnavailableItem[] = [];
  const usageCounts: Record<string, number> = {};
  const percentages: Record<string, number> = {};
  const nextReset: Record<string, string> = {};

  state.ledger.forEach(ev => {
    usageCounts[ev.type] = (usageCounts[ev.type] || 0) + 1;
  });

  state.items.forEach(item => {
    const mult = item.multiplier || 1;
    const itemEvents = state.ledger.filter(ev => ev.type === item.type);
    const window = buildWindow(now, item.cadence, mult, tz, itemEvents);
    const periodStart = window.start;
    const periodEnd = window.end;
    const usedThisPeriod = itemEvents.filter(ev => {
      const d = new Date(ev.date + 'T00:00:00');
      return d >= periodStart && d < periodEnd;
    }).length;

    let remaining = Math.max(0, item.quota - usedThisPeriod);
    // Hybrid: after first redeem in current anchored window, no remaining for rest of window
    if (mult > 1 && item.quota === 1 && usedThisPeriod > 0 && now >= periodStart && now < periodEnd) {
      remaining = 0;
    }
    const pctUsed = item.quota > 0 ? Math.min(100, Math.round((usedThisPeriod / item.quota) * 100)) : 0;
    percentages[item.type] = pctUsed;
    nextReset[item.type] = toISODateTZ(periodEnd, tz);

    if (remaining > 0) {
      available.push({ type: item.type, remaining, total: item.quota });
    }

    if (remaining <= 0) {
      // Always include in Unavailable
      const currentYear = now.getFullYear();
      const thisYearEvents = state.ledger
        .filter(ev => ev.type === item.type)
        .filter(ev => new Date(ev.date).getFullYear() === currentYear)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const lastRedeemed = thisYearEvents.length > 0 ? thisYearEvents[0].date : 'Never';
      const countThisYear = thisYearEvents.length;
      unavailable.push({ type: item.type, lastRedeemed, countThisYear });

      // Additionally in Coming Up if within threshold
      const days = daysUntil(periodEnd);
      const threshold = (item.cadence === 'weekly') ? WEEKLY_COMING_UP_DAYS : NON_WEEKLY_COMING_UP_DAYS;
      if (days <= threshold) {
        coming_up.push({ type: item.type, daysUntil: days, quotaAvailable: item.quota });
      }
    }
  });

  return {
    ...state,
    available,
    coming_up: coming_up.sort((a, b) => a.daysUntil - b.daysUntil),
    unavailable: unavailable.sort((a, b) => b.countThisYear - a.countThisYear),
    stats: { usageCounts, percentages, nextReset },
  };
}




