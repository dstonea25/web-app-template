import type { Todo, Session, Priority, TodoPatch, StatusUi, TodoFileItem, Idea, IdeaPatch } from '../types';
import { postTodosFile, saveIdeasToWebhook } from './api';
import { nowIso } from './time';

// UUID generator for new todos per spec
export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as Crypto).randomUUID();
  }
  // Fallback UUID v4-ish
  const hex = [...Array(256).keys()].map(i => (i + 0x100).toString(16).substring(1));
  const rnd = () => Math.random() * 0x100000000 >>> 0;
  const r = new Uint32Array([rnd(), rnd(), rnd(), rnd()]);
  return (
    hex[r[0] & 0xff] + hex[(r[0] >> 8) & 0xff] + hex[(r[0] >> 16) & 0xff] + hex[(r[0] >> 24) & 0xff] + '-' +
    hex[r[1] & 0xff] + hex[(r[1] >> 8) & 0xff] + '-' +
    ((r[1] >> 16) & 0x0f | 0x40).toString(16) + hex[(r[1] >> 24) & 0xff] + '-' +
    ((r[2] & 0x3f) | 0x80).toString(16) + hex[(r[2] >> 8) & 0xff] + '-' +
    hex[(r[2] >> 16) & 0xff] + hex[(r[2] >> 24) & 0xff] + hex[r[3] & 0xff] + hex[(r[3] >> 8) & 0xff] + hex[(r[3] >> 16) & 0xff] + hex[(r[3] >> 24) & 0xff]
  );
};

// Optional localStorage persistence for dev convenience
export class StorageManager {
  private static readonly TODOS_KEY = 'dashboard_todos';
  private static readonly SESSIONS_KEY = 'dashboard_sessions';

  // Save todos to localStorage
  static saveTodos(todos: Todo[]): void {
    try {
      localStorage.setItem(this.TODOS_KEY, JSON.stringify(todos));
      console.log('💾 Saved todos to localStorage');
    } catch (error) {
      console.warn('Failed to save todos to localStorage:', error);
    }
  }

  // Load todos from localStorage
  static loadTodos(): Todo[] {
    try {
      const stored = localStorage.getItem(this.TODOS_KEY);
      const parsed: any[] = stored ? JSON.parse(stored) : [];
      // Transform: ensure priority exists (null), ignore status, ensure id string, default statusUi
      return parsed.map((item) => {
        const id: string = item.id ? String(item.id) : generateId();
        const priority: Priority = (item.priority === 'low' || item.priority === 'medium' || item.priority === 'high') ? item.priority : null;
        const statusUi: StatusUi = (item.statusUi === 'open' || item.statusUi === 'paused' || item.statusUi === 'blocked') ? item.statusUi : 'open';
        return {
          id,
          task: String(item.task ?? ''),
          category: item.category ?? null,
          created_at: String(item.created_at ?? nowIso()),
          priority,
          statusUi,
        } as Todo;
      });
    } catch (error) {
      console.warn('Failed to load todos from localStorage:', error);
      return [];
    }
  }

  // Save sessions to localStorage
  static saveSessions(sessions: Session[]): void {
    try {
      localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
      console.log('💾 Saved sessions to localStorage');
    } catch (error) {
      console.warn('Failed to save sessions to localStorage:', error);
    }
  }

  // Load sessions from localStorage
  static loadSessions(): Session[] {
    try {
      const stored = localStorage.getItem(this.SESSIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to load sessions from localStorage:', error);
      return [];
    }
  }

  // Save ideas to localStorage
  static saveIdeas(ideas: Idea[]): void {
    try {
      localStorage.setItem('dashboard_ideas', JSON.stringify(ideas));
      console.log('💾 Saved ideas to localStorage');
    } catch (error) {
      console.warn('Failed to save ideas to localStorage:', error);
    }
  }

  // Load ideas from localStorage
  static loadIdeas(): Idea[] {
    try {
      const stored = localStorage.getItem('dashboard_ideas');
      const parsed: any[] = stored ? JSON.parse(stored) : [];
      return parsed.map((item) => ({
        id: String(item.id || generateId()),
        idea: String(item.idea ?? ''),
        category: item.category ?? null,
        created_at: String(item.created_at ?? nowIso()),
        status: (item.status === 'open' || item.status === 'closed') ? item.status : 'open',
        notes: item.notes ?? '',
      } as Idea));
    } catch (error) {
      console.warn('Failed to load ideas from localStorage:', error);
      return [];
    }
  }

  // Clear all stored data
  static clearAll(): void {
    localStorage.removeItem(this.TODOS_KEY);
    localStorage.removeItem(this.SESSIONS_KEY);
    localStorage.removeItem('dashboard_ideas');
    console.log('🗑️ Cleared all localStorage data');
  }
}

// Export functions for compatibility with spec
export const getTodos = (): Todo[] => StorageManager.loadTodos();
export const setTodos = (todos: Todo[]): void => StorageManager.saveTodos(todos);
export const getSessions = (): Session[] => StorageManager.loadSessions();
export const setSessions = (sessions: Session[]): void => StorageManager.saveSessions(sessions);

// Add a new todo with defaults
export const addTodo = (todos: Todo[], input: { task: string; category?: string | null; priority?: Priority }): Todo[] => {
  // Generate sequential ID based on existing todos
  const maxId = todos.reduce((max, todo) => {
    const id = parseInt(todo.id || '0');
    return isNaN(id) ? max : Math.max(max, id);
  }, 0);
  const newId = String(maxId + 1);
  
  const newTodo: Todo = {
    id: newId,
    task: input.task,
    category: input.category ?? null,
    created_at: nowIso(),
    priority: input.priority ?? null,
    statusUi: 'open',
  };
  const updated = [...todos, newTodo];
  StorageManager.saveTodos(updated);
  return updated;
};

// Complete (remove) a todo by id and persist
export const completeTodo = (todos: Todo[], id: string): { updated: Todo[]; removed?: Todo } => {
  const removed = todos.find(t => String(t.id) === String(id));
  const updated = todos.filter(t => String(t.id) !== String(id));
  StorageManager.saveTodos(updated);
  return { updated, removed };
};

// In-memory staging store (module scope)
const stagedUpdates: Map<string, TodoPatch> = new Map();
const stagedCompletes: Set<string> = new Set();

// Cache utilities
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export const getCachedData = <T>(key: string): T | null => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid
    if (now - timestamp > CACHE_DURATION) {
      localStorage.removeItem(key);
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
};

export const setCachedData = <T>(key: string, data: T | null): void => {
  try {
    if (data === null) {
      localStorage.removeItem(key);
      return;
    }
    const cacheItem = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(cacheItem));
  } catch {
    // Ignore cache errors
  }
};

export const stageRowEdit = ({ id, patch }: { id: string; patch: TodoPatch }): void => {
  const existing = stagedUpdates.get(id) || { id, _changedFields: [] };
  
  // Get the original todo to check for reversions
  const baseTodos = StorageManager.loadTodos();
  const originalTodo = baseTodos.find(t => String(t.id) === String(id));
  
  // Track which fields are being changed
  const changedFields = new Set(existing._changedFields || []);
  
  // If this was previously a new todo, but we're now editing it,
  // we need to convert it to regular field tracking
  const isConvertingFromNew = existing._isNew && patch._isNew === undefined;
  
  // Add any new fields being changed in this patch, but check for reversions
  Object.keys(patch).forEach(key => {
    if (key !== 'id' && key !== '_changedFields' && key !== '_isNew' && key !== '_dirty' && patch[key as keyof TodoPatch] !== undefined) {
      const newValue = patch[key as keyof TodoPatch];
      const originalValue = originalTodo?.[key as keyof Todo];
      
      // Only count as a change if it's different from the original value
      if (newValue !== originalValue) {
        changedFields.add(key);
      } else {
        // If the value is reverted to original, remove it from changed fields
        changedFields.delete(key);
      }
    }
  });
  
  // If no fields are actually changed, remove the staged update entirely
  if (changedFields.size === 0 && !patch._isNew) {
    stagedUpdates.delete(id);
  } else {
    const merged: TodoPatch = { 
      ...existing, 
      ...patch, 
      _changedFields: Array.from(changedFields),
      // If we're converting from new todo to regular editing, remove the _isNew flag
      _isNew: isConvertingFromNew ? false : patch._isNew
    };
    stagedUpdates.set(id, merged);
  }
  
  // If a row is edited, and was previously marked complete, unmark completion
  if (stagedCompletes.has(id)) {
    stagedCompletes.delete(id);
  }
};

export const stageComplete = ({ id }: { id: string }): void => {
  stagedCompletes.add(id);
  // Remove any staged updates for this id; completing supersedes edits
  if (stagedUpdates.has(id)) {
    stagedUpdates.delete(id);
  }
};

export const getStagedChanges = (): { updates: TodoPatch[]; completes: string[]; fieldChangeCount: number } => {
  const updates = Array.from(stagedUpdates.values());
  const completes = Array.from(stagedCompletes.values());
  
  // Count total field changes across all updates
  const fieldChangeCount = updates.reduce((total, update) => {
    // New todos count as 1 change regardless of field count
    if (update._isNew) {
      return total + 1;
    }
    // Regular updates count by changed field count
    return total + (update._changedFields?.length || 0);
  }, 0) + completes.length; // Each completion counts as 1 change
  
  return {
    updates,
    completes,
    fieldChangeCount,
  };
};

export const clearStagedChanges = (): void => {
  stagedUpdates.clear();
  stagedCompletes.clear();
};

// Build working todos (apply staged updates, remove staged completes) without mutation
export const getWorkingTodos = (): Todo[] => {
  const base = StorageManager.loadTodos();
  if (base.length === 0) return [];
  const updatesById = new Map<string, TodoPatch>(Array.from(stagedUpdates.values()).map(p => [p.id, p]));
  const working = base
    .filter(t => !stagedCompletes.has(String(t.id)))
    .map(t => {
      const patch = updatesById.get(String(t.id));
      if (patch) {
        // Remove the tracking properties when applying to working todos
        const { _changedFields, _isNew, _dirty, ...patchData } = patch;
        return { ...t, ...patchData, _dirty: false };
      }
      return t;
    });
  return working;
};

// Serialize todos into file format (created_at ASC, ids 1..N, status 'open')
export const serializeTodosForExport = (todos: Todo[]): TodoFileItem[] => {
  const sorted = [...todos].sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return ta - tb;
  });
  return sorted.map((t, i) => ({
    id: i + 1,
    task: String((t.task ?? '').trim()),
    status: 'open',
    category: t.category ?? null,
    priority: (t.priority ?? null) as Priority,
    created_at: String(t.created_at),
  }));
};

// Apply full-file save flow
export const applyFileSave = async (): Promise<{ ok: boolean; count: number }> => {
  const working = getWorkingTodos();
  const payload = serializeTodosForExport(working);
  const res = await postTodosFile(payload);
  if (res.success) {
    StorageManager.saveTodos(working);
    clearStagedChanges();
    return { ok: true, count: payload.length };
  }
  return { ok: false, count: 0 };
};

// ===== IDEAS STAGING SYSTEM =====
// (Mirrors the Todos staging system but for Ideas)

// In-memory staging store for ideas (module scope)
const stagedIdeaUpdates: Map<string, IdeaPatch> = new Map();
const stagedIdeaCompletes: Set<string> = new Set();

export const stageIdeaEdit = ({ id, patch }: { id: string; patch: IdeaPatch }): void => {
  const existing = stagedIdeaUpdates.get(id) || { id, _changedFields: [] };
  
  // Get the original idea to check for reversions
  const baseIdeas = StorageManager.loadIdeas();
  const originalIdea = baseIdeas.find(t => String(t.id) === String(id));
  
  // Track which fields are being changed
  const changedFields = new Set(existing._changedFields || []);
  
  // If this was previously a new idea, but we're now editing it,
  // we need to convert it to regular field tracking
  const isConvertingFromNew = existing._isNew && patch._isNew === undefined;
  
  // Add any new fields being changed in this patch, but check for reversions
  Object.keys(patch).forEach(key => {
    if (key !== 'id' && key !== '_changedFields' && key !== '_isNew' && key !== '_dirty' && patch[key as keyof IdeaPatch] !== undefined) {
      const newValue = patch[key as keyof IdeaPatch];
      const originalValue = originalIdea?.[key as keyof Idea];
      
      // Only count as a change if it's different from the original value
      if (newValue !== originalValue) {
        changedFields.add(key);
      } else {
        // If the value is reverted to original, remove it from changed fields
        changedFields.delete(key);
      }
    }
  });
  
  // If no fields are actually changed, remove the staged update entirely
  if (changedFields.size === 0 && !patch._isNew) {
    stagedIdeaUpdates.delete(id);
  } else {
    const merged: IdeaPatch = { 
      ...existing, 
      ...patch, 
      _changedFields: Array.from(changedFields),
      // If we're converting from new idea to regular editing, remove the _isNew flag
      _isNew: isConvertingFromNew ? false : patch._isNew
    };
    stagedIdeaUpdates.set(id, merged);
  }
  
  // If a row is edited, and was previously marked complete, unmark completion
  if (stagedIdeaCompletes.has(id)) {
    stagedIdeaCompletes.delete(id);
  }
};

export const stageIdeaComplete = ({ id }: { id: string }): void => {
  stagedIdeaCompletes.add(id);
  // Remove any staged updates for this id; completing supersedes edits
  if (stagedIdeaUpdates.has(id)) {
    stagedIdeaUpdates.delete(id);
  }
};

export const getStagedIdeaChanges = (): { updates: IdeaPatch[]; completes: string[]; fieldChangeCount: number } => {
  const updates = Array.from(stagedIdeaUpdates.values());
  const completes = Array.from(stagedIdeaCompletes.values());
  
  // Count total field changes across all updates
  const fieldChangeCount = updates.reduce((total, update) => {
    // New ideas count as 1 change regardless of field count
    if (update._isNew) {
      return total + 1;
    }
    // Regular updates count by changed field count
    return total + (update._changedFields?.length || 0);
  }, 0) + completes.length; // Each completion counts as 1 change
  
  return {
    updates,
    completes,
    fieldChangeCount,
  };
};

export const clearStagedIdeaChanges = (): void => {
  stagedIdeaUpdates.clear();
  stagedIdeaCompletes.clear();
};

// Build working ideas (apply staged updates, remove staged completes) without mutation
export const getWorkingIdeas = (): Idea[] => {
  const base = StorageManager.loadIdeas();
  if (base.length === 0) return [];
  const updatesById = new Map<string, IdeaPatch>(Array.from(stagedIdeaUpdates.values()).map(p => [p.id, p]));
  const working = base
    .filter(t => !stagedIdeaCompletes.has(String(t.id)))
    .map(t => {
      const patch = updatesById.get(String(t.id));
      if (patch) {
        // Remove the tracking properties when applying to working ideas
        const { _changedFields, _isNew, _dirty, ...patchData } = patch;
        return { ...t, ...patchData, _dirty: false };
      }
      return t;
    });
  return working;
};

// Add a new idea with defaults
export const addIdea = (ideas: Idea[], input: { idea: string; category?: string | null; notes?: string }): Idea[] => {
  // Generate sequential ID based on existing ideas
  const maxId = ideas.reduce((max, idea) => {
    const id = parseInt(idea.id || '0');
    return isNaN(id) ? max : Math.max(max, id);
  }, 0);
  const newId = String(maxId + 1);
  
  const newIdea: Idea = {
    id: newId,
    idea: input.idea,
    category: input.category ?? null,
    created_at: nowIso(),
    status: 'open',
    notes: input.notes || '',
  };
  const updated = [...ideas, newIdea];
  StorageManager.saveIdeas(updated);
  return updated;
};

// Serialize ideas into file format (created_at ASC, ids 1..N, status 'open')
export const serializeIdeasForExport = (ideas: Idea[]): any[] => {
  const sorted = [...ideas].sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return ta - tb;
  });
  return sorted.map((t, i) => ({
    id: i + 1,
    idea: String((t.idea ?? '').trim()),
    status: 'open',
    category: t.category ?? null,
    notes: t.notes ?? '',
    created_at: String(t.created_at),
  }));
};

// Apply full-file save flow for ideas
export const applyIdeaFileSave = async (): Promise<{ ok: boolean; count: number }> => {
  const working = getWorkingIdeas();
  const payload = serializeIdeasForExport(working);
  try {
    await saveIdeasToWebhook(working);
    StorageManager.saveIdeas(working);
    clearStagedIdeaChanges();
    return { ok: true, count: payload.length };
  } catch (error) {
    console.error('Failed to save ideas to webhook:', error);
    return { ok: false, count: 0 };
  }
};
