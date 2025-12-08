/***************************
 * TABLES
 ***************************/
-- 🧩 Core
CREATE TABLE IF NOT EXISTS public.spells (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    label text NOT NULL,
    description text NOT NULL,
    level integer NOT NULL,
    school_id uuid NOT NULL REFERENCES public.system_spell_opts (id) ON DELETE CASCADE DEFERRABLE,
    action_id uuid NOT NULL REFERENCES public.actions (id) ON DELETE SET NULL DEFERRABLE,
    range_id uuid NOT NULL REFERENCES public.characteristics (id) ON DELETE SET NULL DEFERRABLE,
    duration_id uuid NOT NULL REFERENCES public.characteristics (id) ON DELETE SET NULL DEFERRABLE,
    shape_id uuid REFERENCES public.characteristics (id) ON DELETE SET NULL DEFERRABLE,
    damage_id uuid REFERENCES public.damages (id) ON DELETE SET NULL DEFERRABLE,
    save_dc_id uuid REFERENCES public.save_dc (id) ON DELETE SET NULL DEFERRABLE,
    targets integer,
    is_ritual boolean DEFAULT FALSE,
    is_concentration boolean DEFAULT FALSE,
    material_description text,
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE DEFERRABLE,
    is_master boolean NOT NULL DEFAULT FALSE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spells_system_id ON public.spells (system_id);

CREATE INDEX IF NOT EXISTS idx_spells_school_id ON public.spells (school_id);

CREATE INDEX IF NOT EXISTS idx_spells_level ON public.spells (level);

CREATE INDEX IF NOT EXISTS idx_spells_user_id ON public.spells (user_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_spells_updated_at'
            AND tgrelid = 'public.spells'::regclass) THEN
    CREATE TRIGGER trg_spells_updated_at
        BEFORE UPDATE ON public.spells
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.spells ENABLE ROW LEVEL SECURITY;

-- 🧩 Classes
CREATE TABLE IF NOT EXISTS public.spell_classes (
    spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE CASCADE DEFERRABLE,
    class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (spell_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_spell_classes_class ON public.spell_classes (class_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_spell_classes_updated_at'
            AND tgrelid = 'public.spell_classes'::regclass) THEN
    CREATE TRIGGER trg_spell_classes_updated_at
        BEFORE UPDATE ON public.spell_classes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.spell_classes ENABLE ROW LEVEL SECURITY;

-- 🧩 Attributes
CREATE TABLE IF NOT EXISTS public.spell_attributes (
    spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE CASCADE DEFERRABLE,
    attribute_id uuid NOT NULL REFERENCES public.system_attributes (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (spell_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS idx_spell_attributes_attribute ON public.spell_attributes (attribute_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_spell_attributes_updated_at'
            AND tgrelid = 'public.spell_attributes'::regclass) THEN
    CREATE TRIGGER trg_spell_attributes_updated_at
        BEFORE UPDATE ON public.spell_attributes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.spell_attributes ENABLE ROW LEVEL SECURITY;

-- 🧩 Requirements
CREATE TABLE IF NOT EXISTS public.spell_requirements (
    spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE CASCADE DEFERRABLE,
    requirement_id uuid NOT NULL REFERENCES public.system_spell_opts (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (spell_id, requirement_id)
);

CREATE INDEX IF NOT EXISTS idx_spell_requirements_req ON public.spell_requirements (requirement_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_spell_requirements_updated_at'
            AND tgrelid = 'public.spell_requirements'::regclass) THEN
    CREATE TRIGGER trg_spell_requirements_updated_at
        BEFORE UPDATE ON public.spell_requirements
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.spell_requirements ENABLE ROW LEVEL SECURITY;

-- 🧩 Conditions
CREATE TABLE IF NOT EXISTS public.spell_conditions (
    spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE CASCADE DEFERRABLE,
    condition_id uuid NOT NULL REFERENCES public.system_conditions (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (spell_id, condition_id)
);

CREATE INDEX IF NOT EXISTS idx_spell_conditions_condition ON public.spell_conditions (condition_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_spell_conditions_updated_at'
            AND tgrelid = 'public.spell_conditions'::regclass) THEN
    CREATE TRIGGER trg_spell_conditions_updated_at
        BEFORE UPDATE ON public.spell_conditions
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.spell_conditions ENABLE ROW LEVEL SECURITY;

-- 🧩 Upcast attributes
CREATE TABLE IF NOT EXISTS public.spell_upcast_attributes (
    spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE CASCADE DEFERRABLE,
    attribute_id uuid NOT NULL REFERENCES public.system_attributes (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (spell_id, attribute_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_spell_upcast_attributes_updated_at'
            AND tgrelid = 'public.spell_upcast_attributes'::regclass) THEN
    CREATE TRIGGER trg_spell_upcast_attributes_updated_at
        BEFORE UPDATE ON public.spell_upcast_attributes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.spell_upcast_attributes ENABLE ROW LEVEL SECURITY;

-- 🧩 Upcast levels
CREATE TABLE IF NOT EXISTS public.spell_upcast_levels (
    spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE CASCADE DEFERRABLE,
    level integer NOT NULL,
    damage_id uuid REFERENCES public.damages (id) ON DELETE SET NULL DEFERRABLE,
    duration_id uuid REFERENCES public.characteristics (id) ON DELETE SET NULL DEFERRABLE,
    range_id uuid REFERENCES public.characteristics (id) ON DELETE SET NULL DEFERRABLE,
    shape_id uuid REFERENCES public.characteristics (id) ON DELETE SET NULL DEFERRABLE,
    targets integer,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (spell_id, level)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_spell_upcast_levels_updated_at'
            AND tgrelid = 'public.spell_upcast_levels'::regclass) THEN
    CREATE TRIGGER trg_spell_upcast_levels_updated_at
        BEFORE UPDATE ON public.spell_upcast_levels
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.spell_upcast_levels ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_spell_owned'
            AND tgrelid = 'public.spells'::regclass) THEN
    CREATE TRIGGER trg_cleanup_spell_owned
        AFTER DELETE ON public.spells
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.actions", "columns": ["action_id"] },
        { "table": "public.characteristics", "columns": ["range_id", "duration_id", "shape_id"] },
        { "table": "public.damages", "columns": ["damage_id"] },
        { "table": "public.save_dc", "columns": ["save_dc_id"] }
      ]' );
END IF;
END;
$$;

-- Apply standard owner policies to top-level table
SELECT
    public.apply_standard_policies ('spells');


/***************************
 * FUNCTIONS
 ***************************/
CREATE OR REPLACE FUNCTION public.upsert_spells (json_data jsonb)
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
    v_description text := json_data ->> 'description';
    v_level int := NULLIF (json_data ->> 'level', '')::int;
    v_school_id uuid := NULLIF (COALESCE(json_data ->> 'schoolId', json_data ->> 'school'), '')::uuid;
    v_action_id uuid := NULLIF (json_data -> 'actions' ->> 'id', '')::uuid;
    v_range_id uuid := NULLIF (json_data -> 'range' ->> 'id', '')::uuid;
    v_duration_id uuid := NULLIF (json_data -> 'duration' ->> 'id', '')::uuid;
    v_shape_id uuid := NULLIF (json_data -> 'shape' ->> 'id', '')::uuid;
    v_damage_id uuid := NULLIF (json_data -> 'damage' ->> 'id', '')::uuid;
    v_save_dc_id uuid := NULLIF (json_data -> 'saveDc' ->> 'id', '')::uuid;
    v_targets int := NULLIF (json_data ->> 'targets', '')::int;
    v_is_master boolean := CASE WHEN json_data ->> 'masterId' = 'master' THEN TRUE ELSE FALSE END;
    v_material_description text := json_data ->> 'materialDescription';
BEGIN
    IF json_data ? 'actions' THEN
        v_action_id := upsert_actions (json_data -> 'actions', v_action_id);

    END IF;

    IF json_data ? 'range' THEN
        v_range_id := upsert_ranges (json_data -> 'range', v_range_id);

    END IF;

    IF json_data ? 'duration' THEN
        v_duration_id := upsert_durations (json_data -> 'duration', v_duration_id);

    END IF;

    IF json_data ? 'shape' THEN
        v_shape_id := upsert_shapes (json_data -> 'shape', v_shape_id);

    END IF;

    IF json_data ? 'damage' THEN
        v_damage_id := upsert_damages (json_data -> 'damage', v_damage_id);

    END IF;

    IF json_data ? 'saveDc' THEN
        v_save_dc_id := upsert_save_dc (json_data -> 'saveDc', v_save_dc_id);

    END IF;

    -- 🧩 Core
    INSERT INTO public.spells (id, system_id, user_id, label, description, level, school_id, action_id, range_id, duration_id, shape_id, damage_id, save_dc_id, targets, is_master)
        VALUES (v_id, v_system_id, v_user_id, v_label, v_description, v_level, v_school_id, v_action_id, v_range_id, v_duration_id, v_shape_id, v_damage_id, v_save_dc_id, v_targets, v_is_master)
    ON CONFLICT (id)
        DO UPDATE SET
            system_id = EXCLUDED.system_id,
            label = EXCLUDED.label,
            description = EXCLUDED.description,
            level = EXCLUDED.level,
            school_id = EXCLUDED.school_id,
            action_id = EXCLUDED.action_id,
            range_id = EXCLUDED.range_id,
            duration_id = EXCLUDED.duration_id,
            shape_id = EXCLUDED.shape_id,
            damage_id = EXCLUDED.damage_id,
            save_dc_id = EXCLUDED.save_dc_id,
            targets = EXCLUDED.targets,
            is_master = EXCLUDED.is_master;

    -- 🧩 Classes
    INSERT INTO public.spell_classes (spell_id, class_id)
    SELECT
        v_id,
        NULLIF (cl, '')::uuid AS class_id
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'classIds', json_data -> 'classes', '[]'::jsonb)) AS cl
    ON CONFLICT (spell_id,
        class_id)
        DO NOTHING;

    DELETE FROM public.spell_classes sc
    WHERE v_id = sc.spell_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'classIds', json_data -> 'classes', '[]'::jsonb)) AS cl
            WHERE
                cl::uuid = sc.class_id);

    -- 🧩 Attributes
    INSERT INTO public.spell_attributes (spell_id, attribute_id)
    SELECT
        v_id,
        attribute::uuid AS attribute_id
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'attributeIds', json_data -> 'attributes', '[]'::jsonb)) AS attribute
    ON CONFLICT (spell_id,
        attribute_id)
        DO NOTHING;

    DELETE FROM public.spell_attributes sa
    WHERE v_id = sa.spell_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'attributeIds', json_data -> 'attributes', '[]'::jsonb)) AS attribute
            WHERE
                attribute::uuid = sa.attribute_id);

    -- 🧩 Requirements
    INSERT INTO public.spell_requirements (spell_id, requirement_id)
    SELECT
        v_id,
        requirement::uuid AS requirement_id
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'requirementIds', json_data -> 'requirements', '[]'::jsonb)) AS requirement
    ON CONFLICT (spell_id,
        requirement_id)
        DO NOTHING;

    DELETE FROM public.spell_requirements sr
    WHERE v_id = sr.spell_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'requirementIds', json_data -> 'requirements', '[]'::jsonb)) AS requirement
            WHERE
                requirement::uuid = sr.requirement_id);

    -- 🧩 Conditions
    INSERT INTO public.spell_conditions (spell_id, condition_id)
    SELECT
        v_id,
        condition::uuid AS condition_id
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'conditionIds', json_data -> 'conditions', '[]'::jsonb)) AS condition
    ON CONFLICT (spell_id,
        condition_id)
        DO NOTHING;

    DELETE FROM public.spell_conditions sc
    WHERE v_id = sc.spell_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'conditionIds', json_data -> 'conditions', '[]'::jsonb)) AS condition
            WHERE
                condition::uuid = sc.condition_id);

    -- 🧩 Upcast.attributes
    INSERT INTO public.spell_upcast_attributes (spell_id, attribute_id)
    SELECT
        v_id,
        attribute::uuid AS attribute_id
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'upcast' -> 'attributeIds', '[]'::jsonb)) AS attribute
    ON CONFLICT (spell_id,
        attribute_id)
        DO NOTHING;

    DELETE FROM public.spell_upcast_attributes sua
    WHERE v_id = sua.spell_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'upcast' -> 'attributeIds', '[]'::jsonb)) AS attribute
            WHERE
                attribute::uuid = sua.attribute_id);

    -- 🧩 Upcast.levels
    DROP TABLE IF EXISTS tmp_spell_upcast_levels;

    CREATE TEMP TABLE tmp_spell_upcast_levels AS
    SELECT
        v_id AS spell_id,
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'upcast' -> 'levels', '[]'::jsonb)) AS lvl;

    WITH ROWS AS (
        SELECT
            u.spell_id,
            NULLIF (lvl ->> 'level', '')::int AS level,
            upsert_damages (lvl -> 'damage', sul.damage_id) AS damage_id,
            upsert_durations (lvl -> 'duration', sul.duration_id) AS duration_id,
            upsert_ranges (lvl -> 'range', sul.range_id) AS range_id,
            upsert_shapes (lvl -> 'shape', sul.shape_id) AS shape_id,
            NULLIF (lvl ->> 'targets', '')::int AS targets
        FROM
            tmp_spell_upcast_levels u
            LEFT JOIN public.spell_upcast_levels sul ON sul.spell_id = u.spell_id
                AND sul.level = NULLIF (lvl ->> 'level', '')::int)
        INSERT INTO public.spell_upcast_levels (spell_id, level, damage_id, duration_id, range_id, shape_id, targets)
        SELECT
            spell_id,
            level,
            damage_id,
            duration_id,
            range_id,
            shape_id,
            targets
        FROM
            ROWS
    WHERE
        level IS NOT NULL
    ON CONFLICT (spell_id,
        level)
        DO UPDATE SET
            damage_id = EXCLUDED.damage_id,
            duration_id = EXCLUDED.duration_id,
            range_id = EXCLUDED.range_id,
            shape_id = EXCLUDED.shape_id,
            targets = EXCLUDED.targets;

    -- 🧩 Upcast.levels (delete old)
    DELETE FROM public.spell_upcast_levels sul
    WHERE sul.level IS NOT NULL
        AND sul.spell_id = v_id
        AND sul.level NOT IN (
            SELECT
                (lvl ->> 'level')::int
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'upcast' -> 'levels', '[]'::jsonb)) AS lvl
            WHERE
                lvl ->> 'level' IS NOT NULL);

    RETURN v_id;
END
$$;