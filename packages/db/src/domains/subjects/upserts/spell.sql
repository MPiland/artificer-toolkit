/* ──────────────────────────────────────────────
 * UPSERT: SPELL
 *
 * Idempotence:
 *   - Root: UPSERT by id
 *   - Traits: authoritative stale-only delete
 *   - Classes: authoritative stale-only delete
 *   - Effects: owned, ordered, delegated upsert
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_spell (
  json_data jsonb,
  p_system_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
  v_effect_id uuid;
  obj jsonb;
  ord integer;
BEGIN
  IF json_data IS NULL THEN
    RETURN NULL;
  END IF;

  /* root */
  INSERT INTO public.spells (
    id,
    system_id,
    user_id,
    label,
    description,
    level,
    magic_school_id,
    concentration_type,
    casting_time_unit,
    casting_time_amount,
    material_description
  )
  VALUES (
    v_id,
    p_system_id,
    (json_data ->> 'userId')::uuid,
    json_data ->> 'label',
    json_data ->> 'description',
    (json_data ->> 'level')::int,
    (json_data ->> 'magicSchoolId')::uuid,
    json_data ->> 'concentrationType',
    json_data #>> '{castingTime,unit_code}',
    (json_data #>> '{castingTime,amount}')::int,
    json_data ->> 'materialDescription'
  )
  ON CONFLICT (id) DO UPDATE SET
    system_id            = excluded.system_id,
    user_id              = excluded.user_id,
    label                = excluded.label,
    description          = excluded.description,
    level                = excluded.level,
    magic_school_id      = excluded.magic_school_id,
    concentration_type   = excluded.concentration_type,
    casting_time_unit    = excluded.casting_time_unit,
    casting_time_amount  = excluded.casting_time_amount,
    material_description = excluded.material_description;

  /* ─────────────────────────────
   * TRAITS (authoritative)
   * ───────────────────────────── */

  DELETE FROM public.spell_traits
  WHERE spell_id = v_id
    AND trait_code NOT IN (
      SELECT jsonb_array_elements_text(
        COALESCE(json_data -> 'traits','[]'::jsonb)
      )
    );

  INSERT INTO public.spell_traits (spell_id, trait_code, sort_order)
  SELECT v_id, x, ord
  FROM jsonb_array_elements_text(
    COALESCE(json_data -> 'traits','[]'::jsonb)
  ) WITH ORDINALITY AS t(x, ord)
  ON CONFLICT (spell_id, trait_code) DO UPDATE
  SET sort_order = excluded.sort_order;

  /* ─────────────────────────────
   * CLASSES (authoritative references)
   * ───────────────────────────── */

  DELETE FROM public.spell_classes
  WHERE spell_id = v_id
    AND class_id NOT IN (
      SELECT (x)::uuid
      FROM jsonb_array_elements_text(
        COALESCE(json_data -> 'classIds','[]'::jsonb)
      ) x
    );

  INSERT INTO public.spell_classes (spell_id, class_id)
  SELECT v_id, (x)::uuid
  FROM jsonb_array_elements_text(
    COALESCE(json_data -> 'classIds','[]'::jsonb)
  ) x
  ON CONFLICT DO NOTHING;

  /* ─────────────────────────────
   * EFFECTS (owned, ordered)
   * ───────────────────────────── */

  DELETE FROM public.spell_effects
  WHERE spell_id = v_id
    AND effect_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(
        COALESCE(json_data -> 'effects','[]'::jsonb)
      ) x
      WHERE x ? 'id'
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(
      COALESCE(json_data -> 'effects','[]'::jsonb)
    )
    WITH ORDINALITY AS e(x, ord)
  LOOP
    v_effect_id := public.upsert_effect(obj, p_system_id);

    INSERT INTO public.spell_effects (spell_id, effect_id, sort_order)
    VALUES (v_id, v_effect_id, ord)
    ON CONFLICT (spell_id, effect_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  RETURN v_id;
END;
$$;

