/* ──────────────────────────────────────────────
 * PHASE 7.5 SUBJECTS
 *
 * Adds the remaining DM-facing subject schema:
 * - challenge_ratings
 * - creature_types
 * - creatures + owned tables
 * - vehicles + owned tables
 * ────────────────────────────────────────────── */

SET LOCAL search_path = public, pg_catalog;
SET CONSTRAINTS ALL DEFERRED;

CREATE OR REPLACE FUNCTION public.apply_updated_at_triggers (p_schema text DEFAULT 'public')
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  r RECORD;
  v_trigger_name text;
BEGIN
  FOR r IN (
    SELECT
      c.oid                          AS table_oid,
      n.nspname                      AS schema_name,
      c.relname                      AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = p_schema
      AND c.relkind = 'r'
      AND c.relpersistence = 'p'
      AND EXISTS (
        SELECT 1
        FROM pg_attribute a
        WHERE a.attrelid = c.oid
        AND a.attname = 'updated_at'
        AND a.attnum > 0
        AND NOT a.attisdropped
      )
  )
  LOOP
    v_trigger_name := left(
      'trg_' || r.schema_name || '_' || r.table_name || '_set_updated_at',
      63
    );

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgrelid = r.table_oid
        AND tgname = v_trigger_name
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I
         BEFORE UPDATE ON %I.%I
         FOR EACH ROW
         EXECUTE FUNCTION public.set_updated_at()',
        v_trigger_name,
        r.schema_name,
        r.table_name
      );
    END IF;
  END LOOP;
END;
$$;

/* ──────────────────────────────────────────────
 * CHALLENGE RATINGS
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.challenge_ratings (
  id uuid PRIMARY KEY,

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  code text NOT NULL,
  label text NOT NULL,
  description text,
  tooltip text,
  short text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.challenge_ratings ENABLE ROW LEVEL SECURITY;
SELECT public.apply_system_vocabulary_policies('challenge_ratings');

CREATE UNIQUE INDEX IF NOT EXISTS uq_challenge_ratings_system_code
  ON public.challenge_ratings(system_id, code);

CREATE INDEX IF NOT EXISTS idx_challenge_ratings_system
  ON public.challenge_ratings(system_id);


/* ──────────────────────────────────────────────
 * CREATURE TYPES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.creature_types (
  id uuid PRIMARY KEY,

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  code text NOT NULL,
  label text NOT NULL,
  description text,
  tooltip text,
  short text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.creature_types ENABLE ROW LEVEL SECURITY;
SELECT public.apply_system_vocabulary_policies('creature_types');

CREATE UNIQUE INDEX IF NOT EXISTS uq_creature_types_system_code
  ON public.creature_types(system_id, code);

CREATE INDEX IF NOT EXISTS idx_creature_types_system
  ON public.creature_types(system_id);


/* ──────────────────────────────────────────────
 * CREATURES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.creatures (
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

  category text NOT NULL,
  creature_type_id uuid
    REFERENCES public.creature_types(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,
  size_code text NOT NULL,
  alignment_id uuid
    REFERENCES public.alignments(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,
  tags text[],

  ability_scores jsonb NOT NULL,
  armor_class integer NOT NULL,
  armor_class_note text,
  hit_points integer NOT NULL,
  hit_dice text,

  senses text[],
  passive_perception integer,
  saving_throw_proficiencies text[],
  skill_proficiencies text[],
  languages text[],
  challenge_rating_id uuid
    REFERENCES public.challenge_ratings(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,
  xp integer,

  mount_profile jsonb,
  companion_profile jsonb,
  npc_profile jsonb,

  is_master boolean,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT creatures_category_chk CHECK (
    category IN ('NPC', 'MONSTER', 'BEAST', 'COMPANION', 'SUMMON')
  )
);

ALTER TABLE public.creatures ENABLE ROW LEVEL SECURITY;
SELECT public.apply_system_derived_policies('creatures');

CREATE INDEX IF NOT EXISTS idx_creatures_system
  ON public.creatures(system_id);

CREATE INDEX IF NOT EXISTS idx_creatures_category
  ON public.creatures(category);

CREATE INDEX IF NOT EXISTS idx_creatures_creature_type
  ON public.creatures(creature_type_id);

CREATE TABLE IF NOT EXISTS public.creature_details (
  creature_id uuid NOT NULL
    REFERENCES public.creatures(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  detail_id uuid NOT NULL
    REFERENCES public.details(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  PRIMARY KEY (creature_id, detail_id)
);

ALTER TABLE public.creature_details ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_creature_details_creature
  ON public.creature_details(creature_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_creature_details_owned'
      AND tgrelid = 'public.creature_details'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_creature_details_owned
    AFTER DELETE ON public.creature_details
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.details", "columns": ["detail_id"] }
    ]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.creature_features (
  creature_id uuid NOT NULL
    REFERENCES public.creatures(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  feature_id uuid NOT NULL,
  sort_order integer NOT NULL,

  PRIMARY KEY (creature_id, feature_id)
);

ALTER TABLE public.creature_features ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_creature_features_creature
  ON public.creature_features(creature_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_creature_features_owned'
      AND tgrelid = 'public.creature_features'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_creature_features_owned
    AFTER DELETE ON public.creature_features
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.features", "columns": ["feature_id"] }
    ]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.creature_speeds (
  creature_id uuid NOT NULL
    REFERENCES public.creatures(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  speed_id uuid NOT NULL
    REFERENCES public.speeds(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  amount integer NOT NULL,
  unit_code text NOT NULL,

  PRIMARY KEY (creature_id, speed_id)
);

ALTER TABLE public.creature_speeds ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_creature_speeds_creature
  ON public.creature_speeds(creature_id);

CREATE TABLE IF NOT EXISTS public.creature_damage_resistances (
  creature_id uuid NOT NULL
    REFERENCES public.creatures(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  damage_type_id uuid NOT NULL
    REFERENCES public.damage_types(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  PRIMARY KEY (creature_id, damage_type_id)
);

ALTER TABLE public.creature_damage_resistances ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_creature_damage_resistances_creature
  ON public.creature_damage_resistances(creature_id);

CREATE TABLE IF NOT EXISTS public.creature_damage_immunities (
  creature_id uuid NOT NULL
    REFERENCES public.creatures(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  damage_type_id uuid NOT NULL
    REFERENCES public.damage_types(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  PRIMARY KEY (creature_id, damage_type_id)
);

ALTER TABLE public.creature_damage_immunities ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_creature_damage_immunities_creature
  ON public.creature_damage_immunities(creature_id);

CREATE TABLE IF NOT EXISTS public.creature_damage_vulnerabilities (
  creature_id uuid NOT NULL
    REFERENCES public.creatures(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  damage_type_id uuid NOT NULL
    REFERENCES public.damage_types(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  PRIMARY KEY (creature_id, damage_type_id)
);

ALTER TABLE public.creature_damage_vulnerabilities ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_creature_damage_vulnerabilities_creature
  ON public.creature_damage_vulnerabilities(creature_id);

CREATE TABLE IF NOT EXISTS public.creature_condition_immunities (
  creature_id uuid NOT NULL
    REFERENCES public.creatures(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  condition_type_id uuid NOT NULL
    REFERENCES public.condition_types(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  PRIMARY KEY (creature_id, condition_type_id)
);

ALTER TABLE public.creature_condition_immunities ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_creature_condition_immunities_creature
  ON public.creature_condition_immunities(creature_id);


/* ──────────────────────────────────────────────
 * VEHICLES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY,
  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  user_id uuid REFERENCES auth.users(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  label text NOT NULL,
  description text,
  category text NOT NULL,
  size_code text NOT NULL,
  armor_class integer NOT NULL,
  hit_points integer NOT NULL,
  speed integer,
  speed_note text,
  crew_min integer,
  crew_max integer,
  passenger_capacity integer,
  cargo_capacity text,
  cost jsonb,
  properties text[],
  is_master boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT vehicles_category_chk CHECK (
    category IN ('LAND', 'WATER', 'AIR', 'SPELLJAMMER')
  )
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
SELECT public.apply_system_derived_policies('vehicles');

CREATE INDEX IF NOT EXISTS idx_vehicles_system
  ON public.vehicles(system_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_category
  ON public.vehicles(category);

CREATE TABLE IF NOT EXISTS public.vehicle_details (
  vehicle_id uuid NOT NULL
    REFERENCES public.vehicles(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  detail_id uuid NOT NULL
    REFERENCES public.details(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  PRIMARY KEY (vehicle_id, detail_id)
);

ALTER TABLE public.vehicle_details ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_vehicle_details_vehicle
  ON public.vehicle_details(vehicle_id);

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

CREATE TABLE IF NOT EXISTS public.vehicle_features (
  vehicle_id uuid NOT NULL
    REFERENCES public.vehicles(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  feature_id uuid NOT NULL,
  sort_order integer NOT NULL,

  PRIMARY KEY (vehicle_id, feature_id)
);

ALTER TABLE public.vehicle_features ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_vehicle_features_vehicle
  ON public.vehicle_features(vehicle_id);

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

SELECT public.apply_updated_at_triggers();
