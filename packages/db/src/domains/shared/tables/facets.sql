/* ============================================================================
 * FACETS — FULLY NORMALIZED (NO JSONB)
 *
 * Storage model
 * - Facet: OR-of-groups
 * - Group: AND-of-contexts
 * - Context: subject-scoped body (selection + OR-of-AND conditions)
 * - Body: single-subject OR-of-AND groups (reused by Context bodies and EXISTS.where)
 * - Condition: discriminated union { PREDICATE | EXISTS }
 *
 * Notes
 * - RLS is enabled on every table in this file.
 * - CREATE POLICY statements are intentionally omitted (applied elsewhere).
 * - updated_at triggers are intentionally omitted (applied elsewhere).
 * - Enum-like values are stored as TEXT (validated by application/compiler).
 * ========================================================================== */

-- =============================================================================
-- 1) Facet roots
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.facets (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.facet_groups (
  id uuid PRIMARY KEY,
  facet_id uuid NOT NULL
    REFERENCES public.facets (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facet_groups ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_groups_facet_id
  ON public.facet_groups (facet_id);

-- =============================================================================
-- 2) Contexts (AND across subjects within a facet group)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.facet_contexts (
  id uuid PRIMARY KEY,
  facet_group_id uuid NOT NULL
    REFERENCES public.facet_groups (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  node_subject_code text NOT NULL,
  sort_order integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facet_contexts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_contexts_group_id
  ON public.facet_contexts (facet_group_id);

CREATE INDEX IF NOT EXISTS idx_facet_contexts_subject
  ON public.facet_contexts (node_subject_code);

-- =============================================================================
-- 3) Bodies (single-subject OR-of-AND)
--    Used by:
--    - facet_context_bodies (context body)
--    - facet_conditions.where_facet_body_id (EXISTS.where body)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.facet_bodies (
  id uuid PRIMARY KEY,

  /* Subject of this body. Redundant with facet_contexts.node_subject_code for
   * context bodies, but required for EXISTS.where bodies and convenient for
   * integrity checks at the application/compiler layer.
   */
  node_subject_code text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facet_bodies ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_bodies_subject
  ON public.facet_bodies (node_subject_code);

CREATE TABLE IF NOT EXISTS public.facet_context_bodies (
  facet_context_id uuid PRIMARY KEY
    REFERENCES public.facet_contexts (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  facet_body_id uuid NOT NULL
    REFERENCES public.facet_bodies (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE public.facet_context_bodies ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_context_bodies_body_id
  ON public.facet_context_bodies (facet_body_id);

CREATE TABLE IF NOT EXISTS public.facet_body_groups (
  id uuid PRIMARY KEY,
  facet_body_id uuid NOT NULL
    REFERENCES public.facet_bodies (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facet_body_groups ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_body_groups_body_id
  ON public.facet_body_groups (facet_body_id);

-- =============================================================================
-- 4) Body selection (Selectable<SubjectSelectionPayload<S>>)
--    This is FacetBodyAuthored.selection.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.facet_body_selections (
  facet_body_id uuid PRIMARY KEY
    REFERENCES public.facet_bodies (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  authoring_mode_kind text NOT NULL, -- ALL | SELECTED

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facet_body_selections ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_body_selections_mode
  ON public.facet_body_selections (authoring_mode_kind);

-- Selected IDs for body selection (only when authoring_mode_kind = SELECTED).
-- Polymorphic “one-of” row; stored as FK columns (no arrays, no jsonb).
CREATE TABLE IF NOT EXISTS public.facet_body_selection_items (
  facet_body_id uuid NOT NULL
    REFERENCES public.facet_bodies (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  /* One-of subject payload identifiers */
  class_id uuid,
  feature_id uuid,
  spell_id uuid,
  equipment_id uuid,
  feat_id uuid,
  race_id uuid,
  background_id uuid,
  option_id uuid,

  /* Modeled as IDs in existing tables */
  subrace_id uuid,
  subclass_id uuid,
  resource_id uuid,
  ancestry_option_id uuid,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT facet_body_selection_items_one_chk CHECK (
    (class_id IS NOT NULL)::int
    + (feature_id IS NOT NULL)::int
    + (spell_id IS NOT NULL)::int
    + (equipment_id IS NOT NULL)::int
    + (feat_id IS NOT NULL)::int
    + (race_id IS NOT NULL)::int
    + (background_id IS NOT NULL)::int
    + (option_id IS NOT NULL)::int
    + (subrace_id IS NOT NULL)::int
    + (subclass_id IS NOT NULL)::int
    + (resource_id IS NOT NULL)::int
    + (ancestry_option_id IS NOT NULL)::int
    = 1
  )
);

ALTER TABLE public.facet_body_selection_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_body_selection_items_body_id
  ON public.facet_body_selection_items (facet_body_id);

-- =============================================================================
-- 5) Conditions (AND list within a body group)
--    Discriminated union:
--    - PREDICATE: predicate_code + normalized payload tables
--    - EXISTS: relation_code + optional relation selection + optional where body
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.facet_conditions (
  id uuid PRIMARY KEY,

  facet_body_group_id uuid NOT NULL
    REFERENCES public.facet_body_groups (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  kind text NOT NULL,             -- PREDICATE | EXISTS
  constraint_code text NOT NULL,  -- INCLUDE | EXCLUDE
  sort_order integer NOT NULL,

  /* PREDICATE fields */
  predicate_code text,

  /* EXISTS fields */
  relation_code text,
  where_facet_body_id uuid
    REFERENCES public.facet_bodies (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT facet_conditions_kind_chk
    CHECK (kind IN ('PREDICATE', 'EXISTS')),

  CONSTRAINT facet_conditions_predicate_fields_chk CHECK (
    (kind <> 'PREDICATE')
    OR (
      predicate_code IS NOT NULL
      AND relation_code IS NULL
      AND where_facet_body_id IS NULL
    )
  ),

  CONSTRAINT facet_conditions_exists_fields_chk CHECK (
    (kind <> 'EXISTS')
    OR (
      relation_code IS NOT NULL
      AND predicate_code IS NULL
      -- where_facet_body_id is optional for EXISTS
    )
  )
);

ALTER TABLE public.facet_conditions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_conditions_body_group_id
  ON public.facet_conditions (facet_body_group_id);

CREATE INDEX IF NOT EXISTS idx_facet_conditions_kind
  ON public.facet_conditions (kind);

CREATE INDEX IF NOT EXISTS idx_facet_conditions_predicate_code
  ON public.facet_conditions (predicate_code);

CREATE INDEX IF NOT EXISTS idx_facet_conditions_relation_code
  ON public.facet_conditions (relation_code);

CREATE INDEX IF NOT EXISTS idx_facet_conditions_where_body_id
  ON public.facet_conditions (where_facet_body_id);

-- =============================================================================
-- 6) EXISTS relation selection (Selectable<SubjectSelectionPayload<RelationTargetSubject>>)
--    Stored only for EXISTS conditions.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.facet_exists_selections (
  facet_condition_id uuid PRIMARY KEY
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  authoring_mode_kind text NOT NULL, -- ALL | SELECTED

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facet_exists_selections ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_exists_selections_mode
  ON public.facet_exists_selections (authoring_mode_kind);

CREATE TABLE IF NOT EXISTS public.facet_exists_selection_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  /* One-of related-subject identifiers */
  class_id uuid,
  feature_id uuid,
  spell_id uuid,
  equipment_id uuid,
  feat_id uuid,
  race_id uuid,
  background_id uuid,
  option_id uuid,

  subrace_id uuid,
  subclass_id uuid,
  resource_id uuid,
  ancestry_option_id uuid,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT facet_exists_selection_items_one_chk CHECK (
    (class_id IS NOT NULL)::int
    + (feature_id IS NOT NULL)::int
    + (spell_id IS NOT NULL)::int
    + (equipment_id IS NOT NULL)::int
    + (feat_id IS NOT NULL)::int
    + (race_id IS NOT NULL)::int
    + (background_id IS NOT NULL)::int
    + (option_id IS NOT NULL)::int
    + (subrace_id IS NOT NULL)::int
    + (subclass_id IS NOT NULL)::int
    + (resource_id IS NOT NULL)::int
    + (ancestry_option_id IS NOT NULL)::int
    = 1
  )
);

ALTER TABLE public.facet_exists_selection_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_exists_selection_items_condition_id
  ON public.facet_exists_selection_items (facet_condition_id);

-- =============================================================================
-- 7) Predicate payloads (normalized)
--    These tables are keyed by facet_condition_id (kind=PREDICATE).
--    SQL does not enforce predicate_code-to-payload compatibility; compiler does.
-- =============================================================================

/* Selectable header for predicate payloads that use Selectable<...> */
CREATE TABLE IF NOT EXISTS public.facet_predicate_selectables (
  facet_condition_id uuid PRIMARY KEY
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  authoring_mode_kind text NOT NULL, -- ALL | SELECTED

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facet_predicate_selectables ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_selectables_mode
  ON public.facet_predicate_selectables (authoring_mode_kind);

/* Generic numeric range payloads: min/max */
CREATE TABLE IF NOT EXISTS public.facet_predicate_numeric_ranges (
  facet_condition_id uuid PRIMARY KEY
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  min_value numeric NOT NULL,
  max_value numeric,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facet_predicate_numeric_ranges ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_numeric_ranges_min
  ON public.facet_predicate_numeric_ranges (min_value);

/* RangeKind payload (+ optional distance bounds) */
CREATE TABLE IF NOT EXISTS public.facet_predicate_ranges (
  facet_condition_id uuid PRIMARY KEY
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  range_kind text NOT NULL, -- RangeKind
  min_distance integer,
  max_distance integer,
  unit_code text, -- MeasurementUnitCode

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT facet_predicate_ranges_distance_chk CHECK (
    (
      range_kind <> 'DISTANCE'
      AND min_distance IS NULL
      AND max_distance IS NULL
      AND unit_code IS NULL
    )
    OR
    (
      range_kind = 'DISTANCE'
      AND min_distance IS NOT NULL
      AND unit_code IS NOT NULL
    )
  )
);

ALTER TABLE public.facet_predicate_ranges ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_ranges_kind
  ON public.facet_predicate_ranges (range_kind);

/* DurationKind payload (+ optional bounds) */
CREATE TABLE IF NOT EXISTS public.facet_predicate_durations (
  facet_condition_id uuid PRIMARY KEY
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  duration_kind text NOT NULL, -- DurationKind
  min_amount integer,
  max_amount integer,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT facet_predicate_durations_inst_chk CHECK (
    (
      duration_kind = 'INSTANTANEOUS'
      AND min_amount IS NULL
      AND max_amount IS NULL
    )
    OR (
      duration_kind <> 'INSTANTANEOUS'
      AND min_amount IS NOT NULL
    )
  )
);

ALTER TABLE public.facet_predicate_durations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_durations_kind
  ON public.facet_predicate_durations (duration_kind);

/* Equipment category payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_equipment_categories (
  facet_condition_id uuid PRIMARY KEY
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  category_code text NOT NULL, -- EquipmentCategoryCode

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facet_predicate_equipment_categories ENABLE ROW LEVEL SECURITY;

/* Proficiency level payload (ScalingAmountKind) */
CREATE TABLE IF NOT EXISTS public.facet_predicate_proficiency_levels (
  facet_condition_id uuid PRIMARY KEY
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  proficiency_level text NOT NULL, -- ScalingAmountKind

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facet_predicate_proficiency_levels ENABLE ROW LEVEL SECURITY;

/* Ability list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_ability_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  ability_code text NOT NULL, -- AbilityCode

  PRIMARY KEY (facet_condition_id, ability_code)
);

ALTER TABLE public.facet_predicate_ability_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_ability_items_condition
  ON public.facet_predicate_ability_items (facet_condition_id);

/* Equipment property list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_equipment_property_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  property_code text NOT NULL, -- EquipmentPropertyCode

  PRIMARY KEY (facet_condition_id, property_code)
);

ALTER TABLE public.facet_predicate_equipment_property_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_equipment_property_items_condition
  ON public.facet_predicate_equipment_property_items (facet_condition_id);

/* Skill list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_skill_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  skill_id uuid NOT NULL
    REFERENCES public.skills (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  PRIMARY KEY (facet_condition_id, skill_id)
);

ALTER TABLE public.facet_predicate_skill_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_skill_items_condition
  ON public.facet_predicate_skill_items (facet_condition_id);

/* Language list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_language_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  language_id uuid NOT NULL
    REFERENCES public.languages (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  PRIMARY KEY (facet_condition_id, language_id)
);

ALTER TABLE public.facet_predicate_language_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_language_items_condition
  ON public.facet_predicate_language_items (facet_condition_id);

/* Magic school list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_magic_school_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  magic_school_id uuid NOT NULL
    REFERENCES public.magic_schools (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  PRIMARY KEY (facet_condition_id, magic_school_id)
);

ALTER TABLE public.facet_predicate_magic_school_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_magic_school_items_condition
  ON public.facet_predicate_magic_school_items (facet_condition_id);

/* Damage type list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_damage_type_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  damage_type_id uuid NOT NULL
    REFERENCES public.damage_types (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  PRIMARY KEY (facet_condition_id, damage_type_id)
);

ALTER TABLE public.facet_predicate_damage_type_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_damage_type_items_condition
  ON public.facet_predicate_damage_type_items (facet_condition_id);

/* Condition type list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_condition_type_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  condition_type_id uuid NOT NULL
    REFERENCES public.condition_types (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  PRIMARY KEY (facet_condition_id, condition_type_id)
);

ALTER TABLE public.facet_predicate_condition_type_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_condition_type_items_condition
  ON public.facet_predicate_condition_type_items (facet_condition_id);

/* Spell list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_spell_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  spell_id uuid NOT NULL,

  PRIMARY KEY (facet_condition_id, spell_id)
);

ALTER TABLE public.facet_predicate_spell_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_spell_items_condition
  ON public.facet_predicate_spell_items (facet_condition_id);

/* Feat list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_feat_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  feat_id uuid NOT NULL,

  PRIMARY KEY (facet_condition_id, feat_id)
);

ALTER TABLE public.facet_predicate_feat_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_feat_items_condition
  ON public.facet_predicate_feat_items (facet_condition_id);

/* Feature list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_feature_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  feature_id uuid NOT NULL,

  PRIMARY KEY (facet_condition_id, feature_id)
);

ALTER TABLE public.facet_predicate_feature_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_feature_items_condition
  ON public.facet_predicate_feature_items (facet_condition_id);

/* Option list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_option_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  option_id uuid NOT NULL,

  PRIMARY KEY (facet_condition_id, option_id)
);

ALTER TABLE public.facet_predicate_option_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_option_items_condition
  ON public.facet_predicate_option_items (facet_condition_id);

/* Equipment list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_equipment_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  equipment_id uuid NOT NULL,

  PRIMARY KEY (facet_condition_id, equipment_id)
);

ALTER TABLE public.facet_predicate_equipment_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_equipment_items_condition
  ON public.facet_predicate_equipment_items (facet_condition_id);
