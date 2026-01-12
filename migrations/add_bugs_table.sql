-- Migration: Create bugs table for production bug reporting
-- Simple table to track bugs reported from prod with AI-readable context

-- Step 1: Create the bugs table
CREATE TABLE IF NOT EXISTS bugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Bug description (the "blurb" that will be enough context for AI to fix)
  description TEXT NOT NULL,
  
  -- Status: open, in_progress, fixed, closed
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'fixed', 'closed')),
  
  -- Optional metadata
  url TEXT,  -- Page where bug was encountered
  user_agent TEXT,  -- Browser info
  notes TEXT,  -- Additional notes added later
  
  -- User tracking
  user_id TEXT,  -- For multi-user support
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  fixed_at TIMESTAMPTZ  -- When status changed to 'fixed'
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_bugs_status 
  ON bugs(status);

CREATE INDEX IF NOT EXISTS idx_bugs_created_at 
  ON bugs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bugs_user 
  ON bugs(user_id);

-- Step 3: Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Add updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at_bugs ON bugs;
CREATE TRIGGER set_updated_at_bugs
  BEFORE UPDATE ON bugs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 5: Enable RLS
ALTER TABLE bugs ENABLE ROW LEVEL SECURITY;

-- Step 6: Add RLS policies (allow all operations for now, adjust as needed)
DROP POLICY IF EXISTS "Users can view all bugs" ON bugs;
CREATE POLICY "Users can view all bugs"
  ON bugs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert bugs" ON bugs;
CREATE POLICY "Users can insert bugs"
  ON bugs FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update bugs" ON bugs;
CREATE POLICY "Users can update bugs"
  ON bugs FOR UPDATE
  USING (true);

-- Migration complete!
-- Now you can report bugs from prod and query them via AI.
