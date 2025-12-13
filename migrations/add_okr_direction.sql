-- Migration: Add direction and baseline_value to okr_key_results
-- This enables countdown OKRs (weight loss) and over-achievement tracking (>100%)

-- Step 1: Add new columns
ALTER TABLE okr_key_results 
ADD COLUMN direction TEXT DEFAULT 'up' CHECK (direction IN ('up', 'down')),
ADD COLUMN baseline_value NUMERIC NULL;

-- Step 2: Drop the old generated progress column
ALTER TABLE okr_key_results 
DROP COLUMN progress;

-- Step 3: Recreate progress column with new logic
ALTER TABLE okr_key_results 
ADD COLUMN progress NUMERIC GENERATED ALWAYS AS (
  CASE
    -- Boolean type: simple yes/no (0 or 1)
    WHEN type = 'boolean' THEN 
      CASE WHEN current_value >= target_value THEN 1 ELSE 0 END
    
    -- Countdown direction (minimize): baseline → target
    -- Example: Weight 252 → 245 (baseline=252, target=245)
    -- At 250: (252-250)/(252-245) = 2/7 = 0.286 (28.6%)
    -- At 245: (252-245)/(252-245) = 7/7 = 1.0 (100%)
    -- At 240: (252-240)/(252-245) = 12/7 = 1.71 (171% - exceeded goal!)
    WHEN direction = 'down' THEN
      CASE 
        WHEN baseline_value IS NULL OR baseline_value = target_value THEN 0
        ELSE GREATEST(0, 
          (baseline_value - current_value) / NULLIF(baseline_value - target_value, 0)
        )
      END
    
    -- Count up direction (maximize): 0 → target (and beyond!)
    -- Example: Dates 0 → 10
    -- At 5: 5/10 = 0.5 (50%)
    -- At 10: 10/10 = 1.0 (100%)
    -- At 12: 12/10 = 1.2 (120% - exceeded goal!)
    ELSE 
      CASE
        WHEN target_value <= 0 THEN 0
        ELSE current_value / NULLIF(target_value, 0)
      END
  END
) STORED;

-- Step 4: Add comment for documentation
COMMENT ON COLUMN okr_key_results.direction IS 
  'Direction of progress: "up" for maximizing (default), "down" for minimizing (weight loss, etc)';

COMMENT ON COLUMN okr_key_results.baseline_value IS 
  'Starting value for countdown KRs. Required when direction="down". Example: current weight before starting weight loss goal.';

COMMENT ON COLUMN okr_key_results.progress IS 
  'Auto-calculated progress ratio. Can exceed 1.0 (100%) for over-achievement on count-up KRs. For countdown KRs, calculated as (baseline-current)/(baseline-target).';

