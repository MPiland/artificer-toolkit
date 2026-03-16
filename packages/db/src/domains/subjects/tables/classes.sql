/* ──────────────────────────────────────────────
 * CLASSES — ROOT
 *
 * Intent:
 *   Stores authored Classes and Subclasses (category-driven).
 *   Base classes may own: starting gold, hitpoints, starting equipment,
 *   spellcasting, multiclass requirements, proficiencies, and features.
 *
 *   Subclasses attach to a parent class and may define subtypes,
 *   plus their own proficiencies and features.
 *
 * Cardinality:
 *   systems 1 ──▶ N classes
 *   classes 1 ──▶ N class_details (owned)
 *   classes 1 ──▶ N class_proficiency_grants (owned)
 *   classes 1 ──▶ N class_features (owned)
 *   classes 0..1 ──▶ 1 class_hitpoints (BASE only)
 *   classes 0..1 ──▶ 1 class_starting_gold (BASE only)
 *   classes 0..1 ──▶ 1 starting_equipment (owned FK, BASE only)
 *   classes 0..1 ──▶ 1 class_spellcasting (owned subtree, BASE only)
 *   classes 0..1 ──▶ 1 class_resource (owned subtree, optional)
 *   classes 0..1 ──▶ 1 class_multiclass (owned subtree, BASE only)
 *   classes 1 ──▶ N class_subtypes (SUBCLASS only)
 *
 * Ownership:
 *   - class_details owns details rows via bridge trigger
 *   - class_proficiency_grants owns proficiency_grants via bridge trigger
 *   - class_features owns features via bridge trigger
 *   - classes.starting_equipment_id is owned FK (cleanup on delete/update)
 *   - class_spellcasting owns its charges via FK (cleanup on delete/update)
 *   - class_resource owns its charges via FK (cleanup on delete/update)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY,

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,

  category text NOT NULL, -- ClassCategoryCode (BASE|SUBCLASS)

  parent_class_id uuid
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  label text NOT NULL,
  description text,

  starting_equipment_id uuid
    REFERENCES public.starting_equipment(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,

  is_master boolean,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT classes_category_chk CHECK (
    category IN ('BASE', 'SUBCLASS')
  ),
  CONSTRAINT classes_category_parent_chk CHECK (
    (category = 'BASE' AND parent_class_id IS NULL AND starting_equipment_id IS NOT NULL)
    OR (category = 'SUBCLASS' AND parent_class_id IS NOT NULL AND starting_equipment_id IS NULL)
  )
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

SELECT public.apply_system_derived_policies('classes');

CREATE INDEX IF NOT EXISTS idx_classes_system
  ON public.classes(system_id);

CREATE INDEX IF NOT EXISTS idx_classes_parent
  ON public.classes(parent_class_id);

CREATE TABLE IF NOT EXISTS public.class_attributes (
  class_id uuid NOT NULL
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  attribute_code text NOT NULL,
  sort_order integer NOT NULL,

  PRIMARY KEY (class_id, attribute_code)
);

CREATE INDEX IF NOT EXISTS idx_class_attributes_class
  ON public.class_attributes(class_id);

ALTER TABLE public.class_attributes ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * CLASS — TRAITS (CODES)
 * ────────────────────────────────────────────── */

/* ──────────────────────────────────────────────
 * CLASS — DETAILS (OWNED)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_details (
  class_id uuid NOT NULL
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  detail_id uuid NOT NULL
    REFERENCES public.details(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  PRIMARY KEY (class_id, detail_id)
);

CREATE INDEX IF NOT EXISTS idx_class_details_class
  ON public.class_details(class_id);

ALTER TABLE public.class_details ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_class_details_owned'
      AND tgrelid = 'public.class_details'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_class_details_owned
    AFTER DELETE ON public.class_details
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.details",
      "columns": ["detail_id"]
    }]');
  END IF;
END;
$$;


/* ──────────────────────────────────────────────
 * CLASS — PROFICIENCY GRANTS (OWNED BRIDGE)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_proficiency_grants (
  class_id uuid NOT NULL
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  proficiency_grant_id uuid NOT NULL,

  sort_order integer NOT NULL,

  PRIMARY KEY (class_id, proficiency_grant_id)
);

ALTER TABLE public.class_proficiency_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_proficiency_grants_class
  ON public.class_proficiency_grants(class_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_class_proficiency_grants_owned'
      AND tgrelid = 'public.class_proficiency_grants'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_class_proficiency_grants_owned
    AFTER DELETE ON public.class_proficiency_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.proficiency_grants",
      "columns": ["proficiency_grant_id"]
    }]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
 * CLASS — FEATURES (OWNED BRIDGE)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_features (
  class_id uuid NOT NULL
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  feature_id uuid NOT NULL,

  sort_order integer NOT NULL,

  PRIMARY KEY (class_id, feature_id)
);

ALTER TABLE public.class_features ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_features_class
  ON public.class_features(class_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_class_features_owned'
      AND tgrelid = 'public.class_features'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_class_features_owned
    AFTER DELETE ON public.class_features
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.features",
      "columns": ["feature_id"]
    }]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
 * CLASS — HITPOINTS (BASE ONLY)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_hitpoints (
  class_id uuid PRIMARY KEY
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  ability_code text NOT NULL, -- AbilityCode
  die_config text NOT NULL
);

ALTER TABLE public.class_hitpoints ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * CLASS — STARTING GOLD (BASE ONLY)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_starting_gold (
  class_id uuid PRIMARY KEY
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  multiplier integer NOT NULL,
  currency_id uuid NOT NULL
    REFERENCES public.currencies(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,

  die_config text NOT NULL
);

ALTER TABLE public.class_starting_gold ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * OWNED FK CLEANUP: classes → starting_equipment
 *
 * Intent:
 *   starting_equipment_id is owned by the class.
 *   - On class delete: delete owned row.
 *   - On starting_equipment_id update/clear: delete old owned row.
 * ────────────────────────────────────────────── */

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_classes_starting_equipment_owned'
      AND tgrelid = 'public.classes'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_classes_starting_equipment_owned
    AFTER DELETE ON public.classes
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.starting_equipment",
      "columns": ["starting_equipment_id"]
    }]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_classes_starting_equipment_owned_on_update'
      AND tgrelid = 'public.classes'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_classes_starting_equipment_owned_on_update
    AFTER UPDATE OF starting_equipment_id ON public.classes
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[{
      "table": "public.starting_equipment",
      "columns": ["starting_equipment_id"]
    }]');
  END IF;
END;
$$;


/* ──────────────────────────────────────────────
 * CLASS — RESOURCES (OWNED, OPTIONAL)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  class_id uuid NOT NULL
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  label text NOT NULL,
  description text,
  available_at_level integer NOT NULL,

  charge_id uuid NOT NULL
    REFERENCES public.charges(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE public.class_resources ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_class_resources_class
  ON public.class_resources(class_id);

CREATE INDEX IF NOT EXISTS idx_class_resources_charge
  ON public.class_resources(charge_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_class_resources_charge_owned'
      AND tgrelid = 'public.class_resources'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_class_resources_charge_owned
    AFTER DELETE ON public.class_resources
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.charges",
      "columns": ["charge_id"]
    }]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_class_resources_charge_owned_on_update'
      AND tgrelid = 'public.class_resources'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_class_resources_charge_owned_on_update
    AFTER UPDATE OF charge_id ON public.class_resources
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[{
      "table": "public.charges",
      "columns": ["charge_id"]
    }]');
  END IF;
END;
$$;


/* ──────────────────────────────────────────────
 * CLASS — SPELLCASTING (OWNED SUBTREE, OPTIONAL)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_spellcasting (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  class_id uuid NOT NULL
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  magic_name text,
  ability_code text,         -- AbilityCode
  max_spell_level integer NOT NULL,

  charge_id uuid NOT NULL
    REFERENCES public.charges(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE public.class_spellcasting ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_class_spellcasting_class
  ON public.class_spellcasting(class_id);

CREATE INDEX IF NOT EXISTS idx_class_spellcasting_charge
  ON public.class_spellcasting(charge_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_class_spellcasting_charge_owned'
      AND tgrelid = 'public.class_spellcasting'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_class_spellcasting_charge_owned
    AFTER DELETE ON public.class_spellcasting
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.charges",
      "columns": ["charge_id"]
    }]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_class_spellcasting_charge_owned_on_update'
      AND tgrelid = 'public.class_spellcasting'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_class_spellcasting_charge_owned_on_update
    AFTER UPDATE OF charge_id ON public.class_spellcasting
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[{
      "table": "public.charges",
      "columns": ["charge_id"]
    }]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
 * SPELLCASTING — TRAITS (CODES)
 * ────────────────────────────────────────────── */

/* ──────────────────────────────────────────────
 * SPELLCASTING — PREPARE LIMIT
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_spellcasting_attributes (
  spellcasting_id uuid NOT NULL
    REFERENCES public.class_spellcasting(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  attribute_code text NOT NULL,
  sort_order integer NOT NULL,

  PRIMARY KEY (spellcasting_id, attribute_code)
);

ALTER TABLE public.class_spellcasting_attributes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_spellcasting_attributes_sc
  ON public.class_spellcasting_attributes(spellcasting_id);

CREATE TABLE IF NOT EXISTS public.class_spellcasting_prepare_limit (
  spellcasting_id uuid PRIMARY KEY
    REFERENCES public.class_spellcasting(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  scaling text,    -- ScalingAmountCode (optional)
  rounding text    -- RoundingCode (optional)
);

ALTER TABLE public.class_spellcasting_prepare_limit ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.class_spellcasting_prepare_limit_methods (
  spellcasting_id uuid NOT NULL
    REFERENCES public.class_spellcasting(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  method_code text NOT NULL, -- PrepareLimitMethodCode
  sort_order integer NOT NULL,

  PRIMARY KEY (spellcasting_id, method_code)
);

ALTER TABLE public.class_spellcasting_prepare_limit_methods ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_spellcasting_prepare_methods_sc
  ON public.class_spellcasting_prepare_limit_methods(spellcasting_id);

CREATE TABLE IF NOT EXISTS public.class_spellcasting_prepare_limit_levels (
  spellcasting_id uuid NOT NULL
    REFERENCES public.class_spellcasting(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  class_level integer NOT NULL,
  amount integer NOT NULL,

  PRIMARY KEY (spellcasting_id, class_level)
);

ALTER TABLE public.class_spellcasting_prepare_limit_levels ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_spellcasting_prepare_levels_sc
  ON public.class_spellcasting_prepare_limit_levels(spellcasting_id);


/* ──────────────────────────────────────────────
 * SPELLCASTING — SPELL LIMITS / SLOTS
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_spell_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  spellcasting_id uuid NOT NULL
    REFERENCES public.class_spellcasting(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  class_level integer NOT NULL,

  learned_spells_limit integer,
  prepared_spells_limit integer,
  cantrips_limit integer
);

ALTER TABLE public.class_spell_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_spell_limits_sc
  ON public.class_spell_limits(spellcasting_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_class_spell_limits_sc_level
  ON public.class_spell_limits(spellcasting_id, class_level);

CREATE TABLE IF NOT EXISTS public.class_spell_slots (
  spell_limit_id uuid NOT NULL
    REFERENCES public.class_spell_limits(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  spell_level integer NOT NULL,
  slot_count integer NOT NULL,

  PRIMARY KEY (spell_limit_id, spell_level)
);

ALTER TABLE public.class_spell_slots ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_spell_slots_limit
  ON public.class_spell_slots(spell_limit_id);


/* ──────────────────────────────────────────────
 * CLASS — MULTICLASS (OWNED SUBTREE, BASE ONLY)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_multiclass (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  class_id uuid NOT NULL
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE public.class_multiclass ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_class_multiclass_class
  ON public.class_multiclass(class_id);

CREATE TABLE IF NOT EXISTS public.class_multiclass_requirement_groups (
  id uuid PRIMARY KEY,

  multiclass_id uuid NOT NULL
    REFERENCES public.class_multiclass(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL
);

ALTER TABLE public.class_multiclass_requirement_groups ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_multiclass_req_groups_mc
  ON public.class_multiclass_requirement_groups(multiclass_id);

CREATE TABLE IF NOT EXISTS public.class_multiclass_requirements (
  id uuid PRIMARY KEY,

  requirement_group_id uuid NOT NULL
    REFERENCES public.class_multiclass_requirement_groups(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  ability_code text NOT NULL,
  min integer NOT NULL,
  sort_order integer NOT NULL
);

ALTER TABLE public.class_multiclass_requirements ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_multiclass_reqs_group
  ON public.class_multiclass_requirements(requirement_group_id);


/* ──────────────────────────────────────────────
 * MULTICLASS — PROFICIENCY GRANTS (OWNED BRIDGE)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_multiclass_proficiency_grants (
  multiclass_id uuid NOT NULL
    REFERENCES public.class_multiclass(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  proficiency_grant_id uuid NOT NULL,

  sort_order integer NOT NULL,

  PRIMARY KEY (multiclass_id, proficiency_grant_id)
);

ALTER TABLE public.class_multiclass_proficiency_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_multiclass_prof_grants_mc
  ON public.class_multiclass_proficiency_grants(multiclass_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_class_multiclass_proficiency_grants_owned'
      AND tgrelid = 'public.class_multiclass_proficiency_grants'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_class_multiclass_proficiency_grants_owned
    AFTER DELETE ON public.class_multiclass_proficiency_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.proficiency_grants",
      "columns": ["proficiency_grant_id"]
    }]');
  END IF;
END;
$$;


/* ──────────────────────────────────────────────
 * SUBCLASS — SUBTYPES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_subtypes (
  id uuid PRIMARY KEY,
  class_id uuid NOT NULL
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  label text NOT NULL,
  sort_order integer NOT NULL
);

ALTER TABLE public.class_subtypes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_subtypes_class
  ON public.class_subtypes(class_id);
