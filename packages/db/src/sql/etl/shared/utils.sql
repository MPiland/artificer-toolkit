CREATE OR REPLACE FUNCTION public.upsert_json_array (json_data jsonb, key text, upsert_func text, parent_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $$
DECLARE
  r jsonb;
BEGIN
  FOR r IN
  SELECT
    JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> key, '[]'::jsonb))
    LOOP
      EXECUTE FORMAT('SELECT %I($1, $2)', upsert_func)
      USING r, parent_id;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_owned_rows ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $$
DECLARE
  config jsonb;
  entry jsonb;
  col text;
  target_table regclass;
  target_id uuid;
BEGIN
  -- first argument is our JSON config
  config := TG_ARGV[0]::jsonb;
  -- loop over each object in the array
  FOR entry IN
  SELECT
    *
  FROM
    JSONB_ARRAY_ELEMENTS(config)
    LOOP
      target_table := (entry ->> 'table')::regclass;
      -- loop over the columns for this table
      FOR col IN
      SELECT
        JSONB_ARRAY_ELEMENTS_TEXT(entry -> 'columns')
        LOOP
          target_id := (to_jsonb (OLD) ->> col)::uuid;

          IF target_id IS NOT NULL THEN
            EXECUTE FORMAT('delete from %s where id = $1', target_table)
            USING target_id;
          END IF;
          END LOOP;

        END LOOP;

      RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.jsonb_has_all (arr jsonb)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path = pg_catalog, public
  AS $$
  SELECT
    EXISTS (
      SELECT
        1
      FROM
        JSONB_ARRAY_ELEMENTS_TEXT(arr) AS x
      WHERE
        x = 'all');
$$;

CREATE OR REPLACE FUNCTION public.cleanup_owned_rows_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  config jsonb;
  entry jsonb;
  col text;
  target_table regclass;
  old_id uuid;
  new_id uuid;
BEGIN
  -- First argument is our JSON config, same shape as cleanup_owned_rows
  config := TG_ARGV[0]::jsonb;

  -- Loop over each { table, columns } entry
  FOR entry IN SELECT * FROM jsonb_array_elements(config)
  LOOP
    target_table := (entry ->> 'table')::regclass;

    -- Loop over each column name in "columns"
    FOR col IN SELECT jsonb_array_elements_text(entry -> 'columns')
    LOOP
      old_id := (to_jsonb(OLD) ->> col)::uuid;
      new_id := (to_jsonb(NEW) ->> col)::uuid;

      -- If the FK changed or became NULL, delete the old owned row
      -- IS DISTINCT FROM treats NULL vs value as "different"
      IF old_id IS NOT NULL AND old_id IS DISTINCT FROM new_id THEN
        EXECUTE format('DELETE FROM %s WHERE id = $1', target_table)
        USING old_id;
      END IF;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;
