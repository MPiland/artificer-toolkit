/* ──────────────────────────────────────────────
 * CHARGES
 *
 * Root authored charge definition.
 *
 * Cardinality:
 *   systems 1 ──▶ N charges
 *
 * Owns:
 *   charge_limits
 *   charge_scaling_levels
 *   charge_bonus_kinds
 *   charge_bonuses
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.charges (
  id uuid PRIMARY KEY,

  scaling_kind text NOT NULL,     -- SCALING_KIND
  reset_kind text,                -- CHARGE_RESET_KIND; null for SOURCE_CHARGES

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * CHARGE LIMITS
 *
 * Discriminated limit payload.
 * Exactly one row per charge.
 *
 * Corresponds to:
 *   ChargeLimitPayload
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.charge_limits (
  charge_id uuid PRIMARY KEY
    REFERENCES public.charges(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  limit_kind text NOT NULL,       -- CHARGE_LIMIT_KIND
  class_id uuid,
  ability_code text,              -- ABILITY_MODIFIER limit kind

  /* FIXED_AMOUNT */
  amount integer,

  /* SOURCE_CHARGES */
  cost integer,

  /* CHARACTER_LEVEL | CLASS_LEVEL | PARENT_CLASS_LEVEL | SPELL_CAST_LEVEL | ABILITY_MODIFIER */
  multiplier numeric,
  min integer,
  max integer,

  CONSTRAINT charge_limits_fixed_amount_chk CHECK (
    (limit_kind = 'FIXED_AMOUNT' AND amount IS NOT NULL AND cost IS NULL AND class_id IS NULL AND ability_code IS NULL)
    OR (limit_kind IN ('CHARACTER_LEVEL', 'CLASS_LEVEL', 'PARENT_CLASS_LEVEL', 'SPELL_CAST_LEVEL') AND amount IS NULL AND cost IS NULL AND ability_code IS NULL)
    OR (limit_kind = 'ABILITY_MODIFIER' AND ability_code IS NOT NULL AND amount IS NULL AND cost IS NULL AND class_id IS NULL)
    OR (
      limit_kind = 'SOURCE_CHARGES'
      AND cost > 0
      AND amount IS NULL
      AND class_id IS NULL
      AND ability_code IS NULL
      AND multiplier IS NULL
      AND min IS NULL
      AND max IS NULL
    )
  ),
  CONSTRAINT charge_limits_class_level_chk CHECK (
    (limit_kind = 'CLASS_LEVEL' AND class_id IS NOT NULL)
    OR (limit_kind <> 'CLASS_LEVEL' AND class_id IS NULL)
  )
);

ALTER TABLE public.charge_limits ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * CHARGE SCALING LEVELS
 *
 * Level-based scaling values.
 * Present only when scaling_kind = PER_LEVEL.
 *
 * Corresponds to:
 *   LevelScaledValue<{ amount: number }>
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.charge_scaling_levels (
  id uuid PRIMARY KEY,
  charge_id uuid NOT NULL
    REFERENCES public.charges(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  level integer NOT NULL,
  sort_order integer NOT NULL,
  amount integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (charge_id, level),
  UNIQUE (charge_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_charge_scaling_levels_charge
  ON public.charge_scaling_levels(charge_id);

ALTER TABLE public.charge_scaling_levels ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * CHARGE BONUSES
 *
 * Bonus payloads.
 * Exactly one row per (charge, bonus_kind).
 *
 * Corresponds to:
 *   ChargeBonusAuthored
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.charge_bonuses (
  id uuid PRIMARY KEY,
  charge_id uuid NOT NULL
    REFERENCES public.charges(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  bonus_kind text NOT NULL,       -- CHARGE_BONUS_KIND

  /* ABILITY_MODIFIER */
  ability_code text,

  /* SKILL_BONUS */
  skill_id uuid
    REFERENCES public.skills(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,

  /* shared numeric modifiers */
  multiplier numeric,
  min integer,
  max integer,

  sort_order integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (charge_id, sort_order),
  CONSTRAINT charge_bonuses_ability_payload_chk CHECK (
    (bonus_kind = 'ABILITY_MODIFIER' AND ability_code IS NOT NULL AND skill_id IS NULL)
    OR (bonus_kind <> 'ABILITY_MODIFIER')
  ),
  CONSTRAINT charge_bonuses_skill_payload_chk CHECK (
    (bonus_kind = 'SKILL_BONUS' AND skill_id IS NOT NULL AND ability_code IS NULL)
    OR (bonus_kind <> 'SKILL_BONUS')
  ),
  CONSTRAINT charge_bonuses_other_payload_chk CHECK (
    (bonus_kind = 'PROFICIENCY_BONUS' AND ability_code IS NULL AND skill_id IS NULL)
    OR (bonus_kind <> 'PROFICIENCY_BONUS')
  )
);

ALTER TABLE public.charge_bonuses ENABLE ROW LEVEL SECURITY;
