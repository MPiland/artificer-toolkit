/***************************
 * TABLES
 ***************************/
CREATE TABLE IF NOT EXISTS public.classes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE DEFERRABLE,
    is_master boolean NOT NULL DEFAULT FALSE,
    label text NOT NULL,
    description text NOT NULL,
    category_id uuid NOT NULL REFERENCES public.system_categories (id) ON DELETE SET NULL DEFERRABLE,
    parent_class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
    starting_equipment_id uuid REFERENCES public.starting_equipment (id) ON DELETE SET NULL DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classes_system_id ON public.classes (system_id);

CREATE INDEX IF NOT EXISTS idx_classes_user_id ON public.classes (user_id);

CREATE INDEX IF NOT EXISTS idx_classes_category_id ON public.classes (category_id);

CREATE INDEX IF NOT EXISTS idx_classes_class_id ON public.classes (parent_class_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_classes_updated_at'
            AND tgrelid = 'public.classes'::regclass) THEN
    CREATE TRIGGER trg_classes_updated_at
        BEFORE UPDATE ON public.classes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.classes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.class_details (
    class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE DEFERRABLE,
    detail_id uuid NOT NULL REFERENCES public.details (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (class_id, detail_id)
);

CREATE INDEX IF NOT EXISTS idx_class_details_detail ON public.class_details (detail_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_class_details_updated_at'
            AND tgrelid = 'public.class_details'::regclass) THEN
    CREATE TRIGGER trg_class_details_updated_at
        BEFORE UPDATE ON public.class_details
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.class_details ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_class_details'
            AND tgrelid = 'public.class_details'::regclass) THEN
    CREATE TRIGGER trg_cleanup_class_details
        AFTER DELETE ON public.class_details
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.details", "columns": ["detail_id"] },
        { "table": "public.starting_equipment", "columns": ["starting_equipment_id"] }
      ]' );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.class_details ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.class_attributes (
    class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE DEFERRABLE,
    attribute_id uuid NOT NULL REFERENCES public.system_attributes (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (class_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS idx_class_attributes_attr_id ON public.class_attributes (attribute_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_class_attributes_updated_at'
            AND tgrelid = 'public.class_attributes'::regclass) THEN
    CREATE TRIGGER trg_class_attributes_updated_at
        BEFORE UPDATE ON public.class_attributes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.class_attributes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.class_subtypes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_subtypes_class_id ON public.class_subtypes (class_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_class_subtypes_updated_at'
            AND tgrelid = 'public.class_subtypes'::regclass) THEN
    CREATE TRIGGER trg_class_subtypes_updated_at
        BEFORE UPDATE ON public.class_subtypes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.class_subtypes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.class_hitpoint (
    class_id uuid PRIMARY KEY REFERENCES public.classes (id) ON DELETE CASCADE DEFERRABLE,
    ability_id uuid NOT NULL REFERENCES public.system_abilities (id) ON DELETE SET NULL DEFERRABLE,
    die_config text NOT NULL,
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
            tgname = 'trg_class_hitpoint_updated_at'
            AND tgrelid = 'public.class_hitpoint'::regclass) THEN
    CREATE TRIGGER trg_class_hitpoint_updated_at
        BEFORE UPDATE ON public.class_hitpoint
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.class_hitpoint ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.class_starting_gold (
    class_id uuid PRIMARY KEY REFERENCES public.classes (id) ON DELETE CASCADE DEFERRABLE,
    multiplier integer NOT NULL,
    currency_id uuid NOT NULL REFERENCES public.system_currencies (id) ON DELETE SET NULL DEFERRABLE,
    die_config text NOT NULL,
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
            tgname = 'trg_class_starting_gold_updated_at'
            AND tgrelid = 'public.class_starting_gold'::regclass) THEN
    CREATE TRIGGER trg_class_starting_gold_updated_at
        BEFORE UPDATE ON public.class_starting_gold
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.class_starting_gold ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.class_spellcasting (
    class_id uuid PRIMARY KEY REFERENCES public.classes (id) ON DELETE CASCADE DEFERRABLE,
    magic_name text,
    ability_id uuid REFERENCES public.system_abilities (id) ON DELETE SET NULL DEFERRABLE,
    max_spell_level integer,
    charge_id uuid REFERENCES public.charges (id) ON DELETE SET NULL DEFERRABLE,
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
            tgname = 'trg_class_spellcasting_updated_at'
            AND tgrelid = 'public.class_spellcasting'::regclass) THEN
    CREATE TRIGGER trg_class_spellcasting_updated_at
        BEFORE UPDATE ON public.class_spellcasting
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.class_spellcasting ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.class_spellcasting_attributes (
    class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE DEFERRABLE,
    attribute_id uuid NOT NULL REFERENCES public.system_attributes (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (class_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS idx_class_spellcasting_attr_id ON public.class_spellcasting_attributes (attribute_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_class_spellcasting_attributes_updated_at'
            AND tgrelid = 'public.class_spellcasting_attributes'::regclass) THEN
    CREATE TRIGGER trg_class_spellcasting_attributes_updated_at
        BEFORE UPDATE ON public.class_spellcasting_attributes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.class_spellcasting_attributes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.class_spell_prepare_methods (
    class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
    method_id uuid NOT NULL REFERENCES public.system_attributes (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (class_id, method_id)
);

CREATE INDEX IF NOT EXISTS idx_class_spell_prep_methods_method_id ON public.class_spell_prepare_methods (method_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_class_spell_prepare_methods_updated_at'
            AND tgrelid = 'public.class_spell_prepare_methods'::regclass) THEN
    CREATE TRIGGER trg_class_spell_prepare_methods_updated_at
        BEFORE UPDATE ON public.class_spell_prepare_methods
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.class_spell_prepare_methods ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.class_spell_prepare_level (
    class_id uuid PRIMARY KEY REFERENCES public.classes (id) ON DELETE CASCADE,
    measurement_id uuid NOT NULL REFERENCES public.system_measure_opts (id) ON DELETE SET NULL,
    rounding_id uuid REFERENCES public.system_measure_opts (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_spell_prep_level_measurement_id ON public.class_spell_prepare_level (measurement_id);

CREATE INDEX IF NOT EXISTS idx_class_spell_prep_level_rounding_id ON public.class_spell_prepare_level (rounding_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_class_spell_prepare_level_updated_at'
            AND tgrelid = 'public.class_spell_prepare_level'::regclass) THEN
    CREATE TRIGGER trg_class_spell_prepare_level_updated_at
        BEFORE UPDATE ON public.class_spell_prepare_level
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.class_spell_prepare_level ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.class_level_attributes (
    class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
    level integer NOT NULL,
    resource_points integer,
    spells_known_limit integer,
    cantrips_known_limit integer,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (class_id, level)
);

CREATE INDEX IF NOT EXISTS idx_class_level_attrs_level ON public.class_level_attributes (level);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_class_level_attributes_updated_at'
            AND tgrelid = 'public.class_level_attributes'::regclass) THEN
    CREATE TRIGGER trg_class_level_attributes_updated_at
        BEFORE UPDATE ON public.class_level_attributes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.class_level_attributes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.class_level_spell_slots (
    class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
    level integer NOT NULL,
    slot_level integer NOT NULL,
    slot_count integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (class_id, level, slot_level)
);

CREATE INDEX IF NOT EXISTS idx_class_level_slots_level ON public.class_level_spell_slots (level);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_class_level_spell_slots_updated_at'
            AND tgrelid = 'public.class_level_spell_slots'::regclass) THEN
    CREATE TRIGGER trg_class_level_spell_slots_updated_at
        BEFORE UPDATE ON public.class_level_spell_slots
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.class_level_spell_slots ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.class_multiclass (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE DEFERRABLE,
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
            tgname = 'trg_class_multiclass_updated_at'
            AND tgrelid = 'public.class_multiclass'::regclass) THEN
    CREATE TRIGGER trg_class_multiclass_updated_at
        BEFORE UPDATE ON public.class_multiclass
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.class_multiclass ENABLE ROW LEVEL SECURITY;

CREATE TYPE public.multiclass_logic AS ENUM ('AND', 'OR');

CREATE TABLE public.class_multiclass_rule (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    multiclass_id uuid NOT NULL REFERENCES public.class_multiclass(id) ON DELETE CASCADE DEFERRABLE,
    parent_id uuid REFERENCES public.class_multiclass_rule(id) ON DELETE CASCADE DEFERRABLE,

    -- GROUP NODE
    logic public.multiclass_logic,

    -- LEAF NODE
    ability_id uuid REFERENCES public.system_abilities(id) ON DELETE SET NULL DEFERRABLE,
    min_amount integer,

    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),

    CONSTRAINT class_multiclass_rule_valid CHECK (
        (logic IS NOT NULL AND ability_id IS NULL AND min_amount IS NULL) OR
        (logic IS NULL AND ability_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_multiclass_rule_multiclass_id ON public.class_multiclass_rule(multiclass_id);

CREATE INDEX IF NOT EXISTS idx_multiclass_rule_parent_id  ON public.class_multiclass_rule(parent_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_class_multiclass_rule_updated_at'
            AND tgrelid = 'public.class_multiclass_rule'::regclass) THEN
    CREATE TRIGGER trg_class_multiclass_rule_updated_at
        BEFORE UPDATE ON public.class_multiclass_rule
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.class_multiclass_rule ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.class_multiclass_subfeature_proficiencies (
    class_multiclass_id uuid NOT NULL REFERENCES public.class_multiclass (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_proficiency_id uuid NOT NULL REFERENCES public.subfeature_proficiencies (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (class_multiclass_id, subfeature_proficiency_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_class_multiclass_subfeature_proficiencies'
            AND tgrelid = 'public.class_multiclass_subfeature_proficiencies'::regclass) THEN
    CREATE TRIGGER trg_cleanup_class_multiclass_subfeature_proficiencies
        AFTER DELETE ON public.class_multiclass_subfeature_proficiencies
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.subfeature_proficiencies", "columns": ["subfeature_proficiency_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_multiclass_subfeat_prof_subfeat 
    ON public.class_multiclass_subfeature_proficiencies (subfeature_proficiency_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_class_multiclass_subfeature_proficiencies_updated_at'
          AND tgrelid = 'public.class_multiclass_subfeature_proficiencies'::regclass
    ) THEN
        CREATE TRIGGER trg_class_multiclass_subfeature_proficiencies_updated_at
        BEFORE UPDATE ON public.class_multiclass_subfeature_proficiencies
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at();
    END IF;
END;
$$;

ALTER TABLE IF EXISTS public.class_multiclass_subfeature_proficiencies ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.class_resource (
    class_id uuid PRIMARY KEY REFERENCES public.classes (id) ON DELETE CASCADE,
    label text NOT NULL,
    level_available integer NOT NULL DEFAULT 1,
    charge_id uuid REFERENCES public.charges (id) ON DELETE SET NULL,
    description text,
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
            tgname = 'trg_class_resource_updated_at'
            AND tgrelid = 'public.class_resource'::regclass) THEN
    CREATE TRIGGER trg_class_resource_updated_at
        BEFORE UPDATE ON public.class_resource
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.class_resource ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE VIEW public.class_flags WITH ( security_invoker = ON
) AS
SELECT
    c.id AS class_id,
    EXISTS (
        SELECT
            1
        FROM
            public.class_spellcasting sc
        WHERE
            sc.class_id = c.id
) AS is_spellcaster,
    EXISTS (
        SELECT
            1
        FROM
            public.class_resource cr
        WHERE
            cr.class_id = c.id
) AS has_resource
FROM
    public.classes c;

SELECT
    public.apply_standard_policies ('classes');

CREATE TABLE IF NOT EXISTS public.class_features (
    class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE DEFERRABLE,
    feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (class_id, feature_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_class_features'
            AND tgrelid = 'public.class_features'::regclass) THEN
    CREATE TRIGGER trg_cleanup_class_features
        AFTER DELETE ON public.class_features
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.features", "columns": ["feature_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_class_features_feature_id ON public.class_features (feature_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_class_features_updated_at'
            AND tgrelid = 'public.class_features'::regclass) THEN
    CREATE TRIGGER trg_class_features_updated_at
        BEFORE UPDATE ON public.class_features
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.class_features ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.class_subfeature_proficiencies (
    class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_proficiency_id uuid NOT NULL REFERENCES public.subfeature_proficiencies (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (class_id, subfeature_proficiency_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_class_subfeature_proficiencies'
            AND tgrelid = 'public.class_subfeature_proficiencies'::regclass) THEN
    CREATE TRIGGER trg_cleanup_class_subfeature_proficiencies
        AFTER DELETE ON public.class_subfeature_proficiencies
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.subfeature_proficiencies", "columns": ["subfeature_proficiency_id"] }
      ]' );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_class_subfeature_proficiencies_subfeature_proficiency_id ON public.class_subfeature_proficiencies (subfeature_proficiency_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_class_subfeature_proficiencies_updated_at'
            AND tgrelid = 'public.class_subfeature_proficiencies'::regclass) THEN
    CREATE TRIGGER trg_class_subfeature_proficiencies_updated_at
        BEFORE UPDATE ON public.class_subfeature_proficiencies
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.class_subfeature_proficiencies ENABLE ROW LEVEL SECURITY;

SELECT
    public.apply_standard_policies ('classes');

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_class_owned'
            AND tgrelid = 'public.classes'::regclass) THEN
    CREATE TRIGGER trg_cleanup_class_owned
        AFTER DELETE ON public.classes
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
 -- Takes a JSON requirement node and inserts it recursively into class_multiclass_rule
CREATE OR REPLACE FUNCTION public.upsert_multiclass_rule(
    p_multiclass_id uuid,
    p_parent_id uuid,
    p_node jsonb,
    p_position integer,
    p_ids INOUT uuid[]
)
RETURNS uuid[]
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_id uuid := (p_node->>'id')::uuid;
    v_type text := UPPER(p_node->>'type');
    v_logic public.multiclass_logic;
    rec record;
BEGIN
    -- Track the ID for cleanup later
    p_ids := array_append(p_ids, v_id);

    IF v_type = 'ABILITY' THEN
        INSERT INTO public.class_multiclass_rule (
            id,
            multiclass_id,
            parent_id,
            ability_id,
            min_amount,
            position
        )
        VALUES (
            v_id,
            p_multiclass_id,
            p_parent_id,
            (p_node->>'abilityId')::uuid,
            (p_node->>'minAmount')::int,
            p_position
        )
        ON CONFLICT (id) DO UPDATE SET
            multiclass_id = EXCLUDED.multiclass_id,
            parent_id = EXCLUDED.parent_id,
            ability_id = EXCLUDED.ability_id,
            min_amount = EXCLUDED.min_amount,
            position = EXCLUDED.position;

    ELSIF v_type = 'GROUP' THEN
        v_logic := UPPER((p_node->>'logic'))::public.multiclass_logic;

        INSERT INTO public.class_multiclass_rule (
            id,
            multiclass_id,
            parent_id,
            logic,
            position
        )
        VALUES (
            v_id,
            p_multiclass_id,
            p_parent_id,
            v_logic,
            p_position
        )
        ON CONFLICT (id) DO UPDATE SET
            multiclass_id = EXCLUDED.multiclass_id,
            parent_id = EXCLUDED.parent_id,
            logic = EXCLUDED.logic,
            position = EXCLUDED.position;

        IF p_node ? 'children' THEN
            FOR rec IN
                SELECT child, ord::int as ord
                FROM jsonb_array_elements(p_node->'children')
                     WITH ORDINALITY AS x(child, ord)
            LOOP
                PERFORM public.upsert_multiclass_rule(
                    p_multiclass_id,
                    v_id,
                    rec.child,
                    rec.ord,
                    p_ids
                );
            END LOOP;
        END IF;
    END IF;
    -- INOUT parameters are returned automatically; use a bare RETURN
    RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_classes (json_data jsonb)
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
    v_category_id uuid := NULLIF (COALESCE(json_data ->> 'categoryId', json_data ->> 'category'), '')::uuid;
    v_parent_class_id uuid := NULLIF (json_data ->> 'parentClassId', '')::uuid;
    v_multiclass_id uuid := NULLIF (json_data -> 'multiclass' ->> 'id', '')::uuid;
    v_starting_equipment_id uuid := NULLIF(json_data -> 'equipment' ->> 'id', '')::uuid;
    v_is_master boolean := (json_data ->> 'userId') = 'master';
    rec RECORD;
BEGIN
    IF json_data ? 'equipment' THEN
        v_starting_equipment_id := upsert_starting_equipment (json_data -> 'equipment', v_starting_equipment_id);

    END IF;

    INSERT INTO public.classes (id, system_id, user_id, label, description, category_id, parent_class_id, starting_equipment_id, is_master)
        VALUES (v_id, v_system_id, v_user_id, v_label, v_description, v_category_id, v_parent_class_id, v_starting_equipment_id, v_is_master)
    ON CONFLICT (id)
        DO UPDATE SET
            label = excluded.label,
            description = excluded.description,
            category_id = excluded.category_id,
            parent_class_id = excluded.parent_class_id,
            starting_equipment_id = excluded.starting_equipment_id,
            is_master = excluded.is_master;

    -- 🧩 Details
    IF json_data ? 'details' AND jsonb_typeof(json_data -> 'details') = 'array' AND jsonb_array_length(json_data -> 'details') > 0 THEN
        WITH parsed_details AS (
            SELECT
                COALESCE((det.obj ->> 'id')::uuid, GEN_RANDOM_UUID ()) AS id,
                det.obj ->> 'label' AS label,
                det.obj ->> 'description' AS description,
                det.ord AS position
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'details', '[]'::jsonb))
                WITH ORDINALITY AS det (obj, ord)
        ),
        upserted_details AS (
            INSERT INTO public.details (id, label, description)
            SELECT id, label, description FROM parsed_details
            ON CONFLICT (id) DO UPDATE SET
                label = EXCLUDED.label,
                description = EXCLUDED.description
            RETURNING id
        )
        INSERT INTO public.class_details (class_id, detail_id, position)
        SELECT
            v_id,
            pd.id,
            pd.position
        FROM parsed_details pd
        JOIN upserted_details ud USING (id)
        ON CONFLICT (class_id,
            detail_id)
            DO UPDATE SET
                position = EXCLUDED.position;
    END IF;

    DELETE FROM public.class_details cd
    WHERE cd.class_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'details', '[]'::jsonb)) AS det
            WHERE (det ->> 'id')::uuid = cd.detail_id);

    -- 🧩 Attributes (root attributeIds)
    INSERT INTO public.class_attributes (class_id, attribute_id)
    SELECT
        v_id AS class_id,
        attr::uuid AS attribute_id
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'attributeIds', '[]'::jsonb)) AS attr
    ON CONFLICT (class_id, attribute_id)
        DO NOTHING;

    DELETE FROM public.class_attributes ca
    WHERE ca.class_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'attributeIds', '[]'::jsonb)) AS attr
            WHERE
                attr::uuid = ca.attribute_id);

    -- 🧩 Subtypes
    INSERT INTO public.class_subtypes (id, class_id, label, position)
    SELECT
        (sub.obj ->> 'id')::uuid AS id,
        v_id AS class_id,
        sub.obj ->> 'label' AS label,
        sub.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'subtypes', '[]'::jsonb))
        WITH ORDINALITY AS sub (obj, ord)
        ON CONFLICT (id)
            DO UPDATE SET
                label = excluded.label,
                position = excluded.position;

    DELETE FROM public.class_subtypes cs
    WHERE cs.class_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'subtypes', '[]'::jsonb)) AS sub
            WHERE (sub ->> 'id')::uuid = cs.id);

    -- 🧩 Hitpoint
    INSERT INTO public.class_hitpoint (class_id, ability_id, die_config)
    SELECT
        v_id AS class_id,
        (json_data -> 'hitpoint' ->> 'abilityId')::uuid,
        json_data -> 'hitpoint' ->> 'dieConfig'
    WHERE
        json_data ? 'hitpoint'
        AND (json_data ->> 'hitpoint') IS NOT NULL
    ON CONFLICT (class_id)
        DO UPDATE SET
            ability_id = excluded.ability_id,
            die_config = excluded.die_config;

    DELETE FROM public.class_hitpoint ch
    WHERE ch.class_id = v_id
        AND (NOT json_data ? 'hitpoint'
            OR (json_data ->> 'hitpoint') IS NULL);

    -- 🧩 Starting Gold
    INSERT INTO public.class_starting_gold (class_id, multiplier, currency_id, die_config)
    SELECT
        v_id AS class_id,
        NULLIF (json_data -> 'startingGold' ->> 'multiplier', '')::int,
        NULLIF (json_data -> 'startingGold' ->> 'currencyId', '')::uuid,
        json_data -> 'startingGold' ->> 'dieConfig'
    WHERE
        json_data ? 'startingGold'
        AND (json_data ->> 'startingGold') IS NOT NULL
    ON CONFLICT (class_id)
        DO UPDATE SET
            multiplier = excluded.multiplier,
            currency_id = excluded.currency_id,
            die_config = excluded.die_config;

    -- 🧩 Spellcasting core
    WITH ROWS AS (
        SELECT
            (json_data ->> 'id')::uuid AS class_id,
            json_data -> 'spellcasting' AS sc
        WHERE
            json_data ? 'spellcasting'
            AND (json_data ->> 'spellcasting') IS NOT NULL
    ),
    computed_charges AS (
        SELECT
            r.class_id AS class_id,
            r.sc AS sc,
            cs.charge_id AS existing_charge_id
        FROM
            ROWS r
            LEFT JOIN public.class_spellcasting cs ON cs.class_id = r.class_id)
    INSERT INTO public.class_spellcasting (class_id, magic_name, ability_id, max_spell_level, charge_id)
    SELECT
        class_id,
        sc ->> 'magicName',
        NULLIF (sc ->> 'abilityId', '')::uuid,
        NULLIF (sc ->> 'maxSpellLevel', '')::int,
        CASE WHEN sc ? 'charges'
            AND sc -> 'charges' IS NOT NULL THEN
            upsert_charges (sc -> 'charges', existing_charge_id)
        ELSE
            existing_charge_id
        END AS charge_id
    FROM
        computed_charges
    ON CONFLICT (class_id)
        DO UPDATE SET
            magic_name = excluded.magic_name,
            ability_id = excluded.ability_id,
            max_spell_level = excluded.max_spell_level,
            charge_id = excluded.charge_id;

    DELETE FROM public.class_spellcasting cs
    WHERE cs.class_id = v_id
        AND (NOT json_data ? 'spellcasting'
            OR (json_data ->> 'spellcasting') IS NULL);

    -- 🧩 Spellcasting attributeIds
    INSERT INTO public.class_spellcasting_attributes (class_id, attribute_id)
    SELECT
        v_id AS class_id,
        x::uuid AS attribute_id
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(json_data -> 'spellcasting' -> 'attributeIds') AS x
    WHERE
        json_data ? 'spellcasting'
        AND (json_data -> 'spellcasting') ? 'attributeIds'
        AND JSONB_TYPEOF(json_data -> 'spellcasting' -> 'attributeIds') = 'array'
        AND JSONB_ARRAY_LENGTH(json_data -> 'spellcasting' -> 'attributeIds') > 0
    ON CONFLICT (class_id, attribute_id)
        DO NOTHING;

    DELETE FROM public.class_spellcasting_attributes csa
    WHERE csa.class_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'spellcasting' -> 'attributeIds', '[]'::jsonb)) AS x
            WHERE
                x::uuid = csa.attribute_id);

    -- 🧩 Spellcasting prepareLimit.methodIds
    INSERT INTO public.class_spell_prepare_methods (class_id, method_id)
    SELECT
        v_id,
        NULLIF (x::text, '')::uuid
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'spellcasting' -> 'prepareLimit' -> 'methodIds', '[]'::jsonb)) AS x
    ON CONFLICT (class_id, method_id)
        DO NOTHING;

    DELETE FROM public.class_spell_prepare_methods cspm
    WHERE cspm.class_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'spellcasting' -> 'prepareLimit' -> 'methodIds', '[]'::jsonb)) AS method
            WHERE
                NULLIF (method::text, '')::uuid = cspm.method_id);

    -- 🧩 Spellcasting prepareLimit.measurementId/roundingId
    INSERT INTO public.class_spell_prepare_level (class_id, measurement_id, rounding_id)
    SELECT
        v_id,
        NULLIF (json_data -> 'spellcasting' -> 'prepareLimit' ->> 'measurementId', '')::uuid,
        NULLIF (json_data -> 'spellcasting' -> 'prepareLimit' ->> 'roundingId', '')::uuid
    WHERE
        json_data ? 'spellcasting'
        AND (json_data -> 'spellcasting') ? 'prepareLimit'
        AND (json_data -> 'spellcasting' -> 'prepareLimit') ? 'measurementId'
        AND (json_data -> 'spellcasting' -> 'prepareLimit' -> 'measurementId') IS NOT NULL
    ON CONFLICT (class_id)
        DO UPDATE SET
            measurement_id = excluded.measurement_id,
            rounding_id = excluded.rounding_id;

    -- 🧩 Spellcasting limits by class level
    DELETE FROM public.class_level_attributes cla
    WHERE cla.class_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spellcasting' -> 'spellLimits', '[]'::jsonb)) AS scl
            WHERE
                NULLIF (scl ->> 'classLevel', '')::int = cla.level);

    INSERT INTO public.class_level_attributes (class_id, level, resource_points, spells_known_limit, cantrips_known_limit)
    SELECT
        v_id AS class_id,
        NULLIF (scl ->> 'classLevel', '')::int AS level,
        NULL AS resource_points,
        NULLIF (scl ->> 'spellsLimit', '')::int,
        NULLIF (scl ->> 'cantripsLimit', '')::int
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spellcasting' -> 'spellLimits', '[]'::jsonb)) AS scl
    ON CONFLICT (class_id, level)
        DO UPDATE SET
            resource_points = excluded.resource_points,
            spells_known_limit = excluded.spells_known_limit,
            cantrips_known_limit = excluded.cantrips_known_limit;

    -- 🧩 Spell slots per class level
    DELETE FROM public.class_level_spell_slots cls
    WHERE cls.class_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spellcasting' -> 'spellLimits', '[]'::jsonb)) AS scl
            CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(COALESCE(scl -> 'slots', '[]'::jsonb))
            WITH ORDINALITY AS slot (obj, ord)
        WHERE (scl ->> 'classLevel')::int = cls.level
        AND (COALESCE((slot.obj ->> 'spellLevel')::int, slot.ord) = cls.slot_level));

    WITH ROWS AS (
        SELECT
            v_id AS class_id,
            scl AS level_obj
        FROM
            JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spellcasting' -> 'spellLimits', '[]'::jsonb)) AS scl)
    INSERT INTO public.class_level_spell_slots (class_id, level, slot_level, slot_count)
    SELECT
        rows.class_id,
        NULLIF (rows.level_obj ->> 'classLevel', '')::int AS level,
        COALESCE((slot.obj ->> 'spellLevel')::int, slot.ord) AS slot_level,
        NULLIF (slot.obj ->> 'slotCount', '')::int AS slot_count
    FROM
        ROWS
        CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(COALESCE(rows.level_obj -> 'slots', '[]'::jsonb))
        WITH ORDINALITY AS slot (obj, ord)
    WHERE
        rows.level_obj ? 'slots'
        AND (rows.level_obj -> 'slots') IS NOT NULL
    ON CONFLICT (class_id,
        level,
        slot_level)
        DO UPDATE SET
            slot_count = excluded.slot_count;

    -- 🧩 Class Resource
    DELETE FROM public.class_resource cr
    WHERE cr.class_id = v_id
        AND (NOT json_data ? 'resource'
            OR (json_data -> 'resource') IS NULL);

    -- 🧩 Class Resource with safe charges update
    WITH ROWS AS (
        SELECT
            v_id AS class_id,
            json_data -> 'resource' AS res
        WHERE
            json_data ? 'resource'
    ),
    computed_charges AS (
        SELECT
            r.class_id AS class_id,
            r.res AS res,
            cr.charge_id AS existing_charge_id
        FROM
            ROWS r
            LEFT JOIN public.class_resource cr ON cr.class_id = r.class_id)
    INSERT INTO public.class_resource (class_id, label, level_available, charge_id, description)
    SELECT
        class_id,
        res ->> 'label',
        COALESCE(NULLIF (res ->> 'level_available', '')::int, 1),
        CASE WHEN res ? 'charges'
            AND res -> 'charges' IS NOT NULL THEN
            upsert_charges (res -> 'charges', existing_charge_id)
        ELSE
            existing_charge_id
        END AS charge_id,
        res ->> 'desc'
    FROM
        computed_charges
    ON CONFLICT (class_id)
        DO UPDATE SET
            label = excluded.label,
            level_available = excluded.level_available,
            charge_id = excluded.charge_id,
            description = excluded.description;

    -- 🧩 MULTICLASS (New tree model)
    IF json_data ? 'multiclass'
    THEN
        -- Ensure stable and unique ID
        IF v_multiclass_id IS NULL THEN
            v_multiclass_id := gen_random_uuid();
        END IF;

        -- Upsert root multiclass row
        INSERT INTO public.class_multiclass (id, class_id)
        VALUES (v_multiclass_id, v_id)
        ON CONFLICT (id) DO UPDATE
            SET class_id = EXCLUDED.class_id;

        -- Only one multiclass per class
        DELETE FROM public.class_multiclass
        WHERE class_id = v_id
          AND id <> v_multiclass_id;

        ----------------------------------------------------------------------------
        -- 🟦 Multiclass Proficiencies (diff-based)
        ----------------------------------------------------------------------------
        IF json_data->'multiclass' ? 'proficiencies' THEN

            -- upsert subfeature objects first
            FOR rec IN
                SELECT obj
                FROM jsonb_array_elements(json_data->'multiclass'->'proficiencies')
                    WITH ORDINALITY AS x(obj, ord)
            LOOP
                PERFORM public.upsert_subfeature_proficiencies(rec.obj);
            END LOOP;

            -- upsert bridge rows
            INSERT INTO public.class_multiclass_subfeature_proficiencies (
                class_multiclass_id,
                subfeature_proficiency_id,
                position
            )
            SELECT
                v_multiclass_id,
                (obj->>'id')::uuid,
                ord
            FROM jsonb_array_elements(json_data->'multiclass'->'proficiencies')
                 WITH ORDINALITY AS x(obj, ord)
            ON CONFLICT (class_multiclass_id, subfeature_proficiency_id)
                DO UPDATE SET position = excluded.position;

            -- diff delete
            DELETE FROM public.class_multiclass_subfeature_proficiencies p
            WHERE p.class_multiclass_id = v_multiclass_id
              AND NOT EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements(json_data->'multiclass'->'proficiencies') AS j(obj)
                  WHERE (j.obj->>'id')::uuid = p.subfeature_proficiency_id
              );

        ELSE
            DELETE FROM public.class_multiclass_subfeature_proficiencies
            WHERE class_multiclass_id = v_multiclass_id;
        END IF;

        ----------------------------------------------------------------------------
        -- 🟩 Multiclass Requirements (diff-based, ANY depth)
        ----------------------------------------------------------------------------
        IF json_data->'multiclass' ? 'requirements'
        THEN
            DECLARE
                v_ids uuid[] := ARRAY[]::uuid[];
            BEGIN
                -- recursively upsert entire tree, collecting ids
                PERFORM public.upsert_multiclass_rule(
                    v_multiclass_id,
                    NULL,
                    json_data->'multiclass'->'requirements',
                    1,
                    v_ids
                );

                -- delete rules NOT in JSON tree
                DELETE FROM public.class_multiclass_rule r
                WHERE r.multiclass_id = v_multiclass_id
                  AND r.id <> ALL (v_ids);
            END;

        ELSE
            DELETE FROM public.class_multiclass_rule
            WHERE multiclass_id = v_multiclass_id;
        END IF;

        ----------------------------------------------------------------------------
        -- Remove full multiclass container only if completely empty
        ----------------------------------------------------------------------------
        IF NOT (json_data->'multiclass' ? 'proficiencies')
           AND NOT (json_data->'multiclass' ? 'requirements')
        THEN
            DELETE FROM public.class_multiclass WHERE id = v_multiclass_id;
        END IF;

    ELSE
        -- No multiclass object at all
        DELETE FROM public.class_multiclass WHERE class_id = v_id;
    END IF;

    -- 🧩 Features
    INSERT INTO public.class_features (class_id, feature_id, position)
    SELECT
        v_id AS class_id,
        (feature.obj ->> 'id')::uuid AS feature_id,
        feature.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'features', '[]'::jsonb))
        WITH ORDINALITY AS feature (obj, ord)
        ON CONFLICT (class_id, feature_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'features', '[]'::jsonb))
             WITH ORDINALITY AS feature(obj, ord)
    LOOP
        PERFORM public.upsert_features (rec.obj);

    END LOOP;

    DELETE FROM public.class_features cf
    WHERE cf.class_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'features', '[]'::jsonb)) AS feature(obj)
            WHERE (feature.obj ->> 'id')::uuid = cf.feature_id);

    -- 🧩 Proficiencies
    INSERT INTO public.class_subfeature_proficiencies (class_id, subfeature_proficiency_id, position)
    SELECT
        v_id AS class_id,
        (proficiency.obj ->> 'id')::uuid AS subfeature_proficiency_id,
        proficiency.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'proficiencies', '[]'::jsonb))
        WITH ORDINALITY AS proficiency (obj, ord)
        ON CONFLICT (class_id, subfeature_proficiency_id)
            DO UPDATE SET
                position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'proficiencies', '[]'::jsonb))
             WITH ORDINALITY AS proficiency(obj)
    LOOP
        PERFORM public.upsert_subfeature_proficiencies (rec.obj);

    END LOOP;

    DELETE FROM public.class_subfeature_proficiencies csp
    WHERE csp.class_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'proficiencies', '[]'::jsonb)) AS proficiency(obj)
            WHERE (proficiency.obj ->> 'id')::uuid = csp.subfeature_proficiency_id);

    RETURN v_id;

END
$$;