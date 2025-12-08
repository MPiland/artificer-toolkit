/***************************
 * TABLES
 ***************************/
CREATE TABLE IF NOT EXISTS public.damages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
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
            tgname = 'trg_damages_updated_at'
            AND tgrelid = 'public.damages'::regclass) THEN
    CREATE TRIGGER trg_damages_updated_at
        BEFORE UPDATE ON public.damages
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.damages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.damage_attributes (
    damage_id uuid NOT NULL REFERENCES public.damages (id) ON DELETE CASCADE DEFERRABLE,
    attribute_id uuid NOT NULL REFERENCES public.system_attributes (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (damage_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS idx_damage_attributes_attr ON public.damage_attributes (attribute_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_damage_attributes_updated_at'
            AND tgrelid = 'public.damage_attributes'::regclass) THEN
    CREATE TRIGGER trg_damage_attributes_updated_at
        BEFORE UPDATE ON public.damage_attributes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.damage_attributes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.damage_saves (
    damage_id uuid NOT NULL REFERENCES public.damages (id) ON DELETE CASCADE DEFERRABLE,
    save_id uuid NOT NULL REFERENCES public.save_dc (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (damage_id, save_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_damage_saves_updated_at'
            AND tgrelid = 'public.damage_saves'::regclass) THEN
    CREATE TRIGGER trg_damage_saves_updated_at
        BEFORE UPDATE ON public.damage_saves
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.damage_saves ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'damage_field_slot'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.damage_field_slot AS ENUM (
            'PRIMARY',
            'SECONDARY',
            'BONUS'
        );
    END IF;
END;
$$;

-- Explicit DIE vs POOL kind per blueprint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'damage_field_kind'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.damage_field_kind AS ENUM (
            'DIE',
            'POOL'
        );
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.damage_fields (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    damage_id uuid NOT NULL REFERENCES public.damages (id) ON DELETE CASCADE DEFERRABLE,
    slot damage_field_slot NOT NULL,
    level int,
    kind public.damage_field_kind NOT NULL DEFAULT 'DIE',
    die_config text,
    attribute_id uuid REFERENCES public.system_attributes (id) ON DELETE SET NULL DEFERRABLE,
    ability_id uuid REFERENCES public.system_abilities (id) ON DELETE SET NULL DEFERRABLE,
    set_amount integer,
    multiplier integer,
    min_amount integer,
    max_amount integer,
    match_weapon boolean NOT NULL DEFAULT FALSE,
    damage_type_id uuid REFERENCES public.system_damage_types (id) ON DELETE SET NULL DEFERRABLE,
    option_id uuid REFERENCES public.system_attributes (id) ON DELETE SET NULL DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT damage_fields_nonempty_chk CHECK (die_config IS NOT NULL OR set_amount IS NOT NULL),
    CONSTRAINT damage_fields_pool_vs_die_chk CHECK ((kind = 'POOL' AND die_config IS NULL) OR (kind = 'DIE'))
);

-- Uniqueness rules:
-- 1) Top-level entries: unique per (damage_id, slot) when level IS NULL
-- 2) Per-level entries: unique per (damage_id, slot, level) when level IS NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS uq_damage_fields_top
    ON public.damage_fields (damage_id, slot)
    WHERE level IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_damage_fields_per_level
    ON public.damage_fields (damage_id, slot, level)
    WHERE level IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_damage_fields_damage_id ON public.damage_fields (damage_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_damage_fields_updated_at'
            AND tgrelid = 'public.damage_fields'::regclass) THEN
    CREATE TRIGGER trg_damage_fields_updated_at
        BEFORE UPDATE ON public.damage_fields
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.damage_fields ENABLE ROW LEVEL SECURITY;

/***************************
 * FUNCTIONS
 ***************************/
CREATE OR REPLACE FUNCTION public.upsert_damages (json_data jsonb, p_existing_id uuid DEFAULT NULL)
    RETURNS uuid
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE
    v_id uuid := COALESCE(p_existing_id, gen_random_uuid ());
    v_slot text;
    v_level int;
    v_role_json jsonb;
    v_set_amount int;
    v_multiplier int;
    v_min_amount int;
    v_max_amount int;
    v_attribute_id uuid;
    v_ability_id uuid;
    v_option_id uuid;
    v_match_weapon boolean;
    v_damage_type_id uuid;
    v_kind public.damage_field_kind;
    v_die_config text;
    v_damage_field_id uuid;


BEGIN
    IF json_data IS NULL THEN
        RETURN NULL;

    END IF;

    INSERT INTO public.damages (id)
    VALUES (v_id)
    ON CONFLICT (id) DO NOTHING;

    -- 🧩 Attributes (blueprint: attributeIds)
    INSERT INTO public.damage_attributes (damage_id, attribute_id)
    SELECT
        v_id,
        nullif (x, '')::uuid
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(
            COALESCE(json_data -> 'attributeIds', json_data -> 'attributes', '[]')
        ) AS x
    ON CONFLICT
        DO NOTHING;

    DELETE FROM public.damage_attributes da
    WHERE da.damage_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(
                    COALESCE(json_data -> 'attributeIds', json_data -> 'attributes', '[]')
                ) AS x
            WHERE
                x::uuid = da.attribute_id);

    -- 🧩 Saves (blueprint: damageSaveIds)
    INSERT INTO public.damage_saves (damage_id, save_id)
    SELECT
        v_id,
        nullif (x, '')::uuid
    FROM
        JSONB_ARRAY_ELEMENTS_TEXT(
            COALESCE(json_data -> 'damageSaveIds', json_data -> 'damageSave', '[]')
        ) AS x
    ON CONFLICT
        DO NOTHING;

    DELETE FROM public.damage_saves ds
    WHERE ds.damage_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(
                    COALESCE(json_data -> 'damageSaveIds', json_data -> 'damageSave', '[]')
                ) AS x
            WHERE
                x::uuid = ds.save_id);

    -- 🧩 Fields (top-level) and ScalePerLevel (per-level)
    FOR v_slot,
        v_level,
        v_role_json IN (
            WITH unified AS (
                -- Top-level 'fields' array (level is NULL)
                SELECT
                    NULL::int AS level,
                    f.elem AS fld
                FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'fields', '[]')) AS f(elem)
                UNION ALL
                -- Per-level 'scalePerLevel' array (level provided)
                SELECT
                    nullif(s.elem ->> 'level', '')::int AS level,
                    s.elem AS fld
                FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'scalePerLevel', '[]')) AS s(elem)
            )
            SELECT
                COALESCE(NULLIF(UPPER(fld ->> 'slot'), ''), NULL)::text AS slot,
                level,
                fld AS role_json
            FROM unified
        )
    LOOP
        -- 🧩 Field properties from unified object
        v_match_weapon := CASE WHEN v_role_json ->> 'damageTypeId' = 'matchWeapon' THEN TRUE ELSE FALSE END;
        v_set_amount := nullif (v_role_json ->> 'setAmount', '')::int;
        v_multiplier := nullif (v_role_json ->> 'multiplier', '')::int;
        v_min_amount := nullif (v_role_json ->> 'minAmount', '')::int;
        v_max_amount := nullif (v_role_json ->> 'maxAmount', '')::int;
        v_attribute_id := nullif (v_role_json ->> 'attributeId', '')::uuid;
        v_ability_id := nullif (v_role_json ->> 'abilityId', '')::uuid;
        v_option_id := nullif (v_role_json ->> 'poolOptionId', '')::uuid;
        v_damage_type_id := CASE WHEN v_match_weapon THEN NULL ELSE nullif (v_role_json ->> 'damageTypeId', '')::uuid END;
        v_kind := NULLIF(UPPER(v_role_json ->> 'kind'), '')::public.damage_field_kind;
        v_die_config := CASE WHEN v_kind = 'POOL' THEN NULL ELSE nullif (v_role_json ->> 'dieConfig', '') END;

        -- Skip empty fields: require either die_config or set_amount
        IF v_die_config IS NULL AND v_set_amount IS NULL THEN
            CONTINUE;
        END IF;

        -- 🧩 Upsert via primary key id when provided
        v_damage_field_id := COALESCE(NULLIF (v_role_json ->> 'id', '')::uuid, v_damage_field_id, gen_random_uuid());

        INSERT INTO public.damage_fields (
            id, damage_id, slot, level, kind, die_config,
            attribute_id, ability_id, set_amount, multiplier, min_amount, max_amount,
            match_weapon, damage_type_id, option_id
        ) VALUES (
            v_damage_field_id,
            v_id,
            NULLIF(v_slot, '')::public.damage_field_slot,
            v_level,
            v_kind,
            v_die_config,
            v_attribute_id,
            v_ability_id,
            v_set_amount,
            v_multiplier,
            v_min_amount,
            v_max_amount,
            FALSE,
            v_damage_type_id,
            v_option_id
        )
        ON CONFLICT (id) DO UPDATE SET
            damage_id = EXCLUDED.damage_id,
            slot = EXCLUDED.slot,
            level = EXCLUDED.level,
            kind = EXCLUDED.kind,
            die_config = EXCLUDED.die_config,
            set_amount = EXCLUDED.set_amount,
            multiplier = EXCLUDED.multiplier,
            min_amount = EXCLUDED.min_amount,
            max_amount = EXCLUDED.max_amount,
            attribute_id = EXCLUDED.attribute_id,
            ability_id = EXCLUDED.ability_id,
            option_id = EXCLUDED.option_id,
            match_weapon = EXCLUDED.match_weapon,
            damage_type_id = EXCLUDED.damage_type_id
        RETURNING id INTO v_damage_field_id;
    END LOOP;

    -- 🧩 Cleanup
    DELETE FROM public.damage_fields df
    WHERE df.damage_id = v_id
      AND NOT EXISTS (
        SELECT 1
        FROM (
          WITH unified AS (
            SELECT NULL::int AS level, f.elem AS fld
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'fields', '[]')) AS f(elem)
            UNION ALL
            SELECT nullif(s.elem ->> 'level', '')::int AS level, s.elem AS fld
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'scalePerLevel', '[]')) AS s(elem)
          )
          SELECT
            NULLIF(UPPER(fld ->> 'slot'), '')::public.damage_field_slot AS slot,
            level
          FROM unified
        ) ar
        WHERE ar.slot = df.slot
          AND ar.level IS NOT DISTINCT FROM df.level
      );

    RETURN v_id;
END;
$$;