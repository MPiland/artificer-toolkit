/* ──────────────────────────────────────────────
 * UPSERT EFFECT INVOCATION
 * Called from parent effect upsert
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_effect_invocation (
  json_data jsonb,
  p_effect_id uuid
) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_activation_type text;
  v_activation_value integer;
BEGIN
  IF json_data IS NULL THEN
    RETURN;
  END IF;

  v_activation_type := json_data #>> '{activation,type}';

  IF json_data #>> '{activation,value}' IS NOT NULL THEN
    v_activation_value := (json_data #>> '{activation,value}')::integer;
  ELSE
    v_activation_value := NULL;
  END IF;

  INSERT INTO public.effect_invocations (
    effect_id,
    trigger_code,
    activation_type,
    activation_value,
    range_characteristic_id,
    shape_characteristic_id,
    saving_throw_id
  )
  VALUES (
    p_effect_id,
    json_data ->> 'triggerCode',
    v_activation_type,
    v_activation_value,
    (json_data #>> '{range,id}')::uuid,
    NULLIF(json_data #>> '{shape,id}', '')::uuid,
    NULLIF(json_data #>> '{savingThrow,id}', '')::uuid
  )
  ON CONFLICT (effect_id)
  DO UPDATE SET
    trigger_code = excluded.trigger_code,
    activation_type = excluded.activation_type,
    activation_value = excluded.activation_value,
    range_characteristic_id = excluded.range_characteristic_id,
    shape_characteristic_id = excluded.shape_characteristic_id,
    saving_throw_id = excluded.saving_throw_id;

END;
$$;
