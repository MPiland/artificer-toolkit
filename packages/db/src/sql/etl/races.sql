/***************************
 * TABLES
 ***************************/
-- 🧩 Core
CREATE TABLE IF NOT EXISTS public.races (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    quote text,
    description text NOT NULL,
    category_id uuid NOT NULL REFERENCES public.system_categories (id) ON DELETE SET NULL DEFERRABLE,
    parent_race_id uuid REFERENCES public.races (id) ON DELETE SET NULL DEFERRABLE,
    size_id uuid REFERENCES public.system_sizes (id) ON DELETE SET NULL DEFERRABLE,
    playable boolean NOT NULL DEFAULT TRUE,
    is_master boolean NOT NULL DEFAULT FALSE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_races_system_id ON public.races (system_id);

CREATE INDEX IF NOT EXISTS idx_races_user_id ON public.races (user_id);

CREATE INDEX IF NOT EXISTS idx_races_category_id ON public.races (category_id);

CREATE INDEX IF NOT EXISTS idx_races_size_id ON public.races (size_id);

CREATE INDEX IF NOT EXISTS idx_races_parent_race_id ON public.races (parent_race_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_races_updated_at'
            AND tgrelid = 'public.races'::regclass) THEN
    CREATE TRIGGER trg_races_updated_at
        BEFORE UPDATE ON public.races
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.races ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.race_details (
    race_id uuid NOT NULL REFERENCES public.races (id) ON DELETE CASCADE DEFERRABLE,
    detail_id UUID NOT NULL REFERENCES public.details (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (race_id, detail_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_race_details_updated_at'
            AND tgrelid = 'public.race_details'::regclass) THEN
    CREATE TRIGGER trg_race_details_updated_at
        BEFORE UPDATE ON public.race_details
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.race_details ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.race_speeds (
    race_id uuid NOT NULL REFERENCES public.races (id) ON DELETE CASCADE DEFERRABLE,
    speed_id uuid NOT NULL REFERENCES public.system_speeds (id) ON DELETE CASCADE,
    amount integer NOT NULL DEFAULT 0,
    unit_id uuid NOT NULL REFERENCES public.system_measure_units (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (race_id, speed_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_race_speeds_updated_at'
            AND tgrelid = 'public.race_speeds'::regclass) THEN
    CREATE TRIGGER trg_race_speeds_updated_at
        BEFORE UPDATE ON public.race_speeds
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_race_speeds_unit_id ON public.race_speeds (unit_id);

CREATE INDEX IF NOT EXISTS idx_race_speeds_speed_id ON public.race_speeds (speed_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_race_speeds_updated_at'
            AND tgrelid = 'public.race_speeds'::regclass) THEN
    CREATE TRIGGER trg_race_speeds_updated_at
        BEFORE UPDATE ON public.race_speeds
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.race_speeds ENABLE ROW LEVEL SECURITY;

-- 🧩 Ancestry
CREATE TABLE public.race_ancestry (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    race_id uuid NOT NULL REFERENCES public.races (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_race_ancestry_race_id ON public.race_ancestry (race_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_race_ancestry_updated_at'
            AND tgrelid = 'public.race_ancestry'::regclass) THEN
    CREATE TRIGGER trg_race_ancestry_updated_at
        BEFORE UPDATE ON public.race_ancestry
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.race_ancestry ENABLE ROW LEVEL SECURITY;

-- 🧩 Ancestry options
CREATE TABLE IF NOT EXISTS public.race_ancestry_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    race_ancestry_id uuid NOT NULL REFERENCES public.race_ancestry (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    position integer NOT NULL DEFAULT 1,
    description text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_race_ancestry_options_race_ancestry_id ON public.race_ancestry_options (race_ancestry_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_race_ancestry_options_updated_at'
            AND tgrelid = 'public.race_ancestry_options'::regclass) THEN
    CREATE TRIGGER trg_race_ancestry_options_updated_at
        BEFORE UPDATE ON public.race_ancestry_options
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.race_ancestry_options ENABLE ROW LEVEL SECURITY;

-- 🧩 Ancestry option features
CREATE TABLE IF NOT EXISTS public.race_ancestry_option_features (
    ancestry_option_id uuid NOT NULL REFERENCES public.race_ancestry_options (id) ON DELETE CASCADE DEFERRABLE,
    feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (ancestry_option_id, feature_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_race_ancestry_option_features'
            AND tgrelid = 'public.race_ancestry_option_features'::regclass) THEN
    CREATE TRIGGER trg_cleanup_race_ancestry_option_features
        AFTER DELETE ON public.race_ancestry_option_features
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.features", "columns": ["feature_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_race_ancestry_option_features_feature_id ON public.race_ancestry_option_features (feature_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_race_ancestry_option_features_updated_at'
            AND tgrelid = 'public.race_ancestry_option_features'::regclass) THEN
    CREATE TRIGGER trg_race_ancestry_option_features_updated_at
        BEFORE UPDATE ON public.race_ancestry_option_features
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.race_ancestry_option_features ENABLE ROW LEVEL SECURITY;

-- 🧩 Features (traits) bridge
CREATE TABLE IF NOT EXISTS public.race_features (
    race_id uuid NOT NULL REFERENCES public.races (id) ON DELETE CASCADE DEFERRABLE,
    feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (race_id, feature_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_race_features'
            AND tgrelid = 'public.race_features'::regclass) THEN
    CREATE TRIGGER trg_cleanup_race_features
        AFTER DELETE ON public.race_features
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.features", "columns": ["feature_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_race_features_feature ON public.race_features (feature_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_race_features_updated_at'
            AND tgrelid = 'public.race_features'::regclass) THEN
    CREATE TRIGGER trg_race_features_updated_at
        BEFORE UPDATE ON public.race_features
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.race_features ENABLE ROW LEVEL SECURITY;

-- 🧩 Details bridge
CREATE TABLE IF NOT EXISTS public.race_details (
    race_id uuid NOT NULL REFERENCES public.races (id) ON DELETE CASCADE DEFERRABLE,
    detail_id uuid NOT NULL REFERENCES public.details (id) DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (race_id, detail_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_race_details_updated_at'
            AND tgrelid = 'public.race_details'::regclass) THEN
    CREATE TRIGGER trg_race_details_updated_at
        BEFORE UPDATE ON public.race_details
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.race_details ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_race_details'
            AND tgrelid = 'public.race_details'::regclass) THEN
    CREATE TRIGGER trg_cleanup_race_details
        AFTER DELETE ON public.race_details
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.details", "columns": ["detail_id"] }
      ]' );
END IF;
END;
$$;

-- 🧩 Apply standard owner policies to top-level, user-owned tables
SELECT
    public.apply_standard_policies ('races');


/***************************
 * FUNCTIONS
 ***************************/
CREATE OR REPLACE FUNCTION public.upsert_races (json_data jsonb)
    RETURNS uuid
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE
    v_id uuid := (json_data ->> 'id')::uuid;
    v_system_id uuid := (json_data ->> 'systemId')::uuid;
    v_user_id uuid := CASE
        WHEN (json_data ->> 'userId') = 'master' THEN NULL
        WHEN (json_data ->> 'userId') IS NULL OR (json_data ->> 'userId') = '' THEN NULL
        ELSE (json_data ->> 'userId')::uuid
    END;
    v_label text := NULLIF (json_data ->> 'label', '');
    v_quote text := json_data ->> 'quote';
    v_description text := json_data ->> 'description';
    v_category_id uuid := NULLIF (COALESCE(json_data ->> 'categoryId', json_data ->> 'category'), '')::uuid;
    v_parent_race_id uuid := NULLIF (json_data ->> 'parentRaceId', '')::uuid;
    v_size_id uuid := NULLIF (json_data -> 'traits' ->> 'sizeId', '')::uuid;
    v_playable boolean := COALESCE((json_data ->> 'playable')::boolean, TRUE);
    v_is_master boolean := CASE WHEN json_data ->> 'userId' = 'master' THEN
        TRUE
    ELSE
        FALSE
    END;
    v_ancestry_id uuid := NULLIF (json_data -> 'ancestry' ->> 'id', '')::uuid;
    rec RECORD;
    rec2 RECORD;
BEGIN
    -- 🧩 Core
    INSERT INTO public.races (id, system_id, user_id, label, quote, description, category_id, parent_race_id, playable, is_master)
        VALUES (v_id, v_system_id, v_user_id, v_label, v_quote, v_description, v_category_id, v_parent_race_id, v_playable, v_is_master)
    ON CONFLICT (id)
        DO UPDATE SET
            label = excluded.label,
            quote = excluded.quote,
            description = excluded.description,
            category_id = excluded.category_id,
            parent_race_id = excluded.parent_race_id,
            playable = excluded.playable;

    -- 🧩 Details
    IF json_data ? 'details' AND JSONB_TYPEOF(json_data -> 'details') = 'array' AND JSONB_ARRAY_LENGTH(json_data -> 'details') > 0 THEN
        WITH parsed_details AS (
            SELECT
                COALESCE((det.obj ->> 'id')::uuid, gen_random_uuid ()) AS id,
                det.obj ->> 'label' AS label,
                det.obj ->> 'description' AS description,
                det.ord AS position
            FROM
                JSONB_ARRAY_ELEMENTS(json_data -> 'details')
                WITH ORDINALITY AS det (obj, ord)
    ),
    upserted_details AS (INSERT INTO public.details (id, label, description)
    SELECT
        id,
        label,
        description
    FROM
        parsed_details
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label, description = EXCLUDED.description
        RETURNING
            id)
    INSERT INTO public.race_details (race_id, detail_id, position)
    SELECT
        v_id,
        pd.id,
        pd.position FROM parsed_details pd
        JOIN upserted_details ud
        USING (id)
    ON CONFLICT (race_id,
        detail_id)
        DO UPDATE SET
            position = EXCLUDED.position;

    END IF;

    DELETE FROM public.race_details rd
    WHERE rd.race_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'details', '[]'::jsonb)) AS x
            WHERE (x ->> 'id')::uuid = rd.detail_id);

    -- 🧩 Traits
    -- Trait Details
    IF json_data -> 'traits' ? 'details' AND JSONB_TYPEOF(json_data -> 'traits' -> 'details') = 'array' AND JSONB_ARRAY_LENGTH(json_data -> 'traits' -> 'details') > 0 THEN
        WITH parsed_race_details AS (
            SELECT
                COALESCE((det.obj ->> 'id')::uuid, gen_random_uuid ()) AS id,
                det.obj ->> 'label' AS label,
                det.obj ->> 'description' AS description,
                det.ord AS position
            FROM
                JSONB_ARRAY_ELEMENTS(json_data -> 'traits' -> 'details')
                WITH ORDINALITY AS det (obj, ord)
    ),
    upserted_race_details AS (INSERT INTO public.details (id, label, description)
    SELECT
        id,
        label,
        description
    FROM
        parsed_race_details
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label, description = EXCLUDED.description
        RETURNING
            id)
    INSERT INTO public.race_details (race_id, detail_id, position)
    SELECT
        v_id,
        pd.id,
        pd.position FROM parsed_race_details pd
        JOIN upserted_race_details ud
        USING (id)
    ON CONFLICT (race_id,
        detail_id)
        DO UPDATE SET
            position = EXCLUDED.position;

    END IF;

    IF json_data -> 'traits' ? 'speeds' AND JSONB_TYPEOF(json_data -> 'traits' -> 'speeds') = 'array' AND JSONB_ARRAY_LENGTH(json_data -> 'traits' -> 'speeds') > 0 THEN
        -- 🧩 Trait speeds
        INSERT INTO public.race_speeds (race_id, speed_id, amount, unit_id)
        SELECT
            v_id,
            (speed ->> 'speedId')::uuid AS speed_id,
            COALESCE(NULLIF (speed ->> 'amount', '')::int, 0) AS amount,
            NULLIF (speed ->> 'unitId', '')::uuid AS unit_id
        FROM
            JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'traits' -> 'speeds', '[]'::jsonb)) AS speed
    ON CONFLICT (race_id,
        speed_id)
        DO UPDATE SET
            amount = excluded.amount,
            unit_id = excluded.unit_id;

    END IF;

    DELETE FROM public.race_details rd
    WHERE rd.race_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'traits' -> 'details', '[]'::jsonb)) AS x
            WHERE (x ->> 'id')::uuid = rd.detail_id);

    DELETE FROM public.race_speeds rs
    WHERE rs.race_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'traits' -> 'speeds', '[]'::jsonb)) AS speed
            WHERE (speed ->> 'speedId')::uuid = rs.speed_id);

    -- 🧩 Features
    WITH ROWS AS (
        SELECT
            v_id AS race_id,
            (feature.obj ->> 'id')::uuid AS feature_id,
            feature.ord AS position
        FROM
            JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'features', '[]'::jsonb))
            WITH ORDINALITY AS feature (obj, ord))
        INSERT INTO public.race_features (race_id, feature_id, position)
        SELECT
            race_id,
            feature_id,
            position
        FROM
            ROWS
        ON CONFLICT (race_id,
            feature_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
    SELECT
        obj
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'features', '[]'::jsonb))
        WITH ORDINALITY AS feature (obj)
        LOOP
            PERFORM
                public.upsert_features (rec.obj);

    END LOOP;

    DELETE FROM public.race_features rf
    WHERE rf.race_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'features', '[]'::jsonb)) AS feature
            WHERE (feature ->> 'id')::uuid = rf.feature_id);

    -- 🧩 Ancestry
    IF json_data ? 'ancestry' AND json_data -> 'ancestry' IS NOT NULL THEN
        INSERT INTO public.race_ancestry (id, race_id, label, description)
        SELECT
            v_ancestry_id AS id,
            v_id AS race_id,
            (json_data -> 'ancestry' ->> 'label') AS label,
            (json_data -> 'ancestry' ->> 'description') AS description
        ON CONFLICT (id)
            DO UPDATE SET
                label = excluded.label,
                description = excluded.description;

    END IF;

    -- 🧩 Ancestry Options
    INSERT INTO public.race_ancestry_options (id, race_ancestry_id, label, description, position)
    SELECT
        (ao.obj ->> 'id')::uuid AS id,
        v_ancestry_id AS race_ancestry_id,
        ao.obj ->> 'label' AS label,
        ao.obj ->> 'description' AS description,
        COALESCE(NULLIF (ao.obj ->> 'position', '')::int, rao.position, ao.ord) AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'ancestry' -> 'options', '[]'::jsonb))
        WITH ORDINALITY AS ao (obj, ord)
        LEFT JOIN public.race_ancestry_options rao ON rao.id = (ao.obj ->> 'id')::uuid
    ON CONFLICT (id)
        DO UPDATE SET
            race_ancestry_id = excluded.race_ancestry_id,
            label = excluded.label,
            description = excluded.description,
            position = excluded.position;

    -- 🧩 Ancestry Option Features
    WITH ROWS AS (
        SELECT
            (ao ->> 'id')::uuid AS ancestry_option_id,
            (feature.obj ->> 'id')::uuid AS feature_id,
            feature.ord AS position
        FROM
            JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'ancestry' -> 'options', '[]'::jsonb)) AS ao
            CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(COALESCE(ao -> 'features', '[]'::jsonb))
            WITH ORDINALITY AS feature (obj, ord)
        )
    INSERT INTO public.race_ancestry_option_features (ancestry_option_id, feature_id, position)
    SELECT
        ancestry_option_id,
        feature_id,
        position
    FROM
        ROWS
    ON CONFLICT (ancestry_option_id,
        feature_id)
        DO UPDATE SET
            position = excluded.position;

    -- 🧩 Ancestry Option Features
    FOR rec IN
    SELECT
        obj,
        ord::int
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'ancestry' -> 'options', '[]'::jsonb))
        WITH ORDINALITY AS ancestry_option (obj, ord)
        LOOP
            FOR rec2 IN
            SELECT
                obj
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(rec.obj -> 'features', '[]'::jsonb))
        WITH ORDINALITY AS feature (obj)
        LOOP
            PERFORM
                public.upsert_features (rec2.obj);

    END LOOP;

    END LOOP;

    DELETE FROM public.race_ancestry_option_features raf USING JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'ancestry' -> 'options', '[]'::jsonb)) AS ao
        WHERE raf.ancestry_option_id = (ao ->> 'id')::uuid
            AND NOT EXISTS (
                SELECT
                    1
                FROM
                    JSONB_ARRAY_ELEMENTS(COALESCE(ao -> 'features', '[]'::jsonb)) AS feature
                WHERE (feature ->> 'id')::uuid = raf.feature_id);

    DELETE FROM public.race_ancestry_options rao
    WHERE rao.race_ancestry_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'ancestry' -> 'options', '[]')) AS opt_elem
            WHERE (opt_elem ->> 'id')::uuid = rao.id);

    RETURN v_id;
END;
$$;