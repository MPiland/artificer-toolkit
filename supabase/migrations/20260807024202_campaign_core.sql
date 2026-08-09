CREATE TABLE public.account_entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'FREE' CHECK (tier IN ('FREE', 'PLAYER', 'GM', 'PRO_GM')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_entitlements ENABLE ROW LEVEL SECURITY;
INSERT INTO public.account_entitlements (user_id) SELECT id FROM auth.users ON CONFLICT (user_id) DO NOTHING;
ALTER TABLE public.characters ADD CONSTRAINT characters_id_user_id_key UNIQUE (id, user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
SET search_path = pg_catalog, public LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE profile_username text := NULLIF(trim(NEW.raw_user_meta_data ->> 'username'), '');
BEGIN
  IF lower(profile_username) IN ('admin', 'moderator', 'support', 'system', 'root', 'artificer', 'artificer_toolkit') THEN RAISE EXCEPTION 'Username is reserved.'; END IF;
  INSERT INTO public.profiles (id, username, full_name, avatar_url) VALUES (NEW.id, profile_username, NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'avatar_url') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.account_entitlements (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100), description text CHECK (description IS NULL OR char_length(description) <= 2000),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ARCHIVED')), visibility text NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PRIVATE','PUBLIC')),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX campaigns_owner_status_idx ON public.campaigns(owner_user_id,status);
CREATE INDEX campaigns_public_active_idx ON public.campaigns(created_at DESC) WHERE status='ACTIVE' AND visibility='PUBLIC';
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.campaign_memberships (
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK(role IN ('OWNER','PLAYER')), status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','LEFT')),
  access_started_at timestamptz NOT NULL DEFAULT now(), joined_at timestamptz NOT NULL DEFAULT now(), left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(campaign_id,user_id),
  CHECK ((status='ACTIVE' AND left_at IS NULL) OR (status='LEFT' AND left_at IS NOT NULL))
);
CREATE UNIQUE INDEX campaign_memberships_one_owner_idx ON public.campaign_memberships(campaign_id) WHERE role='OWNER' AND status='ACTIVE';
CREATE INDEX campaign_memberships_user_status_idx ON public.campaign_memberships(user_id,status);
CREATE INDEX campaign_memberships_campaign_status_role_idx ON public.campaign_memberships(campaign_id,status,role);
ALTER TABLE public.campaign_memberships ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.campaign_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, kind text NOT NULL CHECK(kind IN ('LINK','USERNAME','EMAIL')),
  token_digest bytea NOT NULL UNIQUE, target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, target_email text, expires_at timestamptz NOT NULL, revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind='LINK' AND target_user_id IS NULL AND target_email IS NULL) OR (kind='USERNAME' AND target_user_id IS NOT NULL AND target_email IS NULL) OR (kind='EMAIL' AND target_user_id IS NULL AND target_email IS NOT NULL AND char_length(btrim(target_email)) BETWEEN 1 AND 320 AND target_email=lower(target_email)))
);
CREATE UNIQUE INDEX campaign_invites_one_active_link_idx ON public.campaign_invites(campaign_id) WHERE kind='LINK' AND revoked_at IS NULL;
CREATE INDEX campaign_invites_campaign_idx ON public.campaign_invites(campaign_id,expires_at);
CREATE INDEX campaign_invites_target_user_idx ON public.campaign_invites(target_user_id) WHERE target_user_id IS NOT NULL;
CREATE INDEX campaign_invites_target_email_idx ON public.campaign_invites(target_email) WHERE target_email IS NOT NULL;
ALTER TABLE public.campaign_invites ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.campaign_ownership_transfers (
  campaign_id uuid PRIMARY KEY REFERENCES public.campaigns(id) ON DELETE CASCADE, from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), CHECK(from_user_id<>to_user_id)
);
CREATE INDEX campaign_ownership_transfers_to_user_idx ON public.campaign_ownership_transfers(to_user_id,expires_at);
ALTER TABLE public.campaign_ownership_transfers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.campaign_character_assignments (
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE, character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, assigned_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(campaign_id,character_id), UNIQUE(campaign_id,user_id), UNIQUE(character_id),
  FOREIGN KEY(campaign_id,user_id) REFERENCES public.campaign_memberships(campaign_id,user_id) ON DELETE CASCADE, FOREIGN KEY(character_id,user_id) REFERENCES public.characters(id,user_id) ON DELETE CASCADE
);
CREATE INDEX campaign_character_assignments_user_idx ON public.campaign_character_assignments(user_id);
ALTER TABLE public.campaign_character_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.campaign_content_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE, subject_kind text NOT NULL CHECK(subject_kind IN ('BACKGROUND','CLASS','CREATURE','EQUIPMENT','FEAT','RACE','SPELL','VEHICLE')), subject_id uuid NOT NULL,
  authored_by uuid NOT NULL, revision integer NOT NULL CHECK(revision>0), state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','APPROVED','REJECTED')),
  snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'), approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, approved_at timestamptz, rejected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(campaign_id,subject_kind,subject_id,revision), UNIQUE(id,campaign_id,subject_kind,subject_id),
  CHECK ((state='PENDING' AND approved_by IS NULL AND approved_at IS NULL AND rejected_at IS NULL) OR (state='APPROVED' AND approved_by IS NOT NULL AND approved_at IS NOT NULL AND rejected_at IS NULL) OR (state='REJECTED' AND approved_by IS NULL AND approved_at IS NULL AND rejected_at IS NOT NULL))
);
CREATE INDEX campaign_content_versions_campaign_state_idx ON public.campaign_content_versions(campaign_id,state);
CREATE OR REPLACE FUNCTION public.reject_campaign_content_version_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN IF OLD.state='APPROVED' THEN RAISE EXCEPTION 'Approved campaign content versions are immutable.'; END IF; RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END; $$;
CREATE TRIGGER campaign_content_versions_immutable BEFORE UPDATE ON public.campaign_content_versions FOR EACH ROW EXECUTE FUNCTION public.reject_campaign_content_version_mutation();
ALTER TABLE public.campaign_content_versions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.campaign_character_content_bindings (
  campaign_id uuid NOT NULL, character_id uuid NOT NULL, subject_kind text NOT NULL CHECK(subject_kind IN ('BACKGROUND','CLASS','CREATURE','EQUIPMENT','FEAT','RACE','SPELL','VEHICLE')), subject_id uuid NOT NULL,
  content_version_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(campaign_id,character_id,subject_kind,subject_id), FOREIGN KEY(campaign_id,character_id) REFERENCES public.campaign_character_assignments(campaign_id,character_id) ON DELETE CASCADE,
  FOREIGN KEY(content_version_id,campaign_id,subject_kind,subject_id) REFERENCES public.campaign_content_versions(id,campaign_id,subject_kind,subject_id) ON DELETE CASCADE
);
CREATE INDEX campaign_character_content_bindings_version_idx ON public.campaign_character_content_bindings(content_version_id);
ALTER TABLE public.campaign_character_content_bindings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.inventory_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN ('CHARACTER','CAMPAIGN')), character_id uuid REFERENCES public.characters(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE, version integer NOT NULL DEFAULT 0 CHECK(version>=0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind='CHARACTER' AND character_id IS NOT NULL AND campaign_id IS NULL) OR (kind='CAMPAIGN' AND campaign_id IS NOT NULL AND character_id IS NULL))
);
CREATE UNIQUE INDEX inventory_owners_character_idx ON public.inventory_owners(character_id) WHERE character_id IS NOT NULL;
CREATE UNIQUE INDEX inventory_owners_campaign_idx ON public.inventory_owners(campaign_id) WHERE campaign_id IS NOT NULL;
ALTER TABLE public.inventory_owners ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.create_campaign_inventory_owner() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN INSERT INTO public.inventory_owners(kind,campaign_id) VALUES('CAMPAIGN',NEW.id) ON CONFLICT(campaign_id) WHERE campaign_id IS NOT NULL DO NOTHING; RETURN NEW; END; $$;
CREATE TRIGGER campaigns_create_inventory_owner AFTER INSERT ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.create_campaign_inventory_owner();
CREATE OR REPLACE FUNCTION public.create_character_inventory_owner() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN INSERT INTO public.inventory_owners(kind,character_id) VALUES('CHARACTER',NEW.id) ON CONFLICT(character_id) WHERE character_id IS NOT NULL DO NOTHING; RETURN NEW; END; $$;
CREATE TRIGGER characters_create_inventory_owner AFTER INSERT ON public.characters FOR EACH ROW EXECUTE FUNCTION public.create_character_inventory_owner();

CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES public.inventory_owners(id) ON DELETE CASCADE, equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK(quantity>0), container_id uuid, custom_name text, notes text, equipped boolean NOT NULL DEFAULT false, attuned boolean NOT NULL DEFAULT false,
  placement_kind text CHECK(placement_kind IN ('CREATURE','VEHICLE')), placement_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id,id),
  FOREIGN KEY(owner_id,container_id) REFERENCES public.inventory_items(owner_id,id) ON DELETE RESTRICT DEFERRABLE,
  CHECK ((placement_kind IS NULL AND placement_id IS NULL) OR (placement_kind IS NOT NULL AND placement_id IS NOT NULL))
);
CREATE INDEX inventory_items_owner_idx ON public.inventory_items(owner_id); CREATE INDEX inventory_items_equipment_idx ON public.inventory_items(equipment_id); CREATE INDEX inventory_items_container_idx ON public.inventory_items(container_id) WHERE container_id IS NOT NULL;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.inventory_currency_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES public.inventory_owners(id) ON DELETE CASCADE, container_item_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id,id), FOREIGN KEY(owner_id,container_item_id) REFERENCES public.inventory_items(owner_id,id) ON DELETE RESTRICT DEFERRABLE
);
CREATE INDEX inventory_currency_groups_owner_idx ON public.inventory_currency_groups(owner_id); ALTER TABLE public.inventory_currency_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.campaign_currency_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE, name text NOT NULL CHECK(char_length(btrim(name)) BETWEEN 1 AND 100), is_reference boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 0 CHECK(version>=0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX campaign_currency_systems_reference_idx ON public.campaign_currency_systems(campaign_id) WHERE is_reference; CREATE INDEX campaign_currency_systems_campaign_idx ON public.campaign_currency_systems(campaign_id); ALTER TABLE public.campaign_currency_systems ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.campaign_currency_denominations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), system_id uuid NOT NULL REFERENCES public.campaign_currency_systems(id) ON DELETE CASCADE, name text NOT NULL CHECK(char_length(btrim(name)) BETWEEN 1 AND 100), abbreviation text NOT NULL CHECK(char_length(btrim(abbreviation)) BETWEEN 1 AND 16),
  scale_in_reference bigint NOT NULL CHECK(scale_in_reference>0), sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(system_id,name), UNIQUE(system_id,abbreviation), UNIQUE(system_id,scale_in_reference)
);
CREATE OR REPLACE FUNCTION public.limit_campaign_currency_denominations() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN PERFORM 1 FROM public.campaign_currency_systems WHERE id=NEW.system_id FOR UPDATE; IF (SELECT count(*) FROM public.campaign_currency_denominations WHERE system_id=NEW.system_id AND id<>COALESCE(NEW.id,'00000000-0000-0000-0000-000000000000'::uuid))>=5 THEN RAISE EXCEPTION 'Campaign currency systems support at most five denominations.'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER campaign_currency_denominations_limit BEFORE INSERT OR UPDATE OF system_id ON public.campaign_currency_denominations FOR EACH ROW EXECUTE FUNCTION public.limit_campaign_currency_denominations();
ALTER TABLE public.campaign_currency_denominations ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.inventory_currency_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES public.inventory_owners(id) ON DELETE CASCADE, group_id uuid,
  ruleset_currency_id uuid REFERENCES public.currencies(id) ON DELETE RESTRICT, campaign_denomination_id uuid REFERENCES public.campaign_currency_denominations(id) ON DELETE RESTRICT, amount bigint NOT NULL CHECK(amount>=0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(owner_id,group_id) REFERENCES public.inventory_currency_groups(owner_id,id) ON DELETE CASCADE, CHECK((ruleset_currency_id IS NOT NULL AND campaign_denomination_id IS NULL) OR (ruleset_currency_id IS NULL AND campaign_denomination_id IS NOT NULL))
);
CREATE UNIQUE INDEX inventory_currency_balances_ruleset_idx ON public.inventory_currency_balances(owner_id,coalesce(group_id,'00000000-0000-0000-0000-000000000000'::uuid),ruleset_currency_id) WHERE ruleset_currency_id IS NOT NULL;
CREATE UNIQUE INDEX inventory_currency_balances_campaign_idx ON public.inventory_currency_balances(owner_id,coalesce(group_id,'00000000-0000-0000-0000-000000000000'::uuid),campaign_denomination_id) WHERE campaign_denomination_id IS NOT NULL;
CREATE INDEX inventory_currency_balances_owner_idx ON public.inventory_currency_balances(owner_id); ALTER TABLE public.inventory_currency_balances ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.campaign_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL, character_id uuid NOT NULL, family text NOT NULL, slot_key text NOT NULL, payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'), visibility text NOT NULL DEFAULT 'VISIBLE' CHECK(visibility IN ('VISIBLE','SECRET')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, version integer NOT NULL DEFAULT 0 CHECK(version>=0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(campaign_id,character_id,family,slot_key), FOREIGN KEY(campaign_id,character_id) REFERENCES public.campaign_character_assignments(campaign_id,character_id) ON DELETE CASCADE
);
CREATE INDEX campaign_adjustments_character_idx ON public.campaign_adjustments(campaign_id,character_id); ALTER TABLE public.campaign_adjustments ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE, actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, subject_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, subject_character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  kind text NOT NULL, visibility text NOT NULL CHECK(visibility IN ('TABLE','OWNER','SUBJECT')), payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(payload)='object'), idempotency_key uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX campaign_events_idempotency_idx ON public.campaign_events(campaign_id,idempotency_key) WHERE idempotency_key IS NOT NULL; CREATE INDEX campaign_events_timeline_idx ON public.campaign_events(campaign_id,created_at DESC,id DESC); CREATE INDEX campaign_events_subject_idx ON public.campaign_events(subject_user_id,subject_character_id,created_at DESC); ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.campaign_room_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE, room text NOT NULL CHECK(room IN ('TABLE','PARTY')), kind text NOT NULL CHECK(kind IN ('CHAT','ROLL')),
  author_user_id uuid NOT NULL, author_character_id uuid, mode text CHECK(mode IN ('OOC','ROLEPLAY')), body text CHECK(body IS NULL OR char_length(body)<=2000), roll_payload jsonb CHECK(roll_payload IS NULL OR jsonb_typeof(roll_payload)='object'),
  username_snapshot text NOT NULL CHECK(char_length(btrim(username_snapshot)) BETWEEN 1 AND 30), character_name_snapshot text CHECK(character_name_snapshot IS NULL OR char_length(character_name_snapshot)<=100), client_nonce uuid NOT NULL, edited_at timestamptz, unsent_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(campaign_id,author_user_id,client_nonce),
  CHECK ((kind='CHAT' AND roll_payload IS NULL AND mode IS NOT NULL AND ((unsent_at IS NULL AND body IS NOT NULL) OR (unsent_at IS NOT NULL AND body IS NULL))) OR (kind='ROLL' AND roll_payload IS NOT NULL AND body IS NULL AND mode IS NULL AND unsent_at IS NULL AND edited_at IS NULL))
);
CREATE INDEX campaign_room_entries_cursor_idx ON public.campaign_room_entries(campaign_id,room,created_at DESC,id DESC);
CREATE OR REPLACE FUNCTION public.lock_campaign_room_entry() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN PERFORM pg_advisory_xact_lock(hashtextextended(NEW.campaign_id::text||':'||NEW.room,0)); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.trim_campaign_room_entries() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN DELETE FROM public.campaign_room_entries WHERE id IN (SELECT id FROM public.campaign_room_entries WHERE campaign_id=NEW.campaign_id AND room=NEW.room ORDER BY created_at DESC,id DESC OFFSET 500); RETURN NULL; END; $$;
CREATE TRIGGER campaign_room_entries_lock BEFORE INSERT ON public.campaign_room_entries FOR EACH ROW EXECUTE FUNCTION public.lock_campaign_room_entry(); CREATE TRIGGER campaign_room_entries_trim AFTER INSERT ON public.campaign_room_entries FOR EACH ROW EXECUTE FUNCTION public.trim_campaign_room_entries(); ALTER TABLE public.campaign_room_entries ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.campaign_note_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE, title text NOT NULL CHECK(char_length(btrim(title)) BETWEEN 1 AND 120), content text NOT NULL CHECK(char_length(content)<=100000), visibility text NOT NULL DEFAULT 'GM_PRIVATE' CHECK(visibility IN ('GM_PRIVATE','SHARED')), sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order>=0), version integer NOT NULL DEFAULT 0 CHECK(version>=0), created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX campaign_note_sections_campaign_sort_idx ON public.campaign_note_sections(campaign_id,sort_order); ALTER TABLE public.campaign_note_sections ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.campaign_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE, title text NOT NULL CHECK(char_length(btrim(title)) BETWEEN 1 AND 120), session_date date, version integer NOT NULL DEFAULT 0 CHECK(version>=0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX campaign_sessions_campaign_idx ON public.campaign_sessions(campaign_id,session_date DESC); ALTER TABLE public.campaign_sessions ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.campaign_session_note_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES public.campaign_sessions(id) ON DELETE CASCADE, title text NOT NULL CHECK(char_length(btrim(title)) BETWEEN 1 AND 120), content text NOT NULL CHECK(char_length(content)<=100000), sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order>=0), version integer NOT NULL DEFAULT 0 CHECK(version>=0), created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX campaign_session_note_sections_session_sort_idx ON public.campaign_session_note_sections(session_id,sort_order); CREATE INDEX campaign_session_note_sections_updated_by_idx ON public.campaign_session_note_sections(updated_by); ALTER TABLE public.campaign_session_note_sections ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  conflicting_character_id uuid;
  conflicting_equipment_id uuid;
  conflicting_placement_count bigint;
BEGIN
  SELECT
    placement.character_id,
    placement.equipment_id,
    count(*)
  INTO
    conflicting_character_id,
    conflicting_equipment_id,
    conflicting_placement_count
  FROM (
    SELECT
      creature_equipment.character_id,
      creature_equipment.equipment_id
    FROM public.character_creature_equipment AS creature_equipment
    UNION ALL
    SELECT
      vehicle_equipment.character_id,
      vehicle_equipment.equipment_id
    FROM public.character_vehicle_equipment AS vehicle_equipment
  ) AS placement
  GROUP BY placement.character_id, placement.equipment_id
  HAVING count(*) > 1
  ORDER BY placement.character_id, placement.equipment_id
  LIMIT 1;

  IF conflicting_equipment_id IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = format(
        'Legacy inventory item %s for Character %s has %s creature or vehicle placements.',
        conflicting_equipment_id,
        conflicting_character_id,
        conflicting_placement_count
      ),
      HINT = 'Reconcile the legacy assignments so each inventory item is assigned to at most one creature or vehicle, then rerun the migration.';
  END IF;
END;
$$;

INSERT INTO public.inventory_owners(kind,character_id) SELECT 'CHARACTER',id FROM public.characters ON CONFLICT(character_id) WHERE character_id IS NOT NULL DO NOTHING;
INSERT INTO public.inventory_items(id,owner_id,equipment_id,quantity,container_id,custom_name,notes,equipped,attuned,placement_kind,placement_id,created_at,updated_at)
SELECT equipment.id,owner.id,equipment.equipment_id,equipment.quantity,equipment.container_id,equipment.custom_name,equipment.notes,EXISTS(SELECT 1 FROM public.character_equipped equipped WHERE equipped.character_id=equipment.character_id AND equipped.equipment_id=equipment.id),EXISTS(SELECT 1 FROM public.character_attuned attuned WHERE attuned.character_id=equipment.character_id AND attuned.equipment_id=equipment.id),CASE WHEN creature_equipment.character_creature_id IS NOT NULL THEN 'CREATURE' WHEN vehicle_equipment.character_vehicle_id IS NOT NULL THEN 'VEHICLE' END,COALESCE(creature_equipment.character_creature_id,vehicle_equipment.character_vehicle_id),equipment.created_at,equipment.updated_at FROM public.character_equipment equipment JOIN public.inventory_owners owner ON owner.character_id=equipment.character_id LEFT JOIN public.character_creature_equipment creature_equipment ON creature_equipment.character_id=equipment.character_id AND creature_equipment.equipment_id=equipment.id LEFT JOIN public.character_vehicle_equipment vehicle_equipment ON vehicle_equipment.character_id=equipment.character_id AND vehicle_equipment.equipment_id=equipment.id ON CONFLICT(id) DO NOTHING;
INSERT INTO public.inventory_currency_groups(id,owner_id,container_item_id,created_at,updated_at) SELECT currency_group.id,owner.id,currency_group.container_id,currency_group.created_at,currency_group.updated_at FROM public.character_currency_groups currency_group JOIN public.inventory_owners owner ON owner.character_id=currency_group.character_id ON CONFLICT(id) DO NOTHING;
INSERT INTO public.inventory_currency_balances(owner_id,group_id,ruleset_currency_id,amount,created_at,updated_at) SELECT owner.id,currency.group_id,currency.currency_id,currency.amount,currency.created_at,currency.updated_at FROM public.character_currencies currency JOIN public.inventory_owners owner ON owner.character_id=currency.character_id ON CONFLICT DO NOTHING;
INSERT INTO public.inventory_owners(kind,campaign_id) SELECT 'CAMPAIGN',id FROM public.campaigns ON CONFLICT(campaign_id) WHERE campaign_id IS NOT NULL DO NOTHING;

CREATE OR REPLACE FUNCTION public.can_subscribe_campaign_realtime_topic(requested_topic text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaign_memberships membership WHERE membership.user_id=auth.uid() AND membership.status='ACTIVE' AND (requested_topic='campaign:'||membership.campaign_id||':table:'||membership.user_id||':'||((extract(epoch FROM date_trunc('milliseconds',membership.access_started_at))*1000)::bigint)::text OR (requested_topic='campaign:'||membership.campaign_id||':party:'||membership.user_id||':'||((extract(epoch FROM date_trunc('milliseconds',membership.access_started_at))*1000)::bigint)::text AND membership.role='PLAYER') OR (requested_topic='campaign:'||membership.campaign_id||':owner:'||membership.user_id||':'||((extract(epoch FROM date_trunc('milliseconds',membership.access_started_at))*1000)::bigint)::text AND membership.role='OWNER'))
  )
$$;
REVOKE ALL ON FUNCTION public.can_subscribe_campaign_realtime_topic(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_subscribe_campaign_realtime_topic(text) TO authenticated;

DROP POLICY IF EXISTS campaign_realtime_topics ON realtime.messages;
CREATE POLICY campaign_realtime_topics ON realtime.messages FOR SELECT TO authenticated USING (public.can_subscribe_campaign_realtime_topic(realtime.topic()));

SELECT public.apply_updated_at_triggers();
