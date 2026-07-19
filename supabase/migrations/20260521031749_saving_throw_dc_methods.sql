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
