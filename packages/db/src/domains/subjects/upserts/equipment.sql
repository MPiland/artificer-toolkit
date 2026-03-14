CREATE OR REPLACE FUNCTION public.upsert_equipment(
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
    weight_unit,
    capacity_amount,
    capacity_unit,
    max_stack,
    max_bonus,
    armor_class,
    charge_id,
    restriction_id,
    parent_equipment_id
  )
  VALUES (
    v_id,
    p_system_id,
    (json_data ->> 'userId')::uuid,
    json_data ->> 'label',
    json_data ->> 'description',
    NULLIF(json_data ->> 'quote', ''),
    json_data ->> 'category',
    (json_data ->> 'rarityId')::uuid,
    (json_data #>> '{cost,amount}')::int,
    (json_data #>> '{cost,currencyId}')::uuid,
    (json_data #>> '{weight,amount}')::numeric,
    json_data #>> '{weight,unit}',
    NULLIF(json_data #>> '{capacity,amount}', '')::numeric,
    COALESCE(NULLIF(json_data #>> '{capacity,unit}', ''), json_data #>> '{weight,unit}'),
    NULLIF(json_data ->> 'maxStack', '')::int,
    NULLIF(json_data ->> 'maxBonus', '')::int,
    NULLIF(json_data ->> 'armorClass', '')::int,
    v_charge_id,
    v_restriction_id,
    NULLIF(json_data ->> 'parentEquipmentId', '')::uuid
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
    weight_unit = excluded.weight_unit,
    capacity_amount = excluded.capacity_amount,
    capacity_unit = excluded.capacity_unit,
    max_stack = excluded.max_stack,
    max_bonus = excluded.max_bonus,
    armor_class = excluded.armor_class,
    charge_id = excluded.charge_id,
    restriction_id = excluded.restriction_id,
    parent_equipment_id = excluded.parent_equipment_id;

  DELETE FROM public.equipment_traits
  WHERE equipment_id = v_id;

  DELETE FROM public.equipment_attributes
  WHERE equipment_id = v_id
    AND attribute_code NOT IN (
      SELECT jsonb_array_elements_text(COALESCE(json_data -> 'attributes', '[]'::jsonb))
    );

  INSERT INTO public.equipment_attributes (equipment_id, attribute_code, sort_order)
  SELECT v_id, x, ord
  FROM jsonb_array_elements_text(COALESCE(json_data -> 'attributes', '[]'::jsonb))
  WITH ORDINALITY AS t(x, ord)
  ON CONFLICT (equipment_id, attribute_code) DO UPDATE
  SET sort_order = excluded.sort_order;

  DELETE FROM public.equipment_properties
  WHERE equipment_id = v_id;

  INSERT INTO public.equipment_properties (equipment_id, property_code)
  SELECT v_id, x
  FROM jsonb_array_elements_text(COALESCE(json_data -> 'properties', '[]'::jsonb)) x;

  DELETE FROM public.equipment_abilities
  WHERE equipment_id = v_id;

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'abilities', '[]'::jsonb))
    WITH ORDINALITY AS a(x, ord)
  LOOP
    INSERT INTO public.equipment_abilities (equipment_id, operation, ability_code, sort_order)
    SELECT
      v_id,
      obj ->> 'op',
      (y ->> 'ability'),
      ord
    FROM jsonb_array_elements(COALESCE(obj -> 'abilities', '[]'::jsonb)) y;
  END LOOP;

  DELETE FROM public.equipment_speed
  WHERE equipment_id = v_id;

  IF json_data ? 'speed' AND (json_data -> 'speed') IS NOT NULL THEN
    INSERT INTO public.equipment_speed (equipment_id, amount, unit_code)
    VALUES (
      v_id,
      (json_data #>> '{speed,amount}')::numeric,
      json_data #>> '{speed,unit}'
    );
  END IF;

  DELETE FROM public.equipment_contains
  WHERE equipment_id = v_id;

  INSERT INTO public.equipment_contains (equipment_id, contained_equipment_id, quantity)
  SELECT
    v_id,
    (x ->> 'equipmentId')::uuid,
    (x ->> 'quantity')::int
  FROM jsonb_array_elements(COALESCE(json_data -> 'contains', '[]'::jsonb)) x;

  DELETE FROM public.equipment_effects
  WHERE equipment_id = v_id
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
    INSERT INTO public.equipment_effects (equipment_id, effect_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (equipment_id, effect_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  DELETE FROM public.equipment_modifier_grants
  WHERE equipment_id = v_id
    AND modifier_grant_id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data -> 'modifiers', '[]'::jsonb)) x
      WHERE x ? 'id'
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'modifiers', '[]'::jsonb))
    WITH ORDINALITY AS m(x, ord)
  LOOP
    v_child_id := public.upsert_modifier_grant(obj);
    INSERT INTO public.equipment_modifier_grants (equipment_id, modifier_grant_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (equipment_id, modifier_grant_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  DELETE FROM public.equipment_features
  WHERE equipment_id = v_id
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
    INSERT INTO public.equipment_features (equipment_id, feature_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (equipment_id, feature_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  RETURN v_id;
END;
$$;
