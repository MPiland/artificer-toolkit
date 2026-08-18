CREATE TABLE IF NOT EXISTS public.system_vocabulary_snapshots (
  id uuid PRIMARY KEY,
  system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  vocabulary_version integer NOT NULL CHECK (vocabulary_version > 0),
  schema_version integer NOT NULL CHECK (schema_version > 0),
  checksum text NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (system_id, vocabulary_version),
  UNIQUE (system_id, id)
);

CREATE TABLE IF NOT EXISTS public.background_versions (
  id uuid PRIMARY KEY, background_id uuid NOT NULL REFERENCES public.backgrounds (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  version integer NOT NULL CHECK (version > 0), vocabulary_snapshot_id uuid NOT NULL REFERENCES public.system_vocabulary_snapshots (id) DEFERRABLE INITIALLY DEFERRED,
  document_schema_version integer NOT NULL CHECK (document_schema_version > 0), projection_schema_version integer NOT NULL CHECK (projection_schema_version > 0), compiler_version text NOT NULL CHECK (length(btrim(compiler_version)) > 0),
  authored_checksum text NOT NULL CHECK (authored_checksum ~ '^[a-f0-9]{64}$'), compiled_checksum text NOT NULL CHECK (compiled_checksum ~ '^[a-f0-9]{64}$'),
  authored_document jsonb NOT NULL CHECK (jsonb_typeof(authored_document) = 'object'), compiled_document jsonb NOT NULL CHECK (jsonb_typeof(compiled_document) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (background_id, version), UNIQUE (background_id, id)
);
CREATE TABLE IF NOT EXISTS public.class_versions (
  id uuid PRIMARY KEY, class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  version integer NOT NULL CHECK (version > 0), vocabulary_snapshot_id uuid NOT NULL REFERENCES public.system_vocabulary_snapshots (id) DEFERRABLE INITIALLY DEFERRED,
  document_schema_version integer NOT NULL CHECK (document_schema_version > 0), projection_schema_version integer NOT NULL CHECK (projection_schema_version > 0), compiler_version text NOT NULL CHECK (length(btrim(compiler_version)) > 0),
  authored_checksum text NOT NULL CHECK (authored_checksum ~ '^[a-f0-9]{64}$'), compiled_checksum text NOT NULL CHECK (compiled_checksum ~ '^[a-f0-9]{64}$'),
  authored_document jsonb NOT NULL CHECK (jsonb_typeof(authored_document) = 'object'), compiled_document jsonb NOT NULL CHECK (jsonb_typeof(compiled_document) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (class_id, version), UNIQUE (class_id, id)
);
CREATE TABLE IF NOT EXISTS public.creature_versions (
  id uuid PRIMARY KEY, creature_id uuid NOT NULL REFERENCES public.creatures (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  version integer NOT NULL CHECK (version > 0), vocabulary_snapshot_id uuid NOT NULL REFERENCES public.system_vocabulary_snapshots (id) DEFERRABLE INITIALLY DEFERRED,
  document_schema_version integer NOT NULL CHECK (document_schema_version > 0), projection_schema_version integer NOT NULL CHECK (projection_schema_version > 0), compiler_version text NOT NULL CHECK (length(btrim(compiler_version)) > 0),
  authored_checksum text NOT NULL CHECK (authored_checksum ~ '^[a-f0-9]{64}$'), compiled_checksum text NOT NULL CHECK (compiled_checksum ~ '^[a-f0-9]{64}$'),
  authored_document jsonb NOT NULL CHECK (jsonb_typeof(authored_document) = 'object'), compiled_document jsonb NOT NULL CHECK (jsonb_typeof(compiled_document) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (creature_id, version), UNIQUE (creature_id, id)
);
CREATE TABLE IF NOT EXISTS public.equipment_versions (
  id uuid PRIMARY KEY, equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  version integer NOT NULL CHECK (version > 0), vocabulary_snapshot_id uuid NOT NULL REFERENCES public.system_vocabulary_snapshots (id) DEFERRABLE INITIALLY DEFERRED,
  document_schema_version integer NOT NULL CHECK (document_schema_version > 0), projection_schema_version integer NOT NULL CHECK (projection_schema_version > 0), compiler_version text NOT NULL CHECK (length(btrim(compiler_version)) > 0),
  authored_checksum text NOT NULL CHECK (authored_checksum ~ '^[a-f0-9]{64}$'), compiled_checksum text NOT NULL CHECK (compiled_checksum ~ '^[a-f0-9]{64}$'),
  authored_document jsonb NOT NULL CHECK (jsonb_typeof(authored_document) = 'object'), compiled_document jsonb NOT NULL CHECK (jsonb_typeof(compiled_document) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (equipment_id, version), UNIQUE (equipment_id, id)
);
CREATE TABLE IF NOT EXISTS public.feat_versions (
  id uuid PRIMARY KEY, feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  version integer NOT NULL CHECK (version > 0), vocabulary_snapshot_id uuid NOT NULL REFERENCES public.system_vocabulary_snapshots (id) DEFERRABLE INITIALLY DEFERRED,
  document_schema_version integer NOT NULL CHECK (document_schema_version > 0), projection_schema_version integer NOT NULL CHECK (projection_schema_version > 0), compiler_version text NOT NULL CHECK (length(btrim(compiler_version)) > 0),
  authored_checksum text NOT NULL CHECK (authored_checksum ~ '^[a-f0-9]{64}$'), compiled_checksum text NOT NULL CHECK (compiled_checksum ~ '^[a-f0-9]{64}$'),
  authored_document jsonb NOT NULL CHECK (jsonb_typeof(authored_document) = 'object'), compiled_document jsonb NOT NULL CHECK (jsonb_typeof(compiled_document) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (feat_id, version), UNIQUE (feat_id, id)
);
CREATE TABLE IF NOT EXISTS public.race_versions (
  id uuid PRIMARY KEY, race_id uuid NOT NULL REFERENCES public.races (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  version integer NOT NULL CHECK (version > 0), vocabulary_snapshot_id uuid NOT NULL REFERENCES public.system_vocabulary_snapshots (id) DEFERRABLE INITIALLY DEFERRED,
  document_schema_version integer NOT NULL CHECK (document_schema_version > 0), projection_schema_version integer NOT NULL CHECK (projection_schema_version > 0), compiler_version text NOT NULL CHECK (length(btrim(compiler_version)) > 0),
  authored_checksum text NOT NULL CHECK (authored_checksum ~ '^[a-f0-9]{64}$'), compiled_checksum text NOT NULL CHECK (compiled_checksum ~ '^[a-f0-9]{64}$'),
  authored_document jsonb NOT NULL CHECK (jsonb_typeof(authored_document) = 'object'), compiled_document jsonb NOT NULL CHECK (jsonb_typeof(compiled_document) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (race_id, version), UNIQUE (race_id, id)
);
CREATE TABLE IF NOT EXISTS public.spell_versions (
  id uuid PRIMARY KEY, spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  version integer NOT NULL CHECK (version > 0), vocabulary_snapshot_id uuid NOT NULL REFERENCES public.system_vocabulary_snapshots (id) DEFERRABLE INITIALLY DEFERRED,
  document_schema_version integer NOT NULL CHECK (document_schema_version > 0), projection_schema_version integer NOT NULL CHECK (projection_schema_version > 0), compiler_version text NOT NULL CHECK (length(btrim(compiler_version)) > 0),
  authored_checksum text NOT NULL CHECK (authored_checksum ~ '^[a-f0-9]{64}$'), compiled_checksum text NOT NULL CHECK (compiled_checksum ~ '^[a-f0-9]{64}$'),
  authored_document jsonb NOT NULL CHECK (jsonb_typeof(authored_document) = 'object'), compiled_document jsonb NOT NULL CHECK (jsonb_typeof(compiled_document) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (spell_id, version), UNIQUE (spell_id, id)
);
CREATE TABLE IF NOT EXISTS public.vehicle_versions (
  id uuid PRIMARY KEY, vehicle_id uuid NOT NULL REFERENCES public.vehicles (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  version integer NOT NULL CHECK (version > 0), vocabulary_snapshot_id uuid NOT NULL REFERENCES public.system_vocabulary_snapshots (id) DEFERRABLE INITIALLY DEFERRED,
  document_schema_version integer NOT NULL CHECK (document_schema_version > 0), projection_schema_version integer NOT NULL CHECK (projection_schema_version > 0), compiler_version text NOT NULL CHECK (length(btrim(compiler_version)) > 0),
  authored_checksum text NOT NULL CHECK (authored_checksum ~ '^[a-f0-9]{64}$'), compiled_checksum text NOT NULL CHECK (compiled_checksum ~ '^[a-f0-9]{64}$'),
  authored_document jsonb NOT NULL CHECK (jsonb_typeof(authored_document) = 'object'), compiled_document jsonb NOT NULL CHECK (jsonb_typeof(compiled_document) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (vehicle_id, version), UNIQUE (vehicle_id, id)
);

ALTER TABLE public.background_versions ADD COLUMN IF NOT EXISTS authored_dependency_vector jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(authored_dependency_vector) = 'array');
ALTER TABLE public.class_versions ADD COLUMN IF NOT EXISTS authored_dependency_vector jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(authored_dependency_vector) = 'array');
ALTER TABLE public.creature_versions ADD COLUMN IF NOT EXISTS authored_dependency_vector jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(authored_dependency_vector) = 'array');
ALTER TABLE public.equipment_versions ADD COLUMN IF NOT EXISTS authored_dependency_vector jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(authored_dependency_vector) = 'array');
ALTER TABLE public.feat_versions ADD COLUMN IF NOT EXISTS authored_dependency_vector jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(authored_dependency_vector) = 'array');
ALTER TABLE public.race_versions ADD COLUMN IF NOT EXISTS authored_dependency_vector jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(authored_dependency_vector) = 'array');
ALTER TABLE public.spell_versions ADD COLUMN IF NOT EXISTS authored_dependency_vector jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(authored_dependency_vector) = 'array');
ALTER TABLE public.vehicle_versions ADD COLUMN IF NOT EXISTS authored_dependency_vector jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(authored_dependency_vector) = 'array');

ALTER TABLE public.systems ADD COLUMN IF NOT EXISTS active_vocabulary_snapshot_id uuid;
ALTER TABLE public.backgrounds ADD COLUMN IF NOT EXISTS active_version_id uuid;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS active_version_id uuid;
ALTER TABLE public.creatures ADD COLUMN IF NOT EXISTS active_version_id uuid;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS active_version_id uuid;
ALTER TABLE public.feats ADD COLUMN IF NOT EXISTS active_version_id uuid;
ALTER TABLE public.races ADD COLUMN IF NOT EXISTS active_version_id uuid;
ALTER TABLE public.spells ADD COLUMN IF NOT EXISTS active_version_id uuid;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS active_version_id uuid;

ALTER TABLE public.systems ADD CONSTRAINT systems_active_vocabulary_snapshot_fk FOREIGN KEY (id, active_vocabulary_snapshot_id) REFERENCES public.system_vocabulary_snapshots (system_id, id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.backgrounds ADD CONSTRAINT backgrounds_active_version_fk FOREIGN KEY (id, active_version_id) REFERENCES public.background_versions (background_id, id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.classes ADD CONSTRAINT classes_active_version_fk FOREIGN KEY (id, active_version_id) REFERENCES public.class_versions (class_id, id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.creatures ADD CONSTRAINT creatures_active_version_fk FOREIGN KEY (id, active_version_id) REFERENCES public.creature_versions (creature_id, id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.equipment ADD CONSTRAINT equipment_active_version_fk FOREIGN KEY (id, active_version_id) REFERENCES public.equipment_versions (equipment_id, id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.feats ADD CONSTRAINT feats_active_version_fk FOREIGN KEY (id, active_version_id) REFERENCES public.feat_versions (feat_id, id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.races ADD CONSTRAINT races_active_version_fk FOREIGN KEY (id, active_version_id) REFERENCES public.race_versions (race_id, id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.spells ADD CONSTRAINT spells_active_version_fk FOREIGN KEY (id, active_version_id) REFERENCES public.spell_versions (spell_id, id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_active_version_fk FOREIGN KEY (id, active_version_id) REFERENCES public.vehicle_versions (vehicle_id, id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS public.character_mechanics_projections (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  stream_version integer NOT NULL CHECK (stream_version >= 0),
  authored_version_vector jsonb NOT NULL CHECK (jsonb_typeof(authored_version_vector) = 'array'),
  vocabulary_snapshot_id uuid NOT NULL REFERENCES public.system_vocabulary_snapshots (id) DEFERRABLE INITIALLY DEFERRED,
  rule_pack_revision_id uuid NOT NULL REFERENCES public.rule_pack_revisions (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  rule_pack_checksum text NOT NULL CHECK (rule_pack_checksum ~ '^[a-f0-9]{64}$'),
  evaluator_version text NOT NULL CHECK (length(btrim(evaluator_version)) > 0),
  model_contract_version integer NOT NULL CHECK (model_contract_version BETWEEN 1 AND 10000),
  campaign_context_checksum text CHECK (campaign_context_checksum IS NULL OR campaign_context_checksum ~ '^[a-f0-9]{64}$'),
  projection_schema_version integer NOT NULL CHECK (projection_schema_version > 0),
  projection_checksum text NOT NULL CHECK (projection_checksum ~ '^[a-f0-9]{64}$'),
  rule_snapshot jsonb NOT NULL CHECK (jsonb_typeof(rule_snapshot) = 'object'),
  normalized_facts jsonb NOT NULL CHECK (jsonb_typeof(normalized_facts) = 'object'),
  bounded_registry jsonb NOT NULL CHECK (jsonb_typeof(bounded_registry) = 'object'),
  rule_result jsonb NOT NULL CHECK (jsonb_typeof(rule_result) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_vocabulary_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creature_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feat_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.race_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spell_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_mechanics_projections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.system_vocabulary_snapshots, public.background_versions, public.class_versions, public.creature_versions, public.equipment_versions, public.feat_versions, public.race_versions, public.spell_versions, public.vehicle_versions, public.character_mechanics_projections FROM anon, authenticated;

DROP TABLE IF EXISTS public.character_committed_rule_snapshots;
