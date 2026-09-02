-- Gate 1: reusable creator-owned setup snapshots for Encounter Runs.
ALTER TABLE public.encounter_templates RENAME TO encounter_blueprints;
ALTER TABLE public.encounter_blueprints ADD COLUMN owner_user_id uuid;
ALTER TABLE public.encounter_blueprints ADD COLUMN game_system_id uuid;
ALTER TABLE public.encounter_blueprints ADD COLUMN setup_checksum text;

UPDATE public.encounter_blueprints AS blueprint
SET
  owner_user_id = campaign.owner_user_id,
  game_system_id = campaign.game_system_id
FROM public.campaigns AS campaign
WHERE campaign.id = blueprint.campaign_id;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.encounter_blueprints WHERE owner_user_id IS NULL OR game_system_id IS NULL) THEN
    RAISE EXCEPTION 'Encounter Blueprint ownership/System backfill is incomplete.';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.encounter_blueprints blueprint
    CROSS JOIN LATERAL jsonb_array_elements(blueprint.enemies) AS enemy(value)
    WHERE enemy.value->>'kind' <> 'CUSTOM'
      AND COALESCE(enemy.value->>'systemId', enemy.value->'snapshot'->>'systemId') IS NOT NULL
      AND COALESCE(enemy.value->>'systemId', enemy.value->'snapshot'->>'systemId') <> blueprint.game_system_id::text
  ) THEN
    RAISE EXCEPTION 'Legacy Encounter Blueprint enemy System conflicts with its owning Campaign System.';
  END IF;
END $$;

UPDATE public.encounter_blueprints AS blueprint
SET enemies = (
  SELECT
    jsonb_agg(
      CASE
        WHEN enemy.value ->> 'kind' = 'CUSTOM' THEN jsonb_set(
          jsonb_set(
            enemy.value,
            '{systemId}',
            to_jsonb(blueprint.game_system_id::text),
            TRUE
          ),
          '{snapshot,systemId}',
          to_jsonb(blueprint.game_system_id::text),
          TRUE
        )
        ELSE enemy.value
      END
      ORDER BY enemy.ordinality
    ) AS enemies
  FROM
    jsonb_array_elements(blueprint.enemies) WITH ORDINALITY AS enemy (
      value,
      ordinality
    )
);

DO $$ BEGIN
  PERFORM set_config('extra_float_digits', '3', true);
  IF EXISTS (
    SELECT 1
    FROM public.encounter_blueprints blueprint
    CROSS JOIN LATERAL jsonb_path_query(
      blueprint.enemies,
      '$.** ? (@.type() == "number")'
    ) AS leaf(value)
    CROSS JOIN LATERAL (
      SELECT (leaf.value #>> '{}')::numeric AS value
    ) AS numeric_leaf
    WHERE CASE
      WHEN abs(numeric_leaf.value) >= 1000000000000000000000
        OR (abs(numeric_leaf.value) > 0 AND abs(numeric_leaf.value) < 0.000001)
      THEN true
      ELSE (((numeric_leaf.value::double precision)::text)::numeric <> numeric_leaf.value)
    END
  ) THEN
    RAISE EXCEPTION 'Legacy Encounter Blueprint numeric values cannot be canonically migrated without changing their ECMAScript JSON value.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.encounter_blueprint_canonical_json(
  value jsonb
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT
    CASE jsonb_typeof(value)
      WHEN 'object' THEN '{' || COALESCE(
        (
          SELECT
            string_agg(
              to_jsonb(
                entry.key
              )::text || ':' || public.encounter_blueprint_canonical_json(
                entry.value
              ),
              ','
              ORDER BY entry.key COLLATE "C"
            )
          FROM jsonb_each(value) AS entry (key, value)
        ),
        ''
      ) || '}'
      WHEN 'array' THEN '[' || COALESCE(
        (
          SELECT
            string_agg(
              public.encounter_blueprint_canonical_json(entry.value),
              ','
              ORDER BY entry.ordinality
            )
          FROM
            jsonb_array_elements(value) WITH ORDINALITY AS entry (
              value,
              ordinality
            )
        ),
        ''
      ) || ']'
      WHEN 'number' THEN CASE
        WHEN value::NUMERIC = 0 THEN '0'
        WHEN position('.' IN value::text) > 0 THEN rtrim(
          rtrim(value::text, '0'),
          '.'
        )
        ELSE value::text
      END
      ELSE value::text
    END;
$$;

UPDATE public.encounter_blueprints AS blueprint
SET setup_checksum = encode(
  extensions.digest(
    public.encounter_blueprint_canonical_json(
      jsonb_build_object('name', blueprint.name, 'enemies', blueprint.enemies)
    ),
    'sha256'
  ),
  'hex'
);

DROP FUNCTION public.encounter_blueprint_canonical_json(jsonb);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.encounter_blueprints WHERE setup_checksum IS NULL) THEN
    RAISE EXCEPTION 'Encounter Blueprint setup checksum backfill is incomplete.';
  END IF;
END $$;

ALTER TABLE public.encounter_blueprints
DROP CONSTRAINT IF EXISTS encounter_templates_campaign_id_command_id_key;
ALTER TABLE public.encounter_blueprints
DROP CONSTRAINT IF EXISTS encounter_blueprints_campaign_id_command_id_key;
ALTER TABLE public.encounter_blueprints DROP COLUMN campaign_id;
ALTER TABLE public.encounter_blueprints ALTER COLUMN owner_user_id SET NOT NULL;
ALTER TABLE public.encounter_blueprints
ALTER COLUMN game_system_id SET NOT NULL;
ALTER TABLE public.encounter_blueprints
ALTER COLUMN setup_checksum SET NOT NULL;
ALTER TABLE public.encounter_blueprints
ADD CONSTRAINT encounter_blueprints_owner_command_key
  UNIQUE (owner_user_id, command_id);
ALTER TABLE public.encounter_blueprints
ADD CONSTRAINT encounter_blueprints_id_system_key UNIQUE (id, game_system_id);
ALTER TABLE public.encounter_blueprints
ADD CONSTRAINT encounter_blueprints_id_owner_key UNIQUE (id, owner_user_id);
ALTER TABLE public.encounter_blueprints
ADD CONSTRAINT encounter_blueprints_owner_fk
  FOREIGN KEY (owner_user_id) REFERENCES auth.users (id)
    ON DELETE RESTRICT;
ALTER TABLE public.encounter_blueprints
ADD CONSTRAINT encounter_blueprints_system_fk
  FOREIGN KEY (game_system_id) REFERENCES public.systems (id)
    ON DELETE RESTRICT;
ALTER TABLE public.encounter_blueprints
ADD CONSTRAINT encounter_blueprints_setup_checksum_check
  CHECK (setup_checksum ~ '^[a-f0-9]{64}$');
DROP INDEX IF EXISTS public.encounter_templates_campaign_idx;
CREATE INDEX encounter_blueprints_owner_idx ON public.encounter_blueprints (
  owner_user_id,
  game_system_id,
  updated_at DESC
);
ALTER TABLE public.encounter_blueprints FORCE ROW LEVEL SECURITY;

CREATE TABLE public.encounter_blueprint_events (
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
REVOKE ALL ON public.encounter_blueprint_events FROM anon, authenticated;

ALTER TABLE public.encounters ADD COLUMN game_system_id uuid;
ALTER TABLE public.encounters ADD COLUMN blueprint_id uuid;
ALTER TABLE public.encounters ADD COLUMN blueprint_version INTEGER;
ALTER TABLE public.encounters ADD COLUMN blueprint_checksum text;
UPDATE public.encounters AS encounter
SET
  game_system_id = blueprint.game_system_id,
  blueprint_id = blueprint.id,
  blueprint_version = encounter.template_version,
  blueprint_checksum = blueprint.setup_checksum
FROM public.encounter_blueprints AS blueprint
WHERE blueprint.id = encounter.template_id;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.encounter_actors actor
    JOIN public.encounters encounter ON encounter.id = actor.encounter_id
    WHERE actor.kind <> 'CUSTOM'
      AND COALESCE(actor.system_id::text, actor.snapshot->>'systemId') IS NOT NULL
      AND COALESCE(actor.system_id::text, actor.snapshot->>'systemId') <> encounter.game_system_id::text
  ) THEN
    RAISE EXCEPTION 'Legacy Encounter actor System conflicts with its owning Campaign System.';
  END IF;
END $$;

UPDATE public.encounter_actors AS actor
SET
  system_id = encounter.game_system_id,
  snapshot = jsonb_set(
    actor.snapshot,
    '{systemId}',
    to_jsonb(encounter.game_system_id::text),
    TRUE
  )
FROM public.encounters AS encounter
WHERE actor.encounter_id = encounter.id AND actor.kind = 'CUSTOM';
ALTER TABLE public.encounters
DROP CONSTRAINT IF EXISTS encounters_template_id_fkey;
ALTER TABLE public.encounters
DROP COLUMN template_id,
DROP COLUMN template_version;
ALTER TABLE public.encounters ALTER COLUMN game_system_id SET NOT NULL;
ALTER TABLE public.encounters ALTER COLUMN blueprint_id SET NOT NULL;
ALTER TABLE public.encounters ALTER COLUMN blueprint_version SET NOT NULL;
ALTER TABLE public.encounters ALTER COLUMN blueprint_checksum SET NOT NULL;
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
ALTER TABLE public.encounters
ADD CONSTRAINT encounters_blueprint_checksum_check
  CHECK (blueprint_checksum ~ '^[a-f0-9]{64}$');
