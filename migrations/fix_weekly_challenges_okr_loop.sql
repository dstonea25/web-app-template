-- Fix the OKR generation loop bug in get_or_create_weekly_challenges
-- The EXIT WHEN condition was backwards, causing duplicate slot_index errors

CREATE OR REPLACE FUNCTION public.get_or_create_weekly_challenges()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_year integer;
  v_week_number integer;
  v_week_start date;
  v_set_id uuid;
  v_total_challenges integer := 3;
  v_randomization_strategy text := 'guaranteed_diversity';
  v_habits_slipping_enabled boolean;
  v_habits_slipping_max integer;
  v_habits_slipping_config jsonb;
  v_priorities_enabled boolean;
  v_priorities_max integer;
  v_priorities_config jsonb;
  v_okrs_enabled boolean;
  v_okrs_max integer;
  v_okrs_config jsonb;
  v_placeholder_max integer;
  v_slot_index integer := 0;
  v_challenges jsonb := '[]'::jsonb;
  v_challenge record;
  v_generated_habit_ids uuid[] := ARRAY[]::uuid[];
  v_generated_priority_ids uuid[] := ARRAY[]::uuid[];
  v_generated_kr_ids uuid[] := ARRAY[]::uuid[];
  v_habits_generated integer := 0;
  v_priorities_generated integer := 0;
  v_okrs_generated integer := 0;
  v_placeholders_generated integer := 0;
  v_available_protocols text[] := ARRAY[]::text[];
  v_current_protocol text;
  v_retry_count integer := 0;
  v_chicago_date date;
BEGIN
  -- Calculate current ISO week using Chicago timezone
  v_chicago_date := (NOW() AT TIME ZONE 'America/Chicago')::date;
  v_year := EXTRACT(isoyear FROM v_chicago_date)::integer;
  v_week_number := EXTRACT(week FROM v_chicago_date)::integer;
  v_week_start := DATE_TRUNC('week', v_chicago_date)::date;

  -- Get global config
  SELECT COALESCE((SELECT (value #>> '{}')::integer FROM challenge_config WHERE key = 'total_challenges'), 3)
  INTO v_total_challenges;
  
  SELECT COALESCE((SELECT value #>> '{}' FROM challenge_config WHERE key = 'randomization_strategy'), 'guaranteed_diversity')
  INTO v_randomization_strategy;

  -- Check if set already exists
  SELECT id INTO v_set_id
  FROM weekly_challenge_sets
  WHERE year = v_year AND week_number = v_week_number;

  -- If exists, return existing challenges
  IF v_set_id IS NOT NULL THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', wc.id,
        'slot_index', wc.slot_index,
        'action_text', wc.action_text,
        'story_type', wc.story_type,
        'story_data', wc.story_data,
        'title', wc.title,
        'description', wc.description,
        'completed', wc.completed,
        'completed_at', wc.completed_at,
        'protocol_key', wc.protocol_key
      ) ORDER BY wc.slot_index
    )
    INTO v_challenges
    FROM weekly_challenges wc
    WHERE wc.set_id = v_set_id;

    RETURN jsonb_build_object(
      'week', jsonb_build_object(
        'year', v_year,
        'week_number', v_week_number,
        'week_start_date', v_week_start,
        'generated_at', (SELECT generated_at FROM weekly_challenge_sets WHERE id = v_set_id)
      ),
      'challenges', COALESCE(v_challenges, '[]'::jsonb),
      'config', jsonb_build_object(
        'total_challenges', v_total_challenges,
        'randomization_strategy', v_randomization_strategy
      )
    );
  END IF;

  -- Create new challenge set
  INSERT INTO weekly_challenge_sets (year, week_number, week_start_date, generated_at)
  VALUES (v_year, v_week_number, v_week_start, NOW())
  RETURNING id INTO v_set_id;

  -- Get protocol configurations
  SELECT is_enabled, max_per_week, config
  INTO v_habits_slipping_enabled, v_habits_slipping_max, v_habits_slipping_config
  FROM challenge_protocols WHERE protocol_key = 'habits_slipping';
  
  SELECT is_enabled, max_per_week, config
  INTO v_priorities_enabled, v_priorities_max, v_priorities_config
  FROM challenge_protocols WHERE protocol_key = 'priorities_progress';
  
  SELECT is_enabled, max_per_week, config
  INTO v_okrs_enabled, v_okrs_max, v_okrs_config
  FROM challenge_protocols WHERE protocol_key = 'okrs_progress';
  
  SELECT max_per_week
  INTO v_placeholder_max
  FROM challenge_protocols WHERE protocol_key = 'placeholder';

  -- Apply defaults
  v_habits_slipping_enabled := COALESCE(v_habits_slipping_enabled, true);
  v_habits_slipping_max := COALESCE(v_habits_slipping_max, 2);
  v_priorities_enabled := COALESCE(v_priorities_enabled, true);
  v_priorities_max := COALESCE(v_priorities_max, 1);
  v_okrs_enabled := COALESCE(v_okrs_enabled, true);
  v_okrs_max := COALESCE(v_okrs_max, 1);
  v_placeholder_max := COALESCE(v_placeholder_max, 3);

  -- Determine generation approach based on randomization strategy
  IF v_randomization_strategy = 'slot_by_slot' THEN
    -- Slot-by-Slot Random: Each slot independently picks from eligible protocols
    WHILE v_slot_index < v_total_challenges AND v_retry_count < 20 LOOP
      -- Build list of available protocols for this slot
      v_available_protocols := ARRAY[]::text[];
      
      IF v_habits_slipping_enabled AND v_habits_generated < v_habits_slipping_max THEN
        v_available_protocols := array_append(v_available_protocols, 'habits_slipping');
      END IF;
      
      IF v_priorities_enabled AND v_priorities_generated < v_priorities_max THEN
        v_available_protocols := array_append(v_available_protocols, 'priorities_progress');
      END IF;
      
      IF v_okrs_enabled AND v_okrs_generated < v_okrs_max THEN
        v_available_protocols := array_append(v_available_protocols, 'okrs_progress');
      END IF;
      
      -- Add placeholder as fallback
      IF v_placeholders_generated < v_placeholder_max THEN
        v_available_protocols := array_append(v_available_protocols, 'placeholder');
      END IF;
      
      -- Randomly select a protocol
      IF array_length(v_available_protocols, 1) > 0 THEN
        v_current_protocol := v_available_protocols[1 + floor(random() * array_length(v_available_protocols, 1))::integer];
      ELSE
        v_current_protocol := 'placeholder';
      END IF;
      
      v_challenge := NULL;
      
      -- Generate challenge based on selected protocol
      IF v_current_protocol = 'habits_slipping' THEN
        SELECT * INTO v_challenge FROM generate_habit_challenge(
          v_set_id, v_slot_index, v_habits_slipping_config, v_generated_habit_ids
        );
        IF v_challenge IS NOT NULL AND v_challenge.id IS NOT NULL THEN
          v_generated_habit_ids := array_append(v_generated_habit_ids, (v_challenge.story_data->>'habit_id')::uuid);
          v_habits_generated := v_habits_generated + 1;
          v_slot_index := v_slot_index + 1;
          v_retry_count := 0;
          CONTINUE;
        END IF;
      ELSIF v_current_protocol = 'priorities_progress' THEN
        SELECT * INTO v_challenge FROM generate_priority_challenge(
          v_set_id, v_slot_index, v_priorities_config, v_generated_priority_ids
        );
        IF v_challenge IS NOT NULL AND v_challenge.id IS NOT NULL THEN
          v_generated_priority_ids := array_append(v_generated_priority_ids, (v_challenge.story_data->>'priority_id')::uuid);
          v_priorities_generated := v_priorities_generated + 1;
          v_slot_index := v_slot_index + 1;
          v_retry_count := 0;
          CONTINUE;
        END IF;
      ELSIF v_current_protocol = 'okrs_progress' THEN
        SELECT * INTO v_challenge FROM generate_okr_challenge(
          v_set_id, v_slot_index, v_okrs_config, v_generated_kr_ids
        );
        IF v_challenge IS NOT NULL AND v_challenge.id IS NOT NULL THEN
          v_generated_kr_ids := array_append(v_generated_kr_ids, (v_challenge.story_data->>'kr_id')::uuid);
          v_okrs_generated := v_okrs_generated + 1;
          v_slot_index := v_slot_index + 1;
          v_retry_count := 0;
          CONTINUE;
        END IF;
      END IF;
      
      -- If selected protocol failed or was placeholder, generate placeholder
      SELECT * INTO v_challenge FROM generate_placeholder_challenge(v_set_id, v_slot_index);
      IF v_challenge IS NOT NULL AND v_challenge.id IS NOT NULL THEN
        v_placeholders_generated := v_placeholders_generated + 1;
        v_slot_index := v_slot_index + 1;
        v_retry_count := 0;
      ELSE
        v_retry_count := v_retry_count + 1;
      END IF;
    END LOOP;
    
  ELSE
    -- Guaranteed Diversity (default): Fill in priority order (Habits → Priorities → OKRs → Placeholder)
    
    -- Generate habit challenges (up to max)
    IF v_habits_slipping_enabled THEN
      WHILE v_habits_generated < v_habits_slipping_max AND v_slot_index < v_total_challenges LOOP
        SELECT * INTO v_challenge FROM generate_habit_challenge(
          v_set_id, v_slot_index, v_habits_slipping_config, v_generated_habit_ids
        );
        EXIT WHEN v_challenge IS NULL OR v_challenge.id IS NULL;
        v_generated_habit_ids := array_append(v_generated_habit_ids, (v_challenge.story_data->>'habit_id')::uuid);
        v_habits_generated := v_habits_generated + 1;
        v_slot_index := v_slot_index + 1;
      END LOOP;
    END IF;

    -- Generate priority challenges (up to max)
    IF v_priorities_enabled THEN
      WHILE v_priorities_generated < v_priorities_max AND v_slot_index < v_total_challenges LOOP
        SELECT * INTO v_challenge FROM generate_priority_challenge(
          v_set_id, v_slot_index, v_priorities_config, v_generated_priority_ids
        );
        EXIT WHEN v_challenge IS NULL OR v_challenge.id IS NULL;
        v_generated_priority_ids := array_append(v_generated_priority_ids, (v_challenge.story_data->>'priority_id')::uuid);
        v_priorities_generated := v_priorities_generated + 1;
        v_slot_index := v_slot_index + 1;
      END LOOP;
    END IF;

    -- Generate OKR challenges (up to max)
    -- FIXED: Changed EXIT condition from "IS NOT NULL" to "IS NULL"
    IF v_okrs_enabled THEN
      WHILE v_okrs_generated < v_okrs_max AND v_slot_index < v_total_challenges LOOP
        SELECT * INTO v_challenge FROM generate_okr_challenge(
          v_set_id, v_slot_index, v_okrs_config, v_generated_kr_ids
        );
        EXIT WHEN v_challenge IS NULL OR v_challenge.id IS NULL;  -- FIXED: was "IS NOT NULL"
        v_generated_kr_ids := array_append(v_generated_kr_ids, (v_challenge.story_data->>'kr_id')::uuid);
        v_okrs_generated := v_okrs_generated + 1;
        v_slot_index := v_slot_index + 1;
      END LOOP;
    END IF;

    -- Fill remaining slots with placeholders
    WHILE v_slot_index < v_total_challenges LOOP
      SELECT * INTO v_challenge FROM generate_placeholder_challenge(v_set_id, v_slot_index);
      EXIT WHEN v_challenge IS NULL OR v_challenge.id IS NULL;
      v_placeholders_generated := v_placeholders_generated + 1;
      v_slot_index := v_slot_index + 1;
    END LOOP;
  END IF;

  -- Return the generated challenges
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', wc.id,
      'slot_index', wc.slot_index,
      'action_text', wc.action_text,
      'story_type', wc.story_type,
      'story_data', wc.story_data,
      'title', wc.title,
      'description', wc.description,
      'completed', wc.completed,
      'completed_at', wc.completed_at,
      'protocol_key', wc.protocol_key
    ) ORDER BY wc.slot_index
  )
  INTO v_challenges
  FROM weekly_challenges wc
  WHERE wc.set_id = v_set_id;

  RETURN jsonb_build_object(
    'week', jsonb_build_object(
      'year', v_year,
      'week_number', v_week_number,
      'week_start_date', v_week_start,
      'generated_at', NOW()
    ),
    'challenges', COALESCE(v_challenges, '[]'::jsonb),
    'config', jsonb_build_object(
      'total_challenges', v_total_challenges,
      'randomization_strategy', v_randomization_strategy
    )
  );
END;
$function$;
