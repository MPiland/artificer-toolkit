ALTER TABLE public.systems
  ADD COLUMN IF NOT EXISTS ruleset_code text,
  ADD COLUMN IF NOT EXISTS ruleset_version text;

UPDATE public.systems
SET
  ruleset_code = 'dnd5e',
  ruleset_version = '2014'
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND (ruleset_code IS NULL OR ruleset_version IS NULL);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.systems
    WHERE ruleset_code IS NULL OR ruleset_version IS NULL
  ) THEN
    RAISE EXCEPTION 'Every system must have an explicit ruleset code and version before enforcing the ruleset identity constraint.';
  END IF;
END;
$$;

ALTER TABLE public.systems
  ALTER COLUMN ruleset_code SET NOT NULL,
  ALTER COLUMN ruleset_version SET NOT NULL;
