ALTER TABLE public.class_resources
  ADD COLUMN IF NOT EXISTS sort_order integer;

ALTER TABLE public.class_spellcasting
  ADD COLUMN IF NOT EXISTS available_at_level integer,
  ADD COLUMN IF NOT EXISTS sort_order integer;
