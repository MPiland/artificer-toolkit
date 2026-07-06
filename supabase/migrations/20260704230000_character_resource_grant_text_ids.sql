ALTER TABLE IF EXISTS public.character_resources
  DROP CONSTRAINT IF EXISTS character_resources_resource_grant_id_fkey;

ALTER TABLE IF EXISTS public.character_resource_grants
  ALTER COLUMN id TYPE text USING id::text;

ALTER TABLE IF EXISTS public.character_resources
  ALTER COLUMN resource_grant_id TYPE text USING resource_grant_id::text;

ALTER TABLE IF EXISTS public.character_resources
  ADD CONSTRAINT character_resources_resource_grant_id_fkey
  FOREIGN KEY (resource_grant_id)
  REFERENCES public.character_resource_grants (id)
  ON DELETE CASCADE
  DEFERRABLE;
