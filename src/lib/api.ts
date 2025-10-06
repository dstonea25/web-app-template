import type { SaveTodosRequest, SaveSessionsRequest, ApiResponse, Todo, TodoPatch, TodoFileItem, Idea, Session, Habit } from '../types';

// Mocked API client for MVP - all saves are stubbed
export class ApiClient {
  constructor() {
    // Base URL will be used for future webhook implementation
  }

  private async getSupabaseSafe(): Promise<{ supabase: any | null; isSupabaseConfigured: boolean }>{
    try {
      const mod = await import('./supabase.ts');
      return { supabase: (mod as any).supabase || null, isSupabaseConfigured: Boolean((mod as any).isSupabaseConfigured) };
    } catch {
      return { supabase: null, isSupabaseConfigured: false };
    }
  }

  // Stubbed method for saving todos
  async saveTodos(request: SaveTodosRequest): Promise<ApiResponse> {
    console.log('🔄 Mock API: Saving todos', request);
    
    // Simulate network delay (~300ms as per spec)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Mock success response
    return {
      success: true,
      data: {
        message: 'Todos saved successfully',
        count: request.todos.length,
        timestamp: new Date().toISOString()
      }
    };
  }

  // New mocked batch endpoint for todos
  async postTodosBatch(payload: { updates: TodoPatch[]; completes: string[] }): Promise<ApiResponse> {
    console.log('🔄 Mock API: Todos batch', payload);
    await new Promise(resolve => setTimeout(resolve, 300));
    return { success: true, data: { message: 'Todos batch applied', updates: payload.updates.length, completes: payload.completes.length } };
  }

  // New mocked full-file endpoint for todos
  async postTodosFile(payload: TodoFileItem[]): Promise<ApiResponse> {
    console.log('📄 Mock API: Todos file save', { count: payload.length, first: payload[0], last: payload[payload.length - 1] });
    await new Promise(resolve => setTimeout(resolve, 300));
    return { success: true, data: { message: 'Todos file saved', count: payload.length } };
  }

  // Stubbed method for saving sessions
  async saveSessions(request: SaveSessionsRequest): Promise<ApiResponse> {
    console.log('🔄 Mock API: Saving sessions', request);
    
    // Simulate network delay (~300ms as per spec)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Mock success response
    return {
      success: true,
      data: {
        message: 'Sessions saved successfully',
        count: request.sessions.length,
        timestamp: new Date().toISOString()
      }
    };
  }

  // New mocked webhook: complete a todo
  async postComplete(payload: { id: string; task: string; completed_at: string }): Promise<ApiResponse> {
    console.log('✅ Mock API: Complete todo', payload);
    await new Promise(resolve => setTimeout(resolve, 300));
    return { success: true, data: { message: 'Todo completed', ...payload } };
  }

  // --- Habit tracker mock endpoints (MVP) ---
  async loadHabitLedger(year: number): Promise<{ events: { habitId: string; date: string; complete: boolean }[]; habits: { id: string; name: string }[] }> {
    // Simulate 250ms latency and return a small in-memory dataset
    await new Promise(resolve => setTimeout(resolve, 250));
    const habits = [
      { id: 'move', name: 'Move' },
      { id: 'read', name: 'Read' },
      { id: 'meditate', name: 'Meditate' },
    ];
    const today = new Date();
    const events: { habitId: string; date: string; complete: boolean }[] = [];
    for (let i = 0; i < 15; i++) {
      const dt = new Date(today);
      dt.setDate(today.getDate() - i);
      if (dt.getFullYear() !== year) continue;
      const date = `${year}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      for (const h of habits) {
        if (i % (h.id.length + 2) === 0) events.push({ habitId: h.id, date, complete: true });
      }
    }
    return { events, habits };
  }

  async saveHabitLedger(_events: { habitId: string; date: string; complete: boolean }[]): Promise<ApiResponse> {
    // Simulate success; future will POST to webhook
    await new Promise(resolve => setTimeout(resolve, 250));
    return { success: true, data: { message: 'Habit ledger saved' } };
  }

  // --- Supabase-backed habit tracker helpers ---
  private habitsCache: Habit[] | null = null;
  private entriesCacheByYear: Map<number, { habitId: string; date: string; complete: boolean }[]> = new Map();
  private entriesCacheByHabitYear: Map<string, { habitId: string; date: string; complete: boolean }[]> = new Map();
  private static HABITS_CACHE_KEY = 'habits_cache_v1';
  private static ENTRIES_CACHE_KEY_PREFIX = 'habit_entries_'; // + year + _v1
  private static ENTRIES_CACHE_PER_HABIT_PREFIX = 'habit_entries_h_'; // + habitId + _ + year + _v1
  private inFlightHabitsPromise: Promise<Habit[]> | null = null;
  private inFlightEntriesPromises: Map<number, Promise<{ habitId: string; date: string; complete: boolean }[]>> = new Map();
  private inFlightEntriesPerHabit: Map<string, Promise<{ habitId: string; date: string; complete: boolean }[]>> = new Map();

  private readCache<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'data' in parsed) {
        return (parsed.data as T) || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  private writeCache<T>(key: string, data: T): void {
    try {
      const payload = { ts: Date.now(), data };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {}
  }

  getCachedHabits(): Habit[] | null {
    return this.readCache<Habit[]>(ApiClient.HABITS_CACHE_KEY);
  }

  getCachedHabitEntries(year: number): { habitId: string; date: string; complete: boolean }[] | null {
    return this.readCache<{ habitId: string; date: string; complete: boolean }[]>(`${ApiClient.ENTRIES_CACHE_KEY_PREFIX}${year}_v1`);
  }

  getCachedHabitEntriesForHabit(year: number, habitId: string): { habitId: string; date: string; complete: boolean }[] | null {
    return this.readCache<{ habitId: string; date: string; complete: boolean }[]>(`${ApiClient.ENTRIES_CACHE_PER_HABIT_PREFIX}${habitId}_${year}_v1`);
  }

  async fetchHabitsFromSupabase(): Promise<Habit[]> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) return [];
    if (this.habitsCache) return this.habitsCache;
    if (this.inFlightHabitsPromise) return this.inFlightHabitsPromise;
    const t0 = performance.now();
    this.inFlightHabitsPromise = (async () => {
      const { data, error } = await supabase
        .from('habits')
        .select('id, name')
        .order('created_at', { ascending: true });
      if (error) throw error;
      const habits = ((data || []) as { id: string; name: string }[]).map((h) => ({ id: h.id, name: h.name }));
      this.habitsCache = habits;
      this.writeCache(ApiClient.HABITS_CACHE_KEY, habits);
      const t1 = performance.now();
      // eslint-disable-next-line no-console
      console.log('supabase:fetchHabits ms:', Math.round(t1 - t0));
      return habits;
    })();
    try {
      return await this.inFlightHabitsPromise;
    } finally {
      this.inFlightHabitsPromise = null;
    }
  }

  async fetchHabitEntriesForYear(year: number): Promise<{ habitId: string; date: string; complete: boolean }[]> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) return [];
    const cached = this.entriesCacheByYear.get(year);
    if (cached) return cached;
    const inFlight = this.inFlightEntriesPromises.get(year);
    if (inFlight) return inFlight;
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const t0 = performance.now();
    const promise = (async () => {
      const { data, error } = await supabase
        .from('habit_entries')
        .select('habit_id, date, is_done')
        .gte('date', start)
        .lte('date', end);
      if (error) throw error;
      const entries = (data || []).map((row: any) => ({ habitId: row.habit_id, date: row.date, complete: !!row.is_done }));
      this.entriesCacheByYear.set(year, entries);
      this.writeCache(`${ApiClient.ENTRIES_CACHE_KEY_PREFIX}${year}_v1`, entries);
      const t1 = performance.now();
      // eslint-disable-next-line no-console
      console.log(`supabase:fetchEntries:${year} ms:`, Math.round(t1 - t0));
      return entries;
    })();
    this.inFlightEntriesPromises.set(year, promise);
    try {
      return await promise;
    } finally {
      this.inFlightEntriesPromises.delete(year);
    }
  }

  async fetchHabitEntriesForHabit(year: number, habitId: string): Promise<{ habitId: string; date: string; complete: boolean }[]> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) return [];
    const cacheKey = `${habitId}:${year}`;
    const cachedList = this.entriesCacheByHabitYear.get(cacheKey);
    if (cachedList) return cachedList;
    const inFlight = this.inFlightEntriesPerHabit.get(cacheKey);
    if (inFlight) return inFlight;
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const t0 = performance.now();
    const promise = (async () => {
      const { data, error } = await supabase
        .from('habit_entries')
        .select('habit_id, date, is_done')
        .eq('habit_id', habitId)
        .gte('date', start)
        .lte('date', end)
        .eq('is_done', true); // fetch only done; missing dates imply false
      if (error) throw error;
      const entries = (data || []).map((row: any) => ({ habitId: row.habit_id, date: row.date, complete: !!row.is_done }));
      this.entriesCacheByHabitYear.set(cacheKey, entries);
      this.writeCache(`${ApiClient.ENTRIES_CACHE_PER_HABIT_PREFIX}${habitId}_${year}_v1`, entries);
      const t1 = performance.now();
      // eslint-disable-next-line no-console
      console.log(`supabase:fetchEntries:habit:${habitId}:${year} ms:`, Math.round(t1 - t0));
      return entries;
    })();
    this.inFlightEntriesPerHabit.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      this.inFlightEntriesPerHabit.delete(cacheKey);
    }
  }

  async upsertHabitEntry(params: { habitId: string; date: string; isDone: boolean; source?: string }): Promise<ApiResponse> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) return { success: false, error: 'Supabase not configured' };
    const { habitId, date, isDone, source = 'frontend' } = params;
    const { error } = await supabase
      .from('habit_entries')
      .upsert(
        [{ habit_id: habitId, date, is_done: isDone, source }],
        { onConflict: 'habit_id,date' }
      );
    if (error) return { success: false, error: error.message };
    // Update caches optimistically for current year if present
    const year = Number(date.slice(0, 4));
    if (Number.isFinite(year)) {
      const list = this.entriesCacheByYear.get(year) || [];
      const idx = list.findIndex(e => e.habitId === habitId && e.date === date);
      if (idx >= 0) list[idx] = { habitId, date, complete: isDone };
      else list.push({ habitId, date, complete: isDone });
      this.entriesCacheByYear.set(year, list);
    }
    return { success: true };
  }

  // Future webhook endpoints (disabled in MVP)
  // private async makeRequest<T>(
  //   endpoint: string,
  //   method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  //   body?: any
  // ): Promise<ApiResponse<T>> {
  //   // This would be the real implementation for future webhooks
  //   throw new Error(`Webhook ${endpoint} not implemented in MVP`);
  // }
}

// Webhook configuration
// (Todos/Ideas webhooks removed as fallback; Supabase is required)
// const N8N_WEBHOOK_URL = 'https://geronimo.askdavidstone.com/webhook/todo';
// const N8N_SAVE_WEBHOOK_URL = 'https://geronimo.askdavidstone.com/webhook/save-todo';
// const N8N_IDEAS_WEBHOOK_URL = 'https://geronimo.askdavidstone.com/webhook/ideas';
// const N8N_SAVE_IDEAS_WEBHOOK_URL = 'https://geronimo.askdavidstone.com/webhook/save-ideas';
// const N8N_TIME_WEBHOOK_URL = 'https://geronimo.askdavidstone.com/webhook/time';
// const N8N_SAVE_TIME_WEBHOOK_URL = 'https://geronimo.askdavidstone.com/webhook/save-time';
const N8N_ALLOTMENTS_WEBHOOK_URL = 'https://geronimo.askdavidstone.com/webhook/allotments';
const N8N_SAVE_ALLOTMENTS_WEBHOOK_URL = 'https://geronimo.askdavidstone.com/webhook/save-allotments';
const N8N_LEDGER_WEBHOOK_URL = 'https://geronimo.askdavidstone.com/webhook/allotments-ledger';
const N8N_SAVE_LEDGER_WEBHOOK_URL = 'https://geronimo.askdavidstone.com/webhook/save-allotments-ledger';
const N8N_WEBHOOK_TOKEN = import.meta.env.VITE_N8N_WEBHOOK_TOKEN || '';

// Global loading states to prevent duplicate webhook calls
// let isLoadingTodos = false; // no longer needed without webhook fallback
// let isLoadingIdeas = false; // no longer needed without webhook fallback
// let isLoadingTime = false; // not used without webhook fallback
// let todosLoadingPromise: Promise<Todo[]> | null = null;
// let ideasLoadingPromise: Promise<Idea[]> | null = null;
// let timeLoadingPromise: Promise<Session[]> | null = null;

// Webhook function to fetch todos
export const fetchTodosFromWebhook = async (): Promise<Todo[]> => {
  const mod = await import('./supabase');
  const supabase = (mod as any).supabase as any | null;
  const isSupabaseConfigured = Boolean((mod as any).isSupabaseConfigured);
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured for Todos');
  }
  const { data, error } = await supabase
    .from('todos')
    .select('id, task, category, priority, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = (data || []) as { id: number; task: string; category: string | null; priority: string | null; created_at: string }[];
  return rows.map((row) => ({
    id: String(row.id),
    task: row.task,
    category: row.category ?? null,
    priority: (row.priority === 'low' || row.priority === 'medium' || row.priority === 'high') ? (row.priority as any) : null,
    created_at: row.created_at,
    statusUi: 'open' as const,
    _dirty: false,
  }));
};

// Webhook function to save todos
export const saveTodosToWebhook = async (todos: Todo[]): Promise<void> => {
  const mod = await import('./supabase');
  const supabase = (mod as any).supabase as any | null;
  const isSupabaseConfigured = Boolean((mod as any).isSupabaseConfigured);
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured for Todos');
  }
  const { data: existingRows, error: selErr } = await supabase
    .from('todos')
    .select('id');
  if (selErr) throw selErr;
  const existingIds = new Set<number>((existingRows || []).map((r: any) => Number(r.id)));
  const upserts = (todos || []).map((t) => ({
    id: Number(t.id || 0),
    task: t.task,
    category: t.category ?? null,
    priority: (t.priority === 'low' || t.priority === 'medium' || t.priority === 'high') ? t.priority : null,
    status: 'open',
  }));
  if (upserts.length > 0) {
    const { error: upsertErr } = await supabase
      .from('todos')
      .upsert(upserts, { onConflict: 'id' });
    if (upsertErr) throw upsertErr;
  }
  const newIds = new Set<number>(upserts.map((u) => Number(u.id)));
  const toDelete: number[] = [];
  existingIds.forEach((id) => { if (!newIds.has(id)) toDelete.push(id); });
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from('todos')
      .delete()
      .in('id', toDelete);
    if (delErr) throw delErr;
  }
};

// Webhook function to fetch ideas
export const fetchIdeasFromWebhook = async (): Promise<Idea[]> => {
  const mod = await import('./supabase');
  const supabase = (mod as any).supabase as any | null;
  const isSupabaseConfigured = Boolean((mod as any).isSupabaseConfigured);
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured for Ideas');
  }
  const { data, error } = await supabase
    .from('ideas')
    .select('id, idea, category, notes, status, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = (data || []) as { id: number; idea: string; category: string | null; notes: string | null; status: string | null; created_at: string }[];
  return rows.map((row) => ({
    id: String(row.id),
    idea: row.idea,
    category: row.category ?? null,
    notes: row.notes ?? '',
    created_at: row.created_at,
    status: (row.status === 'open' || row.status === 'closed') ? row.status : 'open',
    _dirty: false,
  }));
};

// Webhook function to save ideas
export const saveIdeasToWebhook = async (ideas: Idea[]): Promise<void> => {
  const mod = await import('./supabase');
  const supabase = (mod as any).supabase as any | null;
  const isSupabaseConfigured = Boolean((mod as any).isSupabaseConfigured);
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured for Ideas');
  }
  const { data: existingRows, error: selErr } = await supabase
    .from('ideas')
    .select('id');
  if (selErr) throw selErr;
  const existingIds = new Set<number>((existingRows || []).map((r: any) => Number(r.id)));
  const upserts = (ideas || []).map((it) => ({
    id: Number(it.id || 0),
    idea: it.idea,
    category: it.category ?? null,
    notes: it.notes ?? '',
    status: (it.status === 'open' || it.status === 'closed') ? it.status : 'open',
  }));
  if (upserts.length > 0) {
    const { error: upsertErr } = await supabase
      .from('ideas')
      .upsert(upserts, { onConflict: 'id' });
    if (upsertErr) throw upsertErr;
  }
  const newIds = new Set<number>(upserts.map((u) => Number(u.id)));
  const toDelete: number[] = [];
  existingIds.forEach((id) => { if (!newIds.has(id)) toDelete.push(id); });
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from('ideas')
      .delete()
      .in('id', toDelete);
    if (delErr) throw delErr;
  }
};

// Webhook function to fetch time sessions
export const fetchSessionsFromWebhook = async (): Promise<Session[]> => {
  const mod = await import('./supabase');
  const supabase = (mod as any).supabase as any | null;
  const isSupabaseConfigured = Boolean((mod as any).isSupabaseConfigured);
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured for Time Tracking');
  }
  const { data, error } = await supabase
    .from('time_ledger')
    .select('id, category, started_at, ended_at, minutes')
    .order('started_at', { ascending: true });
  if (error) throw error;
  const rows = (data || []) as { id: string; category: Session['category']; started_at: string; ended_at: string; minutes: number }[];
  return rows.map((r) => ({
    id: String(r.id),
    category: r.category,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    minutes: r.minutes,
  }));
};

// Webhook function to fetch recent time sessions (limit N, default 5)
export const fetchRecentSessionsFromWebhook = async (limit: number = 5): Promise<Session[]> => {
  const mod = await import('./supabase');
  const supabase = (mod as any).supabase as any | null;
  const isSupabaseConfigured = Boolean((mod as any).isSupabaseConfigured);
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured for Time Tracking');
  }
  const { data, error } = await supabase
    .from('time_ledger')
    .select('id, category, started_at, ended_at, minutes')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data || []) as { id: string; category: Session['category']; started_at: string; ended_at: string; minutes: number }[];
  return rows.map((r) => ({
    id: String(r.id),
    category: r.category,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    minutes: r.minutes,
  }));
};

// Webhook function to save time sessions
export const saveSessionsToWebhook = async (sessions: Session[]): Promise<void> => {
  const mod = await import('./supabase');
  const supabase = (mod as any).supabase as any | null;
  const isSupabaseConfigured = Boolean((mod as any).isSupabaseConfigured);
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured for Time Tracking');
  }
  if (!sessions || sessions.length === 0) return;
  const payload = sessions.map((s) => ({
    id: String(s.id),
    category: s.category,
    started_at: s.startedAt,
    ended_at: s.endedAt,
    minutes: s.minutes,
  }));
  const { error } = await supabase
    .from('time_ledger')
    .upsert(payload, { onConflict: 'id' });
  if (error) throw error;
};

// Webhook function to delete time sessions by id
export const deleteSessionsFromWebhook = async (ids: string[]): Promise<void> => {
  const mod = await import('./supabase');
  const supabase = (mod as any).supabase as any | null;
  const isSupabaseConfigured = Boolean((mod as any).isSupabaseConfigured);
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured for Time Tracking');
  }
  if (!ids || ids.length === 0) return;
  const numericOrStringIds = ids.map((id) => (Number.isFinite(Number(id)) ? Number(id) : String(id)));
  const { error } = await supabase
    .from('time_ledger')
    .delete()
    .in('id', numericOrStringIds);
  if (error) throw error;
};

// Webhook function to fetch allotments
export const fetchAllotmentsFromWebhook = async (): Promise<any> => {
  try {
    if (!N8N_WEBHOOK_TOKEN) {
      throw new Error('N8N webhook token not configured. Please set VITE_N8N_WEBHOOK_TOKEN in your environment.');
    }

    console.log('🔑 Using token:', N8N_WEBHOOK_TOKEN);
    console.log('🌐 Making request to:', N8N_ALLOTMENTS_WEBHOOK_URL);

    const response = await fetch(N8N_ALLOTMENTS_WEBHOOK_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${N8N_WEBHOOK_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ Allotments webhook response error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('❌ Error response body:', errorText);
      
      if (response.status === 401) {
        throw new Error('Authentication failed. Please check your VITE_N8N_WEBHOOK_TOKEN environment variable.');
      } else if (response.status === 404) {
        throw new Error('Webhook endpoint not found. Please check the webhook URL configuration.');
      } else {
        throw new Error(`Webhook error: ${response.status} - ${errorText || response.statusText}`);
      }
    }

    const data = await response.json();
    console.log('📦 Allotments webhook response data:', data);
    return data;
  } catch (error) {
    console.error('Failed to fetch allotments from webhook:', error);
    throw error;
  }
};

// Webhook function to save allotments
export const saveAllotmentsToWebhook = async (allotments: any): Promise<void> => {
  try {
    if (!N8N_WEBHOOK_TOKEN) {
      throw new Error('N8N webhook token not configured. Please set VITE_N8N_WEBHOOK_TOKEN in your environment.');
    }

    console.log('💾 Saving allotments to webhook...');
    console.log('📦 Allotments to save:', allotments);

    const response = await fetch(N8N_SAVE_ALLOTMENTS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${N8N_WEBHOOK_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(allotments),
    });

    if (!response.ok) {
      console.error('❌ Save allotments webhook response error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('❌ Error response body:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }

    console.log('✅ Allotments saved successfully to webhook');
  } catch (error) {
    console.error('❌ Failed to save allotments to webhook:', error);
    throw error;
  }
};

// Webhook function to fetch ledger
export const fetchLedgerFromWebhook = async (): Promise<string> => {
  try {
    if (!N8N_WEBHOOK_TOKEN) {
      throw new Error('N8N webhook token not configured. Please set VITE_N8N_WEBHOOK_TOKEN in your environment.');
    }

    console.log('🔑 Using token:', N8N_WEBHOOK_TOKEN);
    console.log('🌐 Making request to:', N8N_LEDGER_WEBHOOK_URL);

    const response = await fetch(N8N_LEDGER_WEBHOOK_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${N8N_WEBHOOK_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ Ledger webhook response error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('❌ Error response body:', errorText);
      
      if (response.status === 401) {
        throw new Error('Authentication failed. Please check your VITE_N8N_WEBHOOK_TOKEN environment variable.');
      } else if (response.status === 404) {
        throw new Error('Webhook endpoint not found. Please check the webhook URL configuration.');
      } else {
        throw new Error(`Webhook error: ${response.status} - ${errorText || response.statusText}`);
      }
    }

    const data = await response.json();
    console.log('📦 Ledger webhook response data:', data);
    
    // Handle empty response or missing data property
    if (!data || !data.data) {
      console.log('📦 Empty response from ledger webhook - returning empty string');
      return '';
    }

    return data.data; // Return the JSONL string
  } catch (error) {
    console.error('Failed to fetch ledger from webhook:', error);
    throw error;
  }
};

// Webhook function to save ledger
export const saveLedgerToWebhook = async (ledgerEvents: any[]): Promise<void> => {
  try {
    if (!N8N_WEBHOOK_TOKEN) {
      throw new Error('N8N webhook token not configured. Please set VITE_N8N_WEBHOOK_TOKEN in your environment.');
    }

    console.log('💾 Saving ledger to webhook...');
    console.log('📦 Ledger events to save:', ledgerEvents);

    const response = await fetch(N8N_SAVE_LEDGER_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${N8N_WEBHOOK_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ledgerEvents),
    });

    if (!response.ok) {
      console.error('❌ Save ledger webhook response error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('❌ Error response body:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }

    console.log('✅ Ledger saved successfully to webhook');
  } catch (error) {
    console.error('❌ Failed to save ledger to webhook:', error);
    throw error;
  }
};

// Export singleton instance
export const apiClient = new ApiClient();

// Export function for compatibility with spec
export const postToBackend = async (endpoint: string, data: any): Promise<ApiResponse> => {
  if (endpoint.includes('todo')) {
    return apiClient.saveTodos(data);
  } else if (endpoint.includes('session')) {
    return apiClient.saveSessions(data);
  }
  throw new Error(`Unknown endpoint: ${endpoint}`);
};

// Explicit complete endpoint for clarity with new spec
export const postComplete = async (todo: Todo & { completed_at: string }): Promise<ApiResponse> => {
  return apiClient.postComplete({ id: String(todo.id), task: todo.task, completed_at: todo.completed_at });
};

// Explicit export for batch API
export const postTodosBatch = async (payload: { updates: TodoPatch[]; completes: string[] }): Promise<ApiResponse> => {
  return apiClient.postTodosBatch(payload);
};

// Explicit export for full-file API
export const postTodosFile = async (payload: TodoFileItem[]): Promise<ApiResponse> => {
  return apiClient.postTodosFile(payload);
};
