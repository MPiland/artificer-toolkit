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
  reset_kind text NOT NULL,       -- CHARGE_RESET_KIND

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

  /* FIXED_AMOUNT */
  amount integer,

  /* CHARACTER_LEVEL | SOURCE_LEVEL */
  multiplier numeric,
  min integer,
  max integer
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
  charge_id uuid NOT NULL
    REFERENCES public.charges(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  level integer NOT NULL,
  sort_order integer NOT NULL,
  amount integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (charge_id, level)
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

  PRIMARY KEY (charge_id, bonus_kind)
);

ALTER TABLE public.charge_bonuses ENABLE ROW LEVEL SECURITY;
