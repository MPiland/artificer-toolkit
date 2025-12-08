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
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  race_id uuid NOT NULL REFERENCES public.races (id) ON DELETE CASCADE DEFERRABLE,
  race_ancestry_option_id uuid REFERENCES public.race_ancestry_options (id) ON DELETE SET NULL DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, race_id, race_ancestry_option_id)
);

CREATE INDEX IF NOT EXISTS idx_char_race_ancestry_option_id ON public.character_race (race_ancestry_option_id);

CREATE INDEX IF NOT EXISTS idx_char_race_char_id ON public.character_race (character_id);

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
  level integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
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
  level integer NOT NULL,
  value integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, level)
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

CREATE TABLE IF NOT EXISTS public.character_spell_prepared (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE DEFERRABLE,
  level integer NOT NULL,
  spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE CASCADE DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, class_id, level, spell_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_spell_prepared_updated_at'
      AND tgrelid = 'public.character_spell_prepared'::regclass) THEN
  CREATE TRIGGER trg_character_spell_prepared_updated_at
    BEFORE UPDATE ON public.character_spell_prepared
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_spell_prepared ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_spell_known (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE DEFERRABLE,
  level integer NOT NULL,
  spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE CASCADE DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, class_id, level, spell_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_spell_known_updated_at'
      AND tgrelid = 'public.character_spell_known'::regclass) THEN
  CREATE TRIGGER trg_character_spell_known_updated_at
    BEFORE UPDATE ON public.character_spell_known
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_spell_known ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_spell_additional (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  level integer NOT NULL,
  spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE CASCADE,
  save_ability_id uuid REFERENCES public.system_abilities (id) ON DELETE SET NULL,
  is_ritual boolean,
  count_as_known boolean,
  uses_slot boolean,
  always_prepared boolean,
  cast_at_level boolean,
  requires_concentration boolean,
  optional_ability boolean,
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
  level integer NOT NULL,
  slot_level integer NOT NULL,
  used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, class_id, level, slot_level)
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

CREATE TABLE IF NOT EXISTS public.character_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  option_index text,
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

CREATE TABLE IF NOT EXISTS public.character_feature_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  character_feature_id uuid NOT NULL REFERENCES public.character_features (id) ON DELETE CASCADE DEFERRABLE,
  subfeature_option_id uuid NOT NULL REFERENCES public.subfeature_options (id) ON DELETE CASCADE DEFERRABLE,
  option_index text,
  feature_level integer,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cfeat_opts_cfeat ON public.character_feature_options (character_feature_id);
CREATE INDEX IF NOT EXISTS idx_cfeat_opts_sopt ON public.character_feature_options (subfeature_option_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_feature_options_updated_at'
      AND tgrelid = 'public.character_feature_options'::regclass) THEN
  CREATE TRIGGER trg_character_feature_options_updated_at
    BEFORE UPDATE ON public.character_feature_options
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_feature_options ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_feats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  option_index text,
  feature_level integer,
  feature_id uuid REFERENCES public.features (id) ON DELETE SET NULL DEFERRABLE,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  race_id uuid REFERENCES public.races (id) ON DELETE SET NULL DEFERRABLE,
  ancestry_id uuid REFERENCES public.race_ancestry_options (id) ON DELETE SET NULL DEFERRABLE,
  background_id uuid REFERENCES public.backgrounds (id) ON DELETE SET NULL DEFERRABLE,
  equipment_id uuid REFERENCES public.equipment (id) ON DELETE SET NULL DEFERRABLE,
  subfeature_option_id uuid REFERENCES public.subfeature_options (id) ON DELETE SET NULL DEFERRABLE,
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
    + (subfeature_option_id IS NOT NULL)::int) = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_char_feats_char_id ON public.character_feats (character_id);
CREATE INDEX IF NOT EXISTS idx_char_feats_sources ON public.character_feats (feature_id, class_id, race_id, ancestry_id, background_id, equipment_id, subfeature_option_id);
CREATE INDEX IF NOT EXISTS idx_char_feats_subfeature ON public.character_feats (subfeature_feat_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_feats_updated_at'
      AND tgrelid = 'public.character_feats'::regclass) THEN
  CREATE TRIGGER trg_character_feats_updated_at
    BEFORE UPDATE ON public.character_feats
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_feats ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_proficiencies (
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
  subfeature_option_id uuid REFERENCES public.subfeature_options (id) ON DELETE SET NULL DEFERRABLE,
  subfeature_proficiency_id uuid NOT NULL REFERENCES public.subfeature_proficiencies (id) ON DELETE CASCADE DEFERRABLE,
  option_index text,
  feature_level integer,
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
    + (subfeature_option_id IS NOT NULL)::int) = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_char_profs_char_id ON public.character_proficiencies (character_id);
CREATE INDEX IF NOT EXISTS idx_char_profs_targets ON public.character_proficiencies (skill_id, language_id, save_ability_id, property_id, equipment_id);
CREATE INDEX IF NOT EXISTS idx_char_profs_sources ON public.character_proficiencies (feature_id, class_id, race_id, ancestry_id, background_id, equipment_id, feat_id, subfeature_option_id);
CREATE INDEX IF NOT EXISTS idx_char_profs_subfeature ON public.character_proficiencies (subfeature_proficiency_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_proficiencies_updated_at'
      AND tgrelid = 'public.character_proficiencies'::regclass) THEN
  CREATE TRIGGER trg_character_proficiencies_updated_at
    BEFORE UPDATE ON public.character_proficiencies
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_proficiencies ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_expertise (
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
  subfeature_option_id uuid REFERENCES public.subfeature_options (id) ON DELETE SET NULL DEFERRABLE,
  subfeature_expertise_id uuid NOT NULL REFERENCES public.subfeature_expertise (id) ON DELETE CASCADE DEFERRABLE,
  option_index text,
  feature_level integer,
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
    + (subfeature_option_id IS NOT NULL)::int) = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_char_expert_char_id ON public.character_expertise (character_id);
CREATE INDEX IF NOT EXISTS idx_char_expert_targets ON public.character_expertise (skill_id, language_id, save_ability_id, property_id, equipment_id);
CREATE INDEX IF NOT EXISTS idx_char_expert_sources ON public.character_expertise (feature_id, class_id, race_id, ancestry_id, background_id, equipment_id, feat_id, subfeature_option_id);
CREATE INDEX IF NOT EXISTS idx_char_expert_subfeature ON public.character_expertise (subfeature_expertise_id);
CREATE INDEX IF NOT EXISTS idx_char_expert_save_ability_id ON public.character_expertise (save_ability_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_expertise_updated_at'
      AND tgrelid = 'public.character_expertise'::regclass) THEN
  CREATE TRIGGER trg_character_expertise_updated_at
    BEFORE UPDATE ON public.character_expertise
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_expertise ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_modifiers (
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
  subfeature_option_id uuid REFERENCES public.subfeature_options (id) ON DELETE SET NULL DEFERRABLE,
  option_index text,
  feature_level integer,
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
    + (subfeature_option_id IS NOT NULL)::int) = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_char_mods_char_id ON public.character_modifiers (character_id);
CREATE INDEX IF NOT EXISTS idx_char_mods_modifier_id ON public.character_modifiers (subfeature_modifier_id);
CREATE INDEX IF NOT EXISTS idx_char_mods_sources ON public.character_modifiers (feature_id, class_id, race_id, ancestry_id, background_id, equipment_id, feat_id, subfeature_option_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_modifiers_updated_at'
      AND tgrelid = 'public.character_modifiers'::regclass) THEN
  CREATE TRIGGER trg_character_modifiers_updated_at
    BEFORE UPDATE ON public.character_modifiers
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_modifiers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_senses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  sense_id uuid NOT NULL REFERENCES public.system_senses (id) ON DELETE CASCADE DEFERRABLE,
  subfeature_sense_id uuid NOT NULL REFERENCES public.subfeature_senses (id) ON DELETE CASCADE DEFERRABLE,
  feature_id uuid,
  class_id uuid,
  race_id uuid,
  ancestry_id uuid,
  background_id uuid,
  equipment_id uuid,
  feat_id uuid,
  subfeature_option_id uuid,
  option_index text,
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
    + (subfeature_option_id IS NOT NULL)::int) = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_char_senses_char_id ON public.character_senses (character_id);
CREATE INDEX IF NOT EXISTS idx_char_senses_sense_id ON public.character_senses (sense_id);
CREATE INDEX IF NOT EXISTS idx_char_senses_sources ON public.character_senses (feature_id, class_id, race_id, ancestry_id, background_id, equipment_id, feat_id, subfeature_option_id);
CREATE INDEX IF NOT EXISTS idx_char_senses_subfeature ON public.character_senses (subfeature_sense_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_senses_updated_at'
      AND tgrelid = 'public.character_senses'::regclass) THEN
  CREATE TRIGGER trg_character_senses_updated_at
    BEFORE UPDATE ON public.character_senses
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_senses ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_spells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  level integer NOT NULL,
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
  subfeature_option_id uuid,
  option_index text,
  feature_level integer,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_spells_one_source_chk CHECK (
    ((feature_id IS NOT NULL)::int
    + (class_id IS NOT NULL)::int
    + (race_id IS NOT NULL)::int
    + (ancestry_id IS NOT NULL)::int
    + (background_id IS NOT NULL)::int
    + (equipment_id IS NOT NULL)::int
    + (feat_id IS NOT NULL)::int
    + (subfeature_option_id IS NOT NULL)::int) = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_char_spells_char_id ON public.character_spells (character_id);
CREATE INDEX IF NOT EXISTS idx_char_spells_spell_id ON public.character_spells (spell_id);
CREATE INDEX IF NOT EXISTS idx_char_spells_subfeature ON public.character_spells (subfeature_spell_id);
CREATE INDEX IF NOT EXISTS idx_char_spells_sources ON public.character_spells (feature_id, class_id, race_id, ancestry_id, background_id, equipment_id, feat_id, subfeature_option_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_spells_updated_at'
      AND tgrelid = 'public.character_spells'::regclass) THEN
  CREATE TRIGGER trg_character_spells_updated_at
    BEFORE UPDATE ON public.character_spells
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_spells ENABLE ROW LEVEL SECURITY;


/***************************
 * FUNCTIONS
 ***************************/ 
CREATE OR REPLACE FUNCTION public.upsert_character(json_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public AS $$
DECLARE
  v_id uuid;
  v_system_id uuid;
  v_user_id uuid;
  v_label text;
  v_description text;
  v_advancement_id uuid;
  v_exp_id uuid;
  v_race_id uuid;
  v_background_id uuid;
BEGIN
  v_id := COALESCE(NULLIF(json_data->>'id', '')::uuid, gen_random_uuid());

  v_system_id := NULLIF(json_data->>'systemId', '')::uuid;
  v_user_id := NULLIF(json_data->>'userId', '')::uuid;
  v_label := json_data->>'label';
  v_description := NULLIF(json_data->>'description', '');
  v_advancement_id := NULLIF(json_data->>'advancementId', '')::uuid;
  v_exp_id := NULLIF(json_data->>'expId', '')::uuid;
  v_race_id := NULLIF(json_data->>'raceId', '')::uuid;
  v_background_id := NULLIF(json_data->>'backgroundId', '')::uuid;

  INSERT INTO public.characters (
    id,
    system_id,
    user_id,
    label,
    description,
    advancement_id,
    exp_id,
    race_id,
    background_id
  ) VALUES (
    v_id,
    v_system_id,
    v_user_id,
    v_label,
    v_description,
    v_advancement_id,
    v_exp_id,
    v_race_id,
    v_background_id
  )
  ON CONFLICT (id) DO UPDATE SET
    system_id = EXCLUDED.system_id,
    user_id = EXCLUDED.user_id,
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    advancement_id = EXCLUDED.advancement_id,
    exp_id = EXCLUDED.exp_id,
    race_id = EXCLUDED.race_id,
    background_id = EXCLUDED.background_id,
    updated_at = NOW();

  -- Upsert character_race based on top-level raceId & ancestryId
  IF (json_data ? 'raceId') THEN
    DELETE FROM public.character_race cr
    WHERE cr.character_id = v_id
      AND (cr.race_id IS DISTINCT FROM NULLIF(json_data->>'raceId','')::uuid
        OR cr.race_ancestry_option_id IS DISTINCT FROM NULLIF(json_data->>'ancestryId','')::uuid);

    INSERT INTO public.character_race (character_id, race_id, race_ancestry_option_id)
    VALUES (
      v_id,
      NULLIF(json_data->>'raceId','')::uuid,
      NULLIF(json_data->>'ancestryId','')::uuid
    )
    ON CONFLICT (character_id, race_id, race_ancestry_option_id) DO NOTHING;
  ELSE
    -- No race in json_data => remove existing links
    DELETE FROM public.character_race cr WHERE cr.character_id = v_id;
  END IF;

  -- Upsert character_classes from classes[] with cleanup
  IF (json_data ? 'classes') THEN
    -- Delete classes not present anymore
    DELETE FROM public.character_classes cc
    WHERE cc.character_id = v_id
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(json_data->'classes') AS j(c)
        WHERE cc.class_id = NULLIF(j.c->>'id','')::uuid
      );

    -- Upsert each class
    PERFORM 1 FROM (
      SELECT 1
      FROM jsonb_array_elements(json_data->'classes') AS j(c)
    ) s; -- no-op to ensure JSON is iterable

    FOR SELECT 
      NULLIF(c->>'id','')::uuid AS class_id,
      NULLIF((c->'subclass')->>'subtype','')::uuid AS subclass_id,
      (c->>'level')::int AS level
    FROM jsonb_array_elements(json_data->'classes') AS j(c)
    LOOP
      INSERT INTO public.character_classes (character_id, class_id, subclass_id, level)
      VALUES (v_id, class_id, subclass_id, level)
      ON CONFLICT (character_id, class_id) DO UPDATE SET
        subclass_id = EXCLUDED.subclass_id,
        level = EXCLUDED.level,
        updated_at = NOW();
    END LOOP;
  ELSE
    -- No classes array => remove all for this character
    DELETE FROM public.character_classes cc WHERE cc.character_id = v_id;
  END IF;

  -- Upsert character_features and character_feature_options
  IF (json_data ? 'features') THEN
    DELETE FROM public.character_feature_options cfo
      USING public.character_features cf
      WHERE cfo.character_feature_id = cf.id AND cf.character_id = v_id;
    DELETE FROM public.character_features cf WHERE cf.character_id = v_id;

    DECLARE f jsonb; fo jsonb; v_cfeat_id uuid;
    BEGIN
      FOR f IN SELECT value FROM jsonb_array_elements(json_data->'features') LOOP
        INSERT INTO public.character_features (
          character_id,
          option_index,
          feature_level,
          feature_id,
          class_id,
          race_id,
          ancestry_id,
          background_id,
          equipment_id,
          feat_id
        ) VALUES (
          v_id,
          f.value->>'optionIndex',
          NULLIF(f.value->>'level','')::int,
          NULLIF(f.value->>'featureId','')::uuid,
          NULLIF(f.value->>'classId','')::uuid,
          NULLIF(f.value->>'raceId','')::uuid,
          NULLIF(f.value->>'ancestryId','')::uuid,
          NULLIF(f.value->>'backgroundId','')::uuid,
          NULLIF(f.value->>'equipmentId','')::uuid,
          NULLIF(f.value->>'featId','')::uuid
        ) RETURNING id INTO v_cfeat_id;

        IF (f.value ? 'options') THEN
          FOR fo IN SELECT value FROM jsonb_array_elements(f.value->'options') LOOP
            INSERT INTO public.character_feature_options (
              character_feature_id,
              subfeature_option_id,
              option_index,
              feature_level
            ) VALUES (
              v_cfeat_id,
              NULLIF(fo.value->>'subfeatureOptionId','')::uuid,
              fo.value->>'optionIndex',
              NULLIF(fo.value->>'featureLevel','')::int
            );
          END LOOP;
        END IF;
      END LOOP;
    END;
  ELSE
    DELETE FROM public.character_feature_options cfo
      USING public.character_features cf
      WHERE cfo.character_feature_id = cf.id AND cf.character_id = v_id;
    DELETE FROM public.character_features cf WHERE cf.character_id = v_id;
  END IF;

  -- Upsert character_feats
  IF (json_data ? 'feats') THEN
    DELETE FROM public.character_feats WHERE character_id = v_id;
    DECLARE feat jsonb;
    BEGIN
      FOR feat IN SELECT value FROM jsonb_array_elements(json_data->'feats') LOOP
        INSERT INTO public.character_feats (
          character_id,
          option_index,
          feature_level,
          feature_id,
          class_id,
          race_id,
          ancestry_id,
          background_id,
          equipment_id,
          subfeature_option_id,
          subfeature_feat_id
        ) VALUES (
          v_id,
          feat.value->>'optionIndex',
          NULLIF(feat.value->>'featureLevel','')::int,
          NULLIF(feat.value->>'featureId','')::uuid,
          NULLIF(feat.value->>'classId','')::uuid,
          NULLIF(feat.value->>'raceId','')::uuid,
          NULLIF(feat.value->>'ancestryId','')::uuid,
          NULLIF(feat.value->>'backgroundId','')::uuid,
          NULLIF(feat.value->>'equipmentId','')::uuid,
          NULLIF(feat.value->>'subfeatureOptionId','')::uuid,
          NULLIF(feat.value->>'subfeatureFeatId','')::uuid
        );
      END LOOP;
    END;
  ELSE
    DELETE FROM public.character_feats WHERE character_id = v_id;
  END IF;

  -- Upsert character_proficiencies
  IF (json_data ? 'proficiencies') THEN
    DELETE FROM public.character_proficiencies WHERE character_id = v_id;
    DECLARE p jsonb;
    BEGIN
      FOR p IN SELECT value FROM jsonb_array_elements(json_data->'proficiencies') LOOP
        INSERT INTO public.character_proficiencies (
          character_id,
          skill_id,
          language_id,
          save_ability_id,
          property_id,
          equipment_id,
          feature_id,
          class_id,
          race_id,
          ancestry_id,
          background_id,
          feat_id,
          subfeature_option_id,
          subfeature_proficiency_id,
          option_index,
          feature_level
        ) VALUES (
          v_id,
          NULLIF(p.value->>'skillId','')::uuid,
          NULLIF(p.value->>'languageId','')::uuid,
          NULLIF(p.value->>'saveAbilityId','')::uuid,
          NULLIF(p.value->>'propertyId','')::uuid,
          NULLIF(p.value->>'equipmentId','')::uuid,
          NULLIF(p.value->>'featureId','')::uuid,
          NULLIF(p.value->>'classId','')::uuid,
          NULLIF(p.value->>'raceId','')::uuid,
          NULLIF(p.value->>'ancestryId','')::uuid,
          NULLIF(p.value->>'backgroundId','')::uuid,
          NULLIF(p.value->>'featId','')::uuid,
          NULLIF(p.value->>'subfeatureOptionId','')::uuid,
          NULLIF(p.value->>'subfeatureProficiencyId','')::uuid,
          p.value->>'optionIndex',
          NULLIF(p.value->>'featureLevel','')::int
        );
      END LOOP;
    END;
  ELSE
    DELETE FROM public.character_proficiencies WHERE character_id = v_id;
  END IF;

  -- Upsert character_expertise
  IF (json_data ? 'expertise') THEN
    DELETE FROM public.character_expertise WHERE character_id = v_id;
    DECLARE e jsonb;
    BEGIN
      FOR e IN SELECT value FROM jsonb_array_elements(json_data->'expertise') LOOP
        INSERT INTO public.character_expertise (
          character_id,
          skill_id,
          language_id,
          save_ability_id,
          property_id,
          equipment_id,
          feature_id,
          class_id,
          race_id,
          ancestry_id,
          background_id,
          feat_id,
          subfeature_option_id,
          subfeature_expertise_id,
          option_index,
          feature_level
        ) VALUES (
          v_id,
          NULLIF(e.value->>'skillId','')::uuid,
          NULLIF(e.value->>'languageId','')::uuid,
          NULLIF(e.value->>'saveAbilityId','')::uuid,
          NULLIF(e.value->>'propertyId','')::uuid,
          NULLIF(e.value->>'equipmentId','')::uuid,
          NULLIF(e.value->>'featureId','')::uuid,
          NULLIF(e.value->>'classId','')::uuid,
          NULLIF(e.value->>'raceId','')::uuid,
          NULLIF(e.value->>'ancestryId','')::uuid,
          NULLIF(e.value->>'backgroundId','')::uuid,
          NULLIF(e.value->>'featId','')::uuid,
          NULLIF(e.value->>'subfeatureOptionId','')::uuid,
          NULLIF(e.value->>'subfeatureExpertiseId','')::uuid,
          e.value->>'optionIndex',
          NULLIF(e.value->>'featureLevel','')::int
        );
      END LOOP;
    END;
  ELSE
    DELETE FROM public.character_expertise WHERE character_id = v_id;
  END IF;

  -- Upsert character_modifiers
  IF (json_data ? 'modifiers') THEN
    DELETE FROM public.character_modifiers WHERE character_id = v_id;
    DECLARE m jsonb;
    BEGIN
      FOR m IN SELECT value FROM jsonb_array_elements(json_data->'modifiers') LOOP
        INSERT INTO public.character_modifiers (
          character_id,
          subfeature_modifier_id,
          feature_id,
          class_id,
          race_id,
          ancestry_id,
          background_id,
          equipment_id,
          feat_id,
          subfeature_option_id,
          option_index,
          feature_level
        ) VALUES (
          v_id,
          NULLIF(m.value->>'subfeatureModifierId','')::uuid,
          NULLIF(m.value->>'featureId','')::uuid,
          NULLIF(m.value->>'classId','')::uuid,
          NULLIF(m.value->>'raceId','')::uuid,
          NULLIF(m.value->>'ancestryId','')::uuid,
          NULLIF(m.value->>'backgroundId','')::uuid,
          NULLIF(m.value->>'equipmentId','')::uuid,
          NULLIF(m.value->>'featId','')::uuid,
          NULLIF(m.value->>'subfeatureOptionId','')::uuid,
          m.value->>'optionIndex',
          NULLIF(m.value->>'featureLevel','')::int
        );
      END LOOP;
    END;
  ELSE
    DELETE FROM public.character_modifiers WHERE character_id = v_id;
  END IF;

  -- Upsert character_senses
  IF (json_data ? 'senses') THEN
    DELETE FROM public.character_senses WHERE character_id = v_id;
    DECLARE s jsonb;
    BEGIN
      FOR s IN SELECT value FROM jsonb_array_elements(json_data->'senses') LOOP
        INSERT INTO public.character_senses (
          character_id,
          sense_id,
          subfeature_sense_id,
          feature_id,
          class_id,
          race_id,
          ancestry_id,
          background_id,
          equipment_id,
          feat_id,
          subfeature_option_id,
          option_index,
          feature_level
        ) VALUES (
          v_id,
          NULLIF(s.value->>'senseId','')::uuid,
          NULLIF(s.value->>'subfeatureSenseId','')::uuid,
          NULLIF(s.value->>'featureId','')::uuid,
          NULLIF(s.value->>'classId','')::uuid,
          NULLIF(s.value->>'raceId','')::uuid,
          NULLIF(s.value->>'ancestryId','')::uuid,
          NULLIF(s.value->>'backgroundId','')::uuid,
          NULLIF(s.value->>'equipmentId','')::uuid,
          NULLIF(s.value->>'featId','')::uuid,
          NULLIF(s.value->>'subfeatureOptionId','')::uuid,
          s.value->>'optionIndex',
          NULLIF(s.value->>'featureLevel','')::int
        );
      END LOOP;
    END;
  ELSE
    DELETE FROM public.character_senses WHERE character_id = v_id;
  END IF;

  -- Upsert character spellcasting: additional, prepared, known (skip slots for now)
  IF (json_data ? 'spellcasting') THEN
    -- additional (CharacterSpell)
    IF ((json_data->'spellcasting') ? 'additional') THEN
      DELETE FROM public.character_spell_additional WHERE character_id = v_id;
      DECLARE a jsonb;
      BEGIN
        FOR a IN SELECT value FROM jsonb_array_elements(json_data->'spellcasting'->'additional') LOOP
          INSERT INTO public.character_spell_additional (
            id,
            character_id,
            level,
            spell_id,
            save_ability_id,
            is_ritual,
            count_as_known,
            uses_slot,
            always_prepared,
            cast_at_level,
            requires_concentration,
            optional_ability
          ) VALUES (
            gen_random_uuid(),
            v_id,
            NULLIF(a.value->>'level','')::int,
            NULLIF(a.value->>'spellId','')::uuid,
            NULLIF(a.value->>'saveAbilityId','')::uuid,
            COALESCE((a.value->>'isRitual')::boolean, NULL),
            COALESCE((a.value->>'countAsKnown')::boolean, NULL),
            COALESCE((a.value->>'usesSlot')::boolean, NULL),
            COALESCE((a.value->>'alwaysPrepared')::boolean, NULL),
            COALESCE((a.value->>'castAtLevel')::boolean, NULL),
            COALESCE((a.value->>'requiresConcentration')::boolean, NULL),
            COALESCE((a.value->>'optionalAbility')::boolean, NULL)
          );
        END LOOP;
      END;
    ELSE
      DELETE FROM public.character_spell_additional WHERE character_id = v_id;
    END IF;

    -- prepared (ClassSpellList[])
    IF ((json_data->'spellcasting') ? 'prepared') THEN
      DELETE FROM public.character_spell_prepared WHERE character_id = v_id;
      DECLARE pr jsonb; ps jsonb;
      BEGIN
        FOR pr IN SELECT value FROM jsonb_array_elements(json_data->'spellcasting'->'prepared') LOOP
          IF (pr.value ? 'spells') THEN
            FOR ps IN SELECT value FROM jsonb_array_elements(pr.value->'spells') LOOP
              INSERT INTO public.character_spell_prepared (
                character_id,
                class_id,
                level,
                spell_id
              ) VALUES (
                v_id,
                NULLIF(ps.value->>'classId','')::uuid,
                NULLIF(pr.value->>'level','')::int,
                NULLIF(ps.value->>'spellId','')::uuid
              ) ON CONFLICT DO NOTHING;
            END LOOP;
          END IF;
        END LOOP;
      END;
    ELSE
      DELETE FROM public.character_spell_prepared WHERE character_id = v_id;
    END IF;

    -- known (ClassSpellList[])
    IF ((json_data->'spellcasting') ? 'known') THEN
      DELETE FROM public.character_spell_known WHERE character_id = v_id;
      DECLARE kn jsonb; ks jsonb;
      BEGIN
        FOR kn IN SELECT value FROM jsonb_array_elements(json_data->'spellcasting'->'known') LOOP
          IF (kn.value ? 'spells') THEN
            FOR ks IN SELECT value FROM jsonb_array_elements(kn.value->'spells') LOOP
              INSERT INTO public.character_spell_known (
                character_id,
                class_id,
                level,
                spell_id
              ) VALUES (
                v_id,
                NULLIF(ks.value->>'classId','')::uuid,
                NULLIF(kn.value->>'level','')::int,
                NULLIF(ks.value->>'spellId','')::uuid
              ) ON CONFLICT DO NOTHING;
            END LOOP;
          END IF;
        END LOOP;
      END;
    ELSE
      DELETE FROM public.character_spell_known WHERE character_id = v_id;
    END IF;
  ELSE
    -- No spellcasting object at all => cleanup all
    DELETE FROM public.character_spell_additional WHERE character_id = v_id;
    DELETE FROM public.character_spell_prepared WHERE character_id = v_id;
    DELETE FROM public.character_spell_known WHERE character_id = v_id;
  END IF;

  RETURN v_id;
END;
$$;

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