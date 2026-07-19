/* ──────────────────────────────────────────────
* FEAT GRANTS — ROOT
*
* Intent:
*   Authored grant that grants feats (ALL or SELECTED),
*   either directly or via per-level scaling.
*
* Cardinality:
*   systems 1 ──▶ N feat_grants
*
* Ownership:
*   feat_grants → feat_grant_charges     (owned rows in public.charges)
*   feat_grants → feat_grant_feats       (references feats; not owned entities)
*   feat_grants → feat_grant_scaling_levels
*   feat_grant_scaling_levels → feat_grant_scaling_level_feats
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feat_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  /* base authored fields */
  sort_order integer NOT NULL,
  /* scaling discriminators */
  selection_kind text NOT NULL, -- AuthoringSelectionType (GRANTED | CHOSEN)
  scaling_kind text NOT NULL, -- ScalingType (NONE | PER_LEVEL)
  /* payload discriminator */
  authoring_mode_kind text NOT NULL, -- ALL | SELECTED
  /* CHOSEN (scaling NONE) only */
  selection_count integer, -- payload.count when CHOSEN + scaling NONE
  selection_duplicate_policy text, -- CHOSEN + NONE only
  /* PER_LEVEL scaling source (only relevant when scaling_kind = PER_LEVEL) */
  scaling_source text, -- ScalingSource (CHARACTER_LEVEL | CLASS_LEVEL | SPELL_CAST_LEVEL)
  class_id uuid, -- CLASS_LEVEL
  charge_id uuid REFERENCES public.charges (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  restriction_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feat_grants_root_sort_order_chk CHECK (
    sort_order >= 0
  ),
  CONSTRAINT feat_grants_root_selection_kind_chk CHECK (
    selection_kind IN ('GRANTED', 'CHOSEN')
  ),
  CONSTRAINT feat_grants_root_scaling_kind_chk CHECK (
    scaling_kind IN ('NONE', 'PER_LEVEL')
  ),
  CONSTRAINT feat_grants_root_selection_count_chk CHECK (
    (scaling_kind <> 'NONE' AND selection_count IS NULL AND selection_duplicate_policy IS NULL)
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
  CONSTRAINT feat_grants_root_authoring_mode_chk CHECK (
    authoring_mode_kind IN ('ALL', 'SELECTED')
  ),
  CONSTRAINT feat_grants_root_scaling_source_chk CHECK (
    (scaling_kind = 'PER_LEVEL' AND scaling_source IN ('CHARACTER_LEVEL', 'CLASS_LEVEL', 'PARENT_CLASS_LEVEL', 'SPELL_CAST_LEVEL'))
    OR (scaling_kind = 'NONE' AND scaling_source IS NULL)
  ),
  CONSTRAINT feat_grants_root_scaling_class_chk CHECK (
    (scaling_source = 'CLASS_LEVEL' AND class_id IS NOT NULL)
    OR ((scaling_source IS NULL OR scaling_source <> 'CLASS_LEVEL') AND class_id IS NULL)
  ),
  CONSTRAINT feat_grants_root_mode_usage_chk CHECK (
    (scaling_kind = 'NONE' AND authoring_mode_kind IN ('ALL', 'SELECTED'))
    OR (scaling_kind = 'PER_LEVEL' AND authoring_mode_kind = 'ALL')
  )
);

ALTER TABLE public.feat_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feat_grant_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_feat_grant_owned_on_update
    AFTER UPDATE ON public.feat_grants
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
    WHERE tgname = 'trg_cleanup_feat_grant_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feat_grant_owned
    AFTER DELETE ON public.feat_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* FEAT GRANT — FEATS (ROOT PAYLOAD, SELECTED ONLY)
*
* Intent:
*   Stores payload.featIds when authoring_mode_kind = SELECTED
*   AND scaling_kind = NONE (root payload).
*
* Cardinality:
*   feat_grants 1 ──▶ N feats
*
* Ownership:
*   rows are owned by feat_grants, feats are not owned.
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feat_grant_feats (
  feat_grant_id uuid NOT NULL REFERENCES public.feat_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  feat_id uuid NOT NULL,
  PRIMARY KEY (feat_grant_id, feat_id)
);

ALTER TABLE public.feat_grant_feats ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feat_grant_feats_grant ON public.feat_grant_feats (feat_grant_id);

CREATE INDEX IF NOT EXISTS idx_feat_grant_feats_feat ON public.feat_grant_feats (feat_id);

/* ──────────────────────────────────────────────
* FEAT GRANT — SCALING LEVELS (PER_LEVEL)
*
* Intent:
*   Stores scaling.levels[] rows.
*   Each level stores its own payload mode and optional count (CHOSEN).
*
* Cardinality:
*   feat_grants 1 ──▶ N scaling levels
*
* Ownership:
*   owned by feat_grants.
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feat_grant_scaling_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feat_grant_id uuid NOT NULL REFERENCES public.feat_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  level integer NOT NULL,
  sort_order integer NOT NULL,
  authoring_mode_kind text NOT NULL, -- ALL | SELECTED (per-level payload)
  selection_count integer, -- value.count when selection_kind = CHOSEN (per-level)
  selection_duplicate_policy text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feat_grant_scaling_levels_level_chk CHECK (
    level > 0
  ),
  CONSTRAINT feat_grant_scaling_levels_sort_order_chk CHECK (
    sort_order >= 0
  ),
  CONSTRAINT feat_grant_scaling_levels_mode_chk CHECK (
    authoring_mode_kind IN ('ALL', 'SELECTED')
  ),
  CONSTRAINT feat_grant_scaling_levels_selection_count_chk CHECK (
    (selection_count IS NULL AND selection_duplicate_policy IS NULL)
    OR (
      selection_count IS NOT NULL
      AND selection_count > 0
      AND selection_duplicate_policy IN ('UNIQUE', 'REPEATABLE')
    )
  )
);

ALTER TABLE public.feat_grant_scaling_levels ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feat_grant_scaling_levels_grant ON public.feat_grant_scaling_levels (feat_grant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_feat_grant_scaling_levels_grant_level
  ON public.feat_grant_scaling_levels (feat_grant_id, level);

/* ──────────────────────────────────────────────
* FEAT GRANT — SCALING LEVEL FEATS (SELECTED ONLY)
*
* Intent:
*   Stores level.value.featIds when authoring_mode_kind = SELECTED
*   for a given scaling level.
*
* Cardinality:
*   scaling_levels 1 ──▶ N feats
*
* Ownership:
*   rows owned by scaling_levels, feats are not owned.
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feat_grant_scaling_level_feats (
  scaling_level_id uuid NOT NULL REFERENCES public.feat_grant_scaling_levels (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  feat_id uuid NOT NULL,
  PRIMARY KEY (scaling_level_id, feat_id)
);

ALTER TABLE public.feat_grant_scaling_level_feats ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feat_grant_scaling_level_feats_level ON public.feat_grant_scaling_level_feats (scaling_level_id);
