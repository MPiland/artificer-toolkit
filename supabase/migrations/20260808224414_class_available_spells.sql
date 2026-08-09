ALTER TABLE public.class_spellcasting
  ADD COLUMN IF NOT EXISTS available_spell_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];
