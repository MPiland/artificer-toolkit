/***************************
 * TABLES
 ***************************/
CREATE TABLE IF NOT EXISTS public.subfeature_feats (
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
            tgname = 'trg_subfeature_feats_updated_at'
            AND tgrelid = 'public.subfeature_feats'::regclass) THEN
    CREATE TRIGGER trg_subfeature_feats_updated_at
        BEFORE UPDATE ON public.subfeature_feats
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_feats ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subfeature_feat_feats (
    subfeature_feat_id uuid NOT NULL REFERENCES public.subfeature_feats (id) ON DELETE CASCADE DEFERRABLE,
    feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_feat_id, feat_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_feat_feats_updated_at'
            AND tgrelid = 'public.subfeature_feat_feats'::regclass) THEN
    CREATE TRIGGER trg_subfeature_feat_feats_updated_at
        BEFORE UPDATE ON public.subfeature_feat_feats
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_feat_feats ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subfeature_feat_attributes (
    subfeature_feat_id uuid NOT NULL REFERENCES public.subfeature_feats (id) ON DELETE CASCADE,
    attribute_id uuid NOT NULL REFERENCES public.system_attributes (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_feat_id, attribute_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_feat_attributes_updated_at'
            AND tgrelid = 'public.subfeature_feat_attributes'::regclass) THEN
    CREATE TRIGGER trg_subfeature_feat_attributes_updated_at
        BEFORE UPDATE ON public.subfeature_feat_attributes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_feat_attributes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_subfeature_feat_owned'
            AND tgrelid = 'public.subfeature_feats'::regclass) THEN
    CREATE TRIGGER trg_cleanup_subfeature_feat_owned
        AFTER DELETE ON public.subfeature_feats
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        -- removed: prerequisites cleanup handled by bridge table now
      ]' );
END IF;
END;
$$;

-- Bridge: subfeature_feats ⇄ prerequisites
CREATE TABLE IF NOT EXISTS public.subfeature_feat_prerequisites (
    subfeature_feat_id uuid NOT NULL REFERENCES public.subfeature_feats (id) ON DELETE CASCADE DEFERRABLE,
    prerequisite_id uuid NOT NULL REFERENCES public.prerequisites (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_feat_id, prerequisite_id)
);

ALTER TABLE IF EXISTS public.subfeature_feat_prerequisites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sff_prereqs_feat_id ON public.subfeature_feat_prerequisites (subfeature_feat_id);

CREATE INDEX IF NOT EXISTS idx_sff_prereqs_position ON public.subfeature_feat_prerequisites (subfeature_feat_id, position);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_subfeature_feat_prerequisites_updated_at'
          AND tgrelid = 'public.subfeature_feat_prerequisites'::regclass
    ) THEN
        CREATE TRIGGER trg_subfeature_feat_prerequisites_updated_at
        BEFORE UPDATE ON public.subfeature_feat_prerequisites
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
    END IF;
END;
$$;


/***************************
 * FUNCTIONS
 ***************************/
CREATE OR REPLACE FUNCTION public.upsert_subfeature_feats (json_data jsonb)
    RETURNS void
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE
    v_id uuid := (json_data ->> 'id')::uuid;
    v_subtype_id uuid := NULLIF (json_data ->> 'subtype', '')::uuid;
    v_selection_count int := NULLIF (json_data ->> 'selectionCount', '')::int;
    v_use_all boolean := jsonb_has_all (COALESCE(json_data -> 'feats', '[]'::jsonb));
BEGIN
    -- Prerequisites array → bridge
    IF json_data ? 'prerequisites' AND json_data -> 'prerequisites' IS NOT NULL THEN
        INSERT INTO public.subfeature_feat_prerequisites (subfeature_feat_id, prerequisite_id, position)
        SELECT v_id, public.upsert_prerequisites(elem.obj), elem.ord
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'prerequisites', '[]'::jsonb)) WITH ORDINALITY AS elem(obj, ord)
        ON CONFLICT (subfeature_feat_id, prerequisite_id) DO UPDATE SET position = EXCLUDED.position;

        DELETE FROM public.subfeature_feat_prerequisites sfp
        WHERE sfp.subfeature_feat_id = v_id
          AND NOT EXISTS (
              SELECT 1 FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'prerequisites', '[]'::jsonb)) AS elem
              WHERE sfp.prerequisite_id = (elem ->> 'id')::uuid
          );
    END IF;

    -- Main upsert
    INSERT INTO public.subfeature_feats (id, subtype_id, selection_count, use_all)
        VALUES (v_id, v_subtype_id, v_selection_count, v_use_all)
    ON CONFLICT (id)
        DO UPDATE SET
            subtype_id = EXCLUDED.subtype_id,
            selection_count = EXCLUDED.selection_count,
            use_all = EXCLUDED.use_all;

    -- Attributes bridge (blueprint: attributeIds)
    INSERT INTO public.subfeature_feat_attributes (subfeature_feat_id, attribute_id)
    SELECT
        v_id,
        attr::uuid
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'attributeIds', json_data -> 'attributes', '[]'::jsonb)) AS attr
    ON CONFLICT (subfeature_feat_id,
        attribute_id)
        DO NOTHING;

    DELETE FROM public.subfeature_feat_attributes sfa
    WHERE sfa.subfeature_feat_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'attributeIds', json_data -> 'attributes', '[]'::jsonb)) AS x
            WHERE
                x::uuid = sfa.attribute_id);

    -- Feats bridge (blueprint: featIds)
    INSERT INTO public.subfeature_feat_feats (subfeature_feat_id, feat_id)
    SELECT
        v_id,
        fid::uuid
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'featIds', json_data -> 'feats', '[]'::jsonb)) AS fid
    WHERE
        NOT jsonb_has_all (COALESCE(json_data -> 'featIds', json_data -> 'feats', '[]'::jsonb))
    ON CONFLICT (subfeature_feat_id,
        feat_id)
        DO NOTHING;

    DELETE FROM public.subfeature_feat_feats sf
    WHERE sf.subfeature_feat_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'featIds', json_data -> 'feats', '[]'::jsonb)) AS x
            WHERE
                x::uuid = sf.feat_id);
END
$$;