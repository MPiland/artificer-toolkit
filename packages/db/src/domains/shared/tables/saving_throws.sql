/* ──────────────────────────────────────────────
 * SAVING THROWS — STANDALONE AUTHORED ENTITY
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.saving_throws (
  id uuid PRIMARY KEY,

  saving_throw_kind text NOT NULL,          -- SAVING_THROW_KIND (string)
  ability_code text,                -- ABILITY_CODE (FIXED_VALUE only)

  dc integer,                        -- only for FIXED_VALUE

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT saving_throws_kind_chk CHECK (
    saving_throw_kind IN ('SOURCE_SAVE_DC', 'FIXED_VALUE')
  ),
  CONSTRAINT saving_throws_payload_chk CHECK (
    (saving_throw_kind = 'SOURCE_SAVE_DC' AND ability_code IS NULL AND dc IS NULL)
    OR (saving_throw_kind = 'FIXED_VALUE' AND ability_code IS NOT NULL AND dc IS NOT NULL)
  )
);

ALTER TABLE public.saving_throws ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_saving_throws_kind
  ON public.saving_throws (saving_throw_kind);

CREATE INDEX IF NOT EXISTS idx_saving_throws_ability
  ON public.saving_throws (ability_code);
