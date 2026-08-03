ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS weight_amount numeric,
ADD COLUMN IF NOT EXISTS weight_unit text;

ALTER TABLE public.vehicles
ALTER COLUMN speed TYPE numeric USING speed::numeric;

ALTER TABLE public.vehicles
DROP CONSTRAINT IF EXISTS vehicles_weight_chk;

ALTER TABLE public.vehicles
ADD CONSTRAINT vehicles_weight_chk CHECK (
  (
    weight_amount IS NULL
    AND weight_unit IS NULL
  )
  OR (
    weight_amount IS NOT NULL
    AND weight_unit IS NOT NULL
  )
);
