/***************************
 * TABLES
 ***************************/
CREATE TABLE IF NOT EXISTS public.subfeature_expertise (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    subtype_id uuid REFERENCES public.class_subtypes (id) ON DELETE SET NULL DEFERRABLE,
    selection_count integer,
    category_id uuid NOT NULL REFERENCES public.system_prof_cats (id) ON DELETE CASCADE DEFERRABLE,
    equipment_category_id uuid REFERENCES public.system_equip_opts (id) ON DELETE SET NULL DEFERRABLE,
    use_all boolean DEFAULT FALSE,
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
            tgname = 'trg_subfeature_expertise_updated_at'
            AND tgrelid = 'public.subfeature_expertise'::regclass) THEN
    CREATE TRIGGER trg_subfeature_expertise_updated_at
        BEFORE UPDATE ON public.subfeature_expertise
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_expertise ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subfeature_expertise_attributes (
    subfeature_expertise_id uuid NOT NULL REFERENCES public.subfeature_expertise (id) ON DELETE CASCADE DEFERRABLE,
    attribute_id uuid NOT NULL REFERENCES public.system_attributes (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_expertise_id, attribute_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_expertise_attributes_updated_at'
            AND tgrelid = 'public.subfeature_expertise_attributes'::regclass) THEN
    CREATE TRIGGER trg_subfeature_expertise_attributes_updated_at
        BEFORE UPDATE ON public.subfeature_expertise_attributes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_expertise_attributes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sfe_attr_attr_id ON public.subfeature_expertise_attributes (attribute_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_subfeature_expertise_owned'
            AND tgrelid = 'public.subfeature_expertise'::regclass) THEN
    CREATE TRIGGER trg_cleanup_subfeature_expertise_owned
        AFTER DELETE ON public.subfeature_expertise
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[]' );
END IF;
END;
$$;

-- Bridge: subfeature_expertise ⇄ prerequisites
CREATE TABLE IF NOT EXISTS public.subfeature_expertise_prerequisites (
    subfeature_expertise_id uuid NOT NULL REFERENCES public.subfeature_expertise (id) ON DELETE CASCADE DEFERRABLE,
    prerequisite_id uuid NOT NULL REFERENCES public.prerequisites (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_expertise_id, prerequisite_id)
);

ALTER TABLE IF EXISTS public.subfeature_expertise_prerequisites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sfexp_prereqs_expertise_id ON public.subfeature_expertise_prerequisites (subfeature_expertise_id);

CREATE INDEX IF NOT EXISTS idx_sfexp_prereqs_position ON public.subfeature_expertise_prerequisites (subfeature_expertise_id, position);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_subfeature_expertise_prerequisites_updated_at'
          AND tgrelid = 'public.subfeature_expertise_prerequisites'::regclass
    ) THEN
        CREATE TRIGGER trg_subfeature_expertise_prerequisites_updated_at
        BEFORE UPDATE ON public.subfeature_expertise_prerequisites
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.subfeature_expertise_skills (
    subfeature_expertise_id uuid NOT NULL REFERENCES public.subfeature_expertise (id) ON DELETE CASCADE DEFERRABLE,
    skill_id uuid NOT NULL REFERENCES public.system_skills (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_expertise_id, skill_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_expertise_skills_updated_at'
            AND tgrelid = 'public.subfeature_expertise_skills'::regclass) THEN
    CREATE TRIGGER trg_subfeature_expertise_skills_updated_at
        BEFORE UPDATE ON public.subfeature_expertise_skills
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_expertise_skills ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subfeature_expertise_languages (
    subfeature_expertise_id uuid NOT NULL REFERENCES public.subfeature_expertise (id) ON DELETE CASCADE DEFERRABLE,
    language_id uuid NOT NULL REFERENCES public.system_langs (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_expertise_id, language_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_expertise_languages_updated_at'
            AND tgrelid = 'public.subfeature_expertise_languages'::regclass) THEN
    CREATE TRIGGER trg_subfeature_expertise_languages_updated_at
        BEFORE UPDATE ON public.subfeature_expertise_languages
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_expertise_languages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subfeature_expertise_ability_saves (
    subfeature_expertise_id uuid NOT NULL REFERENCES public.subfeature_expertise (id) ON DELETE CASCADE DEFERRABLE,
    ability_id uuid NOT NULL REFERENCES public.system_abilities (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_expertise_id, ability_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_expertise_ability_saves_updated_at'
            AND tgrelid = 'public.subfeature_expertise_ability_saves'::regclass) THEN
    CREATE TRIGGER trg_subfeature_expertise_ability_saves_updated_at
        BEFORE UPDATE ON public.subfeature_expertise_ability_saves
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_expertise_ability_saves ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subfeature_expertise_equipment_properties (
    subfeature_expertise_id uuid NOT NULL REFERENCES public.subfeature_expertise (id) ON DELETE CASCADE DEFERRABLE,
    property_id uuid NOT NULL REFERENCES public.system_equip_opts (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_expertise_id, property_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_expertise_equipment_properties_updated_at'
            AND tgrelid = 'public.subfeature_expertise_equipment_properties'::regclass) THEN
    CREATE TRIGGER trg_subfeature_expertise_equipment_properties_updated_at
        BEFORE UPDATE ON public.subfeature_expertise_equipment_properties
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_expertise_equipment_properties ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subfeature_expertise_equipment (
    subfeature_expertise_id uuid NOT NULL REFERENCES public.subfeature_expertise (id) ON DELETE CASCADE DEFERRABLE,
    equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_expertise_id, equipment_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_expertise_equipment_updated_at'
            AND tgrelid = 'public.subfeature_expertise_equipment'::regclass) THEN
    CREATE TRIGGER trg_subfeature_expertise_equipment_updated_at
        BEFORE UPDATE ON public.subfeature_expertise_equipment
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_expertise_equipment ENABLE ROW LEVEL SECURITY;


/***************************
 * FUNCTIONS
 ***************************/
CREATE OR REPLACE FUNCTION public.upsert_subfeature_expertise (json_data jsonb)
    RETURNS void
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE
    v_id uuid := (json_data ->> 'id')::uuid;
    v_subtype_id uuid := NULLIF (COALESCE(json_data ->> 'subtypeId', json_data ->> 'subtype'), '')::uuid;
    v_selection_count int := NULLIF (json_data ->> 'selectionCount', '')::int;
    v_category_id uuid := NULLIF (COALESCE(json_data ->> 'categoryId', json_data ->> 'category'), '')::uuid;
    v_equipment_category_id uuid;
    v_use_all boolean := jsonb_has_all (COALESCE(json_data -> 'skillIds', '[]'::jsonb))
        OR jsonb_has_all (COALESCE(json_data -> 'languageIds', '[]'::jsonb))
        OR jsonb_has_all (COALESCE(json_data -> 'saveAbilityIds', '[]'::jsonb))
        OR jsonb_has_all (COALESCE(json_data -> 'properties' -> 'propertyIds', '[]'::jsonb))
        OR jsonb_has_all (COALESCE(json_data -> 'equipment' -> 'equipmentIds', '[]'::jsonb));
BEGIN
    -- Determine equipment_category_id
    IF v_category_id = '3d1075dc-8a5e-419a-90d4-7c2c2c29ff32'::uuid THEN
        v_equipment_category_id := (json_data -> 'properties' ->> 'equipCategoryId')::uuid;

    ELSIF v_category_id = '3d256b38-0c78-4fd6-84a5-94b43c5a024c'::uuid THEN
        v_equipment_category_id :=(json_data -> 'equipment' ->> 'equipCategoryId')::uuid;

    END IF;

    -- 🧩 Prerequisites array → bridge
    IF json_data ? 'prerequisites' AND json_data -> 'prerequisites' IS NOT NULL THEN
        INSERT INTO public.subfeature_expertise_prerequisites (subfeature_expertise_id, prerequisite_id, position)
        SELECT v_id, public.upsert_prerequisites(elem.obj), elem.ord
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'prerequisites', '[]'::jsonb)) WITH ORDINALITY AS elem(obj, ord)
        ON CONFLICT (subfeature_expertise_id, prerequisite_id) DO UPDATE SET position = EXCLUDED.position;

        DELETE FROM public.subfeature_expertise_prerequisites sep
        WHERE sep.subfeature_expertise_id = v_id
          AND NOT EXISTS (
              SELECT 1 FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'prerequisites', '[]'::jsonb)) AS elem
              WHERE sep.prerequisite_id = (elem ->> 'id')::uuid
          );
    END IF;

    -- 🧩 Core
    INSERT INTO public.subfeature_expertise (id, subtype_id, selection_count, category_id, equipment_category_id, use_all)
        VALUES (v_id, v_subtype_id, v_selection_count, v_category_id, v_equipment_category_id, v_use_all)
    ON CONFLICT (id)
        DO UPDATE SET
            subtype_id = EXCLUDED.subtype_id,
            selection_count = EXCLUDED.selection_count,
            category_id = EXCLUDED.category_id,
            equipment_category_id = EXCLUDED.equipment_category_id,
            use_all = EXCLUDED.use_all;

    -- 🧩 Skills
    INSERT INTO public.subfeature_expertise_skills (subfeature_expertise_id, skill_id)
    SELECT
        v_id,
        NULLIF (val, '')::uuid
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'skillIds', json_data -> 'skills', '[]'::jsonb)) AS val
    WHERE
        NOT jsonb_has_all (COALESCE(json_data -> 'skillIds', json_data -> 'skills', '[]'::jsonb))
    ON CONFLICT (subfeature_expertise_id,
        skill_id)
        DO NOTHING;

    DELETE FROM public.subfeature_expertise_skills ss
    WHERE ss.subfeature_expertise_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'skillIds', json_data -> 'skills', '[]'::jsonb)) AS x
            WHERE
                x::uuid = ss.skill_id);

    -- 🧩 Languages
    INSERT INTO public.subfeature_expertise_languages (subfeature_expertise_id, language_id)
    SELECT
        v_id,
        NULLIF (val, '')::uuid
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'languageIds', json_data -> 'languages', '[]'::jsonb)) AS val
    WHERE
        NOT jsonb_has_all (COALESCE(json_data -> 'languageIds', json_data -> 'languages', '[]'::jsonb))
    ON CONFLICT (subfeature_expertise_id,
        language_id)
        DO NOTHING;

    DELETE FROM public.subfeature_expertise_languages sl
    WHERE sl.subfeature_expertise_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'languageIds', json_data -> 'languages', '[]'::jsonb)) AS x
            WHERE
                x::uuid = sl.language_id);

    -- 🧩 Ability saves
    INSERT INTO public.subfeature_expertise_ability_saves (subfeature_expertise_id, ability_id)
    SELECT
        v_id,
        NULLIF (val, '')::uuid
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'saveAbilityIds', json_data -> 'saveAbilities', '[]'::jsonb)) AS val
    WHERE
        NOT jsonb_has_all (COALESCE(json_data -> 'saveAbilityIds', json_data -> 'saveAbilities', '[]'::jsonb))
    ON CONFLICT (subfeature_expertise_id,
        ability_id)
        DO NOTHING;

    DELETE FROM public.subfeature_expertise_ability_saves sa
    WHERE sa.subfeature_expertise_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'saveAbilityIds', json_data -> 'saveAbilities', '[]'::jsonb)) AS x
            WHERE
                x::uuid = sa.ability_id);

    -- 🧩 Properties
    INSERT INTO public.subfeature_expertise_equipment_properties (subfeature_expertise_id, property_id)
    SELECT
        v_id,
        NULLIF (val, '')::uuid
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(
            CASE WHEN v_category_id = '3d1075dc-8a5e-419a-90d4-7c2c2c29ff32'::uuid THEN
                COALESCE(json_data -> 'properties' -> 'propertyIds', json_data -> 'properties' -> 'ids', '[]'::jsonb)
            WHEN v_category_id = '3d256b38-0c78-4fd6-84a5-94b43c5a024c'::uuid THEN
                COALESCE(json_data -> 'equipment' -> 'propertyIds', json_data -> 'equipment' -> 'properties', '[]'::jsonb)
            ELSE
                '[]'::jsonb
            END) AS val
    WHERE
        NOT (
            CASE WHEN v_category_id = '3d1075dc-8a5e-419a-90d4-7c2c2c29ff32'::uuid THEN
                jsonb_has_all (COALESCE(json_data -> 'properties' -> 'propertyIds', json_data -> 'properties' -> 'ids', '[]'::jsonb))
            ELSE
                FALSE
            END)
    ON CONFLICT (subfeature_expertise_id,
        property_id)
        DO NOTHING;

    DELETE FROM public.subfeature_expertise_equipment_properties ep
    WHERE ep.subfeature_expertise_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(
                    CASE WHEN v_category_id = '3d1075dc-8a5e-419a-90d4-7c2c2c29ff32'::uuid THEN
                        COALESCE(json_data -> 'properties' -> 'propertyIds', json_data -> 'properties' -> 'ids', '[]'::jsonb)
                    WHEN v_category_id = '3d256b38-0c78-4fd6-84a5-94b43c5a024c'::uuid THEN
                        COALESCE(json_data -> 'equipment' -> 'propertyIds', json_data -> 'equipment' -> 'properties', '[]'::jsonb)
                    ELSE
                        '[]'::jsonb
                    END) AS x
            WHERE
                x::uuid = ep.property_id);

    -- 🧩 Equipment
    INSERT INTO public.subfeature_expertise_equipment (subfeature_expertise_id, equipment_id)
    SELECT
        v_id,
        NULLIF (val, '')::uuid
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'equipment' -> 'equipmentIds', json_data -> 'equipment' -> 'ids', '[]'::jsonb)) AS val
    WHERE
        v_category_id = '3d256b38-0c78-4fd6-84a5-94b43c5a024c'::uuid
        AND NOT jsonb_has_all (COALESCE(json_data -> 'equipment' -> 'equipmentIds', json_data -> 'equipment' -> 'ids', '[]'::jsonb))
    ON CONFLICT (subfeature_expertise_id,
        equipment_id)
        DO NOTHING;

    DELETE FROM public.subfeature_expertise_equipment eq
    WHERE eq.subfeature_expertise_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'equipment' -> 'equipmentIds', json_data -> 'equipment' -> 'ids', '[]'::jsonb)) AS x
            WHERE
                x::uuid = eq.equipment_id);

    -- 🧩 Attributes bridge
    INSERT INTO public.subfeature_expertise_attributes (subfeature_expertise_id, attribute_id)
    SELECT
        v_id,
        attr::uuid
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'attributeIds', json_data -> 'attributes', '[]'::jsonb)) AS attr
    ON CONFLICT (subfeature_expertise_id,
        attribute_id)
        DO NOTHING;

    DELETE FROM public.subfeature_expertise_attributes sfa
    WHERE sfa.subfeature_expertise_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'attributeIds', json_data -> 'attributes', '[]'::jsonb)) AS x
            WHERE
                x::uuid = sfa.attribute_id);

END
$$;