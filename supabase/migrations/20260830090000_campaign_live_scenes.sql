-- A Campaign Scene is durable world state. Encounter bindings are optional overlays.
ALTER TABLE public.encounter_scene_events
  DROP CONSTRAINT IF EXISTS encounter_scene_events_scene_id_encounter_id_fkey;
ALTER TABLE public.encounter_spatial_rule_effects
  DROP CONSTRAINT IF EXISTS encounter_spatial_rule_effects_scene_id_encounter_id_fkey;
ALTER TABLE public.encounter_scenes RENAME TO campaign_live_scenes;
ALTER TABLE public.campaign_live_scenes
  RENAME COLUMN attach_command_id TO materialization_command_id;
ALTER TABLE public.campaign_live_scenes
  RENAME COLUMN attach_command_fingerprint TO materialization_command_fingerprint;

DO $$
DECLARE constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class relation ON relation.oid = con.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'campaign_live_scenes'
      AND (
        pg_get_constraintdef(con.oid) LIKE '%encounter_id%'
        OR (
          con.contype = 'f'
          AND con.confrelid = 'public.campaign_scene_definitions'::regclass
        )
      )
  LOOP
    EXECUTE format('ALTER TABLE public.campaign_live_scenes DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.campaign_live_scenes
  ADD CONSTRAINT campaign_live_scenes_id_campaign_id_key UNIQUE (id, campaign_id);
ALTER TABLE public.campaign_live_scenes
  ADD CONSTRAINT campaign_live_scenes_campaign_fk
  FOREIGN KEY (campaign_id) REFERENCES public.campaigns (id) ON DELETE CASCADE;
ALTER TABLE public.campaign_live_scenes ALTER COLUMN encounter_id DROP NOT NULL;
ALTER TABLE public.campaign_live_scenes ALTER COLUMN definition_id DROP NOT NULL;
ALTER TABLE public.campaign_live_scenes
  ADD CONSTRAINT campaign_live_scenes_definition_fk
  FOREIGN KEY (definition_id, campaign_id)
  REFERENCES public.campaign_scene_definitions (id, campaign_id)
  ON DELETE SET NULL (definition_id);
CREATE INDEX IF NOT EXISTS campaign_live_scenes_definition_idx
  ON public.campaign_live_scenes (definition_id, definition_version);

CREATE TABLE public.campaign_session_scene_presentations (
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
REVOKE ALL ON public.campaign_session_scene_presentations FROM anon, authenticated;

CREATE TABLE public.encounter_scene_bindings (
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
REVOKE ALL ON public.encounter_scene_bindings FROM anon, authenticated;

CREATE TABLE public.encounter_scene_actor_token_bindings (
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
REVOKE ALL ON public.encounter_scene_actor_token_bindings FROM anon, authenticated;

-- Normalize legacy actor ownership before deleting it from persistent Scene JSON.
INSERT INTO public.encounter_scene_bindings (encounter_id, campaign_id, scene_id, command_id, command_fingerprint)
SELECT encounter_id, campaign_id, id, materialization_command_id, materialization_command_fingerprint
FROM public.campaign_live_scenes
WHERE encounter_id IS NOT NULL;
INSERT INTO public.encounter_scene_actor_token_bindings (encounter_id, actor_id, scene_id, token_id)
SELECT scene.encounter_id, actor.id, scene.id, (token ->> 'id')::uuid
FROM public.campaign_live_scenes scene
JOIN public.encounter_actors actor ON actor.encounter_id = scene.encounter_id
CROSS JOIN LATERAL jsonb_array_elements(scene.projection -> 'tokens') token
WHERE scene.encounter_id IS NOT NULL AND token ->> 'actorId' = actor.id::text;

DO $$ BEGIN
  PERFORM set_config('extra_float_digits', '3', true);
  IF EXISTS (
    SELECT 1 FROM public.campaign_live_scenes scene
    CROSS JOIN LATERAL jsonb_path_query(scene.projection, '$.** ? (@.type() == "number")') leaf(value)
    CROSS JOIN LATERAL (SELECT (leaf.value #>> '{}')::numeric AS value) numeric_leaf
    WHERE CASE
      WHEN abs(numeric_leaf.value) >= 1000000000000000000000
        OR (abs(numeric_leaf.value) > 0 AND abs(numeric_leaf.value) < 0.000001) THEN true
      ELSE (((numeric_leaf.value::double precision)::text)::numeric <> numeric_leaf.value)
    END
  ) THEN RAISE EXCEPTION 'Legacy Scene projection numeric values cannot be canonically migrated.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.scene_projection_canonical_json(value jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT CASE jsonb_typeof(value)
    WHEN 'object' THEN '{' || COALESCE((SELECT string_agg(to_jsonb(entry.key)::text || ':' || public.scene_projection_canonical_json(entry.value), ',' ORDER BY entry.key COLLATE "C") FROM jsonb_each(value) entry(key, value)), '') || '}'
    WHEN 'array' THEN '[' || COALESCE((SELECT string_agg(public.scene_projection_canonical_json(entry.value), ',' ORDER BY entry.ordinality) FROM jsonb_array_elements(value) WITH ORDINALITY entry(value, ordinality)), '') || ']'
    WHEN 'number' THEN CASE WHEN value::numeric = 0 THEN '0' WHEN position('.' IN value::text) > 0 THEN rtrim(rtrim(value::text, '0'), '.') ELSE value::text END
    ELSE value::text END;
$$;

-- Definitions that never entered combat receive their required default live instance.
WITH candidates AS (
  SELECT
    d.id AS definition_id,
    d.campaign_id,
    gen_random_uuid() AS scene_id,
    d.version AS definition_version,
    d.definition AS definition_snapshot,
    (
      jsonb_set(
        d.definition,
        '{tokens}',
        COALESCE((SELECT jsonb_agg(token - 'actorId' ORDER BY ordinality) FROM jsonb_array_elements(d.definition -> 'tokens') WITH ORDINALITY entry(token, ordinality)), '[]'::jsonb)
      ) || jsonb_build_object(
        'id', gen_random_uuid()::text,
        'version', 0,
        'definitionId', d.id::text,
        'definitionVersion', d.version,
        'doorStates', COALESCE((SELECT jsonb_object_agg(barrier ->> 'id', barrier ->> 'initialState') FROM jsonb_array_elements(d.definition -> 'barriers') barrier WHERE barrier ->> 'kind' = 'DOOR'), '{}'::jsonb),
        'fogLayers', '[]'::jsonb,
        'measurements', '[]'::jsonb
      )
    ) AS projection
  FROM public.campaign_scene_definitions d
  WHERE NOT EXISTS (SELECT 1 FROM public.campaign_live_scenes s WHERE s.definition_id = d.id)
), normalized AS (
  SELECT *, jsonb_set(projection, '{id}', to_jsonb(scene_id::text), true) AS normalized_projection
  FROM candidates
)
INSERT INTO public.campaign_live_scenes (
  id, campaign_id, definition_id, definition_version, definition_snapshot,
  projection, version, projection_schema_version, projection_checksum,
  materialization_command_id, materialization_command_fingerprint
)
SELECT scene_id, campaign_id, definition_id, definition_version, definition_snapshot,
  normalized_projection, 0, 2,
  encode(digest(public.scene_projection_canonical_json(jsonb_build_object('sceneId', scene_id::text, 'streamVersion', 0, 'projectionSchemaVersion', 2, 'projection', normalized_projection)), 'sha256'), 'hex'),
  gen_random_uuid(), encode(digest('default-campaign-live-scene:' || definition_id::text, 'sha256'), 'hex')
FROM normalized;

WITH normalized AS (
  SELECT id,
    jsonb_set(projection - 'encounterId', '{tokens}',
      COALESCE((SELECT jsonb_agg(token - 'actorId' ORDER BY ordinality) FROM jsonb_array_elements(projection -> 'tokens') WITH ORDINALITY entry(token, ordinality)), '[]'::jsonb)
    ) AS projection
  FROM public.campaign_live_scenes
)
UPDATE public.campaign_live_scenes scene
SET projection = normalized.projection,
    definition_snapshot = scene.definition_snapshot - 'encounterId',
    projection_checksum = encode(digest(public.scene_projection_canonical_json(jsonb_build_object('sceneId', scene.id::text, 'streamVersion', scene.version, 'projectionSchemaVersion', scene.projection_schema_version, 'projection', normalized.projection)), 'sha256'), 'hex')
FROM normalized WHERE normalized.id = scene.id;
DROP FUNCTION public.scene_projection_canonical_json(jsonb);

ALTER TABLE public.encounter_scene_events RENAME TO campaign_scene_events;
ALTER TABLE public.campaign_scene_events ALTER COLUMN encounter_id DROP NOT NULL;
ALTER TABLE public.campaign_scene_events DROP CONSTRAINT IF EXISTS encounter_scene_events_encounter_id_command_id_key;
ALTER TABLE public.campaign_scene_events ADD CONSTRAINT campaign_scene_events_scene_command_key UNIQUE (scene_id, command_id);
ALTER TABLE public.campaign_scene_events ADD CONSTRAINT campaign_scene_events_scene_fk
  FOREIGN KEY (scene_id) REFERENCES public.campaign_live_scenes (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS campaign_scene_events_replay_idx ON public.campaign_scene_events (scene_id, version ASC);

ALTER TABLE public.encounter_spatial_rule_effects ADD CONSTRAINT encounter_spatial_rule_effects_binding_fk
  FOREIGN KEY (encounter_id, scene_id) REFERENCES public.encounter_scene_bindings (encounter_id, scene_id) ON DELETE RESTRICT;
ALTER TABLE public.campaign_live_scenes DROP COLUMN encounter_id;

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

DROP TRIGGER IF EXISTS encounter_scenes_sync_vtt_map_reference_trigger ON public.campaign_live_scenes;
DROP FUNCTION IF EXISTS public.sync_encounter_scene_map_reference();
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
