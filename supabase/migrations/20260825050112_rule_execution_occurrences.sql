-- Aggregate-owned rule execution occurrences and immutable per-command receipts.
-- The canonical bootstrap SQL is the source for fresh databases; this migration
-- upgrades the deployed public schema without replaying executable snapshots.

ALTER TABLE public.character_events
ADD COLUMN IF NOT EXISTS command_fingerprint text,
ADD COLUMN IF NOT EXISTS stream_version INTEGER,
ADD COLUMN IF NOT EXISTS result_payload jsonb,
ADD COLUMN IF NOT EXISTS correlation_id uuid;

ALTER TABLE public.character_events
DROP CONSTRAINT IF EXISTS character_events_stream_version_nonnegative;
ALTER TABLE public.character_events
ADD CONSTRAINT character_events_stream_version_nonnegative
  CHECK (stream_version IS NULL OR stream_version >= 0);
ALTER TABLE public.character_events
DROP CONSTRAINT IF EXISTS character_events_result_payload_object;
ALTER TABLE public.character_events
ADD CONSTRAINT character_events_result_payload_object
  CHECK (result_payload IS NULL OR jsonb_typeof(result_payload) = 'object');
REVOKE ALL ON TABLE public.character_events FROM anon, authenticated;
ALTER TABLE public.character_events FORCE ROW LEVEL SECURITY;

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

ALTER TABLE public.character_events
DROP CONSTRAINT IF EXISTS character_events_rule_occurrence_character_fk,
DROP CONSTRAINT IF EXISTS character_events_rule_receipt_complete,
DROP COLUMN IF EXISTS rule_occurrence_id;

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

ALTER TABLE public.encounter_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_events
DROP CONSTRAINT IF EXISTS encounter_events_rule_occurrence_encounter_fk,
DROP COLUMN IF EXISTS rule_occurrence_id;

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
