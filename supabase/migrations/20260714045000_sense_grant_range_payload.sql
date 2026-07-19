ALTER TABLE public.sense_grants
  ADD COLUMN IF NOT EXISTS range_scaling jsonb;

ALTER TABLE public.sense_grants
  ALTER COLUMN range_amount TYPE numeric
  USING range_amount::numeric;

ALTER TABLE public.sense_grants
  DROP CONSTRAINT IF EXISTS sense_grants_root_range_kind_chk,
  DROP CONSTRAINT IF EXISTS sense_grants_root_range_distance_chk;

ALTER TABLE public.sense_grants
  ADD CONSTRAINT sense_grants_root_range_kind_chk CHECK (
    range_kind IS NULL
    OR range_kind IN ('SELF', 'TOUCH', 'SIGHT', 'SPECIAL', 'UNLIMITED', 'DISTANCE')
  ),
  ADD CONSTRAINT sense_grants_root_range_distance_chk CHECK (
    (range_kind = 'DISTANCE' AND range_amount IS NOT NULL AND range_unit IS NOT NULL)
    OR (
      range_kind IS DISTINCT FROM 'DISTANCE'
      AND range_amount IS NULL
      AND range_unit IS NULL
      AND range_scaling IS NULL
    )
  );
