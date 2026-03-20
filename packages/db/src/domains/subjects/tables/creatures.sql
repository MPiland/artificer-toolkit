/* ──────────────────────────────────────────────
 * CREATURES — ROOT
 *
 * Intent:
 *   Stat block for a creature (monster, NPC, beast,
 *   companion, or summon). Reference content — not
 *   character lifecycle state.
 *
 * Cardinality:
 *   systems 1 ──▶ N creatures
 *
 * Ownership:
 *   creatures → details (owned)
 *   creatures → features (owned via bridge — traits)
 *   creatures → speeds (owned)
 *   creatures → actions (owned via bridge)
 *   creatures → damage_resistances/immunities/vulnerabilities (owned)
 *   creatures → condition_immunities (owned)
 *   Optional profiles stored as jsonb (tightly owned, rarely queried):
 *     legendary_profile, lair_profile, mount_profile,
 *     companion_profile, npc_profile
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

  record_kind text NOT NULL DEFAULT 'STAT_BLOCK',
  category text NOT NULL,              -- CreatureCategory
  creature_type_id uuid
    REFERENCES public.creature_types(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,
  size_code text,                      -- SizeCode
  alignment_id uuid
    REFERENCES public.alignments(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,
  tags text[],

  -- Core stats
  ability_scores jsonb,                -- Record<AbilityCode, number>
  armor_class integer,
  armor_class_note text,
  hit_points integer,
  hit_dice text,

  -- Senses / passives
  senses text[],
  passive_perception integer,

  -- Saving throws / skills (vocabulary IDs)
  saving_throw_proficiencies text[],
  skill_proficiencies text[],

  -- Social/rules
  languages text[],
  challenge_rating_id uuid
    REFERENCES public.challenge_ratings(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,
  xp integer,

  -- Logistics-only fields
  cost jsonb,
  carrying_capacity_amount numeric,
  carrying_capacity_unit text,
  logistics_notes text[],

  -- Optional rule profiles (presence = module applies)
  legendary_profile jsonb,             -- CreatureLegendaryProfile | null
  lair_profile jsonb,                  -- CreatureLairProfile | null
  mount_profile jsonb,                 -- CreatureMountProfile | null
  companion_profile jsonb,             -- CreatureCompanionProfile | null
  npc_profile jsonb,                   -- CreatureNpcProfile | null

  is_master boolean,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT creatures_category_chk CHECK (
    category IN ('NPC', 'MONSTER', 'BEAST', 'COMPANION', 'SUMMON')
  ),
  CONSTRAINT creatures_record_kind_chk CHECK (
    record_kind IN ('STAT_BLOCK', 'LOGISTICS')
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


/* ──────────────────────────────────────────────
 * CREATURE — DETAILS (OWNED)
 * ────────────────────────────────────────────── */

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


/* ──────────────────────────────────────────────
 * CREATURE — FEATURES / TRAITS (OWNED)
 * ────────────────────────────────────────────── */

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


/* ──────────────────────────────────────────────
 * CREATURE — SPEEDS (OWNED)
 * ────────────────────────────────────────────── */

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


/* ──────────────────────────────────────────────
 * CREATURE — ACTIONS (OWNED)
 *
 * Standard actions / bonus actions / reactions are stored
 * in a single table discriminated by action_type.
 * Legendary and lair actions are stored in the jsonb profiles.
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.creature_actions (
  id uuid PRIMARY KEY,

  creature_id uuid NOT NULL
    REFERENCES public.creatures(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  action_type text NOT NULL,           -- 'ACTION' | 'BONUS_ACTION' | 'REACTION'
  sort_order integer NOT NULL,

  label text NOT NULL,
  description text NOT NULL,
  attack_bonus integer,
  damage text,
  recharge text,

  CONSTRAINT creature_actions_type_chk CHECK (
    action_type IN ('ACTION', 'BONUS_ACTION', 'REACTION')
  )
);

ALTER TABLE public.creature_actions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_creature_actions_creature
  ON public.creature_actions(creature_id);


/* ──────────────────────────────────────────────
 * CREATURE — DAMAGE RESISTANCES (NORMALIZED)
 * ────────────────────────────────────────────── */

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


/* ──────────────────────────────────────────────
 * CREATURE — DAMAGE IMMUNITIES (NORMALIZED)
 * ────────────────────────────────────────────── */

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


/* ──────────────────────────────────────────────
 * CREATURE — DAMAGE VULNERABILITIES (NORMALIZED)
 * ────────────────────────────────────────────── */

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


/* ──────────────────────────────────────────────
 * CREATURE — CONDITION IMMUNITIES (NORMALIZED)
 * ────────────────────────────────────────────── */

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
