# Weekly Achievement Tracking - Implementation Guide

## ✅ Feature Complete!

A 52-week goal achievement visualization that shows at a glance which weeks you met your habit goals throughout the year.

## What Was Built

### Visual 52-Week Grid
- **Horizontal layout**: Each habit has a row, with 52 columns (one per week)
- **Status indicators**:
  - ✓ (Green) = Goal met that week
  - × (Red) = Missed goal
  - — (Gray) = No goal set for that week
- **Interactive**: Hover over any week to see details (completions vs goal)
- **Current week**: Highlighted with a ring to show where you are now

### Smart Historical Tracking
- **Preserves context**: When you change your weekly goal, past weeks stay evaluated against the goal they had at the time
- **Example**: If you had a goal of 3 days/week in January but changed to 5 days/week in June:
  - January weeks are evaluated against 3 days/week (historical)
  - June onwards evaluated against 5 days/week (current)
- **Why this matters**: You can see accurate progress over time without invalidating past achievements

### Database Architecture

#### New Table: `habit_weekly_achievements`
```sql
CREATE TABLE habit_weekly_achievements (
  id UUID PRIMARY KEY,
  habit_id UUID REFERENCES habits(id),
  year INTEGER,
  week_number INTEGER (1-52),
  
  -- Historical snapshot
  goal_at_week INTEGER,        -- What the goal was during this week
  actual_completions INTEGER,  -- How many days completed
  goal_met BOOLEAN,            -- TRUE if actual >= goal
  
  -- Week boundaries
  week_start_date DATE,        -- Monday
  week_end_date DATE,          -- Sunday
  
  UNIQUE(habit_id, year, week_number)
);
```

#### Auto-Update Trigger
```sql
-- Trigger runs when habit_entries change
-- Only updates current week + previous week (for late entries)
-- Older weeks remain locked (preserves history)
```

## How It Works

### Data Flow

```
User completes habit day
  ↓
habit_entries table updated
  ↓
Trigger fires
  ↓
Check if week is current or previous
  ↓
If yes: Recalculate week stats
  ↓
If no: Skip (week is locked)
  ↓
Update habit_weekly_achievements
  ↓
Frontend fetches on page load
  ↓
Render 52-week grid
```

### Week Locking Logic

**Current week**: Always recalculates (live updates as you complete habits)
**Previous week**: Recalculates (allows late entries)
**Older weeks**: LOCKED (never recalculated, preserves historical accuracy)

**Why?**
- Prevents accidental changes to past achievements
- Preserves "what was my goal back then?"
- Maintains historical accuracy even as goals evolve

### Goal Change Behavior

**Scenario**: You set Reading goal to 3 days/week on Jan 1, then change it to 5 days/week on June 1.

**Result**:
- Weeks 1-22 (Jan-May): Evaluated against 3 days/week goal
- Weeks 23-52 (Jun-Dec): Evaluated against 5 days/week goal
- Changing the goal in June does NOT recalculate January-May

**How**: The `goal_at_week` field stores the goal that was active during that week.

## Current Data (2025)

Your weekly achievement rates:

| Habit | Weekly Goal | Weeks Met | Success Rate |
|-------|-------------|-----------|--------------|
| Working Out | 2 days | 32/52 | 61.5% 🔥 |
| Reading | 1 day | 30/52 | 57.7% |
| Building | 2 days | 12/52 | 23.1% |
| Writing | 1 day | 8/52 | 15.4% |
| Fasting | 4 days | 5/52 | 9.6% |
| No Spend | 2 days | 3/52 | 5.8% |

**Insights:**
- Working Out and Reading are your most consistent habits
- No Spend and Fasting need more attention
- You can see patterns by looking at the grid (e.g., did you have a strong month?)

## UI Features

### Location
Habit Tracker tab → Statistics section → Bottom of the page

### Layout
```
Weekly Goal Achievement
52-week view: ✓ = Goal met, X = Missed, — = No goal set

Habit         W1  W5  W10  W15  W20  W25  W30  W35  W40  W45  W50
────────────────────────────────────────────────────────────────
Reading       ✓   ×   ✓    ✓    ×    ✓    ✓    ×    ✓    ✓    ✓
Working Out   ✓   ✓   ×    ✓    ✓    ✓    ×    ✓    ✓    ✓    ×
Fasting       ×   ×   ×    ×    ✓    ×    ×    ×    ×    ×    ×
...
```

### Interactions
- **Hover**: Shows tooltip with week number and details
- **Current week**: Has a green ring around it
- **Week labels**: Every 5th week shows number, others show dots

### Colors
- **Success (✓)**: Uses habit's color (emerald, teal, amber, etc.)
- **Failure (×)**: Red
- **No goal (—)**: Gray
- **Current week**: Green ring highlight

## Files Modified/Created

### New Files
- `src/components/HabitWeeklyAchievementGrid.tsx` - Grid visualization component
- `WEEKLY_ACHIEVEMENT_TRACKING.md` - This documentation

### Modified Files
- `src/types/index.ts` - Added `HabitWeeklyAchievement` type
- `src/lib/api.ts` - Added `fetchHabitWeeklyAchievements()` method
- `src/components/HabitStatsModule.tsx` - Integrated grid component

### Database
- New table: `habit_weekly_achievements`
- New function: `update_habit_weekly_achievement()`
- New trigger: `trigger_habit_weekly_achievement`
- Backfill function: `backfill_weekly_achievements()`

## Performance

**Database:**
- Single query fetches all 52 weeks for all habits (~300 rows)
- Pre-calculated results (no expensive aggregations at load time)
- Indexed for fast lookups

**Frontend:**
- React memoization prevents unnecessary re-renders
- Lazy loading (only when tab visible)
- Efficient data structures (Map for O(1) lookups)

## Usage

### View Achievement History
1. Go to Habit Tracker tab
2. Scroll to Statistics section
3. See "Weekly Goal Achievement" grid at the bottom
4. Hover over any week to see details

### Set Weekly Goal (affects future weeks only)
1. In the stats table above, click a habit's goal cell
2. Enter your target (e.g., "5" for 5 days/week)
3. Press Enter
4. Future weeks will be evaluated against this new goal
5. Past weeks remain unchanged

### Interpret the Grid
- **Green ✓**: You hit your goal that week! 🎉
- **Red ×**: Missed the goal (room for improvement)
- **Gray —**: No goal was set for that week
- **Ring highlight**: Shows current week

## Future Enhancements

### Potential Features
1. **Yearly comparison**: Compare 2025 vs 2024 side-by-side
2. **Streak indicators**: Highlight consecutive winning/losing weeks
3. **Goal adjustment UI**: Click a week to see/adjust what the goal was
4. **Export data**: Download CSV of weekly achievements
5. **Trend lines**: Show improvement over quarters
6. **Milestone badges**: Celebrate 10-week streaks, etc.

## Technical Details

### Week Calculation
- Uses ISO week numbers (Monday = start of week)
- `EXTRACT(WEEK FROM date)` returns 1-53
- Week 1 = first week with a Thursday in the new year
- Most years have 52 weeks, some have 53

### Data Integrity
- Foreign key cascade: Deleting a habit deletes its achievements
- Unique constraint: One achievement record per habit per week
- Check constraints: Week numbers must be 1-53

### Trigger Safety
- Only processes current and previous week (prevents accidental overwrites)
- Preserves `goal_at_week` once set (historical accuracy)
- Handles INSERT, UPDATE, DELETE operations

## Summary

You now have:
- ✅ 52-week visual achievement grid
- ✅ Historical goal context preserved
- ✅ Smart locking (past weeks don't recalculate)
- ✅ Real-time updates for current week
- ✅ Beautiful color-coded visualization
- ✅ Hover tooltips with details
- ✅ Fast loading (pre-calculated data)

**This gives you an instant visual snapshot of your entire year's habit consistency!** 

See trends, identify weak periods, celebrate wins, and use data to improve future weeks. 📊✨




