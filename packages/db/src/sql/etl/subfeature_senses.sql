/***************************
 * TABLES
 ***************************/
CREATE TABLE IF NOT EXISTS public.subfeature_senses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    subtype_id uuid REFERENCES public.class_subtypes (id) ON DELETE SET NULL DEFERRABLE,
    selection_count integer,
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
            tgname = 'trg_subfeature_senses_updated_at'
            AND tgrelid = 'public.subfeature_senses'::regclass) THEN
    CREATE TRIGGER trg_subfeature_senses_updated_at
        BEFORE UPDATE ON public.subfeature_senses
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_senses ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subfeature_sense_attributes (
    subfeature_sense_id uuid NOT NULL REFERENCES public.subfeature_senses (id) ON DELETE CASCADE DEFERRABLE,
    attribute_id uuid NOT NULL REFERENCES public.system_attributes (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_sense_id, attribute_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_sense_attributes_updated_at'
            AND tgrelid = 'public.subfeature_sense_attributes'::regclass) THEN
    CREATE TRIGGER trg_subfeature_sense_attributes_updated_at
        BEFORE UPDATE ON public.subfeature_sense_attributes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_sense_attributes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sfs_attr_attr_id ON public.subfeature_sense_attributes (attribute_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_subfeature_sense_owned'
            AND tgrelid = 'public.subfeature_senses'::regclass) THEN
    CREATE TRIGGER trg_cleanup_subfeature_sense_owned
        AFTER DELETE ON public.subfeature_senses
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[]' );
END IF;
END;
$$;

-- Bridge: subfeature_senses ⇄ prerequisites
CREATE TABLE IF NOT EXISTS public.subfeature_sense_prerequisites (
    subfeature_sense_id uuid NOT NULL REFERENCES public.subfeature_senses (id) ON DELETE CASCADE DEFERRABLE,
    prerequisite_id uuid NOT NULL REFERENCES public.prerequisites (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_sense_id, prerequisite_id)
);

ALTER TABLE IF EXISTS public.subfeature_sense_prerequisites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sfse_prereqs_sense_id ON public.subfeature_sense_prerequisites (subfeature_sense_id);

CREATE INDEX IF NOT EXISTS idx_sfse_prereqs_position ON public.subfeature_sense_prerequisites (subfeature_sense_id, position);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_subfeature_sense_prerequisites_updated_at'
          AND tgrelid = 'public.subfeature_sense_prerequisites'::regclass
    ) THEN
        CREATE TRIGGER trg_subfeature_sense_prerequisites_updated_at
        BEFORE UPDATE ON public.subfeature_sense_prerequisites
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.subfeature_sense_senses (
    subfeature_sense_id uuid NOT NULL REFERENCES public.subfeature_senses (id) ON DELETE CASCADE DEFERRABLE,
    sense_id uuid NOT NULL REFERENCES public.system_senses (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_sense_id, sense_id)
);

ALTER TABLE IF EXISTS public.subfeature_sense_senses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_sense_senses_updated_at'
            AND tgrelid = 'public.subfeature_sense_senses'::regclass) THEN
    CREATE TRIGGER trg_subfeature_sense_senses_updated_at
        BEFORE UPDATE ON public.subfeature_sense_senses
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_sfs_sense_id ON public.subfeature_sense_senses (sense_id);


/***************************
 * FUNCTIONS
 ***************************/ 
CREATE OR REPLACE FUNCTION public.upsert_subfeature_senses (json_data jsonb)
    RETURNS void
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE
    v_id uuid := (json_data ->> 'id')::uuid;
    v_subtype_id uuid := NULLIF (COALESCE(json_data ->> 'subtypeId', json_data ->> 'subtype'), '')::uuid;
    v_selection_count int := NULLIF (json_data ->> 'selectionCount', '')::int;
    v_use_all boolean := jsonb_has_all (COALESCE(json_data -> 'senseIds', json_data -> 'senses', '[]'::jsonb));
BEGIN
    -- Prerequisites array → bridge
    IF json_data ? 'prerequisites' AND json_data -> 'prerequisites' IS NOT NULL THEN
        INSERT INTO public.subfeature_sense_prerequisites (subfeature_sense_id, prerequisite_id, position)
        SELECT v_id, public.upsert_prerequisites(elem.obj), elem.ord
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'prerequisites', '[]'::jsonb)) WITH ORDINALITY AS elem(obj, ord)
        ON CONFLICT (subfeature_sense_id, prerequisite_id) DO UPDATE SET position = EXCLUDED.position;

        DELETE FROM public.subfeature_sense_prerequisites ssp
        WHERE ssp.subfeature_sense_id = v_id
          AND NOT EXISTS (
              SELECT 1 FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'prerequisites', '[]'::jsonb)) AS elem
              WHERE ssp.prerequisite_id = (elem ->> 'id')::uuid
          );
    END IF;
    -- Main upsert
    INSERT INTO public.subfeature_senses (id, subtype_id, selection_count, use_all)
        VALUES (v_id, v_subtype_id, v_selection_count, v_use_all)
    ON CONFLICT (id)
        DO UPDATE SET
            subtype_id = EXCLUDED.subtype_id,
            selection_count = EXCLUDED.selection_count,
            use_all = EXCLUDED.use_all;
    -- Bridge table: senses
    INSERT INTO public.subfeature_sense_senses (subfeature_sense_id, sense_id)
    SELECT
        v_id,
        NULLIF (val, '')::uuid
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'senseIds', json_data -> 'senses', '[]'::jsonb)) AS val
WHERE
    NOT jsonb_has_all (COALESCE(json_data -> 'senseIds', json_data -> 'senses', '[]'::jsonb))
ON CONFLICT (subfeature_sense_id,
    sense_id)
    DO NOTHING;

    DELETE FROM public.subfeature_sense_senses sss
    WHERE sss.subfeature_sense_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'senseIds', json_data -> 'senses', '[]'::jsonb)) AS x
            WHERE
                x::uuid = sss.sense_id);
    -- Bridge table: attributes
    INSERT INTO public.subfeature_sense_attributes (subfeature_sense_id, attribute_id)
    SELECT
        v_id,
        NULLIF (val, '')::uuid
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'attributeIds', json_data -> 'attributes', '[]'::jsonb)) AS val
WHERE
    NOT jsonb_has_all (COALESCE(json_data -> 'attributeIds', json_data -> 'attributes', '[]'::jsonb))
ON CONFLICT (subfeature_sense_id,
    attribute_id)
    DO NOTHING;

    DELETE FROM public.subfeature_sense_attributes ssa
    WHERE ssa.subfeature_sense_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'attributeIds', json_data -> 'attributes', '[]'::jsonb)) AS x
            WHERE
                x::uuid = ssa.attribute_id);

END
$$;