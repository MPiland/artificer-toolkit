ALTER TABLE public.character_mechanics_projections
ADD COLUMN IF NOT EXISTS pinned_sense_definitions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
  jsonb_typeof(pinned_sense_definitions) = 'array'
);

ALTER TABLE public.senses
ADD CONSTRAINT senses_id_system_key UNIQUE (id, system_id);

ALTER TABLE public.senses
ADD CONSTRAINT senses_reusable_definition_identity_fkey
  FOREIGN KEY (id, system_id) REFERENCES public.reusable_definitions (
    id,
    game_system_id
  )
    ON DELETE RESTRICT
    NOT VALID DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.modifier_grants
ADD CONSTRAINT modifier_grants_id_system_key UNIQUE (id, system_id);

ALTER TABLE public.modifier_grant_domain_params
ADD COLUMN system_id uuid,
ADD COLUMN sense_definition_id uuid;

UPDATE public.modifier_grant_domain_params AS params
SET system_id = grants.system_id
FROM public.modifier_grants AS grants
WHERE grants.id = params.modifier_grant_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.modifier_grant_domain_params
    WHERE system_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Modifier grant domain params cannot be assigned an owning Game System.';
  END IF;
END;
$$;

UPDATE public.modifier_grant_domain_params AS params
SET sense_definition_id = senses.id
FROM
  public.modifier_grants AS grants,
  public.senses AS senses
WHERE
  params.modifier_grant_id = grants.id
  AND senses.system_id = grants.system_id
  AND senses.code = params.sense_code
  AND params.sense_code IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.modifier_grant_domain_params
    WHERE sense_code IS NOT NULL
      AND sense_definition_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Modifier grant domain sense_code has no exact same-System sense definition.';
  END IF;
END;
$$;

ALTER TABLE public.modifier_grant_domain_params
ALTER COLUMN system_id
SET NOT NULL,
DROP COLUMN sense_code,
ADD CONSTRAINT modifier_grant_domain_params_parent_system_fkey
  FOREIGN KEY (modifier_grant_id, system_id) REFERENCES public.modifier_grants (
    id,
    system_id
  )
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT modifier_grant_domain_params_sense_definition_fkey
  FOREIGN KEY (sense_definition_id, system_id) REFERENCES public.senses (
    id,
    system_id
  )
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT modifier_grant_domain_params_sense_definition_chk
  CHECK (
    (value_domain_code = 'SENSE_RANGE' AND sense_definition_id IS NOT NULL)
    OR (value_domain_code != 'SENSE_RANGE' AND sense_definition_id IS NULL)
  );

CREATE INDEX idx_modifier_grant_domain_params_sense_definition ON public.modifier_grant_domain_params (
  sense_definition_id
);

CREATE OR REPLACE FUNCTION public.scene_environment_backfill(value jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT
    jsonb_set(
      CASE
        WHEN value ? 'ambientIllumination' THEN value
        ELSE jsonb_set(value, '{ambientIllumination}', '"BRIGHT"'::jsonb, TRUE)
      END,
      '{darknessZones}',
      COALESCE(
        (
          SELECT
            jsonb_agg(
              CASE
                WHEN zone ? 'mechanicalIllumination' THEN zone
                ELSE jsonb_set(
                  zone,
                  '{mechanicalIllumination}',
                  'null'::jsonb,
                  TRUE
                )
              END || CASE
                WHEN zone ? 'mechanicalObscurement' THEN '{}'::jsonb
                ELSE jsonb_build_object('mechanicalObscurement', NULL)
              END
              ORDER BY ordinal
            )
          FROM
            jsonb_array_elements(
              COALESCE(value -> 'darknessZones', '[]'::jsonb)
            ) WITH ORDINALITY AS zones (zone, ordinal)
        ),
        '[]'::jsonb
      ),
      TRUE
    );
$$;

CREATE OR REPLACE FUNCTION public.scene_delta_environment_backfill(value jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT
    CASE value ->> 'kind'
      WHEN 'DARKNESS_UPSERTED' THEN jsonb_set(
        value,
        '{zone}',
        COALESCE(value -> 'zone', '{}'::jsonb) || CASE
          WHEN value -> 'zone' ? 'mechanicalIllumination' THEN '{}'::jsonb
          ELSE jsonb_build_object('mechanicalIllumination', NULL)
        END || CASE
          WHEN value -> 'zone' ? 'mechanicalObscurement' THEN '{}'::jsonb
          ELSE jsonb_build_object('mechanicalObscurement', NULL)
        END,
        TRUE
      )
      WHEN 'BATCH' THEN jsonb_set(
        value,
        '{deltas}',
        COALESCE(
          (
            SELECT
              jsonb_agg(
                public.scene_delta_environment_backfill(delta)
                ORDER BY ordinal
              )
            FROM
              jsonb_array_elements(
                COALESCE(value -> 'deltas', '[]'::jsonb)
              ) WITH ORDINALITY AS deltas (delta, ordinal)
          ),
          '[]'::jsonb
        ),
        TRUE
      )
      ELSE value
    END;
$$;

UPDATE public.campaign_scene_definitions
SET definition = public.scene_environment_backfill(definition)
WHERE definition IS DISTINCT FROM public.scene_environment_backfill(definition);

UPDATE public.encounter_scenes
SET definition_snapshot = public.scene_environment_backfill(definition_snapshot)
WHERE
  definition_snapshot IS DISTINCT FROM public.scene_environment_backfill(
    definition_snapshot
  );

UPDATE public.encounter_scene_events
SET delta = public.scene_delta_environment_backfill(delta)
WHERE delta IS DISTINCT FROM public.scene_delta_environment_backfill(delta);

DO $$ BEGIN
  PERFORM set_config('extra_float_digits', '3', true);
  IF EXISTS (
    SELECT 1
    FROM public.encounter_scenes scene
    CROSS JOIN LATERAL jsonb_path_query(
      scene.projection,
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
    RAISE EXCEPTION 'Legacy Scene projection numeric values cannot be canonically migrated without changing their ECMAScript JSON value.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.scene_projection_canonical_json(value jsonb)
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
              )::text || ':' || public.scene_projection_canonical_json(
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
              public.scene_projection_canonical_json(entry.value),
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

WITH
  normalized AS (
    SELECT
      id,
      public.scene_environment_backfill(projection) AS projection
    FROM public.encounter_scenes
  )
UPDATE public.encounter_scenes AS scene
SET
  projection = normalized.projection,
  projection_schema_version = 2,
  projection_checksum = encode(
    extensions.digest(
      public.scene_projection_canonical_json(
        jsonb_build_object(
          'sceneId',
          scene.id::text,
          'streamVersion',
          scene.version,
          'projectionSchemaVersion',
          2,
          'projection',
          normalized.projection
        )
      ),
      'sha256'
    ),
    'hex'
  )
FROM normalized
WHERE normalized.id = scene.id;

DROP FUNCTION public.scene_projection_canonical_json(jsonb);

DROP FUNCTION public.scene_delta_environment_backfill(jsonb);

DROP FUNCTION public.scene_environment_backfill(jsonb);
