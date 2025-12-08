/***************************
 * TABLES
 ***************************/
CREATE TABLE IF NOT EXISTS public.charges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    reset_id uuid REFERENCES public.system_charges (id) ON DELETE SET NULL DEFERRABLE,
    limit_id uuid REFERENCES public.system_charges (id) ON DELETE SET NULL DEFERRABLE,
    ability_id uuid REFERENCES public.system_abilities (id) ON DELETE SET NULL DEFERRABLE,
    min_amount integer,
    add_amount integer,
    set_amount integer,
    multiplier integer,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_charges_updated_at'
            AND tgrelid = 'public.charges'::regclass) THEN
    CREATE TRIGGER trg_charges_updated_at
        BEFORE UPDATE ON public.charges
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.charges ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.charge_uses_per_level (
    charge_id uuid NOT NULL REFERENCES public.charges (id) ON DELETE CASCADE DEFERRABLE,
    level integer NOT NULL DEFAULT 1,
    uses integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (charge_id, level)
);

CREATE INDEX IF NOT EXISTS idx_charge_uses_per_level_charge_id ON public.charge_uses_per_level (charge_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_charge_uses_per_level_updated_at'
            AND tgrelid = 'public.charge_uses_per_level'::regclass) THEN
    CREATE TRIGGER trg_charge_uses_per_level_updated_at
        BEFORE UPDATE ON public.charge_uses_per_level
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.charge_uses_per_level ENABLE ROW LEVEL SECURITY;

/***************************
 * FUNCTIONS
 ***************************/
CREATE OR REPLACE FUNCTION public.upsert_charges (json_data jsonb, p_existing_id uuid DEFAULT NULL)
    RETURNS uuid
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE
    -- Primary ID for this charge row
    v_id uuid := COALESCE(p_existing_id, gen_random_uuid ());
    -- Extract fields from JSON
    v_reset_id uuid := NULLIF (json_data ->> 'resetId', '')::uuid;
    v_limit_id uuid := NULLIF (json_data ->> 'limitId', '')::uuid;
    v_ability_id uuid := NULLIF (json_data ->> 'abilityId', '')::uuid;
    v_min_amount int := NULLIF (json_data ->> 'minAmount', '')::int;
    v_add_amount int := NULLIF (json_data ->> 'addAmount', '')::int;
    v_set_amount int := NULLIF (json_data ->> 'setAmount', '')::int;
    v_multiplier int := NULLIF (json_data ->> 'multiplier', '')::int;
BEGIN
    -- Return NULL immediately if no JSON provided
    IF json_data IS NULL THEN
        RETURN NULL;

    END IF;
    -- 🧩 Upsert main charges row
    INSERT INTO public.charges (id, reset_id, limit_id, ability_id, min_amount, add_amount, set_amount, multiplier)
        VALUES (v_id, v_reset_id, v_limit_id, v_ability_id, v_min_amount, v_add_amount, v_set_amount, v_multiplier)
    ON CONFLICT (id)
        DO UPDATE SET
            reset_id = excluded.reset_id,
            limit_id = excluded.limit_id,
            ability_id = excluded.ability_id,
            min_amount = excluded.min_amount,
            add_amount = excluded.add_amount,
            set_amount = excluded.set_amount,
            multiplier = excluded.multiplier
        RETURNING
            id INTO v_id;
    -- 🧩 Upsert usesPerLevel bridge table
    -- Insert or update each level/uses entry
    INSERT INTO public.charge_uses_per_level (charge_id, level, uses)
    SELECT
        v_id,
        NULLIF (x ->> 'level', '')::int,
        NULLIF (x ->> 'uses', '')::int
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'usesPerLevel', '[]'::jsonb)) AS x
ON CONFLICT (charge_id, level)
    DO UPDATE SET
        uses = excluded.uses;
    -- 🧩 Delete any usesPerLevel rows no longer present in JSON
    DELETE FROM public.charge_uses_per_level u
    WHERE u.charge_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'usesPerLevel', '[]'::jsonb)) AS x
            WHERE
                NULLIF (x ->> 'level', '')::int = u.level);
    -- Return the upserted charge ID
    RETURN v_id;

END;
$$;

