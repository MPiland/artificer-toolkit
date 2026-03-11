/*************************************************
 * DAMAGES — AUTHORED ENTITY (FINAL)
 * - Supports FIXED | DICE | POOL
 * - Supports ScalingType NONE | PER_LEVEL
 *   - PER_LEVEL levels only for FIXED/DICE
 *   - POOL PER_LEVEL uses scaling.value (not levels)
 * - Supports bonusCodes[] (author intent) + optional bonuses[] payloads
 *
 * Notes:
 * - Uses stale deletes for child tables to remain idempotent.
 * - Uses a single ROOT upsert that chains child upserts.
 * - Assumes you already have:
 *   - public.upsert_json_array(...) helper (array upsert helper)
 *************************************************/

-- =========================================================
-- TABLES
-- =========================================================

/* ──────────────────────────────────────────────
 * DAMAGES (ROOT)
 * ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.damages (
  id uuid PRIMARY KEY,

  damage_type_id uuid NOT NULL
    REFERENCES public.damage_types(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,

  value_kind text NOT NULL,        -- DAMAGE_VALUE_KIND: FIXED | DICE | POOL
  scaling_kind text NOT NULL,      -- SCALING_KIND: NONE | PER_LEVEL

  scaling_source text,             -- SCALING_SOURCE: CHARACTER_LEVEL | CLASS_LEVEL | SPELL_LEVEL
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,                   -- CLASS_LEVEL only
  spell_id uuid REFERENCES public.spells(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,                   -- SPELL_LEVEL only

  sort_order integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_damages_damage_type
  ON public.damages(damage_type_id);

ALTER TABLE public.damages ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * DAMAGE BONUS KINDS (author intent)
 * ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.damage_bonus_kinds (
  damage_id uuid NOT NULL
    REFERENCES public.damages(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  bonus_kind text NOT NULL,        -- DAMAGE_BONUS_KIND
  sort_order integer NOT NULL DEFAULT 0,

  PRIMARY KEY (damage_id, bonus_kind)
);

CREATE INDEX IF NOT EXISTS idx_damage_bonus_kinds_damage
  ON public.damage_bonus_kinds(damage_id);
  
ALTER TABLE public.damage_bonus_kinds ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * DAMAGE VALUES (1:1 per damage)
 * Stores the resolved "value" object:
 * - FIXED: amount
 * - DICE: dice
 * - POOL: amount + optional multiplier/min/max
 *   (for POOL PER_LEVEL, these come from scaling.value)
 * ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.damage_values (
  id uuid PRIMARY KEY,
  damage_id uuid NOT NULL
    REFERENCES public.damages(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  -- FIXED / POOL
  amount numeric,

  -- DICE
  dice text,

  -- POOL scaling knobs
  multiplier numeric,
  min numeric,
  max numeric,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_damage_values_damage
  ON public.damage_values(damage_id);

ALTER TABLE public.damage_values ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * DAMAGE SCALING LEVELS (FIXED/DICE only)
 * Used when scaling_kind = PER_LEVEL and value_kind IN (FIXED, DICE)
 * ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.damage_scaling_levels (
  id uuid PRIMARY KEY,
  damage_id uuid NOT NULL
    REFERENCES public.damages(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  level integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,

  -- FIXED
  amount numeric,
  -- DICE
  dice text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT damage_scaling_shape_chk CHECK (
    (amount IS NOT NULL AND dice IS NULL)
    OR
    (dice IS NOT NULL AND amount IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_damage_scaling_levels_damage
  ON public.damage_scaling_levels(damage_id);
  
ALTER TABLE public.damage_scaling_levels ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * DAMAGE BONUSES (optional payload objects)
 * These are the "bonuses?: DamageBonusEffect[]" entries.
 * IMPORTANT:
 * - ability bonus stores AbilityCode as text in ability_code
 * - skill bonus references skill_id
 * - proficiency bonus has neither
 * ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.damage_bonuses (
  id uuid PRIMARY KEY,
  damage_id uuid NOT NULL
    REFERENCES public.damages(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  bonus_kind text NOT NULL,        -- DamageBonusCode

  ability_code text,               -- AbilityCode (ABILITY_BONUS only)
  skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,                   -- SKILL_BONUS only
  -- PROFICIENCY_BONUS has neither

  multiplier numeric,
  min numeric,
  max numeric,

  sort_order integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_damage_bonuses_damage
  ON public.damage_bonuses(damage_id);

ALTER TABLE public.damage_bonuses ENABLE ROW LEVEL SECURITY;
