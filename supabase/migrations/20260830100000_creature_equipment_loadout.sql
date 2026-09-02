-- Creature authored equipment loadout is a tightly owned source document.
-- Runtime instance state and loot transfer remain outside this table.
-- Regenerate committed DB types after the coherent migration packet stabilizes.
ALTER TABLE public.creatures
ADD COLUMN IF NOT EXISTS equipment_loadout jsonb;
