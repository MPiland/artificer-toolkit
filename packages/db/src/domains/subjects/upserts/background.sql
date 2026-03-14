/* ──────────────────────────────────────────────
 * UPSERT: BACKGROUND
 *
 * Idempotence:
 *   - Root: UPSERT by id
 *   - Children: stale-only deletes
 *   - Grants / Features / Details: delegate to existing upserts
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_background (
  json_data jsonb,
  p_system_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
  v_starting_equipment_id uuid;
  v_child_id uuid;
  obj jsonb;
  ord integer;
BEGIN
  IF json_data IS NULL THEN
    RETURN NULL;
  END IF;

  /* starting equipment (owned, optional) */
  IF json_data ? 'startingEquipment' THEN
    v_starting_equipment_id :=
      public.upsert_starting_equipment(json_data -> 'startingEquipment');
  ELSE
    v_starting_equipment_id := NULL;
  END IF;

  /* root */
  INSERT INTO public.backgrounds (
    id,
    system_id,
    user_id,
    label,
    description,
    starting_equipment_id
  )
  VALUES (
    v_id,
    p_system_id,
    (json_data ->> 'userId')::uuid,
    json_data ->> 'label',
    json_data ->> 'description',
    v_starting_equipment_id
  )
  ON CONFLICT (id) DO UPDATE SET
    system_id             = excluded.system_id,
    user_id               = excluded.user_id,
    label                 = excluded.label,
    description           = excluded.description,
    starting_equipment_id = excluded.starting_equipment_id;

  /* ─────────────────────────────
   * DETAILS
   * ───────────────────────────── */

  DELETE FROM public.background_details
  WHERE background_id = v_id
    AND detail_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data -> 'details','[]'::jsonb)) x
      WHERE x ? 'id'
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'details','[]'::jsonb))
    WITH ORDINALITY AS d(x, ord)
  LOOP
    v_child_id := public.upsert_detail(obj, p_system_id);

    INSERT INTO public.background_details (background_id, detail_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (background_id, detail_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  /* ─────────────────────────────
   * PROFICIENCIES
   * ───────────────────────────── */

  DELETE FROM public.background_proficiency_grants
  WHERE background_id = v_id
    AND proficiency_grant_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data -> 'proficiencies','[]'::jsonb)) x
      WHERE x ? 'id'
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'proficiencies','[]'::jsonb))
    WITH ORDINALITY AS p(x, ord)
  LOOP
    v_child_id := public.upsert_proficiency_grant(obj, p_system_id);

    INSERT INTO public.background_proficiency_grants (
      background_id,
      proficiency_grant_id,
      sort_order
    )
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (background_id, proficiency_grant_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  /* ─────────────────────────────
   * FEATURES
   * ───────────────────────────── */

  DELETE FROM public.background_features
  WHERE background_id = v_id
    AND feature_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data -> 'features','[]'::jsonb)) x
      WHERE x ? 'id'
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'features','[]'::jsonb))
    WITH ORDINALITY AS f(x, ord)
  LOOP
    v_child_id := public.upsert_feature(obj, p_system_id);

    INSERT INTO public.background_features (background_id, feature_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (background_id, feature_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  RETURN v_id;
END;
$$;
