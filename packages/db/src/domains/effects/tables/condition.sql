/* ──────────────────────────────────────────────
 * CONDITIONS — AUTHORED EFFECT ENTITY
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.conditions (
  id uuid PRIMARY KEY,

  condition_type_id uuid NOT NULL
    REFERENCES public.condition_types(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conditions_condition_type
  ON public.conditions(condition_type_id);

ALTER TABLE public.conditions ENABLE ROW LEVEL SECURITY;