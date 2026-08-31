/* ──────────────────────────────────────────────
 * CHARACTER_EVENTS
 *
 * Immutable event log for character lifecycle.
 * Events are append-only — never updated or deleted except via cascade.
 * ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.character_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id)
    ON DELETE CASCADE
    DEFERRABLE,
  event_type text NOT NULL,
  event_data jsonb NOT NULL,
  schema_version INT NOT NULL DEFAULT 1,
  actor_id uuid NOT NULL,
  command_id uuid NOT NULL,
  command_fingerprint text,
  stream_version INTEGER CHECK (stream_version IS NULL OR stream_version >= 0),
  result_payload jsonb CHECK (
    result_payload IS NULL
    OR jsonb_typeof(result_payload) = 'object'
  ),
  correlation_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_events_character_command_uniq
    UNIQUE (character_id, command_id)
);

ALTER TABLE public.character_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.character_events FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_character_events_character_id ON public.character_events (
  character_id,
  occurred_at
);

CREATE UNIQUE INDEX IF NOT EXISTS character_events_character_stream_version_uniq ON public.character_events (
  character_id,
  stream_version
)
WHERE stream_version IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.character_rule_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id)
    ON DELETE CASCADE,
  root_command_id uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('PENDING', 'COMPLETED')),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  expected_stream_version INTEGER NOT NULL CHECK (expected_stream_version >= 0),
  pending_snapshot jsonb,
  pending_snapshot_checksum text CHECK (
    pending_snapshot_checksum ~ '^[0-9a-f]{64}$'
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (character_id, root_command_id),
  UNIQUE (id, character_id),
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
CREATE INDEX IF NOT EXISTS character_rule_occurrences_pending_idx ON public.character_rule_occurrences (
  character_id,
  updated_at DESC
)
WHERE state = 'PENDING';
ALTER TABLE public.character_rule_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_rule_occurrences FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.character_rule_occurrences FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.character_rule_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id)
    ON DELETE CASCADE,
  occurrence_id uuid NOT NULL,
  command_id uuid NOT NULL,
  command_type text NOT NULL CHECK (
    char_length(btrim(command_type)) BETWEEN 1 AND 80
  ),
  command_fingerprint text NOT NULL CHECK (
    char_length(command_fingerprint) = 64
  ),
  stream_version INTEGER NOT NULL CHECK (stream_version >= 0),
  command_metadata jsonb NOT NULL CHECK (
    jsonb_typeof(command_metadata) = 'object'
  ),
  result_payload jsonb NOT NULL CHECK (jsonb_typeof(result_payload) = 'object'),
  actor_user_id uuid NOT NULL REFERENCES auth.users (id)
    ON DELETE RESTRICT,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (character_id, command_id),
  FOREIGN KEY (
    occurrence_id,
    character_id
  ) REFERENCES public.character_rule_occurrences (id, character_id)
    ON DELETE RESTRICT
);
ALTER TABLE public.character_rule_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_rule_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.character_rule_receipts FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.character_active_rule_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id)
    ON DELETE CASCADE,
  source_encounter_id uuid,
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
  UNIQUE (character_id, created_ordinal),
  CHECK (
    (
      source_encounter_id IS NULL
      AND definition #>> '{recurrence,lifetimeScope}' = 'OWNER'
    )
    OR (
      source_encounter_id IS NOT NULL
      AND definition #>> '{recurrence,lifetimeScope}' = 'ENCOUNTER'
      AND definition #>> '{origin,kind}' = 'ENCOUNTER'
      AND definition #>> '{origin,sourceAggregateId}' = source_encounter_id::text
    )
  ),
  CHECK (maintained_effect_state_id IS NULL OR source_encounter_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS character_active_rule_effects_owner_idx ON public.character_active_rule_effects (
  character_id,
  created_ordinal,
  id
);
CREATE INDEX IF NOT EXISTS character_active_rule_effects_source_encounter_idx ON public.character_active_rule_effects (
  source_encounter_id,
  character_id,
  created_ordinal,
  id
)
WHERE source_encounter_id IS NOT NULL;
ALTER TABLE public.character_active_rule_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_active_rule_effects FORCE ROW LEVEL SECURITY;
REVOKE ALL
ON TABLE public.character_active_rule_effects
FROM anon, authenticated;
