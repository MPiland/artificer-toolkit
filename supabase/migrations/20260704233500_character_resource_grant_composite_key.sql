ALTER TABLE IF EXISTS public.character_resources
  DROP CONSTRAINT IF EXISTS character_resources_resource_grant_id_fkey;

ALTER TABLE IF EXISTS public.character_resource_grants
  DROP CONSTRAINT IF EXISTS character_resource_grants_character_id_id_key;

ALTER TABLE IF EXISTS public.character_resource_grants
  DROP CONSTRAINT IF EXISTS character_resource_grants_pkey;

ALTER TABLE IF EXISTS public.character_resource_grants
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN character_id SET NOT NULL;

ALTER TABLE IF EXISTS public.character_resource_grants
  ADD CONSTRAINT character_resource_grants_pkey
  PRIMARY KEY (character_id, id);

ALTER TABLE IF EXISTS public.character_resources
  ADD CONSTRAINT character_resources_resource_grant_id_fkey
  FOREIGN KEY (character_id, resource_grant_id)
  REFERENCES public.character_resource_grants (character_id, id)
  ON DELETE CASCADE
  DEFERRABLE;
