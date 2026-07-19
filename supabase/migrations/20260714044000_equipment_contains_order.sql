ALTER TABLE public.equipment_contains
  ADD COLUMN IF NOT EXISTS sort_order integer;

WITH ranked AS (
  SELECT
    equipment_id,
    contained_equipment_id,
    row_number() OVER (
      PARTITION BY equipment_id
      ORDER BY contained_equipment_id
    ) AS sort_order
  FROM public.equipment_contains
)
UPDATE public.equipment_contains AS contained
SET sort_order = ranked.sort_order
FROM ranked
WHERE contained.equipment_id = ranked.equipment_id
  AND contained.contained_equipment_id = ranked.contained_equipment_id;

ALTER TABLE public.equipment_contains
  ALTER COLUMN sort_order SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.equipment_contains'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (equipment_id, sort_order)'
  ) THEN
    ALTER TABLE public.equipment_contains
      ADD CONSTRAINT equipment_contains_equipment_sort_order_key
      UNIQUE (equipment_id, sort_order);
  END IF;
END;
$$;
