-- Migration: Drop old current_intentions table
-- Date: 2024-12-13
-- Reason: System now uses daily_intentions table for all intention storage
-- Safety: This script checks if current_intentions exists and only drops if it does

-- STEP 1: Verify that daily_intentions table exists and has data
DO $$
BEGIN
  -- Check if daily_intentions exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_intentions') THEN
    RAISE EXCEPTION 'ERROR: daily_intentions table does not exist. Migration cannot proceed safely.';
  END IF;
  
  -- Check if daily_intentions has at least some data (safety check)
  IF (SELECT COUNT(*) FROM daily_intentions) = 0 THEN
    RAISE WARNING 'WARNING: daily_intentions table exists but is empty.';
  END IF;
  
  RAISE NOTICE 'VERIFIED: daily_intentions table exists and is ready.';
END $$;

-- STEP 2: Check if current_intentions table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'current_intentions') THEN
    RAISE NOTICE 'FOUND: current_intentions table exists and will be dropped.';
  ELSE
    RAISE NOTICE 'INFO: current_intentions table does not exist. Nothing to drop.';
  END IF;
END $$;

-- STEP 3: Drop current_intentions table if it exists
-- This is safe because all code now uses daily_intentions
DROP TABLE IF EXISTS current_intentions CASCADE;

-- STEP 4: Verify the drop was successful
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'current_intentions') THEN
    RAISE NOTICE 'SUCCESS: current_intentions table has been dropped (or never existed).';
  ELSE
    RAISE WARNING 'WARNING: current_intentions table still exists after drop attempt.';
  END IF;
END $$;

-- RESULT: current_intentions table is now removed
-- All intention data is stored in daily_intentions (one row per pillar per day)
-- All streak data is stored in intention_stats (one row per pillar)

-- ROLLBACK NOTES:
-- If you need to rollback, you would need to:
-- 1. Recreate the current_intentions table structure
-- 2. Migrate data from daily_intentions back to current_intentions format
-- However, this is not recommended as the new system is more robust

