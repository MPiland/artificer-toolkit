/* ──────────────────────────────────────────────
 * UPSERT: FEATURE
 *
 * Idempotence:
 *   - Root: UPSERT by id
 *   - Traits: stale-only delete + upsert
 *   - Restrictions / Effects / Grants: loop + upsert
 *   - Options: bridge only
 *   - OptionsByLevel: owned rows, rebuilt safely
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_feature (
  json_data jsonb
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
  v_child_id uuid;
  obj jsonb;
  lvl jsonb;
  ord integer;
BEGIN
  IF json_data IS NULL THEN
    RETURN NULL;
  END IF;

  /* root */
  INSERT INTO public.features (
    id, label, description, detail,
    sort_order, level_available
  )
  VALUES (
    v_id,
    json_data ->> 'label',
    json_data ->> 'description',
    json_data ->> 'detail',
    (json_data ->> 'order')::int,
    json_data ->> 'levelAvailable'
  )
  ON CONFLICT (id) DO UPDATE SET
    label = excluded.label,
    description = excluded.description,
    detail = excluded.detail,
    sort_order = excluded.sort_order,
    level_available = excluded.level_available;

  /* traits */
  DELETE FROM public.feature_traits
  WHERE feature_id = v_id
    AND trait_code NOT IN (
      SELECT jsonb_array_elements_text(COALESCE(json_data -> 'traits','[]'))
    );

  INSERT INTO public.feature_traits
  SELECT v_id, x, ord
  FROM jsonb_array_elements_text(COALESCE(json_data -> 'traits','[]'))
  WITH ORDINALITY AS t(x, ord)
  ON CONFLICT (feature_id, trait_code) DO UPDATE
  SET sort_order = excluded.sort_order;

  /* restrictions */
  DELETE FROM public.feature_restrictions
  WHERE feature_id = v_id;

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'restrictions','[]'))
    WITH ORDINALITY
  LOOP
    v_child_id := public.upsert_restriction(obj);
    INSERT INTO public.feature_restrictions
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT DO UPDATE SET sort_order = excluded.sort_order;
  END LOOP;

  /* effects */
  DELETE FROM public.feature_effects WHERE feature_id = v_id;

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'effects','[]'))
    WITH ORDINALITY
  LOOP
    v_child_id := public.upsert_effect(obj);
    INSERT INTO public.feature_effects
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT DO UPDATE SET sort_order = excluded.sort_order;
  END LOOP;

  /* grants — identical looping pattern to feature_options */
  FOR obj, ord IN SELECT x, ord FROM jsonb_array_elements(COALESCE(json_data #> '{grants,feats}','[]')) WITH ORDINALITY LOOP
    INSERT INTO public.feature_feat_grants
    VALUES (v_id, public.upsert_feat_grant(obj), ord)
    ON CONFLICT DO UPDATE SET sort_order = excluded.sort_order;
  END LOOP;

  FOR obj, ord IN SELECT x, ord FROM jsonb_array_elements(COALESCE(json_data #> '{grants,modifiers}','[]')) WITH ORDINALITY LOOP
    INSERT INTO public.feature_modifier_grants
    VALUES (v_id, public.upsert_modifier_grant(obj), ord)
    ON CONFLICT DO UPDATE SET sort_order = excluded.sort_order;
  END LOOP;

  FOR obj, ord IN SELECT x, ord FROM jsonb_array_elements(COALESCE(json_data #> '{grants,proficiencies}','[]')) WITH ORDINALITY LOOP
    INSERT INTO public.feature_proficiency_grants
    VALUES (v_id, public.upsert_proficiency_grant(obj), ord)
    ON CONFLICT DO UPDATE SET sort_order = excluded.sort_order;
  END LOOP;

  FOR obj, ord IN SELECT x, ord FROM jsonb_array_elements(COALESCE(json_data #> '{grants,senses}','[]')) WITH ORDINALITY LOOP
    INSERT INTO public.feature_sense_grants
    VALUES (v_id, public.upsert_sense_grant(obj), ord)
    ON CONFLICT DO UPDATE SET sort_order = excluded.sort_order;
  END LOOP;

  FOR obj, ord IN SELECT x, ord FROM jsonb_array_elements(COALESCE(json_data #> '{grants,spells}','[]')) WITH ORDINALITY LOOP
    INSERT INTO public.feature_spell_grants
    VALUES (v_id, public.upsert_spell_grant(obj), ord)
    ON CONFLICT DO UPDATE SET sort_order = excluded.sort_order;
  END LOOP;

  /* options bridge */
  DELETE FROM public.feature_option_links WHERE feature_id = v_id;

  FOR obj, ord IN
    SELECT x, ord FROM jsonb_array_elements(COALESCE(json_data -> 'options','[]')) WITH ORDINALITY
  LOOP
    v_child_id := public.upsert_feature_option(obj);
    INSERT INTO public.feature_option_links
    VALUES (v_id, v_child_id, ord);
  END LOOP;

  /* optionsByLevel */
  DELETE FROM public.feature_option_level_links
  WHERE option_level_id IN (
    SELECT id FROM public.feature_option_levels WHERE feature_id = v_id
  );
  DELETE FROM public.feature_option_levels WHERE feature_id = v_id;

  FOR lvl, ord IN
    SELECT x, ord FROM jsonb_array_elements(COALESCE(json_data -> 'optionsPerLevel','[]')) WITH ORDINALITY
  LOOP
    INSERT INTO public.feature_option_levels (
      feature_id, level, count, replace_count, sort_order
    )
    VALUES (
      v_id,
      (lvl ->> 'level')::int,
      (lvl ->> 'count')::int,
      NULLIF(lvl ->> 'replaceCount','')::int,
      ord
    )
    RETURNING id INTO v_child_id;

    INSERT INTO public.feature_option_level_links
    SELECT
      v_child_id,
      (x)::uuid
    FROM jsonb_array_elements_text(lvl -> 'optionIds') x;
  END LOOP;

  RETURN v_id;
END;
$$;
