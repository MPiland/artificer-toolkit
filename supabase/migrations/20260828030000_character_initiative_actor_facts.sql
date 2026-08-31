ALTER TABLE public.character_mechanics_projections
ADD COLUMN IF NOT EXISTS initiative_actor_facts jsonb NOT NULL DEFAULT '{"effectiveSize":null,"equippedItems":[]}'::jsonb CHECK (
  jsonb_typeof(initiative_actor_facts) = 'object'
);
