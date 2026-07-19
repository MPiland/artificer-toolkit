ALTER TABLE public.damages
  ADD COLUMN IF NOT EXISTS amount_kind text,
  ADD COLUMN IF NOT EXISTS amount_multiplier numeric;
