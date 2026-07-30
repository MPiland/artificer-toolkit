ALTER TABLE public.charges
  ALTER COLUMN reset_kind DROP NOT NULL;

ALTER TABLE public.charge_limits
  ADD COLUMN IF NOT EXISTS cost integer;

ALTER TABLE public.charge_limits
  DROP CONSTRAINT IF EXISTS charge_limits_fixed_amount_chk;

ALTER TABLE public.charge_limits
  ADD CONSTRAINT charge_limits_fixed_amount_chk CHECK (
    (
      limit_kind = 'FIXED_AMOUNT'
      AND amount IS NOT NULL
      AND cost IS NULL
      AND class_id IS NULL
      AND ability_code IS NULL
    )
    OR (
      limit_kind IN (
        'CHARACTER_LEVEL',
        'CLASS_LEVEL',
        'PARENT_CLASS_LEVEL',
        'SPELL_CAST_LEVEL'
      )
      AND amount IS NULL
      AND cost IS NULL
      AND ability_code IS NULL
    )
    OR (
      limit_kind = 'ABILITY_MODIFIER'
      AND ability_code IS NOT NULL
      AND amount IS NULL
      AND cost IS NULL
      AND class_id IS NULL
    )
    OR (
      limit_kind = 'SOURCE_CHARGES'
      AND cost > 0
      AND amount IS NULL
      AND class_id IS NULL
      AND ability_code IS NULL
      AND multiplier IS NULL
      AND min IS NULL
      AND max IS NULL
    )
  );
