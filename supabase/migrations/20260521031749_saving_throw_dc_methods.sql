ALTER TABLE public.saving_throws
  DROP CONSTRAINT IF EXISTS saving_throws_kind_chk,
  DROP CONSTRAINT IF EXISTS saving_throws_dc_method_chk,
  DROP CONSTRAINT IF EXISTS saving_throws_payload_chk;

ALTER TABLE public.saving_throws
  RENAME COLUMN saving_throw_kind TO dc_method;

ALTER TABLE public.saving_throws
  RENAME COLUMN dc TO base_dc;

UPDATE public.saving_throws
SET dc_method = 'FIXED_DC'
WHERE dc_method = 'FIXED_VALUE';

ALTER TABLE public.saving_throws
  ALTER COLUMN ability_code SET NOT NULL,
  ADD CONSTRAINT saving_throws_dc_method_chk CHECK (
    dc_method IN ('SOURCE_SAVE_DC', 'FIXED_DC', 'DERIVED_DC')
  ),
  ADD CONSTRAINT saving_throws_payload_chk CHECK (
    (dc_method = 'SOURCE_SAVE_DC' AND base_dc IS NULL)
    OR (dc_method IN ('FIXED_DC', 'DERIVED_DC') AND base_dc IS NOT NULL)
  );

DROP INDEX IF EXISTS public.idx_saving_throws_kind;

CREATE INDEX IF NOT EXISTS idx_saving_throws_dc_method
  ON public.saving_throws (dc_method);

CREATE TABLE IF NOT EXISTS public.saving_throw_dc_bonuses (
  id uuid PRIMARY KEY,
  saving_throw_id uuid NOT NULL REFERENCES public.saving_throws(id) ON DELETE CASCADE,
  sort_order integer NOT NULL,

  bonus_kind text NOT NULL,
  ability_code text,
  amount integer,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT saving_throw_dc_bonuses_kind_chk CHECK (
    bonus_kind IN ('ABILITY_MODIFIER', 'PROFICIENCY_BONUS', 'STATIC_BONUS')
  ),
  CONSTRAINT saving_throw_dc_bonuses_payload_chk CHECK (
    (bonus_kind = 'ABILITY_MODIFIER' AND ability_code IS NOT NULL AND amount IS NULL)
    OR (bonus_kind = 'PROFICIENCY_BONUS' AND ability_code IS NULL AND amount IS NULL)
    OR (bonus_kind = 'STATIC_BONUS' AND ability_code IS NULL AND amount IS NOT NULL)
  )
);

ALTER TABLE public.saving_throw_dc_bonuses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_saving_throw_dc_bonuses_saving_throw
  ON public.saving_throw_dc_bonuses (saving_throw_id, sort_order);
