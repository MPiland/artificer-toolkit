CREATE TABLE IF NOT EXISTS public.encounter_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  command_id uuid NOT NULL,
  command_fingerprint text NOT NULL,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  enemies jsonb NOT NULL CHECK (jsonb_typeof(enemies) = 'array' AND jsonb_array_length(enemies) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, command_id)
);
CREATE INDEX IF NOT EXISTS encounter_templates_campaign_idx ON public.encounter_templates (campaign_id, updated_at DESC);
ALTER TABLE public.encounter_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_templates FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.campaign_sessions (id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.encounter_templates (id) ON DELETE RESTRICT,
  template_version integer NOT NULL CHECK (template_version > 0),
  rule_pack_revision_id uuid REFERENCES public.rule_pack_revisions (id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  status text NOT NULL DEFAULT 'PREPARED' CHECK (status IN ('PREPARED', 'ACTIVE', 'COMPLETED')),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  round integer NOT NULL DEFAULT 0 CHECK (round >= 0),
  current_actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, campaign_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS encounters_one_active_per_campaign_idx
  ON public.encounters (campaign_id) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS encounters_campaign_idx
  ON public.encounters (campaign_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS encounters_session_idx
  ON public.encounters (session_id, status, updated_at DESC);
ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounters FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.encounter_actors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('CHARACTER', 'CREATURE', 'CUSTOM')),
  source_id uuid,
  source_revision integer CHECK (source_revision IS NULL OR source_revision > 0),
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 160),
  system_id uuid,
  stable_tie_key text NOT NULL,
  public boolean NOT NULL DEFAULT true,
  current_hit_points integer NOT NULL DEFAULT 0 CHECK (current_hit_points >= 0),
  max_hit_points integer NOT NULL DEFAULT 0 CHECK (max_hit_points >= 0),
  temp_hit_points integer NOT NULL DEFAULT 0 CHECK (temp_hit_points >= 0),
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(conditions) = 'array'),
  resources jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(resources) = 'object'),
  gm_notes text CHECK (gm_notes IS NULL OR char_length(gm_notes) <= 4000),
  initiative integer,
  manual_order integer CHECK (manual_order IS NULL OR manual_order >= 0),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (encounter_id, stable_tie_key),
  CHECK (
    (kind = 'CUSTOM' AND source_id IS NULL)
    OR (kind IN ('CHARACTER', 'CREATURE') AND source_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS encounter_actors_order_idx
  ON public.encounter_actors (encounter_id, manual_order, initiative DESC, stable_tie_key);
ALTER TABLE public.encounter_actors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_actors FROM anon, authenticated;

ALTER TABLE public.encounters
  DROP CONSTRAINT IF EXISTS encounters_current_actor_fk;
ALTER TABLE public.encounters
  ADD CONSTRAINT encounters_current_actor_fk
  FOREIGN KEY (current_actor_id) REFERENCES public.encounter_actors (id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.assert_encounter_current_actor()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.current_actor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.encounter_actors actor
    WHERE actor.id = NEW.current_actor_id AND actor.encounter_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'current actor must belong to its encounter' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS encounters_current_actor_same_encounter ON public.encounters;
CREATE TRIGGER encounters_current_actor_same_encounter
  BEFORE INSERT OR UPDATE OF current_actor_id ON public.encounters
  FOR EACH ROW EXECUTE FUNCTION public.assert_encounter_current_actor();

CREATE TABLE IF NOT EXISTS public.encounter_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters (id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 160),
  timing text NOT NULL CHECK (timing IN ('ROUND_START', 'ROUND_END', 'ROUND_NUMBER', 'TURN_START', 'TURN_END')),
  round integer CHECK (round IS NULL OR round > 0),
  actor_id uuid REFERENCES public.encounter_actors (id) ON DELETE CASCADE,
  public boolean NOT NULL DEFAULT false,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 4000),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  CHECK ((timing = 'ROUND_NUMBER') = (round IS NOT NULL)),
  CHECK ((timing IN ('TURN_START', 'TURN_END')) = (actor_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS encounter_reminders_encounter_idx ON public.encounter_reminders (encounter_id, sort_order, id);
ALTER TABLE public.encounter_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_reminders FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.encounter_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters (id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version >= 0),
  command_id uuid NOT NULL,
  command_type text NOT NULL CHECK (char_length(btrim(command_type)) BETWEEN 1 AND 80),
  command_fingerprint text NOT NULL,
  command_payload jsonb NOT NULL CHECK (jsonb_typeof(command_payload) = 'object'),
  result_payload jsonb NOT NULL CHECK (jsonb_typeof(result_payload) = 'object'),
  actor_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (encounter_id, command_id),
  UNIQUE (encounter_id, version)
);
CREATE INDEX IF NOT EXISTS encounter_events_cursor_idx
  ON public.encounter_events (encounter_id, version DESC, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS encounter_events_campaign_command_idx
  ON public.encounter_events (campaign_id, command_id);
ALTER TABLE public.encounter_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_events FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.campaign_scene_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, campaign_id)
);
CREATE INDEX IF NOT EXISTS campaign_scene_definitions_campaign_idx
  ON public.campaign_scene_definitions (campaign_id, updated_at DESC, id DESC);
ALTER TABLE public.campaign_scene_definitions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campaign_scene_definitions FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.encounter_scenes (
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
CREATE INDEX IF NOT EXISTS encounter_scenes_definition_idx
  ON public.encounter_scenes (definition_id, definition_version);
ALTER TABLE public.encounter_scenes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_scenes FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.encounter_scene_events (
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
CREATE INDEX IF NOT EXISTS encounter_scene_events_replay_idx
  ON public.encounter_scene_events (scene_id, version ASC);
ALTER TABLE public.encounter_scene_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_scene_events FROM anon, authenticated;

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
DROP TRIGGER IF EXISTS campaign_scene_definitions_validate_vtt_map_trigger ON public.campaign_scene_definitions;
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
DROP TRIGGER IF EXISTS media_assets_protect_referenced_vtt_map_update_trigger ON public.media_assets;
CREATE TRIGGER media_assets_protect_referenced_vtt_map_update_trigger
BEFORE UPDATE OF status, profile ON public.media_assets
FOR EACH ROW EXECUTE FUNCTION public.protect_referenced_vtt_map_asset();
DROP TRIGGER IF EXISTS media_assets_protect_referenced_vtt_map_delete_trigger ON public.media_assets;
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
DROP TRIGGER IF EXISTS campaign_scene_definitions_sync_vtt_map_reference_trigger ON public.campaign_scene_definitions;
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
DROP TRIGGER IF EXISTS encounter_scenes_sync_vtt_map_reference_trigger ON public.encounter_scenes;
CREATE TRIGGER encounter_scenes_sync_vtt_map_reference_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.encounter_scenes
FOR EACH ROW EXECUTE FUNCTION public.sync_encounter_scene_map_reference();
