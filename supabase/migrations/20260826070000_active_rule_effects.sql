-- Aggregate-owned current active-rule-effect state. Source occurrence provenance is
-- an immutable JSON snapshot, deliberately not a cross-aggregate foreign key.

ALTER TABLE public.encounter_actors
ADD CONSTRAINT encounter_actors_id_encounter_unique UNIQUE (id, encounter_id);

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
  FOREIGN KEY (scene_id, encounter_id) REFERENCES public.encounter_scenes (
    id,
    encounter_id
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

ALTER TABLE public.character_active_rule_effects
ADD CONSTRAINT character_active_rule_effects_maintained_state_encounter_fkey
  FOREIGN KEY (
    maintained_effect_state_id,
    source_encounter_id
  ) REFERENCES public.encounter_maintained_effect_states (id, encounter_id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED;
