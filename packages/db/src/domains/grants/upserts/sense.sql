/* ──────────────────────────────────────────────
 * UPSERT: SENSE GRANT
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_sense_grant (
  json_data jsonb
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id', '')::uuid, gen_random_uuid());
  v_charge_id uuid;
BEGIN
  IF json_data IS NULL THEN
    RETURN NULL;
  END IF;

  /* ─────────────────────────────
   * ROOT
   * ───────────────────────────── */

  INSERT INTO public.sense_grants (
    id,
    sort_order,
    selection_type,
    scaling_type,
    payload_mode,
    selection_count,
    scaling_source,
    class_id,
    spell_id
  )
  VALUES (
    v_id,
    (json_data ->> 'order')::int,
    json_data ->> 'selectionType',
    json_data ->> 'scalingType',
    COALESCE(json_data #>> '{payload,mode}', 'ALL'),
    NULLIF(json_data #>> '{payload,count}', '')::int,
    json_data #>> '{scaling,scalingSource}',
    NULLIF(json_data #>> '{scaling,classId}', '')::uuid,
    NULLIF(json_data #>> '{scaling,spellId}', '')::uuid
  )
  ON CONFLICT (id) DO UPDATE SET
    sort_order      = excluded.sort_order,
    selection_type  = excluded.selection_type,
    scaling_type    = excluded.scaling_type,
    payload_mode    = excluded.payload_mode,
    selection_count = excluded.selection_count,
    scaling_source  = excluded.scaling_source,
    class_id        = excluded.class_id,
    spell_id        = excluded.spell_id;

  /* ─────────────────────────────
   * TRAITS (stale-only)
   * ───────────────────────────── */

  DELETE FROM public.sense_grant_traits
  WHERE sense_grant_id = v_id
    AND trait_code NOT IN (
      SELECT jsonb_array_elements_text(
        COALESCE(json_data -> 'traits','[]'::jsonb)
      )
    );

  INSERT INTO public.sense_grant_traits (sense_grant_id, trait_code, sort_order)
  SELECT v_id, x, ord
  FROM jsonb_array_elements_text(
    COALESCE(json_data -> 'traits','[]'::jsonb)
  ) WITH ORDINALITY AS t(x, ord)
  ON CONFLICT (sense_grant_id, trait_code) DO UPDATE
  SET sort_order = excluded.sort_order;

  /* ─────────────────────────────
   * RESTRICTIONS (owned, stale-only)
   * ───────────────────────────── */

  DELETE FROM public.sense_grant_restrictions
  WHERE sense_grant_id = v_id
    AND restriction_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(
        COALESCE(json_data -> 'restrictions','[]'::jsonb)
      ) x
      WHERE x ? 'id'
    );

  INSERT INTO public.sense_grant_restrictions (
    sense_grant_id,
    restriction_id,
    sort_order
  )
  SELECT
    v_id,
    public.upsert_restriction(obj),
    ord
  FROM jsonb_array_elements(
    COALESCE(json_data -> 'restrictions','[]'::jsonb)
  ) WITH ORDINALITY AS r(obj, ord)
  ON CONFLICT (sense_grant_id, restriction_id) DO UPDATE
  SET sort_order = excluded.sort_order;

  /* ─────────────────────────────
   * CHARGES (owned 1:1)
   * ───────────────────────────── */

  IF json_data ? 'charges' THEN
    v_charge_id := public.upsert_charge(json_data -> 'charges');

    INSERT INTO public.sense_grant_charges (sense_grant_id, charge_id)
    VALUES (v_id, v_charge_id)
    ON CONFLICT (sense_grant_id) DO UPDATE
      SET charge_id = excluded.charge_id;
  ELSE
    DELETE FROM public.sense_grant_charges
    WHERE sense_grant_id = v_id;
  END IF;

  /* ─────────────────────────────
   * ROOT PAYLOAD (NONE / SELECTED)
   * ───────────────────────────── */

  DELETE FROM public.sense_grant_senses
  WHERE sense_grant_id = v_id
    AND sense_id NOT IN (
      SELECT (x)::uuid
      FROM jsonb_array_elements_text(
        COALESCE(json_data #> '{payload,senseIds}','[]'::jsonb)
      ) x
    );

  IF json_data ->> 'scalingType' = 'NONE'
     AND COALESCE(json_data #>> '{payload,mode}','ALL') = 'SELECTED' THEN

    INSERT INTO public.sense_grant_senses (sense_grant_id, sense_id)
    SELECT v_id, (x)::uuid
    FROM jsonb_array_elements_text(
      COALESCE(json_data #> '{payload,senseIds}','[]'::jsonb)
    ) x
    ON CONFLICT DO NOTHING;
  END IF;

  /* ─────────────────────────────
   * SCALING LEVELS (PER_LEVEL)
   * ───────────────────────────── */

  DELETE FROM public.sense_grant_scaling_levels
  WHERE sense_grant_id = v_id
    AND level NOT IN (
      SELECT (obj ->> 'level')::int
      FROM jsonb_array_elements(
        COALESCE(json_data #> '{scaling,levels}','[]'::jsonb)
      ) obj
    );

  IF json_data ->> 'scalingType' = 'PER_LEVEL' THEN
    INSERT INTO public.sense_grant_scaling_levels (
      sense_grant_id,
      level,
      sort_order,
      payload_mode,
      selection_count
    )
    SELECT
      v_id,
      (obj ->> 'level')::int,
      (obj ->> 'order')::int,
      COALESCE(obj #>> '{value,mode}','ALL'),
      NULLIF(obj #>> '{value,count}','')::int
    FROM jsonb_array_elements(json_data #> '{scaling,levels}') obj
    ON CONFLICT (sense_grant_id, level) DO UPDATE SET
      sort_order      = excluded.sort_order,
      payload_mode    = excluded.payload_mode,
      selection_count = excluded.selection_count;
  END IF;

  /* ─────────────────────────────
   * SCALING LEVEL SENSES
   * ───────────────────────────── */

  DELETE FROM public.sense_grant_scaling_level_senses s
  USING public.sense_grant_scaling_levels l
  WHERE s.scaling_level_id = l.id
    AND l.sense_grant_id = v_id
    AND s.sense_id NOT IN (
      SELECT (x)::uuid
      FROM jsonb_array_elements_text(
        COALESCE(json_data #> '{scaling,levels}', '[]'::jsonb)
      ) lvl,
      jsonb_array_elements_text(
        COALESCE(lvl #> '{value,senseIds}','[]'::jsonb)
      ) x
    );

  INSERT INTO public.sense_grant_scaling_level_senses (scaling_level_id, sense_id)
  SELECT
    sl.id,
    (sid)::uuid
  FROM public.sense_grant_scaling_levels sl
  JOIN jsonb_array_elements(json_data #> '{scaling,levels}') lvl
    ON (lvl ->> 'level')::int = sl.level
  JOIN jsonb_array_elements_text(
    COALESCE(lvl #> '{value,senseIds}','[]'::jsonb)
  ) sid ON true
  WHERE sl.sense_grant_id = v_id
    AND sl.payload_mode = 'SELECTED'
  ON CONFLICT DO NOTHING;

  RETURN v_id;
END;
$$;

