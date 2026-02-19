/* ──────────────────────────────────────────────
 * CHARACTERISTICS — SHARED STRUCTURAL ENTITY
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.characteristics (
  id uuid PRIMARY KEY,

  code text NOT NULL,   -- RANGE | DURATION | SHAPE

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_characteristics_code
  ON public.characteristics (code);

ALTER TABLE public.characteristics ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * CHARACTERISTICS — RANGE SIZES
 * ────────────────────────────────────────────── */
 
 CREATE TABLE IF NOT EXISTS public.characteristic_ranges (
  characteristic_id uuid PRIMARY KEY
    REFERENCES characteristics(id) ON DELETE CASCADE,

  kind text NOT NULL,   -- DISTANCE | SELF | SIGHT | TOUCH | UNLIMITED
  min integer,
  max integer,
  unit_code text,

  CHECK (
    (kind = 'DISTANCE' AND min IS NOT NULL)
    OR
    (kind <> 'DISTANCE' AND min IS NULL AND max IS NULL AND unit_code IS NULL)
  )  
);

ALTER TABLE public.characteristic_ranges ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * CHARACTERISTICS — SHAPES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.characteristic_shapes (
  characteristic_id uuid PRIMARY KEY
    REFERENCES characteristics(id) ON DELETE CASCADE,

  kind text NOT NULL
    -- NONE | LINE | CONE | CUBE | CYLINDER | SPHERE | DOME | CIRCLE | WALL
);

ALTER TABLE public.characteristic_shapes ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * CHARACTERISTICS — SHAPE DIMENSIONS
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.characteristic_shape_dimensions (
  characteristic_id uuid NOT NULL
    REFERENCES characteristic_shapes(characteristic_id) ON DELETE CASCADE,

  dimension text NOT NULL,
    -- RADIUS | HEIGHT | LENGTH | EDGE_LENGTH | THICKNESS

  amount integer NOT NULL,
  unit_code text NOT NULL,

  PRIMARY KEY (characteristic_id, dimension)
);

CREATE INDEX IF NOT EXISTS idx_characteristic_shape_dimensions_characteristic_id
  ON public.characteristic_shape_dimensions (characteristic_id);

ALTER TABLE public.characteristic_shape_dimensions ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * CHARACTERISTICS — DURATIONS
 * ────────────────────────────────────────────── */
 
 CREATE TABLE IF NOT EXISTS public.characteristic_durations (
  characteristic_id uuid PRIMARY KEY
    REFERENCES characteristics(id) ON DELETE CASCADE,

  kind text NOT NULL,   -- INSTANTANEOUS | DAY | HOUR | MINUTE | MONTH | ROUND | TURN | WEEK | YEAR
  amount integer
);

ALTER TABLE public.characteristic_durations ENABLE ROW LEVEL SECURITY;