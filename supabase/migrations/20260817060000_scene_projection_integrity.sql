ALTER TABLE public.encounter_scenes
  ADD COLUMN projection_schema_version integer NOT NULL CHECK (projection_schema_version > 0),
  ADD COLUMN projection_checksum text NOT NULL CHECK (projection_checksum ~ '^[0-9a-f]{64}$');
