/***************************
 * TABLES
 ***************************/
 CREATE TABLE IF NOT EXISTS public.subfeature_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    label text,
    description text,
    detail text,
    category_id uuid REFERENCES public.system_categories (id) ON DELETE SET NULL DEFERRABLE,
    save_dc_id uuid REFERENCES public.save_dc (id) ON DELETE SET NULL DEFERRABLE,
    damage_id uuid REFERENCES public.damages (id) ON DELETE SET NULL DEFERRABLE,
    charge_id uuid REFERENCES public.charges (id) ON DELETE SET NULL DEFERRABLE,
    range_id uuid REFERENCES public.characteristics (id) ON DELETE SET NULL DEFERRABLE,
    shape_id uuid REFERENCES public.characteristics (id) ON DELETE SET NULL DEFERRABLE,
    action_id uuid REFERENCES public.actions (id) ON DELETE SET NULL DEFERRABLE,
    targets integer,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subfeature_options_category_id ON public.subfeature_options (category_id);

CREATE INDEX IF NOT EXISTS idx_subfeature_options_save_dc_id ON public.subfeature_options (save_dc_id);

CREATE INDEX IF NOT EXISTS idx_subfeature_options_damage_id ON public.subfeature_options (damage_id);

CREATE INDEX IF NOT EXISTS idx_subfeature_options_charge_id ON public.subfeature_options (charge_id);

CREATE INDEX IF NOT EXISTS idx_subfeature_options_range_id ON public.subfeature_options (range_id);

CREATE INDEX IF NOT EXISTS idx_subfeature_options_shape_id ON public.subfeature_options (shape_id);

CREATE INDEX IF NOT EXISTS idx_subfeature_options_action_id ON public.subfeature_options (action_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_options_updated_at'
            AND tgrelid = 'public.subfeature_options'::regclass) THEN
    CREATE TRIGGER trg_subfeature_options_updated_at
        BEFORE UPDATE ON public.subfeature_options
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.subfeature_option_attributes (
    subfeature_option_id uuid NOT NULL REFERENCES public.subfeature_options (id) ON DELETE CASCADE DEFERRABLE,
    attribute_id uuid NOT NULL REFERENCES public.system_attributes (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_option_id, attribute_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_option_attributes_updated_at'
            AND tgrelid = 'public.subfeature_option_attributes'::regclass) THEN
    CREATE TRIGGER trg_subfeature_option_attributes_updated_at
        BEFORE UPDATE ON public.subfeature_option_attributes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_option_attributes ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.subfeature_options ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_subfeature_option_owned'
            AND tgrelid = 'public.subfeature_options'::regclass) THEN
    CREATE TRIGGER trg_cleanup_subfeature_option_owned
        AFTER DELETE ON public.subfeature_options
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.actions", "columns": ["action_id"] },
        { "table": "public.characteristics", "columns": ["range_id", "duration_id", "shape_id"] },
        { "table": "public.damages", "columns": ["damage_id"] },
        { "table": "public.save_dc", "columns": ["save_dc_id"] },
        { "table": "public.charges", "columns": ["charge_id"] }
      ]' );
END IF;
END;
$$;

-- Bridge: subfeature_options ⇄ prerequisites
CREATE TABLE IF NOT EXISTS public.subfeature_option_prerequisites (
    subfeature_option_id uuid NOT NULL REFERENCES public.subfeature_options (id) ON DELETE CASCADE DEFERRABLE,
    prerequisite_id uuid NOT NULL REFERENCES public.prerequisites (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_option_id, prerequisite_id)
);

ALTER TABLE IF EXISTS public.subfeature_option_prerequisites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sop_prereqs_option_id ON public.subfeature_option_prerequisites (subfeature_option_id);

CREATE INDEX IF NOT EXISTS idx_sop_prereqs_position ON public.subfeature_option_prerequisites (subfeature_option_id, position);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_subfeature_option_prerequisites_updated_at'
          AND tgrelid = 'public.subfeature_option_prerequisites'::regclass
    ) THEN
        CREATE TRIGGER trg_subfeature_option_prerequisites_updated_at
        BEFORE UPDATE ON public.subfeature_option_prerequisites
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.subfeature_option_subfeature_expertise (
    subfeature_option_id uuid NOT NULL REFERENCES public.subfeature_options (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_expertise_id uuid NOT NULL REFERENCES public.subfeature_expertise (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_option_id, subfeature_expertise_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_subfeature_option_subfeature_expertise'
            AND tgrelid = 'public.subfeature_option_subfeature_expertise'::regclass) THEN
    CREATE TRIGGER trg_cleanup_subfeature_option_subfeature_expertise
        AFTER DELETE ON public.subfeature_option_subfeature_expertise
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.subfeature_expertise", "columns": ["subfeature_expertise_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_subfeature_option_subfeature_expertise_subfeature_expertise_id ON public.subfeature_option_subfeature_expertise (subfeature_expertise_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_option_subfeature_expertise_updated_at'
            AND tgrelid = 'public.subfeature_option_subfeature_expertise'::regclass) THEN
    CREATE TRIGGER trg_subfeature_option_subfeature_expertise_updated_at
        BEFORE UPDATE ON public.subfeature_option_subfeature_expertise
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_option_subfeature_expertise ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subfeature_option_subfeature_proficiencies (
    subfeature_option_id uuid NOT NULL REFERENCES public.subfeature_options (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_proficiency_id uuid NOT NULL REFERENCES public.subfeature_proficiencies (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_option_id, subfeature_proficiency_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_subfeature_option_subfeature_proficiencies'
            AND tgrelid = 'public.subfeature_option_subfeature_proficiencies'::regclass) THEN
    CREATE TRIGGER trg_cleanup_subfeature_option_subfeature_proficiencies
        AFTER DELETE ON public.subfeature_option_subfeature_proficiencies
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.subfeature_proficiencies", "columns": ["subfeature_proficiency_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_subfeature_option_subfeature_proficiencies_subfeature_proficiency_id ON public.subfeature_option_subfeature_proficiencies (subfeature_proficiency_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_option_subfeature_proficiencies_updated_at'
            AND tgrelid = 'public.subfeature_option_subfeature_proficiencies'::regclass) THEN
    CREATE TRIGGER trg_subfeature_option_subfeature_proficiencies_updated_at
        BEFORE UPDATE ON public.subfeature_option_subfeature_proficiencies
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_option_subfeature_proficiencies ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subfeature_option_subfeature_modifiers (
    subfeature_option_id uuid NOT NULL REFERENCES public.subfeature_options (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_modifier_id uuid NOT NULL REFERENCES public.subfeature_modifiers (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_option_id, subfeature_modifier_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_subfeature_option_subfeature_modifiers'
            AND tgrelid = 'public.subfeature_option_subfeature_modifiers'::regclass) THEN
    CREATE TRIGGER trg_cleanup_subfeature_option_subfeature_modifiers
        AFTER DELETE ON public.subfeature_option_subfeature_modifiers
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.subfeature_modifiers", "columns": ["subfeature_modifier_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_subfeature_option_subfeature_modifiers_subfeature_modifier_id ON public.subfeature_option_subfeature_modifiers (subfeature_modifier_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_option_subfeature_modifiers_updated_at'
            AND tgrelid = 'public.subfeature_option_subfeature_modifiers'::regclass) THEN
    CREATE TRIGGER trg_subfeature_option_subfeature_modifiers_updated_at
        BEFORE UPDATE ON public.subfeature_option_subfeature_modifiers
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_option_subfeature_modifiers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subfeature_option_subfeature_spells (
    subfeature_option_id uuid NOT NULL REFERENCES public.subfeature_options (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_spell_id uuid NOT NULL REFERENCES public.subfeature_spells (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_option_id, subfeature_spell_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_subfeature_option_subfeature_spells'
            AND tgrelid = 'public.subfeature_option_subfeature_spells'::regclass) THEN
    CREATE TRIGGER trg_cleanup_subfeature_option_subfeature_spells
        AFTER DELETE ON public.subfeature_option_subfeature_spells
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.subfeature_spells", "columns": ["subfeature_spell_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_subfeature_option_subfeature_spells_subfeature_spell_id ON public.subfeature_option_subfeature_spells (subfeature_spell_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_option_subfeature_spells_updated_at'
            AND tgrelid = 'public.subfeature_option_subfeature_spells'::regclass) THEN
    CREATE TRIGGER trg_subfeature_option_subfeature_spells_updated_at
        BEFORE UPDATE ON public.subfeature_option_subfeature_spells
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_option_subfeature_spells ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subfeature_option_subfeature_senses (
    subfeature_option_id uuid NOT NULL REFERENCES public.subfeature_options (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_sense_id uuid NOT NULL REFERENCES public.subfeature_senses (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_option_id, subfeature_sense_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_subfeature_option_subfeature_senses'
            AND tgrelid = 'public.subfeature_option_subfeature_senses'::regclass) THEN
    CREATE TRIGGER trg_cleanup_subfeature_option_subfeature_senses
        AFTER DELETE ON public.subfeature_option_subfeature_senses
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.subfeature_senses", "columns": ["subfeature_sense_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_subfeature_option_subfeature_senses_subfeature_sense_id ON public.subfeature_option_subfeature_senses (subfeature_sense_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_option_subfeature_senses_updated_at'
            AND tgrelid = 'public.subfeature_option_subfeature_senses'::regclass) THEN
    CREATE TRIGGER trg_subfeature_option_subfeature_senses_updated_at
        BEFORE UPDATE ON public.subfeature_option_subfeature_senses
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_option_subfeature_senses ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subfeature_option_subfeature_feats (
    subfeature_option_id uuid NOT NULL REFERENCES public.subfeature_options (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_feat_id uuid NOT NULL REFERENCES public.subfeature_feats (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_option_id, subfeature_feat_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_subfeature_option_subfeature_feats'
            AND tgrelid = 'public.subfeature_option_subfeature_feats'::regclass) THEN
    CREATE TRIGGER trg_cleanup_subfeature_option_subfeature_feats
        AFTER DELETE ON public.subfeature_option_subfeature_feats
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.subfeature_feats", "columns": ["subfeature_feat_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_subfeature_option_subfeature_feats_subfeature_feat_id ON public.subfeature_option_subfeature_feats (subfeature_feat_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_option_subfeature_feats_updated_at'
            AND tgrelid = 'public.subfeature_option_subfeature_feats'::regclass) THEN
    CREATE TRIGGER trg_subfeature_option_subfeature_feats_updated_at
        BEFORE UPDATE ON public.subfeature_option_subfeature_feats
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_option_subfeature_feats ENABLE ROW LEVEL SECURITY;

/***************************
 * FUNCTIONS
 ***************************/ 
CREATE OR REPLACE FUNCTION public.upsert_subfeature_options (json_data jsonb)
    RETURNS void
    LANGUAGE plpgsql
    SET
        search_path = pg_catalog, public
    AS
        $$
DECLARE
    v_id uuid := (json_data ->> 'id')::uuid;
    v_label text := NULLIF (json_data ->> 'label', '');
    v_description text := json_data ->> 'description';
    v_detail text := json_data ->> 'detail';
    v_category_id uuid := NULLIF (COALESCE(json_data ->> 'categoryId', json_data ->> 'category'), '')::uuid;
    v_targets int := NULLIF (json_data ->> 'targets', '')::int;
    v_save_dc_id uuid := NULLIF (json_data -> 'saveDc' ->> 'id', '')::uuid;
    v_damage_id uuid := NULLIF (json_data -> 'damage' ->> 'id', '')::uuid;
    v_charge_id uuid := NULLIF (json_data -> 'charges' ->> 'id', '')::uuid;
    v_action_id uuid := COALESCE(NULLIF (json_data -> 'action' ->> 'id', '')::uuid, NULLIF (json_data -> 'actions' ->> 'id', '')::uuid);
    v_range_id uuid := NULLIF (json_data -> 'range' ->> 'id', '')::uuid;
    v_shape_id uuid := NULLIF (json_data -> 'shape' ->> 'id', '')::uuid;
    rec RECORD;
BEGIN
    -- child upserts (assign to local vars)
    IF json_data ? 'saveDc' THEN
        v_save_dc_id := upsert_save_dc (json_data -> 'saveDc', v_save_dc_id);

    END IF;

    IF json_data ? 'damage' THEN
        v_damage_id := upsert_damages (json_data -> 'damage', v_damage_id);

    END IF;

    IF json_data ? 'charges' THEN
        v_charge_id := upsert_charges (json_data -> 'charges', v_charge_id);

    END IF;

    -- prerequisites array → bridge
    IF json_data ? 'prerequisites' AND json_data -> 'prerequisites' IS NOT NULL THEN
        INSERT INTO public.subfeature_option_prerequisites (subfeature_option_id, prerequisite_id, position)
        SELECT
            v_id,
            public.upsert_prerequisites(elem.obj),
            elem.ord
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'prerequisites', '[]'::jsonb)) WITH ORDINALITY AS elem(obj, ord)
        ON CONFLICT (subfeature_option_id, prerequisite_id)
            DO UPDATE SET position = EXCLUDED.position;

        DELETE FROM public.subfeature_option_prerequisites sop
        WHERE sop.subfeature_option_id = v_id
          AND NOT EXISTS (
              SELECT 1
              FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'prerequisites', '[]'::jsonb)) AS elem
              WHERE sop.prerequisite_id = (elem ->> 'id')::uuid
          );
    END IF;

    IF json_data ? 'actions' THEN
        v_action_id := upsert_actions (json_data -> 'actions', v_action_id);
    ELSIF json_data ? 'action' THEN
        v_action_id := upsert_actions (json_data -> 'action', v_action_id);

    END IF;

    IF json_data ? 'range' THEN
        v_range_id := upsert_ranges (json_data -> 'range', v_range_id);

    END IF;

    IF json_data ? 'shape' THEN
        v_shape_id := upsert_shapes (json_data -> 'shape', v_shape_id);

    END IF;

    -- Upsert canonical subfeature_options
    INSERT INTO public.subfeature_options (id, label, description, detail, category_id, save_dc_id, damage_id, charge_id, range_id, shape_id, action_id, targets)
        VALUES (v_id, v_label, v_description, v_detail, v_category_id, v_save_dc_id, v_damage_id, v_charge_id, v_range_id, v_shape_id, v_action_id, v_targets)
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = EXCLUDED.description,
            detail = EXCLUDED.detail,
            category_id = EXCLUDED.category_id,
            save_dc_id = EXCLUDED.save_dc_id,
            damage_id = EXCLUDED.damage_id,
            charge_id = EXCLUDED.charge_id,
            range_id = EXCLUDED.range_id,
            shape_id = EXCLUDED.shape_id,
            action_id = EXCLUDED.action_id,
            targets = EXCLUDED.targets;

    -- Attributes bridge (attributeIds with legacy fallback)
    INSERT INTO public.subfeature_option_attributes (subfeature_option_id, attribute_id)
    SELECT v_id, NULLIF(val, '')::uuid
    FROM JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'attributeIds', json_data -> 'attributes', '[]'::jsonb)) AS val
    ON CONFLICT (subfeature_option_id, attribute_id) DO NOTHING;

    DELETE FROM public.subfeature_option_attributes soa
    WHERE soa.subfeature_option_id = v_id
      AND NOT EXISTS (
        SELECT 1
        FROM JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'attributeIds', json_data -> 'attributes', '[]'::jsonb)) AS x
        WHERE x::uuid = soa.attribute_id
      );

    -- 🧩 Proficiencies
    INSERT INTO public.subfeature_option_subfeature_proficiencies (subfeature_option_id, subfeature_proficiency_id, position)
    SELECT
        v_id AS subfeature_option_id,
        (proficiency.obj ->> 'id')::uuid AS subfeature_proficiency_id,
        proficiency.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'proficiencies', '[]'::jsonb))
        WITH ORDINALITY AS proficiency (obj, ord)
        ON CONFLICT (subfeature_option_id, subfeature_proficiency_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'proficiencies', '[]'::jsonb))
             WITH ORDINALITY AS proficiency(obj)
    LOOP
        PERFORM public.upsert_subfeature_proficiencies (rec.obj);

    END LOOP;

    DELETE FROM public.subfeature_option_subfeature_proficiencies sosp
    WHERE sosp.subfeature_option_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'proficiencies', '[]'::jsonb)) AS proficiency(obj)
            WHERE (proficiency.obj ->> 'id')::uuid = sosp.subfeature_proficiency_id);
            
    -- 🧩 Expertise
    INSERT INTO public.subfeature_option_subfeature_expertise (subfeature_option_id, subfeature_expertise_id, position)
    SELECT
        v_id AS subfeature_option_id,
        (expertise.obj ->> 'id')::uuid AS subfeature_expertise_id,
        expertise.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'expertise', '[]'::jsonb))
        WITH ORDINALITY AS expertise (obj, ord)
        ON CONFLICT (subfeature_option_id, subfeature_expertise_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'expertise', '[]'::jsonb))
             WITH ORDINALITY AS expertise(obj)
    LOOP
        PERFORM public.upsert_subfeature_expertise (rec.obj);

    END LOOP;

    DELETE FROM public.subfeature_option_subfeature_expertise sose
    WHERE sose.subfeature_option_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'expertise', '[]'::jsonb)) AS expertise(obj)
            WHERE (expertise.obj ->> 'id')::uuid = sose.subfeature_expertise_id);
            
    -- 🧩 Modifiers
    INSERT INTO public.subfeature_option_subfeature_modifiers (subfeature_option_id, subfeature_modifier_id, position)
    SELECT
        v_id AS subfeature_option_id,
        (modifier.obj ->> 'id')::uuid AS subfeature_modifier_id,
        modifier.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'modifiers', '[]'::jsonb))
        WITH ORDINALITY AS modifier (obj, ord)
        ON CONFLICT (subfeature_option_id, subfeature_modifier_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'modifiers', '[]'::jsonb))
             WITH ORDINALITY AS modifier(obj)
    LOOP
        PERFORM public.upsert_subfeature_modifiers (rec.obj);

    END LOOP;

    DELETE FROM public.subfeature_option_subfeature_modifiers sosm
    WHERE sosm.subfeature_option_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'modifiers', '[]'::jsonb)) AS modifier(obj)
            WHERE (modifier.obj ->> 'id')::uuid = sosm.subfeature_modifier_id);
            
    -- 🧩 Spells
    INSERT INTO public.subfeature_option_subfeature_spells (subfeature_option_id, subfeature_spell_id, position)
    SELECT
        v_id AS subfeature_option_id,
        (spell.obj ->> 'id')::uuid AS subfeature_spell_id,
        spell.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spells', '[]'::jsonb))
        WITH ORDINALITY AS spell (obj, ord)
        ON CONFLICT (subfeature_option_id, subfeature_spell_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spells', '[]'::jsonb))
             WITH ORDINALITY AS spell(obj)
    LOOP
        PERFORM public.upsert_subfeature_spells (rec.obj);

    END LOOP;

    DELETE FROM public.subfeature_option_subfeature_spells soss
    WHERE soss.subfeature_option_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spells', '[]'::jsonb)) AS spell(obj)
            WHERE (spell.obj ->> 'id')::uuid = soss.subfeature_spell_id);
            
    -- 🧩 Senses
    INSERT INTO public.subfeature_option_subfeature_senses (subfeature_option_id, subfeature_sense_id, position)
    SELECT
        v_id AS subfeature_option_id,
        (sense.obj ->> 'id')::uuid AS subfeature_sense_id,
        sense.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'senses', '[]'::jsonb))
        WITH ORDINALITY AS sense (obj, ord)
        ON CONFLICT (subfeature_option_id, subfeature_sense_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'senses', '[]'::jsonb))
             WITH ORDINALITY AS sense(obj)
    LOOP
        PERFORM public.upsert_subfeature_senses (rec.obj);

    END LOOP;

    DELETE FROM public.subfeature_option_subfeature_senses soss
    WHERE soss.subfeature_option_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'senses', '[]'::jsonb)) AS sense(obj)
            WHERE (sense.obj ->> 'id')::uuid = soss.subfeature_sense_id);

    -- 🧩 Feats
    INSERT INTO public.subfeature_option_subfeature_feats (subfeature_option_id, subfeature_feat_id, position)
    SELECT
        v_id AS subfeature_option_id,
        (feat.obj ->> 'id')::uuid AS subfeature_feat_id,
        feat.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'feats', '[]'::jsonb))
        WITH ORDINALITY AS feat (obj, ord)
        ON CONFLICT (subfeature_option_id, subfeature_feat_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'feats', '[]'::jsonb))
             WITH ORDINALITY AS feat(obj)
    LOOP
        PERFORM public.upsert_subfeature_feats (rec.obj);

    END LOOP;

    DELETE FROM public.subfeature_option_subfeature_feats sofs
    WHERE sofs.subfeature_option_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'feats', '[]'::jsonb)) AS feat(obj)
            WHERE (feat.obj ->> 'id')::uuid = sofs.subfeature_feat_id);

END;
$$;