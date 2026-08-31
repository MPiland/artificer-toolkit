ALTER TABLE public.character_mechanics_projections
ADD COLUMN IF NOT EXISTS compiled_action_entry_points jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.character_mechanics_projections
ADD CONSTRAINT character_mechanics_projections_compiled_action_entry_points_array_check
  CHECK (jsonb_typeof(compiled_action_entry_points) = 'array');
