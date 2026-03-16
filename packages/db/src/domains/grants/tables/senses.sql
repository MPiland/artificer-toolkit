/* ──────────────────────────────────────────────
* SENSE GRANTS — ROOT
*
* Intent:
*   Authored grant that grants senses (ALL or SELECTED),
*   either directly or via per-level scaling.
*
* Cardinality:
*   systems 1 ──▶ N sense_grants
*
* Ownership:
*   sense_grants → sense_grant_restrictions (owned restrictions)
*   sense_grants → sense_grant_charges     (owned charges, optional 1:1)
*   sense_grants → sense_grant_senses      (sense references)
*   sense_grants → sense_grant_scaling_levels
*   sense_grant_scaling_levels → sense_grant_scaling_level_senses
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.sense_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order integer NOT NULL,
  selection_kind text NOT NULL, -- GRANTED | CHOSEN
  scaling_kind text NOT NULL, -- NONE | PER_LEVEL
  authoring_mode_kind text NOT NULL, -- ALL | SELECTED
  selection_count integer, -- CHOSEN + NONE only
  scaling_source text, -- SCALING_SOURCE (CHARACTER_LEVEL | CLASS_LEVEL | SPELL_CAST_LEVEL)
  class_id uuid,
  charge_id uuid REFERENCES public.charges (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  restriction_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sense_grants_root_sort_order_chk CHECK (
    sort_order > 0
  ),
  CONSTRAINT sense_grants_root_selection_kind_chk CHECK (
    selection_kind IN ('GRANTED', 'CHOSEN')
  ),
  CONSTRAINT sense_grants_root_scaling_kind_chk CHECK (
    scaling_kind IN ('NONE', 'PER_LEVEL')
  ),
  CONSTRAINT sense_grants_root_selection_count_chk CHECK (
    (scaling_kind <> 'NONE' AND selection_count IS NULL)
    OR (scaling_kind = 'NONE' AND selection_kind <> 'CHOSEN' AND selection_count IS NULL)
    OR (scaling_kind = 'NONE' AND selection_kind = 'CHOSEN' AND selection_count IS NOT NULL AND selection_count > 0)
  ),
  CONSTRAINT sense_grants_root_authoring_mode_chk CHECK (
    authoring_mode_kind IN ('ALL', 'SELECTED')
  ),
  CONSTRAINT sense_grants_root_scaling_source_chk CHECK (
    (scaling_kind = 'PER_LEVEL' AND scaling_source IN ('CHARACTER_LEVEL', 'CLASS_LEVEL', 'PARENT_CLASS_LEVEL', 'SPELL_CAST_LEVEL'))
    OR (scaling_kind = 'NONE' AND scaling_source IS NULL)
  ),
  CONSTRAINT sense_grants_root_scaling_class_chk CHECK (
    (scaling_source = 'CLASS_LEVEL' AND class_id IS NOT NULL)
    OR ((scaling_source IS NULL OR scaling_source <> 'CLASS_LEVEL') AND class_id IS NULL)
  ),
  CONSTRAINT sense_grants_root_mode_usage_chk CHECK (
    (scaling_kind = 'NONE' AND authoring_mode_kind IN ('ALL', 'SELECTED'))
    OR (scaling_kind = 'PER_LEVEL' AND authoring_mode_kind = 'ALL')
  )
);

ALTER TABLE public.sense_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_sense_grant_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_sense_grant_owned
    AFTER DELETE ON public.sense_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
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
    WHERE tgname = 'trg_cleanup_sense_grant_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_sense_grant_owned_on_update
    AFTER UPDATE ON public.sense_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* SENSE GRANT — ROOT PAYLOAD (SELECTED, NONE)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.sense_grant_senses (
  sense_grant_id uuid NOT NULL REFERENCES public.sense_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sense_id uuid NOT NULL REFERENCES public.senses (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (sense_grant_id, sense_id)
);

ALTER TABLE public.sense_grant_senses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sense_grant_senses_grant ON public.sense_grant_senses (sense_grant_id);

/* ──────────────────────────────────────────────
* SENSE GRANT — SCALING LEVELS
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.sense_grant_scaling_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sense_grant_id uuid NOT NULL REFERENCES public.sense_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  level integer NOT NULL,
  sort_order integer NOT NULL,
  authoring_mode_kind text NOT NULL, -- ALL | SELECTED
  selection_count integer, -- CHOSEN per-level
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sense_grant_scaling_levels_level_chk CHECK (
    level > 0
  ),
  CONSTRAINT sense_grant_scaling_levels_sort_order_chk CHECK (
    sort_order > 0
  ),
  CONSTRAINT sense_grant_scaling_levels_mode_chk CHECK (
    authoring_mode_kind IN ('ALL', 'SELECTED')
  ),
  CONSTRAINT sense_grant_scaling_levels_selection_count_chk CHECK (
    selection_count IS NULL OR selection_count > 0
  )
);

ALTER TABLE public.sense_grant_scaling_levels ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sense_grant_scaling_levels_grant ON public.sense_grant_scaling_levels (sense_grant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sense_grant_scaling_levels_grant_level
  ON public.sense_grant_scaling_levels (sense_grant_id, level);

/* ──────────────────────────────────────────────
* SENSE GRANT — SCALING LEVEL PAYLOAD
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.sense_grant_scaling_level_senses (
  scaling_level_id uuid NOT NULL REFERENCES public.sense_grant_scaling_levels (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sense_id uuid NOT NULL REFERENCES public.senses (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (scaling_level_id, sense_id)
);

ALTER TABLE public.sense_grant_scaling_level_senses ENABLE ROW LEVEL SECURITY;
