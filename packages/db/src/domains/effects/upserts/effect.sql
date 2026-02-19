/* ──────────────────────────────────────────────
 * UPSERT EFFECT
 * Root authored effect container
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_effect (
  json_data jsonb
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF json_data IS NULL THEN
    RETURN NULL;
  END IF;

  v_id := (json_data ->> 'id')::uuid;

  INSERT INTO public.effects (
    id,
    sort_order
  )
  VALUES (
    v_id,
    (json_data ->> 'order')::integer
  )
  ON CONFLICT (id)
  DO UPDATE SET
    sort_order = excluded.sort_order;

  RETURN v_id;
END;
$$;
