/***************************
 * TABLES
 ***************************/
CREATE TABLE IF NOT EXISTS public.features (
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

CREATE INDEX IF NOT EXISTS idx_features_category_id ON public.features (category_id);

CREATE INDEX IF NOT EXISTS idx_features_save_dc_id ON public.features (save_dc_id);

CREATE INDEX IF NOT EXISTS idx_features_damage_id ON public.features (damage_id);

CREATE INDEX IF NOT EXISTS idx_features_charge_id ON public.features (charge_id);

CREATE INDEX IF NOT EXISTS idx_features_range_id ON public.features (range_id);

CREATE INDEX IF NOT EXISTS idx_features_shape_id ON public.features (shape_id);

CREATE INDEX IF NOT EXISTS idx_features_action_id ON public.features (action_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_features_updated_at'
            AND tgrelid = 'public.features'::regclass) THEN
    CREATE TRIGGER trg_features_updated_at
        BEFORE UPDATE ON public.features
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.features ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.feature_levels (
    feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
    level integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (feature_id, level)
);

CREATE INDEX IF NOT EXISTS idx_feature_levels_feature_id ON public.feature_levels (feature_id);

CREATE INDEX IF NOT EXISTS idx_feature_levels_level ON public.feature_levels (level);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_feature_levels_updated_at'
            AND tgrelid = 'public.feature_levels'::regclass) THEN
    CREATE TRIGGER trg_feature_levels_updated_at
        BEFORE UPDATE ON public.feature_levels
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.feature_levels ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.feature_attributes (
    feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
    attribute_id uuid NOT NULL REFERENCES public.system_attributes (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (feature_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS idx_feature_attributes_attr_id ON public.feature_attributes (attribute_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_feature_attributes_updated_at'
            AND tgrelid = 'public.feature_attributes'::regclass) THEN
    CREATE TRIGGER trg_feature_attributes_updated_at
        BEFORE UPDATE ON public.feature_attributes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.feature_attributes ENABLE ROW LEVEL SECURITY;

-- Bridge: features ⇄ prerequisites (many-to-many)
CREATE TABLE IF NOT EXISTS public.feature_prerequisites (
    feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
    prerequisite_id uuid NOT NULL REFERENCES public.prerequisites (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (feature_id, prerequisite_id)
);

ALTER TABLE IF EXISTS public.feature_prerequisites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feature_prereqs_feature_id ON public.feature_prerequisites (feature_id);

CREATE INDEX IF NOT EXISTS idx_feature_prereqs_position ON public.feature_prerequisites (feature_id, position);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_feature_prerequisites_updated_at'
          AND tgrelid = 'public.feature_prerequisites'::regclass) THEN
    CREATE TRIGGER trg_feature_prerequisites_updated_at
        BEFORE UPDATE ON public.feature_prerequisites
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.feature_subfeature_options_by_level (
    feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
    level integer NOT NULL DEFAULT 1,
    count integer NOT NULL DEFAULT 1,
    replace_count integer,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (feature_id, level)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_feature_subfeature_options_by_level_updated_at'
            AND tgrelid = 'public.feature_subfeature_options_by_level'::regclass) THEN
    CREATE TRIGGER trg_feature_subfeature_options_by_level_updated_at
        BEFORE UPDATE ON public.feature_subfeature_options_by_level
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.feature_subfeature_options_by_level ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_feature_owned'
            AND tgrelid = 'public.features'::regclass) THEN
    CREATE TRIGGER trg_cleanup_feature_owned
        AFTER DELETE ON public.features
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

CREATE TABLE IF NOT EXISTS public.feature_subfeature_options (
    feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_option_id uuid NOT NULL REFERENCES public.subfeature_options (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (feature_id, subfeature_option_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_feature_subfeature_options'
            AND tgrelid = 'public.feature_subfeature_options'::regclass) THEN
    CREATE TRIGGER trg_cleanup_feature_subfeature_options
        AFTER DELETE ON public.feature_subfeature_options
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.subfeature_options", "columns": ["subfeature_option_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_feature_subfeature_options_subfeature_option_id ON public.feature_subfeature_options (subfeature_option_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_feature_subfeature_options_updated_at'
            AND tgrelid = 'public.feature_subfeature_options'::regclass) THEN
    CREATE TRIGGER trg_feature_subfeature_options_updated_at
        BEFORE UPDATE ON public.feature_subfeature_options
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.feature_subfeature_options ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.feature_subfeature_expertise (
    feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_expertise_id uuid NOT NULL REFERENCES public.subfeature_expertise (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (feature_id, subfeature_expertise_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_feature_subfeature_expertise'
            AND tgrelid = 'public.feature_subfeature_expertise'::regclass) THEN
    CREATE TRIGGER trg_cleanup_feature_subfeature_expertise
        AFTER DELETE ON public.feature_subfeature_expertise
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.subfeature_expertise", "columns": ["subfeature_expertise_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_feature_subfeature_expertise_subfeature_expertise_id ON public.feature_subfeature_expertise (subfeature_expertise_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_feature_subfeature_expertise_updated_at'
            AND tgrelid = 'public.feature_subfeature_expertise'::regclass) THEN
    CREATE TRIGGER trg_feature_subfeature_expertise_updated_at
        BEFORE UPDATE ON public.feature_subfeature_expertise
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.feature_subfeature_expertise ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.feature_subfeature_proficiencies (
    feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_proficiency_id uuid NOT NULL REFERENCES public.subfeature_proficiencies (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (feature_id, subfeature_proficiency_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_feature_subfeature_proficiencies'
            AND tgrelid = 'public.feature_subfeature_proficiencies'::regclass) THEN
    CREATE TRIGGER trg_cleanup_feature_subfeature_proficiencies
        AFTER DELETE ON public.feature_subfeature_proficiencies
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.subfeature_proficiencies", "columns": ["subfeature_proficiency_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_feature_subfeature_proficiencies_subfeature_proficiency_id ON public.feature_subfeature_proficiencies (subfeature_proficiency_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_feature_subfeature_proficiencies_updated_at'
            AND tgrelid = 'public.feature_subfeature_proficiencies'::regclass) THEN
    CREATE TRIGGER trg_feature_subfeature_proficiencies_updated_at
        BEFORE UPDATE ON public.feature_subfeature_proficiencies
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.feature_subfeature_proficiencies ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.feature_subfeature_modifiers (
    feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_modifier_id uuid NOT NULL REFERENCES public.subfeature_modifiers (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (feature_id, subfeature_modifier_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_feature_subfeature_modifiers'
            AND tgrelid = 'public.feature_subfeature_modifiers'::regclass) THEN
    CREATE TRIGGER trg_cleanup_feature_subfeature_modifiers
        AFTER DELETE ON public.feature_subfeature_modifiers
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.subfeature_modifiers", "columns": ["subfeature_modifier_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_feature_subfeature_modifiers_subfeature_modifier_id ON public.feature_subfeature_modifiers (subfeature_modifier_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_feature_subfeature_modifiers_updated_at'
            AND tgrelid = 'public.feature_subfeature_modifiers'::regclass) THEN
    CREATE TRIGGER trg_feature_subfeature_modifiers_updated_at
        BEFORE UPDATE ON public.feature_subfeature_modifiers
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.feature_subfeature_modifiers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.feature_subfeature_spells (
    feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_spell_id uuid NOT NULL REFERENCES public.subfeature_spells (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (feature_id, subfeature_spell_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_feature_subfeature_spells'
            AND tgrelid = 'public.feature_subfeature_spells'::regclass) THEN
    CREATE TRIGGER trg_cleanup_feature_subfeature_spells
        AFTER DELETE ON public.feature_subfeature_spells
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.subfeature_spells", "columns": ["subfeature_spell_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_feature_subfeature_spells_subfeature_spell_id ON public.feature_subfeature_spells (subfeature_spell_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_feature_subfeature_spells_updated_at'
            AND tgrelid = 'public.feature_subfeature_spells'::regclass) THEN
    CREATE TRIGGER trg_feature_subfeature_spells_updated_at
        BEFORE UPDATE ON public.feature_subfeature_spells
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.feature_subfeature_spells ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.feature_subfeature_senses (
    feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_sense_id uuid NOT NULL REFERENCES public.subfeature_senses (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (feature_id, subfeature_sense_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_feature_subfeature_senses'
            AND tgrelid = 'public.feature_subfeature_senses'::regclass) THEN
    CREATE TRIGGER trg_cleanup_feature_subfeature_senses
        AFTER DELETE ON public.feature_subfeature_senses
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.subfeature_senses", "columns": ["subfeature_sense_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_feature_subfeature_senses_subfeature_sense_id ON public.feature_subfeature_senses (subfeature_sense_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_feature_subfeature_senses_updated_at'
            AND tgrelid = 'public.feature_subfeature_senses'::regclass) THEN
    CREATE TRIGGER trg_feature_subfeature_senses_updated_at
        BEFORE UPDATE ON public.feature_subfeature_senses
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.feature_subfeature_senses ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.feature_subfeature_feats (
    feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_feat_id uuid NOT NULL REFERENCES public.subfeature_feats (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (feature_id, subfeature_feat_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_feature_subfeature_feats'
            AND tgrelid = 'public.feature_subfeature_feats'::regclass) THEN
    CREATE TRIGGER trg_cleanup_feature_subfeature_feats
        AFTER DELETE ON public.feature_subfeature_feats
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.subfeature_feats", "columns": ["subfeature_feat_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_feature_subfeature_feats_subfeature_feat_id ON public.feature_subfeature_feats (subfeature_feat_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_feature_subfeature_feats_updated_at'
            AND tgrelid = 'public.feature_subfeature_feats'::regclass) THEN
    CREATE TRIGGER trg_feature_subfeature_feats_updated_at
        BEFORE UPDATE ON public.feature_subfeature_feats
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.feature_subfeature_feats ENABLE ROW LEVEL SECURITY;

/***************************
 * FUNCTIONS
 ***************************/ 
CREATE OR REPLACE FUNCTION public.upsert_features (json_data jsonb)
    RETURNS void
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE
    v_id uuid := (json_data ->> 'id')::uuid;
    v_label text := NULLIF (json_data ->> 'label', '');
    v_description text := NULLIF (json_data ->> 'description', '');
    v_detail text := NULLIF (json_data ->> 'detail', '');
    v_category_id uuid := NULLIF (COALESCE(json_data ->> 'categoryId', json_data ->> 'category'), '')::uuid;
    v_targets int := NULLIF (json_data ->> 'targets', '')::int;
    v_save_dc_id uuid := NULLIF (json_data -> 'saveDc' ->> 'id', '')::uuid;
    v_damage_id uuid := NULLIF (json_data -> 'damage' ->> 'id', '')::uuid;
    v_charge_id uuid := NULLIF (json_data -> 'charges' ->> 'id', '')::uuid;
    v_action_id uuid := COALESCE(NULLIF (json_data -> 'actions' ->> 'id', '')::uuid, NULLIF (json_data -> 'action' ->> 'id', '')::uuid);
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

    -- prerequisites array → bridge + preserve first in column for backward compat
    IF json_data ? 'prerequisites' AND json_data -> 'prerequisites' IS NOT NULL THEN
        INSERT INTO public.feature_prerequisites (feature_id, prerequisite_id, position)
        SELECT
            v_id,
            public.upsert_prerequisites(elem.obj),
            elem.ord
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'prerequisites', '[]'::jsonb)) WITH ORDINALITY AS elem(obj, ord)
        ON CONFLICT (feature_id, prerequisite_id)
            DO UPDATE SET position = EXCLUDED.position;

        DELETE FROM public.feature_prerequisites fp
        WHERE fp.feature_id = v_id
          AND NOT EXISTS (
              SELECT 1
              FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'prerequisites', '[]'::jsonb)) AS elem
              WHERE fp.prerequisite_id = (elem ->> 'id')::uuid
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

    -- main feature upsert
    INSERT INTO public.features (id, label, description, detail, category_id, save_dc_id, damage_id, charge_id, action_id, range_id, shape_id, targets)
        VALUES (v_id, v_label, v_description, v_detail, v_category_id, v_save_dc_id, v_damage_id, v_charge_id, v_action_id, v_range_id, v_shape_id, v_targets)
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = EXCLUDED.description,
            detail = EXCLUDED.detail,
            category_id = EXCLUDED.category_id,
            save_dc_id = EXCLUDED.save_dc_id,
            damage_id = EXCLUDED.damage_id,
            charge_id = EXCLUDED.charge_id,
            action_id = EXCLUDED.action_id,
            range_id = EXCLUDED.range_id,
            shape_id = EXCLUDED.shape_id,
            targets = EXCLUDED.targets;

    -- 🧩 Handle multiple levels (array or comma-separated string)
    IF json_data ? 'levelAvailable' AND json_data ->> 'levelAvailable' IS NOT NULL THEN
    -- Insert levels
        INSERT INTO public.feature_levels (feature_id, level)
        SELECT v_id, TRIM(val)::int
        FROM (
            -- Case 1: levelAvailable is an array
            SELECT jsonb_array_elements_text(json_data -> 'levelAvailable') AS val
            WHERE jsonb_typeof(json_data -> 'levelAvailable') = 'array'

            UNION ALL

            -- Case 2: levelAvailable is a string (comma or comma-space)
            SELECT UNNEST(
                string_to_array(
                    regexp_replace(json_data ->> 'levelAvailable', '\s*,\s*', ',', 'g'),
                    ','
                )
            ) AS val
            WHERE jsonb_typeof(json_data -> 'levelAvailable') <> 'array'
        ) AS levels
        ON CONFLICT (feature_id, level)
            DO NOTHING;

        -- Delete removed levels
        DELETE FROM public.feature_levels fl
        WHERE fl.feature_id = v_id
        AND NOT EXISTS (
            SELECT 1
            FROM (
                SELECT jsonb_array_elements_text(json_data -> 'levelAvailable') AS val
                WHERE jsonb_typeof(json_data -> 'levelAvailable') = 'array'

                UNION ALL

                SELECT UNNEST(
                    string_to_array(
                        regexp_replace(json_data ->> 'levelAvailable', '\s*,\s*', ',', 'g'),
                        ','
                    )
                ) AS val
                WHERE jsonb_typeof(json_data -> 'levelAvailable') <> 'array'
            ) AS levels
            WHERE TRIM(val)::int = fl.level
        );
    END IF;


    -- 🧩 Options
    INSERT INTO public.feature_subfeature_options (feature_id, subfeature_option_id, position)
    SELECT
        v_id AS feature_id,
        (option.obj ->> 'id')::uuid AS subfeature_option_id,
        option.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'options', '[]'::jsonb))
        WITH ORDINALITY AS option (obj, ord)
        ON CONFLICT (feature_id, subfeature_option_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'options', '[]'::jsonb))
             WITH ORDINALITY AS option(obj)
    LOOP
        PERFORM public.upsert_subfeature_options (rec.obj);

    END LOOP;

    DELETE FROM public.feature_subfeature_options fso
    WHERE fso.feature_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'options', '[]'::jsonb)) AS option(obj)
            WHERE (option.obj ->> 'id')::uuid = fso.subfeature_option_id);

    -- 🧩 Proficiencies
    INSERT INTO public.feature_subfeature_proficiencies (feature_id, subfeature_proficiency_id, position)
    SELECT
        v_id AS feature_id,
        (proficiency.obj ->> 'id')::uuid AS subfeature_proficiency_id,
        proficiency.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'proficiencies', '[]'::jsonb))
        WITH ORDINALITY AS proficiency (obj, ord)
        ON CONFLICT (feature_id, subfeature_proficiency_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'proficiencies', '[]'::jsonb))
             WITH ORDINALITY AS proficiency(obj)
    LOOP
        PERFORM public.upsert_subfeature_proficiencies (rec.obj);

    END LOOP;

    DELETE FROM public.feature_subfeature_proficiencies fsp
    WHERE fsp.feature_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'proficiencies', '[]'::jsonb)) AS proficiency(obj)
            WHERE (proficiency.obj ->> 'id')::uuid = fsp.subfeature_proficiency_id);
            
    -- 🧩 Expertise
    INSERT INTO public.feature_subfeature_expertise (feature_id, subfeature_expertise_id, position)
    SELECT
        v_id AS feature_id,
        (expertise.obj ->> 'id')::uuid AS subfeature_expertise_id,
        expertise.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'expertise', '[]'::jsonb))
        WITH ORDINALITY AS expertise (obj, ord)
        ON CONFLICT (feature_id, subfeature_expertise_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'expertise', '[]'::jsonb))
             WITH ORDINALITY AS expertise(obj)
    LOOP
        PERFORM public.upsert_subfeature_expertise (rec.obj);

    END LOOP;

    DELETE FROM public.feature_subfeature_expertise fse
    WHERE fse.feature_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'expertise', '[]'::jsonb)) AS expertise(obj)
            WHERE (expertise.obj ->> 'id')::uuid = fse.subfeature_expertise_id);
            
    -- 🧩 Modifiers
    INSERT INTO public.feature_subfeature_modifiers (feature_id, subfeature_modifier_id, position)
    SELECT
        v_id AS feature_id,
        (modifier.obj ->> 'id')::uuid AS subfeature_modifier_id,
        modifier.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'modifiers', '[]'::jsonb))
        WITH ORDINALITY AS modifier (obj, ord)
        ON CONFLICT (feature_id, subfeature_modifier_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'modifiers', '[]'::jsonb))
             WITH ORDINALITY AS modifier(obj)
    LOOP
        PERFORM public.upsert_subfeature_modifiers (rec.obj);

    END LOOP;

    DELETE FROM public.feature_subfeature_modifiers fsm
    WHERE fsm.feature_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'modifiers', '[]'::jsonb)) AS modifier(obj)
            WHERE (modifier.obj ->> 'id')::uuid = fsm.subfeature_modifier_id);
            
    -- 🧩 Spells
    INSERT INTO public.feature_subfeature_spells (feature_id, subfeature_spell_id, position)
    SELECT
        v_id AS feature_id,
        (spell.obj ->> 'id')::uuid AS subfeature_spell_id,
        spell.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spells', '[]'::jsonb))
        WITH ORDINALITY AS spell (obj, ord)
        ON CONFLICT (feature_id, subfeature_spell_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spells', '[]'::jsonb))
             WITH ORDINALITY AS spell(obj)
    LOOP
        PERFORM public.upsert_subfeature_spells (rec.obj);

    END LOOP;

    DELETE FROM public.feature_subfeature_spells fss
    WHERE fss.feature_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spells', '[]'::jsonb)) AS spell(obj)
            WHERE (spell.obj ->> 'id')::uuid = fss.subfeature_spell_id);
            
    -- 🧩 Senses
    INSERT INTO public.feature_subfeature_senses (feature_id, subfeature_sense_id, position)
    SELECT
        v_id AS feature_id,
        (sense.obj ->> 'id')::uuid AS subfeature_sense_id,
        sense.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'senses', '[]'::jsonb))
        WITH ORDINALITY AS sense (obj, ord)
        ON CONFLICT (feature_id, subfeature_sense_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'senses', '[]'::jsonb))
             WITH ORDINALITY AS sense(obj)
    LOOP
        PERFORM public.upsert_subfeature_senses (rec.obj);

    END LOOP;

    DELETE FROM public.feature_subfeature_senses fss
    WHERE fss.feature_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'senses', '[]'::jsonb)) AS sense(obj)
            WHERE (sense.obj ->> 'id')::uuid = fss.subfeature_sense_id);

    -- 🧩 Feats
    INSERT INTO public.feature_subfeature_feats (feature_id, subfeature_feat_id, position)
    SELECT
        v_id AS feature_id,
        (feat.obj ->> 'id')::uuid AS subfeature_feat_id,
        feat.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'feats', '[]'::jsonb))
        WITH ORDINALITY AS feat (obj, ord)
        ON CONFLICT (feature_id, subfeature_feat_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'feats', '[]'::jsonb))
             WITH ORDINALITY AS feat(obj)
    LOOP
        PERFORM public.upsert_subfeature_feats (rec.obj);

    END LOOP;

    DELETE FROM public.feature_subfeature_feats fsf
    WHERE fsf.feature_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'feats', '[]'::jsonb)) AS feat(obj)
            WHERE (feat.obj ->> 'id')::uuid = fsf.subfeature_feat_id);

    -- feature_attributes bridge
    INSERT INTO public.feature_attributes (feature_id, attribute_id)
    SELECT
        v_id,
        x::uuid
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'attributeIds', json_data -> 'attributes', '[]'::jsonb)) AS x
    ON CONFLICT
        DO NOTHING;

    DELETE FROM public.feature_attributes fa
    WHERE fa.feature_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'attributeIds', json_data -> 'attributes', '[]'::jsonb)) AS x
            WHERE
                x::uuid = fa.attribute_id);

    -- feature_subfeature_options_by_level
    INSERT INTO public.feature_subfeature_options_by_level (feature_id, level, count, replace_count)
    SELECT
        v_id,
        (lvl ->> 'level')::int,
        (lvl ->> 'count')::int,
        NULLIF ((lvl ->> 'replaceCount'), '')::int
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'optionsByLevel', '[]'::jsonb)) AS lvl
    ON CONFLICT (feature_id,
        level)
        DO UPDATE SET
            count = EXCLUDED.count,
            replace_count = EXCLUDED.replace_count;

    DELETE FROM public.feature_subfeature_options_by_level sf
    WHERE sf.feature_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'optionsByLevel', '[]'::jsonb)) AS x
            WHERE (x ->> 'level')::int = sf.level);

END
$$;