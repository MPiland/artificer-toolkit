CREATE OR REPLACE FUNCTION public.cleanup_owned_rows () RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE
  config jsonb;
  entry jsonb;
  col text;
  target_table regclass;
  target_id text;
BEGIN
  config := TG_ARGV[0]::jsonb;

  FOR entry IN SELECT * FROM JSONB_ARRAY_ELEMENTS(config)
  LOOP
    target_table := (entry ->> 'table')::regclass;

    FOR col IN SELECT JSONB_ARRAY_ELEMENTS_TEXT(entry -> 'columns')
    LOOP
      target_id := to_jsonb(OLD) ->> col;

      IF target_id IS NOT NULL THEN
        EXECUTE FORMAT('DELETE FROM %s WHERE id::text = $1', target_table)
        USING target_id;
      END IF;
    END LOOP;
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_owned_rows_on_update () RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE
  config jsonb;
  entry jsonb;
  col text;
  target_table regclass;
  old_id text;
  new_id text;
BEGIN
  config := TG_ARGV[0]::jsonb;

  FOR entry IN SELECT * FROM JSONB_ARRAY_ELEMENTS(config)
  LOOP
    target_table := (entry ->> 'table')::regclass;

    FOR col IN SELECT JSONB_ARRAY_ELEMENTS_TEXT(entry -> 'columns')
    LOOP
      old_id := to_jsonb(OLD) ->> col;
      new_id := to_jsonb(NEW) ->> col;

      IF old_id IS NOT NULL AND old_id IS DISTINCT FROM new_id THEN
        EXECUTE FORMAT('DELETE FROM %s WHERE id::text = $1', target_table)
        USING old_id;
      END IF;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;
