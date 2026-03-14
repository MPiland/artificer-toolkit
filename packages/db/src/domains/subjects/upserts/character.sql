/***************************
 * TABLES
 ***************************/
CREATE TABLE IF NOT EXISTS public.characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE DEFERRABLE,
  label text NOT NULL,
  description text,
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
    (method_code = 'EXPERIENCE' AND experience IS NULL)
    OR (method_code = 'MILESTONE' AND experience IS NULL)
    OR (method_code = 'EXPERIENCE' AND experience >= 0)
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
  subrace_id uuid REFERENCES public.race_subtypes (id) ON DELETE SET NULL DEFERRABLE,
  race_ancestry_option_id uuid REFERENCES public.race_ancestry_options (id) ON DELETE SET NULL DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_char_race_ancestry_option_id ON public.character_race (race_ancestry_option_id);

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
  subrace_id uuid REFERENCES public.race_subtypes (id) ON DELETE SET NULL DEFERRABLE,
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
  subclass_id uuid REFERENCES public.class_subtypes (id) ON DELETE SET NULL DEFERRABLE,
  subtype_id uuid REFERENCES public.class_subtypes (id) ON DELETE SET NULL DEFERRABLE,
  class_level integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_classes_class_level_chk CHECK (
    class_level > 0
  ),
  PRIMARY KEY (character_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_char_classes_class_id ON public.character_classes (class_id);

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
    method_code IN ('FIXED', 'MANUAL', 'ROLLED')
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
  PRIMARY KEY (character_id, char_level)
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
  PRIMARY KEY (character_id, char_level, roll_index)
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
  PRIMARY KEY (character_id, die)
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
  class_level integer NOT NULL,
  spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE CASCADE DEFERRABLE,
  state spell_state NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, class_id, class_level, spell_id)
);

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

CREATE TABLE IF NOT EXISTS public.character_spell_slots (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  slot_level integer NOT NULL,
  used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, class_id, slot_level)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_spell_slots_updated_at'
      AND tgrelid = 'public.character_spell_slots'::regclass) THEN
  CREATE TRIGGER trg_character_spell_slots_updated_at
    BEFORE UPDATE ON public.character_spell_slots
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_spell_slots ENABLE ROW LEVEL SECURITY;

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
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_char_equip_char_id ON public.character_equipment (character_id);

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

CREATE TABLE IF NOT EXISTS public.character_currency_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  container_id uuid REFERENCES public.character_equipment (id) ON DELETE SET NULL DEFERRABLE
);

CREATE INDEX IF NOT EXISTS idx_char_cur_groups_char_id ON public.character_currency_groups (character_id);

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
  currency_id uuid NOT NULL REFERENCES public.system_currencies (id) ON DELETE CASCADE DEFERRABLE,
  amount integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, currency_id)
);

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

  resource_grant_id uuid NOT NULL
    REFERENCES public.class_resources (id)
    ON DELETE CASCADE,
  used integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  PRIMARY KEY (character_id, resource_grant_id)
);

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
  subclass_id uuid REFERENCES public.class_subtypes (id) ON DELETE SET NULL DEFERRABLE,
  race_id uuid REFERENCES public.races (id) ON DELETE SET NULL DEFERRABLE,
  subrace_id uuid REFERENCES public.race_subtypes (id) ON DELETE SET NULL DEFERRABLE,
  ancestry_id uuid REFERENCES public.race_ancestries (id) ON DELETE SET NULL DEFERRABLE,
  option_id uuid REFERENCES public.options (id) ON DELETE SET NULL DEFERRABLE,
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
  )
);

CREATE INDEX IF NOT EXISTS idx_character_feature_acq_character_id ON public.character_feature_acquisitions (character_id);
CREATE INDEX IF NOT EXISTS idx_character_feature_acq_feature_id ON public.character_feature_acquisitions (feature_id);

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
  subclass_id uuid REFERENCES public.class_subtypes (id) ON DELETE SET NULL DEFERRABLE,
  feature_id uuid REFERENCES public.features (id) ON DELETE SET NULL DEFERRABLE,
  option_id uuid REFERENCES public.options (id) ON DELETE SET NULL DEFERRABLE,
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
  )
);

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
  id uuid PRIMARY KEY,
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  resource_id uuid NOT NULL REFERENCES public.class_resources (id) ON DELETE CASCADE DEFERRABLE,
  source_kind text NOT NULL,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  subclass_id uuid REFERENCES public.class_subtypes (id) ON DELETE SET NULL DEFERRABLE,
  feature_id uuid REFERENCES public.features (id) ON DELETE SET NULL DEFERRABLE,
  option_id uuid REFERENCES public.options (id) ON DELETE SET NULL DEFERRABLE,
  timing_kind text NOT NULL,
  timing_level integer,
  timing_class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  timing_class_level integer,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_resource_grants_source_kind_chk CHECK (
    source_kind IN ('CLASS', 'SUBCLASS', 'FEATURE', 'OPTION')
  ),
  CONSTRAINT character_resource_grants_timing_kind_chk CHECK (
    timing_kind IN ('IMMEDIATE', 'CHARACTER_LEVEL', 'CLASS_LEVEL')
  )
);

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

-- Abilities core selection
CREATE TABLE IF NOT EXISTS public.character_abilities (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE,
  selected_system uuid REFERENCES public.system_char_opts (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
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
  PRIMARY KEY (character_id, group_index)
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
  ability_id uuid REFERENCES public.system_abilities (id) ON DELETE SET NULL,
  die int,
  value int,
  id text,
  rolling boolean,
  applied boolean,
  is_kept boolean,
  PRIMARY KEY (character_id, group_index, id)
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

-- Manual overrides
CREATE TABLE IF NOT EXISTS public.character_abilities_manual_overrides (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  ability_id uuid NOT NULL REFERENCES public.system_abilities (id) ON DELETE CASCADE,
  score int,
  PRIMARY KEY (character_id, ability_id)
);

ALTER TABLE IF EXISTS public.character_abilities_manual_overrides
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_abilities_manual_overrides_updated_at'
      AND tgrelid = 'public.character_abilities_manual_overrides'::regclass) THEN
  CREATE TRIGGER trg_character_abilities_manual_overrides_updated_at
    BEFORE UPDATE ON public.character_abilities_manual_overrides
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_abilities_manual_overrides ENABLE ROW LEVEL SECURITY;

-- Point buy
CREATE TABLE IF NOT EXISTS public.character_abilities_point_buy (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE,
  points_left int
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
  id uuid NOT NULL,
  ability_id uuid REFERENCES public.system_abilities (id) ON DELETE SET NULL,
  PRIMARY KEY (character_id, id)
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
  idx int NOT NULL,
  ability_id uuid REFERENCES public.system_abilities (id) ON DELETE SET NULL,
  score int,
  PRIMARY KEY (character_id, idx)
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
  added_to_character boolean
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
  option_id uuid REFERENCES public.starting_equipment_options (id) ON DELETE SET NULL,
  PRIMARY KEY (character_id, group_id)
);

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
  selection_id uuid,
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 1,
  PRIMARY KEY (character_id, group_id, equipment_id)
);

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
  added_to_character boolean
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
  option_id uuid REFERENCES public.starting_equipment_options (id) ON DELETE SET NULL,
  PRIMARY KEY (character_id, group_id)
);

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
  selection_id uuid,
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 1,
  PRIMARY KEY (character_id, group_id, equipment_id)
);

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
