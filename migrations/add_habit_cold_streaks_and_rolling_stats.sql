-- Migration: Add Cold Streak Tracking & Rolling Stats
-- Purpose: Extend existing habit_streaks table with longest_cold_streak
--          Add rolling average calculation function
-- Created: 2025-12-19
-- Dependencies: Existing habit_streaks table and update_habit_streak() function

-- ============================================================================
-- 1. ADD longest_cold_streak COLUMN TO EXISTING habit_streaks TABLE
-- ============================================================================

-- Add column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'habit_streaks' 
    AND column_name = 'longest_cold_streak'
  ) THEN
    ALTER TABLE habit_streaks 
    ADD COLUMN longest_cold_streak INTEGER DEFAULT 0;
    
    RAISE NOTICE 'Added longest_cold_streak column to habit_streaks table';
  ELSE
    RAISE NOTICE 'longest_cold_streak column already exists';
  END IF;
END $$;

-- ============================================================================
-- 2. UPDATE EXISTING update_habit_streak() FUNCTION
--    Add cold streak calculation to existing logic
-- ============================================================================

CREATE OR REPLACE FUNCTION update_habit_streak()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    habit_uuid UUID;
    current_streak INTEGER := 0;
    longest_hot_streak INTEGER := 0;
    longest_cold_streak INTEGER := 0;
    last_completed_date DATE;
    current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
    completed_dates DATE[];
    temp_hot_streak INTEGER;
    temp_cold_streak INTEGER;
    prev_date DATE;
    check_date DATE;
    year_start DATE;
    year_end DATE;
    i INTEGER;
BEGIN
    -- Get the habit_id (works for INSERT, UPDATE, DELETE)
    IF TG_OP = 'DELETE' THEN
        habit_uuid := OLD.habit_id;
    ELSE
        habit_uuid := NEW.habit_id;
    END IF;
    
    year_start := (current_year || '-01-01')::DATE;
    year_end := LEAST(CURRENT_DATE, (current_year || '-12-31')::DATE);
    
    -- Get all completed dates for this habit from CURRENT YEAR ONLY
    SELECT array_agg(date ORDER BY date DESC)
    INTO completed_dates
    FROM habit_entries 
    WHERE habit_id = habit_uuid 
      AND is_done = true
      AND EXTRACT(YEAR FROM date) = current_year;
    
    -- Handle case where no completions exist
    IF completed_dates IS NULL OR array_length(completed_dates, 1) = 0 THEN
        current_streak := 0;
        longest_hot_streak := 0;
        last_completed_date := NULL;
        
        -- Calculate longest cold streak (entire year so far)
        longest_cold_streak := (year_end - year_start + 1);
    ELSE
        -- Set last completed date
        last_completed_date := completed_dates[1];
        
        -- Calculate current streak (from most recent backwards)
        IF last_completed_date >= CURRENT_DATE - INTERVAL '1 day' THEN
            current_streak := 1;
            check_date := last_completed_date;
            
            -- Count consecutive days backwards from most recent
            FOR i IN 2..array_length(completed_dates, 1) LOOP
                prev_date := completed_dates[i];
                IF check_date - prev_date = 1 THEN
                    current_streak := current_streak + 1;
                    check_date := prev_date;
                ELSE
                    EXIT; -- Streak broken
                END IF;
            END LOOP;
        END IF;
        
        -- Calculate longest HOT streak (consecutive completions)
        temp_hot_streak := 1;
        check_date := completed_dates[1];
        longest_hot_streak := 1;
        
        FOR i IN 2..array_length(completed_dates, 1) LOOP
            prev_date := completed_dates[i];
            IF check_date - prev_date = 1 THEN
                temp_hot_streak := temp_hot_streak + 1;
                check_date := prev_date;
            ELSE
                longest_hot_streak := GREATEST(longest_hot_streak, temp_hot_streak);
                temp_hot_streak := 1;
                check_date := prev_date;
            END IF;
        END LOOP;
        longest_hot_streak := GREATEST(longest_hot_streak, temp_hot_streak);
        
        -- Calculate longest COLD streak (consecutive non-completions)
        -- Build array of all dates in year with completion status
        temp_cold_streak := 0;
        longest_cold_streak := 0;
        
        FOR check_date IN SELECT generate_series(year_start, year_end, '1 day'::interval)::DATE LOOP
            IF check_date = ANY(completed_dates) THEN
                -- Completed day breaks cold streak
                longest_cold_streak := GREATEST(longest_cold_streak, temp_cold_streak);
                temp_cold_streak := 0;
            ELSE
                -- Missed day extends cold streak
                temp_cold_streak := temp_cold_streak + 1;
            END IF;
        END LOOP;
        
        -- Final check for cold streak at end of period
        longest_cold_streak := GREATEST(longest_cold_streak, temp_cold_streak);
    END IF;
    
    -- Update habit_streaks table with both hot and cold streaks
    INSERT INTO habit_streaks (
        habit_id, 
        current_streak, 
        longest_streak, 
        longest_cold_streak,
        last_completed_date
    )
    VALUES (
        habit_uuid, 
        current_streak, 
        longest_hot_streak,
        longest_cold_streak,
        last_completed_date
    )
    ON CONFLICT (habit_id) DO UPDATE SET
        current_streak = EXCLUDED.current_streak,
        longest_streak = EXCLUDED.longest_streak,
        longest_cold_streak = EXCLUDED.longest_cold_streak,
        last_completed_date = EXCLUDED.last_completed_date,
        updated_at = NOW();
    
    -- Return appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$function$;

RAISE NOTICE 'Updated update_habit_streak() function to include cold streak calculation';

-- ============================================================================
-- 3. CREATE ROLLING AVERAGE CALCULATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_rolling_habit_stats(
  p_habit_id UUID,
  p_window_days INTEGER DEFAULT 30
) RETURNS TABLE (
  monthly_average NUMERIC,
  weekly_average NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH recent_entries AS (
    SELECT 
      date,
      is_done
    FROM habit_entries
    WHERE habit_id = p_habit_id
      AND date >= CURRENT_DATE - p_window_days
      AND date <= CURRENT_DATE
  ),
  stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE is_done = true) as completions,
      p_window_days as window_size
    FROM recent_entries
  )
  SELECT 
    CASE 
      WHEN window_size > 0 
      THEN ROUND((completions::NUMERIC / window_size) * 30, 1)
      ELSE 0
    END as monthly_average,
    CASE 
      WHEN window_size > 0 
      THEN ROUND((completions::NUMERIC / window_size) * 7, 1)
      ELSE 0
    END as weekly_average
  FROM stats;
END;
$$ LANGUAGE plpgsql STABLE;

RAISE NOTICE 'Created calculate_rolling_habit_stats() function';

-- ============================================================================
-- 4. BACKFILL longest_cold_streak FOR EXISTING DATA
-- ============================================================================

DO $$
DECLARE
  habit_record RECORD;
  updated_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting backfill of longest_cold_streak...';
  
  -- Trigger the update for each habit by touching a recent entry
  FOR habit_record IN 
    SELECT DISTINCT habit_id 
    FROM habit_entries
  LOOP
    -- Update the most recent entry to trigger recalculation
    UPDATE habit_entries
    SET updated_at = NOW()
    WHERE habit_id = habit_record.habit_id
    ORDER BY date DESC
    LIMIT 1;
    
    updated_count := updated_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete! Triggered recalculation for % habits', updated_count;
END $$;

-- ============================================================================
-- 5. VERIFY THE SETUP
-- ============================================================================

DO $$
DECLARE
  streaks_count INTEGER;
  habits_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO streaks_count FROM habit_streaks WHERE longest_cold_streak > 0;
  SELECT COUNT(*) INTO habits_count FROM habits;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Extended habit_streaks table with longest_cold_streak';
  RAISE NOTICE '  - Updated trigger function to calculate cold streaks';
  RAISE NOTICE '  - Created rolling average function';
  RAISE NOTICE '  - Backfilled cold streak data';
  RAISE NOTICE '';
  RAISE NOTICE 'Results:';
  RAISE NOTICE '  - Total habits: %', habits_count;
  RAISE NOTICE '  - Habits with cold streak data: %', streaks_count;
  RAISE NOTICE '';
  RAISE NOTICE 'The stats module is now ready to use!';
  RAISE NOTICE '========================================';
END $$;

-- Quick verification query
SELECT 
  h.name as habit_name,
  hs.current_streak,
  hs.longest_streak as longest_hot_streak,
  hs.longest_cold_streak,
  hs.last_completed_date
FROM habit_streaks hs
JOIN habits h ON h.id = hs.habit_id
ORDER BY h.name;


