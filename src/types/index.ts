// Data models based on the specification
export type StatusUi = 'open' | 'paused' | 'blocked';
export type Priority = 'low' | 'medium' | 'high' | null;

export interface Todo {
  id?: string; // internal; generate uuid if missing
  task: string;
  category?: string | null;
  created_at: string;
  priority?: Priority; // default null
  // status?: string; // present in files but ignored
  // UI-only status for display; not persisted
  statusUi?: StatusUi; // default 'open'
  _dirty?: boolean; // UI flag for pending edits
}

export interface TodoPatch {
  id: string;
  task?: string;
  category?: string | null;
  priority?: Priority;
  statusUi?: StatusUi;
}

export interface Session {
  id?: string;
  started_at: string; // ISO-8601
  ended_at?: string; // ISO-8601 (optional until stopped)
  duration_ms?: number; // computed on stop or edit
  note?: string;
}

// API response types for future webhooks
export interface SaveTodosRequest {
  todos: Todo[];
}

export interface SaveSessionsRequest {
  sessions: Session[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface TodoFileItem {
  id: number;
  task: string;
  status: 'open';
  category: string | null;
  priority: Priority;
  created_at: string;
}
