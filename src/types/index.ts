// Data models based on the specification
export type StatusUi = 'open' | 'paused' | 'blocked';
export type Priority = 'critical' | 'high' | 'medium' | 'low' | null;
export type Effort = 'S' | 'M' | 'L' | null;

export interface Todo {
  id?: string; // internal; generate uuid if missing
  task: string;
  category?: string | null;
  created_at: string;
  priority?: Priority; // default null
  due_date?: string | null; // YYYY-MM-DD
  effort?: Effort; // S | M | L
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
  due_date?: string | null;
  effort?: Effort;
  statusUi?: StatusUi;
  // Track which fields have been changed for counting
  _changedFields?: string[];
  // Special flag for new todos - should count as 1 change regardless of field count
  _isNew?: boolean;
  // UI flag for dirty state - should not count as a field change
  _dirty?: boolean;
}

export interface Idea {
  id?: string; // internal; generate uuid if missing
  idea: string;
  category?: string | null;
  created_at: string;
  status?: 'open' | 'closed';
  notes?: string;
  _dirty?: boolean; // UI flag for pending edits
}

export interface IdeaPatch {
  id: string;
  idea?: string;
  category?: string | null;
  notes?: string;
  status?: 'open' | 'closed';
  // Track which fields have been changed for counting
  _changedFields?: string[];
  // Special flag for new ideas - should count as 1 change regardless of field count
  _isNew?: boolean;
  // UI flag for dirty state - should not count as a field change
  _dirty?: boolean;
}

export interface Session {
  id: string;
  category: 'Work' | 'Personal Projects' | 'Gaming';
  startedAt: string; // ISO-8601
  endedAt: string; // ISO-8601
  minutes: number; // duration in minutes
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
  effort?: Effort | null;
  due_date?: string | null;
  created_at: string;
}

// Habit tracker minimal types
export interface Habit {
  id: string;
  name: string;
  rule?: string;
}

export interface HabitEvent {
  habitId: string;
  date: string; // YYYY-MM-DD
  complete: boolean;
}

// Authentication types
export interface AuthCredentials {
  username: string;
  password: string;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: AuthCredentials) => Promise<boolean>;
  logout: () => void;
}

// Personal OKRs
export type OkrPillar = 'Power' | 'Passion' | 'Purpose' | 'Production';
export type KeyResultKind = 'boolean' | 'count' | 'percent' | 'duration';

export interface OkrKeyResult {
  id: string;
  okr_id: string;
  description: string;
  kind: KeyResultKind;
  target_value: number | boolean | null;
  current_value: number | boolean | null;
  // Optional, may be provided by the view as 0..1 or 0..100
  progress?: number | null;
}

export interface Okr {
  id: string;
  pillar: OkrPillar;
  objective: string;
  // Optional, may be provided by the view as 0..1 or 0..100
  progress?: number | null;
  // When coming from okrs_with_progress, key results often arrive as JSON
  key_results?: OkrKeyResult[];
}

// Daily Intentions
export type IntentionPillar = OkrPillar; // 'Power' | 'Passion' | 'Purpose' | 'Production'

export interface CurrentIntentionRow {
  pillar: IntentionPillar;
  intention: string;
  updated_at: string; // timestamptz
}

export interface IntentionStatsRow {
  id: string; // uuid
  pillar: IntentionPillar; // 'Power' | 'Passion' | 'Purpose' | 'Production'
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null; // YYYY-MM-DD
  updated_at: string; // timestamptz
}

export interface UpsertIntentionInput {
  pillar: IntentionPillar;
  intention: string;
}

// Priorities & Milestones
export type PillarName = IntentionPillar; // reuse existing union

export interface PrioritiesOverviewResponse {
  pillar_id: string;
  pillar_name: PillarName;
  emoji?: string | null;
  priorities: Array<PriorityItemOverview>;
}

export interface PriorityItemOverview {
  priority_id: string;
  title: string;
  status: 'backlog' | 'active' | 'archived' | null;
  importance?: number | null; // 1-5
  committed?: boolean; // new: priority-level commitment
  milestones: Array<MilestoneOverview>;
}

export interface MilestoneOverview {
  milestone_id: string;
  title: string;
  committed: boolean;
  completed: boolean;
  definition_of_done?: string | null;
  due_date?: string | null; // YYYY-MM-DD
  created_at?: string | null; // ISO-8601 timestamp
}

export interface CommittedMilestoneRow {
  milestone_id: string;
  milestone_title: string;
  priority_title: string;
  pillar_name: PillarName;
  emoji?: string | null;
  due_date?: string | null;
  completed: boolean;
  definition_of_done?: string | null;
  updated_at: string; // timestamptz
}

// Active Focus (right pane): committed priorities and their committed milestones
export interface ActiveFocusRow {
  pillar_id: string;
  pillar_name: PillarName;
  emoji?: string | null;
  priority_id: string;
  priority_title: string;
  priority_committed: boolean;
  milestones: Array<{
    milestone_id: string;
    title: string;
    committed: boolean;
    completed: boolean;
    definition_of_done?: string | null;
    due_date?: string | null;
  }>;
}

// CRUD shapes for direct table access
export interface PriorityRecord {
  id?: string;
  pillar_id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  importance?: number | null;
  committed?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

export interface MilestoneRecord {
  id?: string;
  priority_id: string;
  title: string;
  notes?: string | null;
  committed?: boolean | null;
  completed?: boolean | null;
  order_index?: number | null;
  definition_of_done?: string | null;
  due_date?: string | null;
  created_at?: string;
  updated_at?: string;
}