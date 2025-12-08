/***************************
* TABLES
***************************/
CREATE TABLE IF NOT EXISTS public.backgrounds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE DEFERRABLE,
    is_master boolean NOT NULL DEFAULT FALSE,
    label text NOT NULL,
    starting_equipment_id uuid REFERENCES public.starting_equipment (id) ON DELETE SET NULL DEFERRABLE,
    description text,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backgrounds_system_id ON public.backgrounds (system_id);

CREATE INDEX IF NOT EXISTS idx_backgrounds_user_id ON public.backgrounds (user_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_backgrounds_updated_at'
            AND tgrelid = 'public.backgrounds'::regclass) THEN
    CREATE TRIGGER trg_backgrounds_updated_at
        BEFORE UPDATE ON public.backgrounds
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.backgrounds ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.background_details (
    background_id uuid NOT NULL REFERENCES public.backgrounds (id) ON DELETE CASCADE DEFERRABLE,
    detail_id uuid NOT NULL REFERENCES public.details (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (background_id, detail_id)
);

CREATE INDEX IF NOT EXISTS idx_background_details_detail ON public.background_details (detail_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_background_details_updated_at'
            AND tgrelid = 'public.background_details'::regclass) THEN
    CREATE TRIGGER trg_background_details_updated_at
        BEFORE UPDATE ON public.background_details
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.background_details ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_background_details' 
            AND tgrelid = 'public.background_details'::regclass)  THEN
    CREATE TRIGGER trg_cleanup_background_details
        AFTER DELETE ON public.background_details
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.details", "columns": ["detail_id"] }
      ]' );
END IF;
END;
$$;

SELECT
    public.apply_standard_policies ('backgrounds');

CREATE TABLE IF NOT EXISTS public.background_features (
    background_id uuid NOT NULL REFERENCES public.backgrounds (id) ON DELETE CASCADE DEFERRABLE,
    feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (background_id, feature_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_background_features'
            AND tgrelid = 'public.background_features'::regclass) THEN
    CREATE TRIGGER trg_cleanup_background_features
        AFTER DELETE ON public.background_features
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.features", "columns": ["feature_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_background_features_feature_id ON public.background_features (feature_id);

ALTER TABLE IF EXISTS public.background_features ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_background_features_updated_at'
            AND tgrelid = 'public.background_features'::regclass) THEN
    CREATE TRIGGER trg_background_features_updated_at
        BEFORE UPDATE ON public.background_features
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.background_subfeature_proficiencies (
    background_id uuid NOT NULL REFERENCES public.backgrounds (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_proficiency_id uuid NOT NULL REFERENCES public.subfeature_proficiencies (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (background_id, subfeature_proficiency_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_background_subfeature_proficiencies'
            AND tgrelid = 'public.background_subfeature_proficiencies'::regclass) THEN
    CREATE TRIGGER trg_cleanup_background_subfeature_proficiencies
        AFTER DELETE ON public.background_subfeature_proficiencies
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.subfeature_proficiencies", "columns": ["subfeature_proficiency_id"] }
      ]' );
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_background_subfeature_proficiencies_subfeature_proficiency_id ON public.background_subfeature_proficiencies (subfeature_proficiency_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_background_subfeature_proficiencies_updated_at'
            AND tgrelid = 'public.background_subfeature_proficiencies'::regclass) THEN
    CREATE TRIGGER trg_background_subfeature_proficiencies_updated_at
        BEFORE UPDATE ON public.background_subfeature_proficiencies
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.background_subfeature_proficiencies ENABLE ROW LEVEL SECURITY;

SELECT
    public.apply_standard_policies ('backgrounds');

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_background_owned'
            AND tgrelid = 'public.backgrounds'::regclass) THEN
    CREATE TRIGGER trg_cleanup_background_owned
        AFTER DELETE ON public.backgrounds
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.starting_equipment", "columns": ["starting_equipment_id"] }
      ]' );
END IF;
END;
$$;

/***************************
* FUNCTIONS
***************************/
CREATE OR REPLACE FUNCTION public.upsert_backgrounds (json_data jsonb) RETURNS uuid LANGUAGE plpgsql
SET
    search_path = pg_catalog,
    public AS $$
DECLARE
    v_id uuid := (json_data ->> 'id')::uuid;
    v_system_id uuid := (json_data ->> 'systemId')::uuid;
    v_user_id uuid := CASE
        WHEN (json_data ->> 'userId') = 'master' THEN NULL
        WHEN (json_data ->> 'userId') IS NULL OR (json_data ->> 'userId') = '' THEN NULL
        ELSE (json_data ->> 'userId')::uuid
    END;
    v_label text := NULLIF(json_data ->> 'label', '');
    v_description text := json_data ->> 'description';
    v_starting_equipment_id uuid := COALESCE(
        NULLIF((json_data -> 'startingEquipment' ->> 'id'), '')::uuid,
        NULLIF((json_data -> 'equipment' ->> 'id'), '')::uuid
    );
    v_is_master boolean := (json_data ->> 'userId') = 'master';

    rec RECORD;
BEGIN
    -- 🧩 Upsert starting equipment
    IF json_data ? 'startingEquipment' THEN
        v_starting_equipment_id := public.upsert_starting_equipment(json_data -> 'startingEquipment', v_starting_equipment_id);
    ELSIF json_data ? 'equipment' THEN
        v_starting_equipment_id := public.upsert_starting_equipment(json_data -> 'equipment', v_starting_equipment_id);
    END IF;

    -- 🧩 Upsert main background row
    INSERT INTO public.backgrounds (id, system_id, user_id, label, description, starting_equipment_id, is_master)
    VALUES (v_id, v_system_id, v_user_id, v_label, v_description, v_starting_equipment_id, v_is_master)
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = EXCLUDED.description,
            starting_equipment_id = EXCLUDED.starting_equipment_id;

    -- 🧩 Details
    WITH parsed_details AS (
        SELECT
            COALESCE((det.obj ->> 'id')::uuid, gen_random_uuid()) AS id,
            det.obj ->> 'label' AS label,
            det.obj ->> 'description' AS description,
            det.ord AS position
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'details', '[]'::jsonb))
             WITH ORDINALITY AS det(obj, ord)
    ),
    inserted_details AS (
        INSERT INTO public.details (id, label, description)
        SELECT id, label, description
        FROM parsed_details
        ON CONFLICT (id)
            DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description
        RETURNING id
    )
    INSERT INTO public.background_details (background_id, detail_id, position)
    SELECT v_id, pd.id, pd.position
    FROM parsed_details pd
    JOIN inserted_details idt USING (id)
    ON CONFLICT (background_id, detail_id)
        DO UPDATE SET position = EXCLUDED.position;

    -- 🧩 Delete removed details
    DELETE FROM public.background_details bd
    WHERE bd.background_id = v_id
      AND NOT EXISTS (
          SELECT 1
          FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'details', '[]'::jsonb)) AS det
          WHERE (det ->> 'id')::uuid = bd.detail_id
      );

    -- 🧩 Features linkage
    WITH rows AS (
        SELECT
            v_id AS background_id,
            (feature.obj ->> 'id')::uuid AS feature_id,
            feature.ord AS position
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'features', '[]'::jsonb))
             WITH ORDINALITY AS feature(obj, ord)
    )
    INSERT INTO public.background_features (background_id, feature_id, position)
    SELECT background_id, feature_id, position
    FROM rows
    ON CONFLICT (background_id, feature_id)
        DO UPDATE SET position = EXCLUDED.position;

    -- 🧩 Upsert features
    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'features', '[]'::jsonb))
             WITH ORDINALITY AS feature(obj)
    LOOP
        PERFORM public.upsert_features(rec.obj);
    END LOOP;

    -- 🧩 Cleanup orphaned feature links
    DELETE FROM public.background_features bf
    WHERE bf.background_id = v_id
      AND NOT EXISTS (
          SELECT 1
          FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'features', '[]'::jsonb)) AS feature
          WHERE (feature ->> 'id')::uuid = bf.feature_id
      );
    
    INSERT INTO public.background_subfeature_proficiencies (background_id, subfeature_proficiency_id, position)
    SELECT
        v_id AS background_id,
        (proficiency.obj ->> 'id')::uuid AS subfeature_proficiency_id,
        proficiency.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'proficiencies', '[]'::jsonb))
        WITH ORDINALITY AS proficiency (obj, ord)
        ON CONFLICT (background_id, subfeature_proficiency_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'proficiencies', '[]'::jsonb))
             WITH ORDINALITY AS proficiency(obj)
    LOOP
        PERFORM public.upsert_subfeature_proficiencies (rec.obj);

    END LOOP;

    DELETE FROM public.background_subfeature_proficiencies bsp
    WHERE bsp.background_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'proficiencies', '[]'::jsonb)) AS proficiency(obj)
            WHERE (proficiency.obj ->> 'id')::uuid = bsp.subfeature_proficiency_id);

    RETURN v_id;
END;
$$;