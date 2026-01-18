-- Add draft status support for OKRs to prevent partial creation issues
-- This allows OKRs to be created in draft state and committed when finalized

-- Add comment to status column to document valid values
COMMENT ON COLUMN okrs.status IS 'Status of the OKR: active, draft, completed, archived';
COMMENT ON COLUMN okr_key_results.status IS 'Status of the key result: active, draft, completed, archived';

-- Recreate the okrs_with_progress view to filter out draft OKRs
DROP VIEW IF EXISTS okrs_with_progress;

CREATE OR REPLACE VIEW okrs_with_progress AS
SELECT
  o.id,
  o.pillar,
  o.objective,
  o.start_date,
  o.end_date,
  o.quarter,
  o.status,
  o.archived,
  o.created_at,
  o.updated_at,
  COALESCE(
    AVG(
      CASE
        WHEN kr.type = 'boolean' THEN
          CASE WHEN COALESCE(kr.current_value, 0) > 0 THEN 100 ELSE 0 END
        WHEN kr.type = 'percent' THEN
          GREATEST(0, LEAST(100, COALESCE(kr.current_value::numeric, 0)))
        WHEN kr.direction = 'down' THEN
          CASE
            WHEN COALESCE(kr.baseline_value, 0) = 0 OR COALESCE(kr.baseline_value, 0) = COALESCE(kr.target_value, 0) THEN 0
            ELSE GREATEST(0, LEAST(100, 
              ((COALESCE(kr.baseline_value, 0) - COALESCE(kr.current_value::numeric, 0)) / 
               (COALESCE(kr.baseline_value, 0) - COALESCE(kr.target_value, 0))) * 100
            ))
          END
        ELSE
          CASE
            WHEN COALESCE(kr.target_value, 0) <= 0 THEN 0
            ELSE (COALESCE(kr.current_value::numeric, 0) / COALESCE(kr.target_value, 0)) * 100
          END
      END
    ),
    0
  ) AS progress,
  COALESCE(
    json_agg(
      json_build_object(
        'id', kr.id,
        'okr_id', kr.okr_id,
        'description', kr.description,
        'kind', kr.type,
        'target_value', kr.target_value,
        'current_value', kr.current_value,
        'baseline_value', kr.baseline_value,
        'direction', kr.direction,
        'progress', 
          CASE
            WHEN kr.type = 'boolean' THEN
              CASE WHEN COALESCE(kr.current_value, 0) > 0 THEN 100 ELSE 0 END
            WHEN kr.type = 'percent' THEN
              GREATEST(0, LEAST(100, COALESCE(kr.current_value::numeric, 0)))
            WHEN kr.direction = 'down' THEN
              CASE
                WHEN COALESCE(kr.baseline_value, 0) = 0 OR COALESCE(kr.baseline_value, 0) = COALESCE(kr.target_value, 0) THEN 0
                ELSE GREATEST(0, LEAST(100, 
                  ((COALESCE(kr.baseline_value, 0) - COALESCE(kr.current_value::numeric, 0)) / 
                   (COALESCE(kr.baseline_value, 0) - COALESCE(kr.target_value, 0))) * 100
                ))
              END
            ELSE
              CASE
                WHEN COALESCE(kr.target_value, 0) <= 0 THEN 0
                ELSE (COALESCE(kr.current_value::numeric, 0) / COALESCE(kr.target_value, 0)) * 100
              END
          END,
        'status', kr.status,
        'data_source', kr.data_source,
        'linked_habit_id', kr.linked_habit_id,
        'auto_sync', kr.auto_sync,
        'punted', kr.punted,
        'punted_at', kr.punted_at
      )
      ORDER BY kr.id
    ) FILTER (WHERE kr.id IS NOT NULL),
    '[]'::json
  ) AS key_results
FROM okrs o
LEFT JOIN okr_key_results kr ON o.id = kr.okr_id AND COALESCE(kr.status, 'active') != 'draft'
WHERE COALESCE(o.status, 'active') != 'draft'  -- Filter out draft OKRs from the view
GROUP BY o.id, o.pillar, o.objective, o.start_date, o.end_date, o.quarter, o.status, o.archived, o.created_at, o.updated_at;

-- Function to commit draft OKRs (change status from draft to active)
CREATE OR REPLACE FUNCTION commit_draft_okrs(p_quarter TEXT)
RETURNS TABLE(okr_id UUID, committed_at TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
  -- Update OKRs from draft to active
  UPDATE okrs
  SET status = 'active', updated_at = NOW()
  WHERE quarter = p_quarter AND status = 'draft';
  
  -- Update related key results from draft to active (with alias to avoid ambiguity)
  UPDATE okr_key_results kr
  SET status = 'active'
  WHERE kr.okr_id IN (
    SELECT o.id FROM okrs o WHERE o.quarter = p_quarter
  ) AND kr.status = 'draft';
  
  -- Return the committed OKRs
  RETURN QUERY
  SELECT o.id, o.updated_at
  FROM okrs o
  WHERE o.quarter = p_quarter AND o.status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Function to delete draft OKRs (cleanup on cancel)
CREATE OR REPLACE FUNCTION delete_draft_okrs(p_quarter TEXT)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete key results first (foreign key constraint)
  DELETE FROM okr_key_results
  WHERE okr_id IN (
    SELECT id FROM okrs WHERE quarter = p_quarter AND status = 'draft'
  );
  
  -- Delete draft OKRs
  DELETE FROM okrs
  WHERE quarter = p_quarter AND status = 'draft';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION commit_draft_okrs(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_draft_okrs(TEXT) TO authenticated;
