/* ──────────────────────────────────────────────
 * CONDITIONS — AUTHORED EFFECT ENTITY
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.conditions (
  id uuid PRIMARY KEY,

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  condition_type_id uuid NOT NULL
    REFERENCES public.condition_types(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.apply_system_derived_policies('conditions');

CREATE INDEX IF NOT EXISTS idx_conditions_system
  ON public.conditions(system_id);

CREATE INDEX IF NOT EXISTS idx_conditions_condition_type
  ON public.conditions(condition_type_id);

/* ──────────────────────────────────────────────
 * UPSERT CONDITION (ROOT)
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_condition (
  json_data jsonb,
  p_system_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE((json_data ->> 'id')::uuid, gen_random_uuid());
BEGIN
  IF json_data IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.conditions (
    id,
    system_id,
    condition_type_id
  )
  VALUES (
    v_id,
    p_system_id,
    (json_data ->> 'conditionId')::uuid
  )
  ON CONFLICT (id) DO UPDATE SET
    condition_type_id = excluded.condition_type_id;

  RETURN v_id;
END;
$$;
