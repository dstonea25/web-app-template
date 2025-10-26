import { apiClient } from './api';
import { getCachedData, setCachedData } from './storage';
import type { PrioritiesOverviewResponse, CommittedMilestoneRow, PriorityRecord, MilestoneRecord, ActiveFocusRow } from '../types';
import { useCallback, useEffect, useState } from 'react';

const OVERVIEW_CACHE_KEY = 'priorities-overview-cache';
const COMMITTED_CACHE_KEY = 'priorities-committed-cache';
const ACTIVE_FOCUS_CACHE_KEY = 'priorities-active-focus-cache';

export async function getPrioritiesOverview(): Promise<PrioritiesOverviewResponse[]> {
  const cached = getCachedData<PrioritiesOverviewResponse[]>(OVERVIEW_CACHE_KEY);
  if (cached) return cached;
  const data = await apiClient.fetchPrioritiesOverview();
  setCachedData(OVERVIEW_CACHE_KEY, data);
  return data;
}

export async function getCommittedMilestones(): Promise<CommittedMilestoneRow[]> {
  const cached = getCachedData<CommittedMilestoneRow[]>(COMMITTED_CACHE_KEY);
  if (cached) return cached;
  const data = await apiClient.fetchCommittedMilestones();
  setCachedData(COMMITTED_CACHE_KEY, data);
  return data;
}

export async function refreshPrioritiesOverview(): Promise<PrioritiesOverviewResponse[]> {
  const data = await apiClient.fetchPrioritiesOverview();
  setCachedData(OVERVIEW_CACHE_KEY, data);
  return data;
}

export async function refreshCommittedMilestones(): Promise<CommittedMilestoneRow[]> {
  const data = await apiClient.fetchCommittedMilestones();
  setCachedData(COMMITTED_CACHE_KEY, data);
  return data;
}

export async function getActiveFocus(): Promise<ActiveFocusRow[]> {
  const cached = getCachedData<ActiveFocusRow[]>(ACTIVE_FOCUS_CACHE_KEY);
  if (cached) return cached;
  const data = await apiClient.fetchActiveFocus();
  setCachedData(ACTIVE_FOCUS_CACHE_KEY, data);
  return data;
}

export async function refreshActiveFocus(): Promise<ActiveFocusRow[]> {
  const data = await apiClient.fetchActiveFocus();
  setCachedData(ACTIVE_FOCUS_CACHE_KEY, data);
  return data;
}

export async function toggleCommit(milestoneId: string): Promise<void> {
  await apiClient.toggleMilestoneCommit(milestoneId);
  // Invalidate caches so next reads are fresh
  setCachedData(ACTIVE_FOCUS_CACHE_KEY, null as any);
  setCachedData(OVERVIEW_CACHE_KEY, null as any);
  try {
    if (typeof window !== 'undefined' && 'dispatchEvent' in window) {
      console.log('[priorities.ts] Dispatching commit events for milestone:', milestoneId);
      window.dispatchEvent(new CustomEvent('dashboard:priorities-committed-updated', { detail: { id: milestoneId, ts: Date.now() } }));
      window.dispatchEvent(new CustomEvent('dashboard:priorities-refresh'));
    }
  } catch {}
}

export async function togglePriorityCommit(priorityId: string): Promise<void> {
  await apiClient.togglePriorityCommit(priorityId);
  // Invalidate caches so next reads are fresh
  setCachedData(ACTIVE_FOCUS_CACHE_KEY, null as any);
  setCachedData(OVERVIEW_CACHE_KEY, null as any);
  try {
    if (typeof window !== 'undefined' && 'dispatchEvent' in window) {
      window.dispatchEvent(new CustomEvent('dashboard:priorities-priority-committed-updated', { detail: { id: priorityId, ts: Date.now() } }));
      window.dispatchEvent(new CustomEvent('dashboard:active-focus-refresh'));
      window.dispatchEvent(new CustomEvent('dashboard:priorities-refresh'));
    }
  } catch {}
}

export async function toggleComplete(milestoneId: string): Promise<void> {
  await apiClient.toggleMilestoneComplete(milestoneId);
  // Invalidate caches so next reads are fresh
  setCachedData(ACTIVE_FOCUS_CACHE_KEY, null as any);
  setCachedData(OVERVIEW_CACHE_KEY, null as any);
  try {
    if (typeof window !== 'undefined' && 'dispatchEvent' in window) {
      console.log('[priorities.ts] Dispatching completion events for milestone:', milestoneId);
      window.dispatchEvent(new CustomEvent('dashboard:priorities-completed-updated', { detail: { id: milestoneId, ts: Date.now() } }));
      window.dispatchEvent(new CustomEvent('dashboard:priorities-refresh'));
      window.dispatchEvent(new CustomEvent('dashboard:active-focus-refresh'));
    }
  } catch {}
}

export async function createPriority(record: PriorityRecord): Promise<string> {
  const id = await apiClient.createPriority(record);
  // bust overview cache
  setCachedData(OVERVIEW_CACHE_KEY, null as any);
  return id;
}

export async function updatePriority(id: string, patch: Partial<PriorityRecord>): Promise<void> {
  await apiClient.updatePriority(id, patch);
  setCachedData(OVERVIEW_CACHE_KEY, null as any);
}

export async function deletePriority(id: string): Promise<void> {
  await apiClient.deletePriority(id);
  setCachedData(OVERVIEW_CACHE_KEY, null as any);
}

export async function createMilestone(record: MilestoneRecord): Promise<string> {
  const id = await apiClient.createMilestone(record);
  setCachedData(OVERVIEW_CACHE_KEY, null as any);
  return id;
}

export async function updateMilestone(id: string, patch: Partial<MilestoneRecord>): Promise<void> {
  await apiClient.updateMilestone(id, patch);
  setCachedData(OVERVIEW_CACHE_KEY, null as any);
  setCachedData(COMMITTED_CACHE_KEY, null as any);
}

export async function deleteMilestone(id: string): Promise<void> {
  await apiClient.deleteMilestone(id);
  setCachedData(OVERVIEW_CACHE_KEY, null as any);
  setCachedData(COMMITTED_CACHE_KEY, null as any);
}

export function usePrioritiesOverview() {
  const [data, setData] = useState<PrioritiesOverviewResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force?: boolean) => {
    try {
      setLoading(true);
      setError(null);
      const list = force ? await refreshPrioritiesOverview() : await getPrioritiesOverview();
      setData(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  return { data, loading, error, reload: () => load(true), setData };
}

export function useCommittedMilestones() {
  const [data, setData] = useState<CommittedMilestoneRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force?: boolean) => {
    try {
      setLoading(true);
      setError(null);
      const list = force ? await refreshCommittedMilestones() : await getCommittedMilestones();
      setData(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  return { data, loading, error, reload: () => load(true), setData };
}


