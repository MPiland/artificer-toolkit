/* ──────────────────────────────────────────────
 * UPSERT — RACE
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_race (
  json_data jsonb,
  p_system_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
  v_ancestry_id uuid;
  v_child_id uuid;
  obj jsonb;
  ord integer;
BEGIN
  IF json_data IS NULL THEN
    RETURN NULL;
  END IF;

  /* ROOT */
  INSERT INTO public.races (
    id,
    system_id,
    user_id,
    label,
    quote,
    description,
    category,
    playable,
    parent_race_id,
    size_code
  )
  VALUES (
    v_id,
    p_system_id,
    (json_data ->> 'userId')::uuid,
    json_data ->> 'label',
    json_data ->> 'quote',
    json_data ->> 'description',
    json_data ->> 'category',
    (json_data ->> 'playable')::boolean,
    NULLIF(json_data ->> 'parentRaceId','')::uuid,
    json_data ->> 'size'
  )
  ON CONFLICT (id) DO UPDATE SET
    label = excluded.label,
    quote = excluded.quote,
    description = excluded.description,
    category = excluded.category,
    playable = excluded.playable,
    parent_race_id = excluded.parent_race_id,
    size_code = excluded.size_code;

  /* DETAILS */
  DELETE FROM public.race_details WHERE race_id = v_id;

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'details','[]'::jsonb))
    WITH ORDINALITY AS d(x, ord)
  LOOP
    v_child_id := public.upsert_detail(obj, p_system_id);

    INSERT INTO public.race_details (race_id, detail_id, sort_order)
    VALUES (v_id, v_child_id, ord);
  END LOOP;

  /* TRAITS */
  DELETE FROM public.race_traits WHERE race_id = v_id;

  INSERT INTO public.race_traits (race_id, trait_code, sort_order)
  SELECT v_id, x, ord
  FROM jsonb_array_elements_text(COALESCE(json_data -> 'traits','[]'::jsonb))
  WITH ORDINALITY AS t(x, ord);

  /* FEATURES */
  DELETE FROM public.race_features WHERE race_id = v_id;

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'features','[]'::jsonb))
    WITH ORDINALITY AS f(x, ord)
  LOOP
    v_child_id := public.upsert_feature(obj, p_system_id);

    INSERT INTO public.race_features (race_id, feature_id, sort_order)
    VALUES (v_id, v_child_id, ord);
  END LOOP;

  /* SPEEDS */
  DELETE FROM public.race_speeds WHERE race_id = v_id;

  INSERT INTO public.race_speeds (race_id, speed_id, amount, unit_id)
  SELECT
    v_id,
    (x ->> 'speedId')::uuid,
    (x ->> 'amount')::int,
    (x ->> 'unitId')::uuid
  FROM jsonb_array_elements(COALESCE(json_data -> 'speeds','[]'::jsonb)) x;

  /* ANCESTRY (BASE ONLY) */
  DELETE FROM public.race_ancestries WHERE race_id = v_id;

  IF json_data ? 'ancestry' AND (json_data -> 'ancestry') IS NOT NULL THEN
    v_ancestry_id := gen_random_uuid();

    INSERT INTO public.race_ancestries (
      id,
      race_id,
      label,
      description
    )
    VALUES (
      v_ancestry_id,
      v_id,
      json_data #>> '{ancestry,label}',
      json_data #>> '{ancestry,description}'
    );

    FOR obj, ord IN
      SELECT x, ord
      FROM jsonb_array_elements(json_data #> '{ancestry,options}')
      WITH ORDINALITY AS o(x, ord)
    LOOP
      INSERT INTO public.race_ancestry_options (
        id,
        ancestry_id,
        label,
        description,
        sort_order
      )
      VALUES (
        (obj ->> 'id')::uuid,
        v_ancestry_id,
        obj ->> 'label',
        obj ->> 'description',
        ord
      );

      DELETE FROM public.race_ancestry_option_features
      WHERE ancestry_option_id = (obj ->> 'id')::uuid;

      FOR v_child_id, ord IN
        SELECT
          public.upsert_feature(fx, p_system_id),
          ord
        FROM jsonb_array_elements(COALESCE(obj -> 'features','[]'::jsonb))
        WITH ORDINALITY AS ff(fx, ord)
      LOOP
        INSERT INTO public.race_ancestry_option_features (
          ancestry_option_id,
          feature_id,
          sort_order
        )
        VALUES ((obj ->> 'id')::uuid, v_child_id, ord);
      END LOOP;
    END LOOP;
  END IF;

  RETURN v_id;
END;
$$;
