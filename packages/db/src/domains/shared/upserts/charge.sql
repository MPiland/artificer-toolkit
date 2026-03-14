CREATE OR REPLACE FUNCTION public.upsert_charge(
  json_data jsonb,
  p_system_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id', '')::uuid, gen_random_uuid());
  obj jsonb;
  v_level integer;
  v_level_amount integer;
  v_bonus_kind text;
BEGIN
  IF json_data IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.charges (
    id,
    scaling_kind,
    reset_kind
  )
  VALUES (
    v_id,
    json_data ->> 'scalingKind',
    json_data ->> 'resetKind'
  )
  ON CONFLICT (id) DO UPDATE SET
    scaling_kind = excluded.scaling_kind,
    reset_kind = excluded.reset_kind;

  IF json_data ->> 'scalingKind' = 'NONE' THEN
    DELETE FROM public.charge_scaling_levels
    WHERE charge_id = v_id;

    INSERT INTO public.charge_limits (
      charge_id,
      limit_kind,
      amount,
      multiplier,
      min,
      max
    )
    VALUES (
      v_id,
      json_data ->> 'limitKind',
      NULLIF(json_data ->> 'amount', '')::integer,
      NULLIF(json_data ->> 'multiplier', '')::numeric,
      NULLIF(json_data ->> 'min', '')::integer,
      NULLIF(json_data ->> 'max', '')::integer
    )
    ON CONFLICT (charge_id) DO UPDATE SET
      limit_kind = excluded.limit_kind,
      amount = excluded.amount,
      multiplier = excluded.multiplier,
      min = excluded.min,
      max = excluded.max;
  ELSE
    DELETE FROM public.charge_limits
    WHERE charge_id = v_id;

    IF json_data ? 'levels' THEN
      DELETE FROM public.charge_scaling_levels
      WHERE charge_id = v_id
        AND level NOT IN (
          SELECT NULLIF(level_obj ->> 'level', '')::integer
          FROM jsonb_array_elements(COALESCE(json_data -> 'levels', '[]'::jsonb)) AS level_obj
          WHERE level_obj ? 'level'
        );

      FOR obj IN
        SELECT level_obj
        FROM jsonb_array_elements(COALESCE(json_data -> 'levels', '[]'::jsonb)) AS level_obj
      LOOP
        v_level := NULLIF(obj ->> 'level', '')::integer;
        v_level_amount := NULLIF(obj ->> 'amount', '')::integer;

        IF v_level IS NULL OR v_level_amount IS NULL THEN
          CONTINUE;
        END IF;

        INSERT INTO public.charge_scaling_levels (
          charge_id,
          level,
          sort_order,
          amount
        )
        VALUES (
          v_id,
          v_level,
          v_level,
          v_level_amount
        )
        ON CONFLICT (charge_id, level) DO UPDATE SET
          sort_order = excluded.sort_order,
          amount = excluded.amount;
      END LOOP;
    ELSE
      DELETE FROM public.charge_scaling_levels
      WHERE charge_id = v_id;
    END IF;
  END IF;

  IF json_data ? 'bonuses' THEN
    DELETE FROM public.charge_bonuses
    WHERE charge_id = v_id
      AND bonus_kind NOT IN (
        SELECT bonus_obj ->> 'bonusKind'
        FROM jsonb_array_elements(COALESCE(json_data -> 'bonuses', '[]'::jsonb)) AS bonus_obj
        WHERE bonus_obj ? 'bonusKind'
      );

    FOR obj IN
      SELECT bonus_obj
      FROM jsonb_array_elements(COALESCE(json_data -> 'bonuses', '[]'::jsonb)) AS bonus_obj
    LOOP
      v_bonus_kind := obj ->> 'bonusKind';

      IF v_bonus_kind IS NULL OR v_bonus_kind = '' THEN
        CONTINUE;
      END IF;

      INSERT INTO public.charge_bonuses (
        charge_id,
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
        v_bonus_kind,
        NULLIF(obj ->> 'ability', ''),
        NULLIF(obj ->> 'skillId', '')::uuid,
        NULLIF(obj ->> 'multiplier', '')::numeric,
        NULLIF(obj ->> 'min', '')::integer,
        NULLIF(obj ->> 'max', '')::integer,
        COALESCE(NULLIF(obj ->> 'order', '')::integer, 0)
      )
      ON CONFLICT (charge_id, bonus_kind) DO UPDATE SET
        ability_code = excluded.ability_code,
        skill_id = excluded.skill_id,
        multiplier = excluded.multiplier,
        min = excluded.min,
        max = excluded.max,
        sort_order = excluded.sort_order;
    END LOOP;
  ELSE
    DELETE FROM public.charge_bonuses
    WHERE charge_id = v_id;
  END IF;

  RETURN v_id;
END;
$$;
