/* ──────────────────────────────────────────────
 * TARGET GROUPS — ROOT
 * One row per TargetGroupAuthored
 * (OR blocks)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.target_groups (
  id uuid PRIMARY KEY,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.target_groups ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * TARGETS
 * One row per TargetAuthored
 * (AND predicates)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.targets (
  id uuid PRIMARY KEY,

  target_group_id uuid NOT NULL
    REFERENCES public.target_groups(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  subject_code text NOT NULL,
  target_kind text NOT NULL,        -- FILTER | RESTRICTION
  constraint_code text NOT NULL,    -- INCLUDE | EXCLUDE

  sort_order integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_targets_group_id
  ON public.targets(target_group_id);

CREATE INDEX IF NOT EXISTS idx_targets_subject
  ON public.targets(subject_code);

CREATE INDEX IF NOT EXISTS idx_targets_kind
  ON public.targets(target_kind);

CREATE INDEX IF NOT EXISTS idx_targets_constraint
  ON public.targets(constraint_code);

ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * TARGET NODES
 * Ordered traversal path
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.target_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  target_id uuid NOT NULL
    REFERENCES public.targets(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  node_code text NOT NULL,
  position integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_target_nodes_position
  ON public.target_nodes(target_id, position);

CREATE INDEX IF NOT EXISTS idx_target_nodes_target
  ON public.target_nodes(target_id);

ALTER TABLE public.target_nodes ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * TARGET PAYLOAD IDS
 * One row per selected ID/code
 * Exactly one typed column must be non-null
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.target_payload_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  target_id uuid NOT NULL
    REFERENCES public.targets(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  feat_id uuid REFERENCES public.feats(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  spell_id uuid REFERENCES public.spells(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  feature_id uuid REFERENCES public.features(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  option_id uuid REFERENCES public.options(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  equipment_id uuid REFERENCES public.equipment(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  background_id uuid REFERENCES public.backgrounds(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  race_id uuid REFERENCES public.races(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  subrace_id uuid REFERENCES public.races(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,

  trait_code text,
  property_code text,
  size_code text,
  ability_code text,
  skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,

  magic_school_id uuid REFERENCES public.magic_schools(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_target_payload_ids_target
  ON public.target_payload_ids(target_id);

ALTER TABLE public.target_payload_ids ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS ux_target_payload_feat
  ON public.target_payload_ids(target_id, feat_id)
  WHERE feat_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_target_payload_spell
  ON public.target_payload_ids(target_id, spell_id)
  WHERE spell_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_target_payload_feature
  ON public.target_payload_ids(target_id, feature_id)
  WHERE feature_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_target_payload_equipment
  ON public.target_payload_ids(target_id, equipment_id)
  WHERE equipment_id IS NOT NULL;

/* ──────────────────────────────────────────────
 * TARGET PAYLOAD RANGES
 * For numeric min/max constraints
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.target_payload_ranges (
  target_id uuid PRIMARY KEY
    REFERENCES public.targets(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  min_value integer NOT NULL,
  max_value integer,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.target_payload_ranges ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * TARGET PAYLOAD SCALARS
 * One row per scalar payload
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.target_payload_scalars (
  target_id uuid PRIMARY KEY
    REFERENCES public.targets(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  proficiency_level text,
  category_code text,
  unit_code text,
  currency_id uuid REFERENCES public.currencies(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,

  quantity integer,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.target_payload_scalars ENABLE ROW LEVEL SECURITY;