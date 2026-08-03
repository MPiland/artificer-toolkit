ALTER TABLE public.equipment
DROP CONSTRAINT IF EXISTS equipment_category_payload_chk;

ALTER TABLE public.equipment
ADD CONSTRAINT equipment_category_payload_chk CHECK (
  category <> 'VARIANT'
  OR (
    weight_amount IS NULL
    AND weight_unit IS NULL
  )
);
