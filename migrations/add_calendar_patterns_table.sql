-- Migration: Create calendar_patterns table for pattern-based event generation
-- Run this AFTER add_calendar_multiday_support.sql

-- Step 1: Create the patterns table
CREATE TABLE IF NOT EXISTS calendar_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  name TEXT NOT NULL,
  pattern_type TEXT NOT NULL,  -- 'recurring', 'goal', 'one_off_template', etc.
  category TEXT,  -- Same categories as events (for color coding generated events)
  notes TEXT,
  
  -- Date boundaries (optional, depends on pattern type)
  start_date DATE,
  end_date DATE,
  
  -- Flexible rule storage (will be populated by LLM or manual form)
  rule_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Row appearance defaults for generated events
  default_affects_row_appearance BOOLEAN DEFAULT false,
  default_priority INTEGER DEFAULT 5,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_by TEXT,
  user_id TEXT,  -- For multi-user support
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_calendar_patterns_active 
  ON calendar_patterns(is_active);

CREATE INDEX IF NOT EXISTS idx_calendar_patterns_type 
  ON calendar_patterns(pattern_type);

CREATE INDEX IF NOT EXISTS idx_calendar_patterns_dates 
  ON calendar_patterns(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_calendar_patterns_user 
  ON calendar_patterns(user_id);

-- Step 3: Add check constraints
ALTER TABLE calendar_patterns
  ADD CONSTRAINT chk_calendar_patterns_date_order 
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);

ALTER TABLE calendar_patterns
  ADD CONSTRAINT chk_calendar_patterns_priority_range 
  CHECK (default_priority BETWEEN 1 AND 10);

-- Step 4: Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Add updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at_calendar_patterns ON calendar_patterns;
CREATE TRIGGER set_updated_at_calendar_patterns
  BEFORE UPDATE ON calendar_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 6: Now add the FK constraint from calendar_events to calendar_patterns
ALTER TABLE calendar_events
  ADD CONSTRAINT fk_calendar_events_pattern
  FOREIGN KEY (source_pattern_id) 
  REFERENCES calendar_patterns(id) 
  ON DELETE SET NULL;

-- Step 7: Add RLS policies if needed
-- (Assuming you want users to only see their own patterns)
-- Uncomment and modify if needed:

-- ALTER TABLE calendar_patterns ENABLE ROW LEVEL SECURITY;

-- DROP POLICY IF EXISTS "Users can view their own patterns" ON calendar_patterns;
-- CREATE POLICY "Users can view their own patterns"
--   ON calendar_patterns FOR SELECT
--   USING (auth.uid()::text = user_id OR user_id IS NULL);

-- DROP POLICY IF EXISTS "Users can insert their own patterns" ON calendar_patterns;
-- CREATE POLICY "Users can insert their own patterns"
--   ON calendar_patterns FOR INSERT
--   WITH CHECK (auth.uid()::text = user_id OR user_id IS NULL);

-- DROP POLICY IF EXISTS "Users can update their own patterns" ON calendar_patterns;
-- CREATE POLICY "Users can update their own patterns"
--   ON calendar_patterns FOR UPDATE
--   USING (auth.uid()::text = user_id OR user_id IS NULL);

-- DROP POLICY IF EXISTS "Users can delete their own patterns" ON calendar_patterns;
-- CREATE POLICY "Users can delete their own patterns"
--   ON calendar_patterns FOR DELETE
--   USING (auth.uid()::text = user_id OR user_id IS NULL);

-- Migration complete!
-- You can now create patterns and link events to them.

-- Example pattern for recurring events:
-- INSERT INTO calendar_patterns (name, pattern_type, category, rule_json)
-- VALUES (
--   'Gym Sessions',
--   'recurring',
--   'personal',
--   '{"frequency": "weekly", "days": ["monday", "wednesday"], "time": "18:00", "duration_minutes": 60}'
-- );

-- Example pattern for goals:
-- INSERT INTO calendar_patterns (name, pattern_type, category, rule_json, start_date, end_date)
-- VALUES (
--   'Date Nights',
--   'goal',
--   'social',
--   '{"type": "count", "target": 5, "prompt": "Go on dates"}',
--   '2024-01-01',
--   '2024-03-31'
-- );







