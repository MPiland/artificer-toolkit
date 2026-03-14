/* ──────────────────────────────────────────────
 * UPSERT — STARTING EQUIPMENT (ROOT)
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_starting_equipment (
  json_data jsonb
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE((json_data ->> 'id')::uuid, gen_random_uuid());
BEGIN
  INSERT INTO public.starting_equipment (id)
  VALUES (v_id)
  ON CONFLICT (id) DO NOTHING;

  DELETE FROM public.starting_equipment_sets ses
  WHERE ses.starting_equipment_id = v_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(json_data -> 'sets','[]'::jsonb)) x(val)
      WHERE (x.val ->> 'id')::uuid = ses.id
    );

  PERFORM public.upsert_json_array(
    json_data,
    'sets',
    'upsert_starting_equipment_set',
    v_id
  );

  RETURN v_id;
END;
$$;

/* ──────────────────────────────────────────────
 * UPSERT — STARTING EQUIPMENT SET
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_starting_equipment_set (
  json_data jsonb,
  p_starting_equipment_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := (json_data ->> 'id')::uuid;
BEGIN
  INSERT INTO public.starting_equipment_sets (
    id,
    starting_equipment_id,
    sort_order
  )
  VALUES (
    v_id,
    p_starting_equipment_id,
    (json_data ->> 'order')::int
  )
  ON CONFLICT (id) DO UPDATE
    SET sort_order = excluded.sort_order;

  DELETE FROM public.starting_equipment_groups
  WHERE equipment_set_id = v_id
    AND id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data -> 'groups','[]'::jsonb)) x
    );

  PERFORM public.upsert_json_array(
    json_data,
    'groups',
    'upsert_starting_equipment_group',
    v_id
  );

  RETURN v_id;
END;
$$;

/* ──────────────────────────────────────────────
 * UPSERT — STARTING EQUIPMENT GROUP
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_starting_equipment_group (
  json_data jsonb,
  p_set_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := (json_data ->> 'id')::uuid;
BEGIN
  INSERT INTO public.starting_equipment_groups (
    id,
    equipment_set_id,
    sort_order
  )
  VALUES (
    v_id,
    p_set_id,
    (json_data ->> 'order')::int
  )
  ON CONFLICT (id) DO UPDATE
    SET sort_order = excluded.sort_order;

  DELETE FROM public.starting_equipment_options
  WHERE equipment_group_id = v_id
    AND id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data -> 'options','[]'::jsonb)) x
    );

  PERFORM public.upsert_json_array(
    json_data,
    'options',
    'upsert_starting_equipment_option',
    v_id
  );

  RETURN v_id;
END;
$$;

/* ──────────────────────────────────────────────
 * UPSERT — STARTING EQUIPMENT OPTION
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_starting_equipment_option (
  json_data jsonb,
  p_group_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := (json_data ->> 'id')::uuid;
BEGIN
  INSERT INTO public.starting_equipment_options (
    id,
    equipment_group_id,
    sort_order
  )
  VALUES (
    v_id,
    p_group_id,
    (json_data ->> 'order')::int
  )
  ON CONFLICT (id) DO UPDATE
    SET sort_order = excluded.sort_order;

  DELETE FROM public.starting_equipment_option_items
  WHERE equipment_option_id = v_id
    AND id NOT IN (
      SELECT (x ->> 'id')::uuid
      FROM jsonb_array_elements(COALESCE(json_data -> 'items','[]'::jsonb)) x
    );

  PERFORM public.upsert_json_array(
    json_data,
    'items',
    'upsert_starting_equipment_option_item',
    v_id
  );

  RETURN v_id;
END;
$$;

/* ──────────────────────────────────────────────
 * UPSERT — STARTING EQUIPMENT OPTION ITEM
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_starting_equipment_option_item (
  json_data jsonb,
  p_option_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := (json_data ->> 'id')::uuid;
  v_mode text := COALESCE(
    json_data ->> 'authoringModeKind',
    json_data ->> 'mode'
  );
BEGIN
  INSERT INTO public.starting_equipment_option_items (
    id,
    equipment_option_id,
    starting_equipment_kind,
    authoring_mode_kind,
    selection_kind,
    category_code,
    count,
    quantity,
    sort_order
  )
  VALUES (
    v_id,
    p_option_id,
    COALESCE(
      json_data ->> 'startingEquipmentKind',
      json_data ->> 'type'
    ),
    v_mode,
    COALESCE(
      json_data ->> 'selectionKind',
      json_data ->> 'selectionType'
    ),
    COALESCE(
      json_data ->> 'categoryCode',
      json_data ->> 'category'
    ),
    (json_data ->> 'count')::int,
    (json_data ->> 'quantity')::int,
    (json_data ->> 'order')::int
  )
  ON CONFLICT (id) DO UPDATE SET
    starting_equipment_kind = excluded.starting_equipment_kind,
    authoring_mode_kind     = excluded.authoring_mode_kind,
    selection_kind          = excluded.selection_kind,
    category_code           = excluded.category_code,
    count          = excluded.count,
    quantity       = excluded.quantity,
    sort_order     = excluded.sort_order;

  -- properties (stale-only)
  DELETE FROM public.starting_equipment_option_item_properties
  WHERE option_item_id = v_id
    AND property_code NOT IN (
      SELECT jsonb_array_elements_text(COALESCE(json_data -> 'properties','[]'::jsonb))
    );

  INSERT INTO public.starting_equipment_option_item_properties
  SELECT v_id, x
  FROM jsonb_array_elements_text(COALESCE(json_data -> 'properties','[]'::jsonb)) x
  ON CONFLICT DO NOTHING;

  -- equipmentIds (SELECTED only)
  DELETE FROM public.starting_equipment_option_item_equipment
  WHERE option_item_id = v_id
    AND equipment_id NOT IN (
      SELECT (x)::uuid
      FROM jsonb_array_elements_text(COALESCE(json_data -> 'equipmentIds','[]'::jsonb)) x
    );

  IF v_mode = 'SELECTED' THEN
    INSERT INTO public.starting_equipment_option_item_equipment
    SELECT v_id, (x)::uuid
    FROM jsonb_array_elements_text(COALESCE(json_data -> 'equipmentIds','[]'::jsonb)) x
    ON CONFLICT DO NOTHING;
  END IF;

  -- currencies (stale-only)
  DELETE FROM public.starting_equipment_currencies
  WHERE option_item_id = v_id
    AND currency_id NOT IN (
      SELECT (x ->> 'currencyId')::uuid
      FROM jsonb_array_elements(COALESCE(json_data -> 'currencies','[]'::jsonb)) x
    );

  INSERT INTO public.starting_equipment_currencies
  SELECT
    v_id,
    (x ->> 'currencyId')::uuid,
    (x ->> 'amount')::int
  FROM jsonb_array_elements(COALESCE(json_data -> 'currencies','[]'::jsonb)) x
  ON CONFLICT (option_item_id, currency_id) DO UPDATE
  SET amount = excluded.amount;

  RETURN v_id;
END;
$$;
