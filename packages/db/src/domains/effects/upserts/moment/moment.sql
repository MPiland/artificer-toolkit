/* ──────────────────────────────────────────────
 * UPSERT MOMENTS MAP
 * Expects json_data to be the object for a specific trigger:
 * {
 *   "ON_HIT": { ...MomentDirect | MomentRollTable... },
 *   "ON_MISS": { ... }
 * }
 *
 * - Upserts each moment container row
 * - Deletes stale moment container rows for that (effect_id, trigger_code)
 * - Upserts roll-table entries when applicable
 * - Deletes stale roll-table entries per moment container
 *
 * NOTE: duration handling assumes an existing duration upsert:
 *   public.upsert_duration(jsonb, uuid DEFAULT NULL) RETURNS uuid
 * (You said durations were already done.)
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_effect_moments (
  json_data jsonb,
  p_effect_id uuid,
  p_trigger_code text
) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  kv record;
  v_moment_code text;
BEGIN
  IF json_data IS NULL THEN
    -- If parent omits moments entirely, do nothing here.
    -- Parent (effect) upsert decides whether to delete.
    RETURN;
  END IF;

  -- Upsert each moment present
  FOR kv IN
    SELECT key, value
    FROM jsonb_each(json_data)
  LOOP
    v_moment_code := kv.key;

    PERFORM public.upsert_effect_moment(
      kv.value,
      p_effect_id,
      p_trigger_code,
      v_moment_code
    );
  END LOOP;

  -- Delete stale moment containers for this (effect, trigger)
  DELETE FROM public.effect_moments m
  WHERE m.effect_id = p_effect_id
    AND m.trigger_code = p_trigger_code
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_object_keys(json_data) AS k(key)
      WHERE k.key = m.moment_code
    );
END;
$$;



/* ──────────────────────────────────────────────
 * UPSERT SINGLE MOMENT CONTAINER
 * Upserts container row and its roll-table entries (if present)
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_effect_moment (
  json_data jsonb,
  p_effect_id uuid,
  p_trigger_code text,
  p_moment_code text
) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_existing_duration_id uuid;
  v_new_duration_id uuid;

  v_resolution_kind text := json_data ->> 'resolutionKind';
  v_group_kind text := json_data ->> 'groupKind';

  v_roll_table_kind text := json_data ->> 'rollTableKind';
  v_die text := json_data ->> 'die';
BEGIN
  IF json_data IS NULL THEN
    RETURN;
  END IF;

  -- Find existing duration_id (so duration upsert can be idempotent)
  SELECT duration_id
  INTO v_existing_duration_id
  FROM public.effect_moments
  WHERE effect_id = p_effect_id
    AND trigger_code = p_trigger_code
    AND moment_code = p_moment_code;

  -- Upsert duration if present, else clear it
  IF json_data ? 'duration' THEN
    v_new_duration_id := public.upsert_duration(
      json_data -> 'duration',
      v_existing_duration_id
    );
  ELSE
    v_new_duration_id := NULL;
  END IF;

  -- Upsert moment container
  INSERT INTO public.effect_moments (
    effect_id,
    trigger_code,
    moment_code,
    group_kind,
    resolution_kind,
    duration_id,
    roll_table_kind,
    die
  )
  VALUES (
    p_effect_id,
    p_trigger_code,
    p_moment_code,
    v_group_kind,
    v_resolution_kind,
    v_new_duration_id,
    CASE WHEN v_resolution_kind = 'ROLL_TABLE' THEN v_roll_table_kind ELSE NULL END,
    CASE WHEN v_resolution_kind = 'ROLL_TABLE' THEN v_die ELSE NULL END
  )
  ON CONFLICT (effect_id, trigger_code, moment_code)
  DO UPDATE SET
    group_kind = excluded.group_kind,
    resolution_kind = excluded.resolution_kind,
    duration_id = excluded.duration_id,
    roll_table_kind = excluded.roll_table_kind,
    die = excluded.die;

  -- Roll-table entries (only if ROLL_TABLE)
  IF v_resolution_kind = 'ROLL_TABLE' THEN
    PERFORM public.upsert_moment_roll_table_entries(
      json_data,
      p_effect_id,
      p_trigger_code,
      p_moment_code
    );
  ELSE
    -- DIRECT moment: ensure no leftover roll entries remain
    DELETE FROM public.moment_roll_table_entries e
    WHERE e.effect_id = p_effect_id
      AND e.trigger_code = p_trigger_code
      AND e.moment_code = p_moment_code;
  END IF;
END;
$$;



/* ──────────────────────────────────────────────
 * UPSERT ROLL TABLE ENTRIES
 * Reads:
 * - rollTableKind (EXACT|RANGE)
 * - table: entries[]
 *
 * Each entry:
 * {
 *   id, label,
 *   duration?,
 *   rollValue OR rollRange: [min,max],
 *   payload: ... (ignored here, stored later)
 * }
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_moment_roll_table_entries (
  json_data jsonb,
  p_effect_id uuid,
  p_trigger_code text,
  p_moment_code text
) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_roll_table_kind text := json_data ->> 'rollTableKind';
  v_entry jsonb;
  v_entry_id uuid;

  v_existing_duration_id uuid;
  v_new_duration_id uuid;

  v_sort_order integer := 0;
BEGIN
  -- Upsert each entry (in array order)
  FOR v_entry IN
    SELECT *
    FROM jsonb_array_elements(COALESCE(json_data -> 'table', '[]'::jsonb))
  LOOP
    v_sort_order := v_sort_order + 1;
    v_entry_id := (v_entry ->> 'id')::uuid;

    -- Existing duration_id for this entry (so duration can update in place)
    SELECT duration_id
    INTO v_existing_duration_id
    FROM public.moment_roll_table_entries
    WHERE id = v_entry_id;

    IF v_entry ? 'duration' THEN
      v_new_duration_id := public.upsert_duration(
        v_entry -> 'duration',
        v_existing_duration_id
      );
    ELSE
      v_new_duration_id := NULL;
    END IF;

    INSERT INTO public.moment_roll_table_entries (
      id,
      effect_id,
      trigger_code,
      moment_code,
      label,
      sort_order,
      duration_id,
      roll_value,
      roll_min,
      roll_max
    )
    VALUES (
      v_entry_id,
      p_effect_id,
      p_trigger_code,
      p_moment_code,
      v_entry ->> 'label',
      v_sort_order,
      v_new_duration_id,

      CASE WHEN v_roll_table_kind = 'EXACT'
        THEN NULLIF(v_entry ->> 'rollValue', '')::integer
        ELSE NULL
      END,

      CASE WHEN v_roll_table_kind = 'RANGE'
        THEN NULLIF(v_entry #>> '{rollRange,0}', '')::integer
        ELSE NULL
      END,

      CASE WHEN v_roll_table_kind = 'RANGE'
        THEN NULLIF(v_entry #>> '{rollRange,1}', '')::integer
        ELSE NULL
      END
    )
    ON CONFLICT (id)
    DO UPDATE SET
      effect_id = excluded.effect_id,
      trigger_code = excluded.trigger_code,
      moment_code = excluded.moment_code,
      label = excluded.label,
      sort_order = excluded.sort_order,
      duration_id = excluded.duration_id,
      roll_value = excluded.roll_value,
      roll_min = excluded.roll_min,
      roll_max = excluded.roll_max;
  END LOOP;

  -- Delete stale entries for this moment container
  DELETE FROM public.moment_roll_table_entries e
  WHERE e.effect_id = p_effect_id
    AND e.trigger_code = p_trigger_code
    AND e.moment_code = p_moment_code
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(json_data -> 'table', '[]'::jsonb)) v(x)
      WHERE (v.x ->> 'id')::uuid = e.id
    );
END;
$$;
