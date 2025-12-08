/***************************
 * TABLES
 ***************************/
CREATE TABLE IF NOT EXISTS public.feats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE DEFERRABLE,
    is_master boolean NOT NULL DEFAULT FALSE,
    label text NOT NULL,
    description text NOT NULL,
    detail text,
    selection_count integer,
    level_available text,
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

CREATE INDEX IF NOT EXISTS idx_feats_save_dc_id ON public.feats (save_dc_id);

CREATE INDEX IF NOT EXISTS idx_feats_damage_id ON public.feats (damage_id);

CREATE INDEX IF NOT EXISTS idx_feats_charge_id ON public.feats (charge_id);

CREATE INDEX IF NOT EXISTS idx_feats_range_id ON public.feats (range_id);

CREATE INDEX IF NOT EXISTS idx_feats_shape_id ON public.feats (shape_id);

CREATE INDEX IF NOT EXISTS idx_feats_action_id ON public.feats (action_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_feats_updated_at'
            AND tgrelid = 'public.feats'::regclass) THEN
    CREATE TRIGGER trg_feats_updated_at
        BEFORE UPDATE ON public.feats
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.feats ENABLE ROW LEVEL SECURITY;

SELECT
    public.apply_standard_policies ('feats');

CREATE TABLE IF NOT EXISTS public.feat_attributes (
    feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE,
    attribute_id uuid NOT NULL REFERENCES public.system_attributes (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (feat_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS idx_feat_attributes_attr_id ON public.feat_attributes (attribute_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_feat_attributes_updated_at'
            AND tgrelid = 'public.feat_attributes'::regclass) THEN
    CREATE TRIGGER trg_feat_attributes_updated_at
        BEFORE UPDATE ON public.feat_attributes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.feat_attributes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.feat_features (
    feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE,
    feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (feat_id, feature_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_feat_features'
            AND tgrelid = 'public.feat_features'::regclass) THEN
    CREATE TRIGGER trg_cleanup_feat_features
        AFTER DELETE ON public.feat_features
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.features", "columns": ["feature_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_feat_features_feature_id ON public.feat_features (feature_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_feat_features_updated_at'
            AND tgrelid = 'public.feat_features'::regclass) THEN
    CREATE TRIGGER trg_feat_features_updated_at
        BEFORE UPDATE ON public.feat_features
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.feat_features ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.feat_subfeature_expertise (
    feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_expertise_id uuid NOT NULL REFERENCES public.subfeature_expertise (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (feat_id, subfeature_expertise_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_feat_subfeature_expertise'
            AND tgrelid = 'public.feat_subfeature_expertise'::regclass) THEN
    CREATE TRIGGER trg_cleanup_feat_subfeature_expertise
        AFTER DELETE ON public.feat_subfeature_expertise
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.subfeature_expertise", "columns": ["subfeature_expertise_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_feat_subfeature_expertise_subfeature_expertise_id ON public.feat_subfeature_expertise (subfeature_expertise_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_feat_subfeature_expertise_updated_at'
            AND tgrelid = 'public.feat_subfeature_expertise'::regclass) THEN
    CREATE TRIGGER trg_feat_subfeature_expertise_updated_at
        BEFORE UPDATE ON public.feat_subfeature_expertise
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.feat_subfeature_expertise ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.feat_subfeature_proficiencies (
    feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_proficiency_id uuid NOT NULL REFERENCES public.subfeature_proficiencies (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (feat_id, subfeature_proficiency_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_feat_subfeature_proficiencies'
            AND tgrelid = 'public.feat_subfeature_proficiencies'::regclass) THEN
    CREATE TRIGGER trg_cleanup_feat_subfeature_proficiencies
        AFTER DELETE ON public.feat_subfeature_proficiencies
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.subfeature_proficiencies", "columns": ["subfeature_proficiency_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_feat_subfeature_proficiencies_subfeature_proficiency_id ON public.feat_subfeature_proficiencies (subfeature_proficiency_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_feat_subfeature_proficiencies_updated_at'
            AND tgrelid = 'public.feat_subfeature_proficiencies'::regclass) THEN
    CREATE TRIGGER trg_feat_subfeature_proficiencies_updated_at
        BEFORE UPDATE ON public.feat_subfeature_proficiencies
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.feat_subfeature_proficiencies ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.feat_subfeature_modifiers (
    feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_modifier_id uuid NOT NULL REFERENCES public.subfeature_modifiers (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (feat_id, subfeature_modifier_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_feat_subfeature_modifiers'
            AND tgrelid = 'public.feat_subfeature_modifiers'::regclass) THEN
    CREATE TRIGGER trg_cleanup_feat_subfeature_modifiers
        AFTER DELETE ON public.feat_subfeature_modifiers
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.subfeature_modifiers", "columns": ["subfeature_modifier_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_feat_subfeature_modifiers_subfeature_modifier_id ON public.feat_subfeature_modifiers (subfeature_modifier_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_feat_subfeature_modifiers_updated_at'
            AND tgrelid = 'public.feat_subfeature_modifiers'::regclass) THEN
    CREATE TRIGGER trg_feat_subfeature_modifiers_updated_at
        BEFORE UPDATE ON public.feat_subfeature_modifiers
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.feat_subfeature_modifiers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.feat_subfeature_spells (
    feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_spell_id uuid NOT NULL REFERENCES public.subfeature_spells (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (feat_id, subfeature_spell_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_feat_subfeature_spells'
            AND tgrelid = 'public.feat_subfeature_spells'::regclass) THEN
    CREATE TRIGGER trg_cleanup_feat_subfeature_spells
        AFTER DELETE ON public.feat_subfeature_spells
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.subfeature_spells", "columns": ["subfeature_spell_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_feat_subfeature_spells_subfeature_spell_id ON public.feat_subfeature_spells (subfeature_spell_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_feat_subfeature_spells_updated_at'
            AND tgrelid = 'public.feat_subfeature_spells'::regclass) THEN
    CREATE TRIGGER trg_feat_subfeature_spells_updated_at
        BEFORE UPDATE ON public.feat_subfeature_spells
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.feat_subfeature_spells ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.feat_subfeature_senses (
    feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_sense_id uuid NOT NULL REFERENCES public.subfeature_senses (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (feat_id, subfeature_sense_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_feat_subfeature_senses'
            AND tgrelid = 'public.feat_subfeature_senses'::regclass) THEN
    CREATE TRIGGER trg_cleanup_feat_subfeature_senses
        AFTER DELETE ON public.feat_subfeature_senses
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.subfeature_senses", "columns": ["subfeature_sense_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_feat_subfeature_senses_subfeature_sense_id ON public.feat_subfeature_senses (subfeature_sense_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_feat_subfeature_senses_updated_at'
            AND tgrelid = 'public.feat_subfeature_senses'::regclass) THEN
    CREATE TRIGGER trg_feat_subfeature_senses_updated_at
        BEFORE UPDATE ON public.feat_subfeature_senses
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.feat_subfeature_senses ENABLE ROW LEVEL SECURITY;

-- Bridge: feats ⇄ prerequisites (many-to-many)
CREATE TABLE IF NOT EXISTS public.feat_prerequisites (
    feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE,
    prerequisite_id uuid NOT NULL REFERENCES public.prerequisites (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (feat_id, prerequisite_id)
);

ALTER TABLE IF EXISTS public.feat_prerequisites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feat_prereqs_feat_id ON public.feat_prerequisites (feat_id);

CREATE INDEX IF NOT EXISTS idx_feat_prereqs_position ON public.feat_prerequisites (feat_id, position);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_feat_prerequisites_updated_at'
          AND tgrelid = 'public.feat_prerequisites'::regclass
    ) THEN
        CREATE TRIGGER trg_feat_prerequisites_updated_at
        BEFORE UPDATE ON public.feat_prerequisites
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_delete_feat_owned_cleanup'
            AND tgrelid = 'public.feats'::regclass) THEN
    CREATE TRIGGER trg_delete_feat_owned_cleanup
        AFTER DELETE ON public.feats
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

SELECT
    public.apply_standard_policies ('feats');


/***************************
 * FUNCTIONS
 ***************************/ 
CREATE OR REPLACE FUNCTION public.upsert_feats (json_data jsonb)
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
    v_detail text := json_data ->> 'detail';
    v_selection_count int := NULLIF (json_data ->> 'selectionCount', '')::int;
    v_level_available int := NULLIF (json_data ->> 'levelAvailable', '')::int;
    v_is_master boolean := CASE WHEN json_data ->> 'masterId' = 'master' THEN TRUE ELSE FALSE END;
    v_targets int := NULLIF (json_data ->> 'targets', '')::int;
    v_save_dc_id uuid := NULLIF (json_data -> 'saveDc' ->> 'id', '')::uuid;
    v_damage_id uuid := NULLIF (json_data -> 'damage' ->> 'id', '')::uuid;
    v_charge_id uuid := NULLIF (json_data -> 'charges' ->> 'id', '')::uuid;
    v_action_id uuid := COALESCE(NULLIF (json_data -> 'actions' ->> 'id', '')::uuid, NULLIF (json_data -> 'action' ->> 'id', '')::uuid);
    v_range_id uuid := NULLIF (json_data -> 'range' ->> 'id', '')::uuid;
    v_shape_id uuid := NULLIF (json_data -> 'shape' ->> 'id', '')::uuid;
    rec RECORD;
BEGIN
    -- 🧩 Properties
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
        INSERT INTO public.feat_prerequisites (feat_id, prerequisite_id, position)
        SELECT
            v_id,
            public.upsert_prerequisites(elem.obj),
            elem.ord
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'prerequisites', '[]'::jsonb)) WITH ORDINALITY AS elem(obj, ord)
        ON CONFLICT (feat_id, prerequisite_id)
            DO UPDATE SET position = EXCLUDED.position;

        DELETE FROM public.feat_prerequisites fp
        WHERE fp.feat_id = v_id
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
    -- 🧩 Core
    INSERT INTO public.feats (id, system_id, user_id, label, description, detail,selection_count, level_available, save_dc_id, damage_id, charge_id, action_id, range_id, shape_id, targets, is_master)
        VALUES (v_id, v_system_id, v_user_id, v_label, v_description, v_detail, v_selection_count, v_level_available, v_save_dc_id, v_damage_id, v_charge_id, v_action_id, v_range_id, v_shape_id, v_targets, v_is_master)
    ON CONFLICT (id)
        DO UPDATE SET
            label = excluded.label,
            description = excluded.description,
            detail = excluded.detail,
            selection_count = excluded.selection_count,
            level_available = excluded.level_available,
            save_dc_id = excluded.save_dc_id,
            damage_id = excluded.damage_id,
            charge_id = excluded.charge_id,
            action_id = excluded.action_id,
            range_id = excluded.range_id,
            shape_id = excluded.shape_id,
            targets = excluded.targets,
            is_master = excluded.is_master;
    -- 🧩 Features
    FOR rec IN
        SELECT obj, ord::int
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'features', '[]'::jsonb))
             WITH ORDINALITY AS feature(obj, ord)
    LOOP
        PERFORM public.upsert_features (rec.obj, p_position => rec.ord);

    END LOOP;

    INSERT INTO public.feat_features (feat_id, feature_id, position)
    SELECT
        v_id AS feat_id,
        (feature.obj ->> 'id')::uuid AS feature_id,
        feature.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'features', '[]'::jsonb))
    WITH ORDINALITY AS feature (obj, ord)
    LEFT JOIN public.feat_features ff ON ff.feat_id = v_id
        AND ff.feature_id = (feature.obj ->> 'id')::uuid
    ON CONFLICT (feat_id, feature_id)
        DO UPDATE SET
            position = excluded.position;

    DELETE FROM public.feat_features rf
    WHERE rf.feat_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'features', '[]'::jsonb)) AS x
            WHERE
                rf.feature_id = (x ->> 'id')::uuid);
                
    -- 🧩 Proficiencies
    INSERT INTO public.feat_subfeature_proficiencies (feat_id, subfeature_proficiency_id, position)
    SELECT
        v_id AS feat_id,
        (proficiency.obj ->> 'id')::uuid AS subfeature_proficiency_id,
        proficiency.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'proficiencies', '[]'::jsonb))
        WITH ORDINALITY AS proficiency (obj, ord)
        ON CONFLICT (feat_id, subfeature_proficiency_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'proficiencies', '[]'::jsonb))
             WITH ORDINALITY AS proficiency(obj)
    LOOP
        PERFORM public.upsert_subfeature_proficiencies (rec.obj);

    END LOOP;

    DELETE FROM public.feat_subfeature_proficiencies fsp
    WHERE fsp.feat_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'proficiencies', '[]'::jsonb)) AS proficiency(obj)
            WHERE (proficiency.obj ->> 'id')::uuid = fsp.subfeature_proficiency_id);
            
    -- 🧩 Expertise
    INSERT INTO public.feat_subfeature_expertise (feat_id, subfeature_expertise_id, position)
    SELECT
        v_id AS feat_id,
        (expertise.obj ->> 'id')::uuid AS subfeature_expertise_id,
        expertise.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'expertise', '[]'::jsonb))
        WITH ORDINALITY AS expertise (obj, ord)
        ON CONFLICT (feat_id, subfeature_expertise_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'expertise', '[]'::jsonb))
             WITH ORDINALITY AS expertise(obj)
    LOOP
        PERFORM public.upsert_subfeature_expertise (rec.obj);

    END LOOP;

    DELETE FROM public.feat_subfeature_expertise fse
    WHERE fse.feat_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'expertise', '[]'::jsonb)) AS expertise(obj)
            WHERE (expertise.obj ->> 'id')::uuid = fse.subfeature_expertise_id);
            
    -- 🧩 Modifiers
    INSERT INTO public.feat_subfeature_modifiers (feat_id, subfeature_modifier_id, position)
    SELECT
        v_id AS feat_id,
        (modifier.obj ->> 'id')::uuid AS subfeature_modifier_id,
        modifier.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'modifiers', '[]'::jsonb))
        WITH ORDINALITY AS modifier (obj, ord)
        ON CONFLICT (feat_id, subfeature_modifier_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'modifiers', '[]'::jsonb))
             WITH ORDINALITY AS modifier(obj)
    LOOP
        PERFORM public.upsert_subfeature_modifiers (rec.obj);

    END LOOP;

    DELETE FROM public.feat_subfeature_modifiers fsm
    WHERE fsm.feat_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'modifiers', '[]'::jsonb)) AS modifier(obj)
            WHERE (modifier.obj ->> 'id')::uuid = fsm.subfeature_modifier_id);
            
    -- 🧩 Spells
    INSERT INTO public.feat_subfeature_spells (feat_id, subfeature_spell_id, position)
    SELECT
        v_id AS feat_id,
        (spell.obj ->> 'id')::uuid AS subfeature_spell_id,
        spell.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spells', '[]'::jsonb))
        WITH ORDINALITY AS spell (obj, ord)
        ON CONFLICT (feat_id, subfeature_spell_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spells', '[]'::jsonb))
             WITH ORDINALITY AS spell(obj)
    LOOP
        PERFORM public.upsert_subfeature_spells (rec.obj);

    END LOOP;

    DELETE FROM public.feat_subfeature_spells fss
    WHERE fss.feat_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spells', '[]'::jsonb)) AS spell(obj)
            WHERE (spell.obj ->> 'id')::uuid = fss.subfeature_spell_id);
            
    -- 🧩 Senses
    INSERT INTO public.feat_subfeature_senses (feat_id, subfeature_sense_id, position)
    SELECT
        v_id AS feat_id,
        (sense.obj ->> 'id')::uuid AS subfeature_sense_id,
        sense.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'senses', '[]'::jsonb))
        WITH ORDINALITY AS sense (obj, ord)
        ON CONFLICT (feat_id, subfeature_sense_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'senses', '[]'::jsonb))
             WITH ORDINALITY AS sense(obj)
    LOOP
        PERFORM public.upsert_subfeature_senses (rec.obj);

    END LOOP;

    DELETE FROM public.feat_subfeature_senses fss
    WHERE fss.feat_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'senses', '[]'::jsonb)) AS sense(obj)
            WHERE (sense.obj ->> 'id')::uuid = fss.subfeature_sense_id);

    -- 🧩 Attributes bridge
    INSERT INTO public.feat_attributes (feat_id, attribute_id)
    SELECT v_id, x::uuid
    FROM JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'attributeIds', json_data -> 'attributes', '[]'::jsonb)) AS x
    ON CONFLICT (feat_id, attribute_id) DO NOTHING;

    DELETE FROM public.feat_attributes fa
    WHERE fa.feat_id = v_id
      AND NOT EXISTS (
        SELECT 1
        FROM JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'attributeIds', json_data -> 'attributes', '[]'::jsonb)) AS x
        WHERE x::uuid = fa.attribute_id
      );

    RETURN v_id;

END
$$;