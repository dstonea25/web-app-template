-- Migration: Create feature_ideas table for tracking feature suggestions
-- LLM-friendly table to store, retrieve, and manage feature ideas from users

-- Step 1: Create the feature_ideas table
CREATE TABLE IF NOT EXISTS feature_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Feature idea (brain dump - everything goes here)
  description TEXT NOT NULL,
  
  -- Status: backlog, planned, in_progress, completed, cancelled
  status TEXT NOT NULL DEFAULT 'backlog'
    CHECK (status IN ('backlog', 'planned', 'in_progress', 'completed', 'cancelled')),
  
  -- Optional metadata
  url TEXT,  -- Page where idea was submitted
  user_agent TEXT,  -- Browser info
  notes TEXT,  -- Implementation notes added later by AI or user
  
  -- User tracking
  user_id TEXT,  -- For multi-user support
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ  -- When status changed to 'completed'
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_feature_ideas_status 
  ON feature_ideas(status);

CREATE INDEX IF NOT EXISTS idx_feature_ideas_created_at 
  ON feature_ideas(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feature_ideas_user 
  ON feature_ideas(user_id);

-- Step 3: Add updated_at trigger (reuse existing function from bugs table)
DROP TRIGGER IF EXISTS set_updated_at_feature_ideas ON feature_ideas;
CREATE TRIGGER set_updated_at_feature_ideas
  BEFORE UPDATE ON feature_ideas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 4: Enable RLS
ALTER TABLE feature_ideas ENABLE ROW LEVEL SECURITY;

-- Step 5: Add RLS policies (allow all operations for now, adjust as needed)
DROP POLICY IF EXISTS "Users can view all feature ideas" ON feature_ideas;
CREATE POLICY "Users can view all feature ideas"
  ON feature_ideas FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert feature ideas" ON feature_ideas;
CREATE POLICY "Users can insert feature ideas"
  ON feature_ideas FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update feature ideas" ON feature_ideas;
CREATE POLICY "Users can update feature ideas"
  ON feature_ideas FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Users can delete feature ideas" ON feature_ideas;
CREATE POLICY "Users can delete feature ideas"
  ON feature_ideas FOR DELETE
  USING (true);

-- Migration complete!
-- Now you can capture feature ideas from prod and query them via AI.
-- Perfect for the workflow: "look at feature ideas and let me know what we can work on"
