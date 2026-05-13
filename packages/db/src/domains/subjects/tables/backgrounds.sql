/* ──────────────────────────────────────────────
 * BACKGROUNDS — ROOT
 *
 * Intent:
 *   Background is a top-level authored subject that can grant
 *   proficiencies, features, starting equipment, and details.
 *
 * Cardinality:
 *   systems 1 ──▶ N backgrounds
 *
 * Ownership:
 *   backgrounds → details (owned via bridge)
 *   backgrounds → starting_equipment (owned 1:1 via FK)
 *   backgrounds → proficiency_grants (owned via bridge)
 *   backgrounds → features (owned via bridge)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.backgrounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,

  label text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'DRAFT',

  starting_equipment_id uuid
    REFERENCES public.starting_equipment(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,

  is_master boolean,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT backgrounds_status_chk CHECK (
    status IN ('DRAFT', 'ACTIVE')
  )
);

ALTER TABLE public.backgrounds ENABLE ROW LEVEL SECURITY;

SELECT public.apply_system_derived_policies('backgrounds');

CREATE INDEX IF NOT EXISTS idx_backgrounds_system
  ON public.backgrounds(system_id);

CREATE INDEX IF NOT EXISTS idx_backgrounds_user
  ON public.backgrounds(user_id);

CREATE INDEX IF NOT EXISTS idx_backgrounds_starting_equipment
  ON public.backgrounds(starting_equipment_id);

/* ──────────────────────────────────────────────
 * BACKGROUND — DETAILS (OWNED)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.background_details (
  background_id uuid NOT NULL
    REFERENCES public.backgrounds(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  detail_id uuid NOT NULL
    REFERENCES public.details(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  PRIMARY KEY (background_id, detail_id)
);

ALTER TABLE background_details ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_background_details_background
  ON public.background_details(background_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_background_details_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_background_details_owned
    AFTER DELETE ON public.background_details
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.details", "columns": ["detail_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
 * BACKGROUND — PROFICIENCY GRANTS (OWNED)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.background_proficiency_grants (
  background_id uuid NOT NULL
    REFERENCES public.backgrounds(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  proficiency_grant_id uuid NOT NULL,

  sort_order integer NOT NULL,

  PRIMARY KEY (background_id, proficiency_grant_id)
);

ALTER TABLE public.background_proficiency_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_background_proficiency_grants_background
  ON public.background_proficiency_grants(background_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_background_proficiency_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_background_proficiency_grants_owned
    AFTER DELETE ON public.background_proficiency_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.proficiency_grants", "columns": ["proficiency_grant_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
 * BACKGROUND — FEATURES (OWNED)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.background_features (
  background_id uuid NOT NULL
    REFERENCES public.backgrounds(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  feature_id uuid NOT NULL
    REFERENCES public.features(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  PRIMARY KEY (background_id, feature_id)
);

ALTER TABLE public.background_features ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_background_features_background
  ON public.background_features(background_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_background_features_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_background_features_owned
    AFTER DELETE ON public.background_features
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.features", "columns": ["feature_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
 * BACKGROUND → STARTING EQUIPMENT (OWNED)
 * ────────────────────────────────────────────── */

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_background_starting_equipment_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_background_starting_equipment_owned
    AFTER DELETE ON public.backgrounds
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.starting_equipment", "columns": ["starting_equipment_id"] }
    ]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_background_starting_equipment_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_background_starting_equipment_owned_on_update
    AFTER UPDATE OF starting_equipment_id ON public.backgrounds
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.starting_equipment", "columns": ["starting_equipment_id"] }
    ]');
  END IF;
END;
$$;
