/* ──────────────────────────────────────────────
 * UPSERT — EQUIPMENT
 *
 * Idempotence:
 *   - Root: UPSERT by id
 *   - Children: authoritative clears (safe) for simple
 *     arrays; loops for owned children via bridges
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_equipment (
  json_data jsonb,
  p_system_id uuid
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
    v_charge_id := public.upsert_charge(json_data -> 'charges', p_system_id);
  ELSE
    v_charge_id := NULL;
  END IF;

  /* ─────────────────────────────
   * ROOT
   * ───────────────────────────── */

  INSERT INTO public.equipment (
    id,
    system_id,
    user_id,
    label,
    description,
    quote,
    category,
    rarity_id,
    cost_amount,
    cost_currency_id,
    weight_amount,
    weight_unit_id,
    capacity_amount,
    capacity_unit_id,
    max_stack,
    max_bonus,
    armor_class,
    charge_id,
    parent_equipment_id
  )
  VALUES (
    v_id,
    p_system_id,
    (json_data ->> 'userId')::uuid,
    json_data ->> 'label',
    json_data ->> 'description',
    json_data ->> 'quote',
    json_data ->> 'category',
    (json_data ->> 'rarityId')::uuid,
    (json_data #>> '{cost,amount}')::int,
    (json_data #>> '{cost,currencyId}')::uuid,
    (json_data #>> '{weight,amount}')::numeric,
    (json_data #>> '{weight,unitId}')::uuid,
    NULLIF(json_data #>> '{capacity,amount}','')::numeric,
    NULLIF(json_data #>> '{capacity,unitId}','')::uuid,
    NULLIF(json_data ->> 'maxStack','')::int,
    NULLIF(json_data ->> 'maxBonus','')::int,
    NULLIF(json_data ->> 'armorClass','')::int,
    v_charge_id,
    NULLIF(json_data ->> 'parentEquipmentId','')::uuid
  )
  ON CONFLICT (id) DO UPDATE SET
    label = excluded.label,
    description = excluded.description,
    quote = excluded.quote,
    category = excluded.category,
    rarity_id = excluded.rarity_id,
    cost_amount = excluded.cost_amount,
    cost_currency_id = excluded.cost_currency_id,
    weight_amount = excluded.weight_amount,
    weight_unit_id = excluded.weight_unit_id,
    capacity_amount = excluded.capacity_amount,
    capacity_unit_id = excluded.capacity_unit_id,
    max_stack = excluded.max_stack,
    max_bonus = excluded.max_bonus,
    armor_class = excluded.armor_class,
    charge_id = excluded.charge_id,
    parent_equipment_id = excluded.parent_equipment_id;

  /* ─────────────────────────────
   * TRAITS (authoritative array)
   * ───────────────────────────── */

  DELETE FROM public.equipment_traits
  WHERE equipment_id = v_id;

  INSERT INTO public.equipment_traits (equipment_id, trait_code, sort_order)
  SELECT v_id, x, ord
  FROM jsonb_array_elements_text(COALESCE(json_data -> 'traits','[]'::jsonb))
  WITH ORDINALITY AS t(x, ord);

  /* ─────────────────────────────
   * PROPERTIES (authoritative array)
   * ───────────────────────────── */

  DELETE FROM public.equipment_properties
  WHERE equipment_id = v_id;

  INSERT INTO public.equipment_properties (equipment_id, property_code)
  SELECT v_id, x
  FROM jsonb_array_elements_text(COALESCE(json_data -> 'properties','[]'::jsonb)) x;

  /* ─────────────────────────────
   * ABILITIES (authoritative surface)
   * ───────────────────────────── */

  DELETE FROM public.equipment_abilities
  WHERE equipment_id = v_id;

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'abilities','[]'::jsonb))
    WITH ORDINALITY AS a(x, ord)
  LOOP
    INSERT INTO public.equipment_abilities (equipment_id, operation, ability_code, sort_order)
    SELECT
      v_id,
      obj ->> 'op',
      (y ->> 'ability'),
      ord
    FROM jsonb_array_elements(COALESCE(obj -> 'abilities','[]'::jsonb)) y;
  END LOOP;

  /* ─────────────────────────────
   * SPEED (optional 1:1)
   * ───────────────────────────── */

  DELETE FROM public.equipment_speed
  WHERE equipment_id = v_id;

  IF json_data ? 'speed' AND (json_data -> 'speed') IS NOT NULL THEN
    INSERT INTO public.equipment_speed (equipment_id, amount, unit_id)
    VALUES (
      v_id,
      (json_data #>> '{speed,amount}')::numeric,
      (json_data #>> '{speed,unitId}')::uuid
    );
  END IF;

  /* ─────────────────────────────
   * CONTAINS (authoritative array)
   * ───────────────────────────── */

  DELETE FROM public.equipment_contains
  WHERE equipment_id = v_id;

  INSERT INTO public.equipment_contains (equipment_id, contained_equipment_id, quantity)
  SELECT
    v_id,
    (x ->> 'equipmentId')::uuid,
    (x ->> 'quantity')::int
  FROM jsonb_array_elements(COALESCE(json_data -> 'contains','[]'::jsonb)) x;

  /* ─────────────────────────────
   * RESTRICTIONS (owned, ordered)
   * ───────────────────────────── */

  DELETE FROM public.equipment_restrictions
  WHERE equipment_id = v_id;

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'restrictions','[]'::jsonb))
    WITH ORDINALITY AS r(x, ord)
  LOOP
    v_child_id := public.upsert_restriction(obj, p_system_id);

    INSERT INTO public.equipment_restrictions (equipment_id, restriction_id, sort_order)
    VALUES (v_id, v_child_id, ord);
  END LOOP;

  /* ─────────────────────────────
   * EFFECTS (owned, ordered)
   * ───────────────────────────── */

  DELETE FROM public.equipment_effects
  WHERE equipment_id = v_id;

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'effects','[]'::jsonb))
    WITH ORDINALITY AS e(x, ord)
  LOOP
    v_child_id := public.upsert_effect(obj, p_system_id);

    INSERT INTO public.equipment_effects (equipment_id, effect_id, sort_order)
    VALUES (v_id, v_child_id, ord);
  END LOOP;

  /* ─────────────────────────────
   * MODIFIERS (owned, ordered)
   * ───────────────────────────── */

  DELETE FROM public.equipment_modifier_grants
  WHERE equipment_id = v_id;

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'modifiers','[]'::jsonb))
    WITH ORDINALITY AS m(x, ord)
  LOOP
    v_child_id := public.upsert_modifier_grant(obj, p_system_id);

    INSERT INTO public.equipment_modifier_grants (equipment_id, modifier_grant_id, sort_order)
    VALUES (v_id, v_child_id, ord);
  END LOOP;

  /* ─────────────────────────────
   * FEATURES (owned, ordered)
   * ───────────────────────────── */

  DELETE FROM public.equipment_features
  WHERE equipment_id = v_id;

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'features','[]'::jsonb))
    WITH ORDINALITY AS f(x, ord)
  LOOP
    v_child_id := public.upsert_feature(obj, p_system_id);

    INSERT INTO public.equipment_features (equipment_id, feature_id, sort_order)
    VALUES (v_id, v_child_id, ord);
  END LOOP;

  RETURN v_id;
END;
$$;
