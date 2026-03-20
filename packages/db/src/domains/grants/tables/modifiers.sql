/* ============================================================================
 * MODIFIER GRANTS
 *
 * Normalization notes:
 * - modifier_grants stores authored root metadata and the single owned
 *   restriction subtree reference.
 * - modifier_grant_domain_params stores the finite set of domain-correlated
 *   selector params (ability, skill, attack domain, spell level, etc.).
 * - modifier_grant_payloads stores the 1:1 payload surface with concrete
 *   columns named after the authored payload fields.
 * - modifier_grant_charge_levels stores the owned level rows for
 *   MODIFY_CHARGE_LIMIT payloads that use PER_LEVEL scaling.
 * ========================================================================= */

CREATE TABLE IF NOT EXISTS public.modifier_grants (
  id uuid PRIMARY KEY,
  system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  grant_kind text NOT NULL DEFAULT 'MODIFIER_GRANT',
  value_domain_code text NOT NULL,
  modifier_kind text NOT NULL,
  scope text NOT NULL,
  selection_kind text NOT NULL,
  count integer,
  sort_order integer NOT NULL,
  restriction_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT modifier_grants_count_chk CHECK (
    (selection_kind <> 'CHOSEN' AND count IS NULL)
    OR (selection_kind = 'CHOSEN' AND count IS NOT NULL AND count > 0)
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

CREATE TABLE IF NOT EXISTS public.modifier_grant_domain_params (
  modifier_grant_id uuid PRIMARY KEY REFERENCES public.modifier_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  value_domain_code text NOT NULL,
  attack_domain_code text,
  ability_code text,
  skill_id uuid REFERENCES public.skills (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  speed_id uuid REFERENCES public.speeds (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  sense_code text,
  spell_level integer,
  condition_type_id uuid REFERENCES public.condition_types (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT modifier_grant_domain_params_spell_level_chk CHECK (
    spell_level IS NULL OR (spell_level >= 0 AND spell_level <= 9)
  )
);

ALTER TABLE public.modifier_grant_domain_params ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_modifier_grant_domain_params_domain ON public.modifier_grant_domain_params (value_domain_code);
CREATE INDEX IF NOT EXISTS idx_modifier_grant_domain_params_skill ON public.modifier_grant_domain_params (skill_id);
CREATE INDEX IF NOT EXISTS idx_modifier_grant_domain_params_speed ON public.modifier_grant_domain_params (speed_id);

CREATE TABLE IF NOT EXISTS public.modifier_grant_payloads (
  modifier_grant_id uuid PRIMARY KEY REFERENCES public.modifier_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  modifier_kind text NOT NULL,
  value_domain_code text NOT NULL,
  numeric_value_kind text,
  numeric_amount numeric,
  numeric_multiplier numeric,
  numeric_ability_code text,
  numeric_skill_id uuid REFERENCES public.skills (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  numeric_class_id uuid,
  set_amount numeric,
  charge_limit_kind text,
  charge_scaling_kind text,
  charge_amount integer,
  charge_multiplier numeric,
  charge_min integer,
  charge_max integer,
  dice text,
  damage_type_id uuid REFERENCES public.damage_types (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  condition_type_id uuid REFERENCES public.condition_types (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  movement_mode_id text,
  attribute_id text,
  range_kind text,
  duration_kind text,
  shape_kind text,
  reset_kind text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT modifier_grant_payloads_numeric_value_kind_chk CHECK (
    numeric_value_kind IS NULL OR numeric_value_kind <> ''
  ),
  CONSTRAINT modifier_grant_payloads_dice_chk CHECK (
    dice IS NULL OR dice <> ''
  ),
  CONSTRAINT modifier_grant_payloads_charge_fixed_amount_chk CHECK (
    charge_limit_kind IS DISTINCT FROM 'FIXED_AMOUNT'
    OR (
      (charge_scaling_kind = 'NONE' AND charge_amount IS NOT NULL AND charge_multiplier IS NULL AND charge_min IS NULL AND charge_max IS NULL)
      OR
      (charge_scaling_kind = 'PER_LEVEL' AND charge_amount IS NULL)
    )
  ),
  CONSTRAINT modifier_grant_payloads_charge_level_scaled_chk CHECK (
    charge_limit_kind IS DISTINCT FROM 'CHARACTER_LEVEL'
    AND charge_limit_kind IS DISTINCT FROM 'CLASS_LEVEL'
    AND charge_limit_kind IS DISTINCT FROM 'PARENT_CLASS_LEVEL'
    AND charge_limit_kind IS DISTINCT FROM 'SPELL_CAST_LEVEL'
    OR (
      charge_scaling_kind = 'NONE'
      AND charge_amount IS NULL
    )
  )
);

ALTER TABLE public.modifier_grant_payloads ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_modifier_grant_payloads_kind ON public.modifier_grant_payloads (modifier_kind);
CREATE INDEX IF NOT EXISTS idx_modifier_grant_payloads_domain ON public.modifier_grant_payloads (value_domain_code);
CREATE INDEX IF NOT EXISTS idx_modifier_grant_payloads_value_kind ON public.modifier_grant_payloads (numeric_value_kind);
CREATE INDEX IF NOT EXISTS idx_modifier_grant_payloads_damage_type ON public.modifier_grant_payloads (damage_type_id);
CREATE INDEX IF NOT EXISTS idx_modifier_grant_payloads_condition_type ON public.modifier_grant_payloads (condition_type_id);

CREATE TABLE IF NOT EXISTS public.modifier_grant_charge_levels (
  id uuid PRIMARY KEY,
  modifier_grant_id uuid NOT NULL REFERENCES public.modifier_grant_payloads (modifier_grant_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  level integer NOT NULL,
  amount integer NOT NULL,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT modifier_grant_charge_levels_level_chk CHECK (level > 0)
);

ALTER TABLE public.modifier_grant_charge_levels ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_modifier_grant_charge_levels_grant ON public.modifier_grant_charge_levels (modifier_grant_id);

CREATE TABLE IF NOT EXISTS public.modifier_grant_optional_abilities (
  modifier_grant_id uuid NOT NULL REFERENCES public.modifier_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  ability_code text NOT NULL,
  PRIMARY KEY (modifier_grant_id, ability_code)
);

ALTER TABLE public.modifier_grant_optional_abilities ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_modifier_grant_optional_abilities_grant ON public.modifier_grant_optional_abilities (modifier_grant_id);
