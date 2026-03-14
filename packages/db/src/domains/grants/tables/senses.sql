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
*   sense_grants → sense_grant_traits      (trait codes)
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
  scaling_source text, -- SCALING_SOURCE
  class_id uuid,
  spell_id uuid,
  charge_id uuid NOT NULL REFERENCES public.charges (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  restriction_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
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
* SENSE GRANT — TRAITS (CODES)
*
* Intent:
*   Authoring traits applied to the grant.
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.sense_grant_traits (
  sense_grant_id uuid NOT NULL REFERENCES public.sense_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  trait_code text NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (sense_grant_id, trait_code)
);

ALTER TABLE public.sense_grant_traits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sense_grant_traits_grant ON public.sense_grant_traits (sense_grant_id);

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
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sense_grant_scaling_levels ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sense_grant_scaling_levels_grant ON public.sense_grant_scaling_levels (sense_grant_id);

/* ──────────────────────────────────────────────
* SENSE GRANT — SCALING LEVEL PAYLOAD
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.sense_grant_scaling_level_senses (
  scaling_level_id uuid NOT NULL REFERENCES public.sense_grant_scaling_levels (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sense_id uuid NOT NULL REFERENCES public.senses (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (scaling_level_id, sense_id)
);

ALTER TABLE public.sense_grant_scaling_level_senses ENABLE ROW LEVEL SECURITY;
