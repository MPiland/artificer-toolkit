/* ──────────────────────────────────────────────
* SPELL GRANTS — ROOT
*
* Intent:
*   Authored grant that grants spells (ALL or SELECTED),
*   optionally scaled per level, optionally with filters
*   and optional charges.
*
* Cardinality:
*   systems 1 ──▶ N spell_grants
*
* Ownership:
*   spell_grants → spell_grant_restrictions
*   spell_grants → spell_grant_filters
*   spell_grants → spell_grant_charges
*   spell_grants → spell_grant_attributes
*   spell_grants → spell_grant_spells
*   spell_grants → spell_grant_scaling_levels
*   spell_grant_scaling_levels → spell_grant_scaling_level_spells
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.spell_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order integer NOT NULL,
  selection_kind text NOT NULL, -- GRANTED | CHOSEN
  scaling_kind text NOT NULL, -- NONE | PER_LEVEL
  authoring_mode_kind text NOT NULL, -- ALL | SELECTED
  selection_count integer, -- CHOSEN + NONE only
  selection_duplicate_policy text, -- CHOSEN + NONE only
  scaling_source text, -- ScalingSource (CHARACTER_LEVEL | CLASS_LEVEL | SPELL_CAST_LEVEL)
  class_id uuid,
  charge_id uuid REFERENCES public.charges (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  restriction_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  filter_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  cast_at_level integer, -- optional override
  casting_ability_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spell_grants_root_sort_order_chk CHECK (sort_order >= 0),
  CONSTRAINT spell_grants_root_selection_kind_chk CHECK (selection_kind IN ('GRANTED', 'CHOSEN')),
  CONSTRAINT spell_grants_root_scaling_kind_chk CHECK (scaling_kind IN ('NONE', 'PER_LEVEL')),
  CONSTRAINT spell_grants_root_selection_count_chk CHECK (
    (
      scaling_kind <> 'NONE'
      AND selection_count IS NULL
      AND selection_duplicate_policy IS NULL
    )
    OR (
      scaling_kind = 'NONE'
      AND selection_kind <> 'CHOSEN'
      AND selection_count IS NULL
      AND selection_duplicate_policy IS NULL
    )
    OR (
      scaling_kind = 'NONE'
      AND selection_kind = 'CHOSEN'
      AND selection_count IS NOT NULL
      AND selection_count > 0
      AND selection_duplicate_policy IN ('UNIQUE', 'REPEATABLE')
    )
  ),
  CONSTRAINT spell_grants_root_authoring_mode_chk CHECK (authoring_mode_kind IN ('ALL', 'SELECTED')),
  CONSTRAINT spell_grants_root_scaling_source_chk CHECK (
    (
      scaling_kind = 'PER_LEVEL'
      AND scaling_source IN (
        'CHARACTER_LEVEL',
        'CLASS_LEVEL',
        'PARENT_CLASS_LEVEL',
        'SPELL_CAST_LEVEL'
      )
    )
    OR (
      scaling_kind = 'NONE'
      AND scaling_source IS NULL
    )
  ),
  CONSTRAINT spell_grants_root_scaling_class_chk CHECK (
    (
      scaling_source = 'CLASS_LEVEL'
      AND class_id IS NOT NULL
    )
    OR (
      (
        scaling_source IS NULL
        OR scaling_source <> 'CLASS_LEVEL'
      )
      AND class_id IS NULL
    )
  ),
  CONSTRAINT spell_grants_root_mode_usage_chk CHECK (
    (
      scaling_kind = 'NONE'
      AND authoring_mode_kind IN ('ALL', 'SELECTED')
    )
    OR (
      scaling_kind = 'PER_LEVEL'
      AND authoring_mode_kind = 'ALL'
    )
  ),
  CONSTRAINT spell_grants_root_cast_at_level_chk CHECK (
    cast_at_level IS NULL
    OR cast_at_level > 0
  ),
  CONSTRAINT spell_grants_root_casting_ability_chk CHECK (
    casting_ability_code IS NULL
    OR casting_ability_code IN (
      'STRENGTH',
      'DEXTERITY',
      'CONSTITUTION',
      'INTELLIGENCE',
      'WISDOM',
      'CHARISMA'
    )
  )
);

ALTER TABLE public.spell_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_spell_grant_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_spell_grant_owned_on_update
    AFTER UPDATE ON public.spell_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id", "filter_id"] }
    ]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_spell_grant_restrictions_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_spell_grant_restrictions_owned
    AFTER DELETE ON public.spell_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id", "filter_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* SPELL GRANT — ATTRIBUTES
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.spell_grant_attributes (
  spell_grant_id uuid NOT NULL REFERENCES public.spell_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  attribute_code text NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (spell_grant_id, attribute_code),
  CONSTRAINT spell_grant_attributes_code_chk CHECK (
    attribute_code IN (
      'CONCENTRATION',
      'RITUAL',
      'LIMITED_USE',
      'PREPARED',
      'KNOWN',
      'CAST_AT_WILL',
      'CAST_AT_LEVEL',
      'SELF_ONLY'
    )
  ),
  CONSTRAINT spell_grant_attributes_sort_order_chk CHECK (sort_order >= 0)
);

ALTER TABLE public.spell_grant_attributes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_spell_grant_attributes_grant ON public.spell_grant_attributes (spell_grant_id);

/* ──────────────────────────────────────────────
* SPELL GRANT — ROOT PAYLOAD (NONE)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.spell_grant_spells (
  spell_grant_id uuid NOT NULL REFERENCES public.spell_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  spell_id uuid NOT NULL,
  PRIMARY KEY (spell_grant_id, spell_id)
);

ALTER TABLE public.spell_grant_spells ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_spell_grant_spells_grant ON public.spell_grant_spells (spell_grant_id);

/* ──────────────────────────────────────────────
* SPELL GRANT — SCALING LEVELS
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.spell_grant_scaling_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spell_grant_id uuid NOT NULL REFERENCES public.spell_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  level integer NOT NULL,
  sort_order integer NOT NULL,
  authoring_mode_kind text NOT NULL, -- ALL | SELECTED
  selection_count integer,
  selection_duplicate_policy text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spell_grant_scaling_levels_level_chk CHECK (level > 0),
  CONSTRAINT spell_grant_scaling_levels_sort_order_chk CHECK (sort_order >= 0),
  CONSTRAINT spell_grant_scaling_levels_mode_chk CHECK (authoring_mode_kind IN ('ALL', 'SELECTED')),
  CONSTRAINT spell_grant_scaling_levels_selection_count_chk CHECK (
    (
      selection_count IS NULL
      AND selection_duplicate_policy IS NULL
    )
    OR (
      selection_count IS NOT NULL
      AND selection_count > 0
      AND selection_duplicate_policy IN ('UNIQUE', 'REPEATABLE')
    )
  )
);

ALTER TABLE public.spell_grant_scaling_levels ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_spell_grant_scaling_levels_grant ON public.spell_grant_scaling_levels (spell_grant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_spell_grant_scaling_levels_grant_level ON public.spell_grant_scaling_levels (spell_grant_id, level);

/* ──────────────────────────────────────────────
* SPELL GRANT — SCALING LEVEL PAYLOAD
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.spell_grant_scaling_level_spells (
  scaling_level_id uuid NOT NULL REFERENCES public.spell_grant_scaling_levels (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  spell_id uuid NOT NULL,
  PRIMARY KEY (scaling_level_id, spell_id)
);

ALTER TABLE public.spell_grant_scaling_level_spells ENABLE ROW LEVEL SECURITY;
