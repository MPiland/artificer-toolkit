ALTER TABLE public.character_classes
ADD COLUMN IF NOT EXISTS known_spells_overridden boolean NOT NULL DEFAULT false;
