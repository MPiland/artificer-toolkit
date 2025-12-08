/***************************
 * TABLES
 ***************************/ 

CREATE TABLE IF NOT EXISTS public.details (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    label text NOT NULL,
    description text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_details_updated_at'
            AND tgrelid = 'public.details'::regclass) THEN
    CREATE TRIGGER trg_details_updated_at
        BEFORE UPDATE ON public.details
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.details ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'characteristic_type'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.characteristic_type AS ENUM (
            'RANGE',
            'SHAPE',
            'DURATION'
        );
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.characteristics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    type public.characteristic_type,
    min_amount integer,
    max_amount integer,
    distance integer,
    size double precision,
    amount double precision,
    unit_id uuid REFERENCES public.system_measure_units (id) ON DELETE SET NULL,
    characteristic_id uuid REFERENCES public.system_spell_opts (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_characteristics_type ON public.characteristics (type);

CREATE INDEX IF NOT EXISTS idx_characteristics_unit_id ON public.characteristics (unit_id);

CREATE INDEX IF NOT EXISTS idx_characteristics_option_id ON public.characteristics (characteristic_id);

CREATE INDEX IF NOT EXISTS idx_characteristics_shape ON characteristics (id)
WHERE
    type = 'SHAPE';

CREATE INDEX IF NOT EXISTS idx_characteristics_range ON characteristics (id)
WHERE
    type = 'RANGE';

CREATE INDEX IF NOT EXISTS idx_characteristics_duration ON characteristics (id)
WHERE
    type = 'DURATION';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_characteristics_updated_at'
            AND tgrelid = 'public.characteristics'::regclass) THEN
    CREATE TRIGGER trg_characteristics_updated_at
        BEFORE UPDATE ON public.characteristics
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.characteristics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'measure_kind'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.measure_kind AS ENUM (
            'WEIGHT',
            'CAPACITY',
            'SPEED'
        );
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.measures (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    kind public.measure_kind NOT NULL,
    amount double precision NOT NULL,
    unit_id uuid NOT NULL REFERENCES public.system_measure_units (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT measures_unit_kind_chk CHECK ((kind = 'WEIGHT' AND unit_id IS NOT NULL) OR (kind = 'CAPACITY' AND unit_id IS NOT NULL) OR (kind = 'SPEED' AND unit_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_measures_kind ON public.measures (kind);

CREATE INDEX IF NOT EXISTS idx_measures_unit_id ON public.measures (unit_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_measures_updated_at'
            AND tgrelid = 'public.measures'::regclass) THEN
    CREATE TRIGGER trg_measures_updated_at
        BEFORE UPDATE ON public.measures
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.measures ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.costs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    amount integer NOT NULL,
    currency_id uuid NOT NULL REFERENCES public.system_currencies (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_costs_currency_id ON public.costs (currency_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_costs_updated_at'
            AND tgrelid = 'public.costs'::regclass) THEN
    CREATE TRIGGER trg_costs_updated_at
        BEFORE UPDATE ON public.costs
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.costs ENABLE ROW LEVEL SECURITY;


/***************************
 * FUNCTIONS
 ***************************/
-- 🧩 Durations
CREATE OR REPLACE FUNCTION public.upsert_durations (j jsonb, p_existing_id uuid DEFAULT NULL)
    RETURNS uuid
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE
    v_id uuid := COALESCE(p_existing_id, gen_random_uuid ());
    v_amount float := NULLIF (j ->> 'amount', '')::float;
    v_type public.characteristic_type := 'DURATION'::public.characteristic_type;
BEGIN
    IF j IS NULL THEN
        RETURN NULL;

    END IF;
    INSERT INTO public.characteristics (id, type, amount)
        VALUES (v_id, v_type, v_amount)
    ON CONFLICT (id)
        DO UPDATE SET type = excluded.type, amount = excluded.amount;

    RETURN v_id;

END;
$$;

-- 🧩 Ranges
CREATE OR REPLACE FUNCTION public.upsert_ranges (json_data jsonb, p_existing_id uuid DEFAULT NULL)
    RETURNS uuid
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE
    v_id uuid := COALESCE(p_existing_id, gen_random_uuid ());
    v_max_amount int := NULLIF (json_data ->> 'maxAmount', '')::int;
    v_min_amount int := NULLIF (json_data ->> 'minAmount', '')::int;
    v_distance int := NULLIF (json_data ->> 'distance', '')::int;
    v_unit uuid := NULLIF (json_data ->> 'unitId', '')::uuid;
    v_type public.characteristic_type := 'RANGE'::public.characteristic_type;
BEGIN
    IF json_data IS NULL THEN
        RETURN NULL;

    END IF;

    INSERT INTO public.characteristics (id, type, min_amount, max_amount, distance, unit_id)
        VALUES (v_id, v_type, v_min_amount, v_max_amount, v_distance, v_unit)
    ON CONFLICT (id)
        DO UPDATE SET
            min_amount = excluded.min_amount,
            max_amount = excluded.max_amount,
            distance = excluded.distance,
            unit_id = excluded.unit_id;

    RETURN v_id;
END;
$$;

-- 🧩 Shapes
CREATE OR REPLACE FUNCTION public.upsert_shapes (json_data jsonb, p_existing_id uuid DEFAULT NULL)
    RETURNS uuid
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE
    v_id uuid := COALESCE(p_existing_id, gen_random_uuid ());
    v_type public.characteristic_type := 'SHAPE'::public.characteristic_type;
    v_size double precision := NULLIF (json_data ->> 'size', '')::double precision;
    v_unit uuid := NULLIF (json_data ->> 'unitId', '')::uuid;
BEGIN
    IF json_data IS NULL THEN
        RETURN NULL;

    END IF;

    INSERT INTO public.characteristics (id, type, size, unit_id)
        VALUES (v_id, v_type, v_size, v_unit)
    ON CONFLICT (id)
        DO UPDATE SET type = excluded.type, size = excluded.size, unit_id = excluded.unit_id;

    RETURN v_id;
END;
$$;