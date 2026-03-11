/* ──────────────────────────────────────────────
 * SAVING THROWS — STANDALONE AUTHORED ENTITY
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.saving_throws (
  id uuid PRIMARY KEY,

  saving_throw_kind text NOT NULL,          -- SAVING_THROW_KIND (string)
  ability_code text NOT NULL,       -- ABILITY_CODE (string)

  dc integer,                  -- only for FIXED_VALUE

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saving_throws ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_saving_throws_kind
  ON public.saving_throws (saving_throw_kind);

CREATE INDEX IF NOT EXISTS idx_saving_throws_ability
  ON public.saving_throws (ability_code);