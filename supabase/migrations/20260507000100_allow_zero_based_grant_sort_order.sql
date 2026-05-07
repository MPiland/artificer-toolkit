ALTER TABLE public.feat_grants
  DROP CONSTRAINT IF EXISTS feat_grants_root_sort_order_chk,
  ADD CONSTRAINT feat_grants_root_sort_order_chk CHECK (sort_order >= 0);

ALTER TABLE public.feat_grant_scaling_levels
  DROP CONSTRAINT IF EXISTS feat_grant_scaling_levels_sort_order_chk,
  ADD CONSTRAINT feat_grant_scaling_levels_sort_order_chk CHECK (sort_order >= 0);

ALTER TABLE public.sense_grants
  DROP CONSTRAINT IF EXISTS sense_grants_root_sort_order_chk,
  ADD CONSTRAINT sense_grants_root_sort_order_chk CHECK (sort_order >= 0);

ALTER TABLE public.sense_grant_scaling_levels
  DROP CONSTRAINT IF EXISTS sense_grant_scaling_levels_sort_order_chk,
  ADD CONSTRAINT sense_grant_scaling_levels_sort_order_chk CHECK (sort_order >= 0);

ALTER TABLE public.spell_grants
  DROP CONSTRAINT IF EXISTS spell_grants_root_sort_order_chk,
  ADD CONSTRAINT spell_grants_root_sort_order_chk CHECK (sort_order >= 0);

ALTER TABLE public.spell_grant_attributes
  DROP CONSTRAINT IF EXISTS spell_grant_attributes_sort_order_chk,
  ADD CONSTRAINT spell_grant_attributes_sort_order_chk CHECK (sort_order >= 0);

ALTER TABLE public.spell_grant_scaling_levels
  DROP CONSTRAINT IF EXISTS spell_grant_scaling_levels_sort_order_chk,
  ADD CONSTRAINT spell_grant_scaling_levels_sort_order_chk CHECK (sort_order >= 0);
