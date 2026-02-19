/* ──────────────────────────────────────────────
 * UPSERT — MODIFIER GRANT (ROOT)
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_modifier_grant (
  json_data jsonb
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
  v_type text := json_data ->> 'type';
BEGIN
  IF json_data IS NULL THEN
    RETURN NULL;
  END IF;

  /* ─────────────────────────────
   * ROOT
   * ───────────────────────────── */

  INSERT INTO public.modifier_grants (
    id,
    modifier_type,
    scope,
    subject,
    selection_type,
    selection_count,
    sort_order
  )
  VALUES (
    v_id,
    v_type,
    json_data ->> 'scope',
    json_data ->> 'subject',
    json_data ->> 'selectionType',
    NULLIF(json_data #>> '{value,count}','')::int,
    (json_data ->> 'order')::int
  )
  ON CONFLICT (id) DO UPDATE SET
    modifier_type    = excluded.modifier_type,
    scope            = excluded.scope,
    subject          = excluded.subject,
    selection_type   = excluded.selection_type,
    selection_count  = excluded.selection_count,
    sort_order       = excluded.sort_order;

  /* ─────────────────────────────
   * TRAITS (stale-only)
   * ───────────────────────────── */

  DELETE FROM public.modifier_grant_traits
  WHERE modifier_grant_id = v_id
    AND trait_code NOT IN (
      SELECT jsonb_array_elements_text(
        COALESCE(json_data -> 'traits','[]'::jsonb)
      )
    );

  INSERT INTO public.modifier_grant_traits (modifier_grant_id, trait_code, sort_order)
  SELECT v_id, x, ord
  FROM jsonb_array_elements_text(
    COALESCE(json_data -> 'traits','[]'::jsonb)
  ) WITH ORDINALITY AS t(x, ord)
  ON CONFLICT (modifier_grant_id, trait_code) DO UPDATE
  SET sort_order = excluded.sort_order;

  /* ─────────────────────────────
   * RESTRICTIONS (owned, stale-only)
   * ───────────────────────────── */

  DELETE FROM public.modifier_grant_restrictions
  WHERE modifier_grant_id = v_id
    AND restriction_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(
        COALESCE(json_data -> 'restrictions','[]'::jsonb)
      ) x
      WHERE x ? 'id'
    );

  INSERT INTO public.modifier_grant_restrictions (
    modifier_grant_id,
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
  ON CONFLICT (modifier_grant_id, restriction_id) DO UPDATE
  SET sort_order = excluded.sort_order;

  /* ─────────────────────────────
   * FILTERS (owned, optional, stale-only)
   * ───────────────────────────── */

  IF json_data ? 'filters' THEN
    DELETE FROM public.modifier_grant_filters
    WHERE modifier_grant_id = v_id
      AND filter_id NOT IN (
        SELECT (x ->> 'id')::uuid
        FROM jsonb_array_elements(COALESCE(json_data -> 'filters','[]'::jsonb)) x
        WHERE x ? 'id'
      );

    INSERT INTO public.modifier_grant_filters (
      modifier_grant_id,
      filter_id,
      sort_order
    )
    SELECT
      v_id,
      public.upsert_filter(obj),
      ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'filters','[]'::jsonb))
    WITH ORDINALITY AS f(obj, ord)
    ON CONFLICT (modifier_grant_id, filter_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  ELSE
    DELETE FROM public.modifier_grant_filters
    WHERE modifier_grant_id = v_id;
  END IF;

  /* ─────────────────────────────
   * PAYLOAD (1:1 owned)
   *
   * NOTE: this row is not independently addressable (no child ids),
   * so replace is the correct idempotent strategy.
   * ───────────────────────────── */

  INSERT INTO public.modifier_grant_payloads (
    modifier_grant_id,
    numeric_expr_code,
    numeric_amount,
    numeric_multiplier,
    numeric_ability,
    numeric_skill_id,
    numeric_class_id,
    numeric_spell_id,
    set_amount,
    charge_limit_kind,
    charge_uses,
    charge_multiplier,
    charge_class_id,
    charge_spell_id,
    bonus_die,
    replace_damage_id,
    replace_option_id,
    add_remove_value_id
  )
  VALUES (
    v_id,
    json_data #>> '{value,code}',
    NULLIF(json_data #>> '{value,amount}','')::numeric,
    NULLIF(json_data #>> '{value,multiplier}','')::numeric,
    json_data #>> '{value,ability}',
    NULLIF(json_data #>> '{value,skillId}','')::uuid,
    NULLIF(json_data #>> '{value,classId}','')::uuid,
    NULLIF(json_data #>> '{value,spellId}','')::uuid,
    NULLIF(json_data #>> '{value,amount}','')::numeric,
    json_data #>> '{value,limitKind}',
    NULLIF(json_data #>> '{value,uses}','')::int,
    NULLIF(json_data #>> '{value,multiplier}','')::numeric,
    NULLIF(json_data #>> '{value,classId}','')::uuid,
    NULLIF(json_data #>> '{value,spellId}','')::uuid,
    json_data #>> '{value,dice}',
    NULLIF(json_data #>> '{value,damageId}','')::uuid,
    json_data #>> '{value,optionId}',
    json_data #>> '{value,valueId}'
  )
  ON CONFLICT (modifier_grant_id) DO UPDATE SET
    numeric_expr_code     = excluded.numeric_expr_code,
    numeric_amount        = excluded.numeric_amount,
    numeric_multiplier    = excluded.numeric_multiplier,
    numeric_ability       = excluded.numeric_ability,
    numeric_skill_id      = excluded.numeric_skill_id,
    numeric_class_id      = excluded.numeric_class_id,
    numeric_spell_id      = excluded.numeric_spell_id,
    set_amount            = excluded.set_amount,
    charge_limit_kind     = excluded.charge_limit_kind,
    charge_uses           = excluded.charge_uses,
    charge_multiplier     = excluded.charge_multiplier,
    charge_class_id       = excluded.charge_class_id,
    charge_spell_id       = excluded.charge_spell_id,
    bonus_die             = excluded.bonus_die,
    replace_damage_id     = excluded.replace_damage_id,
    replace_option_id     = excluded.replace_option_id,
    add_remove_value_id   = excluded.add_remove_value_id,
    updated_at            = now();

  /* ─────────────────────────────
   * OPTIONAL ABILITY MODIFIER
   * (only valid for OPTIONAL_ABILITY_MODIFIER)
   * ───────────────────────────── */

  IF v_type = 'OPTIONAL_ABILITY_MODIFIER' THEN
    DELETE FROM public.modifier_grant_optional_abilities
    WHERE modifier_grant_id = v_id
      AND ability_code NOT IN (
        SELECT jsonb_array_elements_text(
          COALESCE(json_data #> '{value,abilities}','[]'::jsonb)
        )
      );

    INSERT INTO public.modifier_grant_optional_abilities (
      modifier_grant_id,
      ability_code
    )
    SELECT v_id, x
    FROM jsonb_array_elements_text(
      COALESCE(json_data #> '{value,abilities}','[]'::jsonb)
    ) x
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.modifier_grant_optional_abilities
    WHERE modifier_grant_id = v_id;
  END IF;

  RETURN v_id;
END;
$$;
