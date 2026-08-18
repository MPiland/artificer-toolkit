-- Clean-break reset contract: campaign content versions no longer store authored JSON.
-- Environments are reset from canonical schema before this migration is applied.
ALTER TABLE public.campaign_content_versions
  DROP COLUMN snapshot,
  ADD COLUMN authored_version_id uuid NOT NULL,
  ADD COLUMN authored_version integer NOT NULL CHECK (authored_version > 0),
  ADD COLUMN authored_checksum text NOT NULL CHECK (authored_checksum ~ '^[0-9a-f]{64}$'),
  ADD COLUMN compiled_projection_checksum text NOT NULL CHECK (compiled_projection_checksum ~ '^[0-9a-f]{64}$');
