ALTER TABLE public.character_class_equipment_session
  DROP CONSTRAINT IF EXISTS character_class_equipment_session_gold_option_fkey;

ALTER TABLE public.character_class_equipment_session
  ALTER COLUMN gold_option TYPE text USING gold_option::text;
