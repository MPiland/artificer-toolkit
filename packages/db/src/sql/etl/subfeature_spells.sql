/***************************
 * TABLES
 ***************************/
CREATE TABLE IF NOT EXISTS public.subfeature_spells (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    subtype_id uuid,
    selection_count integer,
    ability_id uuid,
    spell_level integer,
    charge_id uuid REFERENCES public.charges (id) ON DELETE SET NULL DEFERRABLE,
    use_all boolean NOT NULL DEFAULT FALSE,
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
            tgname = 'trg_subfeature_spells_updated_at'
            AND tgrelid = 'public.subfeature_spells'::regclass) THEN
    CREATE TRIGGER trg_subfeature_spells_updated_at
        BEFORE UPDATE ON public.subfeature_spells
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_spells ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_subfeature_spell_owned'
            AND tgrelid = 'public.subfeature_spells'::regclass) THEN
    CREATE TRIGGER trg_cleanup_subfeature_spell_owned
        AFTER DELETE ON public.subfeature_spells
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.charges", "columns": ["charge_id"] }
      ]' );
END IF;
END;
$$;

-- Bridge: subfeature_spells ⇄ prerequisites
CREATE TABLE IF NOT EXISTS public.subfeature_spell_prerequisites (
    subfeature_spell_id uuid NOT NULL REFERENCES public.subfeature_spells (id) ON DELETE CASCADE DEFERRABLE,
    prerequisite_id uuid NOT NULL REFERENCES public.prerequisites (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_spell_id, prerequisite_id)
);

ALTER TABLE IF EXISTS public.subfeature_spell_prerequisites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sfsp_prereqs_spell_id ON public.subfeature_spell_prerequisites (subfeature_spell_id);

CREATE INDEX IF NOT EXISTS idx_sfsp_prereqs_position ON public.subfeature_spell_prerequisites (subfeature_spell_id, position);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_subfeature_spell_prerequisites_updated_at'
          AND tgrelid = 'public.subfeature_spell_prerequisites'::regclass
    ) THEN
        CREATE TRIGGER trg_subfeature_spell_prerequisites_updated_at
        BEFORE UPDATE ON public.subfeature_spell_prerequisites
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.subfeature_spell_attributes (
    subfeature_spell_id uuid NOT NULL REFERENCES public.subfeature_spells (id) ON DELETE CASCADE DEFERRABLE,
    attribute_id uuid NOT NULL REFERENCES public.system_attributes (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_spell_id, attribute_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_spell_attributes_updated_at'
            AND tgrelid = 'public.subfeature_spell_attributes'::regclass) THEN
    CREATE TRIGGER trg_subfeature_spell_attributes_updated_at
        BEFORE UPDATE ON public.subfeature_spell_attributes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_spell_attributes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subfeature_spell_class_limits (
    subfeature_spell_id uuid NOT NULL REFERENCES public.subfeature_spells (id) ON DELETE CASCADE DEFERRABLE,
    class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_spell_id, class_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_spell_class_limits_updated_at'
            AND tgrelid = 'public.subfeature_spell_class_limits'::regclass) THEN
    CREATE TRIGGER trg_subfeature_spell_class_limits_updated_at
        BEFORE UPDATE ON public.subfeature_spell_class_limits
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_spell_class_limits ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subfeature_spell_attribute_limits (
    subfeature_spell_id uuid NOT NULL REFERENCES public.subfeature_spells (id) ON DELETE CASCADE DEFERRABLE,
    attribute_id uuid NOT NULL REFERENCES public.system_attributes (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_spell_id, attribute_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_spell_attribute_limits_updated_at'
            AND tgrelid = 'public.subfeature_spell_attribute_limits'::regclass) THEN
    CREATE TRIGGER trg_subfeature_spell_attribute_limits_updated_at
        BEFORE UPDATE ON public.subfeature_spell_attribute_limits
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_spell_attribute_limits ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subfeature_spell_level_limits (
    subfeature_spell_id uuid NOT NULL REFERENCES public.subfeature_spells (id) ON DELETE CASCADE DEFERRABLE,
    level integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_spell_id, level)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_spell_level_limits_updated_at'
            AND tgrelid = 'public.subfeature_spell_level_limits'::regclass) THEN
    CREATE TRIGGER trg_subfeature_spell_level_limits_updated_at
        BEFORE UPDATE ON public.subfeature_spell_level_limits
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_spell_level_limits ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subfeature_spell_spells (
    subfeature_spell_id uuid NOT NULL REFERENCES public.subfeature_spells (id) ON DELETE CASCADE DEFERRABLE,
    spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_spell_id, spell_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_spell_spells_updated_at'
            AND tgrelid = 'public.subfeature_spell_spells'::regclass) THEN
    CREATE TRIGGER trg_subfeature_spell_spells_updated_at
        BEFORE UPDATE ON public.subfeature_spell_spells
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_spell_spells ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subfeature_spell_by_level (
    subfeature_spell_id uuid NOT NULL REFERENCES public.subfeature_spells (id) ON DELETE CASCADE DEFERRABLE,
    level integer NOT NULL,
    spell_level integer,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_spell_id, level)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_spell_by_level_updated_at'
            AND tgrelid = 'public.subfeature_spell_by_level'::regclass) THEN
    CREATE TRIGGER trg_subfeature_spell_by_level_updated_at
        BEFORE UPDATE ON public.subfeature_spell_by_level
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_spell_by_level ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sfs_attr_attr_id ON public.subfeature_spell_attributes (attribute_id);

CREATE INDEX IF NOT EXISTS idx_sfs_cl_class_id ON public.subfeature_spell_class_limits (class_id);

CREATE INDEX IF NOT EXISTS idx_sfs_al_attr_id ON public.subfeature_spell_attribute_limits (attribute_id);

CREATE INDEX IF NOT EXISTS idx_sfs_lvl_level ON public.subfeature_spell_level_limits (level);

CREATE INDEX IF NOT EXISTS idx_sfs_spells_spell_id ON public.subfeature_spell_spells (spell_id);

-- removed: idx_sbl_spell_id (spell_id moved to child table)

CREATE TABLE IF NOT EXISTS public.subfeature_spell_by_level_spells (
    subfeature_spell_id uuid NOT NULL,
    level integer NOT NULL,
    spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_spell_id, level, spell_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_spell_by_level_spells_updated_at'
            AND tgrelid = 'public.subfeature_spell_by_level_spells'::regclass) THEN
    CREATE TRIGGER trg_subfeature_spell_by_level_spells_updated_at
        BEFORE UPDATE ON public.subfeature_spell_by_level_spells
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_spell_by_level_spells ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sfsbl_spell_id ON public.subfeature_spell_by_level_spells (spell_id);

CREATE INDEX IF NOT EXISTS idx_sfsbl_subfeature_spell_id ON public.subfeature_spell_by_level_spells (subfeature_spell_id);

CREATE INDEX IF NOT EXISTS idx_sfsbl_level ON public.subfeature_spell_by_level_spells (level);

/***************************
 * FUNCTIONS
 ***************************/ 
CREATE OR REPLACE FUNCTION public.upsert_subfeature_spells (json_data jsonb)
    RETURNS void
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE
    v_id uuid := (json_data ->> 'id')::uuid;
    v_subtype_id uuid := NULLIF (COALESCE(json_data ->> 'subtypeId', json_data ->> 'subtype_id'), '')::uuid;
    v_selection_count int := NULLIF (COALESCE(json_data ->> 'selectionCount', json_data ->> 'selection_count'), '')::int;
    v_ability_id uuid := NULLIF (COALESCE(json_data ->> 'abilityId', json_data ->> 'ability_id'), '')::uuid;
    v_spell_level int := NULLIF (COALESCE(json_data ->> 'spellLevel', json_data ->> 'spell_level'), '')::int;
    v_charge_id uuid := NULLIF (json_data -> 'charges' ->> 'id', '')::uuid;
    v_use_all boolean := jsonb_has_all (COALESCE(json_data -> 'spellIds', json_data -> 'spells'));
BEGIN
    -- Prerequisites array → bridge
    IF json_data ? 'prerequisites' AND json_data -> 'prerequisites' IS NOT NULL THEN
        INSERT INTO public.subfeature_spell_prerequisites (subfeature_spell_id, prerequisite_id, position)
        SELECT v_id, public.upsert_prerequisites(elem.obj), elem.ord
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'prerequisites', '[]'::jsonb)) WITH ORDINALITY AS elem(obj, ord)
        ON CONFLICT (subfeature_spell_id, prerequisite_id) DO UPDATE SET position = EXCLUDED.position;

        DELETE FROM public.subfeature_spell_prerequisites ssp
        WHERE ssp.subfeature_spell_id = v_id
          AND NOT EXISTS (
              SELECT 1 FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'prerequisites', '[]'::jsonb)) AS elem
              WHERE ssp.prerequisite_id = (elem ->> 'id')::uuid
          );
    END IF;

    -- Charges
    IF json_data ? 'charges' THEN
        v_charge_id := upsert_charges (json_data -> 'charges', v_charge_id);

    END IF;

    -- Main upsert
    INSERT INTO public.subfeature_spells (id, subtype_id, selection_count, ability_id, spell_level, charge_id, use_all)
        VALUES (v_id, v_subtype_id, v_selection_count, v_ability_id, v_spell_level, v_charge_id, v_use_all)
    ON CONFLICT (id)
        DO UPDATE SET
            subtype_id = EXCLUDED.subtype_id,
            selection_count = EXCLUDED.selection_count,
            ability_id = EXCLUDED.ability_id,
            spell_level = EXCLUDED.spell_level,
            charge_id = EXCLUDED.charge_id,
            use_all = EXCLUDED.use_all;

    -- Attributes (blueprint: attributeIds)
    INSERT INTO public.subfeature_spell_attributes (subfeature_spell_id, attribute_id)
    SELECT
        v_id,
        NULLIF (val, '')::uuid
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'attributeIds', json_data -> 'attributes', '[]'::jsonb)) AS val
    ON CONFLICT (subfeature_spell_id,
        attribute_id)
        DO NOTHING;

    DELETE FROM public.subfeature_spell_attributes sfa
    WHERE sfa.subfeature_spell_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'attributeIds', json_data -> 'attributes', '[]'::jsonb)) AS x
            WHERE
                x::uuid = sfa.attribute_id);

    -- Filters.classIds (legacy: class_limit)
    INSERT INTO public.subfeature_spell_class_limits (subfeature_spell_id, class_id)
    SELECT
        v_id,
        NULLIF (val, '')::uuid
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'filters' -> 'classIds', json_data -> 'class_limit', '[]'::jsonb)) AS val
    ON CONFLICT (subfeature_spell_id,
        class_id)
        DO NOTHING;

    DELETE FROM public.subfeature_spell_class_limits scl
    WHERE scl.subfeature_spell_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'filters' -> 'classIds', json_data -> 'class_limit', '[]'::jsonb)) AS x
            WHERE
                x::uuid = scl.class_id);

    -- Filters.attributeIds (legacy: attribute_limit)
    INSERT INTO public.subfeature_spell_attribute_limits (subfeature_spell_id, attribute_id)
    SELECT
        v_id,
        NULLIF (val, '')::uuid
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'filters' -> 'attributeIds', json_data -> 'attribute_limit', '[]'::jsonb)) AS val
    ON CONFLICT (subfeature_spell_id,
        attribute_id)
        DO NOTHING;

    DELETE FROM public.subfeature_spell_attribute_limits sal
    WHERE sal.subfeature_spell_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'filters' -> 'attributeIds', json_data -> 'attribute_limit', '[]'::jsonb)) AS x
            WHERE
                x::uuid = sal.attribute_id);

    -- Filters.levelIds (legacy: level_limit)
    INSERT INTO public.subfeature_spell_level_limits (subfeature_spell_id, level)
    SELECT
        v_id,
        val::int
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'filters' -> 'levels', json_data -> 'level_limit', '[]'::jsonb)) AS val
    ON CONFLICT (subfeature_spell_id,
        level)
        DO NOTHING;

    DELETE FROM public.subfeature_spell_level_limits sl
    WHERE sl.subfeature_spell_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'filters' -> 'levels', json_data -> 'level_limit', '[]'::jsonb)) AS x
            WHERE
                x::int = sl.level);

    -- Direct spellIds (legacy: spells)
    INSERT INTO public.subfeature_spell_spells (subfeature_spell_id, spell_id)
    SELECT
        v_id,
        NULLIF (val, '')::uuid
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'spellIds', json_data -> 'spells', '[]'::jsonb)) AS val
    WHERE NOT jsonb_has_all(COALESCE(json_data -> 'spellIds', json_data -> 'spells'))
    ON CONFLICT (subfeature_spell_id,
        spell_id)
        DO NOTHING;

    DELETE FROM public.subfeature_spell_spells ss
    WHERE ss.subfeature_spell_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'spellIds', json_data -> 'spells', '[]'::jsonb)) AS x
            WHERE
                x::uuid = ss.spell_id);

    -- Spells by level (parent rows per level, child rows per spell)
    INSERT INTO public.subfeature_spell_by_level (subfeature_spell_id, level, spell_level)
    SELECT
        v_id,
        (entry ->> 'level')::int,
        NULLIF(entry ->> 'spellLevel', '')::int
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spellsByLevel', json_data -> 'spells_by_level', '[]'::jsonb)) AS entry
    ON CONFLICT (subfeature_spell_id, level)
        DO UPDATE SET spell_level = EXCLUDED.spell_level;

    INSERT INTO public.subfeature_spell_by_level_spells (subfeature_spell_id, level, spell_id)
    SELECT
        v_id,
        (entry ->> 'level')::int,
        sid::uuid
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spellsByLevel', json_data -> 'spells_by_level', '[]'::jsonb)) AS entry
        CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(entry -> 'spellIds', entry -> 'spells')) AS sid
    ON CONFLICT (subfeature_spell_id, level, spell_id)
        DO NOTHING;

    DELETE FROM public.subfeature_spell_by_level sb
    WHERE sb.subfeature_spell_id = v_id
      AND NOT EXISTS (
        SELECT 1
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spellsByLevel', json_data -> 'spells_by_level', '[]'::jsonb)) AS entry
        WHERE (entry ->> 'level')::int = sb.level
      );

    DELETE FROM public.subfeature_spell_by_level_spells sbls
    WHERE sbls.subfeature_spell_id = v_id
      AND NOT EXISTS (
        SELECT 1
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spellsByLevel', json_data -> 'spells_by_level', '[]'::jsonb)) AS entry
        CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(entry -> 'spellIds', entry -> 'spells')) AS sid
        WHERE (entry ->> 'level')::int = sbls.level
          AND sid::uuid = sbls.spell_id
      );

END
$$;