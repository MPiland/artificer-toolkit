/* ──────────────────────────────────────────────
 * UPSERT: SPELL GRANT
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_spell_grant (
  json_data jsonb
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
  v_charge_id uuid;
BEGIN
  IF json_data IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.spell_grants (
    id,
    sort_order,
    selection_type,
    scaling_type,
    payload_mode,
    selection_count,
    scaling_source,
    class_id,
    spell_id,
    cast_at_level
  )
  VALUES (
    v_id,
    (json_data ->> 'order')::int,
    json_data ->> 'selectionType',
    json_data ->> 'scalingType',
    COALESCE(json_data #>> '{payload,mode}', 'ALL'),
    NULLIF(json_data #>> '{payload,count}','')::int,
    json_data #>> '{scaling,scalingSource}',
    NULLIF(json_data #>> '{scaling,classId}','')::uuid,
    NULLIF(json_data #>> '{scaling,spellId}','')::uuid,
    NULLIF(json_data ->> 'castAtLevel','')::int
  )
  ON CONFLICT (id) DO UPDATE SET
    sort_order      = excluded.sort_order,
    selection_type  = excluded.selection_type,
    scaling_type    = excluded.scaling_type,
    payload_mode    = excluded.payload_mode,
    selection_count = excluded.selection_count,
    scaling_source  = excluded.scaling_source,
    class_id        = excluded.class_id,
    spell_id        = excluded.spell_id,
    cast_at_level   = excluded.cast_at_level;

  DELETE FROM public.spell_grant_traits WHERE spell_grant_id = v_id;
  DELETE FROM public.spell_grant_restrictions WHERE spell_grant_id = v_id;
  DELETE FROM public.spell_grant_filters WHERE spell_grant_id = v_id;
  DELETE FROM public.spell_grant_spells WHERE spell_grant_id = v_id;
  DELETE FROM public.spell_grant_scaling_level_spells
   WHERE scaling_level_id IN (
     SELECT id FROM public.spell_grant_scaling_levels WHERE spell_grant_id = v_id
   );
  DELETE FROM public.spell_grant_scaling_levels WHERE spell_grant_id = v_id;

  INSERT INTO public.spell_grant_traits (spell_grant_id, trait_code, sort_order)
  SELECT v_id, x, ord
  FROM jsonb_array_elements_text(COALESCE(json_data -> 'traits','[]'::jsonb))
  WITH ORDINALITY AS t(x, ord);

  INSERT INTO public.spell_grant_restrictions (spell_grant_id, restriction_id, sort_order)
  SELECT
    v_id,
    public.upsert_restriction(obj),
    ord
  FROM jsonb_array_elements(COALESCE(json_data -> 'restrictions','[]'::jsonb))
  WITH ORDINALITY AS r(obj, ord);

  INSERT INTO public.spell_grant_filters (spell_grant_id, filter_id, sort_order)
  SELECT
    v_id,
    public.upsert_filter(obj),
    ord
  FROM jsonb_array_elements(COALESCE(json_data -> 'filters','[]'::jsonb))
  WITH ORDINALITY AS f(obj, ord);

  IF json_data ? 'charges' THEN
    v_charge_id := public.upsert_charge(json_data -> 'charges');
    INSERT INTO public.spell_grant_charges (spell_grant_id, charge_id)
    VALUES (v_id, v_charge_id)
    ON CONFLICT (spell_grant_id) DO UPDATE SET
      charge_id = excluded.charge_id;
  ELSE
    DELETE FROM public.spell_grant_charges WHERE spell_grant_id = v_id;
  END IF;

  IF json_data ->> 'scalingType' = 'NONE' THEN
    IF COALESCE(json_data #>> '{payload,mode}','ALL') = 'SELECTED' THEN
      INSERT INTO public.spell_grant_spells (spell_grant_id, spell_id)
      SELECT v_id, (x)::uuid
      FROM jsonb_array_elements_text(
        COALESCE(json_data #> '{payload,spellIds}','[]'::jsonb)
      ) x;
    END IF;
  ELSE
    INSERT INTO public.spell_grant_scaling_levels (
      id,
      spell_grant_id,
      level,
      sort_order,
      payload_mode,
      selection_count
    )
    SELECT
      gen_random_uuid(),
      v_id,
      (obj ->> 'level')::int,
      (obj ->> 'order')::int,
      COALESCE(obj #>> '{value,mode}','ALL'),
      NULLIF(obj #>> '{value,count}','')::int
    FROM jsonb_array_elements(json_data #> '{scaling,levels}') obj;

    INSERT INTO public.spell_grant_scaling_level_spells (scaling_level_id, spell_id)
    SELECT
      sl.id,
      (sid)::uuid
    FROM public.spell_grant_scaling_levels sl
    JOIN jsonb_array_elements(json_data #> '{scaling,levels}') lvl
      ON (lvl ->> 'level')::int = sl.level
    JOIN jsonb_array_elements_text(
      COALESCE(lvl #> '{value,spellIds}','[]'::jsonb)
    ) sid ON true
    WHERE sl.spell_grant_id = v_id
      AND sl.payload_mode = 'SELECTED';
  END IF;

  RETURN v_id;
END;
$$;
