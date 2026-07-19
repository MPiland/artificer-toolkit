ALTER TABLE IF EXISTS public.character_class_spells
  DROP CONSTRAINT IF EXISTS character_class_spells_pkey;

ALTER TABLE IF EXISTS public.character_class_spells
  ADD CONSTRAINT character_class_spells_pkey
  PRIMARY KEY (character_id, class_id, spell_id, state);
