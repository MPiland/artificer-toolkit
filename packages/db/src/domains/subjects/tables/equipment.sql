/*************************************************
* EQUIPMENT — AUTHORING STRUCTURE
*************************************************/
/* ──────────────────────────────────────────────
* EQUIPMENT — ROOT
*
* Intent:
*   Top-level equipment definition. May be a base
*   item or a variant container.
*
* Cardinality:
*   systems 1 ──▶ N equipment
*
* Ownership:
*   equipment → charges (owned FK)
*   equipment → effects (owned via bridge)
*   equipment → modifiers (owned via bridge)
*   equipment → restrictions (owned via bridge)
*   equipment → features (owned via bridge)
*   equipment → contains (owned rows)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.equipment (
  id uuid PRIMARY KEY,
  system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  label text NOT NULL,
  description text,
  quote text,
  category text NOT NULL, -- EquipmentCategoryCode
  rarity_id uuid NOT NULL REFERENCES public.rarities (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  cost_amount integer NOT NULL,
  cost_currency_id uuid NOT NULL REFERENCES public.currencies (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  weight_amount numeric NOT NULL,
  weight_unit text NOT NULL,
  capacity_amount numeric,
  capacity_unit text NOT NULL,
  max_stack integer,
  max_bonus integer,
  armor_class integer,
  charge_id uuid REFERENCES public.charges (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  restriction_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  -- VARIANT only: links to parent equipment definition
  parent_equipment_id uuid REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  is_master boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

SELECT
  public.apply_system_derived_policies ('equipment');

CREATE INDEX IF NOT EXISTS idx_equipment_system ON public.equipment (system_id);

CREATE INDEX IF NOT EXISTS idx_equipment_parent ON public.equipment (parent_equipment_id);

CREATE TABLE IF NOT EXISTS public.equipment_attributes (
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  attribute_code text NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (equipment_id, attribute_code)
);

ALTER TABLE public.equipment_attributes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_equipment_attributes_equipment ON public.equipment_attributes (equipment_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_equipment_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_equipment_owned_on_update
    AFTER UPDATE ON public.equipment
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_equipment_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_equipment_owned
    AFTER DELETE ON public.equipment
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* EQUIPMENT — TRAITS
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.equipment_traits (
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  trait_code text NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (equipment_id, trait_code)
);

ALTER TABLE public.equipment_traits ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
* EQUIPMENT — PROPERTIES
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.equipment_properties (
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  property_code text NOT NULL,
  PRIMARY KEY (equipment_id, property_code)
);

ALTER TABLE public.equipment_properties ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
* EQUIPMENT — ABILITIES
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.equipment_abilities (
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  operation text NOT NULL, -- EquipmentAbilityOperation
  ability_code text NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (equipment_id, operation, ability_code)
);

ALTER TABLE public.equipment_abilities ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
* EQUIPMENT — SPEED
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.equipment_speed (
  equipment_id uuid PRIMARY KEY REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  amount numeric NOT NULL,
  unit_code text NOT NULL
);

ALTER TABLE public.equipment_speed ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
* EQUIPMENT — CONTAINS
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.equipment_contains (
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  contained_equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  quantity integer NOT NULL,
  PRIMARY KEY (equipment_id, contained_equipment_id)
);

ALTER TABLE public.equipment_contains ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
* EQUIPMENT — EFFECTS (OWNED)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.equipment_effects (
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  effect_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (equipment_id, effect_id)
);

ALTER TABLE public.equipment_effects ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_equipment_effects_equipment ON public.equipment_effects (equipment_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_equipment_effects_owned'
      AND tgrelid = 'public.equipment_effects'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_equipment_effects_owned
    AFTER DELETE ON public.equipment_effects
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.effects", "columns": ["effect_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* EQUIPMENT — MODIFIER GRANTS (OWNED)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.equipment_modifier_grants (
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  modifier_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (equipment_id, modifier_grant_id)
);

ALTER TABLE public.equipment_modifier_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_equipment_modifier_grants_equipment ON public.equipment_modifier_grants (equipment_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_equipment_modifier_grants_owned'
      AND tgrelid = 'public.equipment_modifier_grants'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_equipment_modifier_grants_owned
    AFTER DELETE ON public.equipment_modifier_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.modifier_grants", "columns": ["modifier_grant_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* EQUIPMENT — FEATURES (OWNED)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.equipment_features (
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  feature_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (equipment_id, feature_id)
);

ALTER TABLE public.equipment_features ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_equipment_features_equipment ON public.equipment_features (equipment_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_equipment_features_owned'
      AND tgrelid = 'public.equipment_features'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_equipment_features_owned
    AFTER DELETE ON public.equipment_features
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.features", "columns": ["feature_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* OWNED CHILD CLEANUP: equipment → charges
*
* Intent:
*   charge_id is an owned FK. When equipment is deleted,
*   delete the owned charge row.
*
*   When charge_id changes (or is cleared), delete the
*   old owned charge row.
* ────────────────────────────────────────────── */
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_equipment_charge_owned'
      AND tgrelid = 'public.equipment'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_equipment_charge_owned
    AFTER DELETE ON public.equipment
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.charges", "columns": ["charge_id"] }
    ]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_equipment_charge_owned_on_update'
      AND tgrelid = 'public.equipment'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_equipment_charge_owned_on_update
    AFTER UPDATE OF charge_id ON public.equipment
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.charges", "columns": ["charge_id"] }
    ]');
  END IF;
END;
$$;
