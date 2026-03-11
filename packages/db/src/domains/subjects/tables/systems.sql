/* ──────────────────────────────────────────────
 * SYSTEMS — ROOT
 *
 * Intent:
 *   A System is the top-level owned container for all author-extensible
 *   vocabularies (skills, senses, damage types, etc.). Other authored
 *   entities reference these tables by id.
 *
 * Notes:
 *   - Vocabulary rows are owned by the System via system_id.
 *   - Stale deletes are performed per vocabulary surface by id.
 *   - No per-table updated_at triggers (handled globally).
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.systems (
  id uuid PRIMARY KEY,

  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,

  label text NOT NULL,
  description text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_systems_user
  ON public.systems(user_id);


/* ──────────────────────────────────────────────
 * VOCABULARY TABLE TEMPLATE
 *
 * Columns:
 *  - id: authored UUID
 *  - system_id: owning system
 *  - code: author-extensible code (string)
 *  - label/description/tooltip/short: presentation
 * ────────────────────────────────────────────── */


/* ──────────────────────────────────────────────
 * ALIGNMENTS
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.alignments (
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

ALTER TABLE public.alignments ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_alignments_system_code
  ON public.alignments(system_id, code);

CREATE INDEX IF NOT EXISTS idx_alignments_system
  ON public.alignments(system_id);


/* ──────────────────────────────────────────────
 * CONDITIONS
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.condition_types (
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

ALTER TABLE public.condition_types ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_condition_types_system_code
  ON public.condition_types(system_id, code);

CREATE INDEX IF NOT EXISTS idx_condition_types_system
  ON public.condition_types(system_id);


/* ──────────────────────────────────────────────
 * CURRENCIES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.currencies (
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

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_currencies_system_code
  ON public.currencies(system_id, code);

CREATE INDEX IF NOT EXISTS idx_currencies_system
  ON public.currencies(system_id);


/* ──────────────────────────────────────────────
 * DAMAGE TYPES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.damage_types (
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

ALTER TABLE public.damage_types ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_damage_types_system_code
  ON public.damage_types(system_id, code);

CREATE INDEX IF NOT EXISTS idx_damage_types_system
  ON public.damage_types(system_id);


/* ──────────────────────────────────────────────
 * LANGUAGES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.languages (
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

ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_languages_system_code
  ON public.languages(system_id, code);

CREATE INDEX IF NOT EXISTS idx_languages_system
  ON public.languages(system_id);


/* ──────────────────────────────────────────────
 * MAGIC SCHOOLS
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.magic_schools (
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

ALTER TABLE public.magic_schools ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_magic_schools_system_code
  ON public.magic_schools(system_id, code);

CREATE INDEX IF NOT EXISTS idx_magic_schools_system
  ON public.magic_schools(system_id);


/* ──────────────────────────────────────────────
 * PASSIVES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.passives (
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

ALTER TABLE public.passives ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_passives_system_code
  ON public.passives(system_id, code);

CREATE INDEX IF NOT EXISTS idx_passives_system
  ON public.passives(system_id);


/* ──────────────────────────────────────────────
 * RARITIES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.rarities (
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

ALTER TABLE public.rarities ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rarities_system_code
  ON public.rarities(system_id, code);

CREATE INDEX IF NOT EXISTS idx_rarities_system
  ON public.rarities(system_id);


/* ──────────────────────────────────────────────
 * SENSES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.senses (
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

ALTER TABLE public.senses ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_senses_system_code
  ON public.senses(system_id, code);

CREATE INDEX IF NOT EXISTS idx_senses_system
  ON public.senses(system_id);


/* ──────────────────────────────────────────────
 * SKILLS
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.skills (
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

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_skills_system_code
  ON public.skills(system_id, code);

CREATE INDEX IF NOT EXISTS idx_skills_system
  ON public.skills(system_id);


/* ──────────────────────────────────────────────
 * SPEEDS
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.speeds (
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

ALTER TABLE public.speeds ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_speeds_system_code
  ON public.speeds(system_id, code);

CREATE INDEX IF NOT EXISTS idx_speeds_system
  ON public.speeds(system_id);


/* ──────────────────────────────────────────────
 * TERRAINS
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.terrains (
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

ALTER TABLE public.terrains ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_terrains_system_code
  ON public.terrains(system_id, code);

CREATE INDEX IF NOT EXISTS idx_terrains_system
  ON public.terrains(system_id);