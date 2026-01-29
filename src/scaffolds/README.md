# UI Scaffolds & Patterns

This folder contains reference implementations of common UI patterns from a real production app. These are **NOT actively used** in the template - they serve as examples for agents to reference when building new features.

> **Note:** This folder is excluded from TypeScript compilation (`tsconfig.app.json`). 
> These files have unresolved imports - they're meant to be **copied and adapted**, not used directly.

---

## Page Patterns (`pages/`)

### PrioritiesTab.tsx - Two-Pane Master/Detail Layout
**Use when:** You need a sidebar list with a detail view
- Left pane: scrollable list of items (pillars/categories)
- Right pane: expanded detail view of selected item
- Collapsible sections within each pane
- Drag-to-reorder support
- Mobile: stacks vertically

**Key patterns:**
- `useState` for tracking selected item
- Conditional rendering based on selection
- Responsive grid: `grid-cols-1 lg:grid-cols-[300px_1fr]`

### ChallengesTab.tsx - Card Grid with Filters
**Use when:** Displaying a collection of items with filtering
- Filter tabs/pills at top
- Grid of cards below
- Cards have badges, progress indicators
- Modal for creating/editing

### HabitTrackerTab.tsx - Calendar/Grid Tracker View
**Use when:** Tracking daily activities over time
- Month/week navigation
- Grid of checkboxes or status indicators
- Stats summary panel
- Settings modal

### GrowthTab.tsx - Multi-Section Dashboard
**Use when:** Complex page with multiple distinct sections
- Collapsible accordion sections
- Mix of forms, stats, and lists
- Year/period selector
- Goals with progress bars

### TimeTrackingTab.tsx - Timer + History Log
**Use when:** Real-time tracking with historical data
- Active timer display
- Form for manual entry
- Table of past entries
- Date range filtering
- Category pills for filtering

### TodosTab.tsx - Editable Table with CRUD
**Use when:** Managing a list of items with inline editing
- Inline editable cells
- Add new row
- Delete/complete actions
- Sorting and filtering
- Keyboard navigation support

### IdeasTab.tsx - Simple Table with Categories
**Use when:** Basic list management with category tabs
- Category filter tabs
- Table with expandable notes
- Status toggling
- Simpler than TodosTab

---

## Component Patterns (`components/`)

### ChallengesModule.tsx - Badge/Achievement Card Grid
**Use when:** Displaying gamification elements, achievements, or challenge cards
- Card grid layout
- Progress indicators (circular, bar)
- Status badges (locked, in-progress, completed)
- Expandable details
- Confetti/celebration animations

**Key UI elements:**
- Progress circles with percentage
- Lock/unlock states
- Category grouping
- Modal for details

### HabitStatsModule.tsx - Statistics Dashboard
**Use when:** Showing aggregated stats with multiple metrics
- Stat cards in a grid
- Streak counters
- Rolling averages
- Trend indicators (up/down arrows)
- Tooltips for context

### HabitWeeklyAchievementGrid.tsx - Weekly Progress Grid
**Use when:** Showing week-by-week completion data
- 7-column grid (one per day)
- Visual indicators for completion
- Goal vs actual comparison
- Color-coded status

### MonthlyHabitOverview.tsx - Calendar Heatmap Style
**Use when:** Showing activity over a month
- Calendar grid layout
- Color intensity based on activity
- Click to drill down
- Legend for color meanings

### CommittedPrioritiesModule.tsx - Hierarchical Card List
**Use when:** Nested data with parent/child relationships
- Expandable/collapsible groups
- Nested items within groups
- Checkbox/toggle for each item
- Progress at group level

### TodosTable.tsx - Editable Data Table
**Use when:** Inline-editable table with multiple columns
- Click-to-edit cells
- Tab navigation between cells
- Validation feedback
- Optimistic updates
- Undo support

### IdeasTable.tsx - Simpler Editable Table
**Use when:** Basic table with fewer features than TodosTable
- Simpler inline editing
- Expandable row for notes
- Category badges

### TimerCard.tsx - Simple Timer Display
**Use when:** Showing elapsed time or countdown
- Large time display
- Start/stop/reset buttons
- State indicator (running/paused)

---

## How to Use These Scaffolds

### For Agents:
1. Identify which pattern matches your needs
2. Copy the relevant file to `src/pages/` or `src/components/`
3. Update imports to use current `theme/config` tokens
4. Replace data fetching with your API functions
5. Update types to match your data model

### Common Adaptations Needed:
- Replace `import { someFunction } from '../lib/api'` with your API calls
- Replace type imports with your types from `../types`
- Update color classes to use `palette` and `tokens` from theme
- Replace hardcoded data with props or API data

### Example: Creating a "Projects" tab from PrioritiesTab pattern
```typescript
// 1. Copy PrioritiesTab.tsx to src/pages/ProjectsTab.tsx
// 2. Rename component: PrioritiesTab → ProjectsTab
// 3. Replace data types: Priority → Project, Pillar → Category
// 4. Replace API calls: fetchPriorities → fetchProjects
// 5. Update UI labels and icons
// 6. Add to tabs.ts and AppShell.tsx
```

---

## Pattern Quick Reference

| Need | Use This |
|------|----------|
| Master/detail two-pane layout | `PrioritiesTab` |
| Card grid with filters | `ChallengesTab`, `ChallengesModule` |
| Daily/weekly tracking calendar | `HabitTrackerTab`, `MonthlyHabitOverview` |
| Achievement/badge display | `ChallengesModule`, `HabitWeeklyAchievementGrid` |
| Stats dashboard with metrics | `HabitStatsModule` |
| Editable table with CRUD | `TodosTab`, `TodosTable` |
| Timer with history | `TimeTrackingTab`, `TimerCard` |
| Multi-section complex page | `GrowthTab` |
| Nested/hierarchical data | `CommittedPrioritiesModule` |
