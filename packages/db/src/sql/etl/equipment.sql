/***************************
 * TABLES
 ***************************/
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'measure_kind'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.measure_kind AS ENUM (
            'WEIGHT',
            'CAPACITY',
            'SPEED'
        );
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.equipment (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE DEFERRABLE,
    is_master boolean NOT NULL DEFAULT FALSE,
    label text NOT NULL,
    description text,
    quote text,
    weight_id uuid REFERENCES public.measures (id) ON DELETE SET NULL DEFERRABLE,
    capacity_id uuid REFERENCES public.measures (id) ON DELETE SET NULL DEFERRABLE,
    speed_id uuid REFERENCES public.measures (id) ON DELETE SET NULL DEFERRABLE,
    cost_id uuid REFERENCES public.costs (id) ON DELETE SET NULL DEFERRABLE,
    max_stack integer,
    quantity integer NOT NULL,
    category_id uuid NOT NULL REFERENCES public.system_equip_opts (id) ON DELETE SET NULL DEFERRABLE,
    rarity_id uuid NOT NULL REFERENCES public.system_equip_opts (id) ON DELETE SET NULL DEFERRABLE,
    primary_ability_id uuid REFERENCES public.system_abilities (id) ON DELETE SET NULL DEFERRABLE,
    secondary_ability_id uuid REFERENCES public.system_abilities (id) ON DELETE SET NULL DEFERRABLE,
    optional_ability_id uuid REFERENCES public.system_abilities (id) ON DELETE SET NULL DEFERRABLE,
    max_bonus integer,
    armor_class integer,
    damage_id uuid REFERENCES public.damages (id) ON DELETE SET NULL DEFERRABLE,
    save_dc_id uuid REFERENCES public.save_dc (id) ON DELETE SET NULL DEFERRABLE,
    range_id uuid REFERENCES public.characteristics (id) ON DELETE SET NULL DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_system_id ON public.equipment (system_id);

CREATE INDEX IF NOT EXISTS idx_equipment_category_id ON public.equipment (category_id);

CREATE INDEX IF NOT EXISTS idx_equipment_rarity_id ON public.equipment (rarity_id);

CREATE INDEX IF NOT EXISTS idx_equipment_damage_id ON public.equipment (damage_id);

CREATE INDEX IF NOT EXISTS idx_equipment_save_dc_id ON public.equipment (save_dc_id);

CREATE INDEX IF NOT EXISTS idx_equipment_range_id ON public.equipment (range_id);

CREATE INDEX IF NOT EXISTS idx_equipment_user_id ON public.equipment (user_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_equipment_updated_at'
            AND tgrelid = 'public.equipment'::regclass) THEN
    CREATE TRIGGER trg_equipment_updated_at
        BEFORE UPDATE ON public.equipment
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.equipment ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.equipment_properties (
    equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE,
    property_id uuid NOT NULL REFERENCES public.system_equip_opts (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (equipment_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_equipment_properties_property_id ON public.equipment_properties (property_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_equipment_properties_updated_at'
            AND tgrelid = 'public.equipment_properties'::regclass) THEN
    CREATE TRIGGER trg_equipment_properties_updated_at
        BEFORE UPDATE ON public.equipment_properties
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.equipment_properties ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.equipment_attributes (
    equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE,
    attribute_id uuid NOT NULL REFERENCES public.system_attributes (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (equipment_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS idx_equipment_attributes_attribute_id ON public.equipment_attributes (attribute_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_equipment_attributes_updated_at'
            AND tgrelid = 'public.equipment_attributes'::regclass) THEN
    CREATE TRIGGER trg_equipment_attributes_updated_at
        BEFORE UPDATE ON public.equipment_attributes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.equipment_attributes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.equipment_contains (
    contained_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE,
    equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE,
    quantity integer NOT NULL DEFAULT 1,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (equipment_id, contained_id)
);

CREATE INDEX IF NOT EXISTS idx_equipment_contains_equipment_id ON public.equipment_contains (equipment_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_equipment_contains_updated_at'
            AND tgrelid = 'public.equipment_contains'::regclass) THEN
    CREATE TRIGGER trg_equipment_contains_updated_at
        BEFORE UPDATE ON public.equipment_contains
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.equipment_contains ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.equipment_features (
    equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE,
    feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (equipment_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_equipment_features_feature_id ON public.equipment_features (feature_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_equipment_features_updated_at'
            AND tgrelid = 'public.equipment_features'::regclass) THEN
    CREATE TRIGGER trg_equipment_features_updated_at
        BEFORE UPDATE ON public.equipment_features
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.equipment_features ENABLE ROW LEVEL SECURITY;

-- Bridge: equipment ⇄ prerequisites (many-to-many)
CREATE TABLE IF NOT EXISTS public.equipment_prerequisites (
    equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE,
    prerequisite_id uuid NOT NULL REFERENCES public.prerequisites (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (equipment_id, prerequisite_id)
);

ALTER TABLE IF EXISTS public.equipment_prerequisites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_equipment_prereqs_equipment_id ON public.equipment_prerequisites (equipment_id);

CREATE INDEX IF NOT EXISTS idx_equipment_prereqs_position ON public.equipment_prerequisites (equipment_id, position);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_equipment_prerequisites_updated_at'
          AND tgrelid = 'public.equipment_prerequisites'::regclass) THEN
    CREATE TRIGGER trg_equipment_prerequisites_updated_at
        BEFORE UPDATE ON public.equipment_prerequisites
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
            tgname = 'trg_cleanup_equipment_owned'
            AND tgrelid = 'public.equipment'::regclass) THEN
    CREATE TRIGGER trg_cleanup_equipment_owned
        AFTER DELETE ON public.equipment
        FOR EACH ROW
        EXECUTE FUNCTION public.cleanup_owned_rows ('[
        { "table": "public.damages", "columns": ["damage_id"] },
        { "table": "public.save_dc", "columns": ["save_dc_id"] },
        { "table": "public.measures", "columns": ["weight_id", "capacity_id"] },
        { "table": "public.costs", "columns": ["cost_id"] },
        { "table": "public.characteristics", "columns": ["range_id"] }
      ]' );
END IF;
END;
$$;

SELECT
    public.apply_standard_policies ('equipment');


/***************************
 * FUNCTIONS
 ***************************/ 
CREATE OR REPLACE FUNCTION public.upsert_equipment (json_data jsonb)
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
    v_quote text := json_data ->> 'quote';
    v_weight_id uuid := COALESCE((json_data -> 'weight' ->> 'id')::uuid, GEN_RANDOM_UUID ());
    v_capacity_id uuid := COALESCE((json_data -> 'capacity' ->> 'id')::uuid, GEN_RANDOM_UUID ());
    v_speed_id uuid := COALESCE((json_data -> 'speeds' ->> 'id')::uuid, GEN_RANDOM_UUID ());
    v_cost_id uuid := COALESCE((json_data -> 'cost' ->> 'id')::uuid, GEN_RANDOM_UUID ());
    v_max_stack int := NULLIF (json_data ->> 'maxStack', '')::int;
    v_quantity int := NULLIF (json_data ->> 'quantity', '')::int;
    v_category_id uuid := NULLIF (COALESCE(json_data ->> 'categoryId', json_data ->> 'category'), '')::uuid;
    v_rarity_id uuid := NULLIF (COALESCE(json_data ->> 'rarityId', json_data ->> 'rarity'), '')::uuid;
    v_primary_ability_id uuid := NULLIF (COALESCE(json_data ->> 'primaryAbilityId', json_data ->> 'primaryAbility'), '')::uuid;
    v_secondary_ability_id uuid := NULLIF (COALESCE(json_data ->> 'secondaryAbilityId', json_data ->> 'secondaryAbility'), '')::uuid;
    v_optional_ability_id uuid := NULLIF (COALESCE(json_data ->> 'optionalAbilityId', json_data ->> 'optionalAbility'), '')::uuid;
    v_max_bonus int := NULLIF (json_data ->> 'maxBonus', '')::int;
    v_armor_class int := NULLIF (json_data ->> 'armorClass', '')::int;
    v_damage_id uuid := NULLIF (json_data -> 'damage' ->> 'id', '')::uuid;
    v_save_dc_id uuid := NULLIF (json_data -> 'saveDc' ->> 'id', '')::uuid;
    v_range_id uuid := NULLIF (json_data -> 'range' ->> 'id', '')::uuid;
    v_is_master boolean := CASE WHEN json_data ->> 'masterId' = 'master' THEN TRUE ELSE FALSE END;
    rec RECORD;
BEGIN
    -- 🧩 Weight
    INSERT INTO public.measures (id, kind, amount, unit_id)
    SELECT
        v_weight_id AS id,
        'WEIGHT'::public.measure_kind AS kind,
        COALESCE((json_data -> 'weight' ->> 'amount')::float, 1) AS amount,
        COALESCE((json_data -> 'weight' ->> 'unitId')::uuid, (SELECT unit_id FROM public.measures WHERE id = v_weight_id)) AS unit_id
    WHERE
        json_data ? 'weight'
        AND json_data -> 'weight' IS NOT NULL
    ON CONFLICT (id)
        DO UPDATE SET
            amount = excluded.amount,
            unit_id = excluded.unit_id
        RETURNING
            id INTO v_weight_id;

    -- 🧩 Speed
    INSERT INTO public.measures (id, kind, amount, unit_id)
    SELECT
        v_speed_id AS id,
        'SPEED'::public.measure_kind AS kind,
        COALESCE((json_data -> 'speeds' ->> 'amount')::float, 1) AS amount,
        COALESCE((json_data -> 'speeds' ->> 'unitId')::uuid, (SELECT unit_id FROM public.measures WHERE id = v_speed_id)) AS unit_id
    WHERE
        json_data ? 'speeds'
        AND json_data -> 'speeds' IS NOT NULL
    ON CONFLICT (id)
        DO UPDATE SET
            amount = excluded.amount,
            unit_id = excluded.unit_id
        RETURNING
            id INTO v_speed_id;

    -- 🧩 Capacity
    INSERT INTO public.measures (id, kind, amount, unit_id)
    SELECT
        v_capacity_id AS id,
        'CAPACITY'::public.measure_kind AS kind,
        COALESCE((json_data -> 'capacity' ->> 'amount')::float, 1) AS amount,
        COALESCE((json_data -> 'capacity' ->> 'unitId')::uuid, (SELECT unit_id FROM public.measures WHERE id = v_capacity_id)) AS unit_id
    WHERE
        json_data ? 'capacity'
        AND json_data -> 'capacity' IS NOT NULL
    ON CONFLICT (id)
        DO UPDATE SET
            amount = excluded.amount,
            unit_id = excluded.unit_id
        RETURNING
            id INTO v_capacity_id;

    -- 🧩 Cost
    INSERT INTO public.costs (id, amount, currency_id)
    SELECT
        v_cost_id AS id,
        COALESCE((json_data -> 'cost' ->> 'amount')::float, 1) AS amount,
        COALESCE((json_data -> 'cost' ->> 'currencyId')::uuid, (SELECT currency_id FROM public.costs WHERE id = v_cost_id)) AS currency_id
    WHERE
        json_data ? 'cost'
        AND json_data -> 'cost' IS NOT NULL
    ON CONFLICT (id)
        DO UPDATE SET
            amount = excluded.amount,
            currency_id = excluded.currency_id
        RETURNING
            id INTO v_cost_id;

    -- 🧩 Properties
    IF json_data ? 'range' THEN
        v_range_id := upsert_ranges (json_data -> 'range', v_range_id);

    END IF;

    IF json_data ? 'damage' THEN
        v_damage_id := upsert_damages (json_data -> 'damage', v_damage_id);

    END IF;

    IF json_data ? 'saveDc' THEN
        v_save_dc_id := upsert_save_dc (json_data -> 'saveDc', v_save_dc_id);

    END IF;

    -- 🧩 Prerequisites (array now). Populate bridge table and keep first for backward-compat column
    IF json_data ? 'prerequisites' AND json_data -> 'prerequisites' IS NOT NULL THEN
        -- Insert/Update bridge rows
        INSERT INTO public.equipment_prerequisites (equipment_id, prerequisite_id, position)
        SELECT
            v_id,
            public.upsert_prerequisites(elem.obj),
            elem.ord
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'prerequisites', '[]'::jsonb)) WITH ORDINALITY AS elem(obj, ord)
        ON CONFLICT (equipment_id, prerequisite_id)
            DO UPDATE SET position = EXCLUDED.position;

        -- Delete stale bridge rows not present in payload
        DELETE FROM public.equipment_prerequisites ep
        WHERE ep.equipment_id = v_id
          AND NOT EXISTS (
              SELECT 1
              FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'prerequisites', '[]'::jsonb)) AS elem
              WHERE ep.prerequisite_id = (elem ->> 'id')::uuid
          );

    END IF;

    -- 🧩 Core
    INSERT INTO public.equipment (id, system_id, user_id, label, description, quote, weight_id, capacity_id, cost_id, speed_id, max_stack, quantity, category_id, rarity_id, primary_ability_id, secondary_ability_id, optional_ability_id, max_bonus, armor_class, damage_id, save_dc_id, range_id,is_master)
        VALUES (v_id, v_system_id, v_user_id, v_label, v_description, v_quote, v_weight_id, v_capacity_id, v_cost_id, v_speed_id, v_max_stack, v_quantity, v_category_id, v_rarity_id, v_primary_ability_id, v_secondary_ability_id, v_optional_ability_id, v_max_bonus, v_armor_class, v_damage_id, v_save_dc_id, v_range_id, v_is_master)
    ON CONFLICT (id)
        DO UPDATE SET
            label = excluded.label,
            description = excluded.description,
            quote = excluded.quote,
            weight_id = excluded.weight_id,
            capacity_id = excluded.capacity_id,
            cost_id = excluded.cost_id,
            speed_id = excluded.speed_id,
            max_stack = excluded.max_stack,
            quantity = excluded.quantity,
            category_id = excluded.category_id,
            rarity_id = excluded.rarity_id,
            primary_ability_id = excluded.primary_ability_id,
            secondary_ability_id = excluded.secondary_ability_id,
            optional_ability_id = excluded.optional_ability_id,
            max_bonus = excluded.max_bonus,
            armor_class = excluded.armor_class,
            damage_id = excluded.damage_id,
            save_dc_id = excluded.save_dc_id,
            range_id = excluded.range_id,
            is_master = excluded.is_master;

    -- 🧩 Properties
    INSERT INTO public.equipment_properties (equipment_id, property_id)
    SELECT
        v_id,
        x::uuid
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'properties', '[]'::jsonb)) AS x
    ON CONFLICT (equipment_id,
        property_id)
        DO NOTHING;

    -- Delete orphaned properties
    DELETE FROM public.equipment_properties ep
    WHERE ep.equipment_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'properties', '[]'::jsonb)) AS opt_elem
            WHERE
                opt_elem::uuid = ep.property_id);

    -- 🧩 Attributes
    INSERT INTO public.equipment_attributes (equipment_id, attribute_id)
    SELECT
        v_id,
        x::uuid
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'attributes', '[]'::jsonb)) AS x
    ON CONFLICT (equipment_id,
        attribute_id)
        DO NOTHING;

    DELETE FROM public.equipment_attributes ea
    WHERE ea.equipment_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data -> 'attributes', '[]'::jsonb)) AS opt_elem
            WHERE
                opt_elem::uuid = ea.attribute_id);

    -- 🧩 Contains
    INSERT INTO public.equipment_contains (equipment_id, contained_id, quantity, position)
    SELECT    
        v_id AS equipment_id,
        COALESCE((cont.obj ->> 'id')::uuid, GEN_RANDOM_UUID ()) AS contained_id,
        COALESCE(NULLIF (cont.obj ->> 'quantity', '')::int, 1) AS quantity,
        cont.ord AS position
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'contains', '[]'::jsonb)) WITH ORDINALITY AS cont (obj, ord)
    ON CONFLICT (equipment_id, contained_id)
        DO UPDATE SET
            quantity = excluded.quantity,
            position = excluded.position;

    DELETE FROM public.equipment_contains ec
    WHERE ec.equipment_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'contains', '[]'::jsonb)) AS cont
            WHERE
                ec.contained_id = (cont ->> 'id')::uuid);

    -- 🧩 Features
    INSERT INTO public.equipment_features (equipment_id, feature_id, position)
    SELECT
        v_id,
        NULLIF (feature.obj ->> 'id', '')::uuid,
        feature.ord
    FROM
        JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'features', '[]'::jsonb))
        WITH ORDINALITY AS feature (obj, ord)
    ON CONFLICT (equipment_id,
        feature_id)
        DO UPDATE SET
            position = excluded.position;

    FOR rec IN
        SELECT obj
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'features', '[]'::jsonb))
             WITH ORDINALITY AS feature(obj)
    LOOP
        PERFORM public.upsert_features (rec.obj);

    END LOOP;

    DELETE FROM public.equipment_features ef
    WHERE ef.equipment_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'features', '[]'::jsonb)) AS opt_elem
            WHERE (opt_elem ->> 'id')::uuid = ef.feature_id);

    RETURN v_id;

END
$$;