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
  system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  grant_kind text NOT NULL DEFAULT 'MODIFIER_GRANT',
  -- What surface is being modified (ValueDomainCode)
  value_domain_code text NOT NULL,
  -- How it is modified (ModifierKind) + where it applies (GLOBAL|SOURCE)
  modifier_kind text NOT NULL,
  scope text NOT NULL,
  -- Authoring selection semantics (GRANTED | CHOSEN)
  selection_kind text NOT NULL,
  selection_count integer,
  restriction_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT modifier_grants_selection_count_chk CHECK (
    (
      selection_kind <> 'CHOSEN'
      AND selection_count IS NULL
    )
    OR (
      selection_kind = 'CHOSEN'
      AND selection_count IS NOT NULL
      AND selection_count > 0
    )
  )
);

ALTER TABLE public.modifier_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_modifier_grants_system ON public.modifier_grants (system_id);

CREATE INDEX IF NOT EXISTS idx_modifier_grants_value_domain ON public.modifier_grants (value_domain_code);

CREATE INDEX IF NOT EXISTS idx_modifier_grants_kind ON public.modifier_grants (modifier_kind);

CREATE INDEX IF NOT EXISTS idx_modifier_grants_scope ON public.modifier_grants (scope);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_modifier_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_modifier_owned_on_update
    AFTER UPDATE ON public.modifier_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_modifier_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_modifier_owned
    AFTER DELETE ON public.modifier_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- MODIFIER GRANT — VALUE DOMAIN PARAMETERS (STATIC, 1:1)
--
-- Mirrors ValueDomainParamByCode:
-- - Only some domains are parameterized (attackDomain, ability, skillId, etc.).
-- - We keep this table sparse and rely on app/compiler validation for exact shape.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.modifier_grant_domain_params (
  modifier_grant_id uuid PRIMARY KEY REFERENCES public.modifier_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  -- Denormalized for debugging / light checks
  value_domain_code text NOT NULL,
  /* Common parameter slots (only set the ones that apply) */
  -- ATTACK_ROLL_BONUS, DAMAGE (sheet-style): { attackDomain: AttackDomainCode }
  attack_domain_code text,
  -- SAVING_THROW_BONUS, ABILITY_SCORE: { ability: AbilityCode }
  ability_code text,
  -- SKILL_BONUS: { skillId: uuid }
  skill_id uuid REFERENCES public.skills (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  -- SPEED: { speedId: uuid }  (your vocab is speeds table)
  speed_id uuid REFERENCES public.speeds (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  -- SENSE_RANGE: { senseCode: SenseCode } (stored as code; sense vocab is ids elsewhere)
  sense_code text,
  -- SPELL_SLOT_COUNT: { spellLevel: number }
  spell_level integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT modifier_grant_domain_params_spell_level_chk CHECK (
    spell_level IS NULL
    OR (
      spell_level >= 0
      AND spell_level <= 9
    )
  )
);

ALTER TABLE public.modifier_grant_domain_params ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_modifier_grant_domain_params_domain ON public.modifier_grant_domain_params (value_domain_code);

CREATE INDEX IF NOT EXISTS idx_modifier_grant_domain_params_skill ON public.modifier_grant_domain_params (skill_id);

CREATE INDEX IF NOT EXISTS idx_modifier_grant_domain_params_speed ON public.modifier_grant_domain_params (speed_id);

-- ─────────────────────────────────────────────────────────────
-- MODIFIER GRANT — TRAITS (join; not owned)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.modifier_grant_traits (
  modifier_grant_id uuid NOT NULL REFERENCES public.modifier_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  trait_code text NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (modifier_grant_id, trait_code)
);

ALTER TABLE public.modifier_grant_traits ENABLE ROW LEVEL SECURITY;

-- NOTE: traits are engine-core codes; no ownership policy call needed.
CREATE INDEX IF NOT EXISTS idx_modifier_grant_traits_grant ON public.modifier_grant_traits (modifier_grant_id);

-- ─────────────────────────────────────────────────────────────
-- MODIFIER GRANT — PAYLOAD (STATIC, 1:1)
--
-- Reflects ModifierPayloadFor<V, K> (union handled primarily by compiler):
-- - BONUS/PENALTY: scalar value payload (value_kind + fields)
-- - SET_VALUE: set_amount
-- - MODIFY_CHARGE_LIMIT: charge_* fields (ChargeLimitPayload)
-- - ADD_BONUS_DIE: dice
-- - REPLACE_DAMAGE: damage_type_id (for "replace damage type" semantics)
-- - ADD_OPTION / REMOVE_OPTION / REPLACE_OPTION: domain-correlated option payload
-- - ADVANTAGE / DISADVANTAGE: no payload
-- - OPTIONAL_ABILITY_MODIFIER: abilities in child table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.modifier_grant_payloads (
  modifier_grant_id uuid PRIMARY KEY REFERENCES public.modifier_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  -- Denormalized discriminators for local debugging.
  -- Keep in sync with modifier_grants at the application/compiler layer.
  modifier_kind text NOT NULL,
  value_domain_code text NOT NULL,
  /* ─────────────────────────────────────────────
  * BONUS / PENALTY scalar value payload
  * ───────────────────────────────────────────── */
  value_kind text, -- MODIFIER_VALUE_SOURCE_CODE
  amount numeric, -- FIXED
  multiplier numeric, -- optional for derived kinds
  ability_code text, -- ABILITY_MODIFIER
  skill_id uuid REFERENCES public.skills (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED, -- SKILL_BONUS
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED, -- CLASS_LEVEL
  spell_id uuid REFERENCES public.spells (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED, -- SPELL_LEVEL (if you keep it)
  /* ─────────────────────────────────────────────
  * SET_VALUE
  * ───────────────────────────────────────────── */
  set_amount numeric,
  /* ─────────────────────────────────────────────
  * MODIFY_CHARGE_LIMIT (ChargeLimitPayload)
  * ───────────────────────────────────────────── */
  charge_limit_kind text, -- ChargeLimitKind or authored base kind (depending on your model)
  charge_uses integer,
  charge_multiplier numeric,
  charge_class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  charge_spell_id uuid REFERENCES public.spells (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  /* ─────────────────────────────────────────────
  * ADD_BONUS_DIE
  * ───────────────────────────────────────────── */
  dice text,
  /* ─────────────────────────────────────────────
  * REPLACE_DAMAGE (treat as “replace damage type” for now)
  * ───────────────────────────────────────────── */
  damage_type_id uuid REFERENCES public.damage_types (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  /* ─────────────────────────────────────────────
  * Option-like operations (domain-correlated)
  *
  * For MVP we keep these as optional columns and rely on compiler rules:
  * - DAMAGE_RESISTANCE/IMMUNITY/VULNERABILITY -> damage_type_id
  * - CONDITION -> condition_type_id
  * - MOVEMENT_MODE -> movement_mode_id (text until you have a table)
  * - ATTRIBUTE -> attribute_id (text until you have a table)
  * - RANGE/DURATION/SHAPE -> *_kind (text enum-ish)
  * - CHARGE_RESET -> reset_kind (text)
  * - CHARGE_LIMIT -> charge_limit_kind (already present above)
  * ───────────────────────────────────────────── */
  condition_type_id uuid REFERENCES public.condition_types (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  movement_mode_id text, -- TODO: FK when you model movement modes
  attribute_id text, -- TODO: FK when you model attributes
  range_kind text,
  duration_kind text,
  shape_kind text,
  reset_kind text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT modifier_grant_payloads_value_kind_chk CHECK (
    value_kind IS NULL
    OR value_kind <> ''
  ),
  CONSTRAINT modifier_grant_payloads_dice_chk CHECK (
    dice IS NULL
    OR dice <> ''
  )
);

ALTER TABLE public.modifier_grant_payloads ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_modifier_grant_payloads_kind ON public.modifier_grant_payloads (modifier_kind);

CREATE INDEX IF NOT EXISTS idx_modifier_grant_payloads_domain ON public.modifier_grant_payloads (value_domain_code);

CREATE INDEX IF NOT EXISTS idx_modifier_grant_payloads_value_kind ON public.modifier_grant_payloads (value_kind);

CREATE INDEX IF NOT EXISTS idx_modifier_grant_payloads_damage_type ON public.modifier_grant_payloads (damage_type_id);

CREATE INDEX IF NOT EXISTS idx_modifier_grant_payloads_condition_type ON public.modifier_grant_payloads (condition_type_id);

-- ─────────────────────────────────────────────────────────────
-- MODIFIER GRANT — OPTIONAL ABILITY MODIFIER (multi-row payload)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.modifier_grant_optional_abilities (
  modifier_grant_id uuid NOT NULL REFERENCES public.modifier_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  ability_code text NOT NULL,
  PRIMARY KEY (modifier_grant_id, ability_code)
);

ALTER TABLE public.modifier_grant_optional_abilities ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_modifier_grant_optional_abilities_grant ON public.modifier_grant_optional_abilities (modifier_grant_id);