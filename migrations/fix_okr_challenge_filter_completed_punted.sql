-- Fix: Exclude completed and punted KRs from weekly challenges randomization
-- This migration updates the generate_okr_challenge function to filter out:
-- 1. Completed KRs (progress >= 1)
-- 2. Punted KRs (punted = true)

CREATE OR REPLACE FUNCTION public.generate_okr_challenge(p_enabled_kr_ids uuid[], p_exclude_kr_ids uuid[] DEFAULT '{}'::uuid[])
RETURNS TABLE(action_text text, story_type text, story_data jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_kr RECORD;
BEGIN
  -- Get a random incomplete, non-punted KR from enabled KRs
  SELECT 
    kr.id as kr_id,
    kr.description as kr_description,
    kr.current_value,
    kr.target_value,
    kr.progress as kr_progress,
    o.id as okr_id,
    o.objective as okr_objective,
    o.pillar as okr_pillar,
    o.quarter as okr_quarter
  INTO v_kr
  FROM okr_key_results kr
  JOIN okrs o ON kr.okr_id = o.id
  WHERE kr.id = ANY(p_enabled_kr_ids)
    AND kr.id != ALL(p_exclude_kr_ids)
    AND (o.archived = false OR o.archived IS NULL)
    AND o.status = 'active'
    AND (kr.progress IS NULL OR kr.progress < 1)
    AND (kr.punted = false OR kr.punted IS NULL)  -- NEW: Filter out punted KRs
  ORDER BY random()
  LIMIT 1;
  
  IF v_kr IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY SELECT
    'Make progress on ' || v_kr.kr_description || ' KR',
    'okrs_progress'::TEXT,
    jsonb_build_object(
      'kr_id', v_kr.kr_id,
      'kr_description', v_kr.kr_description,
      'kr_progress', COALESCE(v_kr.kr_progress, 0),
      'kr_current_value', v_kr.current_value,
      'kr_target_value', v_kr.target_value,
      'okr_id', v_kr.okr_id,
      'okr_objective', v_kr.okr_objective,
      'okr_pillar', v_kr.okr_pillar,
      'okr_quarter', v_kr.okr_quarter
    );
END;
$function$;

