-- =========================================================
-- UPSERT HELPERS (CHILD)
-- =========================================================

/* ──────────────────────────────────────────────
 * UPSERT: DAMAGE SCALING LEVEL
 * Input JSON shape (per level):
 *   { id?, level, order, value: { amount } }  OR  { id?, level, order, value: { dice } }
 * (matches your LevelScaledValue<TPayload>)
 * ────────────────────────────────────────────── */
CREATE OR REPLACE FUNCTION public.upsert_damage_scaling_level (
  json_data jsonb,
  p_damage_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE((json_data ->> 'id')::uuid, gen_random_uuid());
BEGIN
  INSERT INTO public.damage_scaling_levels (
    id,
    damage_id,
    level,
    sort_order,
    amount,
    dice
  )
  VALUES (
    v_id,
    p_damage_id,
    (json_data ->> 'level')::int,
    COALESCE((json_data ->> 'order')::int, 0),
    NULLIF(json_data #>> '{value,amount}', '')::numeric,
    NULLIF(json_data #>> '{value,dice}', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    level      = excluded.level,
    sort_order = excluded.sort_order,
    amount     = excluded.amount,
    dice       = excluded.dice;

  RETURN v_id;
END;
$$;


/* ──────────────────────────────────────────────
 * UPSERT: DAMAGE BONUS
 * Input JSON shape:
 *   {
 *     id?, order, bonusKind,
 *     ability?, skillId?,
 *     multiplier?, min?, max?
 *   }
 * ────────────────────────────────────────────── */
CREATE OR REPLACE FUNCTION public.upsert_damage_bonus (
  json_data jsonb,
  p_damage_value_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE((json_data ->> 'id')::uuid, gen_random_uuid());
BEGIN
  INSERT INTO public.damage_bonuses (
    id,
    damage_value_id,
    bonus_kind,
    ability_code,
    skill_id,
    multiplier,
    min,
    max,
    sort_order
  )
  VALUES (
    v_id,
    p_damage_value_id,
    json_data ->> 'bonusKind',
    NULLIF(json_data ->> 'ability', ''),
    NULLIF(json_data ->> 'skillId', '')::uuid,
    NULLIF(json_data ->> 'multiplier', '')::numeric,
    NULLIF(json_data ->> 'min', '')::numeric,
    NULLIF(json_data ->> 'max', '')::numeric,
    COALESCE((json_data ->> 'order')::int, 0)
  )
  ON CONFLICT (id) DO UPDATE
  SET
    bonus_kind   = excluded.bonus_kind,
    ability_code = excluded.ability_code,
    skill_id     = excluded.skill_id,
    multiplier   = excluded.multiplier,
    min    = excluded.min,
    max    = excluded.max,
    sort_order   = excluded.sort_order;

  RETURN v_id;
END;
$$;


-- =========================================================
-- UPSERT (ROOT) — IDPOTENT + CHAINED
-- =========================================================

/* ──────────────────────────────────────────────
 * UPSERT: DAMAGE (ROOT)
 *
 * Expects authored JSON shape:
 * {
 *   id?,
 *   damageTypeId,
 *   valueKind,            -- FIXED | DICE | POOL
 *   scalingType,          -- NONE | PER_LEVEL
 *   scalingSource?,       -- CHARACTER_LEVEL | CLASS_LEVEL | SPELL_LEVEL
 *   classId?, spellId?,
 *   order?,
 *
 *   bonusCodes: string[],
 *   bonuses?: DamageBonusEffect[],
 *
 *   // NONE:
 *   value?: { amount } | { dice } | { amount } (pool base)
 *
 *   // PER_LEVEL:
 *   scaling?: {
 *     ...ScalingPayload (source details),
 *     // FIXED/DICE:
 *     levels?: [{ id?, level, order, value: { amount|dice } }]
 *     // POOL:
 *     value?: { amount?, multiplier?, min?, max? }
 *   }
 * }
 * ────────────────────────────────────────────── */
CREATE OR REPLACE FUNCTION public.upsert_damage (
  json_data jsonb,
  p_system_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_damage_id uuid := COALESCE((json_data ->> 'id')::uuid, gen_random_uuid());
  v_value_id uuid;
  v_value_kind text := json_data ->> 'valueKind';
  v_scaling_type text := json_data ->> 'scalingType';
BEGIN
  IF json_data IS NULL THEN
    RETURN NULL;
  END IF;

  /* ─────────────────────────────
   * ROOT
   * ───────────────────────────── */

  INSERT INTO public.damages (
    id,
    system_id,
    damage_type_id,
    value_kind,
    scaling_type,
    scaling_source,
    class_id,
    spell_id,
    sort_order
  )
  VALUES (
    v_damage_id,
    p_system_id,
    (json_data ->> 'damageTypeId')::uuid,
    v_value_kind,
    v_scaling_type,
    NULLIF(json_data ->> 'scalingSource', ''),
    NULLIF(json_data ->> 'classId', '')::uuid,
    NULLIF(json_data ->> 'spellId', '')::uuid,
    COALESCE((json_data ->> 'order')::int, 0)
  )
  ON CONFLICT (id) DO UPDATE
  SET
    damage_type_id = excluded.damage_type_id,
    value_kind     = excluded.value_kind,
    scaling_type   = excluded.scaling_type,
    scaling_source = excluded.scaling_source,
    class_id       = excluded.class_id,
    spell_id       = excluded.spell_id,
    sort_order     = excluded.sort_order;

  /* ─────────────────────────────
   * BONUS CODES (author intent)
   * idempotent rebuild
   * ───────────────────────────── */

  DELETE FROM public.damage_bonus_kinds
  WHERE damage_id = v_damage_id;

  INSERT INTO public.damage_bonus_kinds (damage_id, bonus_kind, sort_order)
  SELECT
    v_damage_id,
    x::text,
    ordinality::int
  FROM jsonb_array_elements_text(COALESCE(json_data -> 'bonusCodes', '[]'::jsonb))
  WITH ORDINALITY;

  /* ─────────────────────────────
   * VALUE (1:1) — replace deterministically
   * For FIXED/DICE: take from json_data.value
   * For POOL:
   *   - NONE: take from json_data.value
   *   - PER_LEVEL: take from json_data.scaling.value
   * ───────────────────────────── */

  DELETE FROM public.damage_values
  WHERE damage_id = v_damage_id;

  INSERT INTO public.damage_values (
    id,
    damage_id,
    amount,
    dice,
    multiplier,
    min,
    max
  )
  VALUES (
    gen_random_uuid(),
    v_damage_id,

    /* amount */
    CASE
      WHEN v_value_kind IN ('FIXED', 'POOL') AND v_scaling_type = 'NONE'
        THEN NULLIF(json_data #>> '{value,amount}', '')::numeric
      WHEN v_value_kind = 'POOL' AND v_scaling_type = 'PER_LEVEL'
        THEN NULLIF(json_data #>> '{scaling,value,amount}', '')::numeric
      ELSE NULL
    END,

    /* dice */
    CASE
      WHEN v_value_kind = 'DICE' AND v_scaling_type = 'NONE'
        THEN NULLIF(json_data #>> '{value,dice}', '')
      ELSE NULL
    END,

    /* multiplier/min/max (POOL only) */
    CASE
      WHEN v_value_kind = 'POOL' AND v_scaling_type = 'NONE'
        THEN NULLIF(json_data #>> '{value,multiplier}', '')::numeric
      WHEN v_value_kind = 'POOL' AND v_scaling_type = 'PER_LEVEL'
        THEN NULLIF(json_data #>> '{scaling,value,multiplier}', '')::numeric
      ELSE NULL
    END,
    CASE
      WHEN v_value_kind = 'POOL' AND v_scaling_type = 'NONE'
        THEN NULLIF(json_data #>> '{value,min}', '')::numeric
      WHEN v_value_kind = 'POOL' AND v_scaling_type = 'PER_LEVEL'
        THEN NULLIF(json_data #>> '{scaling,value,min}', '')::numeric
      ELSE NULL
    END,
    CASE
      WHEN v_value_kind = 'POOL' AND v_scaling_type = 'NONE'
        THEN NULLIF(json_data #>> '{value,max}', '')::numeric
      WHEN v_value_kind = 'POOL' AND v_scaling_type = 'PER_LEVEL'
        THEN NULLIF(json_data #>> '{scaling,value,max}', '')::numeric
      ELSE NULL
    END
  )
  RETURNING id INTO v_value_id;

  /* ─────────────────────────────
   * BONUSES (payload objects) — replace deterministically
   * ───────────────────────────── */

  DELETE FROM public.damage_bonuses
  WHERE damage_value_id = v_value_id;

  -- If you have a helper that takes (jsonb_array, fn_name, parent_id),
  -- pass the bonuses array directly. If bonuses is null/missing, COALESCE to [].
  PERFORM public.upsert_json_array(
    COALESCE(json_data -> 'bonuses', '[]'::jsonb),
    'upsert_damage_bonus',
    v_value_id
  );

  /* ─────────────────────────────
   * SCALING LEVELS (FIXED/DICE only)
   * - PER_LEVEL + value_kind IN (FIXED, DICE) => upsert levels
   * - else => delete all
   * ───────────────────────────── */

  IF v_scaling_type = 'PER_LEVEL' AND v_value_kind IN ('FIXED', 'DICE') THEN

    -- stale delete by id (idempotent, supports stable ids)
    DELETE FROM public.damage_scaling_levels
    WHERE damage_id = v_damage_id
      AND id NOT IN (
        SELECT (x ->> 'id')::uuid
        FROM jsonb_array_elements(COALESCE(json_data #> '{scaling,levels}', '[]'::jsonb)) x
        WHERE x ? 'id'
      );

    PERFORM public.upsert_json_array(
      COALESCE(json_data #> '{scaling,levels}', '[]'::jsonb),
      'upsert_damage_scaling_level',
      v_damage_id
    );

  ELSE
    DELETE FROM public.damage_scaling_levels
    WHERE damage_id = v_damage_id;
  END IF;

  RETURN v_damage_id;
END;
$$;
