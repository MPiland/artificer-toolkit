/* ──────────────────────────────────────────────
 * RACES — ROOT
 *
 * Intent:
 *   Top-level race definition. Can represent a
 *   base race or a subrace.
 *
 * Cardinality:
 *   systems 1 ──▶ N races
 *
 * Ownership:
 *   races → details (owned)
 *   races → features (owned via bridge)
 *   races → speeds (owned)
 *   races → ancestry (owned subtree, BASE only)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.races (
  id uuid PRIMARY KEY,
  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  user_id uuid REFERENCES auth.users(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  label text NOT NULL,
  quote text,
  description text,
  status text NOT NULL DEFAULT 'DRAFT',

  category text NOT NULL,              -- RaceCategoryCode
  selection_mode text,                 -- BASE only (DIRECT | REQUIRES_SUBRACE)

  parent_race_id uuid                  -- SUBRACE only
    REFERENCES public.races(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  is_master boolean,

  size_code text,                      -- SizeCode
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT races_category_chk CHECK (
    category IN ('BASE', 'SUBRACE')
  ),
  CONSTRAINT races_selection_mode_chk CHECK (
    selection_mode IN ('DIRECT', 'REQUIRES_SUBRACE') OR selection_mode IS NULL
  ),
  CONSTRAINT races_category_payload_chk CHECK (
    (category = 'BASE' AND parent_race_id IS NULL AND selection_mode IS NOT NULL AND size_code IS NOT NULL)
    OR (category = 'SUBRACE' AND parent_race_id IS NOT NULL AND selection_mode IS NULL AND size_code IS NULL)
  ),
  CONSTRAINT races_status_chk CHECK (
    status IN ('DRAFT', 'ACTIVE')
  )
);

ALTER TABLE public.races ENABLE ROW LEVEL SECURITY;

SELECT public.apply_system_derived_policies('races');

CREATE INDEX IF NOT EXISTS idx_races_system
  ON public.races(system_id);

CREATE INDEX IF NOT EXISTS idx_races_parent
  ON public.races(parent_race_id);



/* ──────────────────────────────────────────────
 * RACE — DETAILS (OWNED)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.race_details (
  race_id uuid NOT NULL
    REFERENCES public.races(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  detail_id uuid NOT NULL
    REFERENCES public.details(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  PRIMARY KEY (race_id, detail_id)
);

ALTER TABLE public.race_details ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_race_details_race
  ON public.race_details(race_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_race_details_owned'
      AND tgrelid = 'public.race_details'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_race_details_owned
    AFTER DELETE ON public.race_details
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.details", "columns": ["detail_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
 * RACE — FEATURES (OWNED)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.race_features (
  race_id uuid NOT NULL
    REFERENCES public.races(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  feature_id uuid NOT NULL,

  sort_order integer NOT NULL,

  PRIMARY KEY (race_id, feature_id)
);

ALTER TABLE public.race_features ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_race_features_race
  ON public.race_features(race_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_race_features_owned'
      AND tgrelid = 'public.race_features'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_race_features_owned
    AFTER DELETE ON public.race_features
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.features", "columns": ["feature_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
 * RACE — SPEEDS (OWNED)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.race_speeds (
  race_id uuid NOT NULL
    REFERENCES public.races(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  speed_id uuid NOT NULL REFERENCES public.speeds(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  amount integer NOT NULL,
  unit_code text NOT NULL,

  PRIMARY KEY (race_id, speed_id)
);

ALTER TABLE public.race_speeds ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_race_speeds_race
  ON public.race_speeds(race_id);

CREATE TABLE IF NOT EXISTS public.race_heritages (
  race_id uuid NOT NULL
    REFERENCES public.races(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  heritage_id uuid NOT NULL
    REFERENCES public.heritages(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  PRIMARY KEY (race_id, heritage_id)
);

ALTER TABLE public.race_heritages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_race_heritages_race
  ON public.race_heritages(race_id);

/* ──────────────────────────────────────────────
 * RACE — ANCESTRY (BASE ONLY)
 *
 * Intent:
 *   Optional ancestry container for base races.
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.race_ancestries (
  id uuid PRIMARY KEY,
  race_id uuid NOT NULL
    REFERENCES public.races(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  label text NOT NULL,
  description text
);

ALTER TABLE public.race_ancestries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_race_ancestries_race
  ON public.race_ancestries(race_id);

/* ──────────────────────────────────────────────
 * RACE — ANCESTRY OPTIONS (OWNED)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.race_ancestry_options (
  id uuid PRIMARY KEY,
  ancestry_id uuid NOT NULL
    REFERENCES public.race_ancestries(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  label text NOT NULL,
  description text,
  sort_order integer NOT NULL
);

ALTER TABLE public.race_ancestry_options ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_race_ancestry_options_ancestry
  ON public.race_ancestry_options(ancestry_id);

/* ──────────────────────────────────────────────
 * RACE — ANCESTRY OPTION FEATURES (OWNED)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.race_ancestry_option_features (
  ancestry_option_id uuid NOT NULL
    REFERENCES public.race_ancestry_options(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  feature_id uuid NOT NULL,

  sort_order integer NOT NULL,

  PRIMARY KEY (ancestry_option_id, feature_id)
);

ALTER TABLE public.race_ancestry_option_features ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_race_ancestry_option_features_option
  ON public.race_ancestry_option_features(ancestry_option_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_race_ancestry_option_features_owned'
      AND tgrelid = 'public.race_ancestry_option_features'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_race_ancestry_option_features_owned
    AFTER DELETE ON public.race_ancestry_option_features
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.features", "columns": ["feature_id"] }
    ]');
  END IF;
END;
$$;
