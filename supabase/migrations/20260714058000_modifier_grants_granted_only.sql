DELETE FROM public.modifier_grants
WHERE
  selection_kind <> 'GRANTED'
  OR count IS NOT NULL
  OR selection_duplicate_policy IS NOT NULL;

ALTER TABLE public.modifier_grants
DROP CONSTRAINT IF EXISTS modifier_grants_count_chk;

ALTER TABLE public.modifier_grants
DROP CONSTRAINT IF EXISTS modifier_grants_selection_chk;

ALTER TABLE public.modifier_grants ADD CONSTRAINT modifier_grants_selection_chk CHECK (
  selection_kind = 'GRANTED'
  AND count IS NULL
  AND selection_duplicate_policy IS NULL
);
