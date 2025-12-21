import type { SaveTodosRequest, SaveSessionsRequest, ApiResponse, Todo, TodoPatch, TodoFileItem, Idea, IdeaPatch, Session, Habit, CurrentIntentionRow, IntentionStatsRow, UpsertIntentionInput, IntentionPillar, PrioritiesOverviewResponse, CommittedMilestoneRow, PriorityRecord, MilestoneRecord, ActiveFocusRow } from '../types';

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

  // ===== Priorities RPCs & CRUD =====
  async fetchPrioritiesOverview(): Promise<PrioritiesOverviewResponse[]> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase not configured');
    }
    
    try {
      // Try RPC first
      const { data, error } = await supabase.rpc('get_priorities_overview');
      if (error) throw error;
      const raw: any = data;
      if (Array.isArray(raw)) return raw as PrioritiesOverviewResponse[];
      if (raw && Array.isArray(raw.items)) return raw.items as PrioritiesOverviewResponse[];
      if (raw && Array.isArray(raw.rows)) return raw.rows as PrioritiesOverviewResponse[];
      throw new Error('RPC returned unexpected data format');
    } catch (rpcError) {
      console.warn('RPC get_priorities_overview failed, using direct table reads:', rpcError);
      // Fallback to direct table reads
      return await this.buildPrioritiesOverviewFromTables(supabase);
    }
  }

  async fetchCommittedMilestones(): Promise<CommittedMilestoneRow[]> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase not configured');
    }
    
    try {
      // Try RPC first
      const { data, error } = await supabase.rpc('get_committed_milestones');
      if (error) throw error;
      const raw: any = data;
      if (Array.isArray(raw)) return raw as CommittedMilestoneRow[];
      if (raw && Array.isArray(raw.items)) return raw.items as CommittedMilestoneRow[];
      if (raw && Array.isArray(raw.rows)) return raw.rows as CommittedMilestoneRow[];
      throw new Error('RPC returned unexpected data format');
    } catch (rpcError) {
      console.warn('RPC get_committed_milestones failed, using direct table reads:', rpcError);
      // Fallback to direct table reads
      return await this.buildCommittedMilestonesFromTables(supabase);
    }
  }

  // Direct table reads (no fallback data)
  private async buildPrioritiesOverviewFromTables(supabase: any): Promise<PrioritiesOverviewResponse[]> {
    // 1) Pillars
    const { data: pillars, error: pErr } = await supabase
      .from('pillars')
      .select('id, name, emoji, display_order')
      .order('display_order', { ascending: true });
    if (pErr) throw new Error(`Failed to fetch pillars: ${pErr.message}`);
    const pillarIds: string[] = (pillars || []).map((p: any) => p.id);
    if (pillarIds.length === 0) return [];

    // 2) Priorities for these pillars
    const { data: priorities, error: prErr } = await supabase
      .from('priorities')
      .select('id, pillar_id, title, description, status, importance, committed, created_at, updated_at')
      .in('pillar_id', pillarIds)
      .order('created_at', { ascending: true });
    if (prErr) throw new Error(`Failed to fetch priorities: ${prErr.message}`);
    const priorityIds: string[] = (priorities || []).map((r: any) => r.id);

    // 3) Milestones for these priorities
    const { data: milestones, error: mErr } = await supabase
      .from('milestones')
      .select('id, priority_id, title, notes, committed, completed, order_index, definition_of_done, due_date, created_at, updated_at')
      .in('priority_id', priorityIds.length > 0 ? priorityIds : ['00000000-0000-0000-0000-000000000000'])
      .order('created_at', { ascending: true });
    if (mErr) throw new Error(`Failed to fetch milestones: ${mErr.message}`);

    // Build nested structure
    const milestonesByPriority = new Map<string, any[]>();
    (milestones || []).forEach((m: any) => {
      const list = milestonesByPriority.get(m.priority_id) || [];
      list.push({
        milestone_id: String(m.id),
        title: m.title,
        committed: !!m.committed,
        completed: !!m.completed,
        definition_of_done: m.definition_of_done ?? null,
        due_date: m.due_date ?? null,
        created_at: m.created_at ?? null,
      });
      milestonesByPriority.set(m.priority_id, list);
    });

    const prioritiesByPillar = new Map<string, any[]>();
    (priorities || []).forEach((pr: any) => {
      const list = prioritiesByPillar.get(pr.pillar_id) || [];
      list.push({
        priority_id: String(pr.id),
        title: pr.title,
        status: pr.status ?? 'backlog',
        importance: pr.importance ?? null,
        committed: !!pr.committed,
        milestones: (milestonesByPriority.get(pr.id) || []).map((m) => ({
          milestone_id: m.milestone_id,
          title: m.title,
          committed: m.committed,
          completed: m.completed,
          definition_of_done: m.definition_of_done,
          due_date: m.due_date,
          created_at: m.created_at,
        })),
      });
      prioritiesByPillar.set(pr.pillar_id, list);
    });

    const result: PrioritiesOverviewResponse[] = (pillars || []).map((p: any) => ({
      pillar_id: String(p.id),
      pillar_name: p.name,
      emoji: p.emoji ?? null,
      priorities: prioritiesByPillar.get(p.id) || [],
    }));
    return result;
  }

  private async buildCommittedMilestonesFromTables(supabase: any): Promise<CommittedMilestoneRow[]> {
    // 1) committed milestones
    const { data: ms, error: mErr } = await supabase
      .from('milestones')
      .select('id, title, completed, priority_id, created_at')
      .eq('committed', true);
    if (mErr) throw new Error(`Failed to fetch committed milestones: ${mErr.message}`);
    if (!ms || ms.length === 0) return [];
    const priorityIds = Array.from(new Set((ms as any[]).map(r => r.priority_id)));

    // 2) priorities
    const { data: prs, error: pErr } = await supabase
      .from('priorities')
      .select('id, title, pillar_id')
      .in('id', priorityIds);
    if (pErr) throw new Error(`Failed to fetch priorities: ${pErr.message}`);
    const byPriority = new Map<string, any>((prs || []).map((r: any) => [r.id, r]));
    const pillarIds = Array.from(new Set((prs || []).map((r: any) => r.pillar_id)));

    // 3) pillars
    const { data: pils, error: piErr } = await supabase
      .from('pillars')
      .select('id, name, emoji')
      .in('id', pillarIds);
    if (piErr) throw new Error(`Failed to fetch pillars: ${piErr.message}`);
    const byPillar = new Map<string, any>((pils || []).map((r: any) => [r.id, r]));

    // 4) assemble
    const rows: CommittedMilestoneRow[] = (ms as any[]).map((r) => {
      const pr = byPriority.get(r.priority_id);
      const pil = pr ? byPillar.get(pr.pillar_id) : null;
      return {
        milestone_id: String(r.id),
        milestone_title: r.title,
        priority_title: pr?.title || '',
        pillar_name: pil?.name || '',
        emoji: pil?.emoji || null,
        due_date: null, // Not in schema
        completed: !!r.completed,
        definition_of_done: null, // Not in schema
        updated_at: r.created_at || new Date().toISOString(),
      } as CommittedMilestoneRow;
    });
    // Sort by created_at desc
    rows.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return rows;
  }

  async toggleMilestoneCommit(milestoneId: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    
    // First get current state
    const { data: current, error: fetchError } = await supabase
      .from('milestones')
      .select('committed')
      .eq('id', milestoneId)
      .single();
    
    if (fetchError) throw fetchError;
    
    // Toggle the committed state
    const { error } = await supabase
      .from('milestones')
      .update({ committed: !current.committed })
      .eq('id', milestoneId);
    
    if (error) throw error;
  }

  async toggleMilestoneComplete(milestoneId: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    
    // First get current state
    const { data: current, error: fetchError } = await supabase
      .from('milestones')
      .select('completed')
      .eq('id', milestoneId)
      .single();
    
    if (fetchError) throw fetchError;
    
    // Toggle the completed state
    const { error } = await supabase
      .from('milestones')
      .update({ completed: !current.completed })
      .eq('id', milestoneId);
    
    if (error) throw error;
  }

  async togglePriorityCommit(priorityId: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    
    // First get current state
    const { data: current, error: fetchError } = await supabase
      .from('priorities')
      .select('committed')
      .eq('id', priorityId)
      .single();
    
    if (fetchError) throw fetchError;
    
    // Toggle the committed state
    const { error } = await supabase
      .from('priorities')
      .update({ committed: !current.committed })
      .eq('id', priorityId);
    
    if (error) throw error;
  }

  async createPriority(record: PriorityRecord): Promise<string> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.from('priorities').insert({
      pillar_id: record.pillar_id,
      title: record.title,
      description: record.description ?? null,
      status: record.status ?? 'backlog',
      importance: record.importance ?? null,
      committed: record.committed ?? false,
    }).select('id').single();
    if (error) throw error;
    return String((data as any).id);
  }

  async updatePriority(id: string, patch: Partial<PriorityRecord>): Promise<void> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.from('priorities').update(patch).eq('id', id);
    if (error) throw error;
  }

  async deletePriority(id: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.from('priorities').delete().eq('id', id);
    if (error) throw error;
  }

  async createMilestone(record: MilestoneRecord): Promise<string> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.from('milestones').insert({
      priority_id: record.priority_id,
      title: record.title,
      notes: record.notes ?? null,
      committed: record.committed ?? false,
      completed: record.completed ?? false,
      order_index: record.order_index ?? null,
      definition_of_done: record.definition_of_done ?? null,
      due_date: record.due_date ?? null,
    }).select('id').single();
    if (error) throw error;
    return String((data as any).id);
  }

  async updateMilestone(id: string, patch: Partial<MilestoneRecord>): Promise<void> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.from('milestones').update(patch).eq('id', id);
    if (error) throw error;
  }

  async deleteMilestone(id: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.from('milestones').delete().eq('id', id);
    if (error) throw error;
  }

  async fetchActiveFocus(): Promise<ActiveFocusRow[]> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase not configured');
    }
    
    try {
      // Try RPC first
      const { data, error } = await supabase.rpc('get_active_focus');
      if (error) throw error;
      const raw: any = data;
      if (Array.isArray(raw)) return raw as ActiveFocusRow[];
      if (raw && Array.isArray(raw.items)) return raw.items as ActiveFocusRow[];
      if (raw && Array.isArray(raw.rows)) return raw.rows as ActiveFocusRow[];
      throw new Error('RPC returned unexpected data format');
    } catch (rpcError) {
      console.warn('RPC get_active_focus failed, using direct table reads:', rpcError);
      // Fallback to direct table reads: only committed priorities with their committed milestones
      return await this.buildActiveFocusFromTables(supabase);
    }
  }

  private async buildActiveFocusFromTables(supabase: any): Promise<ActiveFocusRow[]> {
    // Get committed priorities
    const { data: priorities, error: prErr } = await supabase
      .from('priorities')
      .select('id, pillar_id, title, description, status, importance, committed, created_at, updated_at')
      .eq('committed', true);
    if (prErr) throw new Error(`Failed to fetch committed priorities: ${prErr.message}`);
    
    if (!priorities || priorities.length === 0) return [];
    
    const prIds = priorities.map((r: any) => r.id);
    
    // Get committed milestones for these priorities
    const { data: milestones, error: msErr } = await supabase
      .from('milestones')
      .select('id, title, committed, completed, priority_id')
      .eq('committed', true)
      .in('priority_id', prIds);
    if (msErr) throw new Error(`Failed to fetch committed milestones: ${msErr.message}`);
    
    // Get pillar info
    const pillarIds = [...new Set(priorities.map((p: any) => p.pillar_id))];
    const { data: pillars, error: piErr } = await supabase
      .from('pillars')
      .select('id, name, emoji')
      .in('id', pillarIds);
    if (piErr) throw new Error(`Failed to fetch pillars: ${piErr.message}`);
    
    const byPillar = new Map<string, any>((pillars || []).map((p: any) => [p.id, p]));
    
    // Group milestones by priority
    const milestonesByPriority = new Map<string, any[]>();
    (milestones || []).forEach((m: any) => {
      const list = milestonesByPriority.get(m.priority_id) || [];
      list.push({
        milestone_id: String(m.id),
        title: m.title,
        committed: !!m.committed,
        completed: !!m.completed,
      });
      milestonesByPriority.set(m.priority_id, list);
    });
    
    // Build ActiveFocusRow array
    const result: ActiveFocusRow[] = (priorities || []).map((pr: any) => {
      const pillar = byPillar.get(pr.pillar_id);
      return {
        pillar_id: String(pr.pillar_id),
        pillar_name: pillar?.name || '',
        emoji: pillar?.emoji || null,
        priority_id: String(pr.id),
        priority_title: pr.title,
        priority_committed: true,
        milestones: milestonesByPriority.get(pr.id) || [],
      };
    });
    
    return result;
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
    
    // Update habit entry
    const { error } = await supabase
      .from('habit_entries')
      .upsert(
        [{ habit_id: habitId, date, is_done: isDone, source }],
        { onConflict: 'habit_id,date' }
      );
    if (error) return { success: false, error: error.message };
    
    // Streaks are automatically updated by database trigger
    
    // Update caches optimistically for current year if present
    const year = Number(date.slice(0, 4));
    if (Number.isFinite(year)) {
      const list = this.entriesCacheByYear.get(year) || [];
      const idx = list.findIndex(e => e.habitId === habitId && e.date === date);
      if (idx >= 0) list[idx] = { habitId, date, complete: isDone };
      else list.push({ habitId, date, complete: isDone });
      this.entriesCacheByYear.set(year, list);

      // Keep per-habit yearly cache in sync as well (this cache only stores completed entries)
      const perHabitKey = `${habitId}:${year}`;
      const perList = this.entriesCacheByHabitYear.get(perHabitKey) || [];
      const i = perList.findIndex(e => e.date === date);
      if (isDone) {
        if (i >= 0) perList[i] = { habitId, date, complete: true };
        else perList.push({ habitId, date, complete: true });
      } else if (i >= 0) {
        perList.splice(i, 1);
      }
      this.entriesCacheByHabitYear.set(perHabitKey, perList);
      // Persist per-habit cache to localStorage so immediate refetch reflects the latest state
      this.writeCache(`${ApiClient.ENTRIES_CACHE_PER_HABIT_PREFIX}${habitId}_${year}_v1`, perList);
    }
    return { success: true };
  }

  // ===== Habit Stats =====
  async fetchHabitYearlyStats(year: number): Promise<import('../types').HabitYearlyStats[]> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) return [];
    
    // Fetch from existing habit_streaks table (contains current year data)
    const { data, error } = await supabase
      .from('habit_streaks')
      .select('id, habit_id, longest_streak, longest_cold_streak, current_streak, last_completed_date, weekly_goal, updated_at')
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Failed to fetch habit streaks:', error);
      throw error;
    }
    
    // Transform to match HabitYearlyStats interface
    return (data || []).map(row => ({
      id: row.id,
      habit_id: row.habit_id,
      year: year, // Current year
      longest_hot_streak: row.longest_streak || 0,
      longest_cold_streak: row.longest_cold_streak || 0,
      total_completions: 0, // Not tracked in habit_streaks, could calculate if needed
      first_completion_date: null,
      last_completion_date: row.last_completed_date,
      weekly_goal: row.weekly_goal,
      updated_at: row.updated_at
    })) as import('../types').HabitYearlyStats[];
  }

  async updateHabitWeeklyGoal(habitId: string, weeklyGoal: number | null): Promise<void> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    
    const { error } = await supabase
      .from('habit_streaks')
      .update({ weekly_goal: weeklyGoal, updated_at: new Date().toISOString() })
      .eq('habit_id', habitId);
    
    if (error) throw error;
  }

  async fetchHabitWeeklyAchievements(year: number): Promise<import('../types').HabitWeeklyAchievement[]> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) return [];
    
    const { data, error } = await supabase
      .from('habit_weekly_achievements')
      .select('*')
      .eq('year', year)
      .order('week_number', { ascending: true });
    
    if (error) {
      console.error('Failed to fetch weekly achievements:', error);
      throw error;
    }
    
    return (data || []) as import('../types').HabitWeeklyAchievement[];
  }

  async calculateRollingHabitStats(habitId: string, windowDays: number = 90): Promise<{ monthly_average: number; weekly_average: number }> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) return { monthly_average: 0, weekly_average: 0 };

    const { data, error } = await supabase
      .rpc('calculate_rolling_habit_stats', {
        p_habit_id: habitId,
        p_window_days: windowDays
      });

    if (error) {
      console.error('Failed to calculate rolling stats for habit:', habitId, error);
      throw error;
    }

    console.log('Raw RPC response for habit', habitId, ':', data);

    // Handle both array and single object responses
    const result = Array.isArray(data) ? data[0] : data;
    
    return {
      monthly_average: Number(result?.monthly_average || 0),
      weekly_average: Number(result?.weekly_average || 0)
    };
  }

  async fetchHabitRollingStats(
    habitId: string,
    windowDays: 30 | 60 | 90 = 30
  ): Promise<import('../types').HabitRollingStats> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) {
      return { monthly_average: 0, weekly_average: 0 };
    }
    
    const { data, error } = await supabase
      .rpc('calculate_rolling_habit_stats', {
        p_habit_id: habitId,
        p_window_days: windowDays
      });
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return { monthly_average: 0, weekly_average: 0 };
    }
    
    return {
      monthly_average: Number(data[0].monthly_average) || 0,
      weekly_average: Number(data[0].weekly_average) || 0
    };
  }

  async fetchAllHabitsRollingStats(
    habitIds: string[],
    windowDays: 30 | 60 | 90 = 30
  ): Promise<Map<string, import('../types').HabitRollingStats>> {
    const results = await Promise.all(
      habitIds.map(async id => ({
        id,
        stats: await this.fetchHabitRollingStats(id, windowDays)
      }))
    );
    
    return new Map(results.map(r => [r.id, r.stats]));
  }

  // ===== Calendar Events =====
  async fetchCalendarEventsForYear(year: number): Promise<import('../types').CalendarEvent[]> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    // Fetch events that overlap with this year
    // An event overlaps if: start_date <= year_end AND end_date >= year_start
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .lte('start_date', endDate)
      .gte('end_date', startDate)
      .order('start_date', { ascending: true });
    
    if (error) throw error;
    return (data || []) as import('../types').CalendarEvent[];
  }

  async fetchCalendarEventsForDate(date: string): Promise<import('../types').CalendarEvent[]> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    
    // Fetch events that overlap with this specific date
    // An event overlaps if: start_date <= date AND end_date >= date
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .lte('start_date', date)
      .gte('end_date', date)
      .order('priority', { ascending: false });  // Higher priority first
    
    if (error) throw error;
    return (data || []) as import('../types').CalendarEvent[];
  }

  async createCalendarEvent(input: import('../types').CalendarEventInput): Promise<string> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        title: input.title,
        category: input.category ?? null,
        notes: input.notes ?? null,
        start_date: input.start_date,
        end_date: input.end_date || input.start_date, // Default to start_date
        start_time: input.start_time ?? null,
        end_time: input.end_time ?? null,
        all_day: input.all_day ?? true,
        affects_row_appearance: input.affects_row_appearance ?? false,
        priority: input.priority ?? 5,
        is_pto: input.is_pto ?? false,
        source_pattern_id: input.source_pattern_id ?? null,
      })
      .select('id')
      .single();
    
    if (error) throw error;
    return String((data as any).id);
  }

  async updateCalendarEvent(id: string, patch: Partial<import('../types').CalendarEventInput>): Promise<void> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    
    const updateData: any = {};
    if (patch.title !== undefined) updateData.title = patch.title;
    if (patch.category !== undefined) updateData.category = patch.category;
    if (patch.notes !== undefined) updateData.notes = patch.notes;
    if (patch.start_date !== undefined) updateData.start_date = patch.start_date;
    if (patch.end_date !== undefined) updateData.end_date = patch.end_date;
    if (patch.start_time !== undefined) updateData.start_time = patch.start_time;
    if (patch.end_time !== undefined) updateData.end_time = patch.end_time;
    if (patch.all_day !== undefined) updateData.all_day = patch.all_day;
    if (patch.affects_row_appearance !== undefined) updateData.affects_row_appearance = patch.affects_row_appearance;
    if (patch.priority !== undefined) updateData.priority = patch.priority;
    if (patch.is_pto !== undefined) updateData.is_pto = patch.is_pto;
    if (patch.source_pattern_id !== undefined) updateData.source_pattern_id = patch.source_pattern_id;
    
    const { error } = await supabase
      .from('calendar_events')
      .update(updateData)
      .eq('id', id);
    
    if (error) throw error;
  }

  async deleteCalendarEvent(id: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // ===== Calendar Patterns =====
  async fetchCalendarPatterns(): Promise<import('../types').CalendarPattern[]> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    
    const { data, error } = await supabase
      .from('calendar_patterns')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []) as import('../types').CalendarPattern[];
  }

  async fetchActiveCalendarPatterns(): Promise<import('../types').CalendarPattern[]> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    
    const { data, error } = await supabase
      .from('calendar_patterns')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []) as import('../types').CalendarPattern[];
  }

  async createCalendarPattern(input: import('../types').CalendarPatternInput): Promise<string> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    
    const { data, error } = await supabase
      .from('calendar_patterns')
      .insert({
        name: input.name,
        pattern_type: input.pattern_type,
        category: input.category ?? null,
        notes: input.notes ?? null,
        start_date: input.start_date ?? null,
        end_date: input.end_date ?? null,
        rule_json: input.rule_json || {},
        default_affects_row_appearance: input.default_affects_row_appearance ?? false,
        default_priority: input.default_priority ?? 5,
        is_active: input.is_active ?? true,
      })
      .select('id')
      .single();
    
    if (error) throw error;
    return String((data as any).id);
  }

  async updateCalendarPattern(id: string, patch: Partial<import('../types').CalendarPatternInput>): Promise<void> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    
    const { error } = await supabase
      .from('calendar_patterns')
      .update(patch)
      .eq('id', id);
    
    if (error) throw error;
  }

  async deleteCalendarPattern(id: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    
    const { error } = await supabase
      .from('calendar_patterns')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // ===== Calendar Natural Language Parsing =====
  async parseNaturalLanguageEvent(text: string, context?: { currentDate?: string }): Promise<import('../types').CalendarEventInput> {
    // TODO: Replace with your actual n8n webhook URL
    const WEBHOOK_URL = 'https://geronimo.askdavidstone.com/webhook/calendar-nl-parse';
    const N8N_WEBHOOK_TOKEN = import.meta.env.VITE_N8N_WEBHOOK_TOKEN || '';
    
    if (!N8N_WEBHOOK_TOKEN) {
      console.warn('N8N webhook token not set. NL parsing may fail without authentication.');
    }
    
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${N8N_WEBHOOK_TOKEN}`
        },
        body: JSON.stringify({
          text,
          context: {
            currentDate: context?.currentDate || new Date().toISOString().split('T')[0],
          }
        })
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Check N8N webhook token.');
        }
        throw new Error(`Webhook returned ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to parse event');
      }
      
      return result.parsed;
    } catch (error) {
      console.error('NL parsing failed:', error);
      throw error;
    }
  }

  // ===== Pattern Event Generation =====
  async generatePatternEvents(patternId: string, period?: { start_date: string; end_date: string }): Promise<{ count: number; events: any[] }> {
    // TODO: Replace with your actual n8n webhook URL
    const WEBHOOK_URL = 'https://geronimo.askdavidstone.com/webhook/calendar-generate-pattern-events';
    const N8N_WEBHOOK_TOKEN = import.meta.env.VITE_N8N_WEBHOOK_TOKEN || '';
    
    if (!N8N_WEBHOOK_TOKEN) {
      console.warn('N8N webhook token not set. Pattern generation may fail without authentication.');
    }
    
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${N8N_WEBHOOK_TOKEN}`
        },
        body: JSON.stringify({
          pattern_id: patternId,
          generate_for_period: period || {
            start_date: new Date().toISOString().split('T')[0],
            end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 60 days
          }
        })
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Check N8N webhook token.');
        }
        throw new Error(`Webhook returned ${response.status}`);
      }
      
      const result = await response.json();
      return { count: result.total_events_created || 0, events: result.events_created || [] };
    } catch (error) {
      console.error('Pattern generation failed:', error);
      throw error;
    }
  }
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
// const N8N_INTENTIONS_LOCK_WEBHOOK_URL = 'https://geronimo.askdavidstone.com/webhook/intentions-lock'; // v2
const N8N_WEBHOOK_TOKEN = import.meta.env.VITE_N8N_WEBHOOK_TOKEN || '';
// Prefer not to require a URL env; default to provided intentions-set endpoint, allow override via env
const N8N_INTENTIONS_PING_URL = (import.meta.env.VITE_N8N_INTENTIONS_PING_URL as string) || 'https://geronimo.askdavidstone.com/webhook/intentions-set';
// const INTENTIONS_RESET_RPC = import.meta.env.VITE_INTENTIONS_RESET_RPC || 'reset_intentions_daily'; // deprecated

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
    .select('id, task, category, priority, effort, due_date, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = (data || []) as { id: number; task: string; category: string | null; priority: string | null; effort: 'S' | 'M' | 'L' | null; due_date: string | null; created_at: string }[];
  return rows.map((row) => ({
    id: String(row.id),
    task: row.task,
    category: row.category ?? null,
    priority: (row.priority === 'crucial' ? 'critical' : row.priority === 'high' || row.priority === 'medium' || row.priority === 'low' || row.priority === 'critical') ? ((row.priority === 'crucial' ? 'critical' : row.priority) as any) : null,
    effort: (row.effort === 'S' || row.effort === 'M' || row.effort === 'L') ? row.effort : null,
    due_date: row.due_date ?? null,
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
  // Safety guard: never allow destructive empty saves
  if (!Array.isArray(todos) || todos.length === 0) {
    throw new Error('Refusing to save empty todos list');
  }
  const { error: selErr } = await supabase
    .from('todos')
    .select('id');
  if (selErr) throw selErr;
  const upserts = (todos || []).map((t) => ({
    id: Number(t.id || 0),
    task: t.task,
    category: t.category ?? null,
    priority: (t.priority === 'critical' || t.priority === 'high' || t.priority === 'medium' || t.priority === 'low') ? t.priority : null,
    effort: (t.effort === 'S' || t.effort === 'M' || t.effort === 'L') ? t.effort : null,
    due_date: t.due_date ?? null,
    status: 'open',
    created_at: t.created_at,
  }));
  if (upserts.length > 0) {
    const { error: upsertErr } = await supabase
      .from('todos')
      .upsert(upserts, { onConflict: 'id' });
    if (upsertErr) throw upsertErr;
  }
};

// Batch save: upsert only changed/added rows and delete only explicitly completed ids
export const saveTodosBatchToWebhook = async (updates: TodoPatch[], completes: string[]): Promise<void> => {
  const mod = await import('./supabase');
  const supabase = (mod as any).supabase as any | null;
  const isSupabaseConfigured = Boolean((mod as any).isSupabaseConfigured);
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured for Todos');
  }

  // Upserts for updates/new rows
  if (Array.isArray(updates) && updates.length > 0) {
    const upserts = updates.map((p) => {
      const numericId = Number(p.id || 0);
      if (numericId == null || Number.isNaN(numericId)) return null;
      const row: any = { id: numericId };
      const changed = new Set((p._changedFields || []).filter(Boolean));
      const isNew = (p as any)._isNew === true;
      // Only include fields that were explicitly changed, or all for new rows
      const include = (key: string) => isNew || changed.has(key);
      let hasUpdateField = false;
      if (include('task') && Object.prototype.hasOwnProperty.call(p, 'task')) { row.task = p.task; hasUpdateField = true; }
      if (include('category') && Object.prototype.hasOwnProperty.call(p, 'category')) { row.category = p.category ?? null; hasUpdateField = true; }
      if (include('priority') && Object.prototype.hasOwnProperty.call(p, 'priority')) {
        const prRaw = (p as any).priority as string | null | undefined; // allow legacy string
        const pr = prRaw === 'crucial' ? 'critical' : prRaw; // normalize any legacy
        row.priority = (pr === 'critical' || pr === 'high' || pr === 'medium' || pr === 'low') ? pr : null;
        hasUpdateField = true;
      }
      if (include('effort') && Object.prototype.hasOwnProperty.call(p, 'effort')) {
        row.effort = (p.effort === 'S' || p.effort === 'M' || p.effort === 'L') ? p.effort : null;
        hasUpdateField = true;
      }
      if (include('due_date') && Object.prototype.hasOwnProperty.call(p, 'due_date')) { row.due_date = p.due_date ?? null; hasUpdateField = true; }
      // Keep status open for all active items
      row.status = 'open';
      if (isNew && (p as any).created_at) row.created_at = (p as any).created_at;
      // Skip no-op patches (e.g., id-only undo markers)
      if (!hasUpdateField && !isNew) return null;
      return row;
    }).filter(Boolean) as any[];
    if (upserts.length > 0) {
      const { error } = await supabase
        .from('todos')
        .upsert(upserts, { onConflict: 'id' });
      if (error) throw error;
    }
  }

  // Deletes for explicit completes
  if (Array.isArray(completes) && completes.length > 0) {
    const numericOrStringIds = completes.map((id) => (Number.isFinite(Number(id)) ? Number(id) : String(id)));
    const { error } = await supabase
      .from('todos')
      .delete()
      .in('id', numericOrStringIds);
    if (error) throw error;
  }
};

// Batch save for Ideas: upsert changed/new rows and delete explicitly completed (removed) ids
export const saveIdeasBatchToWebhook = async (updates: IdeaPatch[], completes: string[]): Promise<void> => {
  const mod = await import('./supabase');
  const supabase = (mod as any).supabase as any | null;
  const isSupabaseConfigured = Boolean((mod as any).isSupabaseConfigured);
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured for Ideas');
  }

  // Upserts for updates/new rows
  if (Array.isArray(updates) && updates.length > 0) {
    const upserts = updates.map((p) => {
      const numericId = Number(p.id || 0);
      if (numericId == null || Number.isNaN(numericId)) return null;
      const row: any = { id: numericId };
      const changed = new Set((p._changedFields || []).filter(Boolean));
      const isNew = (p as any)._isNew === true;
      // Only include fields that were explicitly changed, or all for new rows
      const include = (key: string) => isNew || changed.has(key);
      let hasUpdateField = false;
      if (include('idea') && Object.prototype.hasOwnProperty.call(p, 'idea')) { row.idea = p.idea; hasUpdateField = true; }
      if (include('category') && Object.prototype.hasOwnProperty.call(p, 'category')) { row.category = p.category ?? null; hasUpdateField = true; }
      if (include('notes') && Object.prototype.hasOwnProperty.call(p, 'notes')) { row.notes = p.notes ?? ''; hasUpdateField = true; }
      if (include('status') && Object.prototype.hasOwnProperty.call(p, 'status')) { row.status = (p as any).status ?? 'open'; hasUpdateField = true; }
      return hasUpdateField ? row : null;
    }).filter(Boolean);

    if (upserts.length > 0) {
      const { error } = await supabase
        .from('ideas')
        .upsert(upserts, { onConflict: 'id' });
      if (error) throw error;
    }
  }

  // Deletes for explicit completes (removals)
  if (Array.isArray(completes) && completes.length > 0) {
    const numericOrStringIds = completes.map((id) => (Number.isFinite(Number(id)) ? Number(id) : String(id)));
    const { error } = await supabase
      .from('ideas')
      .delete()
      .in('id', numericOrStringIds);
    if (error) throw error;
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

// ============= Daily Intentions (Supabase) =============
const PILLARS: IntentionPillar[] = ['Power', 'Passion', 'Purpose', 'Production'];

const getTodayLocalDate = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const fetchDailyIntentions = async (): Promise<CurrentIntentionRow[]> => {
  const mod = await import('./supabase');
  const supabase = (mod as any).supabase as any | null;
  const isSupabaseConfigured = Boolean((mod as any).isSupabaseConfigured);
  if (!isSupabaseConfigured || !supabase) return PILLARS.map((p) => ({ pillar: p, intention: '', updated_at: new Date(0).toISOString() }));

  // Ensure 4 rows exist without overwriting existing intentions
  // 1) Read existing pillars
  const today = getTodayLocalDate();
  const { data: existingRows, error: readErr } = await supabase
    .from('daily_intentions')
    .select('pillar')
    .eq('date', today);
  if (readErr) throw readErr;
  const existing = new Set<string>((existingRows || []).map((r: any) => r.pillar));
  // 2) Insert only missing pillars with empty intention
  const missing = PILLARS.filter((p) => !existing.has(p));
  if (missing.length > 0) {
    const { error: insertErr } = await supabase
      .from('daily_intentions')
      .insert(missing.map((pillar) => ({ date: today, pillar, intention: '' })));
    if (insertErr) throw insertErr;
  }

  const { data, error } = await supabase
    .from('daily_intentions')
    .select('pillar,intention,updated_at')
    .eq('date', today)
    .order('pillar', { ascending: true });
  if (error) throw error;
  const rows = (data || []) as { pillar: IntentionPillar; intention: string; updated_at: string }[];
  return rows;
};

export const upsertIntentions = async (updates: UpsertIntentionInput[]): Promise<void> => {
  const mod = await import('./supabase');
  const supabase = (mod as any).supabase as any | null;
  const isSupabaseConfigured = Boolean((mod as any).isSupabaseConfigured);
  if (!isSupabaseConfigured || !supabase) return;
  if (!updates || updates.length === 0) return;
  // Defensive: never overwrite with empty/whitespace intentions
  const today = getTodayLocalDate();
  const payload = updates
    .map((u) => ({ date: today, pillar: u.pillar, intention: (u.intention ?? '').trim(), completed: false, updated_at: new Date().toISOString() }))
    .filter((u) => u.intention.length > 0);
  if (payload.length === 0) return;
  const { error } = await supabase
    .from('daily_intentions')
    .upsert(payload, { onConflict: 'date,pillar' });
  if (error) throw error;
};

// Reset downstream completion flags when new intentions are committed
// Deprecated: no longer needed with daily_intentions
// export const resetIntentionsCompletionOnCommit = async (): Promise<void> => {};

export const resetIntentionsIfNewDay = async (): Promise<void> => {
  const lastResetKey = 'intentions.lastResetDate';
  const today = getTodayLocalDate();
  try {
    const last = localStorage.getItem(lastResetKey);
    if (last === today) return;
  } catch {}
  const mod = await import('./supabase');
  const supabase = (mod as any).supabase as any | null;
  const isSupabaseConfigured = Boolean((mod as any).isSupabaseConfigured);
  if (!isSupabaseConfigured || !supabase) {
    try { localStorage.setItem(lastResetKey, today); } catch {}
    return;
  }
  // no server resets needed for now
  try { localStorage.setItem(lastResetKey, today); } catch {}
};

export const fetchIntentionStats = async (): Promise<IntentionStatsRow[]> => {
  const mod = await import('./supabase');
  const supabase = (mod as any).supabase as any | null;
  const isSupabaseConfigured = Boolean((mod as any).isSupabaseConfigured);
  
  if (!isSupabaseConfigured || !supabase) {
    // Return default structure for all pillars
    return PILLARS.map(pillar => ({
      id: `local-${pillar.toLowerCase()}`,
      pillar,
      current_streak: 0,
      longest_streak: 0,
      last_completed_date: null,
      updated_at: new Date(0).toISOString()
    }));
  }

  const { data, error } = await supabase
    .from('intention_stats')
    .select('id, pillar, current_streak, longest_streak, last_completed_date, updated_at')
    .order('pillar', { ascending: true });
    
  if (error) throw error;
  
  // Ensure all 4 pillars exist, fill missing ones with defaults
  const pillarData = new Map(data?.map((row: any) => [row.pillar, row]) || []);
  return PILLARS.map(pillar => {
    const existing = pillarData.get(pillar);
    return existing || {
      id: `missing-${pillar.toLowerCase()}`,
      pillar,
      current_streak: 0,
      longest_streak: 0,
      last_completed_date: null,
      updated_at: new Date(0).toISOString()
    };
  }) as IntentionStatsRow[];
};

// v1: streak is read-only; no local incrementing

// v2: webhook will be added later

// ===== STREAK TRACKING FUNCTIONS =====

// Mark a specific pillar intention as completed for today
export const markIntentionCompleted = async (pillar: IntentionPillar): Promise<void> => {
  const mod = await import('./supabase');
  const supabase = (mod as any).supabase as any | null;
  const isSupabaseConfigured = Boolean((mod as any).isSupabaseConfigured);
  const today = getTodayLocalDate();
  
  if (!isSupabaseConfigured || !supabase) return;
  
  // First, mark the intention as completed in daily_intentions
  const { error: updateError } = await supabase
    .from('daily_intentions')
    .update({ completed: true })
    .eq('date', today)
    .eq('pillar', pillar);
    
  if (updateError) throw updateError;
  // DB trigger will update intention_stats; no client-side recompute
};

// Calculate and update streak for a specific pillar
export const calculateAndUpdatePillarStreak = async (pillar: IntentionPillar): Promise<void> => {
  const mod = await import('./supabase');
  const supabase = (mod as any).supabase as any | null;
  const isSupabaseConfigured = Boolean((mod as any).isSupabaseConfigured);
  const today = getTodayLocalDate();
  
  if (!isSupabaseConfigured || !supabase) return;
  
  // Get current stats for this pillar
  const { data: currentStats, error: fetchError } = await supabase
    .from('intention_stats')
    .select('id, current_streak, longest_streak, last_completed_date')
    .eq('pillar', pillar)
    .maybeSingle();
    
  if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
  
  const currentStreak = currentStats?.current_streak || 0;
  const longestStreak = currentStats?.longest_streak || 0;
  const lastCompleted = currentStats?.last_completed_date;
  
  // Calculate new streak
  let newStreak = 1; // Start with 1 for today
  if (lastCompleted) {
    const lastDate = new Date(lastCompleted);
    const todayDate = new Date(today);
    const daysDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 1) {
      // Consecutive day - increment streak
      newStreak = currentStreak + 1;
    } else if (daysDiff > 1) {
      // Gap in days - reset to 1
      newStreak = 1;
    }
    // If daysDiff === 0, it's the same day, don't update
  }
  
  const newLongestStreak = Math.max(longestStreak, newStreak);
  
  // Upsert the updated stats
  const { error: upsertError } = await supabase
    .from('intention_stats')
    .upsert({
      pillar,
      current_streak: newStreak,
      longest_streak: newLongestStreak,
      last_completed_date: today,
      updated_at: new Date().toISOString()
    }, { onConflict: 'pillar' });
    
  if (upsertError) throw upsertError;
};

// Get completion status for today's intentions
export const getTodayCompletionStatus = async (): Promise<Record<IntentionPillar, boolean>> => {
  const mod = await import('./supabase');
  const supabase = (mod as any).supabase as any | null;
  const isSupabaseConfigured = Boolean((mod as any).isSupabaseConfigured);
  const today = getTodayLocalDate();
  
  if (!isSupabaseConfigured || !supabase) {
    return { Power: false, Passion: false, Purpose: false, Production: false };
  }
  
  const { data, error } = await supabase
    .from('daily_intentions')
    .select('pillar, completed')
    .eq('date', today);
    
  if (error) throw error;
  
  const completionMap = new Map(data?.map((row: any) => [row.pillar, row.completed]) || []);
  return {
    Power: Boolean(completionMap.get('Power')),
    Passion: Boolean(completionMap.get('Passion')),
    Purpose: Boolean(completionMap.get('Purpose')),
    Production: Boolean(completionMap.get('Production'))
  };
};

export const updateLastCompletedDateToday = async (): Promise<IntentionStatsRow | null> => {
  const mod = await import('./supabase');
  const supabase = (mod as any).supabase as any | null;
  const isSupabaseConfigured = Boolean((mod as any).isSupabaseConfigured);
  if (!isSupabaseConfigured || !supabase) return null;
  const today = getTodayLocalDate();
  const { data: statsRow } = await supabase
    .from('intention_stats')
    .select('id,pillar,current_streak,longest_streak,last_completed_date,updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: updated, error } = await supabase
    .from('intention_stats')
    .upsert({ id: statsRow?.id, pillar: statsRow?.pillar, last_completed_date: today, current_streak: statsRow?.current_streak ?? 0, longest_streak: statsRow?.longest_streak ?? 0 }, { onConflict: 'id' })
    .select('id,pillar,current_streak,longest_streak,last_completed_date,updated_at')
    .single();
  if (error) throw error;
  return updated as IntentionStatsRow;
};

// Fire-and-forget ping to n8n when intentions are committed (optional)
export const pingIntentionsCommitted = async (source: 'home' | 'public'): Promise<void> => {
  try {
    if (!N8N_WEBHOOK_TOKEN) {
      // Visible warning to help diagnose missing pings in prod
      // eslint-disable-next-line no-console
      console.warn('Intentions ping disabled: missing VITE_N8N_WEBHOOK_TOKEN');
      return;
    }
    const today = getTodayLocalDate();
    await fetch(N8N_INTENTIONS_PING_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${N8N_WEBHOOK_TOKEN}`,
        'X-Source': source,
        'Content-Type': 'application/json',
      },
      // Keepalive so navigation/redirect doesn't cancel the request
      keepalive: true,
      body: JSON.stringify({ source, date: today, ts: new Date().toISOString() }),
    }).catch(() => {});
  } catch {
    // swallow — ping should never block UI
  }
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
