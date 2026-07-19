ALTER TABLE public.proficiency_grants
  ADD COLUMN IF NOT EXISTS selection_duplicate_policy text;

ALTER TABLE public.modifier_grants
  ADD COLUMN IF NOT EXISTS selection_duplicate_policy text;

ALTER TABLE public.feat_grants
  ADD COLUMN IF NOT EXISTS selection_duplicate_policy text;

ALTER TABLE public.feat_grant_scaling_levels
  ADD COLUMN IF NOT EXISTS selection_duplicate_policy text;

ALTER TABLE public.sense_grants
  ADD COLUMN IF NOT EXISTS selection_duplicate_policy text;

ALTER TABLE public.sense_grant_scaling_levels
  ADD COLUMN IF NOT EXISTS selection_duplicate_policy text;

ALTER TABLE public.spell_grants
  ADD COLUMN IF NOT EXISTS selection_duplicate_policy text;

ALTER TABLE public.spell_grant_scaling_levels
  ADD COLUMN IF NOT EXISTS selection_duplicate_policy text;

UPDATE public.proficiency_grants
SET selection_duplicate_policy = 'UNIQUE'
WHERE selection_kind = 'CHOSEN'
  AND selection_duplicate_policy IS NULL;

UPDATE public.modifier_grants
SET selection_duplicate_policy = 'UNIQUE'
WHERE selection_kind = 'CHOSEN'
  AND selection_duplicate_policy IS NULL;

UPDATE public.feat_grants
SET selection_duplicate_policy = 'UNIQUE'
WHERE scaling_kind = 'NONE'
  AND selection_kind = 'CHOSEN'
  AND selection_duplicate_policy IS NULL;

UPDATE public.feat_grant_scaling_levels AS scaling_level
SET selection_duplicate_policy = 'UNIQUE'
FROM public.feat_grants AS parent_grant
WHERE scaling_level.feat_grant_id = parent_grant.id
  AND parent_grant.selection_kind = 'CHOSEN'
  AND scaling_level.selection_count IS NOT NULL
  AND scaling_level.selection_duplicate_policy IS NULL;

UPDATE public.sense_grants
SET selection_duplicate_policy = 'UNIQUE'
WHERE scaling_kind = 'NONE'
  AND selection_kind = 'CHOSEN'
  AND selection_duplicate_policy IS NULL;

UPDATE public.sense_grant_scaling_levels AS scaling_level
SET selection_duplicate_policy = 'UNIQUE'
FROM public.sense_grants AS parent_grant
WHERE scaling_level.sense_grant_id = parent_grant.id
  AND parent_grant.selection_kind = 'CHOSEN'
  AND scaling_level.selection_count IS NOT NULL
  AND scaling_level.selection_duplicate_policy IS NULL;

UPDATE public.spell_grants
SET selection_duplicate_policy = 'UNIQUE'
WHERE scaling_kind = 'NONE'
  AND selection_kind = 'CHOSEN'
  AND selection_duplicate_policy IS NULL;

UPDATE public.spell_grant_scaling_levels AS scaling_level
SET selection_duplicate_policy = 'UNIQUE'
FROM public.spell_grants AS parent_grant
WHERE scaling_level.spell_grant_id = parent_grant.id
  AND parent_grant.selection_kind = 'CHOSEN'
  AND scaling_level.selection_count IS NOT NULL
  AND scaling_level.selection_duplicate_policy IS NULL;

ALTER TABLE public.proficiency_grants
  DROP CONSTRAINT IF EXISTS proficiency_grants_count_chk,
  ADD CONSTRAINT proficiency_grants_count_chk CHECK (
    (selection_kind <> 'CHOSEN' AND count IS NULL AND selection_duplicate_policy IS NULL)
    OR (
      selection_kind = 'CHOSEN'
      AND count IS NOT NULL
      AND count > 0
      AND selection_duplicate_policy IN ('UNIQUE', 'REPEATABLE')
    )
  );

ALTER TABLE public.modifier_grants
  DROP CONSTRAINT IF EXISTS modifier_grants_count_chk,
  ADD CONSTRAINT modifier_grants_count_chk CHECK (
    (selection_kind <> 'CHOSEN' AND count IS NULL AND selection_duplicate_policy IS NULL)
    OR (
      selection_kind = 'CHOSEN'
      AND count IS NOT NULL
      AND count > 0
      AND selection_duplicate_policy IN ('UNIQUE', 'REPEATABLE')
    )
  );

ALTER TABLE public.feat_grants
  DROP CONSTRAINT IF EXISTS feat_grants_root_selection_count_chk,
  ADD CONSTRAINT feat_grants_root_selection_count_chk CHECK (
    (scaling_kind <> 'NONE' AND selection_count IS NULL AND selection_duplicate_policy IS NULL)
    OR (
      scaling_kind = 'NONE'
      AND selection_kind <> 'CHOSEN'
      AND selection_count IS NULL
      AND selection_duplicate_policy IS NULL
    )
    OR (
      scaling_kind = 'NONE'
      AND selection_kind = 'CHOSEN'
      AND selection_count IS NOT NULL
      AND selection_count > 0
      AND selection_duplicate_policy IN ('UNIQUE', 'REPEATABLE')
    )
  );

ALTER TABLE public.feat_grant_scaling_levels
  DROP CONSTRAINT IF EXISTS feat_grant_scaling_levels_selection_count_chk,
  ADD CONSTRAINT feat_grant_scaling_levels_selection_count_chk CHECK (
    (selection_count IS NULL AND selection_duplicate_policy IS NULL)
    OR (
      selection_count IS NOT NULL
      AND selection_count > 0
      AND selection_duplicate_policy IN ('UNIQUE', 'REPEATABLE')
    )
  );

ALTER TABLE public.sense_grants
  DROP CONSTRAINT IF EXISTS sense_grants_root_selection_count_chk,
  ADD CONSTRAINT sense_grants_root_selection_count_chk CHECK (
    (scaling_kind <> 'NONE' AND selection_count IS NULL AND selection_duplicate_policy IS NULL)
    OR (
      scaling_kind = 'NONE'
      AND selection_kind <> 'CHOSEN'
      AND selection_count IS NULL
      AND selection_duplicate_policy IS NULL
    )
    OR (
      scaling_kind = 'NONE'
      AND selection_kind = 'CHOSEN'
      AND selection_count IS NOT NULL
      AND selection_count > 0
      AND selection_duplicate_policy IN ('UNIQUE', 'REPEATABLE')
    )
  );

ALTER TABLE public.sense_grant_scaling_levels
  DROP CONSTRAINT IF EXISTS sense_grant_scaling_levels_selection_count_chk,
  ADD CONSTRAINT sense_grant_scaling_levels_selection_count_chk CHECK (
    (selection_count IS NULL AND selection_duplicate_policy IS NULL)
    OR (
      selection_count IS NOT NULL
      AND selection_count > 0
      AND selection_duplicate_policy IN ('UNIQUE', 'REPEATABLE')
    )
  );

ALTER TABLE public.spell_grants
  DROP CONSTRAINT IF EXISTS spell_grants_root_selection_count_chk,
  ADD CONSTRAINT spell_grants_root_selection_count_chk CHECK (
    (scaling_kind <> 'NONE' AND selection_count IS NULL AND selection_duplicate_policy IS NULL)
    OR (
      scaling_kind = 'NONE'
      AND selection_kind <> 'CHOSEN'
      AND selection_count IS NULL
      AND selection_duplicate_policy IS NULL
    )
    OR (
      scaling_kind = 'NONE'
      AND selection_kind = 'CHOSEN'
      AND selection_count IS NOT NULL
      AND selection_count > 0
      AND selection_duplicate_policy IN ('UNIQUE', 'REPEATABLE')
    )
  );

ALTER TABLE public.spell_grant_scaling_levels
  DROP CONSTRAINT IF EXISTS spell_grant_scaling_levels_selection_count_chk,
  ADD CONSTRAINT spell_grant_scaling_levels_selection_count_chk CHECK (
    (selection_count IS NULL AND selection_duplicate_policy IS NULL)
    OR (
      selection_count IS NOT NULL
      AND selection_count > 0
      AND selection_duplicate_policy IN ('UNIQUE', 'REPEATABLE')
    )
  );
