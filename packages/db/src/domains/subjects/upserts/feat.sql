CREATE OR REPLACE FUNCTION public.upsert_feat(
  json_data jsonb,
  p_system_id uuid
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

  INSERT INTO public.feats (
    id,
    system_id,
    user_id,
    label,
    description,
    detail,
    charge_id,
    restriction_id
  )
  VALUES (
    v_id,
    p_system_id,
    (json_data ->> 'userId')::uuid,
    json_data ->> 'label',
    json_data ->> 'description',
    NULLIF(json_data ->> 'detail', ''),
    v_charge_id,
    v_restriction_id
  )
  ON CONFLICT (id) DO UPDATE SET
    system_id = excluded.system_id,
    user_id = excluded.user_id,
    label = excluded.label,
    description = excluded.description,
    detail = excluded.detail,
    charge_id = excluded.charge_id,
    restriction_id = excluded.restriction_id;

  DELETE FROM public.feat_traits
  WHERE feat_id = v_id;

  DELETE FROM public.feat_effects
  WHERE feat_id = v_id
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
    INSERT INTO public.feat_effects (feat_id, effect_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (feat_id, effect_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  DELETE FROM public.feat_modifier_grants
  WHERE feat_id = v_id
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
    v_child_id := public.upsert_modifier_grant(obj);
    INSERT INTO public.feat_modifier_grants (feat_id, modifier_grant_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (feat_id, modifier_grant_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  DELETE FROM public.feat_proficiency_grants
  WHERE feat_id = v_id
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
    v_child_id := public.upsert_proficiency_grant(obj);
    INSERT INTO public.feat_proficiency_grants (feat_id, proficiency_grant_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (feat_id, proficiency_grant_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  DELETE FROM public.feat_sense_grants
  WHERE feat_id = v_id
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
    v_child_id := public.upsert_sense_grant(obj);
    INSERT INTO public.feat_sense_grants (feat_id, sense_grant_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (feat_id, sense_grant_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  DELETE FROM public.feat_spell_grants
  WHERE feat_id = v_id
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
    v_child_id := public.upsert_spell_grant(obj);
    INSERT INTO public.feat_spell_grants (feat_id, spell_grant_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (feat_id, spell_grant_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  DELETE FROM public.feat_features
  WHERE feat_id = v_id
    AND feature_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data -> 'features', '[]'::jsonb)) x
      WHERE x ? 'id'
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'features', '[]'::jsonb))
    WITH ORDINALITY AS f(x, ord)
  LOOP
    v_child_id := public.upsert_feature(obj, p_system_id);
    INSERT INTO public.feat_features (feat_id, feature_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (feat_id, feature_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  RETURN v_id;
END;
$$;
