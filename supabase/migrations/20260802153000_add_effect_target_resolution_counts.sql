ALTER TABLE public.effect_invocations
ADD COLUMN IF NOT EXISTS resolution_count INTEGER,
ADD COLUMN IF NOT EXISTS resolution_count_scaling JSONB,
ADD COLUMN IF NOT EXISTS allow_repeated_targets BOOLEAN;

ALTER TABLE public.effect_paths
ADD COLUMN IF NOT EXISTS resolution_count INTEGER,
ADD COLUMN IF NOT EXISTS resolution_count_scaling JSONB,
ADD COLUMN IF NOT EXISTS allow_repeated_targets BOOLEAN;
