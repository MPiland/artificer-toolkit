CREATE TABLE IF NOT EXISTS public.encounter_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  enemies jsonb NOT NULL CHECK (jsonb_typeof(enemies) = 'array' AND jsonb_array_length(enemies) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
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
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  status text NOT NULL DEFAULT 'PREPARED' CHECK (status IN ('PREPARED', 'ACTIVE', 'COMPLETED')),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  round integer NOT NULL DEFAULT 0 CHECK (round >= 0),
  current_actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
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

CREATE OR REPLACE FUNCTION public.trim_encounter_events()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  DELETE FROM public.encounter_events
  WHERE id IN (
    SELECT id
    FROM public.encounter_events
    WHERE encounter_id = NEW.encounter_id
    ORDER BY version DESC, created_at DESC, id DESC
    OFFSET 2000
  );
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS encounter_events_trim ON public.encounter_events;
CREATE TRIGGER encounter_events_trim
  AFTER INSERT ON public.encounter_events
  FOR EACH ROW EXECUTE FUNCTION public.trim_encounter_events();
