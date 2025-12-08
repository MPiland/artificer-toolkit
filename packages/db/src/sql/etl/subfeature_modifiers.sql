/***************************
 * TABLES
 ***************************/
CREATE TABLE IF NOT EXISTS public.subfeature_modifiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    subtype_id uuid REFERENCES public.class_subtypes (id) ON DELETE SET NULL DEFERRABLE,
    selection_count integer,
    category_id uuid REFERENCES public.system_mod_opts (id) ON DELETE SET NULL DEFERRABLE,
    type_id uuid REFERENCES public.system_mod_opts (id) ON DELETE SET NULL DEFERRABLE,
    method_id uuid REFERENCES public.system_mod_opts (id) ON DELETE SET NULL DEFERRABLE,
    method_ability_id uuid REFERENCES public.system_abilities (id) ON DELETE SET NULL DEFERRABLE,
    method_skill_id uuid REFERENCES public.system_skills (id) ON DELETE SET NULL DEFERRABLE,
    use_all boolean DEFAULT FALSE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subfeature_modifiers_category_id ON public.subfeature_modifiers (category_id);

CREATE INDEX IF NOT EXISTS idx_subfeature_modifiers_type_id ON public.subfeature_modifiers (type_id);

CREATE INDEX IF NOT EXISTS idx_subfeature_modifiers_method_id ON public.subfeature_modifiers (method_id);

CREATE INDEX IF NOT EXISTS idx_subfeature_modifiers_method_ability_id ON public.subfeature_modifiers (method_ability_id);

CREATE INDEX IF NOT EXISTS idx_subfeature_modifiers_method_skill_id ON public.subfeature_modifiers (method_skill_id);

CREATE INDEX IF NOT EXISTS idx_subfeature_modifiers_subtype_id ON public.subfeature_modifiers (subtype_id);

-- Bridge: subfeature_modifiers ⇄ prerequisites
CREATE TABLE IF NOT EXISTS public.subfeature_modifier_prerequisites (
    subfeature_modifier_id uuid NOT NULL REFERENCES public.subfeature_modifiers (id) ON DELETE CASCADE DEFERRABLE,
    prerequisite_id uuid NOT NULL REFERENCES public.prerequisites (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_modifier_id, prerequisite_id)
);

ALTER TABLE IF EXISTS public.subfeature_modifier_prerequisites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sfmd_prereqs_modifier_id ON public.subfeature_modifier_prerequisites (subfeature_modifier_id);

CREATE INDEX IF NOT EXISTS idx_sfmd_prereqs_position ON public.subfeature_modifier_prerequisites (subfeature_modifier_id, position);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_subfeature_modifier_prerequisites_updated_at'
          AND tgrelid = 'public.subfeature_modifier_prerequisites'::regclass
    ) THEN
        CREATE TRIGGER trg_subfeature_modifier_prerequisites_updated_at
        BEFORE UPDATE ON public.subfeature_modifier_prerequisites
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
            tgname = 'trg_subfeature_modifiers_updated_at'
            AND tgrelid = 'public.subfeature_modifiers'::regclass) THEN
    CREATE TRIGGER trg_subfeature_modifiers_updated_at
        BEFORE UPDATE ON public.subfeature_modifiers
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_modifiers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subfeature_modifier_attributes (
    subfeature_modifier_id uuid NOT NULL REFERENCES public.subfeature_modifiers (id) ON DELETE CASCADE DEFERRABLE,
    attribute_id uuid NOT NULL REFERENCES public.system_attributes (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_modifier_id, attribute_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_modifier_attributes_updated_at'
            AND tgrelid = 'public.subfeature_modifier_attributes'::regclass) THEN
    CREATE TRIGGER trg_subfeature_modifier_attributes_updated_at
        BEFORE UPDATE ON public.subfeature_modifier_attributes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_modifier_attributes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sfm_attr_attr_id ON public.subfeature_modifier_attributes (attribute_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_cleanup_subfeature_modifier_owned'
            AND tgrelid = 'public.subfeature_modifiers'::regclass) THEN
    CREATE TRIGGER trg_cleanup_subfeature_modifier_owned
        AFTER DELETE ON public.subfeature_modifiers
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[]' );
END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.subfeature_modifier_targets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subfeature_modifier_id uuid NOT NULL REFERENCES public.subfeature_modifiers (id) ON DELETE CASCADE DEFERRABLE,
    
    -- 🧩 Possible target references (only one type per row normally)
    feature_id uuid REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
    ability_id uuid REFERENCES public.system_abilities (id) ON DELETE CASCADE DEFERRABLE,
    skill_id uuid REFERENCES public.system_skills (id) ON DELETE CASCADE DEFERRABLE,
    save_ability_id uuid REFERENCES public.system_abilities (id) ON DELETE CASCADE DEFERRABLE,
    spell_id uuid REFERENCES public.spells (id) ON DELETE CASCADE DEFERRABLE,
    spell_category_id uuid REFERENCES public.system_mod_opts (id) ON DELETE CASCADE DEFERRABLE,
    speed_id uuid REFERENCES public.system_speeds (id) ON DELETE CASCADE DEFERRABLE,
    damage_type_id uuid REFERENCES public.system_damage_types (id) ON DELETE CASCADE DEFERRABLE,
    condition_id uuid REFERENCES public.system_conditions (id) ON DELETE CASCADE DEFERRABLE,
    range_id uuid REFERENCES public.system_ranges (id) ON DELETE CASCADE DEFERRABLE,
    shape_id uuid REFERENCES public.system_spell_opts (id) ON DELETE CASCADE DEFERRABLE,
    duration_id uuid REFERENCES public.system_spell_opts (id) ON DELETE CASCADE DEFERRABLE,
    charge_limit_id uuid REFERENCES public.system_charges (id) ON DELETE CASCADE DEFERRABLE,
    charge_reset_id uuid REFERENCES public.system_charges (id) ON DELETE CASCADE DEFERRABLE,

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
            tgname = 'trg_subfeature_modifier_targets_updated_at'
            AND tgrelid = 'public.subfeature_modifier_targets'::regclass) THEN
    CREATE TRIGGER trg_subfeature_modifier_targets_updated_at
        BEFORE UPDATE ON public.subfeature_modifier_targets
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_modifier_targets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subfeature_modifier_per_level (
    subfeature_modifier_id uuid NOT NULL
        REFERENCES public.subfeature_modifiers(id) ON DELETE CASCADE DEFERRABLE,
    level integer NOT NULL,
    die_config text,
    set_amount integer,
    uses integer,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subfeature_modifier_id, level)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_subfeature_modifier_per_level_updated_at'
            AND tgrelid = 'public.subfeature_modifier_per_level'::regclass) THEN
    CREATE TRIGGER trg_subfeature_modifier_per_level_updated_at
        BEFORE UPDATE ON public.subfeature_modifier_per_level
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_modifier_per_level ENABLE ROW LEVEL SECURITY;

/***************************
 * INDEXES
 ***************************/
CREATE INDEX IF NOT EXISTS idx_sfmt_modifier_id       ON public.subfeature_modifier_targets (subfeature_modifier_id);
CREATE INDEX IF NOT EXISTS idx_sfmt_ability_id        ON public.subfeature_modifier_targets (ability_id);
CREATE INDEX IF NOT EXISTS idx_sfmt_skill_id          ON public.subfeature_modifier_targets (skill_id);
CREATE INDEX IF NOT EXISTS idx_sfmt_spell_id          ON public.subfeature_modifier_targets (spell_id);
CREATE INDEX IF NOT EXISTS idx_sfmt_range_id          ON public.subfeature_modifier_targets (range_id);
CREATE INDEX IF NOT EXISTS idx_sfmt_shape_id          ON public.subfeature_modifier_targets (shape_id);
CREATE INDEX IF NOT EXISTS idx_sfmt_duration_id       ON public.subfeature_modifier_targets (duration_id);
CREATE INDEX IF NOT EXISTS idx_sfmt_charge_limit_id   ON public.subfeature_modifier_targets (charge_limit_id);
CREATE INDEX IF NOT EXISTS idx_sfmt_charge_reset_id   ON public.subfeature_modifier_targets (charge_reset_id);
CREATE INDEX IF NOT EXISTS idx_sfmt_damage_type_id    ON public.subfeature_modifier_targets (damage_type_id);
CREATE INDEX IF NOT EXISTS idx_sfmt_condition_id      ON public.subfeature_modifier_targets (condition_id);

CREATE TABLE IF NOT EXISTS public.subfeature_modifier_effects (
    subfeature_modifier_id uuid PRIMARY KEY 
        REFERENCES public.subfeature_modifiers(id) 
        ON DELETE CASCADE,
    min_amount int,
    max_amount int,
    set_amount int,
    add_amount int,
    multiplier numeric,       -- allow 0.5 (halving) or 2.0 (doubling)
    die_config text,
    distance int,
    amount int,
    size int,
    ability_id uuid REFERENCES public.system_abilities(id) ON DELETE SET NULL DEFERRABLE,
    unit_id uuid REFERENCES public.system_measure_units(id) ON DELETE SET NULL DEFERRABLE,
    damage_id uuid REFERENCES public.damages (id) ON DELETE SET NULL DEFERRABLE,
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
            tgname = 'trg_subfeature_modifier_effects_updated_at'
            AND tgrelid = 'public.subfeature_modifier_effects'::regclass) THEN
    CREATE TRIGGER trg_subfeature_modifier_effects_updated_at
        BEFORE UPDATE ON public.subfeature_modifier_effects
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
            tgname = 'trg_cleanup_subfeature_modifier_effects' 
            AND tgrelid = 'public.subfeature_modifier_effects'::regclass)  THEN
    CREATE TRIGGER trg_cleanup_subfeature_modifier_effects
        AFTER DELETE ON public.subfeature_modifier_effects
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.damages", "columns": ["damage_id"] }
      ]' );
END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_cleanup_subfeature_modifier_effects_update'
          AND tgrelid = 'public.subfeature_modifier_effects'::regclass
    ) THEN
        CREATE TRIGGER trg_cleanup_subfeature_modifier_effects_update
        BEFORE UPDATE ON public.subfeature_modifier_effects
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
          { "table": "public.damages", "columns": ["damage_id"] }
        ]');
    END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subfeature_modifier_effects ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sfm_effects_modifier_id
    ON public.subfeature_modifier_per_level (subfeature_modifier_id);

CREATE INDEX IF NOT EXISTS idx_sfm_effects_ability_id
    ON public.subfeature_modifier_effects (ability_id);

CREATE INDEX IF NOT EXISTS idx_sfm_effects_unit_id
    ON public.subfeature_modifier_effects (unit_id);

CREATE INDEX IF NOT EXISTS idx_sfm_effects_damage_id
    ON public.subfeature_modifier_effects (damage_id);


/***************************
 * FUNCTIONS
 ***************************/ 
CREATE OR REPLACE FUNCTION public.upsert_subfeature_modifiers(json_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SET
    search_path = pg_catalog, public
AS
    $upsert$
DECLARE
    v_id uuid := COALESCE((json_data ->> 'id')::uuid, gen_random_uuid());
    v_subtype_id uuid := (json_data ->> 'subtypeId')::uuid;
    v_selection_count integer := (json_data ->> 'selectionCount')::int;
    v_category_id uuid := (json_data ->> 'categoryId')::uuid;
    v_type_id uuid := (json_data ->> 'typeId')::uuid;
    v_method_id uuid := (json_data ->> 'methodId')::uuid;
    v_method_ability_id uuid := (json_data ->> 'methodAbilityId')::uuid;
    v_method_skill_id uuid := (json_data ->> 'methodSkillId')::uuid;
    v_use_all boolean := 
        jsonb_has_all(COALESCE(json_data -> 'targets' -> 'abilityIds', '[]'::jsonb))
        OR jsonb_has_all(COALESCE(json_data -> 'targets' -> 'skillIds', '[]'::jsonb))
        OR jsonb_has_all(COALESCE(json_data -> 'targets' -> 'saveAbilityIds', '[]'::jsonb))
        OR jsonb_has_all(COALESCE(json_data -> 'targets' -> 'spellIds', '[]'::jsonb))
        OR jsonb_has_all(COALESCE(json_data -> 'targets' -> 'damageTypeIds', '[]'::jsonb))
        OR jsonb_has_all(COALESCE(json_data -> 'targets' -> 'conditionIds', '[]'::jsonb))
        OR jsonb_has_all(COALESCE(json_data -> 'targets' -> 'speedIds', '[]'::jsonb));
BEGIN
    -- 🧩 1) Upsert prerequisites array via bridge
    IF json_data ? 'prerequisites' AND json_data -> 'prerequisites' IS NOT NULL THEN
        INSERT INTO public.subfeature_modifier_prerequisites (subfeature_modifier_id, prerequisite_id, position)
        SELECT v_id, public.upsert_prerequisites(elem.obj), elem.ord
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'prerequisites', '[]'::jsonb)) WITH ORDINALITY AS elem(obj, ord)
        ON CONFLICT (subfeature_modifier_id, prerequisite_id) DO UPDATE SET position = EXCLUDED.position;

        DELETE FROM public.subfeature_modifier_prerequisites smp
        WHERE smp.subfeature_modifier_id = v_id
          AND NOT EXISTS (
              SELECT 1 FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'prerequisites', '[]'::jsonb)) AS elem
              WHERE smp.prerequisite_id = (elem ->> 'id')::uuid
          );
    END IF;

    -- 🧩 2) Upsert core subfeature_modifiers row
    INSERT INTO public.subfeature_modifiers AS sm (
        id,
        subtype_id,
        selection_count,
        category_id,
        type_id,
        method_id,
        method_ability_id,
        method_skill_id,
        use_all
    )
    VALUES (
        v_id,
        v_subtype_id,
        v_selection_count,
        v_category_id,
        v_type_id,
        v_method_id,
        v_method_ability_id,
        v_method_skill_id,
        v_use_all
    )
    ON CONFLICT (id) DO UPDATE
    SET
        subtype_id = EXCLUDED.subtype_id,
        selection_count = EXCLUDED.selection_count,
        category_id = EXCLUDED.category_id,
        type_id = EXCLUDED.type_id,
        method_id = EXCLUDED.method_id,
        method_ability_id = EXCLUDED.method_ability_id,
        method_skill_id = EXCLUDED.method_skill_id,
        use_all = EXCLUDED.use_all;

    -- 🧩 3) Upsert attributes
    IF json_data ? 'attributeIds' THEN
        DELETE FROM public.subfeature_modifier_attributes WHERE subfeature_modifier_id = v_id;

        INSERT INTO public.subfeature_modifier_attributes (subfeature_modifier_id, attribute_id)
        SELECT v_id, (attr_id)::uuid
        FROM jsonb_array_elements_text(json_data -> 'attributeIds') AS attr_id;
    END IF;

    -- 🧩 4) Upsert targets
    IF json_data ? 'targets' AND NOT v_use_all THEN
        PERFORM public.upsert_subfeature_modifier_targets(json_data -> 'targets', v_id);
    END IF;

    -- 🧩 5) Upsert effect
    IF json_data ? 'effect' THEN
        PERFORM public.upsert_subfeature_modifier_effects(json_data -> 'effect', v_id);
    END IF;

    RETURN v_id;
END;
$upsert$;

CREATE OR REPLACE FUNCTION public.upsert_subfeature_modifier_targets(targets jsonb, modifier_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $targets$
DECLARE
    v_feature_id uuid := (targets ->> 'featureId')::uuid;
    v_spell_category_id uuid := (targets ->> 'spellCategoryId')::uuid;
    v_range_id uuid := (targets ->> 'rangeId')::uuid;
    v_shape_id uuid := (targets ->> 'shapeId')::uuid;
    v_duration_id uuid := (targets ->> 'durationId')::uuid;
    v_charge_limit_id uuid := (targets ->> 'chargeLimitId')::uuid;
    v_charge_reset_id uuid := (targets ->> 'chargeResetId')::uuid;
BEGIN
    -- Clear previous targets
    DELETE FROM public.subfeature_modifier_targets WHERE subfeature_modifier_id = modifier_id;

    -- Core mechanics
    INSERT INTO public.subfeature_modifier_targets (subfeature_modifier_id, ability_id)
    SELECT modifier_id, (val)::uuid
    FROM jsonb_array_elements_text(COALESCE(targets -> 'abilityIds', '[]'::jsonb)) AS val
    WHERE val <> 'all';

    INSERT INTO public.subfeature_modifier_targets (subfeature_modifier_id, skill_id)
    SELECT modifier_id, (val)::uuid
    FROM jsonb_array_elements_text(COALESCE(targets -> 'skillIds', '[]'::jsonb)) AS val
    WHERE val <> 'all';

    INSERT INTO public.subfeature_modifier_targets (subfeature_modifier_id, save_ability_id)
    SELECT modifier_id, (val)::uuid
    FROM jsonb_array_elements_text(COALESCE(targets -> 'saveAbilityIds', '[]'::jsonb)) AS val
    WHERE val <> 'all';

    -- Spells, damage types, etc.
    INSERT INTO public.subfeature_modifier_targets (subfeature_modifier_id, spell_id)
    SELECT modifier_id, (val)::uuid
    FROM jsonb_array_elements_text(COALESCE(targets -> 'spellIds', '[]'::jsonb)) AS val
    WHERE val <> 'all';

    INSERT INTO public.subfeature_modifier_targets (subfeature_modifier_id, damage_type_id)
    SELECT modifier_id, (val)::uuid
    FROM jsonb_array_elements_text(COALESCE(targets -> 'damageTypeIds', '[]'::jsonb)) AS val
    WHERE val <> 'all';

    INSERT INTO public.subfeature_modifier_targets (subfeature_modifier_id, condition_id)
    SELECT modifier_id, (val)::uuid
    FROM jsonb_array_elements_text(COALESCE(targets -> 'conditionIds', '[]'::jsonb)) AS val
    WHERE val <> 'all';

    INSERT INTO public.subfeature_modifier_targets (subfeature_modifier_id, speed_id)
    SELECT modifier_id, (val)::uuid
    FROM jsonb_array_elements_text(COALESCE(targets -> 'speedIds', '[]'::jsonb)) AS val
    WHERE val <> 'all';

    -- Single FK targets
    IF v_feature_id IS NOT NULL OR
       v_spell_category_id IS NOT NULL OR
       v_range_id IS NOT NULL OR
       v_shape_id IS NOT NULL OR
       v_duration_id IS NOT NULL OR
       v_charge_limit_id IS NOT NULL OR
       v_charge_reset_id IS NOT NULL THEN

        INSERT INTO public.subfeature_modifier_targets (
            subfeature_modifier_id,
            feature_id,
            spell_category_id,
            range_id,
            shape_id,
            duration_id,
            charge_limit_id,
            charge_reset_id
        )
        VALUES (
            modifier_id,
            v_feature_id,
            v_spell_category_id,
            v_range_id,
            v_shape_id,
            v_duration_id,
            v_charge_limit_id,
            v_charge_reset_id
        );
    END IF;
END;
$targets$;

CREATE OR REPLACE FUNCTION public.upsert_subfeature_modifier_effects(
    effect jsonb,
    modifier_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $effect$
DECLARE
    -- flatten to one array for easier dedupe
    v_all_levels jsonb := '[]'::jsonb;
    v_entry jsonb;
    v_lvl int;

    v_min_amount int := (effect ->> 'minAmount')::int;
    v_max_amount int := (effect ->> 'maxAmount')::int;
    v_set_amount int := (effect ->> 'setAmount')::int;
    v_add_amount int := (effect ->> 'addAmount')::int;
    v_multiplier numeric := (effect ->> 'multiplier')::numeric;
    v_die_config text := effect ->> 'dieConfig';
    v_distance int := (effect ->> 'distance')::int;
    v_unit_id uuid := (effect ->> 'unitId')::uuid;
    v_amount int := (effect ->> 'amount')::int;
    v_ability_id uuid := (effect ->> 'abilityId')::uuid;
    v_size int := (effect ->> 'size')::int;
    v_damage_id uuid := (effect -> 'damage' ->> 'id')::uuid;
BEGIN
    /********************************************
     * 1) UPSERT ROOT EFFECT ROW (1:1 with modifier)
     ********************************************/
    IF effect ? 'damage' AND effect -> 'damage' IS NOT NULL THEN
        v_damage_id := upsert_damages(effect -> 'damage', v_damage_id);
    END IF;

    INSERT INTO public.subfeature_modifier_effects (
        subfeature_modifier_id,
        min_amount,
        max_amount,
        set_amount,
        add_amount,
        multiplier,
        die_config,
        distance,
        unit_id,
        amount,
        ability_id,
        size,
        damage_id
    )
    VALUES (
        modifier_id,
        v_min_amount,
        v_max_amount,
        v_set_amount,
        v_add_amount,
        v_multiplier,
        v_die_config,
        v_distance,
        v_unit_id,
        v_amount,
        v_ability_id,
        v_size,
        v_damage_id
    )
    ON CONFLICT (subfeature_modifier_id) DO UPDATE SET
        min_amount = EXCLUDED.min_amount,
        max_amount = EXCLUDED.max_amount,
        set_amount = EXCLUDED.set_amount,
        add_amount = EXCLUDED.add_amount,
        multiplier = EXCLUDED.multiplier,
        die_config = EXCLUDED.die_config,
        distance = EXCLUDED.distance,
        amount = EXCLUDED.amount,
        ability_id = EXCLUDED.ability_id,
        unit_id = EXCLUDED.unit_id,
        damage_id = EXCLUDED.damage_id,
        size = EXCLUDED.size;



    /********************************************
     * 2) Build a unified list of all levels
     ********************************************/
    v_all_levels :=
        COALESCE(effect -> 'scalePerLevel', '[]'::jsonb) ||
        COALESCE(effect -> 'usesPerLevel', '[]'::jsonb);



    /********************************************
     * 3) UPSERT ALL per-level rows
     ********************************************/
    FOR v_entry IN SELECT * FROM jsonb_array_elements(v_all_levels)
    LOOP
        v_lvl := (v_entry ->> 'level')::int;

        INSERT INTO public.subfeature_modifier_per_level (
            subfeature_modifier_id,
            level,
            die_config,
            set_amount,
            uses
        )
        VALUES (
            modifier_id,
            v_lvl,
            v_entry ->> 'dieConfig',
            (v_entry ->> 'setAmount')::int,
            (v_entry ->> 'uses')::int
        )
        ON CONFLICT (subfeature_modifier_id, level) DO UPDATE SET
            die_config = EXCLUDED.die_config,
            set_amount = EXCLUDED.set_amount,
            uses = EXCLUDED.uses;
    END LOOP;



    /********************************************
     * 4) DELETE STALE LEVELS
     ********************************************/
    DELETE FROM public.subfeature_modifier_per_level pl
    WHERE pl.subfeature_modifier_id = modifier_id
      AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(v_all_levels) AS e
            WHERE (e ->> 'level')::int = pl.level
        );

END;
$effect$;