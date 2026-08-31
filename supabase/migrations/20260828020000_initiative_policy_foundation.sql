ALTER TABLE public.campaign_play_settings
ADD COLUMN IF NOT EXISTS initiative_policy_definition_id uuid,
ADD COLUMN IF NOT EXISTS initiative_tie_definition_id uuid,
ADD COLUMN IF NOT EXISTS optional_combat_rule_definition_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

ALTER TABLE public.campaign_play_settings
DROP CONSTRAINT IF EXISTS campaign_play_settings_optional_combat_rule_definition_ids_check,
ADD CONSTRAINT campaign_play_settings_optional_combat_rule_definition_ids_check
  CHECK (cardinality(optional_combat_rule_definition_ids) <= 14);

ALTER TABLE public.campaign_play_settings
DROP CONSTRAINT IF EXISTS campaign_play_settings_initiative_tie_policy_check,
ADD CONSTRAINT campaign_play_settings_initiative_tie_policy_check
  CHECK (
    initiative_tie_definition_id IS NULL
    OR initiative_policy_definition_id IS NOT NULL
  );

ALTER TABLE public.campaign_play_settings
DROP CONSTRAINT IF EXISTS campaign_play_settings_initiative_policy_definition_fk,
ADD CONSTRAINT campaign_play_settings_initiative_policy_definition_fk
  FOREIGN KEY (
    initiative_policy_definition_id
  ) REFERENCES public.reusable_definitions (id)
    ON DELETE RESTRICT,
DROP CONSTRAINT IF EXISTS campaign_play_settings_initiative_tie_definition_fk,
ADD CONSTRAINT campaign_play_settings_initiative_tie_definition_fk
  FOREIGN KEY (
    initiative_tie_definition_id
  ) REFERENCES public.reusable_definitions (id)
    ON DELETE RESTRICT;

ALTER TABLE public.encounters
ADD COLUMN IF NOT EXISTS initiative_policy_snapshot jsonb,
ADD COLUMN IF NOT EXISTS initiative_policy_snapshot_checksum text,
ADD COLUMN IF NOT EXISTS optional_combat_snapshot jsonb,
ADD COLUMN IF NOT EXISTS optional_combat_snapshot_checksum text;

ALTER TABLE public.encounters
DROP CONSTRAINT IF EXISTS encounters_initiative_policy_snapshot_check,
ADD CONSTRAINT encounters_initiative_policy_snapshot_check
  CHECK (
    (
      initiative_policy_snapshot IS NULL
      AND initiative_policy_snapshot_checksum IS NULL
    )
    OR (
      jsonb_typeof(initiative_policy_snapshot) = 'object'
      AND initiative_policy_snapshot_checksum ~ '^[a-f0-9]{64}$'
    )
  );

ALTER TABLE public.encounters
DROP CONSTRAINT IF EXISTS encounters_optional_combat_snapshot_check,
ADD CONSTRAINT encounters_optional_combat_snapshot_check
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
  );

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
