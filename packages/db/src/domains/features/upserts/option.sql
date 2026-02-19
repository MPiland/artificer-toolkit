/* ──────────────────────────────────────────────
 * UPSERT: FEATURE OPTION
 *
 * Idempotence:
 *   - Root: UPSERT by id
 *   - Children: stale-only deletes (by authored ids) + UPSERT calls
 *   - Bridges: ON CONFLICT updates sort_order
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_feature_option (
  json_data jsonb
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
  v_charge_id uuid;
  v_child_id uuid;
  obj jsonb;
  ord integer;
BEGIN
  IF json_data IS NULL THEN
    RETURN NULL;
  END IF;

  /* charges (optional 1:1 owned) */
  IF json_data ? 'charges' AND (json_data -> 'charges') IS NOT NULL THEN
    v_charge_id := public.upsert_charge(json_data -> 'charges');
  ELSE
    v_charge_id := NULL;
  END IF;

  /* root */
  INSERT INTO public.feature_options (
    id,
    label,
    description,
    detail,
    sort_order,
    charge_id
  )
  VALUES (
    v_id,
    json_data ->> 'label',
    json_data ->> 'description',
    NULLIF(json_data ->> 'detail',''),
    (json_data ->> 'order')::int,
    v_charge_id
  )
  ON CONFLICT (id) DO UPDATE SET
    label        = excluded.label,
    description  = excluded.description,
    detail       = excluded.detail,
    sort_order   = excluded.sort_order,
    charge_id    = excluded.charge_id;

  /* ─────────────────────────────
   * traits (authoritative)
   * ───────────────────────────── */

  DELETE FROM public.feature_option_traits
  WHERE option_id = v_id
    AND trait_code NOT IN (
      SELECT jsonb_array_elements_text(COALESCE(json_data -> 'traits','[]'::jsonb))
    );

  INSERT INTO public.feature_option_traits (option_id, trait_code, sort_order)
  SELECT v_id, x, ord
  FROM jsonb_array_elements_text(COALESCE(json_data -> 'traits','[]'::jsonb))
  WITH ORDINALITY AS t(x, ord)
  ON CONFLICT (option_id, trait_code) DO UPDATE
  SET sort_order = excluded.sort_order;

  /* ─────────────────────────────
   * restrictions (owned, ordered)
   * ───────────────────────────── */

  DELETE FROM public.feature_option_restrictions
  WHERE option_id = v_id
    AND restriction_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data -> 'restrictions','[]'::jsonb)) x
      WHERE x ? 'id'
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'restrictions','[]'::jsonb))
    WITH ORDINALITY AS r(x, ord)
  LOOP
    v_child_id := public.upsert_restriction(obj);

    INSERT INTO public.feature_option_restrictions (option_id, restriction_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (option_id, restriction_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  /* ─────────────────────────────
   * effects (owned, ordered)
   * ───────────────────────────── */

  DELETE FROM public.feature_option_effects
  WHERE option_id = v_id
    AND effect_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data -> 'effects','[]'::jsonb)) x
      WHERE x ? 'id'
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'effects','[]'::jsonb))
    WITH ORDINALITY AS e(x, ord)
  LOOP
    v_child_id := public.upsert_effect(obj);

    INSERT INTO public.feature_option_effects (option_id, effect_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (option_id, effect_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  /* ─────────────────────────────
   * grants.feats (owned, ordered)
   * ───────────────────────────── */

  DELETE FROM public.feature_option_feat_grants
  WHERE option_id = v_id
    AND feat_grant_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data #> '{grants,feats}','[]'::jsonb)) x
      WHERE x ? 'id'
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data #> '{grants,feats}','[]'::jsonb))
    WITH ORDINALITY AS g(x, ord)
  LOOP
    v_child_id := public.upsert_feat_grant(obj);

    INSERT INTO public.feature_option_feat_grants (option_id, feat_grant_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (option_id, feat_grant_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  /* ─────────────────────────────
   * grants.modifiers (owned, ordered)
   * ───────────────────────────── */

  DELETE FROM public.feature_option_modifier_grants
  WHERE option_id = v_id
    AND modifier_grant_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data #> '{grants,modifiers}','[]'::jsonb)) x
      WHERE x ? 'id'
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data #> '{grants,modifiers}','[]'::jsonb))
    WITH ORDINALITY AS g(x, ord)
  LOOP
    v_child_id := public.upsert_modifier_grant(obj);

    INSERT INTO public.feature_option_modifier_grants (option_id, modifier_grant_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (option_id, modifier_grant_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  /* ─────────────────────────────
   * grants.proficiencies (owned, ordered)
   * ───────────────────────────── */

  DELETE FROM public.feature_option_proficiency_grants
  WHERE option_id = v_id
    AND proficiency_grant_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data #> '{grants,proficiencies}','[]'::jsonb)) x
      WHERE x ? 'id'
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data #> '{grants,proficiencies}','[]'::jsonb))
    WITH ORDINALITY AS g(x, ord)
  LOOP
    v_child_id := public.upsert_proficiency_grant(obj);

    INSERT INTO public.feature_option_proficiency_grants (option_id, proficiency_grant_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (option_id, proficiency_grant_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  /* ─────────────────────────────
   * grants.senses (owned, ordered)
   * ───────────────────────────── */

  DELETE FROM public.feature_option_sense_grants
  WHERE option_id = v_id
    AND sense_grant_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data #> '{grants,senses}','[]'::jsonb)) x
      WHERE x ? 'id'
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data #> '{grants,senses}','[]'::jsonb))
    WITH ORDINALITY AS g(x, ord)
  LOOP
    v_child_id := public.upsert_sense_grant(obj);

    INSERT INTO public.feature_option_sense_grants (option_id, sense_grant_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (option_id, sense_grant_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  /* ─────────────────────────────
   * grants.spells (owned, ordered)
   * ───────────────────────────── */

  DELETE FROM public.feature_option_spell_grants
  WHERE option_id = v_id
    AND spell_grant_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data #> '{grants,spells}','[]'::jsonb)) x
      WHERE x ? 'id'
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data #> '{grants,spells}','[]'::jsonb))
    WITH ORDINALITY AS g(x, ord)
  LOOP
    v_child_id := public.upsert_spell_grant(obj);

    INSERT INTO public.feature_option_spell_grants (option_id, spell_grant_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (option_id, spell_grant_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  RETURN v_id;
END;
$$;
