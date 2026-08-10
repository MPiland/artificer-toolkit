ALTER TABLE public.encounter_templates
  ADD COLUMN IF NOT EXISTS command_id uuid,
  ADD COLUMN IF NOT EXISTS command_fingerprint text;

UPDATE public.encounter_templates
SET command_id = gen_random_uuid()
WHERE command_id IS NULL;

UPDATE public.encounter_templates
SET command_fingerprint = 'legacy:' || id::text
WHERE command_fingerprint IS NULL;

ALTER TABLE public.encounter_templates
  ALTER COLUMN command_id SET NOT NULL,
  ALTER COLUMN command_fingerprint SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS encounter_templates_campaign_command_idx
  ON public.encounter_templates (campaign_id, command_id);
