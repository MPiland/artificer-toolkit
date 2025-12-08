/***************************
 * TABLES
 ***************************/
CREATE TABLE IF NOT EXISTS public.save_dc (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    ability_id uuid NOT NULL REFERENCES public.system_abilities (id) ON DELETE SET NULL DEFERRABLE,
    base_value integer,
    scaling_ability_id uuid REFERENCES public.system_abilities (id) ON DELETE SET NULL DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_save_dc_modifier ON public.save_dc (scaling_ability_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_save_dc_updated_at'
            AND tgrelid = 'public.save_dc'::regclass) THEN
    CREATE TRIGGER trg_save_dc_updated_at
        BEFORE UPDATE ON public.save_dc
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.save_dc ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.save_dc_attributes (
    save_dc_id uuid NOT NULL REFERENCES public.save_dc (id) ON DELETE CASCADE DEFERRABLE,
    attribute_id uuid NOT NULL REFERENCES public.system_attributes (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (save_dc_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS idx_save_dc_attributes_attr ON public.save_dc_attributes (attribute_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_save_dc_attributes_updated_at'
            AND tgrelid = 'public.save_dc_attributes'::regclass) THEN
    CREATE TRIGGER trg_save_dc_attributes_updated_at
        BEFORE UPDATE ON public.save_dc_attributes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.save_dc_attributes ENABLE ROW LEVEL SECURITY;


/***************************
 * FUNCTIONS
 ***************************/ 
CREATE OR REPLACE FUNCTION public.upsert_save_dc (json_data JSONB, p_existing_id UUID DEFAULT NULL)
    RETURNS UUID
    LANGUAGE plpgsql
    SET	search_path = pg_catalog, public
    AS $$
DECLARE
    -- Primary ID for this ability_save row
    v_id UUID := COALESCE(p_existing_id, gen_random_uuid());

    -- Extract fields from JSON
    v_ability_id UUID := NULLIF(json_data ->> 'saveAbilityId','')::UUID;
    v_min_amount INT := NULLIF(json_data ->> 'baseValue','')::INT;
    v_ability_modifier_id UUID := NULLIF(json_data ->> 'scalingAbilityId','')::UUID;
BEGIN
    -- Return NULL immediately if no JSON provided
    IF json_data IS NULL THEN
        RETURN NULL;

    END IF;

    -- 🧩 Upsert main save_dc row
    INSERT INTO public.save_dc (id, ability_id, base_value, scaling_ability_id)
        VALUES (v_id, v_ability_id, v_min_amount, v_ability_modifier_id)
    ON CONFLICT (id)
        DO UPDATE SET
            ability_id = excluded.ability_id,
            base_value = excluded.base_value,
            scaling_ability_id = excluded.scaling_ability_id;

    -- 🧩 Sync save_dc_attributes bridge table
    IF json_data ? 'scalingAttributeIds' AND json_data -> 'scalingAttributeIds' IS NOT NULL AND JSONB_ARRAY_LENGTH(json_data -> 'scalingAttributeIds') > 0 THEN
        -- Insert new attributes
        INSERT INTO public.save_dc_attributes (save_dc_id, attribute_id)
        SELECT
            v_id,
            NULLIF (x, '')::uuid
        FROM
            JSONB_ARRAY_ELEMENTS_TEXT(json_data -> 'scalingAttributeIds') AS x
    ON CONFLICT (save_dc_id,
        attribute_id)
        DO NOTHING;

    -- Delete attributes no longer present
    DELETE FROM public.save_dc_attributes a
    WHERE a.save_dc_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                JSONB_ARRAY_ELEMENTS_TEXT(json_data -> 'scalingAttributeIds') AS x
            WHERE
                NULLIF (x, '')::uuid = a.attribute_id);

    ELSE
        -- If attributes are missing or null, remove all
        DELETE FROM public.save_dc_attributes
        WHERE save_dc_id = v_id;

    END IF;

    -- Return the upserted ability_save ID
    RETURN v_id;
END;
$$;