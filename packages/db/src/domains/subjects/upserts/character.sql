/***************************
 * TABLES
 ***************************/
CREATE TABLE IF NOT EXISTS public.characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE DEFERRABLE,
  label text NOT NULL,
  description text,
  advancement_id uuid REFERENCES public.system_char_opts (id) ON DELETE SET NULL DEFERRABLE,
  exp_id uuid REFERENCES public.system_char_opts (id) ON DELETE SET NULL DEFERRABLE,
  race_id uuid REFERENCES public.races (id) ON DELETE SET NULL DEFERRABLE,
  background_id uuid REFERENCES public.backgrounds (id) ON DELETE SET NULL DEFERRABLE,
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

CREATE TABLE IF NOT EXISTS public.character_race (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  race_id uuid NOT NULL REFERENCES public.races (id) ON DELETE CASCADE DEFERRABLE,
  race_ancestry_option_id uuid REFERENCES public.race_ancestry_options (id) ON DELETE SET NULL DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_char_race_ancestry_option_id ON public.character_race (race_ancestry_option_id);

CREATE INDEX IF NOT EXISTS idx_char_race_race_id ON public.character_race (race_id);

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

CREATE TABLE IF NOT EXISTS public.character_classes (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE DEFERRABLE,
  subclass_id uuid REFERENCES public.class_subtypes (id) ON DELETE SET NULL DEFERRABLE,
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

CREATE TABLE IF NOT EXISTS public.character_hitpoint (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  method_id uuid REFERENCES public.system_char_opts (id) ON DELETE SET NULL DEFERRABLE,
  max_override integer,
  max_hitpoints integer,
  temp integer,
  bonus integer,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_char_hitpoint_method_id ON public.character_hitpoint (method_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_hitpoint_updated_at'
      AND tgrelid = 'public.character_hitpoint'::regclass) THEN
  CREATE TRIGGER trg_character_hitpoint_updated_at
    BEFORE UPDATE ON public.character_hitpoint
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_hitpoint ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_hitpoint_roll_values (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  char_level integer NOT NULL,
  value integer NOT NULL,
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
      tgname = 'trg_character_hitpoint_roll_values_updated_at'
      AND tgrelid = 'public.character_hitpoint_roll_values'::regclass) THEN
  CREATE TRIGGER trg_character_hitpoint_roll_values_updated_at
    BEFORE UPDATE ON public.character_hitpoint_roll_values
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_hitpoint_roll_values ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_hitpoint_roll_state (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  total integer,
  current integer,
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
      tgname = 'trg_character_hitpoint_roll_state_updated_at'
      AND tgrelid = 'public.character_hitpoint_roll_state'::regclass) THEN
  CREATE TRIGGER trg_character_hitpoint_roll_state_updated_at
    BEFORE UPDATE ON public.character_hitpoint_roll_state
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_hitpoint_roll_state ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_hitpoint_fixed_state (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  total integer,
  current integer,
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
      tgname = 'trg_character_hitpoint_fixed_state_updated_at'
      AND tgrelid = 'public.character_hitpoint_fixed_state'::regclass) THEN
  CREATE TRIGGER trg_character_hitpoint_fixed_state_updated_at
    BEFORE UPDATE ON public.character_hitpoint_fixed_state
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_hitpoint_fixed_state ENABLE ROW LEVEL SECURITY;


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

CREATE TABLE IF NOT EXISTS public.character_spell_additional (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE CASCADE,
  gm_override boolean,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_char_spell_additional_char_id ON public.character_spell_additional (character_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_spell_additional_updated_at'
      AND tgrelid = 'public.character_spell_additional'::regclass) THEN
  CREATE TRIGGER trg_character_spell_additional_updated_at
    BEFORE UPDATE ON public.character_spell_additional
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_spell_additional ENABLE ROW LEVEL SECURITY;

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
  container_id uuid REFERENCES public.equipment (id) ON DELETE SET NULL DEFERRABLE,
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
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE,
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
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE,
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
  container_id uuid REFERENCES public.equipment (id) ON DELETE SET NULL DEFERRABLE
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

  class_resource_id uuid NOT NULL
    REFERENCES public.class_resource (id)
    ON DELETE CASCADE,

  class_id uuid NOT NULL
    REFERENCES public.classes (id)
    ON DELETE CASCADE,

  current integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  PRIMARY KEY (character_id, class_resource_id)
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

CREATE TABLE IF NOT EXISTS public.character_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  ui_key text,
  feature_level integer,
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  race_id uuid REFERENCES public.races (id) ON DELETE SET NULL DEFERRABLE,
  ancestry_id uuid REFERENCES public.race_ancestry_options (id) ON DELETE SET NULL DEFERRABLE,
  background_id uuid REFERENCES public.backgrounds (id) ON DELETE SET NULL DEFERRABLE,
  equipment_id uuid REFERENCES public.equipment (id) ON DELETE SET NULL DEFERRABLE,
  feat_id uuid REFERENCES public.feats (id) ON DELETE SET NULL DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_features_one_source_chk CHECK (
    ((class_id IS NOT NULL)::int
    + (race_id IS NOT NULL)::int
    + (ancestry_id IS NOT NULL)::int
    + (background_id IS NOT NULL)::int
    + (equipment_id IS NOT NULL)::int
    + (feat_id IS NOT NULL)::int) = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_char_features_char_id ON public.character_features (character_id);

CREATE INDEX IF NOT EXISTS idx_char_features_feature_id ON public.character_features (feature_id);

CREATE INDEX IF NOT EXISTS idx_char_features_sources ON public.character_features (class_id, race_id, ancestry_id, background_id, equipment_id, feat_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_features_updated_at'
      AND tgrelid = 'public.character_features'::regclass) THEN
  CREATE TRIGGER trg_character_features_updated_at
    BEFORE UPDATE ON public.character_features
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_features ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_subfeature_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  character_feature_id uuid NOT NULL REFERENCES public.character_features (id) ON DELETE CASCADE DEFERRABLE,
  suboption_id uuid NOT NULL REFERENCES public.subfeature_options (id) ON DELETE CASCADE DEFERRABLE,
  ui_key text,
  feature_level integer,
  granted_at_level integer,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_opts_cfeat ON public.character_subfeature_options (character_feature_id);
CREATE INDEX IF NOT EXISTS idx_char_subfeature_opts_sopt ON public.character_subfeature_options (suboption_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_subfeature_options_updated_at'
      AND tgrelid = 'public.character_subfeature_options'::regclass) THEN
  CREATE TRIGGER trg_character_subfeature_options_updated_at
    BEFORE UPDATE ON public.character_subfeature_options
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_subfeature_options ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_subfeature_feats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  ui_key text,
  feature_level integer,
  granted_at_level integer,
  feature_id uuid REFERENCES public.features (id) ON DELETE SET NULL DEFERRABLE,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  race_id uuid REFERENCES public.races (id) ON DELETE SET NULL DEFERRABLE,
  ancestry_id uuid REFERENCES public.race_ancestry_options (id) ON DELETE SET NULL DEFERRABLE,
  background_id uuid REFERENCES public.backgrounds (id) ON DELETE SET NULL DEFERRABLE,
  equipment_id uuid REFERENCES public.equipment (id) ON DELETE SET NULL DEFERRABLE,
  suboption_id uuid REFERENCES public.subfeature_options (id) ON DELETE SET NULL DEFERRABLE,
  subfeature_feat_id uuid NOT NULL REFERENCES public.subfeature_feats (id) ON DELETE CASCADE DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_feats_one_source_chk CHECK (
    ((feature_id IS NOT NULL)::int
    + (class_id IS NOT NULL)::int
    + (race_id IS NOT NULL)::int
    + (ancestry_id IS NOT NULL)::int
    + (background_id IS NOT NULL)::int
    + (equipment_id IS NOT NULL)::int
    + (suboption_id IS NOT NULL)::int) = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_feats_char_id ON public.character_subfeature_feats (character_id);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_feats_sources ON public.character_subfeature_feats (feature_id, class_id, race_id, ancestry_id, background_id, equipment_id, suboption_id);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_feats_subfeature_feat_id ON public.character_subfeature_feats (subfeature_feat_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_subfeature_feats_updated_at'
      AND tgrelid = 'public.character_subfeature_feats'::regclass) THEN
  CREATE TRIGGER trg_character_subfeature_feats_updated_at
    BEFORE UPDATE ON public.character_subfeature_feats
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_subfeature_feats ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_subfeature_proficiencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  skill_id uuid REFERENCES public.system_skills (id) ON DELETE SET NULL DEFERRABLE,
  language_id uuid REFERENCES public.system_langs (id) ON DELETE SET NULL DEFERRABLE,
  save_ability_id uuid REFERENCES public.system_abilities (id) ON DELETE SET NULL DEFERRABLE,
  property_id uuid REFERENCES public.system_equip_opts (id) ON DELETE SET NULL DEFERRABLE,
  equipment_id uuid REFERENCES public.equipment (id) ON DELETE SET NULL DEFERRABLE,
  feature_id uuid REFERENCES public.features (id) ON DELETE SET NULL DEFERRABLE,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  race_id uuid REFERENCES public.races (id) ON DELETE SET NULL DEFERRABLE,
  ancestry_id uuid REFERENCES public.race_ancestry_options (id) ON DELETE SET NULL DEFERRABLE,
  background_id uuid REFERENCES public.backgrounds (id) ON DELETE SET NULL DEFERRABLE,
  feat_id uuid REFERENCES public.feats (id) ON DELETE SET NULL DEFERRABLE,
  suboption_id uuid REFERENCES public.subfeature_options (id) ON DELETE SET NULL DEFERRABLE,
  subfeature_proficiency_id uuid NOT NULL REFERENCES public.subfeature_proficiencies (id) ON DELETE CASCADE DEFERRABLE,
  ui_key text,
  feature_level integer,
  granted_at_level integer,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_proficiencies_one_target_chk CHECK (
    ((skill_id IS NOT NULL)::int
    + (language_id IS NOT NULL)::int
    + (save_ability_id IS NOT NULL)::int
    + (property_id IS NOT NULL)::int
    + (equipment_id IS NOT NULL)::int) = 1
  ),
  CONSTRAINT character_proficiencies_one_source_chk CHECK (
    ((feature_id IS NOT NULL)::int
    + (class_id IS NOT NULL)::int
    + (race_id IS NOT NULL)::int
    + (ancestry_id IS NOT NULL)::int
    + (background_id IS NOT NULL)::int
    + (equipment_id IS NOT NULL)::int
    + (feat_id IS NOT NULL)::int
    + (suboption_id IS NOT NULL)::int) = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_profs_char_id ON public.character_subfeature_proficiencies (character_id);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_profs_targets ON public.character_subfeature_proficiencies (skill_id, language_id, save_ability_id, property_id, equipment_id);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_profs_sources ON public.character_subfeature_proficiencies (feature_id, class_id, race_id, ancestry_id, background_id, equipment_id, feat_id, suboption_id);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_profs_subfeature_proficiency_id ON public.character_subfeature_proficiencies (subfeature_proficiency_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_subfeature_proficiencies_updated_at'
      AND tgrelid = 'public.character_subfeature_proficiencies'::regclass) THEN
  CREATE TRIGGER trg_character_subfeature_proficiencies_updated_at
    BEFORE UPDATE ON public.character_subfeature_proficiencies
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_subfeature_proficiencies ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_subfeature_expertise (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  skill_id uuid REFERENCES public.system_skills (id) ON DELETE SET NULL DEFERRABLE,
  language_id uuid REFERENCES public.system_langs (id) ON DELETE SET NULL DEFERRABLE,
  save_ability_id uuid REFERENCES public.system_abilities (id) ON DELETE SET NULL DEFERRABLE,
  property_id uuid REFERENCES public.system_equip_opts (id) ON DELETE SET NULL DEFERRABLE,
  equipment_id uuid REFERENCES public.equipment (id) ON DELETE SET NULL DEFERRABLE,
  feature_id uuid REFERENCES public.features (id) ON DELETE SET NULL DEFERRABLE,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  race_id uuid REFERENCES public.races (id) ON DELETE SET NULL DEFERRABLE,
  ancestry_id uuid REFERENCES public.race_ancestry_options (id) ON DELETE SET NULL DEFERRABLE,
  background_id uuid REFERENCES public.backgrounds (id) ON DELETE SET NULL DEFERRABLE,
  feat_id uuid REFERENCES public.feats (id) ON DELETE SET NULL DEFERRABLE,
  suboption_id uuid REFERENCES public.subfeature_options (id) ON DELETE SET NULL DEFERRABLE,
  subfeature_expertise_id uuid NOT NULL REFERENCES public.subfeature_expertise (id) ON DELETE CASCADE DEFERRABLE,
  ui_key text,
  feature_level integer,
  granted_at_level integer,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_expertise_one_target_chk CHECK (
    ((skill_id IS NOT NULL)::int
    + (language_id IS NOT NULL)::int
    + (save_ability_id IS NOT NULL)::int
    + (property_id IS NOT NULL)::int
    + (equipment_id IS NOT NULL)::int) = 1
  ),
  CONSTRAINT character_expertise_one_source_chk CHECK (
    ((feature_id IS NOT NULL)::int
    + (class_id IS NOT NULL)::int
    + (race_id IS NOT NULL)::int
    + (ancestry_id IS NOT NULL)::int
    + (background_id IS NOT NULL)::int
    + (equipment_id IS NOT NULL)::int
    + (feat_id IS NOT NULL)::int
    + (suboption_id IS NOT NULL)::int) = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_expert_char_id ON public.character_subfeature_expertise (character_id);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_expert_targets ON public.character_subfeature_expertise (skill_id, language_id, save_ability_id, property_id, equipment_id);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_expert_sources ON public.character_subfeature_expertise (feature_id, class_id, race_id, ancestry_id, background_id, equipment_id, feat_id, suboption_id);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_expert_subfeature_expertise_id ON public.character_subfeature_expertise (subfeature_expertise_id);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_expert_save_ability_id ON public.character_subfeature_expertise (save_ability_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_subfeature_expertise_updated_at'
      AND tgrelid = 'public.character_subfeature_expertise'::regclass) THEN
  CREATE TRIGGER trg_character_subfeature_expertise_updated_at
    BEFORE UPDATE ON public.character_subfeature_expertise
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_subfeature_expertise ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_subfeature_modifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  subfeature_modifier_id uuid NOT NULL REFERENCES public.subfeature_modifiers (id) ON DELETE CASCADE DEFERRABLE,
  feature_id uuid REFERENCES public.features (id) ON DELETE SET NULL DEFERRABLE,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  race_id uuid REFERENCES public.races (id) ON DELETE SET NULL DEFERRABLE,
  ancestry_id uuid REFERENCES public.race_ancestry_options (id) ON DELETE SET NULL DEFERRABLE,
  background_id uuid REFERENCES public.backgrounds (id) ON DELETE SET NULL DEFERRABLE,
  equipment_id uuid REFERENCES public.equipment (id) ON DELETE SET NULL DEFERRABLE,
  feat_id uuid REFERENCES public.feats (id) ON DELETE SET NULL DEFERRABLE,
  suboption_id uuid REFERENCES public.subfeature_options (id) ON DELETE SET NULL DEFERRABLE,
  ui_key text,
  feature_level integer,
  granted_at_level integer,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_modifiers_one_source_chk CHECK (
    ((feature_id IS NOT NULL)::int
    + (class_id IS NOT NULL)::int
    + (race_id IS NOT NULL)::int
    + (ancestry_id IS NOT NULL)::int
    + (background_id IS NOT NULL)::int
    + (equipment_id IS NOT NULL)::int
    + (feat_id IS NOT NULL)::int
    + (suboption_id IS NOT NULL)::int) = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_mods_char_id ON public.character_subfeature_modifiers (character_id);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_mods_subfeature_modifier_id ON public.character_subfeature_modifiers (subfeature_modifier_id);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_mods_sources ON public.character_subfeature_modifiers (feature_id, class_id, race_id, ancestry_id, background_id, equipment_id, feat_id, suboption_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_subfeature_modifiers_updated_at'
      AND tgrelid = 'public.character_subfeature_modifiers'::regclass) THEN
  CREATE TRIGGER trg_character_subfeature_modifiers_updated_at
    BEFORE UPDATE ON public.character_subfeature_modifiers
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_subfeature_modifiers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_subfeature_senses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),

  character_id uuid NOT NULL
    REFERENCES public.characters (id)
    ON DELETE CASCADE DEFERRABLE,

  sense_id uuid NOT NULL
    REFERENCES public.system_senses (id)
    ON DELETE CASCADE DEFERRABLE,

  subfeature_sense_id uuid NOT NULL
    REFERENCES public.subfeature_senses (id)
    ON DELETE CASCADE DEFERRABLE,

  feature_id uuid
    REFERENCES public.features (id)
    ON DELETE SET NULL DEFERRABLE,

  class_id uuid
    REFERENCES public.classes (id)
    ON DELETE SET NULL DEFERRABLE,

  race_id uuid
    REFERENCES public.races (id)
    ON DELETE SET NULL DEFERRABLE,

  ancestry_id uuid
    REFERENCES public.race_ancestry_options (id)
    ON DELETE SET NULL DEFERRABLE,

  background_id uuid
    REFERENCES public.backgrounds (id)
    ON DELETE SET NULL DEFERRABLE,

  equipment_id uuid
    REFERENCES public.equipment (id)
    ON DELETE SET NULL DEFERRABLE,

  feat_id uuid
    REFERENCES public.feats (id)
    ON DELETE SET NULL DEFERRABLE,

  suboption_id uuid
    REFERENCES public.subfeature_options (id)
    ON DELETE SET NULL DEFERRABLE,

  ui_key text,
  feature_level integer,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT character_senses_one_source_chk CHECK (
    ((feature_id IS NOT NULL)::int
    + (class_id IS NOT NULL)::int
    + (race_id IS NOT NULL)::int
    + (ancestry_id IS NOT NULL)::int
    + (background_id IS NOT NULL)::int
    + (equipment_id IS NOT NULL)::int
    + (feat_id IS NOT NULL)::int
    + (suboption_id IS NOT NULL)::int) = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_senses_char_id
  ON public.character_subfeature_senses (character_id);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_senses_sense_id
  ON public.character_subfeature_senses (sense_id);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_senses_sources
  ON public.character_subfeature_senses (
    feature_id,
    class_id,
    race_id,
    ancestry_id,
    background_id,
    equipment_id,
    feat_id,
    suboption_id
  );

CREATE INDEX IF NOT EXISTS idx_char_subfeature_senses_subfeature_sense_id
  ON public.character_subfeature_senses (subfeature_sense_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_subfeature_senses_updated_at'
      AND tgrelid = 'public.character_subfeature_senses'::regclass) THEN
  CREATE TRIGGER trg_character_subfeature_senses_updated_at
    BEFORE UPDATE ON public.character_subfeature_senses
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_subfeature_senses ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_subfeature_spells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  spell_level integer,
  save_ability_id uuid REFERENCES public.system_abilities (id) ON DELETE SET NULL DEFERRABLE,
  is_ritual boolean,
  count_as_known boolean,
  uses_slot boolean,
  always_prepared boolean,
  cast_at_level boolean,
  requires_concentration boolean,
  optional_ability boolean,
  spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE CASCADE DEFERRABLE,
  subfeature_spell_id uuid NOT NULL REFERENCES public.subfeature_spells (id) ON DELETE CASCADE DEFERRABLE,
  feature_id uuid,
  class_id uuid,
  race_id uuid,
  ancestry_id uuid,
  background_id uuid,
  equipment_id uuid,
  feat_id uuid,
  suboption_id uuid,
  ui_key text,
  feature_level integer,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_subfeature_spells_cast_level_chk CHECK (
    (cast_at_level IS TRUE AND spell_level IS NOT NULL)
    OR
    (cast_at_level IS DISTINCT FROM TRUE AND spell_level IS NULL)
  ),
  CONSTRAINT character_spells_one_source_chk CHECK (
    ((feature_id IS NOT NULL)::int
    + (class_id IS NOT NULL)::int
    + (race_id IS NOT NULL)::int
    + (ancestry_id IS NOT NULL)::int
    + (background_id IS NOT NULL)::int
    + (equipment_id IS NOT NULL)::int
    + (feat_id IS NOT NULL)::int
    + (suboption_id IS NOT NULL)::int) = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_spells_char_id ON public.character_subfeature_spells (character_id);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_spells_spell_id ON public.character_subfeature_spells (spell_id);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_spells_subfeature ON public.character_subfeature_spells (subfeature_spell_id);

CREATE INDEX IF NOT EXISTS idx_char_subfeature_spells_sources ON public.character_subfeature_spells (feature_id, class_id, race_id, ancestry_id, background_id, equipment_id, feat_id, suboption_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_subfeature_spells_updated_at'
      AND tgrelid = 'public.character_subfeature_spells'::regclass) THEN
  CREATE TRIGGER trg_character_subfeature_spells_updated_at
    BEFORE UPDATE ON public.character_subfeature_spells
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_subfeature_spells ENABLE ROW LEVEL SECURITY;

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

-- Computed/stored scores
CREATE TABLE IF NOT EXISTS public.character_abilities_scores (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  ability_id uuid NOT NULL REFERENCES public.system_abilities (id) ON DELETE CASCADE,
  base_score int,
  race_score int,
  class_score int,
  calculated_score int,
  modifier_score int,
  PRIMARY KEY (character_id, ability_id)
);

ALTER TABLE IF EXISTS public.character_abilities_scores
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_abilities_scores_updated_at'
      AND tgrelid = 'public.character_abilities_scores'::regclass) THEN
  CREATE TRIGGER trg_character_abilities_scores_updated_at
    BEFORE UPDATE ON public.character_abilities_scores
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_abilities_scores ENABLE ROW LEVEL SECURITY;

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

/***************************
 * FUNCTIONS
 ***************************/ 
CREATE OR REPLACE FUNCTION public.upsert_character_core(json_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data->>'id','')::uuid, gen_random_uuid());
BEGIN
  INSERT INTO public.characters (
    id,
    system_id,
    user_id,
    label,
    description,
    advancement_id,
    exp_id,
    race_id,
    ancestry_id,
    background_id
  )
  VALUES (
    v_id,
    (json_data->>'systemId')::uuid,
    (json_data->>'userId')::uuid,
    json_data->>'label',
    NULLIF(json_data->>'description',''),
    NULLIF(json_data->>'advancementId','')::uuid,
    NULLIF(json_data->>'expId','')::uuid,
    NULLIF(json_data->>'raceId','')::uuid,
    NULLIF(json_data->>'ancestryId','')::uuid,
    NULLIF(json_data->>'backgroundId','')::uuid
  )
  ON CONFLICT (id) DO UPDATE SET
    label          = EXCLUDED.label,
    description    = EXCLUDED.description,
    advancement_id = EXCLUDED.advancement_id,
    exp_id         = EXCLUDED.exp_id,
    race_id        = EXCLUDED.race_id,
    ancestry_id    = EXCLUDED.ancestry_id,
    background_id  = EXCLUDED.background_id,
    updated_at     = NOW();

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_character_classes(
  p_character_id uuid,
  p_classes jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.character_classes cc
  WHERE cc.character_id = p_character_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_classes) c
      WHERE (c->>'id')::uuid = cc.class_id
    );

  INSERT INTO public.character_classes (
    character_id,
    class_id,
    subclass_id,
    class_level
  )
  SELECT
    p_character_id,
    (c->>'id')::uuid,
    NULLIF(c->'subclass'->>'id','')::uuid,
    (c->>'classLevel')::int
  FROM jsonb_array_elements(p_classes) c
  ON CONFLICT (character_id, class_id)
  DO UPDATE SET
    subclass_id = EXCLUDED.subclass_id,
    class_level = EXCLUDED.class_level,
    updated_at  = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_character_features(
  p_character_id uuid,
  p_features jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.character_features cf
  WHERE cf.character_id = p_character_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_features) f
      WHERE (f->>'featureId')::uuid = cf.feature_id
    );

  INSERT INTO public.character_features (
    character_id,
    feature_id,
    ui_key,
    granted_at_level,
    feature_level
  )
  SELECT
    p_character_id,
    (f->>'featureId')::uuid,
    f->>'uiKey',
    NULLIF(f->>'grantedAtLevel','')::int,
    NULLIF(f->>'featureLevel','')::int
  FROM jsonb_array_elements(p_features) f
  ON CONFLICT (character_id, feature_id)
  DO UPDATE SET
    ui_key = EXCLUDED.ui_key,
    granted_at_level = EXCLUDED.granted_at_level,
    feature_level = EXCLUDED.feature_level,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_character_feature_options(
  p_character_id uuid,
  p_features jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.character_feature_options cfo
  WHERE cfo.character_id = p_character_id;

  INSERT INTO public.character_feature_options (
    character_id,
    feature_id,
    suboption_id,
    ui_key
  )
  SELECT
    p_character_id,
    (f->>'featureId')::uuid,
    (o->>'subfeatureOptionId')::uuid,
    o->>'uiKey'
  FROM jsonb_array_elements(p_features) f
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(f->'options','[]'::jsonb)) o;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_character_modifiers(
  p_character_id uuid,
  p_modifiers jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.character_subfeature_modifiers
  WHERE character_id = p_character_id;

  INSERT INTO public.character_subfeature_modifiers (
    character_id,
    subfeature_modifier_id
  )
  SELECT
    p_character_id,
    (m->>'subfeatureModifierId')::uuid
  FROM jsonb_array_elements(p_modifiers) m;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_character_spells(
  p_character_id uuid,
  p_spells jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.character_spells cs
  WHERE cs.character_id = p_character_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_spells) s
      WHERE (s->>'subfeatureSpellId')::uuid = cs.subfeature_spell_id
    );

  INSERT INTO public.character_spells (
    character_id,
    subfeature_spell_id,
    spell_id,
    spell_level,
    is_ritual,
    count_as_known,
    uses_slot,
    always_prepared,
    cast_at_level,
    requires_concentration,
    optional_ability
  )
  SELECT
    p_character_id,
    (s->>'subfeatureSpellId')::uuid,
    (s->>'spellId')::uuid,
    NULLIF(s->>'spellLevel','')::int,
    (s->>'isRitual')::boolean,
    (s->>'countAsKnown')::boolean,
    (s->>'usesSlot')::boolean,
    (s->>'alwaysPrepared')::boolean,
    (s->>'castAtLevel')::boolean,
    (s->>'requiresConcentration')::boolean,
    (s->>'optionalAbility')::boolean
  FROM jsonb_array_elements(p_spells) s
  ON CONFLICT (character_id, subfeature_spell_id)
  DO UPDATE SET
    spell_level = EXCLUDED.spell_level,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_character_resources(
  p_character_id uuid,
  p_resources jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.character_resources cr
  WHERE cr.character_id = p_character_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_resources) r
      WHERE (r->>'resourceId')::uuid = cr.class_resource_id
    );

  INSERT INTO public.character_resources (
    character_id,
    class_resource_id,
    class_id,
    current
  )
  SELECT
    p_character_id,
    (r->>'resourceId')::uuid,
    (r->>'classId')::uuid,
    (r->>'current')::int
  FROM jsonb_array_elements(p_resources) r
  ON CONFLICT (character_id, class_resource_id)
  DO UPDATE SET
    current = EXCLUDED.current,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_character_spell_slots(
  p_character_id uuid,
  p_slots jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.character_spell_slots css
  WHERE css.character_id = p_character_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_slots) s
      WHERE
        (s->>'classId')::uuid = css.class_id
        AND (s->>'slotLevel')::int = css.slot_level
    );

  INSERT INTO public.character_spell_slots (
    character_id,
    class_id,
    slot_level,
    used
  )
  SELECT
    p_character_id,
    (s->>'classId')::uuid,
    (s->>'slotLevel')::int,
    (s->>'used')::int
  FROM jsonb_array_elements(p_slots) s
  ON CONFLICT (character_id, class_id, slot_level)
  DO UPDATE SET
    used = EXCLUDED.used,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_character(json_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  v_id := public.upsert_character_core(json_data);

  IF json_data ? 'classes' THEN
    PERFORM public.upsert_character_classes(v_id, json_data->'classes');
  END IF;

  IF json_data ? 'features' THEN
    PERFORM public.upsert_character_features(v_id, json_data->'features');
    PERFORM public.upsert_character_feature_options(v_id, json_data->'features');
  END IF;

  IF json_data ? 'modifiers' THEN
    PERFORM public.upsert_character_modifiers(v_id, json_data->'modifiers');
  END IF;

  IF json_data ? 'spells' THEN
    PERFORM public.upsert_character_spells(v_id, json_data->'spells');
  END IF;

  IF json_data ? 'resources' THEN
    PERFORM public.upsert_character_resources(v_id, json_data->'resources');
  END IF;

  IF json_data ? 'spellcasting'
     AND json_data->'spellcasting' ? 'spellSlots'
  THEN
    PERFORM public.upsert_character_spell_slots(
      v_id,
      json_data->'spellcasting'->'spellSlots'
    );
  END IF;

  RETURN v_id;
END;
$$;