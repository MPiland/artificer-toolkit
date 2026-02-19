CREATE OR REPLACE FUNCTION public.upsert_moment_direct_payload (
  json_data jsonb,
  p_effect_id uuid,
  p_trigger_code text,
  p_moment_code text
) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF json_data IS NULL THEN
    DELETE FROM public.moment_direct_damages
    WHERE effect_id = p_effect_id
      AND trigger_code = p_trigger_code
      AND moment_code = p_moment_code;

    DELETE FROM public.moment_direct_conditions
    WHERE effect_id = p_effect_id
      AND trigger_code = p_trigger_code
      AND moment_code = p_moment_code;

    RETURN;
  END IF;

  CASE json_data ->> 'kind'
    WHEN 'DAMAGE' THEN
      INSERT INTO public.moment_direct_damages (
        effect_id, trigger_code, moment_code, damage_id
      )
      VALUES (
        p_effect_id,
        p_trigger_code,
        p_moment_code,
        (json_data ->> 'damageId')::uuid
      )
      ON CONFLICT (effect_id, trigger_code, moment_code)
      DO UPDATE SET damage_id = excluded.damage_id;

      DELETE FROM public.moment_direct_conditions
      WHERE effect_id = p_effect_id
        AND trigger_code = p_trigger_code
        AND moment_code = p_moment_code;

    WHEN 'CONDITION' THEN
      INSERT INTO public.moment_direct_conditions (
        effect_id, trigger_code, moment_code, condition_id
      )
      VALUES (
        p_effect_id,
        p_trigger_code,
        p_moment_code,
        (json_data ->> 'conditionId')::uuid
      )
      ON CONFLICT (effect_id, trigger_code, moment_code)
      DO UPDATE SET condition_id = excluded.condition_id;

      DELETE FROM public.moment_direct_damages
      WHERE effect_id = p_effect_id
        AND trigger_code = p_trigger_code
        AND moment_code = p_moment_code;
  END CASE;
END;
$$;

