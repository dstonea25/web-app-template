-- Add hidden column to growth_dimensions table
-- Run this in your Supabase SQL Editor

ALTER TABLE growth_dimensions 
ADD COLUMN hidden BOOLEAN DEFAULT false;

-- Optional: Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_growth_dimensions_hidden 
ON growth_dimensions(hidden);


