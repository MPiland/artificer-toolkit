CREATE TABLE IF NOT EXISTS public.encounter_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users (id)
    ON DELETE RESTRICT,
  game_system_id uuid NOT NULL REFERENCES public.systems (id)
    ON DELETE RESTRICT,
  command_id uuid NOT NULL,
  command_fingerprint text NOT NULL,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  setup_checksum text NOT NULL CHECK (setup_checksum ~ '^[a-f0-9]{64}$'),
  enemies jsonb NOT NULL CHECK (
    jsonb_typeof(enemies) = 'array'
    AND jsonb_array_length(enemies) > 0
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, command_id),
  UNIQUE (id, game_system_id),
  UNIQUE (id, owner_user_id)
);
CREATE INDEX IF NOT EXISTS encounter_blueprints_owner_idx ON public.encounter_blueprints (
  owner_user_id,
  game_system_id,
  updated_at DESC
);
ALTER TABLE public.encounter_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_blueprints FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_blueprints FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.encounter_blueprint_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL,
  blueprint_version INTEGER NOT NULL CHECK (blueprint_version > 0),
  owner_user_id uuid NOT NULL REFERENCES auth.users (id)
    ON DELETE RESTRICT,
  command_id uuid NOT NULL,
  command_type text NOT NULL CHECK (command_type = 'UPDATE'),
  command_fingerprint text NOT NULL,
  result_payload jsonb NOT NULL CHECK (jsonb_typeof(result_payload) = 'object'),
  actor_user_id uuid NOT NULL REFERENCES auth.users (id)
    ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, command_id),
  UNIQUE (blueprint_id, blueprint_version),
  FOREIGN KEY (
    blueprint_id,
    owner_user_id
  ) REFERENCES public.encounter_blueprints (id, owner_user_id)
    ON DELETE CASCADE
);
ALTER TABLE public.encounter_blueprint_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_blueprint_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_blueprint_events FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id)
    ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.campaign_sessions (id)
    ON DELETE CASCADE,
  game_system_id uuid NOT NULL,
  blueprint_id uuid NOT NULL,
  blueprint_version INTEGER NOT NULL CHECK (blueprint_version > 0),
  blueprint_checksum text NOT NULL CHECK (
    blueprint_checksum ~ '^[a-f0-9]{64}$'
  ),
  rule_pack_revision_id uuid REFERENCES public.rule_pack_revisions (id)
    ON DELETE RESTRICT,
  initiative_policy_snapshot jsonb,
  initiative_policy_snapshot_checksum text,
  optional_combat_snapshot jsonb,
  optional_combat_snapshot_checksum text,
  automation_mode text NOT NULL DEFAULT 'ASSISTED' CHECK (
    automation_mode IN ('AUTOMATIC', 'ASSISTED', 'MANUAL')
  ),
  manual_reminder_mode text NOT NULL DEFAULT 'OFF' CHECK (
    manual_reminder_mode IN ('OFF', 'SUBTLE')
  ),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  status text NOT NULL DEFAULT 'PREPARED' CHECK (
    status IN ('PREPARED', 'ACTIVE', 'COMPLETED')
  ),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  round INTEGER NOT NULL DEFAULT 0 CHECK (round >= 0),
  current_actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, campaign_id),
  CHECK (
    (
      initiative_policy_snapshot IS NULL
      AND initiative_policy_snapshot_checksum IS NULL
    )
    OR (
      jsonb_typeof(initiative_policy_snapshot) = 'object'
      AND initiative_policy_snapshot_checksum ~ '^[a-f0-9]{64}$'
    )
  ),
  CHECK (
    (
      optional_combat_snapshot IS NULL
      AND optional_combat_snapshot_checksum IS NULL
    )
    OR (
      optional_combat_snapshot IS NOT NULL
      AND optional_combat_snapshot_checksum IS NOT NULL
      AND jsonb_typeof(optional_combat_snapshot) = 'object'
      AND optional_combat_snapshot_checksum ~ '^[a-f0-9]{64}$'
    )
  )
);
ALTER TABLE public.encounters
ADD CONSTRAINT encounters_campaign_system_fk
  FOREIGN KEY (campaign_id, game_system_id) REFERENCES public.campaigns (
    id,
    game_system_id
  )
    ON DELETE CASCADE;
ALTER TABLE public.encounters
ADD CONSTRAINT encounters_blueprint_system_fk
  FOREIGN KEY (
    blueprint_id,
    game_system_id
  ) REFERENCES public.encounter_blueprints (id, game_system_id)
    ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS encounters_one_active_per_campaign_idx ON public.encounters (
  campaign_id
)
WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS encounters_campaign_idx ON public.encounters (
  campaign_id,
  status,
  updated_at DESC
);
CREATE INDEX IF NOT EXISTS encounters_session_idx ON public.encounters (
  session_id,
  status,
  updated_at DESC
);
ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounters FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.encounter_sides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters (id)
    ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 160),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, encounter_id),
  UNIQUE (encounter_id, sort_order)
);
CREATE INDEX IF NOT EXISTS encounter_sides_order_idx ON public.encounter_sides (
  encounter_id,
  sort_order,
  id
);
ALTER TABLE public.encounter_sides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_sides FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_sides FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.encounter_side_relationships (
  encounter_id uuid NOT NULL REFERENCES public.encounters (id)
    ON DELETE CASCADE,
  first_side_id uuid NOT NULL,
  second_side_id uuid NOT NULL,
  relationship_kind text NOT NULL CHECK (
    relationship_kind IN ('ALLIED', 'NEUTRAL', 'HOSTILE')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (encounter_id, first_side_id, second_side_id),
  FOREIGN KEY (first_side_id, encounter_id) REFERENCES public.encounter_sides (
    id,
    encounter_id
  )
    ON DELETE CASCADE,
  FOREIGN KEY (second_side_id, encounter_id) REFERENCES public.encounter_sides (
    id,
    encounter_id
  )
    ON DELETE CASCADE,
  CHECK (first_side_id::text < second_side_id::text)
);
ALTER TABLE public.encounter_side_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_side_relationships FORCE ROW LEVEL SECURITY;
REVOKE ALL
ON TABLE public.encounter_side_relationships
FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.encounter_actors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters (id)
    ON DELETE CASCADE,
  side_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('CHARACTER', 'CREATURE', 'CUSTOM')),
  source_id uuid,
  source_revision INTEGER CHECK (
    source_revision IS NULL
    OR source_revision > 0
  ),
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 160),
  system_id uuid,
  stable_tie_key text NOT NULL,
  public BOOLEAN NOT NULL DEFAULT TRUE,
  current_hit_points INTEGER NOT NULL DEFAULT 0 CHECK (current_hit_points >= 0),
  max_hit_points INTEGER NOT NULL DEFAULT 0 CHECK (max_hit_points >= 0),
  temp_hit_points INTEGER NOT NULL DEFAULT 0 CHECK (temp_hit_points >= 0),
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_typeof(conditions) = 'array'
  ),
  resources jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(resources) = 'object'
  ),
  gm_notes text CHECK (gm_notes IS NULL OR char_length(gm_notes) <= 4000),
  initiative INTEGER,
  manual_order INTEGER CHECK (manual_order IS NULL OR manual_order >= 0),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (encounter_id, stable_tie_key),
  UNIQUE (id, encounter_id),
  FOREIGN KEY (side_id, encounter_id) REFERENCES public.encounter_sides (
    id,
    encounter_id
  )
    ON DELETE RESTRICT,
  CHECK (
    (kind = 'CUSTOM' AND source_id IS NULL)
    OR (kind IN ('CHARACTER', 'CREATURE') AND source_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS encounter_actors_order_idx ON public.encounter_actors (
  encounter_id,
  manual_order,
  initiative DESC,
  stable_tie_key
);
ALTER TABLE public.encounter_actors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_actors FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.assert_encounter_actor_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM 1
  FROM public.encounters encounter
  WHERE encounter.id = NEW.encounter_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Encounter does not exist.' USING ERRCODE = '23503';
  END IF;

  IF (
    SELECT count(*)
    FROM public.encounter_actors actor
    WHERE actor.encounter_id = NEW.encounter_id
  ) >= 100 THEN
    RAISE EXCEPTION 'Encounters support at most 100 actors.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS encounter_actors_capacity_before_insert ON public.encounter_actors;
CREATE TRIGGER encounter_actors_capacity_before_insert
BEFORE INSERT ON public.encounter_actors
FOR EACH ROW
EXECUTE FUNCTION public.assert_encounter_actor_capacity();

ALTER TABLE public.encounters
DROP CONSTRAINT IF EXISTS encounters_current_actor_fk;
ALTER TABLE public.encounters
ADD CONSTRAINT encounters_current_actor_fk
  FOREIGN KEY (current_actor_id) REFERENCES public.encounter_actors (id)
    ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.assert_encounter_current_actor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
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
FOR EACH ROW
EXECUTE FUNCTION public.assert_encounter_current_actor();

CREATE TABLE IF NOT EXISTS public.encounter_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters (id)
    ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 160),
  timing text NOT NULL CHECK (
    timing IN (
      'ROUND_START',
      'ROUND_END',
      'ROUND_NUMBER',
      'TURN_START',
      'TURN_END'
    )
  ),
  round INTEGER CHECK (round IS NULL OR round > 0),
  actor_id uuid REFERENCES public.encounter_actors (id)
    ON DELETE CASCADE,
  public BOOLEAN NOT NULL DEFAULT FALSE,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 4000),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  CHECK ((timing = 'ROUND_NUMBER') = (round IS NOT NULL)),
  CHECK ((timing IN ('TURN_START', 'TURN_END')) = (actor_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS encounter_reminders_encounter_idx ON public.encounter_reminders (
  encounter_id,
  sort_order,
  id
);
ALTER TABLE public.encounter_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_reminders FROM anon, authenticated;

-- Generic System-maintained state. A row is active while it exists; its
-- descriptor is immutable and never exposes source labels to clients.
CREATE TABLE IF NOT EXISTS public.encounter_maintained_effect_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters (id)
    ON DELETE CASCADE,
  owner_actor_id uuid NOT NULL,
  maintenance_definition_id uuid NOT NULL,
  descriptor jsonb NOT NULL CHECK (jsonb_typeof(descriptor) = 'object'),
  descriptor_checksum text NOT NULL CHECK (
    descriptor_checksum ~ '^[a-f0-9]{64}$'
  ),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, encounter_id),
  UNIQUE (encounter_id, owner_actor_id, maintenance_definition_id),
  FOREIGN KEY (
    owner_actor_id,
    encounter_id
  ) REFERENCES public.encounter_actors (id, encounter_id)
    ON DELETE CASCADE,
  CHECK (descriptor ->> 'sourceActorId' = owner_actor_id::text),
  CHECK (
    descriptor ->> 'maintenanceDefinitionId' = maintenance_definition_id::text
  )
);
CREATE INDEX IF NOT EXISTS encounter_maintained_effect_states_owner_idx ON public.encounter_maintained_effect_states (
  encounter_id,
  owner_actor_id,
  maintenance_definition_id,
  id
);
ALTER TABLE public.encounter_maintained_effect_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_maintained_effect_states FORCE ROW LEVEL SECURITY;
REVOKE ALL
ON TABLE public.encounter_maintained_effect_states
FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.encounter_active_rule_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters (id)
    ON DELETE CASCADE,
  target_actor_id uuid NOT NULL,
  maintained_effect_state_id uuid,
  created_ordinal INTEGER NOT NULL CHECK (created_ordinal > 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  definition_checksum text NOT NULL CHECK (
    definition_checksum ~ '^[a-f0-9]{64}$'
  ),
  lifecycle jsonb NOT NULL CHECK (jsonb_typeof(lifecycle) = 'object'),
  lifecycle_checksum text NOT NULL CHECK (
    lifecycle_checksum ~ '^[a-f0-9]{64}$'
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, encounter_id),
  UNIQUE (encounter_id, target_actor_id, created_ordinal),
  FOREIGN KEY (
    target_actor_id,
    encounter_id
  ) REFERENCES public.encounter_actors (id, encounter_id)
    ON DELETE CASCADE,
  FOREIGN KEY (
    maintained_effect_state_id,
    encounter_id
  ) REFERENCES public.encounter_maintained_effect_states (id, encounter_id)
    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS encounter_active_rule_effects_owner_idx ON public.encounter_active_rule_effects (
  encounter_id,
  target_actor_id,
  created_ordinal,
  id
);
ALTER TABLE public.encounter_active_rule_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_active_rule_effects FORCE ROW LEVEL SECURITY;
REVOKE ALL
ON TABLE public.encounter_active_rule_effects
FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.encounter_rule_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  root_command_id uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('PENDING', 'COMPLETED')),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  expected_encounter_version INTEGER NOT NULL CHECK (
    expected_encounter_version >= 0
  ),
  pending_snapshot jsonb,
  pending_snapshot_checksum text CHECK (
    pending_snapshot_checksum ~ '^[0-9a-f]{64}$'
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (encounter_id, root_command_id),
  UNIQUE (id, encounter_id),
  FOREIGN KEY (encounter_id, campaign_id) REFERENCES public.encounters (
    id,
    campaign_id
  )
    ON DELETE CASCADE,
  CHECK (
    (
      state = 'PENDING'
      AND pending_snapshot IS NOT NULL
      AND pending_snapshot_checksum IS NOT NULL
      AND completed_at IS NULL
    )
    OR (
      state = 'COMPLETED'
      AND pending_snapshot IS NULL
      AND pending_snapshot_checksum IS NULL
      AND completed_at IS NOT NULL
    )
  ),
  CHECK (
    pending_snapshot IS NULL
    OR pending_snapshot ->> 'occurrenceId' = id::text
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS encounter_rule_occurrences_one_pending_idx ON public.encounter_rule_occurrences (
  encounter_id
)
WHERE state = 'PENDING';
CREATE INDEX IF NOT EXISTS encounter_rule_occurrences_pending_idx ON public.encounter_rule_occurrences (
  encounter_id,
  updated_at DESC
)
WHERE state = 'PENDING';
ALTER TABLE public.encounter_rule_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_rule_occurrences FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_rule_occurrences FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.encounter_initiative_rounds (
  encounter_id uuid NOT NULL REFERENCES public.encounters (id)
    ON DELETE CASCADE,
  round INTEGER NOT NULL CHECK (round > 0),
  procedure text NOT NULL CHECK (
    procedure IN (
      'ACTOR_ROLL',
      'ACTOR_SCORE',
      'SIDE_ROLL',
      'DECLARED_ACTION_ROLL',
      'MANUAL'
    )
  ),
  cadence text NOT NULL CHECK (cadence IN ('ENCOUNTER_START', 'EACH_ROUND')),
  status text NOT NULL CHECK (status IN ('PREPARING', 'ACTIVE', 'COMPLETED')),
  policy_snapshot_checksum text,
  next_turn_order_ordinal INTEGER NOT NULL DEFAULT 0 CHECK (
    next_turn_order_ordinal >= 0
  ),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (encounter_id, round),
  UNIQUE (encounter_id, round, procedure),
  CHECK (
    (procedure = 'MANUAL' AND policy_snapshot_checksum IS NULL)
    OR (procedure != 'MANUAL' AND policy_snapshot_checksum ~ '^[a-f0-9]{64}$')
  )
);
ALTER TABLE public.encounter_initiative_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_initiative_rounds FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_initiative_rounds FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.encounter_initiative_participants (
  encounter_id uuid NOT NULL,
  round INTEGER NOT NULL,
  actor_id uuid NOT NULL,
  side_id uuid NOT NULL,
  status text NOT NULL CHECK (
    status IN ('UNRESOLVED', 'PENDING', 'EVALUATED', 'READY', 'ACTIVE', 'ACTED')
  ),
  initiative_score DOUBLE PRECISION CHECK (
    initiative_score IS NULL
    OR initiative_score NOT IN (
      'NaN'::DOUBLE PRECISION,
      'Infinity'::DOUBLE PRECISION,
      '-Infinity'::DOUBLE PRECISION
    )
  ),
  evaluation_occurrence_id uuid,
  evaluation_result_checksum text,
  tie_occurrence_id uuid,
  tie_result_checksum text,
  declaration jsonb,
  declaration_checksum text,
  turn_order_ordinal INTEGER,
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (encounter_id, round, actor_id),
  FOREIGN KEY (
    encounter_id,
    round
  ) REFERENCES public.encounter_initiative_rounds (encounter_id, round)
    ON DELETE CASCADE,
  FOREIGN KEY (actor_id, encounter_id) REFERENCES public.encounter_actors (
    id,
    encounter_id
  )
    ON DELETE CASCADE,
  FOREIGN KEY (side_id, encounter_id) REFERENCES public.encounter_sides (
    id,
    encounter_id
  )
    ON DELETE CASCADE,
  FOREIGN KEY (
    evaluation_occurrence_id,
    encounter_id
  ) REFERENCES public.encounter_rule_occurrences (id, encounter_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (
    tie_occurrence_id,
    encounter_id
  ) REFERENCES public.encounter_rule_occurrences (id, encounter_id)
    ON DELETE RESTRICT,
  CHECK (
    (evaluation_occurrence_id IS NULL) = (evaluation_result_checksum IS NULL)
  ),
  CHECK (
    evaluation_result_checksum IS NULL
    OR evaluation_result_checksum ~ '^[a-f0-9]{64}$'
  ),
  CHECK ((tie_occurrence_id IS NULL) = (tie_result_checksum IS NULL)),
  CHECK (tie_result_checksum IS NULL OR tie_result_checksum ~ '^[a-f0-9]{64}$'),
  CHECK ((declaration IS NULL) = (declaration_checksum IS NULL)),
  CHECK (
    declaration_checksum IS NULL
    OR declaration_checksum ~ '^[a-f0-9]{64}$'
  ),
  CHECK (
    (
      status IN ('READY', 'ACTIVE', 'ACTED')
      AND turn_order_ordinal IS NOT NULL
      AND turn_order_ordinal >= 0
    )
    OR (
      status NOT IN ('READY', 'ACTIVE', 'ACTED')
      AND turn_order_ordinal IS NULL
    )
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS encounter_initiative_participants_turn_order_idx ON public.encounter_initiative_participants (
  encounter_id,
  round,
  turn_order_ordinal
)
WHERE turn_order_ordinal IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS encounter_initiative_participants_one_active_idx ON public.encounter_initiative_participants (
  encounter_id,
  round
)
WHERE status = 'ACTIVE';
ALTER TABLE public.encounter_initiative_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_initiative_participants FORCE ROW LEVEL SECURITY;
REVOKE ALL
ON TABLE public.encounter_initiative_participants
FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.encounter_initiative_sides (
  encounter_id uuid NOT NULL,
  round INTEGER NOT NULL,
  procedure text NOT NULL DEFAULT 'SIDE_ROLL' CHECK (procedure = 'SIDE_ROLL'),
  side_id uuid NOT NULL,
  status text NOT NULL CHECK (
    status IN (
      'UNRESOLVED',
      'PENDING',
      'EVALUATED',
      'READY',
      'ACTIVE',
      'COMPLETED'
    )
  ),
  initiative_score DOUBLE PRECISION CHECK (
    initiative_score IS NULL
    OR initiative_score NOT IN (
      'NaN'::DOUBLE PRECISION,
      'Infinity'::DOUBLE PRECISION,
      '-Infinity'::DOUBLE PRECISION
    )
  ),
  evaluation_occurrence_id uuid,
  evaluation_result_checksum text,
  tie_occurrence_id uuid,
  tie_result_checksum text,
  side_order_ordinal INTEGER,
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (encounter_id, round, side_id),
  FOREIGN KEY (
    encounter_id,
    round,
    procedure
  ) REFERENCES public.encounter_initiative_rounds (
    encounter_id,
    round,
    procedure
  )
    ON DELETE CASCADE,
  FOREIGN KEY (side_id, encounter_id) REFERENCES public.encounter_sides (
    id,
    encounter_id
  )
    ON DELETE CASCADE,
  FOREIGN KEY (
    evaluation_occurrence_id,
    encounter_id
  ) REFERENCES public.encounter_rule_occurrences (id, encounter_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (
    tie_occurrence_id,
    encounter_id
  ) REFERENCES public.encounter_rule_occurrences (id, encounter_id)
    ON DELETE RESTRICT,
  CHECK (
    (evaluation_occurrence_id IS NULL) = (evaluation_result_checksum IS NULL)
  ),
  CHECK (
    evaluation_result_checksum IS NULL
    OR evaluation_result_checksum ~ '^[a-f0-9]{64}$'
  ),
  CHECK ((tie_occurrence_id IS NULL) = (tie_result_checksum IS NULL)),
  CHECK (tie_result_checksum IS NULL OR tie_result_checksum ~ '^[a-f0-9]{64}$'),
  CHECK (
    (
      status IN ('READY', 'ACTIVE', 'COMPLETED')
      AND side_order_ordinal IS NOT NULL
      AND side_order_ordinal >= 0
    )
    OR (
      status NOT IN ('READY', 'ACTIVE', 'COMPLETED')
      AND side_order_ordinal IS NULL
    )
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS encounter_initiative_sides_order_idx ON public.encounter_initiative_sides (
  encounter_id,
  round,
  side_order_ordinal
)
WHERE side_order_ordinal IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS encounter_initiative_sides_one_active_idx ON public.encounter_initiative_sides (
  encounter_id,
  round
)
WHERE status = 'ACTIVE';
ALTER TABLE public.encounter_initiative_sides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_initiative_sides FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_initiative_sides FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.encounter_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters (id)
    ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id)
    ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 0),
  command_id uuid NOT NULL,
  command_type text NOT NULL CHECK (
    char_length(btrim(command_type)) BETWEEN 1 AND 80
  ),
  command_fingerprint text NOT NULL,
  command_payload jsonb NOT NULL CHECK (
    jsonb_typeof(command_payload) = 'object'
  ),
  result_payload jsonb NOT NULL CHECK (jsonb_typeof(result_payload) = 'object'),
  actor_user_id uuid NOT NULL REFERENCES auth.users (id)
    ON DELETE RESTRICT,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (encounter_id, command_id),
  UNIQUE (encounter_id, version)
);
CREATE INDEX IF NOT EXISTS encounter_events_cursor_idx ON public.encounter_events (
  encounter_id,
  version DESC,
  created_at DESC
);
CREATE UNIQUE INDEX IF NOT EXISTS encounter_events_campaign_command_idx ON public.encounter_events (
  campaign_id,
  command_id
);
ALTER TABLE public.encounter_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_events FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.encounter_rule_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  occurrence_id uuid NOT NULL,
  command_id uuid NOT NULL,
  command_type text NOT NULL CHECK (
    char_length(btrim(command_type)) BETWEEN 1 AND 80
  ),
  command_fingerprint text NOT NULL CHECK (
    char_length(command_fingerprint) = 64
  ),
  encounter_version INTEGER NOT NULL CHECK (encounter_version >= 0),
  command_metadata jsonb NOT NULL CHECK (
    jsonb_typeof(command_metadata) = 'object'
  ),
  result_payload jsonb NOT NULL CHECK (jsonb_typeof(result_payload) = 'object'),
  actor_user_id uuid NOT NULL REFERENCES auth.users (id)
    ON DELETE RESTRICT,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (encounter_id, command_id),
  FOREIGN KEY (
    occurrence_id,
    encounter_id
  ) REFERENCES public.encounter_rule_occurrences (id, encounter_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (encounter_id, campaign_id) REFERENCES public.encounters (
    id,
    campaign_id
  )
    ON DELETE CASCADE
);
ALTER TABLE public.encounter_rule_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_rule_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_rule_receipts FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.campaign_scene_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id)
    ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, campaign_id)
);
CREATE INDEX IF NOT EXISTS campaign_scene_definitions_campaign_idx ON public.campaign_scene_definitions (
  campaign_id,
  updated_at DESC,
  id DESC
);
ALTER TABLE public.campaign_scene_definitions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campaign_scene_definitions FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.campaign_live_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  definition_id uuid,
  definition_version INTEGER NOT NULL CHECK (definition_version > 0),
  definition_snapshot jsonb NOT NULL CHECK (
    jsonb_typeof(definition_snapshot) = 'object'
  ),
  projection jsonb NOT NULL CHECK (jsonb_typeof(projection) = 'object'),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  projection_schema_version INTEGER NOT NULL CHECK (
    projection_schema_version > 0
  ),
  projection_checksum text NOT NULL CHECK (
    projection_checksum ~ '^[0-9a-f]{64}$'
  ),
  materialization_command_id uuid NOT NULL,
  materialization_command_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, campaign_id),
  FOREIGN KEY (
    definition_id,
    campaign_id
  ) REFERENCES public.campaign_scene_definitions (id, campaign_id)
    ON DELETE SET NULL (definition_id)
);
CREATE INDEX IF NOT EXISTS campaign_live_scenes_definition_idx ON public.campaign_live_scenes (
  definition_id,
  definition_version
);
ALTER TABLE public.campaign_live_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_live_scenes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campaign_live_scenes FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.campaign_session_scene_presentations (
  session_id uuid PRIMARY KEY REFERENCES public.campaign_sessions (id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  scene_id uuid REFERENCES public.campaign_live_scenes (id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  command_id uuid NOT NULL,
  command_fingerprint text NOT NULL CHECK (command_fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (session_id, campaign_id) REFERENCES public.campaign_sessions (id, campaign_id) ON DELETE CASCADE,
  FOREIGN KEY (scene_id, campaign_id) REFERENCES public.campaign_live_scenes (id, campaign_id) ON DELETE RESTRICT,
  UNIQUE (session_id, command_id)
);
ALTER TABLE public.campaign_session_scene_presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_session_scene_presentations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campaign_session_scene_presentations FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.encounter_scene_bindings (
  encounter_id uuid PRIMARY KEY REFERENCES public.encounters (id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  scene_id uuid NOT NULL REFERENCES public.campaign_live_scenes (id) ON DELETE RESTRICT,
  command_id uuid NOT NULL,
  command_fingerprint text NOT NULL CHECK (command_fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (encounter_id, campaign_id) REFERENCES public.encounters (id, campaign_id) ON DELETE CASCADE,
  FOREIGN KEY (scene_id, campaign_id) REFERENCES public.campaign_live_scenes (id, campaign_id) ON DELETE RESTRICT,
  UNIQUE (encounter_id, scene_id),
  UNIQUE (encounter_id, command_id)
);
ALTER TABLE public.encounter_scene_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_scene_bindings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_scene_bindings FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.encounter_scene_actor_token_bindings (
  encounter_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  scene_id uuid NOT NULL,
  token_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (encounter_id, actor_id),
  UNIQUE (encounter_id, token_id),
  FOREIGN KEY (encounter_id, scene_id) REFERENCES public.encounter_scene_bindings (encounter_id, scene_id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id, encounter_id) REFERENCES public.encounter_actors (id, encounter_id) ON DELETE CASCADE
);
ALTER TABLE public.encounter_scene_actor_token_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_scene_actor_token_bindings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_scene_actor_token_bindings FROM anon, authenticated;

-- Untargeted spatial roots belong to the Encounter/Scene, not to an actor.
-- Contact execution binds a target only in its aggregate-owned occurrence.
CREATE TABLE IF NOT EXISTS public.encounter_spatial_rule_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters (id)
    ON DELETE CASCADE,
  scene_id uuid NOT NULL,
  created_ordinal INTEGER NOT NULL CHECK (created_ordinal > 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  definition_checksum text NOT NULL CHECK (
    definition_checksum ~ '^[a-f0-9]{64}$'
  ),
  lifecycle jsonb NOT NULL CHECK (jsonb_typeof(lifecycle) = 'object'),
  lifecycle_checksum text NOT NULL CHECK (
    lifecycle_checksum ~ '^[a-f0-9]{64}$'
  ),
  placement jsonb NOT NULL CHECK (jsonb_typeof(placement) = 'object'),
  placement_checksum text NOT NULL CHECK (
    placement_checksum ~ '^[a-f0-9]{64}$'
  ),
  spatial_state jsonb NOT NULL CHECK (jsonb_typeof(spatial_state) = 'object'),
  spatial_state_checksum text NOT NULL CHECK (
    spatial_state_checksum ~ '^[a-f0-9]{64}$'
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, encounter_id),
  UNIQUE (encounter_id, scene_id, created_ordinal),
  FOREIGN KEY (encounter_id, scene_id) REFERENCES public.encounter_scene_bindings (
    encounter_id,
    scene_id
  )
    ON DELETE CASCADE,
  CHECK (
    (
      jsonb_typeof(definition -> 'schemaVersion') = 'number'
      AND jsonb_typeof(definition -> 'origin') = 'object'
      AND jsonb_typeof(definition -> 'recurrence') = 'object'
      AND definition ->> 'schemaVersion' = '1'
      AND definition #>> '{origin,kind}' = 'ENCOUNTER'
      AND definition #>> '{origin,sourceAggregateId}' = encounter_id::text
      AND definition #>> '{recurrence,lifetimeScope}' = 'ENCOUNTER'
      AND definition #>> '{recurrence,recurrenceStage}' = 'NONE'
    ) IS TRUE
  ),
  CHECK (
    (
      jsonb_typeof(lifecycle -> 'schemaVersion') = 'number'
      AND lifecycle ->> 'schemaVersion' = '1'
    ) IS TRUE
  ),
  CHECK (
    (
      jsonb_typeof(placement -> 'schemaVersion') = 'number'
      AND placement ->> 'schemaVersion' = '1'
    ) IS TRUE
  ),
  CHECK (
    (
      jsonb_typeof(spatial_state -> 'schemaVersion') = 'number'
      AND spatial_state ->> 'schemaVersion' = '1'
    ) IS TRUE
  ),
  CHECK (
    (
      jsonb_typeof(placement -> 'anchorKind') = 'string'
      AND jsonb_typeof(placement -> 'sourceTokenId') IN ('string', 'null')
      AND jsonb_typeof(placement -> 'geometry') = 'object'
      AND jsonb_typeof(placement #> '{geometry,frame}') = 'string'
      AND (
        (
          placement ->> 'anchorKind' = 'FIXED'
          AND placement ->> 'sourceTokenId' IS NULL
          AND placement #>> '{geometry,frame}' = 'SCENE_ABSOLUTE'
        )
        OR (
          placement ->> 'anchorKind' = 'TOKEN'
          AND placement ->> 'sourceTokenId' IS NOT NULL
          AND placement #>> '{geometry,frame}' = 'TOKEN_LOCAL'
        )
      )
    ) IS TRUE
  ),
  CHECK (
    (
      jsonb_typeof(placement -> 'visibility') = 'string'
      AND jsonb_typeof(placement -> 'revealOnTrigger') = 'boolean'
      AND jsonb_typeof(spatial_state -> 'revealed') = 'boolean'
      AND (
        placement ->> 'visibility' != 'PUBLIC'
        OR (
          placement ->> 'revealOnTrigger' = 'false'
          AND spatial_state ->> 'revealed' = 'true'
        )
      )
    ) IS TRUE
  )
);
CREATE INDEX IF NOT EXISTS encounter_spatial_rule_effects_scene_idx ON public.encounter_spatial_rule_effects (
  encounter_id,
  scene_id,
  created_ordinal,
  id
);
ALTER TABLE public.encounter_spatial_rule_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_spatial_rule_effects FORCE ROW LEVEL SECURITY;
REVOKE ALL
ON TABLE public.encounter_spatial_rule_effects
FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.campaign_scene_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  encounter_id uuid,
  version INTEGER NOT NULL CHECK (version > 0),
  command_id uuid NOT NULL,
  command_type text NOT NULL CHECK (
    char_length(btrim(command_type)) BETWEEN 1 AND 80
  ),
  command_fingerprint text NOT NULL,
  delta jsonb NOT NULL CHECK (jsonb_typeof(delta) = 'object'),
  actor_user_id uuid NOT NULL REFERENCES auth.users (id)
    ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scene_id, command_id),
  UNIQUE (scene_id, version),
  FOREIGN KEY (scene_id, campaign_id) REFERENCES public.campaign_live_scenes (id, campaign_id) ON DELETE CASCADE,
  FOREIGN KEY (encounter_id, scene_id) REFERENCES public.encounter_scene_bindings (encounter_id, scene_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS campaign_scene_events_replay_idx ON public.campaign_scene_events (
  scene_id,
  version ASC
);
ALTER TABLE public.campaign_scene_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_scene_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campaign_scene_events FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.encounter_current_projections (
  encounter_id uuid PRIMARY KEY REFERENCES public.encounters (id)
    ON DELETE CASCADE,
  stream_version INTEGER NOT NULL CHECK (stream_version >= 0),
  projection_schema_version INTEGER NOT NULL CHECK (
    projection_schema_version > 0
  ),
  projection_checksum text NOT NULL CHECK (
    projection_checksum ~ '^[0-9a-f]{64}$'
  ),
  projection jsonb NOT NULL CHECK (jsonb_typeof(projection) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.encounter_current_projections ENABLE ROW LEVEL SECURITY;
REVOKE ALL
ON TABLE public.encounter_current_projections
FROM anon, authenticated;

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
BEFORE INSERT
OR UPDATE OF campaign_id, definition
ON public.campaign_scene_definitions
FOR EACH ROW
EXECUTE FUNCTION public.validate_vtt_scene_map_asset();

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
    SELECT 1 FROM public.campaign_live_scenes scene
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
FOR EACH ROW
EXECUTE FUNCTION public.protect_referenced_vtt_map_asset();
DROP TRIGGER IF EXISTS media_assets_protect_referenced_vtt_map_delete_trigger ON public.media_assets;
CREATE TRIGGER media_assets_protect_referenced_vtt_map_delete_trigger
BEFORE DELETE ON public.media_assets
FOR EACH ROW
EXECUTE FUNCTION public.protect_referenced_vtt_map_asset();

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
      AND NOT EXISTS (SELECT 1 FROM public.campaign_live_scenes scene WHERE scene.definition_snapshot #>> '{map,assetId}' = asset.id::text OR scene.projection #>> '{map,assetId}' = asset.id::text);
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
DROP TRIGGER IF EXISTS campaign_scene_definitions_sync_vtt_map_reference_trigger ON public.campaign_scene_definitions;
CREATE TRIGGER campaign_scene_definitions_sync_vtt_map_reference_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.campaign_scene_definitions
FOR EACH ROW
EXECUTE FUNCTION public.sync_vtt_scene_map_reference();

CREATE OR REPLACE FUNCTION public.sync_campaign_live_scene_map_reference()
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
  IF new_asset_id IS NOT NULL AND (TG_OP = 'INSERT' OR old_asset_id IS DISTINCT FROM new_asset_id) THEN
    UPDATE public.media_assets SET unreferenced_at = NULL WHERE id = new_asset_id;
  END IF;
  IF old_asset_id IS NOT NULL AND old_asset_id IS DISTINCT FROM new_asset_id THEN
    UPDATE public.media_assets asset SET unreferenced_at = coalesce(unreferenced_at, now())
    WHERE asset.id = old_asset_id
      AND NOT EXISTS (SELECT 1 FROM public.campaign_scene_definitions definition WHERE definition.definition #>> '{map,assetId}' = asset.id::text)
      AND NOT EXISTS (SELECT 1 FROM public.campaign_live_scenes scene WHERE scene.definition_snapshot #>> '{map,assetId}' = asset.id::text OR scene.projection #>> '{map,assetId}' = asset.id::text);
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
DROP TRIGGER IF EXISTS campaign_live_scenes_sync_vtt_map_reference_trigger ON public.campaign_live_scenes;
CREATE TRIGGER campaign_live_scenes_sync_vtt_map_reference_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.campaign_live_scenes
FOR EACH ROW
EXECUTE FUNCTION public.sync_campaign_live_scene_map_reference();
