# Intentions Database System Changes - Complete Explanation

## Overview
We completely restructured the intentions system from a simple 4-field table to a normalized, per-pillar streak tracking system. This document explains what changed and how it affects N8N flows.

## What Changed

### OLD SYSTEM (Before)
```
current_intentions table:
- Single row per day
- Columns: power, passion, purpose, production (text fields)
- No completion tracking
- No streak tracking per pillar

intention_stats table:
- Single row for overall stats
- Overall streak tracking only
```

### NEW SYSTEM (After)
```
daily_intentions table:
- One row per pillar per day
- Columns: date, pillar, intention, completed, created_at, updated_at
- Individual completion tracking per pillar
- Normalized structure

intention_stats table:
- One row per pillar (Power, Passion, Purpose, Production)
- Per-pillar streak tracking
- Columns: pillar, current_streak, longest_streak, last_completed_date, updated_at
```

## Key Changes That Affect N8N

### 1. Date Handling
- **OLD**: Used timestamp fields that could have timezone issues
- **NEW**: Uses `DATE` type for `date` field (timezone-safe)
- **Frontend**: Uses `getTodayLocalDate()` which returns local date (e.g., "2024-01-15")
- **Impact**: N8N queries must use `DATE` comparisons, not timestamp comparisons

### 2. Data Structure
- **OLD**: Single row with 4 text columns
- **NEW**: Multiple rows (one per pillar per day)
- **Impact**: N8N queries need to handle multiple rows and filter by `pillar`

### 3. Completion Tracking
- **OLD**: No completion tracking
- **NEW**: `completed` boolean field per pillar per day
- **Impact**: N8N can now track which specific pillars were completed

### 4. Streak Tracking
- **OLD**: Single overall streak
- **NEW**: Individual streaks per pillar
- **Impact**: N8N can generate pillar-specific streak messages

## N8N Flow Changes Needed

### Daily Message Generation
```sql
-- Get today's intentions (replace old current_intentions query)
SELECT pillar, intention, completed 
FROM daily_intentions 
WHERE date = CURRENT_DATE 
ORDER BY pillar;

-- Get current streaks (replace old intention_stats query)
SELECT pillar, current_streak, longest_streak 
FROM intention_stats 
ORDER BY current_streak DESC;
```

### Completion Callback Queries
```sql
-- Mark specific pillar as completed
UPDATE daily_intentions 
SET completed = true, updated_at = NOW() 
WHERE date = CURRENT_DATE AND pillar = 'Power';

-- Then trigger streak recalculation (this happens automatically in frontend)
```

### Timezone Considerations
- **Frontend**: Always uses local timezone for date operations
- **Database**: `DATE` fields are timezone-agnostic
- **N8N**: Should use the same timezone as frontend (Austin time: America/Chicago)
- **Recommendation**: Configure N8N to use 'America/Chicago' timezone for all date operations

## SQL Queries for Context
Run the queries in `intentions_db_changes.sql` to see:
1. Current table structures
2. Recent data patterns
3. Completion rates per pillar
4. Active streaks
5. Today's status

## Migration Impact
- **Frontend**: Already updated to use new structure
- **Database**: New tables created, old tables may still exist
- **N8N**: Needs to be updated to use new queries
- **No Data Loss**: All existing intention data preserved

## Benefits of New System
1. **Per-pillar tracking**: Individual streaks and completion rates
2. **Historical data**: Can analyze patterns per pillar over time
3. **Timezone safety**: DATE fields prevent timezone confusion
4. **Scalability**: Can easily add new pillars or features
5. **Completion tracking**: Know exactly which pillars were completed each day

## Next Steps for N8N
1. Update daily message queries to use `daily_intentions` table
2. Update streak queries to use new `intention_stats` structure
3. Configure timezone to 'America/Chicago' for consistency
4. Update callback handlers to work with per-pillar completion
5. Test with current database state using provided SQL queries

