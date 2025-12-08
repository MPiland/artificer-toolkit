/***************************
 * TABLES
 ***************************/
CREATE TABLE IF NOT EXISTS public.starting_equipment (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.starting_equipment ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.starting_equipment_sets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    starting_equipment_id uuid NOT NULL REFERENCES public.starting_equipment (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.starting_equipment_sets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_starting_equipment_sets_starting_equipment_id ON public.starting_equipment_sets (starting_equipment_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_starting_equipment_sets_updated_at'
            AND tgrelid = 'public.starting_equipment_sets'::regclass) THEN
    CREATE TRIGGER trg_starting_equipment_sets_updated_at
        BEFORE UPDATE ON public.starting_equipment_sets
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.starting_equipment_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    set_id uuid NOT NULL REFERENCES public.starting_equipment_sets (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    UNIQUE (set_id, position),
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.starting_equipment_groups ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_starting_equipment_groups_set_id ON public.starting_equipment_groups (set_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_starting_equipment_groups_updated_at'
            AND tgrelid = 'public.starting_equipment_groups'::regclass) THEN
    CREATE TRIGGER trg_starting_equipment_groups_updated_at
        BEFORE UPDATE ON public.starting_equipment_groups
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.starting_equipment_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    group_id uuid NOT NULL REFERENCES public.starting_equipment_groups (id) ON DELETE CASCADE DEFERRABLE,
    position integer NOT NULL DEFAULT 1,
    UNIQUE (group_id, position),
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.starting_equipment_options ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_starting_equipment_options_group_id ON public.starting_equipment_options (group_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_starting_equipment_options_updated_at'
            AND tgrelid = 'public.starting_equipment_options'::regclass) THEN
    CREATE TRIGGER trg_starting_equipment_options_updated_at
        BEFORE UPDATE ON public.starting_equipment_options
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.starting_equipment_option_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    option_id uuid NOT NULL REFERENCES public.starting_equipment_options (id) ON DELETE CASCADE DEFERRABLE,
    selection_count integer,
    category_id uuid REFERENCES public.system_equip_opts (id) DEFERRABLE,
    quantity integer,
    position integer NOT NULL DEFAULT 1,
    use_all boolean NOT NULL DEFAULT FALSE,
    UNIQUE (option_id, position),
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_starting_equipment_option_items_option_id ON public.starting_equipment_option_items (option_id);

CREATE INDEX IF NOT EXISTS idx_starting_equipment_option_items_category_id ON public.starting_equipment_option_items (category_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_starting_equipment_option_items_updated_at'
            AND tgrelid = 'public.starting_equipment_option_items'::regclass) THEN
    CREATE TRIGGER trg_starting_equipment_option_items_updated_at
        BEFORE UPDATE ON public.starting_equipment_option_items
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.starting_equipment_option_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.starting_equipment_option_item_equipment (
    option_item_id uuid NOT NULL REFERENCES public.starting_equipment_option_items (id) ON DELETE CASCADE DEFERRABLE,
    equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (option_item_id, equipment_id)
);

CREATE INDEX IF NOT EXISTS idx_starting_equipment_option_item_equipment_equipment_id ON public.starting_equipment_option_item_equipment (equipment_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_eoi_equipment_updated_at'
            AND tgrelid = 'public.starting_equipment_option_item_equipment'::regclass) THEN
    CREATE TRIGGER trg_eoi_equipment_updated_at
        BEFORE UPDATE ON public.starting_equipment_option_item_equipment
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.starting_equipment_option_item_equipment ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.starting_equipment_option_item_properties (
    option_item_id uuid NOT NULL REFERENCES public.starting_equipment_option_items (id) ON DELETE CASCADE DEFERRABLE,
    property_id uuid NOT NULL REFERENCES public.system_equip_opts (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (option_item_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_starting_equipment_option_item_properties_property_id ON public.starting_equipment_option_item_properties (property_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_eoi_properties_updated_at'
            AND tgrelid = 'public.starting_equipment_option_item_properties'::regclass) THEN
    CREATE TRIGGER trg_eoi_properties_updated_at
        BEFORE UPDATE ON public.starting_equipment_option_item_properties
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.starting_equipment_option_item_properties ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.starting_equipment_option_item_attributes (
    option_item_id uuid NOT NULL REFERENCES public.starting_equipment_option_items (id) ON DELETE CASCADE DEFERRABLE,
    attribute_id uuid NOT NULL REFERENCES public.system_attributes (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (option_item_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS idx_starting_equipment_option_item_attributes_attr_id ON public.starting_equipment_option_item_attributes (attribute_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_eoi_attributes_updated_at'
            AND tgrelid = 'public.starting_equipment_option_item_attributes'::regclass) THEN
    CREATE TRIGGER trg_eoi_attributes_updated_at
        BEFORE UPDATE ON public.starting_equipment_option_item_attributes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.starting_equipment_option_item_attributes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.starting_equipment_option_item_currencies (
    option_item_id uuid NOT NULL REFERENCES public.starting_equipment_option_items (id) ON DELETE CASCADE DEFERRABLE,
    currency_id uuid NOT NULL REFERENCES public.system_currencies (id) ON DELETE CASCADE DEFERRABLE,
    amount integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (option_item_id, currency_id)
);

CREATE INDEX IF NOT EXISTS idx_starting_equipment_option_item_currencies_currency_id ON public.starting_equipment_option_item_currencies (currency_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_eoi_currencies_updated_at'
            AND tgrelid = 'public.starting_equipment_option_item_currencies'::regclass) THEN
    CREATE TRIGGER trg_eoi_currencies_updated_at
        BEFORE UPDATE ON public.starting_equipment_option_item_currencies
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.starting_equipment_option_item_currencies ENABLE ROW LEVEL SECURITY;


/***************************
 * FUNCTIONS
 ***************************/
CREATE OR REPLACE FUNCTION public.upsert_starting_equipment (json_data jsonb, p_existing_id uuid DEFAULT NULL)
    RETURNS uuid
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE
    v_starting_id uuid;
BEGIN
    IF json_data IS NULL THEN
        RETURN NULL;

    END IF;

    -- 🧩 Core
    DROP TABLE IF EXISTS tmp_starting_equipment;

    CREATE TEMP TABLE tmp_starting_equipment AS (
        SELECT
            COALESCE(p_existing_id, (json_data ->> 'id')::uuid, gen_random_uuid ()
    ) AS starting_equipment_id,
            (json_data -> 'sets')::jsonb AS set_json
    );

    INSERT INTO public.starting_equipment (id)
    SELECT
        starting_equipment_id
    FROM
        tmp_starting_equipment
    ON CONFLICT
        DO NOTHING
    RETURNING
        id INTO v_starting_id;

    -- 🧩 Sets
    DROP TABLE IF EXISTS tmp_equip_sets;

    CREATE TEMP TABLE tmp_equip_sets AS (
        SELECT
            COALESCE((se.obj ->> 'id')::uuid, gen_random_uuid ()
    ) AS set_id,
            t.starting_equipment_id AS starting_equipment_id,
            se.ord AS position,
            (se.obj -> 'groups')::jsonb AS group_json
        FROM
            tmp_starting_equipment t
        CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(t.set_json) WITH ORDINALITY AS se (obj, ord)
    );

    INSERT INTO public.starting_equipment_sets (id, position, starting_equipment_id)
    SELECT
        set_id,
        position,
        starting_equipment_id
    FROM
        tmp_equip_sets
    ON CONFLICT (id)
        DO UPDATE SET
            position = EXCLUDED.position;

    -- 🧩 Groups
    DROP TABLE IF EXISTS tmp_equip_groups;

    CREATE TEMP TABLE tmp_equip_groups AS (
        SELECT
            COALESCE((sg.obj ->> 'id')::uuid, gen_random_uuid ()
    ) AS group_id,
            s.set_id AS set_id,
            sg.ord AS position,
            (sg.obj -> 'options')::jsonb AS option_json
        FROM
            tmp_equip_sets s
        CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(s.group_json) WITH ORDINALITY AS sg (obj, ord)
    );

    INSERT INTO public.starting_equipment_groups (id, set_id, position)
    SELECT
        group_id,
        set_id,
        position
    FROM
        tmp_equip_groups
    ON CONFLICT (id)
        DO UPDATE SET
            position = EXCLUDED.position;

    -- 🧩 Options
    DROP TABLE IF EXISTS tmp_equip_options;

    CREATE TEMP TABLE tmp_equip_options AS (
        SELECT
            COALESCE((so.obj ->> 'id')::uuid, gen_random_uuid ()
    ) AS option_id,
            g.group_id AS group_id,
            so.ord AS position,
            (so.obj -> 'items')::jsonb AS item_json
        FROM
            tmp_equip_groups g
        CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(g.option_json) WITH ORDINALITY AS so (obj, ord)
    );

    INSERT INTO public.starting_equipment_options (id, group_id, position)
    SELECT
        option_id,
        group_id,
        position
    FROM
        tmp_equip_options
    ON CONFLICT (id)
        DO UPDATE SET
            position = EXCLUDED.position;

    -- 🧩 Items
    DROP TABLE IF EXISTS tmp_equip_items;

    CREATE TEMP TABLE tmp_equip_items AS (
        SELECT
            COALESCE((si.obj ->> 'id')::uuid, gen_random_uuid ()
    ) AS item_id,
            o.option_id AS option_id,
            si.ord AS position,
            NULLIF (si.obj ->> 'quantity', '')::int AS quantity,
            NULLIF (si.obj ->> 'selectionCount', '')::int AS selection_count,
            jsonb_has_all (COALESCE(si.obj -> 'equipment', '[]'::jsonb)) AS use_all,
            (si.obj -> 'equipment')::jsonb AS equipment,
            (si.obj -> 'properties')::jsonb AS properties,
            (si.obj -> 'currencies')::jsonb AS currencies,
            (si.obj -> 'attributes')::jsonb AS attributes
        FROM
            tmp_equip_options o
        CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(o.item_json) WITH ORDINALITY AS si (obj, ord)
    );

    -- 🧩 Items
    INSERT INTO public.starting_equipment_option_items (id, option_id, position, quantity, selection_count, use_all)
    SELECT
        item_id,
        option_id,
        position,
        quantity,
        selection_count,
        use_all
    FROM
        tmp_equip_items
    ON CONFLICT (id)
        DO UPDATE SET
            position = EXCLUDED.position,
            quantity = EXCLUDED.quantity,
            selection_count = EXCLUDED.selection_count,
            use_all = EXCLUDED.use_all;

    -- 🧩 Equipment
    INSERT INTO public.starting_equipment_option_item_equipment (option_item_id, equipment_id)
    SELECT
        tmp_equip_items.item_id AS option_item_id,
        value::uuid AS equipment_id
    FROM
        tmp_equip_items
        CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS_TEXT(tmp_equip_items.equipment) AS value
    WHERE
        NOT tmp_equip_items.use_all
    ON CONFLICT (option_item_id,
        equipment_id)
        DO NOTHING;

    -- 🧩 Properties
    INSERT INTO public.starting_equipment_option_item_properties (option_item_id, property_id)
    SELECT
        tmp_equip_items.item_id AS option_item_id,
        value::uuid AS property_id
    FROM
        tmp_equip_items
        CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS_TEXT(tmp_equip_items.properties) AS value
    ON CONFLICT (option_item_id,
        property_id)
        DO NOTHING;

    -- 🧩 Attributes
    INSERT INTO public.starting_equipment_option_item_attributes (option_item_id, attribute_id)
    SELECT
        tmp_equip_items.item_id AS option_item_id,
        value::uuid AS attribute_id
    FROM
        tmp_equip_items
        CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS_TEXT(tmp_equip_items.attributes) AS value
    ON CONFLICT (option_item_id,
        attribute_id)
    DO NOTHING;

    -- 🧩 Currencies
    INSERT INTO public.starting_equipment_option_item_currencies (option_item_id, currency_id, amount)
    SELECT
        tmp_equip_items.item_id AS option_item_id,
        (c ->> 'id')::uuid AS currency_id,
        NULLIF (c ->> 'amount', '')::int AS amount
    FROM
        tmp_equip_items
        CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(tmp_equip_items.currencies) AS c
        LEFT JOIN public.starting_equipment_option_item_currencies ic ON ic.option_item_id = tmp_equip_items.item_id
            AND ic.currency_id = (c ->> 'id')::uuid
        ON CONFLICT (option_item_id,
            currency_id)
            DO UPDATE SET
                amount = EXCLUDED.amount;

    RETURN v_starting_id;

END;
$$;