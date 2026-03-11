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
*   spell_grants → spell_grant_traits
*   spell_grants → spell_grant_restrictions
*   spell_grants → spell_grant_filters
*   spell_grants → spell_grant_charges
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
  scaling_source text, -- ScalingSource
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  spell_id uuid REFERENCES public.spells (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  charge_id uuid NOT NULL REFERENCES public.charges (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  restriction_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  filter_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  cast_at_level integer, -- optional override
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.spell_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_spell_grant_wned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_spell_grant_wned_on_update
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
* SPELL GRANT — TRAITS (CODES)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.spell_grant_traits (
  spell_grant_id uuid NOT NULL REFERENCES public.spell_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  trait_code text NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (spell_grant_id, trait_code)
);

ALTER TABLE public.spell_grant_traits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_spell_grant_traits_grant ON public.spell_grant_traits (spell_grant_id);

/* ──────────────────────────────────────────────
* SPELL GRANT — ROOT PAYLOAD (NONE)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.spell_grant_spells (
  spell_grant_id uuid NOT NULL REFERENCES public.spell_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.spell_grant_scaling_levels ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_spell_grant_scaling_levels_grant ON public.spell_grant_scaling_levels (spell_grant_id);

/* ──────────────────────────────────────────────
* SPELL GRANT — SCALING LEVEL PAYLOAD
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.spell_grant_scaling_level_spells (
  scaling_level_id uuid NOT NULL REFERENCES public.spell_grant_scaling_levels (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (scaling_level_id, spell_id)
);

ALTER TABLE public.spell_grant_scaling_level_spells ENABLE ROW LEVEL SECURITY;