/* ──────────────────────────────────────────────
 * ROOT
 *
 * Intent:
 *   Represents the authored starting equipment
 *   definition for a system.
 *
 * Cardinality:
 *   systems 1 ──▶ 1 starting_equipment
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.starting_equipment (
  id uuid PRIMARY KEY,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.starting_equipment ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * SETS
 *
 * Intent:
 *   Top-level alternative sets of starting equipment.
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.starting_equipment_sets (
  id uuid PRIMARY KEY,
  starting_equipment_id uuid NOT NULL
    REFERENCES public.starting_equipment(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_starting_equipment_sets_parent
  ON public.starting_equipment_sets(starting_equipment_id);

ALTER TABLE public.starting_equipment_sets ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * GROUPS
 *
 * Intent:
 *   Mutually-exclusive choice groups inside a set.
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.starting_equipment_groups (
  id uuid PRIMARY KEY,
  equipment_set_id uuid NOT NULL
    REFERENCES public.starting_equipment_sets(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_starting_equipment_groups_set
  ON public.starting_equipment_groups(equipment_set_id);

ALTER TABLE public.starting_equipment_groups ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * OPTIONS
 *
 * Intent:
 *   Individual selectable options within a group.
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.starting_equipment_options (
  id uuid PRIMARY KEY,
  equipment_group_id uuid NOT NULL
    REFERENCES public.starting_equipment_groups(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_starting_equipment_options_group
  ON public.starting_equipment_options(equipment_group_id);

ALTER TABLE public.starting_equipment_options ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * OPTION ITEMS
 *
 * Intent:
 *   Concrete equipment or currency payloads.
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.starting_equipment_option_items (
  id uuid PRIMARY KEY,
  equipment_option_id uuid NOT NULL
    REFERENCES public.starting_equipment_options(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  starting_equipment_kind text NOT NULL,          -- EQUIPMENT | CURRENCY
  authoring_mode_kind text,                        -- ALL | SELECTED (EQUIPMENT only)
  selection_kind text,              -- CHOSEN | GRANTED (EQUIPMENT only)

  category_code text,                    -- EquipmentCategoryCode
  count integer,                    -- CHOSEN
  quantity integer,                 -- GRANTED

  sort_order integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_starting_equipment_option_items_option
  ON public.starting_equipment_option_items(equipment_option_id);

ALTER TABLE public.starting_equipment_option_items ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * OPTION ITEM → EQUIPMENT IDS
 * (mode = SELECTED only)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.starting_equipment_option_item_equipment (
  option_item_id uuid NOT NULL
    REFERENCES public.starting_equipment_option_items(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  -- Deferred FK added in bootstrap/constraints/cross_domain_foreign_keys.sql
  equipment_id uuid NOT NULL,

  PRIMARY KEY (option_item_id, equipment_id)
);

ALTER TABLE public.starting_equipment_option_item_equipment ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * OPTION ITEM → PROPERTIES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.starting_equipment_option_item_properties (
  option_item_id uuid NOT NULL
    REFERENCES public.starting_equipment_option_items(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  property_code text NOT NULL,

  PRIMARY KEY (option_item_id, property_code)
);

ALTER TABLE public.starting_equipment_option_item_properties ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * OPTION ITEM → CURRENCY
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.starting_equipment_currencies (
  option_item_id uuid NOT NULL
    REFERENCES public.starting_equipment_option_items(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  currency_id uuid NOT NULL REFERENCES public.currencies(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  amount integer NOT NULL,

  PRIMARY KEY (option_item_id, currency_id)
);

ALTER TABLE public.starting_equipment_currencies ENABLE ROW LEVEL SECURITY;
