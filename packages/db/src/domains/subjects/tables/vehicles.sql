/* ──────────────────────────────────────────────
* VEHICLES — ROOT
*
* Intent:
*   DM-facing reference records for land, water,
*   air, and spelljamming vehicles.
*
* Cardinality:
*   systems 1 ──▶ N vehicles
*
* Ownership:
*   vehicles → details (owned)
*   vehicles → features (owned via bridge)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY,
  system_id uuid NOT NULL REFERENCES public.systems (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  content_source_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  label text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'DRAFT',
  category text NOT NULL,
  size_code text,
  armor_class INTEGER,
  hit_points INTEGER,
  speed NUMERIC,
  speed_note text,
  crew_min INTEGER,
  crew_max INTEGER,
  passenger_capacity INTEGER,
  cargo_capacity text,
  weight_amount NUMERIC,
  weight_unit text,
  cost jsonb,
  properties text[],
  is_master BOOLEAN,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicles_category_chk
    CHECK (category IN ('LAND', 'WATER', 'AIR', 'SPELLJAMMER')),
  CONSTRAINT vehicles_status_chk CHECK (status IN ('DRAFT', 'ACTIVE')),
  CONSTRAINT vehicles_weight_chk
    CHECK (
      (weight_amount IS NULL AND weight_unit IS NULL)
      OR (weight_amount IS NOT NULL AND weight_unit IS NOT NULL)
    )
);

ALTER TABLE public.vehicles
ADD CONSTRAINT vehicles_content_source_system_fk
  FOREIGN KEY (content_source_id, system_id) REFERENCES public.content_sources (
    id,
    game_system_id
  )
    ON DELETE RESTRICT;

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

SELECT
  public.apply_system_derived_policies('vehicles');

CREATE INDEX IF NOT EXISTS idx_vehicles_system ON public.vehicles (system_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_category ON public.vehicles (category);

/* ──────────────────────────────────────────────
* VEHICLE — DETAILS (OWNED)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.vehicle_details (
  vehicle_id uuid NOT NULL REFERENCES public.vehicles (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  detail_id uuid NOT NULL REFERENCES public.details (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (vehicle_id, detail_id)
);

ALTER TABLE public.vehicle_details ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_vehicle_details_vehicle ON public.vehicle_details (
  vehicle_id
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_vehicle_details_owned'
      AND tgrelid = 'public.vehicle_details'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_vehicle_details_owned
    AFTER DELETE ON public.vehicle_details
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.details", "columns": ["detail_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* VEHICLE — FEATURES (OWNED)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.vehicle_features (
  vehicle_id uuid NOT NULL REFERENCES public.vehicles (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  feature_id uuid NOT NULL REFERENCES public.features (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (vehicle_id, feature_id)
);

ALTER TABLE public.vehicle_features ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_vehicle_features_vehicle ON public.vehicle_features (
  vehicle_id
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_vehicle_features_owned'
      AND tgrelid = 'public.vehicle_features'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_vehicle_features_owned
    AFTER DELETE ON public.vehicle_features
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.features", "columns": ["feature_id"] }
    ]');
  END IF;
END;
$$;
