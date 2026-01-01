-- Migration: Add display_order to habits table
-- Purpose: Allow user-defined ordering of habits that persists across devices
-- Created: 2025-01-01

-- Add display_order column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'habits' 
    AND column_name = 'display_order'
  ) THEN
    ALTER TABLE habits 
    ADD COLUMN display_order INTEGER;
    
    RAISE NOTICE 'Added display_order column to habits table';
  ELSE
    RAISE NOTICE 'display_order column already exists';
  END IF;
END $$;

-- Initialize display_order based on current created_at order
-- Only update rows where display_order is NULL
UPDATE habits
SET display_order = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as row_num
  FROM habits
) AS subquery
WHERE habits.id = subquery.id
AND habits.display_order IS NULL;

-- Create index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_habits_display_order ON habits(display_order);

RAISE NOTICE 'Initialized display_order values and created index';

