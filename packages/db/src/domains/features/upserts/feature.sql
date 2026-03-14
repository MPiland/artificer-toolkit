CREATE OR REPLACE FUNCTION public.upsert_feature(
  json_data jsonb,
  p_system_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id', '')::uuid, gen_random_uuid());
  v_charge_id uuid;
  v_restriction_id uuid;
  v_child_id uuid;
  obj jsonb;
  lvl jsonb;
  ord integer;
BEGIN
  IF json_data IS NULL THEN
    RETURN NULL;
  END IF;

  IF json_data ? 'charges' AND (json_data -> 'charges') IS NOT NULL THEN
    v_charge_id := public.upsert_charge(json_data -> 'charges');
  ELSE
    v_charge_id := NULL;
  END IF;

  IF json_data ? 'restrictions' AND (json_data -> 'restrictions') IS NOT NULL THEN
    v_restriction_id := public.upsert_restriction(json_data -> 'restrictions');
  ELSE
    v_restriction_id := NULL;
  END IF;

  INSERT INTO public.features (
    id,
    label,
    description,
    detail,
    charge_id,
    restriction_id,
    sort_order,
    level_available
  )
  VALUES (
    v_id,
    json_data ->> 'label',
    json_data ->> 'description',
    NULLIF(json_data ->> 'detail', ''),
    v_charge_id,
    v_restriction_id,
    (json_data ->> 'order')::int,
    NULLIF(json_data ->> 'levelAvailable', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    label = excluded.label,
    description = excluded.description,
    detail = excluded.detail,
    charge_id = excluded.charge_id,
    restriction_id = excluded.restriction_id,
    sort_order = excluded.sort_order,
    level_available = excluded.level_available;

  DELETE FROM public.feature_traits
  WHERE feature_id = v_id
    AND trait_code NOT IN (
      SELECT jsonb_array_elements_text(COALESCE(json_data -> 'traits', '[]'::jsonb))
    );

  INSERT INTO public.feature_traits (feature_id, trait_code, sort_order)
  SELECT v_id, x, ord
  FROM jsonb_array_elements_text(COALESCE(json_data -> 'traits', '[]'::jsonb))
  WITH ORDINALITY AS t(x, ord)
  ON CONFLICT (feature_id, trait_code) DO UPDATE
  SET sort_order = excluded.sort_order;

  DELETE FROM public.feature_attributes
  WHERE feature_id = v_id
    AND attribute_code NOT IN (
      SELECT jsonb_array_elements_text(COALESCE(json_data -> 'attributes', '[]'::jsonb))
    );

  INSERT INTO public.feature_attributes (feature_id, attribute_code, sort_order)
  SELECT v_id, x, ord
  FROM jsonb_array_elements_text(COALESCE(json_data -> 'attributes', '[]'::jsonb))
  WITH ORDINALITY AS t(x, ord)
  ON CONFLICT (feature_id, attribute_code) DO UPDATE
  SET sort_order = excluded.sort_order;

  DELETE FROM public.feature_effects
  WHERE feature_id = v_id
    AND effect_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data -> 'effects', '[]'::jsonb)) x
      WHERE x ? 'id'
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'effects', '[]'::jsonb))
    WITH ORDINALITY AS e(x, ord)
  LOOP
    v_child_id := public.upsert_effect(obj);
    INSERT INTO public.feature_effects (feature_id, effect_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (feature_id, effect_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  DELETE FROM public.feature_feat_grants
  WHERE feature_id = v_id
    AND feat_grant_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data #> '{grants,feats}', '[]'::jsonb)) x
      WHERE x ? 'id'
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data #> '{grants,feats}', '[]'::jsonb))
    WITH ORDINALITY AS g(x, ord)
  LOOP
    INSERT INTO public.feature_feat_grants (feature_id, feat_grant_id, sort_order)
    VALUES (v_id, public.upsert_feat_grant(obj), ord)
    ON CONFLICT (feature_id, feat_grant_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  DELETE FROM public.feature_modifier_grants
  WHERE feature_id = v_id
    AND modifier_grant_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data #> '{grants,modifiers}', '[]'::jsonb)) x
      WHERE x ? 'id'
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data #> '{grants,modifiers}', '[]'::jsonb))
    WITH ORDINALITY AS g(x, ord)
  LOOP
    INSERT INTO public.feature_modifier_grants (feature_id, modifier_grant_id, sort_order)
    VALUES (v_id, public.upsert_modifier_grant(obj), ord)
    ON CONFLICT (feature_id, modifier_grant_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  DELETE FROM public.feature_proficiency_grants
  WHERE feature_id = v_id
    AND proficiency_grant_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data #> '{grants,proficiencies}', '[]'::jsonb)) x
      WHERE x ? 'id'
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data #> '{grants,proficiencies}', '[]'::jsonb))
    WITH ORDINALITY AS g(x, ord)
  LOOP
    INSERT INTO public.feature_proficiency_grants (feature_id, proficiency_grant_id, sort_order)
    VALUES (v_id, public.upsert_proficiency_grant(obj), ord)
    ON CONFLICT (feature_id, proficiency_grant_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  DELETE FROM public.feature_sense_grants
  WHERE feature_id = v_id
    AND sense_grant_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data #> '{grants,senses}', '[]'::jsonb)) x
      WHERE x ? 'id'
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data #> '{grants,senses}', '[]'::jsonb))
    WITH ORDINALITY AS g(x, ord)
  LOOP
    INSERT INTO public.feature_sense_grants (feature_id, sense_grant_id, sort_order)
    VALUES (v_id, public.upsert_sense_grant(obj), ord)
    ON CONFLICT (feature_id, sense_grant_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  DELETE FROM public.feature_spell_grants
  WHERE feature_id = v_id
    AND spell_grant_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data #> '{grants,spells}', '[]'::jsonb)) x
      WHERE x ? 'id'
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data #> '{grants,spells}', '[]'::jsonb))
    WITH ORDINALITY AS g(x, ord)
  LOOP
    INSERT INTO public.feature_spell_grants (feature_id, spell_grant_id, sort_order)
    VALUES (v_id, public.upsert_spell_grant(obj), ord)
    ON CONFLICT (feature_id, spell_grant_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  DELETE FROM public.feature_options
  WHERE feature_id = v_id
    AND option_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data -> 'options', '[]'::jsonb)) x
      WHERE x ? 'id'
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'options', '[]'::jsonb))
    WITH ORDINALITY AS o(x, ord)
  LOOP
    v_child_id := public.upsert_feature_option(obj);
    INSERT INTO public.feature_options (feature_id, option_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (feature_id, option_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  DELETE FROM public.feature_option_level_links
  WHERE option_level_id IN (
    SELECT id FROM public.feature_option_levels WHERE feature_id = v_id
  );
  DELETE FROM public.feature_option_levels
  WHERE feature_id = v_id;

  FOR lvl, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'optionsPerLevel', '[]'::jsonb))
    WITH ORDINALITY AS l(x, ord)
  LOOP
    INSERT INTO public.feature_option_levels (
      feature_id,
      level,
      count,
      replace_count,
      sort_order
    )
    VALUES (
      v_id,
      (lvl ->> 'level')::int,
      (lvl ->> 'count')::int,
      NULLIF(lvl ->> 'replaceCount', '')::int,
      ord
    )
    RETURNING id INTO v_child_id;

    INSERT INTO public.feature_option_level_links (option_level_id, option_id)
    SELECT
      v_child_id,
      (x)::uuid
    FROM jsonb_array_elements_text(COALESCE(lvl -> 'optionIds', '[]'::jsonb)) x;
  END LOOP;

  RETURN v_id;
END;
$$;
