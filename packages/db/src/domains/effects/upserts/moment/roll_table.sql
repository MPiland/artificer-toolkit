CREATE OR REPLACE FUNCTION public.upsert_moment_roll_table_payload (
  json_data jsonb,
  p_entry_id uuid
) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF json_data IS NULL THEN
    DELETE FROM public.moment_roll_table_damages WHERE entry_id = p_entry_id;
    DELETE FROM public.moment_roll_table_conditions WHERE entry_id = p_entry_id;
    RETURN;
  END IF;

  CASE json_data ->> 'kind'
    WHEN 'DAMAGE' THEN
      INSERT INTO public.moment_roll_table_damages (entry_id, damage_id)
      VALUES (
        p_entry_id,
        (json_data ->> 'damageId')::uuid
      )
      ON CONFLICT (entry_id)
      DO UPDATE SET damage_id = excluded.damage_id;

      DELETE FROM public.moment_roll_table_conditions WHERE entry_id = p_entry_id;

    WHEN 'CONDITION' THEN
      INSERT INTO public.moment_roll_table_conditions (entry_id, condition_id)
      VALUES (
        p_entry_id,
        (json_data ->> 'conditionId')::uuid
      )
      ON CONFLICT (entry_id)
      DO UPDATE SET condition_id = excluded.condition_id;

      DELETE FROM public.moment_roll_table_damages WHERE entry_id = p_entry_id;
  END CASE;
END;
$$;

