CREATE OR REPLACE FUNCTION public.upsert_spell(
  json_data jsonb,
  p_system_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id', '')::uuid, gen_random_uuid());
  v_effect_id uuid;
  obj jsonb;
  ord integer;
BEGIN
  IF json_data IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.spells (
    id,
    system_id,
    user_id,
    label,
    description,
    level,
    magic_school_id,
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
    json_data #>> '{castingTime,unit}',
    (json_data #>> '{castingTime,amount}')::int,
    NULLIF(json_data ->> 'materialDescription', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    system_id = excluded.system_id,
    user_id = excluded.user_id,
    label = excluded.label,
    description = excluded.description,
    level = excluded.level,
    magic_school_id = excluded.magic_school_id,
    casting_time_unit = excluded.casting_time_unit,
    casting_time_amount = excluded.casting_time_amount,
    material_description = excluded.material_description;

  DELETE FROM public.spell_attributes
  WHERE spell_id = v_id
    AND attribute_code NOT IN (
      SELECT jsonb_array_elements_text(COALESCE(json_data -> 'attributes', '[]'::jsonb))
    );

  INSERT INTO public.spell_attributes (spell_id, attribute_code, sort_order)
  SELECT v_id, x, ord
  FROM jsonb_array_elements_text(COALESCE(json_data -> 'attributes', '[]'::jsonb))
  WITH ORDINALITY AS t(x, ord)
  ON CONFLICT (spell_id, attribute_code) DO UPDATE
  SET sort_order = excluded.sort_order;

  DELETE FROM public.spell_traits
  WHERE spell_id = v_id;

  DELETE FROM public.spell_classes
  WHERE spell_id = v_id
    AND class_id NOT IN (
      SELECT (x)::uuid
      FROM jsonb_array_elements_text(COALESCE(json_data -> 'classIds', '[]'::jsonb)) x
    );

  INSERT INTO public.spell_classes (spell_id, class_id)
  SELECT v_id, (x)::uuid
  FROM jsonb_array_elements_text(COALESCE(json_data -> 'classIds', '[]'::jsonb)) x
  ON CONFLICT DO NOTHING;

  DELETE FROM public.spell_effects
  WHERE spell_id = v_id
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
    v_effect_id := public.upsert_effect(obj);

    INSERT INTO public.spell_effects (spell_id, effect_id, sort_order)
    VALUES (v_id, v_effect_id, ord)
    ON CONFLICT (spell_id, effect_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  RETURN v_id;
END;
$$;
