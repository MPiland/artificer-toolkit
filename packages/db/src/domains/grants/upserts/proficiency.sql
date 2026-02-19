/* ──────────────────────────────────────────────
 * UPSERT: PROFICIENCY GRANT
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_proficiency_grant (
  json_data jsonb
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
  v_type text := json_data ->> 'type';
  v_payload_mode text := COALESCE(json_data #>> '{payload,mode}', 'ALL');
BEGIN
  IF json_data IS NULL THEN
    RETURN NULL;
  END IF;

  /* ─────────────────────────────
   * ROOT
   * ───────────────────────────── */

  INSERT INTO public.proficiency_grants (
    id,
    sort_order,
    proficiency_type,
    selection_type,
    payload_mode,
    selection_count,
    scaling_level,
    rounding
  )
  VALUES (
    v_id,
    (json_data ->> 'order')::int,
    v_type,
    json_data ->> 'selectionType',
    v_payload_mode,
    NULLIF(json_data #>> '{payload,count}','')::int,
    json_data ->> 'level',
    json_data ->> 'rounding'
  )
  ON CONFLICT (id) DO UPDATE SET
    sort_order       = excluded.sort_order,
    proficiency_type = excluded.proficiency_type,
    selection_type   = excluded.selection_type,
    payload_mode     = excluded.payload_mode,
    selection_count  = excluded.selection_count,
    scaling_level    = excluded.scaling_level,
    rounding         = excluded.rounding;

  /* ─────────────────────────────
   * TRAITS (stale-only)
   * ───────────────────────────── */

  DELETE FROM public.proficiency_grant_traits
  WHERE proficiency_grant_id = v_id
    AND trait_code NOT IN (
      SELECT jsonb_array_elements_text(
        COALESCE(json_data -> 'traits','[]'::jsonb)
      )
    );

  INSERT INTO public.proficiency_grant_traits (proficiency_grant_id, trait_code, sort_order)
  SELECT v_id, x, ord
  FROM jsonb_array_elements_text(COALESCE(json_data -> 'traits','[]'::jsonb))
  WITH ORDINALITY AS t(x, ord)
  ON CONFLICT (proficiency_grant_id, trait_code) DO UPDATE
  SET sort_order = excluded.sort_order;

  /* ─────────────────────────────
   * RESTRICTIONS (owned, stale-only)
   * ───────────────────────────── */

  DELETE FROM public.proficiency_grant_restrictions
  WHERE proficiency_grant_id = v_id
    AND restriction_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(
        COALESCE(json_data -> 'restrictions','[]'::jsonb)
      ) x
      WHERE x ? 'id'
    );

  INSERT INTO public.proficiency_grant_restrictions (proficiency_grant_id, restriction_id, sort_order)
  SELECT
    v_id,
    public.upsert_restriction(obj),
    ord
  FROM jsonb_array_elements(COALESCE(json_data -> 'restrictions','[]'::jsonb))
  WITH ORDINALITY AS r(obj, ord)
  ON CONFLICT (proficiency_grant_id, restriction_id) DO UPDATE
  SET sort_order = excluded.sort_order;

  /* ─────────────────────────────
   * FILTERS (owned, optional, stale-only)
   * ───────────────────────────── */

  IF json_data ? 'filters' THEN
    DELETE FROM public.proficiency_grant_filters
    WHERE proficiency_grant_id = v_id
      AND filter_id NOT IN (
        SELECT (x ->> 'id')::uuid
        FROM jsonb_array_elements(COALESCE(json_data -> 'filters','[]'::jsonb)) x
        WHERE x ? 'id'
      );

    INSERT INTO public.proficiency_grant_filters (proficiency_grant_id, filter_id, sort_order)
    SELECT
      v_id,
      public.upsert_filter(obj),
      ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'filters','[]'::jsonb))
    WITH ORDINALITY AS f(obj, ord)
    ON CONFLICT (proficiency_grant_id, filter_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  ELSE
    DELETE FROM public.proficiency_grant_filters
    WHERE proficiency_grant_id = v_id;
  END IF;

  /* ─────────────────────────────
   * PAYLOAD SURFACES
   * Clear non-applicable surfaces (type switch)
   * + stale-only deletes for active surface
   * ───────────────────────────── */

  IF v_type <> 'SKILL' THEN
    DELETE FROM public.proficiency_grant_skills WHERE proficiency_grant_id = v_id;
  END IF;

  IF v_type <> 'SAVE_ABILITY' THEN
    DELETE FROM public.proficiency_grant_save_abilities WHERE proficiency_grant_id = v_id;
  END IF;

  IF v_type <> 'LANGUAGE' THEN
    DELETE FROM public.proficiency_grant_languages WHERE proficiency_grant_id = v_id;
  END IF;

  IF v_type <> 'EQUIPMENT' THEN
    DELETE FROM public.proficiency_grant_equipment WHERE proficiency_grant_id = v_id;
  END IF;

  IF v_type <> 'EQUIPMENT_PROPERTY' THEN
    DELETE FROM public.proficiency_grant_equipment_properties WHERE proficiency_grant_id = v_id;
  END IF;

  /* Active surface */
  CASE v_type
    WHEN 'SKILL' THEN
      DELETE FROM public.proficiency_grant_skills
      WHERE proficiency_grant_id = v_id
        AND skill_code NOT IN (
          SELECT jsonb_array_elements_text(
            COALESCE(json_data #> '{payload,skills}','[]'::jsonb)
          )
        );

      INSERT INTO public.proficiency_grant_skills (proficiency_grant_id, skill_code)
      SELECT v_id, x
      FROM jsonb_array_elements_text(
        COALESCE(json_data #> '{payload,skills}','[]'::jsonb)
      ) x
      ON CONFLICT DO NOTHING;

    WHEN 'SAVE_ABILITY' THEN
      DELETE FROM public.proficiency_grant_save_abilities
      WHERE proficiency_grant_id = v_id
        AND ability_code NOT IN (
          SELECT jsonb_array_elements_text(
            COALESCE(json_data #> '{payload,abilities}','[]'::jsonb)
          )
        );

      INSERT INTO public.proficiency_grant_save_abilities (proficiency_grant_id, ability_code)
      SELECT v_id, x
      FROM jsonb_array_elements_text(
        COALESCE(json_data #> '{payload,abilities}','[]'::jsonb)
      ) x
      ON CONFLICT DO NOTHING;

    WHEN 'LANGUAGE' THEN
      DELETE FROM public.proficiency_grant_languages
      WHERE proficiency_grant_id = v_id
        AND language_id NOT IN (
          SELECT (x)::uuid
          FROM jsonb_array_elements_text(
            COALESCE(json_data #> '{payload,languageIds}','[]'::jsonb)
          ) x
        );

      INSERT INTO public.proficiency_grant_languages (proficiency_grant_id, language_id)
      SELECT v_id, (x)::uuid
      FROM jsonb_array_elements_text(
        COALESCE(json_data #> '{payload,languageIds}','[]'::jsonb)
      ) x
      ON CONFLICT DO NOTHING;

    WHEN 'EQUIPMENT' THEN
      DELETE FROM public.proficiency_grant_equipment
      WHERE proficiency_grant_id = v_id
        AND equipment_id NOT IN (
          SELECT (x)::uuid
          FROM jsonb_array_elements_text(
            COALESCE(json_data #> '{payload,equipmentIds}','[]'::jsonb)
          ) x
        );

      INSERT INTO public.proficiency_grant_equipment (proficiency_grant_id, equipment_id)
      SELECT v_id, (x)::uuid
      FROM jsonb_array_elements_text(
        COALESCE(json_data #> '{payload,equipmentIds}','[]'::jsonb)
      ) x
      ON CONFLICT DO NOTHING;

    WHEN 'EQUIPMENT_PROPERTY' THEN
      DELETE FROM public.proficiency_grant_equipment_properties
      WHERE proficiency_grant_id = v_id
        AND property_code NOT IN (
          SELECT jsonb_array_elements_text(
            COALESCE(json_data #> '{payload,properties}','[]'::jsonb)
          )
        );

      INSERT INTO public.proficiency_grant_equipment_properties (proficiency_grant_id, property_code)
      SELECT v_id, x
      FROM jsonb_array_elements_text(
        COALESCE(json_data #> '{payload,properties}','[]'::jsonb)
      ) x
      ON CONFLICT DO NOTHING;
  END CASE;

  RETURN v_id;
END;
$$;

