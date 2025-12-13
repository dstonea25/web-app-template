# OKR Direction & Over-Achievement Implementation Guide

## Overview

This implementation adds two major features to your OKR system:

1. **Countdown OKRs** - Track goals that minimize/decrease (e.g., weight loss: 252 lbs → 245 lbs)
2. **Over-Achievement Tracking** - Allow progress > 100% with visual celebration (e.g., 12/10 dates = 120%)

## Database Changes

### New Fields in `okr_key_results` Table

```sql
-- Direction of progress (default: 'up')
direction TEXT DEFAULT 'up' CHECK (direction IN ('up', 'down'))

-- Baseline value for countdown KRs (required when direction='down')
baseline_value NUMERIC NULL
```

### Updated Progress Calculation

The `progress` generated column now handles both directions:

**Count Up (direction='up'):**
- Formula: `current_value / target_value`
- Example: 12 dates / 10 target = 1.2 (120%)
- **No upper cap** - can exceed 100% for over-achievement

**Count Down (direction='down'):**
- Formula: `(baseline_value - current_value) / (baseline_value - target_value)`
- Example: Weight loss
  - Baseline: 252 lbs
  - Current: 250 lbs  
  - Target: 245 lbs
  - Progress: (252-250)/(252-245) = 2/7 = 28.6%
  - At 245: (252-245)/(252-245) = 100%
  - At 240: (252-240)/(252-245) = 171% (exceeded goal!)

## Usage Examples

### Example 1: Weight Loss (Countdown)

```sql
INSERT INTO okr_key_results (
  okr_id, 
  description, 
  type, 
  direction,
  baseline_value,
  target_value, 
  current_value
) VALUES (
  'some-okr-id',
  'Lose weight to 245 lbs',
  'count',
  'down',          -- Countdown direction
  252,             -- Starting weight
  245,             -- Goal weight
  252              -- Current weight (will update over time)
);
```

**Progress over time:**
- Week 1: 252 → 250 lbs = (252-250)/(252-245) = 28.6%
- Week 4: 250 → 248 lbs = (252-248)/(252-245) = 57.1%
- Week 8: 248 → 245 lbs = (252-245)/(252-245) = 100% ✅
- Week 10: 245 → 242 lbs = (252-242)/(252-245) = 142.8% 🎉 (exceeded!)

### Example 2: Dating Goal (Count Up with Over-Achievement)

```sql
INSERT INTO okr_key_results (
  okr_id,
  description,
  type,
  direction,
  baseline_value,
  target_value,
  current_value
) VALUES (
  'some-okr-id',
  'Go on 10 dates this quarter',
  'count',
  'up',            -- Count up direction (default)
  NULL,            -- Not needed for count-up
  10,              -- Target: 10 dates
  0                -- Starting at 0
);
```

**Progress over time:**
- Month 1: 0 → 3 dates = 3/10 = 30%
- Month 2: 3 → 7 dates = 7/10 = 70%
- Month 3: 7 → 10 dates = 10/10 = 100% ✅
- Extra: 10 → 12 dates = 12/10 = 120% 🎉 (over-achieved!)

### Example 3: Percent Type (Can Also Over-Achieve)

```sql
INSERT INTO okr_key_results (
  okr_id,
  description,
  type,
  direction,
  target_value,
  current_value
) VALUES (
  'some-okr-id',
  'Exercise adherence rate',
  'percent',
  'up',
  95,              -- Target: 95%
  0                -- Starting at 0%
);
```

Can update to 98% = 103.2% of target goal! 🎉

## Frontend Features

### Visual Indicators

1. **Over-Achievement (>100%)**
   - 🎉 Emoji badge next to percentage
   - Gold/yellow text color (#FFD700)
   - Progress bar: Full with gold color + pulse animation
   - Shimmer effect across the progress bar

2. **Countdown Display**
   - Shows: `baseline → current → target`
   - Example: `252 → 250 → 245`
   - Target shown in emerald green (goal color)

3. **Count-Up Display**
   - Shows: `current / target`
   - Example: `12 / 10` (with 120% and 🎉)
   - No input restrictions on current value

### UI Components

**Progress Bar:**
- Standard: Normal pillar color
- Over-achievement: Gold (#FFD700) with pulse + shimmer
- Ring glow around bar when >100%

**Percentage Display:**
- Normal: Pillar accent color
- Over 100%: Yellow (#FFD700) + 🎉 emoji

**Input Fields:**
- Count-up: Allows any value (no max restriction)
- Count-down: Shows baseline → current → target flow
- Percent: Allows values > 100%

## Migration Steps

### Step 1: Run Migration

```bash
# Apply the migration to add new columns
supabase db push migrations/add_okr_direction.sql
```

Or manually run via Supabase MCP:

```typescript
await mcp_supabase_apply_migration({
  project_id: "your-project-id",
  name: "add_okr_direction",
  query: "-- contents of add_okr_direction.sql --"
});
```

### Step 2: Update Existing KRs (Optional)

If you have existing key results that should be countdown:

```sql
-- Example: Convert weight-related KRs to countdown
UPDATE okr_key_results
SET 
  direction = 'down',
  baseline_value = current_value  -- Use current as baseline
WHERE 
  description ILIKE '%weight%'
  OR description ILIKE '%reduce%'
  OR description ILIKE '%lose%';
```

### Step 3: Deploy Frontend

The frontend code is already updated to handle both directions. Just deploy:

```bash
npm run build
# Deploy dist/ to your hosting
```

## API Functions

New functions in `src/lib/okrs.ts`:

```typescript
// Update baseline value (for countdown KRs)
await updateKrBaseline(krId, 252);

// Update direction
await updateKrDirection(krId, 'down');

// Existing functions still work
await updateKeyResultValue(krId, 250);
await updateKrTarget(krId, 245);
```

## Type Definitions

```typescript
// New type
export type OkrDirection = 'up' | 'down';

// Updated interface
export interface OkrKeyResult {
  id: string;
  okr_id: string;
  description: string;
  kind: KeyResultKind;
  target_value: number | boolean | null;
  current_value: number | boolean | null;
  progress?: number | null;
  
  // NEW: Direction and baseline
  direction?: OkrDirection;      // 'up' or 'down'
  baseline_value?: number | null; // Required for 'down'
}
```

## Best Practices

### When to Use 'down' Direction

- Weight loss
- Debt reduction
- Bug count reduction
- Response time reduction
- Cost reduction
- Any "minimize/decrease" goal

**Important:** Always set `baseline_value` when using `direction='down'`

### When to Use 'up' Direction

- Revenue/income goals
- Workout count
- Book reading count
- Social activities
- Any "maximize/increase" goal

**Tip:** Don't set a `baseline_value` for count-up KRs

### Over-Achievement Philosophy

Over-achievement should be:
1. **Celebrated** - Visual indicators make it clear you exceeded expectations
2. **Realistic** - The progress formula can theoretically go beyond reasonable values, so set appropriate targets
3. **Motivating** - Seeing 120% can encourage continued excellence

## Troubleshooting

### Progress shows 0% for countdown KR

**Check:**
1. Is `direction='down'` set?
2. Is `baseline_value` set and greater than `target_value`?
3. Is `current_value` between baseline and target?

**Fix:**
```sql
UPDATE okr_key_results
SET baseline_value = 252
WHERE id = 'kr-id' AND baseline_value IS NULL;
```

### Can't input values over target

**Check:** Are you on an old version of the frontend? The `max` attribute should be removed for count-up inputs.

**Fix:** Clear cache and reload, or check that you're running the latest version.

### Over-achievement not showing visual indicators

**Check:** Tailwind animations might not be compiled.

**Fix:**
```bash
npm run build  # Rebuilds with new Tailwind config
```

## Future Enhancements

Potential additions:
1. **Auto-detect direction** - Infer from description keywords ("lose", "reduce" = down)
2. **Baseline auto-capture** - Set baseline_value = first recorded current_value
3. **Progress history graph** - Chart progress over time
4. **Streak tracking** - Track consecutive days of progress
5. **Direction toggle UI** - Add button to switch between up/down in UI
6. **Baseline editor** - Allow editing baseline in the UI (currently DB-only)

## Summary

This implementation provides:
- ✅ Full support for countdown OKRs (weight loss, debt reduction, etc.)
- ✅ Over-achievement tracking (>100%) with visual celebration
- ✅ Automatic progress calculation for both directions
- ✅ Clean UI with directional indicators
- ✅ Type-safe TypeScript integration
- ✅ Backward compatible (existing 'up' KRs work unchanged)

Your OKR system now intuitively handles both "maximize" and "minimize" goals! 🎉

