-- Migration: Add multi-day event support and row appearance features
-- Run this migration on your Supabase database

-- Step 1: Add new columns to calendar_events table
ALTER TABLE calendar_events
  -- Rename date to start_date for clarity
  RENAME COLUMN date TO start_date;

ALTER TABLE calendar_events
  -- Multi-day event support
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS all_day BOOLEAN DEFAULT true,
  
  -- Row appearance / priority system
  ADD COLUMN IF NOT EXISTS affects_row_appearance BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 5,
  
  -- Pattern linkage (FK will be added after patterns table is created)
  ADD COLUMN IF NOT EXISTS source_pattern_id UUID,
  
  -- Optional: user ownership
  ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Step 2: Backfill existing events
-- Set end_date = start_date for all existing single-day events
UPDATE calendar_events 
SET end_date = start_date 
WHERE end_date IS NULL;

-- Set all existing events to all_day = true (since they don't have times)
UPDATE calendar_events 
SET all_day = true 
WHERE all_day IS NULL;

-- Step 3: Add NOT NULL constraint to end_date after backfill
-- (We want end_date to always have a value, defaulting to start_date)
ALTER TABLE calendar_events
  ALTER COLUMN end_date SET DEFAULT start_date;

-- Step 4: Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_date_range 
  ON calendar_events(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_calendar_events_pattern 
  ON calendar_events(source_pattern_id) 
  WHERE source_pattern_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_priority 
  ON calendar_events(priority, affects_row_appearance) 
  WHERE affects_row_appearance = true;

-- Step 5: Add check constraints
ALTER TABLE calendar_events
  ADD CONSTRAINT chk_calendar_events_date_order 
  CHECK (end_date >= start_date);

ALTER TABLE calendar_events
  ADD CONSTRAINT chk_calendar_events_priority_range 
  CHECK (priority BETWEEN 1 AND 10);

-- Step 6: Update RLS policies if you have them
-- (Assuming you want users to only see their own events)
-- Uncomment and modify if needed:

-- DROP POLICY IF EXISTS "Users can view their own calendar events" ON calendar_events;
-- CREATE POLICY "Users can view their own calendar events"
--   ON calendar_events FOR SELECT
--   USING (auth.uid()::text = user_id OR user_id IS NULL);

-- DROP POLICY IF EXISTS "Users can insert their own calendar events" ON calendar_events;
-- CREATE POLICY "Users can insert their own calendar events"
--   ON calendar_events FOR INSERT
--   WITH CHECK (auth.uid()::text = user_id OR user_id IS NULL);

-- DROP POLICY IF EXISTS "Users can update their own calendar events" ON calendar_events;
-- CREATE POLICY "Users can update their own calendar events"
--   ON calendar_events FOR UPDATE
--   USING (auth.uid()::text = user_id OR user_id IS NULL);

-- DROP POLICY IF EXISTS "Users can delete their own calendar events" ON calendar_events;
-- CREATE POLICY "Users can delete their own calendar events"
--   ON calendar_events FOR DELETE
--   USING (auth.uid()::text = user_id OR user_id IS NULL);

-- Migration complete!
-- Next: Run add_calendar_patterns_table.sql to create the patterns table





