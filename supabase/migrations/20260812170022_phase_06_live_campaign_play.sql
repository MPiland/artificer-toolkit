CREATE TABLE public.campaign_play_settings (
  campaign_id uuid PRIMARY KEY REFERENCES public.campaigns (id) ON DELETE CASCADE,
  normal_cadence_days integer CHECK (normal_cadence_days BETWEEN 1 AND 365),
  expected_duration_minutes integer CHECK (expected_duration_minutes BETWEEN 15 AND 1440),
  quorum integer CHECK (quorum BETWEEN 1 AND 100),
  absent_character_policy text CHECK (absent_character_policy IS NULL OR char_length(btrim(absent_character_policy)) BETWEEN 1 AND 4000),
  content_guidance text CHECK (content_guidance IS NULL OR char_length(btrim(content_guidance)) BETWEEN 1 AND 4000),
  allowed_content_rules text CHECK (allowed_content_rules IS NULL OR char_length(btrim(allowed_content_rules)) BETWEEN 1 AND 4000),
  table_conduct text CHECK (table_conduct IS NULL OR char_length(btrim(table_conduct)) BETWEEN 1 AND 4000),
  content_boundaries text CHECK (content_boundaries IS NULL OR char_length(btrim(content_boundaries)) BETWEEN 1 AND 4000),
  safety_practices text[] NOT NULL DEFAULT '{}'::text[] CHECK (
    cardinality(safety_practices) <= 6 AND safety_practices <@ ARRAY[
      'SESSION_ZERO', 'LINES_AND_VEILS', 'X_CARD', 'OPEN_DOOR', 'SCRIPT_CHANGE', 'OTHER'
    ]::text[]
  ),
  live_safety_method text CHECK (live_safety_method IS NULL OR char_length(btrim(live_safety_method)) BETWEEN 1 AND 500),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campaign_play_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_play_settings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campaign_play_settings FROM anon, authenticated;

CREATE TABLE public.campaign_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  content_version_id uuid NOT NULL REFERENCES public.campaign_content_versions (id) ON DELETE RESTRICT,
  label text CHECK (label IS NULL OR char_length(btrim(label)) BETWEEN 1 AND 120),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, campaign_id)
);
CREATE INDEX campaign_vehicles_campaign_idx ON public.campaign_vehicles (campaign_id, created_at, id);
ALTER TABLE public.campaign_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_vehicles FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campaign_vehicles FROM anon, authenticated;

CREATE FUNCTION public.validate_campaign_vehicle_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.campaign_content_versions version
    WHERE version.id = NEW.content_version_id
      AND version.campaign_id = NEW.campaign_id
      AND version.subject_kind = 'VEHICLE'
      AND version.state = 'APPROVED'
  ) THEN
    RAISE EXCEPTION 'Campaign vehicle requires an approved Vehicle content version.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER campaign_vehicles_validate_version
BEFORE INSERT OR UPDATE OF campaign_id, content_version_id ON public.campaign_vehicles
FOR EACH ROW EXECUTE FUNCTION public.validate_campaign_vehicle_version();

ALTER TABLE public.inventory_owners
  ADD COLUMN vehicle_id uuid REFERENCES public.campaign_vehicles (id) ON DELETE CASCADE;
ALTER TABLE public.inventory_owners DROP CONSTRAINT inventory_owners_kind_check;
ALTER TABLE public.inventory_owners DROP CONSTRAINT inventory_owners_check;
ALTER TABLE public.inventory_owners
  ADD CONSTRAINT inventory_owners_kind_check CHECK (kind IN ('CHARACTER', 'CAMPAIGN', 'VEHICLE')),
  ADD CONSTRAINT inventory_owners_check CHECK (
    (kind = 'CHARACTER' AND character_id IS NOT NULL AND campaign_id IS NULL AND vehicle_id IS NULL)
    OR (kind = 'CAMPAIGN' AND campaign_id IS NOT NULL AND character_id IS NULL AND vehicle_id IS NULL)
    OR (kind = 'VEHICLE' AND vehicle_id IS NOT NULL AND character_id IS NULL AND campaign_id IS NULL)
  );
CREATE UNIQUE INDEX inventory_owners_vehicle_idx ON public.inventory_owners (vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE FUNCTION public.create_vehicle_inventory_owner() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO public.inventory_owners (kind, vehicle_id) VALUES ('VEHICLE', NEW.id)
  ON CONFLICT (vehicle_id) WHERE vehicle_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER campaign_vehicles_create_inventory_owner
AFTER INSERT ON public.campaign_vehicles FOR EACH ROW
EXECUTE FUNCTION public.create_vehicle_inventory_owner();

ALTER TABLE public.campaign_note_sections ADD CONSTRAINT campaign_note_sections_id_campaign_id_key UNIQUE (id, campaign_id);

ALTER TABLE public.media_assets DROP CONSTRAINT media_assets_profile_chk;
ALTER TABLE public.media_assets ADD CONSTRAINT media_assets_profile_chk CHECK (
  profile IN ('ACCOUNT_AVATAR', 'CHARACTER_PORTRAIT', 'AUTHORED_IMAGE', 'CAMPAIGN_FILE', 'CAMPAIGN_HANDOUT_MAP')
);
ALTER TABLE public.media_assets DROP CONSTRAINT media_assets_declared_mime_type_chk;
ALTER TABLE public.media_assets ADD CONSTRAINT media_assets_declared_mime_type_chk CHECK (
  declared_mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'text/plain')
  AND (profile <> 'CAMPAIGN_HANDOUT_MAP' OR declared_mime_type <> 'text/plain')
);
ALTER TABLE public.media_assets DROP CONSTRAINT media_assets_verified_mime_type_chk;
ALTER TABLE public.media_assets ADD CONSTRAINT media_assets_verified_mime_type_chk CHECK (
  verified_mime_type IS NULL OR (
    verified_mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'text/plain')
    AND (profile <> 'CAMPAIGN_HANDOUT_MAP' OR verified_mime_type <> 'text/plain')
  )
);
ALTER TABLE public.media_assets DROP CONSTRAINT media_assets_ready_state_chk;
ALTER TABLE public.media_assets ADD CONSTRAINT media_assets_ready_state_chk CHECK (
  status <> 'READY' OR (
    verified_mime_type IS NOT NULL AND verified_bytes IS NOT NULL AND ready_at IS NOT NULL
    AND ((verified_mime_type = 'text/plain' AND width IS NULL AND height IS NULL)
      OR (verified_mime_type <> 'text/plain' AND width IS NOT NULL AND height IS NOT NULL))
  )
);
ALTER TABLE public.media_assets ADD CONSTRAINT media_assets_id_profile_key UNIQUE (id, profile);
ALTER TABLE public.media_variants ALTER COLUMN width DROP NOT NULL;
ALTER TABLE public.media_variants ALTER COLUMN height DROP NOT NULL;
ALTER TABLE public.media_variants DROP CONSTRAINT media_variants_mime_type_chk;
ALTER TABLE public.media_variants ADD CONSTRAINT media_variants_mime_type_chk CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'text/plain'));
ALTER TABLE public.media_variants DROP CONSTRAINT media_variants_dimensions_chk;
ALTER TABLE public.media_variants ADD CONSTRAINT media_variants_dimensions_chk CHECK (
  (mime_type = 'text/plain' AND width IS NULL AND height IS NULL)
  OR (mime_type <> 'text/plain' AND width > 0 AND height > 0)
);
UPDATE storage.buckets SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'text/plain']::text[] WHERE id = 'media';

CREATE TABLE public.campaign_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  asset_id uuid NOT NULL UNIQUE,
  profile text NOT NULL CHECK (profile IN ('CAMPAIGN_FILE', 'CAMPAIGN_HANDOUT_MAP')),
  uploader_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 120),
  description text CHECK (description IS NULL OR char_length(btrim(description)) BETWEEN 1 AND 1000),
  session_id uuid,
  note_section_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (asset_id, profile) REFERENCES public.media_assets (id, profile) ON DELETE RESTRICT,
  FOREIGN KEY (session_id, campaign_id) REFERENCES public.campaign_sessions (id, campaign_id) ON DELETE CASCADE,
  FOREIGN KEY (note_section_id, campaign_id) REFERENCES public.campaign_note_sections (id, campaign_id) ON DELETE CASCADE
);
CREATE INDEX campaign_attachments_campaign_idx ON public.campaign_attachments (campaign_id, created_at DESC, id DESC);
ALTER TABLE public.campaign_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_attachments FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campaign_attachments FROM anon, authenticated;

CREATE FUNCTION public.validate_ready_campaign_attachment() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.media_assets asset WHERE asset.id = NEW.asset_id AND asset.status = 'READY') THEN
    RAISE EXCEPTION 'Campaign attachments require a ready media asset.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER campaign_attachments_validate_ready
BEFORE INSERT OR UPDATE OF asset_id ON public.campaign_attachments
FOR EACH ROW EXECUTE FUNCTION public.validate_ready_campaign_attachment();

CREATE FUNCTION public.protect_referenced_campaign_asset() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.campaign_attachments attachment WHERE attachment.asset_id = OLD.id)
    AND (NEW.status <> 'READY' OR NEW.profile IS DISTINCT FROM OLD.profile) THEN
    RAISE EXCEPTION 'Referenced Campaign assets must remain ready and keep their profile.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER media_assets_protect_campaign_reference
BEFORE UPDATE OF status, profile ON public.media_assets
FOR EACH ROW EXECUTE FUNCTION public.protect_referenced_campaign_asset();

DROP TRIGGER IF EXISTS campaign_attachments_media_asset_reference_trigger ON public.campaign_attachments;
CREATE TRIGGER campaign_attachments_media_asset_reference_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.campaign_attachments
FOR EACH ROW EXECUTE FUNCTION public.sync_media_asset_unreferenced_at('asset_id');

CREATE OR REPLACE FUNCTION public.sync_media_asset_unreferenced_at() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE old_asset_id uuid; new_asset_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_asset_id := (to_jsonb(OLD) ->> TG_ARGV[0])::uuid; END IF;
  IF TG_OP <> 'DELETE' THEN new_asset_id := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid; END IF;
  IF new_asset_id IS NOT NULL THEN UPDATE public.media_assets SET unreferenced_at = NULL WHERE id = new_asset_id; END IF;
  IF old_asset_id IS NOT NULL AND old_asset_id IS DISTINCT FROM new_asset_id THEN
    UPDATE public.media_assets SET unreferenced_at = COALESCE(unreferenced_at, now())
    WHERE id = old_asset_id
      AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE avatar_asset_id = old_asset_id)
      AND NOT EXISTS (SELECT 1 FROM public.characters WHERE portrait_asset_id = old_asset_id)
      AND NOT EXISTS (SELECT 1 FROM public.authored_image_slots WHERE asset_id = old_asset_id)
      AND NOT EXISTS (SELECT 1 FROM public.campaign_attachments WHERE asset_id = old_asset_id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.campaign_live_play_commands ADD COLUMN correction_reason text;
ALTER TABLE public.campaign_live_play_commands ADD CONSTRAINT campaign_live_play_commands_correction_reason_check CHECK (
  (command_type IN ('REWIND_CLOCK', 'RESET_CLOCK') AND correction_reason IS NOT NULL AND char_length(btrim(correction_reason)) BETWEEN 1 AND 500)
  OR (command_type NOT IN ('REWIND_CLOCK', 'RESET_CLOCK') AND correction_reason IS NULL)
);

CREATE TABLE public.campaign_clock_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  stopped_at timestamptz,
  start_absolute_minute bigint NOT NULL CHECK (start_absolute_minute >= 0),
  end_absolute_minute bigint CHECK (end_absolute_minute >= 0),
  CHECK ((stopped_at IS NULL AND end_absolute_minute IS NULL) OR (stopped_at IS NOT NULL AND end_absolute_minute IS NOT NULL AND stopped_at >= started_at))
);
CREATE UNIQUE INDEX campaign_clock_segments_one_open_idx ON public.campaign_clock_segments (campaign_id) WHERE stopped_at IS NULL;
CREATE INDEX campaign_clock_segments_campaign_idx ON public.campaign_clock_segments (campaign_id, started_at, id);
ALTER TABLE public.campaign_clock_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_clock_segments FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campaign_clock_segments FROM anon, authenticated;

CREATE TABLE public.campaign_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  command_id uuid NOT NULL,
  input_fingerprint text NOT NULL CHECK (char_length(input_fingerprint) = 64),
  author_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  scope text NOT NULL CHECK (scope IN ('TABLE', 'PARTY')),
  party_id uuid,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope = 'TABLE' AND party_id IS NULL) OR (scope = 'PARTY' AND party_id IS NOT NULL)),
  FOREIGN KEY (party_id, campaign_id) REFERENCES public.campaign_conversations (id, campaign_id) ON DELETE CASCADE,
  UNIQUE (campaign_id, command_id)
);
CREATE INDEX campaign_announcements_campaign_idx ON public.campaign_announcements (campaign_id, created_at DESC, id DESC);
ALTER TABLE public.campaign_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_announcements FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campaign_announcements FROM anon, authenticated;
CREATE FUNCTION public.reject_campaign_announcement_update() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$ BEGIN RAISE EXCEPTION 'Published Campaign announcements are immutable.'; END; $$;
CREATE TRIGGER campaign_announcements_immutable BEFORE UPDATE ON public.campaign_announcements
FOR EACH ROW EXECUTE FUNCTION public.reject_campaign_announcement_update();

ALTER TABLE public.notification_delivery_intents DROP CONSTRAINT notification_delivery_intents_workflow_key_check;
ALTER TABLE public.notification_delivery_intents ADD CONSTRAINT notification_delivery_intents_workflow_key_check CHECK (
  workflow_key IN ('social-application-submitted', 'social-application-decided', 'social-invitation-received', 'social-invitation-decided', 'campaign-announcement')
);
ALTER TABLE public.notification_delivery_intents DROP CONSTRAINT notification_delivery_intents_source_kind_check;
ALTER TABLE public.notification_delivery_intents ADD CONSTRAINT notification_delivery_intents_source_kind_check CHECK (
  source_kind IN ('SOCIAL_APPLICATION', 'CAMPAIGN_INVITE', 'CAMPAIGN_ANNOUNCEMENT')
);

SELECT public.apply_updated_at_triggers();
