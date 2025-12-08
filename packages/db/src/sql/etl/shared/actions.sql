/***************************
 * TABLES
 ***************************/
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'action_slot'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.action_slot AS ENUM (
            'CASTING',
            'PRIMARY',
            'SECONDARY',
            'BONUS'
        );
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.actions (
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
            tgname = 'trg_actions_updated_at'
            AND tgrelid = 'public.actions'::regclass) THEN
    CREATE TRIGGER trg_actions_updated_at
        BEFORE UPDATE ON public.actions
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.actions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.action_fields (
    action_option_id uuid NOT NULL REFERENCES public.system_actions (id) ON DELETE CASCADE,
    amount integer,
    slot public.action_slot NOT NULL,
    PRIMARY KEY (action_option_id, slot),
    action_id uuid NOT NULL REFERENCES public.actions (id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_action_fields_updated_at'
            AND tgrelid = 'public.action_fields'::regclass) THEN
    CREATE TRIGGER trg_action_fields_updated_at
        BEFORE UPDATE ON public.action_fields
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_actions_option_id ON public.action_fields (action_option_id);

ALTER TABLE IF EXISTS public.action_fields ENABLE ROW LEVEL SECURITY;


/***************************
 * FUNCTIONS
 ***************************/
CREATE OR REPLACE FUNCTION public.upsert_actions (json_data jsonb, p_existing_id uuid DEFAULT NULL)
    RETURNS uuid
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE
    -- Primary ID for this action row
    v_id uuid := COALESCE(p_existing_id, gen_random_uuid ());
BEGIN
    -- Return NULL immediately if no JSON provided
    IF json_data IS NULL THEN
        RETURN NULL;

    END IF;
    -- 🧩 Upsert main action row
    INSERT INTO public.actions (id)
        VALUES (v_id)
    ON CONFLICT (id)
        DO NOTHING;
    -- 🧩 Expand action slots into a temporary table
    DROP TABLE IF EXISTS tmp_f;

    CREATE TEMP TABLE tmp_f AS
    SELECT
        upper(slot)::action_slot AS slot,
        (json_data -> bd.slot) AS type_json
    FROM
        LATERAL (
            -- Define all possible slots
            SELECT
                UNNEST(ARRAY['CASTING', 'PRIMARY', 'SECONDARY', 'BONUS']) AS slot) bd
    WHERE (json_data -> bd.slot) IS NOT NULL;
    -- 🧩 Upsert action_fields using temp table
    INSERT INTO public.action_fields (action_option_id, amount, slot, action_id)
    SELECT
        v_id,
        (t.type_json ->> 'amount')::int,
        t.slot,
        (t.type_json ->> 'actionId')::uuid
    FROM
        tmp_f t
    ON CONFLICT (action_option_id, slot)
        DO UPDATE SET
            amount = excluded.amount,
            action_option_id = excluded.action_option_id,
            slot = excluded.slot;
    -- 🧩 Delete action_fields that no longer exist in the JSON
    DELETE FROM public.action_fields af
    WHERE af.action_option_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                tmp_f t
            WHERE
                t.slot = af.slot);
    -- Return the upserted action ID
    RETURN v_id;

END;
$$;