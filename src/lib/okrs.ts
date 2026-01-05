import { supabase, isSupabaseConfigured } from './supabase';
import type { Okr, OkrKeyResult, KeyResultKind, OkrPillar } from '../types';

type MaybeNumber = number | string | null | undefined;

function normalizeProgress(value: MaybeNumber): number {
  if (value == null) return 0;
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!isFinite(n)) return 0;
  // Accept either 0..1 or 0..100; treat <=1 as ratio
  return n <= 1 ? Math.round(n * 100) : Math.round(Math.max(0, Math.min(100, n)));
}

function ensureArray<T>(val: any): T[] {
  if (Array.isArray(val)) return val as T[];
  if (val == null) return [];
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function normalizeKrProgress(kr: OkrKeyResult): number {
  if (kr.progress != null) {
    // Don't cap at 100% - allow over-achievement display
    const val = typeof kr.progress === 'string' ? parseFloat(kr.progress) : kr.progress;
    if (!isFinite(val)) return 0;
    // Accept either 0..1 or 0..100; treat <=1 as ratio
    const normalized = val <= 1 ? Math.round(val * 100) : Math.round(val);
    return Math.max(0, normalized); // No upper cap for over-achievement
  }
  
  const kind = kr.kind as KeyResultKind;
  const direction = kr.direction || 'up';
  
  if (kind === 'boolean') {
    return kr.current_value ? 100 : 0;
  }
  
  if (kind === 'percent') {
    const n = Number(kr.current_value || 0);
    // Allow over 100% for percent type too
    return Math.max(0, Math.round(n));
  }
  
  const current = Number(kr.current_value || 0);
  const target = Number(kr.target_value || 0);
  
  // Countdown direction (minimize)
  if (direction === 'down') {
    const baseline = Number(kr.baseline_value || 0);
    if (baseline === 0 || baseline === target) return 0;
    const progress = ((baseline - current) / (baseline - target)) * 100;
    return Math.max(0, Math.round(progress)); // Can exceed 100% if overachieved
  }
  
  // Count up direction (maximize) - default
  if (target <= 0) return 0;
  const progress = (current / target) * 100;
  return Math.max(0, Math.round(progress)); // Can exceed 100% for over-achievement
}

export async function fetchOkrsWithProgress(): Promise<Okr[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.from('okrs_with_progress').select('*').eq('archived', false);
  if (error) throw error;

  // Define pillar order for consistent display
  const PILLAR_ORDER = ['Power', 'Passion', 'Purpose', 'Production'];
  const getPillarIndex = (pillar: string) => {
    const index = PILLAR_ORDER.indexOf(pillar);
    return index === -1 ? 999 : index; // Unknown pillars go to end
  };

  const okrs = (data || []).map((row: any) => {
    const keyResultsRaw = row.key_results ?? row.keyResults ?? row.krs;
    const key_results: OkrKeyResult[] = ensureArray<OkrKeyResult>(keyResultsRaw).map((kr) => ({
      ...kr,
      progress: normalizeKrProgress(kr as OkrKeyResult),
    }));
    const progress = normalizeProgress(row.progress);
    const pillar: OkrPillar = row.pillar;
    const objective: string = row.objective || row.title || '';
    const okr: Okr = {
      id: String(row.id),
      pillar,
      objective,
      progress,
      key_results,
      quarter: row.quarter,
      start_date: row.start_date,
      end_date: row.end_date,
    };
    return okr;
  });

  // Sort by pillar order for consistent display
  return okrs.sort((a, b) => getPillarIndex(a.pillar) - getPillarIndex(b.pillar));
}

export async function fetchCurrentOrRecentOkrs(): Promise<{ okrs: Okr[]; isPastQuarter: boolean; quarterInfo: { quarter: string; start_date: string; end_date: string } | null }> {
  if (!isSupabaseConfigured || !supabase) return { okrs: [], isPastQuarter: false, quarterInfo: null };
  
  const today = new Date().toISOString().split('T')[0];
  
  // First, try to get current quarter OKRs (where today is within the date range)
  const { data: currentData, error: currentError } = await supabase
    .from('okrs_with_progress')
    .select('*')
    .eq('archived', false)
    .lte('start_date', today)
    .gte('end_date', today);
  
  if (currentError && currentError.code !== 'PGRST116') throw currentError;
  
  // If we have current OKRs, return them
  if (currentData && currentData.length > 0) {
    const okrs = processOkrData(currentData);
    return {
      okrs,
      isPastQuarter: false,
      quarterInfo: {
        quarter: currentData[0].quarter,
        start_date: currentData[0].start_date,
        end_date: currentData[0].end_date
      }
    };
  }
  
  // No current OKRs, fetch the most recent past quarter
  const { data: pastData, error: pastError } = await supabase
    .from('okrs_with_progress')
    .select('*')
    .eq('archived', false)
    .lt('end_date', today)
    .order('end_date', { ascending: false })
    .limit(4); // Assume max 4 OKRs per quarter
  
  if (pastError) throw pastError;
  
  if (pastData && pastData.length > 0) {
    const okrs = processOkrData(pastData);
    return {
      okrs,
      isPastQuarter: true,
      quarterInfo: {
        quarter: pastData[0].quarter,
        start_date: pastData[0].start_date,
        end_date: pastData[0].end_date
      }
    };
  }
  
  return { okrs: [], isPastQuarter: false, quarterInfo: null };
}

function processOkrData(data: any[]): Okr[] {
  const PILLAR_ORDER = ['Power', 'Passion', 'Purpose', 'Production'];
  const getPillarIndex = (pillar: string) => {
    const index = PILLAR_ORDER.indexOf(pillar);
    return index === -1 ? 999 : index;
  };

  const okrs = data.map((row: any) => {
    const keyResultsRaw = row.key_results ?? row.keyResults ?? row.krs;
    const key_results: OkrKeyResult[] = ensureArray<OkrKeyResult>(keyResultsRaw).map((kr) => ({
      ...kr,
      progress: normalizeKrProgress(kr as OkrKeyResult),
    }));
    const progress = normalizeProgress(row.progress);
    const pillar: OkrPillar = row.pillar;
    const objective: string = row.objective || row.title || '';
    return {
      id: String(row.id),
      pillar,
      objective,
      progress,
      key_results,
      quarter: row.quarter,
      start_date: row.start_date,
      end_date: row.end_date,
    } as Okr;
  });

  return okrs.sort((a, b) => getPillarIndex(a.pillar) - getPillarIndex(b.pillar));
}

export async function fetchOkrById(id: string): Promise<Okr | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.from('okrs_with_progress').select('*').eq('id', id).single();
  if (error) throw error;
  if (!data) return null;
  const keyResultsRaw = (data as any).key_results ?? (data as any).keyResults ?? (data as any).krs;
  const key_results: OkrKeyResult[] = ensureArray<OkrKeyResult>(keyResultsRaw).map((kr) => ({
    ...kr,
    progress: normalizeKrProgress(kr as OkrKeyResult),
  }));
  return {
    id: String((data as any).id),
    pillar: (data as any).pillar,
    objective: (data as any).objective || (data as any).title || '',
    progress: normalizeProgress((data as any).progress),
    key_results,
  } as Okr;
}

export async function updateKeyResultValue(krId: string, value: number | boolean): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('okr_key_results').update({ current_value: value }).eq('id', krId);
  if (error) throw error;
}

export async function updateObjective(okrId: string, objective: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('okrs').update({ objective }).eq('id', okrId);
  if (error) throw error;
}

export async function updateKrDescription(krId: string, description: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('okr_key_results').update({ description }).eq('id', krId);
  if (error) throw error;
}

export async function updateKrTarget(krId: string, target_value: number): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('okr_key_results').update({ target_value }).eq('id', krId);
  if (error) throw error;
}

export async function updateKrBaseline(krId: string, baseline_value: number): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('okr_key_results').update({ baseline_value }).eq('id', krId);
  if (error) throw error;
}

export async function updateKrDirection(krId: string, direction: 'up' | 'down'): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('okr_key_results').update({ direction }).eq('id', krId);
  if (error) throw error;
}

export async function updateKrDataSource(
  krId: string, 
  data_source: 'manual' | 'habit' | 'metric',
  linked_habit_id?: string | null,
  auto_sync?: boolean
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('okr_key_results')
    .update({ 
      data_source, 
      linked_habit_id: data_source === 'habit' ? linked_habit_id : null,
      auto_sync: data_source === 'habit' ? auto_sync : false
    })
    .eq('id', krId);
  if (error) throw error;
}

export async function syncHabitToKR(krId: string): Promise<number> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
  
  // Get KR with habit link and OKR dates
  const { data: kr, error: krError } = await supabase
    .from('okr_key_results')
    .select(`
      id,
      linked_habit_id,
      auto_sync,
      data_source,
      okr_id,
      okrs!inner(start_date, end_date)
    `)
    .eq('id', krId)
    .single();
  
  if (krError) throw krError;
  if (!kr || kr.data_source !== 'habit' || !kr.linked_habit_id) {
    return 0;
  }
  
  const okr = (kr as any).okrs;
  
  // Count habit completions in date range
  const { count, error: countError } = await supabase
    .from('habit_entries')
    .select('date', { count: 'exact', head: true })
    .eq('habit_id', kr.linked_habit_id)
    .eq('is_done', true)
    .gte('date', okr.start_date)
    .lte('date', okr.end_date);
  
  if (countError) throw countError;
  
  const syncedCount = count || 0;
  
  // Update current_value
  await updateKeyResultValue(krId, syncedCount);
  
  return syncedCount;
}

export async function getNextQuarter(): Promise<{ quarter: string; start_date: string; end_date: string } | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  
  // Get the most recent quarter
  const { data, error } = await supabase
    .from('okrs')
    .select('quarter, end_date')
    .order('end_date', { ascending: false })
    .limit(1)
    .single();
  
  if (error || !data) return null;
  
  // Parse current quarter
  const endDate = new Date(data.end_date);
  const nextStart = new Date(endDate);
  nextStart.setDate(nextStart.getDate() + 1); // Day after end
  
  const nextEnd = new Date(nextStart);
  nextEnd.setMonth(nextEnd.getMonth() + 3);
  nextEnd.setDate(nextEnd.getDate() - 1); // Last day of quarter
  
  // Determine quarter name
  const month = nextStart.getMonth();
  const year = nextStart.getFullYear();
  const quarterNum = Math.floor(month / 3) + 1;
  const quarter = `Q${quarterNum} ${year}`;
  
  // Check if OKRs for this quarter already exist
  const { data: existingOkrs } = await supabase
    .from('okrs')
    .select('id')
    .eq('quarter', quarter)
    .limit(1);
  
  // If OKRs already exist for this quarter, return null (don't show button)
  if (existingOkrs && existingOkrs.length > 0) {
    return null;
  }
  
  return {
    quarter,
    start_date: nextStart.toISOString().split('T')[0],
    end_date: nextEnd.toISOString().split('T')[0]
  };
}

/**
 * Punt or unpunt a Key Result.
 * Punted KRs are deprioritized and excluded from weekly challenges,
 * but their progress is preserved.
 */
export async function puntKeyResult(krId: string, punted: boolean): Promise<{ punted: boolean; punted_at: string | null }> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
  
  const { data, error } = await supabase.rpc('punt_key_result', {
    p_kr_id: krId,
    p_punted: punted
  });
  
  if (error) throw error;
  
  return {
    punted: data?.punted ?? punted,
    punted_at: data?.punted_at ?? null
  };
}

export async function createQuarterOKRs(
  quarter: string,
  start_date: string,
  end_date: string,
  okrsData: Array<{
    pillar: string;
    objective: string;
    key_results: Array<{
      description: string;
      type: string;
      target_value: number;
      direction?: string;
      baseline_value?: number | null;
      data_source?: string;
      linked_habit_id?: string | null;
      auto_sync?: boolean;
    }>;
  }>
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
  
  for (const okrData of okrsData) {
    // Create OKR
    const { data: okr, error: okrError } = await supabase
      .from('okrs')
      .insert({
        pillar: okrData.pillar,
        objective: okrData.objective,
        quarter,
        start_date,
        end_date,
        status: 'active',
        archived: false
      })
      .select()
      .single();
    
    if (okrError) throw okrError;
    
    // Create KRs
    for (const kr of okrData.key_results) {
      const { error: krError } = await supabase
        .from('okr_key_results')
        .insert({
          okr_id: okr.id,
          description: kr.description,
          type: kr.type,
          target_value: kr.target_value,
          current_value: 0, // Always start at 0
          direction: kr.direction || 'up',
          baseline_value: kr.baseline_value || null,
          data_source: kr.data_source || 'manual',
          linked_habit_id: kr.linked_habit_id || null,
          auto_sync: kr.auto_sync || false,
          status: 'active'
        });
      
      if (krError) throw krError;
    }
  }
}


