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
  if (kr.progress != null) return normalizeProgress(kr.progress as number);
  const kind = kr.kind as KeyResultKind;
  if (kind === 'boolean') {
    return kr.current_value ? 100 : 0;
  }
  if (kind === 'percent') {
    const n = Number(kr.current_value || 0);
    return normalizeProgress(n);
  }
  const current = Number(kr.current_value || 0);
  const target = Number(kr.target_value || 0);
  if (target <= 0) return 0;
  return normalizeProgress((current / target) * 100);
}

export async function fetchOkrsWithProgress(): Promise<Okr[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.from('okrs_with_progress').select('*');
  if (error) throw error;

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
    };
    return okr;
  });

  return okrs;
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


