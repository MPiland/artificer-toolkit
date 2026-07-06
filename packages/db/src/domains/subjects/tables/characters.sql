/* ──────────────────────────────────────────────
 * CHARACTERS
 *
 * User-authored character persistence.
 * Characters are always user-owned and never master data.
 * ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE DEFERRABLE,
  label text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'DRAFT',
  CONSTRAINT chk_characters_status CHECK (status IN ('DRAFT', 'ACTIVE')),
  -- Persisted CharacterBuildState snapshot (null until first command is processed)
  build_state jsonb,
  -- Optimistic concurrency guard — incremented on every command write
  stream_version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_characters_system_id ON public.characters (system_id);

CREATE INDEX IF NOT EXISTS idx_characters_user_id ON public.characters (user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_characters_updated_at'
      AND tgrelid = 'public.characters'::regclass) THEN
  CREATE TRIGGER trg_characters_updated_at
    BEFORE UPDATE ON public.characters
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.characters ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_profile (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  alignment_id uuid REFERENCES public.alignments (id) ON DELETE SET NULL DEFERRABLE,
  lifestyle_id uuid REFERENCES public.lifestyles (id) ON DELETE SET NULL DEFERRABLE,
  faith text,
  gender text,
  age text,
  eyes text,
  hair text,
  skin text,
  height text,
  weight text,
  physical_characteristics text,
  personality_traits text,
  ideals text,
  bonds text,
  flaws text,
  organizations text,
  allies text,
  enemies text,
  backstory text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_profile_updated_at'
      AND tgrelid = 'public.character_profile'::regclass) THEN
  CREATE TRIGGER trg_character_profile_updated_at
    BEFORE UPDATE ON public.character_profile
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Character owners can read" ON public.characters;
CREATE POLICY "Character owners can read"
  ON public.characters FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR ((SELECT auth.jwt())::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  );

DROP POLICY IF EXISTS "Character owners can insert" ON public.characters;
CREATE POLICY "Character owners can insert"
  ON public.characters FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR ((SELECT auth.jwt())::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  );

DROP POLICY IF EXISTS "Character owners can update" ON public.characters;
CREATE POLICY "Character owners can update"
  ON public.characters FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR ((SELECT auth.jwt())::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR ((SELECT auth.jwt())::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  );

DROP POLICY IF EXISTS "Character owners can delete" ON public.characters;
CREATE POLICY "Character owners can delete"
  ON public.characters FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR ((SELECT auth.jwt())::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  );

CREATE TABLE IF NOT EXISTS public.character_advancement (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  method_code text NOT NULL,
  experience integer,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_advancement_method_chk CHECK (
    method_code IN ('EXPERIENCE', 'MILESTONE')
  ),
  CONSTRAINT character_advancement_experience_chk CHECK (
    (method_code = 'MILESTONE' AND experience IS NULL)
    OR (method_code = 'EXPERIENCE' AND (experience IS NULL OR experience >= 0))
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_advancement_updated_at'
      AND tgrelid = 'public.character_advancement'::regclass) THEN
  CREATE TRIGGER trg_character_advancement_updated_at
    BEFORE UPDATE ON public.character_advancement
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_advancement ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_race (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  race_id uuid NOT NULL REFERENCES public.races (id) ON DELETE CASCADE DEFERRABLE,
  subrace_id uuid REFERENCES public.races (id) ON DELETE SET NULL DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_char_race_race_id ON public.character_race (race_id);

CREATE INDEX IF NOT EXISTS idx_char_race_subrace_id ON public.character_race (subrace_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_race_updated_at'
      AND tgrelid = 'public.character_race'::regclass) THEN
  CREATE TRIGGER trg_character_race_updated_at
    BEFORE UPDATE ON public.character_race
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_race ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_background (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  background_id uuid NOT NULL REFERENCES public.backgrounds (id) ON DELETE CASCADE DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_char_background_background_id ON public.character_background (background_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_background_updated_at'
      AND tgrelid = 'public.character_background'::regclass) THEN
  CREATE TRIGGER trg_character_background_updated_at
    BEFORE UPDATE ON public.character_background
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_background ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_ancestry_acquisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  ancestry_id uuid NOT NULL REFERENCES public.race_ancestries (id) ON DELETE CASCADE DEFERRABLE,
  option_id uuid NOT NULL REFERENCES public.race_ancestry_options (id) ON DELETE CASCADE DEFERRABLE,
  source_kind text NOT NULL,
  race_id uuid REFERENCES public.races (id) ON DELETE SET NULL DEFERRABLE,
  subrace_id uuid REFERENCES public.races (id) ON DELETE SET NULL DEFERRABLE,
  timing_kind text NOT NULL,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  class_level integer,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_ancestry_source_kind_chk CHECK (
    source_kind IN ('RACE', 'SUBRACE')
  ),
  CONSTRAINT character_ancestry_source_ref_chk CHECK (
    ((race_id IS NOT NULL)::int + (subrace_id IS NOT NULL)::int) = 1
  ),
  CONSTRAINT character_ancestry_timing_kind_chk CHECK (
    timing_kind IN ('IMMEDIATE', 'CLASS_LEVEL')
  ),
  CONSTRAINT character_ancestry_class_level_chk CHECK (
    (timing_kind = 'CLASS_LEVEL' AND class_id IS NOT NULL AND class_level IS NOT NULL)
    OR (timing_kind = 'IMMEDIATE' AND class_id IS NULL AND class_level IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_char_ancestry_acq_character_id ON public.character_ancestry_acquisitions (character_id);
CREATE INDEX IF NOT EXISTS idx_char_ancestry_acq_ancestry_id ON public.character_ancestry_acquisitions (ancestry_id);
CREATE INDEX IF NOT EXISTS idx_char_ancestry_acq_option_id ON public.character_ancestry_acquisitions (option_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_ancestry_acquisitions_updated_at'
      AND tgrelid = 'public.character_ancestry_acquisitions'::regclass) THEN
  CREATE TRIGGER trg_character_ancestry_acquisitions_updated_at
    BEFORE UPDATE ON public.character_ancestry_acquisitions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_ancestry_acquisitions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_classes (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE DEFERRABLE,
  subclass_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  specialization_id uuid REFERENCES public.class_specializations (id) ON DELETE SET NULL DEFERRABLE,
  class_level integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_classes_class_level_chk CHECK (
    class_level > 0
  ),
  PRIMARY KEY (character_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_char_classes_class_id ON public.character_classes (class_id);
CREATE INDEX IF NOT EXISTS idx_char_classes_subclass_id ON public.character_classes (subclass_id);
CREATE INDEX IF NOT EXISTS idx_char_classes_specialization_id ON public.character_classes (specialization_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_classes_updated_at'
      AND tgrelid = 'public.character_classes'::regclass) THEN
  CREATE TRIGGER trg_character_classes_updated_at
    BEFORE UPDATE ON public.character_classes
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_classes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_hitpoint_intent (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  method_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_hitpoint_intent_method_chk CHECK (
    method_code IN ('FIXED', 'MANUAL')
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_hitpoint_intent_updated_at'
      AND tgrelid = 'public.character_hitpoint_intent'::regclass) THEN
  CREATE TRIGGER trg_character_hitpoint_intent_updated_at
    BEFORE UPDATE ON public.character_hitpoint_intent
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_hitpoint_intent ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_hitpoint_levels (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  char_level integer NOT NULL,
  value integer NOT NULL,
  overridden boolean,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, char_level),
  CONSTRAINT character_hitpoint_levels_value_chk CHECK (
    char_level > 0
    AND value >= 0
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_hitpoint_levels_updated_at'
      AND tgrelid = 'public.character_hitpoint_levels'::regclass) THEN
  CREATE TRIGGER trg_character_hitpoint_levels_updated_at
    BEFORE UPDATE ON public.character_hitpoint_levels
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_hitpoint_levels ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_hitpoint_level_rolls (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  char_level integer NOT NULL,
  roll_index integer NOT NULL,
  die integer NOT NULL,
  value integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, char_level, roll_index),
  CONSTRAINT character_hitpoint_level_rolls_value_chk CHECK (
    char_level > 0
    AND roll_index >= 0
    AND die > 0
    AND value >= 0
    AND value <= die
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_hitpoint_level_rolls_updated_at'
      AND tgrelid = 'public.character_hitpoint_level_rolls'::regclass) THEN
  CREATE TRIGGER trg_character_hitpoint_level_rolls_updated_at
    BEFORE UPDATE ON public.character_hitpoint_level_rolls
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_hitpoint_level_rolls ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_hitpoint_state (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  current integer,
  temp integer,
  max_override integer,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_hitpoint_state_nonnegative_chk CHECK (
    (current IS NULL OR current >= 0)
    AND (temp IS NULL OR temp >= 0)
    AND (max_override IS NULL OR max_override >= 0)
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_hitpoint_state_updated_at'
      AND tgrelid = 'public.character_hitpoint_state'::regclass) THEN
  CREATE TRIGGER trg_character_hitpoint_state_updated_at
    BEFORE UPDATE ON public.character_hitpoint_state
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_hitpoint_state ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_hit_dice_state (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  die integer NOT NULL,
  total integer NOT NULL,
  used integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, die),
  CONSTRAINT character_hit_dice_state_values_chk CHECK (
    die > 0
    AND total >= 0
    AND used >= 0
    AND used <= total
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_hit_dice_state_updated_at'
      AND tgrelid = 'public.character_hit_dice_state'::regclass) THEN
  CREATE TRIGGER trg_character_hit_dice_state_updated_at
    BEFORE UPDATE ON public.character_hit_dice_state
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_hit_dice_state ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_spell_slot_state (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  slot_key text NOT NULL,
  used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, slot_key),
  CONSTRAINT character_spell_slot_state_used_chk CHECK (used >= 0)
);

CREATE INDEX IF NOT EXISTS idx_character_spell_slot_state_character_id
  ON public.character_spell_slot_state (character_id);

ALTER TABLE IF EXISTS public.character_spell_slot_state ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_conditions (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  condition_type_id uuid NOT NULL REFERENCES public.condition_types (id) ON DELETE CASCADE DEFERRABLE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, condition_type_id)
);

CREATE INDEX IF NOT EXISTS idx_character_conditions_condition_type_id
  ON public.character_conditions (condition_type_id);

ALTER TABLE IF EXISTS public.character_conditions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_exhaustion (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  level integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_exhaustion_level_chk CHECK (level >= 0 AND level <= 6)
);

ALTER TABLE IF EXISTS public.character_exhaustion ENABLE ROW LEVEL SECURITY;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'spell_state'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.spell_state AS ENUM (
            'PREPARED',
            'KNOWN'
        );
    END IF;
END;
$$;


CREATE TABLE IF NOT EXISTS public.character_class_spells (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE DEFERRABLE,
  spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE CASCADE DEFERRABLE,
  state spell_state NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, class_id, spell_id)
);

CREATE INDEX IF NOT EXISTS idx_char_class_spells_class_id ON public.character_class_spells (class_id);
CREATE INDEX IF NOT EXISTS idx_char_class_spells_spell_id ON public.character_class_spells (spell_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_class_spells_updated_at'
      AND tgrelid = 'public.character_class_spells'::regclass) THEN
  CREATE TRIGGER trg_character_class_spells_updated_at
    BEFORE UPDATE ON public.character_class_spells
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_class_spells ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE,
  quantity integer NOT NULL DEFAULT 1,
  container_id uuid REFERENCES public.character_equipment (id) ON DELETE SET NULL DEFERRABLE,
  container_path text,
  custom_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_equipment_quantity_chk CHECK (
    quantity > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_char_equip_char_id ON public.character_equipment (character_id);
CREATE INDEX IF NOT EXISTS idx_char_equip_equipment_id ON public.character_equipment (equipment_id);
CREATE INDEX IF NOT EXISTS idx_char_equip_container_id ON public.character_equipment (container_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_equipment_updated_at'
      AND tgrelid = 'public.character_equipment'::regclass) THEN
  CREATE TRIGGER trg_character_equipment_updated_at
    BEFORE UPDATE ON public.character_equipment
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_equipment ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_equipped (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  equipment_id uuid NOT NULL REFERENCES public.character_equipment (id) ON DELETE CASCADE DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, equipment_id)
);

CREATE INDEX IF NOT EXISTS idx_char_equipped_equipment_id ON public.character_equipped (equipment_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_equipped_updated_at'
      AND tgrelid = 'public.character_equipped'::regclass) THEN
  CREATE TRIGGER trg_character_equipped_updated_at
    BEFORE UPDATE ON public.character_equipped
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_equipped ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_attuned (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  equipment_id uuid NOT NULL REFERENCES public.character_equipment (id) ON DELETE CASCADE DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, equipment_id)
);

CREATE INDEX IF NOT EXISTS idx_char_attuned_equipment_id ON public.character_attuned (equipment_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_attuned_updated_at'
      AND tgrelid = 'public.character_attuned'::regclass) THEN
  CREATE TRIGGER trg_character_attuned_updated_at
    BEFORE UPDATE ON public.character_attuned
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_attuned ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_creatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  creature_id uuid NOT NULL REFERENCES public.creatures (id) ON DELETE CASCADE DEFERRABLE,
  relationship_kind text NOT NULL,
  custom_name text,
  notes text,
  is_active boolean,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_creatures_relationship_kind_chk CHECK (
    relationship_kind IN ('MOUNT', 'COMPANION', 'OWNED', 'SUMMONED')
  )
);

CREATE INDEX IF NOT EXISTS idx_character_creatures_character_id
  ON public.character_creatures (character_id);

CREATE INDEX IF NOT EXISTS idx_character_creatures_creature_id
  ON public.character_creatures (creature_id);

ALTER TABLE IF EXISTS public.character_creatures ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles (id) ON DELETE CASCADE DEFERRABLE,
  custom_name text,
  notes text,
  is_active boolean,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_character_vehicles_character_id
  ON public.character_vehicles (character_id);

CREATE INDEX IF NOT EXISTS idx_character_vehicles_vehicle_id
  ON public.character_vehicles (vehicle_id);

ALTER TABLE IF EXISTS public.character_vehicles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_creature_equipment (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  character_creature_id uuid NOT NULL REFERENCES public.character_creatures (id) ON DELETE CASCADE DEFERRABLE,
  equipment_id uuid NOT NULL REFERENCES public.character_equipment (id) ON DELETE CASCADE DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_creature_id, equipment_id)
);

CREATE INDEX IF NOT EXISTS idx_character_creature_equipment_character_id
  ON public.character_creature_equipment (character_id);

ALTER TABLE IF EXISTS public.character_creature_equipment ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_vehicle_equipment (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  character_vehicle_id uuid NOT NULL REFERENCES public.character_vehicles (id) ON DELETE CASCADE DEFERRABLE,
  equipment_id uuid NOT NULL REFERENCES public.character_equipment (id) ON DELETE CASCADE DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_vehicle_id, equipment_id)
);

CREATE INDEX IF NOT EXISTS idx_character_vehicle_equipment_character_id
  ON public.character_vehicle_equipment (character_id);

ALTER TABLE IF EXISTS public.character_vehicle_equipment ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_currency_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  container_id uuid REFERENCES public.character_equipment (id) ON DELETE SET NULL DEFERRABLE
);

CREATE INDEX IF NOT EXISTS idx_char_cur_groups_char_id ON public.character_currency_groups (character_id);
CREATE INDEX IF NOT EXISTS idx_char_cur_groups_container_id ON public.character_currency_groups (container_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_currency_groups_updated_at'
      AND tgrelid = 'public.character_currency_groups'::regclass) THEN
  CREATE TRIGGER trg_character_currency_groups_updated_at
    BEFORE UPDATE ON public.character_currency_groups
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_currency_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_currencies (
  group_id uuid NOT NULL REFERENCES public.character_currency_groups (id) ON DELETE CASCADE DEFERRABLE,
  currency_id uuid NOT NULL REFERENCES public.currencies (id) ON DELETE CASCADE DEFERRABLE,
  amount integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, currency_id),
  CONSTRAINT character_currencies_amount_chk CHECK (
    amount >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_character_currencies_currency_id
  ON public.character_currencies (currency_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_currencies_updated_at'
      AND tgrelid = 'public.character_currencies'::regclass) THEN
  CREATE TRIGGER trg_character_currencies_updated_at
    BEFORE UPDATE ON public.character_currencies
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_currencies ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_resources (
  character_id uuid NOT NULL
    REFERENCES public.characters (id)
    ON DELETE CASCADE,

  resource_grant_id text NOT NULL
    ,
  used integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  PRIMARY KEY (character_id, resource_grant_id),
  CONSTRAINT character_resources_used_chk CHECK (
    used >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_character_resources_resource_grant_id
  ON public.character_resources (resource_grant_id);

ALTER TABLE IF EXISTS public.character_resources ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_resources_updated_at'
      AND tgrelid = 'public.character_resources'::regclass) THEN
  CREATE TRIGGER trg_character_resources_updated_at
    BEFORE UPDATE ON public.character_resources
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.character_feature_acquisitions (
  id uuid PRIMARY KEY,
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
  source_kind text NOT NULL,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  subclass_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  race_id uuid REFERENCES public.races (id) ON DELETE SET NULL DEFERRABLE,
  subrace_id uuid REFERENCES public.races (id) ON DELETE SET NULL DEFERRABLE,
  ancestry_id uuid REFERENCES public.race_ancestries (id) ON DELETE SET NULL DEFERRABLE,
  option_id uuid REFERENCES public.options (id) ON DELETE SET NULL DEFERRABLE,
  acquired_parent_id uuid REFERENCES public.character_feature_acquisitions (id) ON DELETE SET NULL DEFERRABLE,
  background_id uuid REFERENCES public.backgrounds (id) ON DELETE SET NULL DEFERRABLE,
  feat_id uuid REFERENCES public.feats (id) ON DELETE SET NULL DEFERRABLE,
  reason text,
  timing_kind text NOT NULL,
  timing_level integer,
  timing_class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  timing_class_level integer,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_feature_acq_source_kind_chk CHECK (
    source_kind IN ('CLASS', 'SUBCLASS', 'RACE', 'SUBRACE', 'ANCESTRY', 'BACKGROUND', 'FEAT', 'FEATURE', 'OPTION', 'MANUAL')
  ),
  CONSTRAINT character_feature_acq_timing_kind_chk CHECK (
    timing_kind IN ('IMMEDIATE', 'CHARACTER_LEVEL', 'CLASS_LEVEL')
  ),
  CONSTRAINT character_feature_acq_option_parent_chk CHECK (
    (source_kind = 'OPTION' AND option_id IS NOT NULL AND acquired_parent_id IS NOT NULL)
    OR (source_kind <> 'OPTION' AND acquired_parent_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_character_feature_acq_character_id ON public.character_feature_acquisitions (character_id);
CREATE INDEX IF NOT EXISTS idx_character_feature_acq_feature_id ON public.character_feature_acquisitions (feature_id);
CREATE INDEX IF NOT EXISTS idx_character_feature_acq_parent_id ON public.character_feature_acquisitions (acquired_parent_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_feature_acquisitions_updated_at'
      AND tgrelid = 'public.character_feature_acquisitions'::regclass) THEN
  CREATE TRIGGER trg_character_feature_acquisitions_updated_at
    BEFORE UPDATE ON public.character_feature_acquisitions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_feature_acquisitions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_feature_selection_records (
  feature_acquisition_id uuid NOT NULL REFERENCES public.character_feature_acquisitions (id) ON DELETE CASCADE DEFERRABLE,
  selection_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (feature_acquisition_id, selection_key)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_feature_selection_records_updated_at'
      AND tgrelid = 'public.character_feature_selection_records'::regclass) THEN
  CREATE TRIGGER trg_character_feature_selection_records_updated_at
    BEFORE UPDATE ON public.character_feature_selection_records
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_feature_selection_records ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_feature_selection_values (
  feature_acquisition_id uuid NOT NULL,
  selection_key text NOT NULL,
  value_index integer NOT NULL,
  value_kind text NOT NULL,
  text_value text,
  number_value numeric,
  boolean_value boolean,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (feature_acquisition_id, selection_key, value_index),
  FOREIGN KEY (feature_acquisition_id, selection_key)
    REFERENCES public.character_feature_selection_records (feature_acquisition_id, selection_key)
    ON DELETE CASCADE DEFERRABLE,
  CONSTRAINT character_feature_selection_value_kind_chk CHECK (
    value_kind IN ('ID', 'IDS', 'NUMBER', 'BOOLEAN')
  ),
  CONSTRAINT character_feature_selection_value_payload_chk CHECK (
    (
      value_kind IN ('ID', 'IDS')
      AND text_value IS NOT NULL
      AND number_value IS NULL
      AND boolean_value IS NULL
    )
    OR (
      value_kind = 'NUMBER'
      AND text_value IS NULL
      AND number_value IS NOT NULL
      AND boolean_value IS NULL
    )
    OR (
      value_kind = 'BOOLEAN'
      AND text_value IS NULL
      AND number_value IS NULL
      AND boolean_value IS NOT NULL
    )
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_feature_selection_values_updated_at'
      AND tgrelid = 'public.character_feature_selection_values'::regclass) THEN
  CREATE TRIGGER trg_character_feature_selection_values_updated_at
    BEFORE UPDATE ON public.character_feature_selection_values
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_feature_selection_values ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_spell_selections (
  id uuid PRIMARY KEY,
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  source_kind text NOT NULL,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  subclass_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  feature_id uuid REFERENCES public.features (id) ON DELETE SET NULL DEFERRABLE,
  option_id uuid REFERENCES public.options (id) ON DELETE SET NULL DEFERRABLE,
  acquired_parent_id uuid REFERENCES public.character_feature_acquisitions (id) ON DELETE SET NULL DEFERRABLE,
  timing_kind text NOT NULL,
  timing_level integer,
  timing_class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  timing_class_level integer,
  replaced_selection_id uuid REFERENCES public.character_spell_selections (id) ON DELETE SET NULL DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_spell_selection_source_kind_chk CHECK (
    source_kind IN ('CLASS', 'SUBCLASS', 'FEATURE', 'OPTION')
  ),
  CONSTRAINT character_spell_selection_timing_kind_chk CHECK (
    timing_kind IN ('IMMEDIATE', 'CHARACTER_LEVEL', 'CLASS_LEVEL')
  ),
  CONSTRAINT character_spell_selection_source_ref_chk CHECK (
    (source_kind = 'CLASS' AND class_id IS NOT NULL AND subclass_id IS NULL AND feature_id IS NULL AND option_id IS NULL AND acquired_parent_id IS NULL)
    OR (source_kind = 'SUBCLASS' AND class_id IS NULL AND subclass_id IS NOT NULL AND feature_id IS NULL AND option_id IS NULL AND acquired_parent_id IS NULL)
    OR (source_kind = 'FEATURE' AND class_id IS NULL AND subclass_id IS NULL AND feature_id IS NOT NULL AND option_id IS NULL AND acquired_parent_id IS NULL)
    OR (source_kind = 'OPTION' AND class_id IS NULL AND subclass_id IS NULL AND feature_id IS NULL AND option_id IS NOT NULL AND acquired_parent_id IS NOT NULL)
  ),
  CONSTRAINT character_spell_selection_timing_ref_chk CHECK (
    (timing_kind = 'IMMEDIATE' AND timing_level IS NULL AND timing_class_id IS NULL AND timing_class_level IS NULL)
    OR (timing_kind = 'CHARACTER_LEVEL' AND timing_level IS NOT NULL AND timing_level > 0 AND timing_class_id IS NULL AND timing_class_level IS NULL)
    OR (timing_kind = 'CLASS_LEVEL' AND timing_level IS NULL AND timing_class_id IS NOT NULL AND timing_class_level IS NOT NULL AND timing_class_level > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_character_spell_selections_character_id
  ON public.character_spell_selections (character_id);

CREATE INDEX IF NOT EXISTS idx_character_spell_selections_replaced_selection_id
  ON public.character_spell_selections (replaced_selection_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_spell_selections_updated_at'
      AND tgrelid = 'public.character_spell_selections'::regclass) THEN
  CREATE TRIGGER trg_character_spell_selections_updated_at
    BEFORE UPDATE ON public.character_spell_selections
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_spell_selections ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_spell_selection_spells (
  selection_id uuid NOT NULL REFERENCES public.character_spell_selections (id) ON DELETE CASCADE DEFERRABLE,
  spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE CASCADE DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (selection_id, spell_id)
);

CREATE INDEX IF NOT EXISTS idx_character_spell_selection_spells_spell_id
  ON public.character_spell_selection_spells (spell_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_spell_selection_spells_updated_at'
      AND tgrelid = 'public.character_spell_selection_spells'::regclass) THEN
  CREATE TRIGGER trg_character_spell_selection_spells_updated_at
    BEFORE UPDATE ON public.character_spell_selection_spells
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_spell_selection_spells ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_resource_grants (
  id text NOT NULL,
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  resource_id uuid NOT NULL REFERENCES public.class_resources (id) ON DELETE CASCADE DEFERRABLE,
  source_kind text NOT NULL,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  subclass_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  feature_id uuid REFERENCES public.features (id) ON DELETE SET NULL DEFERRABLE,
  option_id uuid REFERENCES public.options (id) ON DELETE SET NULL DEFERRABLE,
  acquired_parent_id uuid REFERENCES public.character_feature_acquisitions (id) ON DELETE SET NULL DEFERRABLE,
  timing_kind text NOT NULL,
  timing_level integer,
  timing_class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  timing_class_level integer,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, id),
  CONSTRAINT character_resource_grants_source_kind_chk CHECK (
    source_kind IN ('CLASS', 'SUBCLASS', 'FEATURE', 'OPTION')
  ),
  CONSTRAINT character_resource_grants_timing_kind_chk CHECK (
    timing_kind IN ('IMMEDIATE', 'CHARACTER_LEVEL', 'CLASS_LEVEL')
  ),
  CONSTRAINT character_resource_grants_source_ref_chk CHECK (
    (source_kind = 'CLASS' AND class_id IS NOT NULL AND subclass_id IS NULL AND feature_id IS NULL AND option_id IS NULL AND acquired_parent_id IS NULL)
    OR (source_kind = 'SUBCLASS' AND class_id IS NULL AND subclass_id IS NOT NULL AND feature_id IS NULL AND option_id IS NULL AND acquired_parent_id IS NULL)
    OR (source_kind = 'FEATURE' AND class_id IS NULL AND subclass_id IS NULL AND feature_id IS NOT NULL AND option_id IS NULL AND acquired_parent_id IS NULL)
    OR (source_kind = 'OPTION' AND class_id IS NULL AND subclass_id IS NULL AND feature_id IS NULL AND option_id IS NOT NULL AND acquired_parent_id IS NOT NULL)
  ),
  CONSTRAINT character_resource_grants_timing_ref_chk CHECK (
    (timing_kind = 'IMMEDIATE' AND timing_level IS NULL AND timing_class_id IS NULL AND timing_class_level IS NULL)
    OR (timing_kind = 'CHARACTER_LEVEL' AND timing_level IS NOT NULL AND timing_level > 0 AND timing_class_id IS NULL AND timing_class_level IS NULL)
    OR (timing_kind = 'CLASS_LEVEL' AND timing_level IS NULL AND timing_class_id IS NOT NULL AND timing_class_level IS NOT NULL AND timing_class_level > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_character_resource_grants_character_id
  ON public.character_resource_grants (character_id);

CREATE INDEX IF NOT EXISTS idx_character_resource_grants_resource_id
  ON public.character_resource_grants (resource_id);

CREATE INDEX IF NOT EXISTS idx_character_resource_grants_parent_id
  ON public.character_resource_grants (acquired_parent_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_resource_grants_updated_at'
      AND tgrelid = 'public.character_resource_grants'::regclass) THEN
  CREATE TRIGGER trg_character_resource_grants_updated_at
    BEFORE UPDATE ON public.character_resource_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_resource_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_constraint
    WHERE
      conname = 'character_resources_resource_grant_id_fkey'
      AND conrelid = 'public.character_resources'::regclass) THEN
  ALTER TABLE public.character_resources
    ADD CONSTRAINT character_resources_resource_grant_id_fkey
    FOREIGN KEY (character_id, resource_grant_id)
    REFERENCES public.character_resource_grants (character_id, id)
    ON DELETE CASCADE
    DEFERRABLE;
END IF;
END;
$$;

-- Abilities core selection
CREATE TABLE IF NOT EXISTS public.character_abilities (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE,
  method_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_abilities_method_chk CHECK (
    method_code IN ('STANDARD_ARRAY', 'POINT_BUY', 'MANUAL_ROLLED')
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_abilities_updated_at'
      AND tgrelid = 'public.character_abilities'::regclass) THEN
  CREATE TRIGGER trg_character_abilities_updated_at
    BEFORE UPDATE ON public.character_abilities
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_abilities ENABLE ROW LEVEL SECURITY;

-- Manual rolled
CREATE TABLE IF NOT EXISTS public.character_abilities_manual_rolled (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE,
  configuration text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_abilities_manual_rolled_updated_at'
      AND tgrelid = 'public.character_abilities_manual_rolled'::regclass) THEN
  CREATE TRIGGER trg_character_abilities_manual_rolled_updated_at
    BEFORE UPDATE ON public.character_abilities_manual_rolled
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_abilities_manual_rolled ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_abilities_manual_rolled_groups (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  group_index int NOT NULL,
  id text NOT NULL,
  assigned_ability_code text,
  score int NOT NULL,
  applied boolean,
  rolling boolean,
  PRIMARY KEY (character_id, group_index),
  CONSTRAINT character_abilities_manual_rolled_groups_score_chk CHECK (
    score >= 0
  ),
  CONSTRAINT character_abilities_manual_rolled_groups_id_uniq UNIQUE (character_id, id)
);

ALTER TABLE IF EXISTS public.character_abilities_manual_rolled_groups
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_abilities_manual_rolled_groups_updated_at'
      AND tgrelid = 'public.character_abilities_manual_rolled_groups'::regclass) THEN
  CREATE TRIGGER trg_character_abilities_manual_rolled_groups_updated_at
    BEFORE UPDATE ON public.character_abilities_manual_rolled_groups
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_abilities_manual_rolled_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_abilities_manual_rolled_rolls (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  group_index int NOT NULL,
  roll_index int NOT NULL,
  die int NOT NULL,
  value int NOT NULL,
  is_kept boolean,
  PRIMARY KEY (character_id, group_index, roll_index),
  CONSTRAINT character_abilities_manual_rolled_rolls_die_chk CHECK (
    die > 0
  ),
  CONSTRAINT character_abilities_manual_rolled_rolls_value_chk CHECK (
    value >= 0 AND value <= die
  )
);

ALTER TABLE IF EXISTS public.character_abilities_manual_rolled_rolls
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_abilities_manual_rolled_rolls_updated_at'
      AND tgrelid = 'public.character_abilities_manual_rolled_rolls'::regclass) THEN
  CREATE TRIGGER trg_character_abilities_manual_rolled_rolls_updated_at
    BEFORE UPDATE ON public.character_abilities_manual_rolled_rolls
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_abilities_manual_rolled_rolls ENABLE ROW LEVEL SECURITY;

-- Manual rolled assignments
CREATE TABLE IF NOT EXISTS public.character_abilities_manual_assignments (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  ability_code text NOT NULL,
  score int NOT NULL,
  PRIMARY KEY (character_id, ability_code),
  CONSTRAINT character_abilities_manual_assignments_score_chk CHECK (
    score >= 0
  )
);

ALTER TABLE IF EXISTS public.character_abilities_manual_assignments
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_abilities_manual_assignments_updated_at'
      AND tgrelid = 'public.character_abilities_manual_assignments'::regclass) THEN
  CREATE TRIGGER trg_character_abilities_manual_assignments_updated_at
    BEFORE UPDATE ON public.character_abilities_manual_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_abilities_manual_assignments ENABLE ROW LEVEL SECURITY;

-- Point buy
CREATE TABLE IF NOT EXISTS public.character_abilities_point_buy (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE
);

ALTER TABLE IF EXISTS public.character_abilities_point_buy
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_abilities_point_buy_updated_at'
      AND tgrelid = 'public.character_abilities_point_buy'::regclass) THEN
  CREATE TRIGGER trg_character_abilities_point_buy_updated_at
    BEFORE UPDATE ON public.character_abilities_point_buy
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_abilities_point_buy ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_abilities_point_buy_distributed (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  ability_code text NOT NULL,
  option_code text NOT NULL,
  PRIMARY KEY (character_id, ability_code),
  CONSTRAINT character_abilities_point_buy_option_chk CHECK (
    option_code IN ('8', '9', '10', '11', '12', '13', '14', '15')
  )
);

ALTER TABLE IF EXISTS public.character_abilities_point_buy_distributed
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_abilities_point_buy_distributed_updated_at'
      AND tgrelid = 'public.character_abilities_point_buy_distributed'::regclass) THEN
  CREATE TRIGGER trg_character_abilities_point_buy_distributed_updated_at
    BEFORE UPDATE ON public.character_abilities_point_buy_distributed
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_abilities_point_buy_distributed ENABLE ROW LEVEL SECURITY;

-- Standard array
CREATE TABLE IF NOT EXISTS public.character_abilities_standard_array (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  ability_code text NOT NULL,
  option_code text NOT NULL,
  PRIMARY KEY (character_id, ability_code),
  CONSTRAINT character_abilities_standard_array_option_chk CHECK (
    option_code IN ('8', '10', '12', '13', '14', '15')
  )
);

ALTER TABLE IF EXISTS public.character_abilities_standard_array
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_abilities_standard_array_updated_at'
      AND tgrelid = 'public.character_abilities_standard_array'::regclass) THEN
  CREATE TRIGGER trg_character_abilities_standard_array_updated_at
    BEFORE UPDATE ON public.character_abilities_standard_array
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_abilities_standard_array ENABLE ROW LEVEL SECURITY;

-- Class starting equipment selections per character
CREATE TABLE IF NOT EXISTS public.character_class_equipment_session (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE,
  option uuid REFERENCES public.starting_equipment_options (id) ON DELETE SET NULL,
  gold_option uuid REFERENCES public.starting_equipment_options (id) ON DELETE SET NULL,
  total_gold int,
  applied boolean,
  CONSTRAINT character_class_equipment_session_choice_chk CHECK (
    ((option IS NOT NULL)::int + (gold_option IS NOT NULL)::int) <= 1
  ),
  CONSTRAINT character_class_equipment_session_gold_chk CHECK (
    (gold_option IS NOT NULL AND total_gold IS NOT NULL AND total_gold >= 0)
    OR (gold_option IS NULL AND total_gold IS NULL)
  )
);

ALTER TABLE IF EXISTS public.character_class_equipment_session
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_class_equipment_session_updated_at'
      AND tgrelid = 'public.character_class_equipment_session'::regclass) THEN
  CREATE TRIGGER trg_character_class_equipment_session_updated_at
    BEFORE UPDATE ON public.character_class_equipment_session
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_class_equipment_session ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_class_equipment_groups (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.starting_equipment_groups (id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.starting_equipment_options (id) ON DELETE CASCADE,
  PRIMARY KEY (character_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_char_class_equip_groups_option_id
  ON public.character_class_equipment_groups (option_id);

ALTER TABLE IF EXISTS public.character_class_equipment_groups
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_class_equipment_groups_updated_at'
      AND tgrelid = 'public.character_class_equipment_groups'::regclass) THEN
  CREATE TRIGGER trg_character_class_equipment_groups_updated_at
    BEFORE UPDATE ON public.character_class_equipment_groups
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_class_equipment_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_class_equipment_items (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.starting_equipment_groups (id) ON DELETE CASCADE,
  selection_item_id uuid REFERENCES public.starting_equipment_option_items (id) ON DELETE SET NULL,
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 1,
  PRIMARY KEY (character_id, group_id, equipment_id),
  CONSTRAINT character_class_equipment_items_quantity_chk CHECK (
    quantity > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_char_class_equip_items_selection_item_id
  ON public.character_class_equipment_items (selection_item_id);

CREATE INDEX IF NOT EXISTS idx_char_class_equip_items_equipment_id
  ON public.character_class_equipment_items (equipment_id);

ALTER TABLE IF EXISTS public.character_class_equipment_items
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_class_equipment_items_updated_at'
      AND tgrelid = 'public.character_class_equipment_items'::regclass) THEN
  CREATE TRIGGER trg_character_class_equipment_items_updated_at
    BEFORE UPDATE ON public.character_class_equipment_items
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_class_equipment_items ENABLE ROW LEVEL SECURITY;

-- Background starting equipment selections per character
CREATE TABLE IF NOT EXISTS public.character_background_equipment_session (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE,
  applied boolean
);

ALTER TABLE IF EXISTS public.character_background_equipment_session
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_background_equipment_session_updated_at'
      AND tgrelid = 'public.character_background_equipment_session'::regclass) THEN
  CREATE TRIGGER trg_character_background_equipment_session_updated_at
    BEFORE UPDATE ON public.character_background_equipment_session
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_background_equipment_session ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_background_equipment_groups (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.starting_equipment_groups (id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.starting_equipment_options (id) ON DELETE CASCADE,
  PRIMARY KEY (character_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_char_bg_equip_groups_option_id
  ON public.character_background_equipment_groups (option_id);

ALTER TABLE IF EXISTS public.character_background_equipment_groups
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_background_equipment_groups_updated_at'
      AND tgrelid = 'public.character_background_equipment_groups'::regclass) THEN
  CREATE TRIGGER trg_character_background_equipment_groups_updated_at
    BEFORE UPDATE ON public.character_background_equipment_groups
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_background_equipment_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_background_equipment_items (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.starting_equipment_groups (id) ON DELETE CASCADE,
  selection_item_id uuid REFERENCES public.starting_equipment_option_items (id) ON DELETE SET NULL,
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 1,
  PRIMARY KEY (character_id, group_id, equipment_id),
  CONSTRAINT character_background_equipment_items_quantity_chk CHECK (
    quantity > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_char_bg_equip_items_selection_item_id
  ON public.character_background_equipment_items (selection_item_id);

CREATE INDEX IF NOT EXISTS idx_char_bg_equip_items_equipment_id
  ON public.character_background_equipment_items (equipment_id);

ALTER TABLE IF EXISTS public.character_background_equipment_items
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_background_equipment_items_updated_at'
      AND tgrelid = 'public.character_background_equipment_items'::regclass) THEN
  CREATE TRIGGER trg_character_background_equipment_items_updated_at
    BEFORE UPDATE ON public.character_background_equipment_items
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_background_equipment_items ENABLE ROW LEVEL SECURITY;
