ALTER TABLE public.encounters
  ADD CONSTRAINT encounters_id_campaign_id_key UNIQUE (id, campaign_id);

CREATE TABLE public.campaign_scene_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, campaign_id)
);
CREATE INDEX campaign_scene_definitions_campaign_idx
  ON public.campaign_scene_definitions (campaign_id, updated_at DESC, id DESC);
ALTER TABLE public.campaign_scene_definitions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campaign_scene_definitions FROM anon, authenticated;

CREATE TABLE public.encounter_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  encounter_id uuid NOT NULL UNIQUE,
  definition_id uuid NOT NULL,
  definition_version integer NOT NULL CHECK (definition_version > 0),
  definition_snapshot jsonb NOT NULL CHECK (jsonb_typeof(definition_snapshot) = 'object'),
  projection jsonb NOT NULL CHECK (jsonb_typeof(projection) = 'object'),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  attach_command_id uuid NOT NULL,
  attach_command_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, encounter_id),
  FOREIGN KEY (encounter_id, campaign_id)
    REFERENCES public.encounters (id, campaign_id) ON DELETE CASCADE,
  FOREIGN KEY (definition_id, campaign_id)
    REFERENCES public.campaign_scene_definitions (id, campaign_id) ON DELETE RESTRICT
);
CREATE INDEX encounter_scenes_definition_idx
  ON public.encounter_scenes (definition_id, definition_version);
ALTER TABLE public.encounter_scenes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_scenes FROM anon, authenticated;

CREATE TABLE public.encounter_scene_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid NOT NULL,
  encounter_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  command_id uuid NOT NULL,
  command_type text NOT NULL CHECK (char_length(btrim(command_type)) BETWEEN 1 AND 80),
  command_fingerprint text NOT NULL,
  delta jsonb NOT NULL CHECK (jsonb_typeof(delta) = 'object'),
  actor_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (encounter_id, command_id),
  UNIQUE (scene_id, version),
  FOREIGN KEY (scene_id, encounter_id)
    REFERENCES public.encounter_scenes (id, encounter_id) ON DELETE CASCADE
);
CREATE INDEX encounter_scene_events_replay_idx
  ON public.encounter_scene_events (scene_id, version ASC);
ALTER TABLE public.encounter_scene_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_scene_events FROM anon, authenticated;

SELECT public.apply_updated_at_triggers();

ALTER TABLE public.media_assets
  DROP CONSTRAINT IF EXISTS media_assets_profile_chk,
  DROP CONSTRAINT IF EXISTS media_assets_declared_mime_type_chk,
  DROP CONSTRAINT IF EXISTS media_assets_verified_mime_type_chk,
  DROP CONSTRAINT IF EXISTS media_assets_declared_bytes_chk;
ALTER TABLE public.media_assets
  ADD CONSTRAINT media_assets_profile_chk
    CHECK (profile IN ('ACCOUNT_AVATAR', 'CHARACTER_PORTRAIT', 'AUTHORED_IMAGE', 'CAMPAIGN_FILE', 'CAMPAIGN_HANDOUT_MAP', 'VTT_MAP')),
  ADD CONSTRAINT media_assets_declared_mime_type_chk
    CHECK (declared_mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'text/plain') AND (profile NOT IN ('CAMPAIGN_HANDOUT_MAP', 'VTT_MAP') OR declared_mime_type <> 'text/plain')),
  ADD CONSTRAINT media_assets_verified_mime_type_chk
    CHECK (verified_mime_type IS NULL OR (verified_mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'text/plain') AND (profile NOT IN ('CAMPAIGN_HANDOUT_MAP', 'VTT_MAP') OR verified_mime_type <> 'text/plain'))),
  ADD CONSTRAINT media_assets_declared_bytes_chk
    CHECK (declared_bytes BETWEEN 1 AND CASE WHEN profile = 'VTT_MAP' THEN 26214400 ELSE 6291456 END);

CREATE TABLE public.vtt_map_tiles (
  asset_id uuid NOT NULL REFERENCES public.media_assets (id) ON DELETE CASCADE,
  row_index integer NOT NULL CHECK (row_index >= 0),
  column_index integer NOT NULL CHECK (column_index >= 0),
  object_key text NOT NULL UNIQUE,
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 1024),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 1024),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_id, row_index, column_index)
);
ALTER TABLE public.vtt_map_tiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.vtt_map_tiles FROM anon, authenticated;

UPDATE storage.buckets SET file_size_limit = 26214400 WHERE id = 'media';

CREATE OR REPLACE FUNCTION public.enqueue_media_object_deletions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.media_object_deletions (object_key)
  VALUES (OLD.raw_object_key)
  ON CONFLICT (object_key) DO NOTHING;
  INSERT INTO public.media_object_deletions (object_key)
  SELECT object_key FROM public.media_variants WHERE asset_id = OLD.id
  ON CONFLICT (object_key) DO NOTHING;
  INSERT INTO public.media_object_deletions (object_key)
  SELECT object_key FROM public.vtt_map_tiles WHERE asset_id = OLD.id
  ON CONFLICT (object_key) DO NOTHING;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_vtt_scene_map_asset()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  map_asset_id uuid;
  map_width integer;
  map_height integer;
BEGIN
  map_asset_id := (NEW.definition #>> '{map,assetId}')::uuid;
  map_width := (NEW.definition #>> '{map,width}')::integer;
  map_height := (NEW.definition #>> '{map,height}')::integer;
  IF NOT EXISTS (
    SELECT 1 FROM public.media_assets asset
    WHERE asset.id = map_asset_id
      AND asset.profile = 'VTT_MAP'
      AND asset.status = 'READY'
      AND asset.target_key = 'VTT_MAP:' || NEW.campaign_id::text
      AND asset.width = map_width
      AND asset.height = map_height
  ) THEN
    RAISE EXCEPTION 'Scene maps require a ready VTT map for the same Campaign with matching dimensions.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER campaign_scene_definitions_validate_vtt_map_trigger
BEFORE INSERT OR UPDATE OF campaign_id, definition ON public.campaign_scene_definitions
FOR EACH ROW EXECUTE FUNCTION public.validate_vtt_scene_map_asset();

CREATE OR REPLACE FUNCTION public.protect_referenced_vtt_map_asset()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.profile = 'VTT_MAP' AND EXISTS (
    SELECT 1 FROM public.campaign_scene_definitions definition
    WHERE definition.definition #>> '{map,assetId}' = OLD.id::text
    UNION ALL
    SELECT 1 FROM public.encounter_scenes scene
    WHERE scene.definition_snapshot #>> '{map,assetId}' = OLD.id::text
       OR scene.projection #>> '{map,assetId}' = OLD.id::text
  ) THEN
    RAISE EXCEPTION 'A VTT map referenced by a scene cannot be deleted or changed.';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER media_assets_protect_referenced_vtt_map_update_trigger
BEFORE UPDATE OF status, profile ON public.media_assets
FOR EACH ROW EXECUTE FUNCTION public.protect_referenced_vtt_map_asset();
CREATE TRIGGER media_assets_protect_referenced_vtt_map_delete_trigger
BEFORE DELETE ON public.media_assets
FOR EACH ROW EXECUTE FUNCTION public.protect_referenced_vtt_map_asset();

CREATE OR REPLACE FUNCTION public.sync_vtt_scene_map_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  old_asset_id uuid;
  new_asset_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_asset_id := (OLD.definition #>> '{map,assetId}')::uuid; END IF;
  IF TG_OP <> 'DELETE' THEN new_asset_id := (NEW.definition #>> '{map,assetId}')::uuid; END IF;
  IF new_asset_id IS NOT NULL THEN
    UPDATE public.media_assets SET unreferenced_at = NULL WHERE id = new_asset_id;
  END IF;
  IF old_asset_id IS NOT NULL AND old_asset_id IS DISTINCT FROM new_asset_id THEN
    UPDATE public.media_assets asset SET unreferenced_at = coalesce(unreferenced_at, now())
    WHERE asset.id = old_asset_id
      AND NOT EXISTS (SELECT 1 FROM public.campaign_scene_definitions definition WHERE definition.definition #>> '{map,assetId}' = asset.id::text)
      AND NOT EXISTS (SELECT 1 FROM public.encounter_scenes scene WHERE scene.definition_snapshot #>> '{map,assetId}' = asset.id::text OR scene.projection #>> '{map,assetId}' = asset.id::text);
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER campaign_scene_definitions_sync_vtt_map_reference_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.campaign_scene_definitions
FOR EACH ROW EXECUTE FUNCTION public.sync_vtt_scene_map_reference();

CREATE OR REPLACE FUNCTION public.sync_encounter_scene_map_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  old_asset_id uuid;
  new_asset_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_asset_id := (OLD.definition_snapshot #>> '{map,assetId}')::uuid; END IF;
  IF TG_OP <> 'DELETE' THEN new_asset_id := (NEW.definition_snapshot #>> '{map,assetId}')::uuid; END IF;
  IF new_asset_id IS NOT NULL THEN
    UPDATE public.media_assets SET unreferenced_at = NULL WHERE id = new_asset_id;
  END IF;
  IF old_asset_id IS NOT NULL AND old_asset_id IS DISTINCT FROM new_asset_id THEN
    UPDATE public.media_assets asset SET unreferenced_at = coalesce(unreferenced_at, now())
    WHERE asset.id = old_asset_id
      AND NOT EXISTS (SELECT 1 FROM public.campaign_scene_definitions definition WHERE definition.definition #>> '{map,assetId}' = asset.id::text)
      AND NOT EXISTS (SELECT 1 FROM public.encounter_scenes scene WHERE scene.definition_snapshot #>> '{map,assetId}' = asset.id::text OR scene.projection #>> '{map,assetId}' = asset.id::text);
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER encounter_scenes_sync_vtt_map_reference_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.encounter_scenes
FOR EACH ROW EXECUTE FUNCTION public.sync_encounter_scene_map_reference();
