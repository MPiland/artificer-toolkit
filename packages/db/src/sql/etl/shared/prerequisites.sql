/**********************************************************************
 * ENUMS
 *********************************************************************/
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'prerequisite_role'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.prerequisite_role AS ENUM ('GATE','FILTER','BOTH');
    END IF;
END;
$$;

/**********************************************************************
 * MAIN TABLE: prerequisites
 *********************************************************************/
CREATE TABLE IF NOT EXISTS public.prerequisites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),

    category_id uuid NOT NULL
        REFERENCES public.system_prereqs (id)
        ON DELETE RESTRICT DEFERRABLE,

    role public.prerequisite_role NOT NULL,

    number_equipped integer,
    ability_score integer,
    equip_category_id uuid
        REFERENCES public.system_equip_opts (id)
        ON DELETE SET NULL DEFERRABLE,

    position integer NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_pr_role ON public.prerequisites (role);
CREATE INDEX IF NOT EXISTS idx_pr_category_id ON public.prerequisites (category_id);

/* Updated-at Trigger */
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_prerequisites_updated_at'
          AND tgrelid = 'public.prerequisites'::regclass
    ) THEN
        CREATE TRIGGER trg_prerequisites_updated_at
        BEFORE UPDATE ON public.prerequisites
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END;
$$;

ALTER TABLE IF EXISTS public.prerequisites ENABLE ROW LEVEL SECURITY;

/**********************************************************************
 * JOIN TABLES (each attaches directly to prerequisites.id)
**********************************************************************/

/* Spells */
CREATE TABLE IF NOT EXISTS public.prerequisite_spells (
    prerequisite_id uuid NOT NULL
        REFERENCES public.prerequisites (id)
        ON DELETE CASCADE DEFERRABLE,

    spell_id uuid NOT NULL
        REFERENCES public.spells (id)
        ON DELETE CASCADE DEFERRABLE,

    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),

    PRIMARY KEY (prerequisite_id, spell_id)
);

CREATE INDEX IF NOT EXISTS idx_pr_spell_id ON public.prerequisite_spells (spell_id);

/* trigger */
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_prerequisite_spells_updated_at'
          AND tgrelid = 'public.prerequisite_spells'::regclass
    ) THEN
        CREATE TRIGGER trg_prerequisite_spells_updated_at
        BEFORE UPDATE ON public.prerequisite_spells
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END;
$$;

ALTER TABLE public.prerequisite_spells ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pr_skill_id ON public.prerequisite_skills (skill_id);


/* Skills */
CREATE TABLE IF NOT EXISTS public.prerequisite_skills (
    prerequisite_id uuid NOT NULL REFERENCES public.prerequisites (id) ON DELETE CASCADE DEFERRABLE,
    skill_id uuid NOT NULL REFERENCES public.system_skills (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (prerequisite_id, skill_id)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prerequisite_skills_updated_at') THEN
        CREATE TRIGGER trg_prerequisite_skills_updated_at
            BEFORE UPDATE ON public.prerequisite_skills
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END;
$$;

ALTER TABLE public.prerequisite_skills ENABLE ROW LEVEL SECURITY;


/* Sizes */
CREATE TABLE IF NOT EXISTS public.prerequisite_sizes (
    prerequisite_id uuid NOT NULL REFERENCES public.prerequisites (id) ON DELETE CASCADE DEFERRABLE,
    size_id uuid NOT NULL REFERENCES public.system_sizes (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (prerequisite_id, size_id)
);

CREATE INDEX IF NOT EXISTS idx_pr_size_id ON public.prerequisite_sizes (size_id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prerequisite_sizes_updated_at') THEN
        CREATE TRIGGER trg_prerequisite_sizes_updated_at
            BEFORE UPDATE ON public.prerequisite_sizes
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END;
$$;

ALTER TABLE public.prerequisite_sizes ENABLE ROW LEVEL SECURITY;


/* Features */
CREATE TABLE IF NOT EXISTS public.prerequisite_features (
    prerequisite_id uuid NOT NULL REFERENCES public.prerequisites (id) ON DELETE CASCADE DEFERRABLE,
    feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (prerequisite_id, feature_id)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prerequisite_features_updated_at') THEN
        CREATE TRIGGER trg_prerequisite_features_updated_at
            BEFORE UPDATE ON public.prerequisite_features
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END;
$$;

ALTER TABLE public.prerequisite_features ENABLE ROW LEVEL SECURITY;


/* Subfeature Options */
CREATE TABLE IF NOT EXISTS public.prerequisite_subfeature_options (
    prerequisite_id uuid NOT NULL REFERENCES public.prerequisites (id) ON DELETE CASCADE DEFERRABLE,
    subfeature_option_id uuid NOT NULL REFERENCES public.subfeature_options (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (prerequisite_id, subfeature_option_id)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prerequisite_subfeature_options_updated_at') THEN
        CREATE TRIGGER trg_prerequisite_subfeature_options_updated_at
            BEFORE UPDATE ON public.prerequisite_subfeature_options
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END;
$$;

ALTER TABLE public.prerequisite_subfeature_options ENABLE ROW LEVEL SECURITY;


/* Equipment */
CREATE TABLE IF NOT EXISTS public.prerequisite_equipment (
    prerequisite_id uuid NOT NULL REFERENCES public.prerequisites (id) ON DELETE CASCADE DEFERRABLE,
    equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (prerequisite_id, equipment_id)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prerequisite_equipment_updated_at') THEN
        CREATE TRIGGER trg_prerequisite_equipment_updated_at
            BEFORE UPDATE ON public.prerequisite_equipment
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END;
$$;

ALTER TABLE public.prerequisite_equipment ENABLE ROW LEVEL SECURITY;


/* Equipment Properties */
CREATE TABLE IF NOT EXISTS public.prerequisite_properties (
    prerequisite_id uuid NOT NULL REFERENCES public.prerequisites (id) ON DELETE CASCADE DEFERRABLE,
    property_id uuid NOT NULL REFERENCES public.system_equip_opts (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (prerequisite_id, property_id)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prerequisite_properties_updated_at') THEN
        CREATE TRIGGER trg_prerequisite_properties_updated_at
            BEFORE UPDATE ON public.prerequisite_properties
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END;
$$;

ALTER TABLE public.prerequisite_properties ENABLE ROW LEVEL SECURITY;


/* Abilities */
CREATE TABLE IF NOT EXISTS public.prerequisite_abilities (
    prerequisite_id uuid NOT NULL REFERENCES public.prerequisites (id) ON DELETE CASCADE DEFERRABLE,
    ability_id uuid NOT NULL REFERENCES public.system_abilities (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (prerequisite_id, ability_id)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prerequisite_abilities_updated_at') THEN
        CREATE TRIGGER trg_prerequisite_abilities_updated_at
            BEFORE UPDATE ON public.prerequisite_abilities
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END;
$$;

ALTER TABLE public.prerequisite_abilities ENABLE ROW LEVEL SECURITY;


/**********************************************************************
 * HELPER FUNCTION: upsert_prereq_items
 *********************************************************************/
CREATE OR REPLACE FUNCTION public.upsert_prereq_items (
    p_id uuid,
    p_json jsonb,
    p_table text,
    p_col text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Delete removed items
    EXECUTE format(
        'DELETE FROM public.%I WHERE prerequisite_id = $1
         AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(COALESCE($2, ''[]'')) AS val
            WHERE val::uuid = %I
         )',
        p_table, p_col
    )
    USING p_id, p_json;

    -- Insert new items
    EXECUTE format(
        'INSERT INTO public.%I(prerequisite_id, %I)
         SELECT $1, val::uuid
         FROM jsonb_array_elements_text(COALESCE($2, ''[]'')) AS val
         ON CONFLICT DO NOTHING',
        p_table, p_col
    )
    USING p_id, p_json;
END;
$$;


/**********************************************************************
 * MAIN UPSERT FUNCTION: upsert_prerequisites
 *********************************************************************/
CREATE OR REPLACE FUNCTION public.upsert_prerequisites (
    json_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    v_id uuid := COALESCE((json_data ->> 'id')::uuid, gen_random_uuid());
    v_role prerequisite_role := UPPER(COALESCE(json_data ->> 'role', 'GATE'));
    v_category_id uuid := (json_data ->> 'categoryId')::uuid;
    v_position int := COALESCE(NULLIF(json_data ->> 'position','')::int, 0);

    v_number_equipped int;
    v_ability_score int;
    v_equip_category_id uuid;
BEGIN
    IF json_data IS NULL THEN RETURN NULL; END IF;

    ---------------------------------------------------------------------
    -- Equipment metadata
    ---------------------------------------------------------------------
    IF json_data ? 'equipment' THEN
        v_number_equipped := NULLIF(json_data -> 'equipment' ->> 'numberEquipped', '')::int;
        v_equip_category_id := NULLIF(json_data -> 'equipment' ->> 'equipCategoryId', '')::uuid;
    ELSE
        v_number_equipped := NULL;
        v_equip_category_id := NULL;
    END IF;

    if json_data ? 'abilityScore' THEN
        v_ability_score := (json_data -> 'abilityScore' ->> 'score')::int;
    ELSE
        v_ability_score := NULL;
    END IF;

    ---------------------------------------------------------------------
    -- Upsert prerequisite row
    ---------------------------------------------------------------------
    INSERT INTO public.prerequisites (
        id, category_id, role,
        number_equipped, ability_score, equip_category_id,
        position
    )
    VALUES (
        v_id, v_category_id, v_role,
        v_number_equipped, v_ability_score, v_equip_category_id,
        v_position
    )
    ON CONFLICT (id) DO UPDATE SET
        category_id = EXCLUDED.category_id,
        role = EXCLUDED.role,
        number_equipped = EXCLUDED.number_equipped,
        equip_category_id = EXCLUDED.equip_category_id,
        position = EXCLUDED.position,
        updated_at = NOW();

    ---------------------------------------------------------------------
    -- JOIN TABLES — ADD INSERT/DELETE BEHAVIOR
    --
    -- If JSON key is missing → DELETE ALL rows for that table
    -- If JSON key exists → upsert_prereq_items will insert new + delete removed
    ---------------------------------------------------------------------

    -- Skills
    IF json_data ? 'skillIds' THEN
        PERFORM public.upsert_prereq_items(v_id, json_data -> 'skillIds',
                                           'prerequisite_skills', 'skill_id');
        DELETE FROM public.prerequisite_skills ps
        WHERE prerequisite_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'skillIds', '[]'::jsonb)) AS skillIds(obj)
            WHERE (skillIds.obj ->> 'id')::uuid = ps.skill_id
        );
    END IF;

    -- Spells
    IF json_data ? 'spellIds' THEN
        PERFORM public.upsert_prereq_items(v_id, json_data -> 'spellIds',
                                           'prerequisite_spells', 'spell_id');

        DELETE FROM public.prerequisite_spells ps
        WHERE prerequisite_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spellIds', '[]'::jsonb)) AS spellIds(obj)
            WHERE (spellIds.obj ->> 'id')::uuid = ps.spell_id
        );
    END IF;

    -- Sizes
    IF json_data ? 'sizeIds' THEN
        PERFORM public.upsert_prereq_items(v_id, json_data -> 'sizeIds',
                                           'prerequisite_sizes', 'size_id');
                                           
        DELETE FROM public.prerequisite_sizes ps
        WHERE prerequisite_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'sizeIds', '[]'::jsonb)) AS sizeIds(obj)
            WHERE (sizeIds.obj ->> 'id')::uuid = ps.size_id
        );
    END IF;

    -- Features
    IF json_data ? 'featureIds' THEN
        PERFORM public.upsert_prereq_items(v_id, json_data -> 'featureIds',
                                           'prerequisite_features', 'feature_id');
                                           
        DELETE FROM public.prerequisite_features pf
        WHERE prerequisite_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'featureIds', '[]'::jsonb)) AS featureIds(obj)
            WHERE (featureIds.obj ->> 'id')::uuid = pf.feature_id
        );
    END IF;

    -- Subfeature Options
    IF json_data ? 'subfeatureOptionIds' THEN
        PERFORM public.upsert_prereq_items(v_id, json_data -> 'subfeatureOptionIds',
                                           'prerequisite_subfeature_options', 'subfeature_option_id');
                                           
        DELETE FROM public.prerequisite_subfeature_options pso
        WHERE prerequisite_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'subfeatureOptionIds', '[]'::jsonb)) AS subfeatureOptionIds(obj)
            WHERE (subfeatureOptionIds.obj ->> 'id')::uuid = pso.subfeature_option_id
        );
    END IF;

    ---------------------------------------------------------------------
    -- Equipment join tables
    ---------------------------------------------------------------------
    IF json_data ? 'equipment' THEN
        PERFORM public.upsert_prereq_items(v_id,
            json_data -> 'equipment' -> 'equipmentIds',
            'prerequisite_equipment',
            'equipment_id'
        );

        PERFORM public.upsert_prereq_items(v_id,
            json_data -> 'equipment' -> 'propertyIds',
            'prerequisite_properties',
            'property_id'
        );
        
        DELETE FROM public.prerequisite_equipment pe
        WHERE prerequisite_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'equipment', '[]'::jsonb)) AS equipment(obj)
            WHERE (equipment.obj ->> 'id')::uuid = pe.equipment_id
        );

        DELETE FROM public.prerequisite_properties pp
        WHERE prerequisite_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'equipment', '[]'::jsonb)) AS equipment(obj)
            WHERE (equipment.obj ->> 'id')::uuid = pp.property_id
        );
    END IF;

    ---------------------------------------------------------------------
    -- Ability Score special case
    --
    -- If abilityScore exists → full replace
    -- If abilityScore is missing → delete all ability prerequisites
    ---------------------------------------------------------------------
        INSERT INTO public.prerequisite_abilities (prerequisite_id, ability_id)
        SELECT
            v_id,
            val::uuid
        FROM jsonb_array_elements_text(
            COALESCE(json_data -> 'abilityScore' -> 'abilities', '[]')
        ) AS val
        ON CONFLICT DO NOTHING;

        DELETE FROM public.prerequisite_abilities pa
        WHERE prerequisite_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'abilityScore', '[]'::jsonb)) AS abilityScore(obj)
            WHERE (abilityScore.obj ->> 'id')::uuid = pa.ability_id
        );

    RETURN v_id;
END;
$$;
