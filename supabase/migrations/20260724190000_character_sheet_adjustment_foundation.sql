ALTER TABLE public.creatures
  ADD COLUMN IF NOT EXISTS hit_dice_count integer,
  ADD COLUMN IF NOT EXISTS hit_die integer,
  ADD COLUMN IF NOT EXISTS hit_dice_modifier integer;

ALTER TABLE public.creatures
  DROP CONSTRAINT IF EXISTS creatures_hit_dice_chk;

UPDATE public.creatures
SET hit_dice_count = substring(replace(hit_dice, ' ', '') from '^([0-9]+)d')::integer,
    hit_die = substring(replace(hit_dice, ' ', '') from 'd([0-9]+)')::integer,
    hit_dice_modifier = COALESCE(
      substring(replace(hit_dice, ' ', '') from 'd[0-9]+([+-][0-9]+)$')::integer,
      0
    )
WHERE hit_dice IS NOT NULL
  AND replace(hit_dice, ' ', '') ~ '^[0-9]+d[0-9]+([+-][0-9]+)?$';

ALTER TABLE public.creatures
  ADD CONSTRAINT creatures_hit_dice_chk CHECK (
    (hit_dice_count IS NULL AND hit_die IS NULL AND hit_dice_modifier IS NULL)
    OR (hit_dice_count > 0 AND hit_die >= 2 AND hit_dice_modifier IS NOT NULL)
  );

/* Sheet-owned, per-character adjustment intent. Derived totals are never stored here. */

CREATE TABLE IF NOT EXISTS public.character_ability_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  ability_code text NOT NULL,
  field_kind text NOT NULL,
  integer_value integer NOT NULL,
  source_note text,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (character_id, ability_code, field_kind),
  CONSTRAINT character_ability_adjustments_ability_chk CHECK (
    ability_code IN ('STRENGTH', 'DEXTERITY', 'CONSTITUTION', 'INTELLIGENCE', 'WISDOM', 'CHARISMA')
  ),
  CONSTRAINT character_ability_adjustments_field_chk CHECK (
    field_kind IN ('OTHER_MODIFIER', 'SCORE_OVERRIDE')
  )
);

CREATE TABLE IF NOT EXISTS public.character_saving_throw_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  ability_code text NOT NULL,
  field_kind text NOT NULL,
  integer_value integer,
  proficiency_value text,
  source_note text,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (character_id, ability_code, field_kind),
  CONSTRAINT character_saving_throw_adjustments_ability_chk CHECK (
    ability_code IN ('STRENGTH', 'DEXTERITY', 'CONSTITUTION', 'INTELLIGENCE', 'WISDOM', 'CHARISMA')
  ),
  CONSTRAINT character_saving_throw_adjustments_value_chk CHECK (
    (
      field_kind IN ('MAGIC_BONUS', 'MISC_BONUS', 'TOTAL_OVERRIDE')
      AND integer_value IS NOT NULL
      AND proficiency_value IS NULL
    )
    OR (
      field_kind = 'PROFICIENCY_OVERRIDE'
      AND integer_value IS NULL
      AND proficiency_value IN ('NONE', 'HALF', 'FULL', 'DOUBLE')
    )
  )
);

CREATE TABLE IF NOT EXISTS public.character_skill_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills (id) ON DELETE RESTRICT,
  field_kind text NOT NULL,
  integer_value integer,
  proficiency_value text,
  ability_value text,
  source_note text,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (character_id, skill_id, field_kind),
  CONSTRAINT character_skill_adjustments_value_chk CHECK (
    (
      field_kind IN ('MAGIC_BONUS', 'MISC_BONUS', 'TOTAL_OVERRIDE')
      AND integer_value IS NOT NULL
      AND proficiency_value IS NULL
      AND ability_value IS NULL
    )
    OR (
      field_kind = 'PROFICIENCY_OVERRIDE'
      AND integer_value IS NULL
      AND proficiency_value IN ('NONE', 'HALF', 'FULL', 'DOUBLE')
      AND ability_value IS NULL
    )
    OR (
      field_kind = 'GOVERNING_ABILITY_OVERRIDE'
      AND integer_value IS NULL
      AND proficiency_value IS NULL
      AND ability_value IN ('STRENGTH', 'DEXTERITY', 'CONSTITUTION', 'INTELLIGENCE', 'WISDOM', 'CHARISMA')
    )
  )
);

CREATE TABLE IF NOT EXISTS public.character_passive_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills (id) ON DELETE RESTRICT,
  field_kind text NOT NULL DEFAULT 'TOTAL_OVERRIDE',
  integer_value integer NOT NULL,
  source_note text,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (character_id, skill_id, field_kind),
  CONSTRAINT character_passive_adjustments_field_chk CHECK (field_kind = 'TOTAL_OVERRIDE')
);

CREATE TABLE IF NOT EXISTS public.character_sense_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  sense_id uuid NOT NULL REFERENCES public.senses (id) ON DELETE RESTRICT,
  field_kind text NOT NULL DEFAULT 'RANGE_OVERRIDE',
  integer_value integer NOT NULL,
  source_note text,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (character_id, sense_id, field_kind),
  CONSTRAINT character_sense_adjustments_value_chk CHECK (
    field_kind = 'RANGE_OVERRIDE' AND integer_value >= 0
  )
);

CREATE TABLE IF NOT EXISTS public.character_movement_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  speed_id uuid NOT NULL REFERENCES public.speeds (id) ON DELETE RESTRICT,
  field_kind text NOT NULL DEFAULT 'SPEED_OVERRIDE',
  integer_value integer NOT NULL,
  source_note text,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (character_id, speed_id, field_kind),
  CONSTRAINT character_movement_adjustments_value_chk CHECK (
    field_kind = 'SPEED_OVERRIDE' AND integer_value >= 0
  )
);

CREATE TABLE IF NOT EXISTS public.character_hitpoint_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  field_kind text NOT NULL,
  integer_value integer NOT NULL,
  source_note text,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (character_id, field_kind),
  CONSTRAINT character_hitpoint_adjustments_value_chk CHECK (
    field_kind = 'MAXIMUM_MODIFIER'
    OR (field_kind = 'MAXIMUM_OVERRIDE' AND integer_value >= 0)
  )
);

CREATE TABLE IF NOT EXISTS public.character_spell_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE RESTRICT,
  source_kind text NOT NULL,
  source_instance_id text NOT NULL,
  field_kind text NOT NULL,
  integer_value integer NOT NULL,
  source_note text,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (character_id, spell_id, source_kind, source_instance_id, field_kind),
  CONSTRAINT character_spell_adjustments_source_kind_chk CHECK (
    source_kind IN ('BACKGROUND', 'CLASS', 'FEAT', 'FEATURE', 'ITEM', 'OPTION', 'RACE', 'SUBCLASS')
  ),
  CONSTRAINT character_spell_adjustments_field_chk CHECK (
    field_kind IN ('ATTACK_BONUS', 'ATTACK_OVERRIDE', 'DAMAGE_BONUS', 'DC_BONUS', 'DC_OVERRIDE')
  )
);

CREATE TABLE IF NOT EXISTS public.character_item_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  item_instance_id uuid NOT NULL,
  field_kind text NOT NULL,
  numeric_value numeric,
  boolean_value boolean,
  source_note text,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (character_id, item_instance_id, field_kind),
  CONSTRAINT character_item_adjustments_item_fkey
    FOREIGN KEY (character_id, item_instance_id)
    REFERENCES public.character_equipment (character_id, id)
    ON DELETE CASCADE,
  CONSTRAINT character_item_adjustments_value_chk CHECK (
    (
      field_kind IN ('ATTACK_BONUS', 'ATTACK_OVERRIDE', 'DAMAGE_BONUS')
      AND numeric_value IS NOT NULL
      AND boolean_value IS NULL
    )
    OR (
      field_kind = 'WEIGHT_OVERRIDE'
      AND numeric_value >= 0
      AND boolean_value IS NULL
    )
    OR (
      field_kind IN ('ADAMANTINE', 'DUAL_WIELD', 'SILVERED')
      AND numeric_value IS NULL
      AND boolean_value IS TRUE
    )
  )
);

CREATE TABLE IF NOT EXISTS public.character_companion_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  companion_instance_id uuid NOT NULL,
  field_kind text NOT NULL,
  integer_value integer,
  reference_value uuid,
  text_value text,
  source_note text,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (character_id, companion_instance_id, field_kind),
  CONSTRAINT character_companion_adjustments_companion_fkey
    FOREIGN KEY (character_id, companion_instance_id)
    REFERENCES public.character_creatures (character_id, id)
    ON DELETE CASCADE,
  CONSTRAINT character_companion_adjustments_value_chk CHECK (
    (
      field_kind IN ('ARMOR_CLASS_OVERRIDE', 'MAXIMUM_HIT_POINTS_OVERRIDE')
      AND integer_value >= 0
      AND reference_value IS NULL
      AND text_value IS NULL
    )
    OR (
      field_kind IN ('ALIGNMENT_OVERRIDE', 'CREATURE_TYPE_OVERRIDE')
      AND integer_value IS NULL
      AND reference_value IS NOT NULL
      AND text_value IS NULL
    )
    OR (
      field_kind = 'SIZE_OVERRIDE'
      AND integer_value IS NULL
      AND reference_value IS NULL
      AND text_value IN (
        'COLOSSAL',
        'DIMUNITIVE',
        'FINE',
        'GARGANTUAN',
        'GIANT',
        'HUGE',
        'LARGE',
        'MEDIUM',
        'SMALL',
        'TINY'
      )
    )
  )
);

CREATE TABLE IF NOT EXISTS public.character_defense_additions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  defense_kind text NOT NULL,
  damage_type_id uuid NOT NULL REFERENCES public.damage_types (id) ON DELETE RESTRICT,
  source_note text,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (character_id, defense_kind, damage_type_id),
  CONSTRAINT character_defense_additions_kind_chk CHECK (
    defense_kind IN ('IMMUNITY', 'RESISTANCE', 'VULNERABILITY')
  )
);

CREATE TABLE IF NOT EXISTS public.character_proficiency_additions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  proficiency_kind text NOT NULL,
  target_id uuid NOT NULL,
  source_note text,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (character_id, proficiency_kind, target_id),
  CONSTRAINT character_proficiency_additions_kind_chk CHECK (
    proficiency_kind IN ('ARMOR', 'LANGUAGE', 'TOOL', 'WEAPON')
  )
);

CREATE TABLE IF NOT EXISTS public.character_sheet_preferences (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE,
  movement_display_mode text NOT NULL DEFAULT 'AUTO',
  movement_speed_id uuid REFERENCES public.speeds (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_sheet_preferences_movement_chk CHECK (
    (movement_display_mode = 'AUTO' AND movement_speed_id IS NULL)
    OR (movement_display_mode = 'EXPLICIT' AND movement_speed_id IS NOT NULL)
  )
);

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'character_ability_adjustments',
    'character_saving_throw_adjustments',
    'character_skill_adjustments',
    'character_passive_adjustments',
    'character_sense_adjustments',
    'character_movement_adjustments',
    'character_hitpoint_adjustments',
    'character_spell_adjustments',
    'character_item_adjustments',
    'character_companion_adjustments',
    'character_defense_additions',
    'character_proficiency_additions'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I
         ADD COLUMN IF NOT EXISTS source_category text NOT NULL DEFAULT ''MANUAL'',
         ADD COLUMN IF NOT EXISTS source_label text',
      table_name
    );
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      table_name,
      table_name || '_source_category_chk'
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (
         source_category IN (''MAGIC'', ''MANUAL'', ''MISCELLANEOUS'', ''OTHER'')
       )',
      table_name,
      table_name || '_source_category_chk'
    );
  END LOOP;
END;
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'character_ability_adjustments',
    'character_saving_throw_adjustments',
    'character_skill_adjustments',
    'character_passive_adjustments',
    'character_sense_adjustments',
    'character_movement_adjustments',
    'character_hitpoint_adjustments',
    'character_spell_adjustments',
    'character_item_adjustments',
    'character_companion_adjustments',
    'character_defense_additions',
    'character_proficiency_additions',
    'character_sheet_preferences'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'trg_' || table_name || '_updated_at'
        AND tgrelid = format('public.%I', table_name)::regclass
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
        'trg_' || table_name || '_updated_at',
        table_name
      );
    END IF;

    EXECUTE format(
      'DROP POLICY IF EXISTS "Character owners manage Sheet state" ON public.%I',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY "Character owners manage Sheet state" ON public.%I FOR ALL TO authenticated
       USING (
         EXISTS (
           SELECT 1 FROM public.characters c
           WHERE c.id = character_id
             AND (
               c.user_id = (SELECT auth.uid())
               OR ((SELECT auth.jwt())::jsonb -> ''app_metadata'' ->> ''admin'') = ''true''
             )
         )
       )
       WITH CHECK (
         EXISTS (
           SELECT 1 FROM public.characters c
           WHERE c.id = character_id
             AND (
               c.user_id = (SELECT auth.uid())
               OR ((SELECT auth.jwt())::jsonb -> ''app_metadata'' ->> ''admin'') = ''true''
             )
         )
       )',
      table_name
    );
  END LOOP;
END;
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'character_ability_adjustments',
    'character_saving_throw_adjustments',
    'character_skill_adjustments',
    'character_passive_adjustments',
    'character_sense_adjustments',
    'character_movement_adjustments',
    'character_hitpoint_adjustments',
    'character_spell_adjustments',
    'character_item_adjustments',
    'character_companion_adjustments',
    'character_defense_additions',
    'character_proficiency_additions'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      table_name,
      table_name || '_source_note_chk'
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (
         source_note IS NULL
         OR (char_length(source_note) <= 240 AND source_note !~ E''[\\r\\n]'')
       )',
      table_name,
      table_name || '_source_note_chk'
    );
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      table_name,
      table_name || '_source_label_chk'
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (
         source_label IS NULL
         OR (
           char_length(source_label) BETWEEN 1 AND 80
           AND btrim(source_label) <> ''''
           AND source_label !~ E''[\\r\\n]''
         )
       )',
      table_name,
      table_name || '_source_label_chk'
    );
  END LOOP;
END;
$$;

INSERT INTO public.character_hitpoint_adjustments (
  id,
  character_id,
  field_kind,
  integer_value,
  source_note,
  created_by,
  updated_by
)
SELECT
  gen_random_uuid(),
  hitpoints.character_id,
  'MAXIMUM_OVERRIDE',
  hitpoints.max_override,
  'Migrated maximum HP override',
  characters.user_id,
  characters.user_id
FROM public.character_hitpoint_state hitpoints
JOIN public.characters characters ON characters.id = hitpoints.character_id
WHERE hitpoints.max_override IS NOT NULL
ON CONFLICT (character_id, field_kind) DO NOTHING;
