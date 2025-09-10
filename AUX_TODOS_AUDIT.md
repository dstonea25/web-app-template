## To-Dos Module Audit

Scope: Data flow, state ownership, staging behavior, Save semantics, serialization, and ID/Status/Priority handling. Read-only audit; no refactors.

### 1) Data Models
- Types file: `/src/types/index.ts`
  - `StatusUi` L2
  - `Priority` L3
  - `Todo` L5–L15
    - Fields: `id?` L6, `task` L7, `category?` L8, `created_at` L9, `priority?` L10, `statusUi?` L13, `_dirty?` L14
  - `TodoPatch` L17–L23
  - Required vs optional (inferred):
    - Required: `task` (L7), `created_at` (L9)
    - Optional: `id` (L6), `category` (L8), `priority` (L10), `statusUi` (L13), `_dirty` (L14)
- Where key fields are defined/used:
  - `priority` defined L3, L10; used in `/src/components/TodosTable.tsx` L42–L49 (rank), L62–L65 (sort), L286–L291 (edit), L299–L303 (commit); `/src/pages/TodosTab.tsx` L19 (form state), L75–L84 (add), L196–L201 (form input); `/src/lib/storage.ts` L42–L55 (transform), L98–L106 (add defaults).
  - `statusUi` defined L2, L13; used `/src/components/TodosTable.tsx` L92–L101, L108–L109, L299–L304 (staging payload); `/src/lib/storage.ts` L42–L55 (default 'open'), L105 (set on add).
  - `created_at` defined L9; used `/src/components/TodosTable.tsx` L294–L295 (render), sorting comparator generic path L66–L70; `/src/pages/TodosTab.tsx` default sort state L15–L16.
  - `id` defined L6; used throughout for keys and staging: `/src/components/TodosTable.tsx` L84–L100, L107–L109, L258–L316; `/src/pages/TodosTab.tsx` L58–L66 (apply batch by id); generated in storage L98–L106 and transformed L44.

### 2) Sources of Truth
- Runtime base list: React state in `/src/pages/TodosTab.tsx` `const [todos, setTodos]` L12.
- LocalStorage mirror: `/src/lib/storage.ts` `StorageManager.saveTodos` L27–L35; `loadTodos` L37–L60.
- Staging buffers (module-scope): `/src/lib/storage.ts` L120–L152
  - `stagedUpdates: Map<string, TodoPatch>` L121
  - `stagedCompletes: Set<string>` L122
  - APIs: `stageRowEdit` L124–L132, `stageComplete` L134–L140, `getStagedChanges` L142–L146, `clearStagedChanges` L149–L152
- Readers/writers:
  - Read seeds and initialize: `/src/pages/TodosTab.tsx` `loadTodos` L27–L48 (fetch -> save to localStorage -> reload transformed -> set state)
  - Write to mirror on add: `/src/lib/storage.ts` `addTodo` L98–L110
  - Write on complete (local removal): `/src/lib/storage.ts` `completeTodo` L112–L118
  - Stage edits/completes from UI: `/src/pages/TodosTab.tsx` `commitRowEdit` L94–L101; `completeTodo` L102–L108

### 3) UI → State Mapping
- Add form (fields, defaults, assignments): `/src/pages/TodosTab.tsx`
  - Controlled fields: `task`, `category`, `priority` (L181–L207; initial form state L19)
  - Defaults on add: `id` via `generateId`, `created_at` via `nowIso`, `priority` default null, `statusUi: 'open'` in `/src/lib/storage.ts` `addTodo` L98–L106
- Table editing:
  - Editable cells: Task (input) L262–L272; Priority (select) L286–L291 in `/src/components/TodosTable.tsx`
  - Commit events: Tab/Shift+Tab and Enter call `onCommitRowEdit` (L80–L105); Blur commit L107–L109
  - Dirty marking: `_dirty: true` applied in `/src/pages/TodosTab.tsx` `updateTodo` L86–L92 and Priority onChange in table L287–L289
- Status & Priority handling:
  - `statusUi`: UI-only; included in staged patches (L92–L101, L108–L109, L299–L303 in table) and stripped before network send `/src/pages/TodosTab.tsx` L53–L55
  - `priority`: editable via `SelectPriority` component (table L286–L291; form L196–L201); persisted in local state and included in batch updates

### 4) Sorting/Filtering
- Default sort: `created_at desc` via state defaults `/src/pages/TodosTab.tsx` L15–L16
- Priority comparator: `/src/components/TodosTable.tsx` `priorityRank` L42–L49 mapping high→3, medium→2, low→1, null/undefined→0; used at L62–L65
- Sorting state ownership: `TodosTab` via `sortBy`, `sortOrder` L15–L16 passed to `TodosTable` L159–L174
- Header interactions & a11y:
  - Priority header: `aria-sort` L153–L154; toggling logic L161–L177; live description L194–L196
  - Created header: `aria-sort` L201–L203; toggling logic L210–L227; live description L243–L245
  - Live region announcing sort changes: L114–L116
- Filtering: text input filters by `task` or `category` `/src/components/TodosTable.tsx` L52–L60

### 5) Save Semantics (critical)
- Save action: `/src/pages/TodosTab.tsx` `saveBatch` L50–L73
  - Calls: `/src/lib/api.ts` `postTodosBatch` (export L88–L91; client method L28–L32)
  - Payload: `{ updates: TodoPatch[]; completes: string[] }` constructed after stripping `statusUi` L53–L55
  - Mode: Sends deltas (updates/completes), NOT full array
  - On success: Applies staged changes locally by id map and filters completes L57–L66; clears staging L66–L67
- Network on Update/Complete events: none; those only stage locally (`stageRowEdit` L94–L101; `stageComplete` L102–L108)

### 6) Serialization/ID Behavior
- Export/serialization functions: None beyond localStorage mirror
  - Save to localStorage: `/src/lib/storage.ts` L27–L35
  - Load with transforms: `/src/lib/storage.ts` L37–L55 (ensures: string `id`, null-default `priority`, default `statusUi`, preserves or sets `created_at`)
- ID assignment: UUID for new todos `/src/lib/storage.ts` `generateId` L5–L20, used in `addTodo` L98–L106; seed numeric ids are coerced to strings on load L44
- Order on persistence: localStorage stores current array order as provided; UI sorting happens at render (`TodosTable.sort`) and is not persisted

### 7) Persistence & Resilience
- localStorage keys: `/src/lib/storage.ts` `dashboard_todos` L24, `dashboard_sessions` L25
- Read/write cadence:
  - On app load of Todos: clear localStorage then seed and load transformed `/src/pages/TodosTab.tsx` L29–L41
  - On add: persist immediately `/src/lib/storage.ts` L107–L110
  - On complete (local removal helper): `/src/lib/storage.ts` L112–L118
  - On batch save: no storage write here; only in-memory apply and staging clear `/src/pages/TodosTab.tsx` L57–L67
- Error handling: try/catch in load/save with console warnings `/src/lib/storage.ts` L29–L35, L37–L60, L63–L81
- Refresh behavior: Staged changes live in module-scope maps (not persisted) `/src/lib/storage.ts` L120–L152; a refresh clears in-memory staging; initial load seeds from `/public/data/todos.json`

### 8) A11y & Theming Integrity
- Focus rings use emerald tokens: `/src/theme/config.ts` tokens.input.focus L151–L153, tokens.button.* L143–L149, tokens.editable.cell L174–L175
- No hardcoded blues in dark mode: scan shows neutral/emerald/teal usage; no matches for disallowed dark slate variants (see Static checks)
- Sidebar a11y: `/src/components/Sidebar.tsx` uses `aria-expanded` on collapse toggle L41; focus ring classes present L64–L65; tooltips visible on hover/focus L79–L82
- Mobile drawer a11y: `/src/components/MobileDrawer.tsx` focus trap and ESC close L38–L111; `role="dialog"`, `aria-modal`, labeled title L123–L139

### 9) Risk Map for “Rebuild Whole File on Save”
- Code paths assuming delta/batch mode:
  - `saveBatch` builds `{ updates, completes }` and applies patches by id `/src/pages/TodosTab.tsx` L50–L66
  - API client exposes `postTodosBatch` only for todos `/src/lib/api.ts` L28–L32, L88–L91
  - Staging layer relied upon by UI events (`stageRowEdit`, `stageComplete`) `/src/lib/storage.ts` L124–L140; table commits `/src/components/TodosTable.tsx` L92–L101, L107–L109, L299–L303
- Numeric id expectations vs uuid: Seeds may be numeric but are coerced to string; new ids are UUID (string). Any path expecting numeric ids could break; current code treats ids as strings consistently (e.g., String casts) `/src/pages/TodosTab.tsx` L60–L63, L107; `/src/lib/storage.ts` L114–L116
- Reliance on UI sort for export: Sorting is UI-only (`TodosTable` L51–L70). A full-file export/save should define explicit order (e.g., `created_at asc/desc`); currently not enforced on any serialization

### Static checks (excerpts)
```text
$ git grep -nE '\\bpostTodos(File|Batch)|applyBatch|applyFileSave' src || true
src/pages/TodosTab.tsx:3:import { postTodosBatch } from '../lib/api';
src/pages/TodosTab.tsx:55:      const response = await postTodosBatch({ updates, completes: staged.completes });
src/lib/api.ts:28:  async postTodosBatch(payload: { updates: TodoPatch[]; completes: string[] }): Promise<ApiResponse> {
src/lib/api.ts:89:export const postTodosBatch = async (payload: { updates: TodoPatch[]; completes: string[] }): Promise<ApiResponse> => {

$ git grep -nE '\\bpriority\\b' src || true
src/components/TodosTable.tsx:62:      if (sortBy === 'priority') {
src/components/TodosTable.tsx:132:          <option value="priority">Sort by Priority</option>
src/components/TodosTable.tsx:153:                aria-sort={sortBy === 'priority' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
src/components/TodosTable.tsx:287:                      value={todo.priority ?? null}
src/pages/TodosTab.tsx:19:  const [newTodo, setNewTodo] = useState<Partial<Todo>>({ task: '', category: '', priority: null });
src/pages/TodosTab.tsx:80:      priority: (newTodo.priority as Priority) ?? null,

$ git grep -nE '\\bstatusUi\\b|\\bstatus\\b' src || true
src/components/TodosTable.tsx:114:      <div className="sr-only" role="status" aria-live="polite">
src/components/TodosTable.tsx:299:                        onClick={() => onCommitRowEdit(String(todo.id!), { id: String(todo.id!), task: todo.task, category: todo.category ?? null, priority: todo.priority, statusUi: todo.statusUi })}
src/pages/TodosTab.tsx:37:      // Ensure transforms on load (priority/id/status handling) by saving then reloading
src/pages/TodosTab.tsx:53:      // Strip UI-only status before sending
src/lib/storage.ts:42:      // Transform: ensure priority exists (null), ignore status, ensure id string, default statusUi
src/lib/storage.ts:46:        const statusUi: StatusUi = (item.statusUi === 'open' || item.statusUi === 'paused' || item.statusUi === 'blocked') ? item.statusUi : 'open';

$ git grep -nE 'aria-sort|live' src || true
src/components/TodosTable.tsx:114:      <div className="sr-only" role="status" aria-live="polite">
src/components/TodosTable.tsx:149:              <th className={tokens.table.th} aria-sort="none">Task</th>
src/components/TodosTable.tsx:153:                aria-sort={sortBy === 'priority' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
src/components/TodosTable.tsx:198:              <th className={tokens.table.th} aria-sort="none">Category</th>
src/components/TodosTable.tsx:202:                aria-sort={sortBy === 'created_at' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}

$ git grep -nE 'dark:(bg|text|border)-slate|ring-offset-slate-950' src || true
(no matches)

$ git grep -nE 'localStorage' src || true
src/pages/TodosTab.tsx:29:      // Clear localStorage to force fresh data load
src/lib/storage.ts:27:  // Save todos to localStorage
src/lib/storage.ts:30:      localStorage.setItem(this.TODOS_KEY, JSON.stringify(todos));
src/lib/storage.ts:37:  // Load todos from localStorage
src/lib/storage.ts:40:      const stored = localStorage.getItem(this.TODOS_KEY);
src/lib/storage.ts:62:  // Save sessions to localStorage
src/lib/storage.ts:65:      localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
src/lib/storage.ts:72:  // Load sessions from localStorage
src/lib/storage.ts:75:      const stored = localStorage.getItem(this.SESSIONS_KEY);
src/lib/storage.ts:85:    localStorage.removeItem(this.TODOS_KEY);
src/lib/storage.ts:86:    localStorage.removeItem(this.SESSIONS_KEY);
```

### Conclusion
- Save is NOT full-file today; it is delta/batch via `postTodosBatch` with `{ updates, completes }` and local application on success. Minimal touchpoints to change if moving to full-file:
  - `/src/pages/TodosTab.tsx` `saveBatch` (assemble full `todos` array and call new API)
  - `/src/lib/api.ts` (add `saveTodos` full-file function and export helper)
  - Optionally bypass staging on save or clear staging after full-file write


