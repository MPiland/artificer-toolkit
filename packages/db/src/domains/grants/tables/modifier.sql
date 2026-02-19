/* ─────────────────────────────────────────────────────────────
 * MODIFIER GRANTS — AUTHORED (STATIC)
 *
 * Aligned with current authored model:
 * - modifier_grants stores the grant metadata + selection details.
 * - payload is stored 1:1 in modifier_grant_payloads.
 * - restrictions/filters are owned rows via bridge tables that cleanup owned rows.
 *
 * Canonical SQL rules applied:
 * - Do NOT enable RLS per-table here.
 * - Do NOT create updated_at triggers here.
 * - Bridge tables that own child rows use cleanup_owned_rows trigger.
 * ───────────────────────────────────────────────────────────── */

-- ─────────────────────────────────────────────────────────────
-- MODIFIER GRANTS (parent)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.modifier_grants (
  id uuid PRIMARY KEY,

  -- Parent system ownership (systems 1 -> N modifier_grants)
  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  grant_kind text NOT NULL DEFAULT 'MODIFIER_GRANT',

  modifier_kind text NOT NULL,          -- MODIFIER_KIND
  scope text NOT NULL,                  -- MODIFIER_SCOPE_KIND
  subject text NOT NULL,                -- SubjectCode

  selection_kind text NOT NULL,         -- GRANTED | CHOSEN
  selection_count integer,              -- CHOSEN only

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT modifier_grants_selection_count_chk
    CHECK (
      (selection_kind <> 'CHOSEN' AND selection_count IS NULL)
      OR
      (selection_kind = 'CHOSEN' AND selection_count IS NOT NULL AND selection_count > 0)
    )
);

ALTER TABLE public.modifier_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_modifier_grants_system
  ON public.modifier_grants(system_id);

CREATE INDEX IF NOT EXISTS idx_modifier_grants_kind
  ON public.modifier_grants(modifier_kind);

CREATE INDEX IF NOT EXISTS idx_modifier_grants_subject
  ON public.modifier_grants(subject);

  /* ──────────────────────────────────────────────
 * MODIFIER GRANT — TARGETS (OWNED)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.modifier_grant_target_groups (
  modifier_grant_id uuid NOT NULL
    REFERENCES public.modifier_grants(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  target_group_id uuid NOT NULL
    REFERENCES public.target_groups(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  PRIMARY KEY (modifier_grant_id, target_group_id)
);

ALTER TABLE public.modifier_grant_target_groups ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_modifier_grant_target_groups_modifier_grant
  ON public.modifier_grant_target_groups(modifier_grant_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_modifier_grant_target_groups_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_modifier_grant_target_groups_owned
    AFTER DELETE ON public.modifier_grant_target_groups
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.target_groups", "columns": ["target_group_id"] }
    ]');
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- MODIFIER GRANT — TRAITS (non-owned join)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.modifier_grant_traits (
  modifier_grant_id uuid NOT NULL
    REFERENCES public.modifier_grants(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  trait_code text NOT NULL,
  sort_order integer NOT NULL,

  PRIMARY KEY (modifier_grant_id, trait_code)
);

ALTER TABLE public.modifier_grant_traits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_modifier_grant_traits_grant
  ON public.modifier_grant_traits(modifier_grant_id);

-- ─────────────────────────────────────────────────────────────
-- MODIFIER GRANT — PAYLOAD (STATIC, 1:1)
--
-- This table reflects the current authored payload shapes:
-- - BONUS/PENALTY use value_kind + associated fields.
-- - SET_VALUE uses set_amount.
-- - MODIFY_CHARGE_LIMIT uses charge_* fields (ChargeLimitPayload).
-- - ADD_BONUS_DIE uses dice.
-- - REPLACE_DAMAGE uses damage_type_id (text, vocab id).
-- - ADD/REMOVE uses value_id (text, vocab id).
-- - REPLACE_OPTION uses option_id (text).
-- - ADVANTAGE/DISADVANTAGE have no payload fields (row exists but empty).
-- - OPTIONAL_ABILITY_MODIFIER stores abilities in a separate table.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.modifier_grant_payloads (
  modifier_grant_id uuid PRIMARY KEY
    REFERENCES public.modifier_grants(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  -- Denormalized discriminator for local CHECK constraints / debugging.
  -- Must match modifier_grants.modifier_kind (enforced at application/compiler layer).
  modifier_kind text NOT NULL,

  /* ─────────────────────────────────────────────
   * BONUS / PENALTY value payload
   * ───────────────────────────────────────────── */
  value_kind text,                 -- MODIFIER_VALUE_SOURCE_CODE
  amount numeric,                  -- FIXED
  multiplier numeric,              -- *optional* multiplier for derived kinds
  ability_code text,               -- ABILITY_MODIFIER
  skill_id uuid
    REFERENCES public.skills(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED, -- SKILL_BONUS
  class_id uuid
    REFERENCES public.classes(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED, -- CLASS_LEVEL
  spell_id uuid
    REFERENCES public.spells(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED, -- SPELL_LEVEL
  dice text,                       -- DICE (and ADD_BONUS_DIE)

  /* ─────────────────────────────────────────────
   * SET_VALUE
   * ───────────────────────────────────────────── */
  set_amount numeric,

  /* ─────────────────────────────────────────────
   * MODIFY_CHARGE_LIMIT (ChargeLimitPayload)
   * ───────────────────────────────────────────── */
  charge_limit_kind text,          -- authoring charge base kind (e.g., FIXED_AMOUNT/CHARACTER_LEVEL/CLASS_LEVEL/SPELL_LEVEL)
  charge_uses integer,             -- fixed uses when applicable
  charge_multiplier numeric,       -- optional multiplier
  charge_class_id uuid
    REFERENCES public.classes(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,
  charge_spell_id uuid
    REFERENCES public.spells(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,

  /* ─────────────────────────────────────────────
   * REPLACE_DAMAGE / ADD / REMOVE / REPLACE_OPTION
   * ───────────────────────────────────────────── */
  damage_type_id text,             -- vocab id (matches authored { damageTypeId: string })
  value_id text,                   -- vocab id (traitId, damageTypeId, senseId, movementModeId, etc.)
  option_id text,                  -- durationId, shapeId, rangeId, resetId, etc.

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Light sanity checks (don’t attempt to fully enforce all unions in SQL)
  CONSTRAINT modifier_grant_payloads_value_kind_chk
    CHECK (value_kind IS NULL OR value_kind <> ''),

  CONSTRAINT modifier_grant_payloads_dice_chk
    CHECK (dice IS NULL OR dice <> '')
);

ALTER TABLE public.modifier_grant_payloads ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_modifier_grant_payloads_kind
  ON public.modifier_grant_payloads(modifier_kind);

CREATE INDEX IF NOT EXISTS idx_modifier_grant_payloads_value_kind
  ON public.modifier_grant_payloads(value_kind);

-- ─────────────────────────────────────────────────────────────
-- MODIFIER GRANT — OPTIONAL ABILITY MODIFIER (multi-row payload)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.modifier_grant_optional_abilities (
  modifier_grant_id uuid NOT NULL
    REFERENCES public.modifier_grants(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  ability_code text NOT NULL,

  PRIMARY KEY (modifier_grant_id, ability_code)
);

ALTER TABLE public.modifier_grant_optional_abilities ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_modifier_grant_optional_abilities_grant
  ON public.modifier_grant_optional_abilities(modifier_grant_id);
