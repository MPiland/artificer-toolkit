/* Sheet-owned, per-character adjustment intent. Derived totals are never stored here. */

CREATE TABLE IF NOT EXISTS public.character_ability_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  ability_code text NOT NULL,
  field_kind text NOT NULL,
  integer_value integer NOT NULL,
  source_note text,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (character_id, item_instance_id, field_kind),
  CONSTRAINT character_item_adjustments_item_fkey
    FOREIGN KEY (item_instance_id)
    REFERENCES public.inventory_items (id)
    ON DELETE CASCADE,
  CONSTRAINT character_item_adjustments_value_chk CHECK (
    (
      field_kind IN (
        'ATTACK_BONUS',
        'ATTACK_OVERRIDE',
        'DAMAGE_BONUS'
      )
      AND numeric_value IS NOT NULL
      AND boolean_value IS NULL
    )
    OR (
      field_kind IN ('COST_OVERRIDE', 'WEIGHT_OVERRIDE')
      AND numeric_value >= 0
      AND boolean_value IS NULL
    )
    OR (
      field_kind IN ('ADAMANTINE', 'DISPLAY_AS_ATTACK', 'DUAL_WIELD', 'SILVERED')
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
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_sheet_preferences_movement_chk CHECK (
    (movement_display_mode = 'AUTO' AND movement_speed_id IS NULL)
    OR (movement_display_mode = 'EXPLICIT' AND movement_speed_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.character_spell_customizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE RESTRICT,
  source_kind text NOT NULL,
  source_instance_id text NOT NULL,
  custom_name text,
  notes text,
  display_as_attack boolean NOT NULL DEFAULT FALSE,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (character_id, spell_id, source_kind, source_instance_id),
  CONSTRAINT character_spell_customizations_source_kind_chk CHECK (
    source_kind IN ('BACKGROUND', 'CLASS', 'FEAT', 'FEATURE', 'ITEM', 'OPTION', 'RACE', 'SUBCLASS')
  ),
  CONSTRAINT character_spell_customizations_name_chk CHECK (
    custom_name IS NULL OR char_length(custom_name) BETWEEN 1 AND 120
  ),
  CONSTRAINT character_spell_customizations_notes_chk CHECK (
    notes IS NULL OR char_length(notes) <= 2000
  )
);

CREATE TABLE IF NOT EXISTS public.character_sheet_resource_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  owner_kind text NOT NULL,
  resource_grant_id text,
  source_id text,
  spell_id uuid REFERENCES public.spells (id) ON DELETE RESTRICT,
  source_kind text,
  source_instance_id text,
  charge_id uuid REFERENCES public.charges (id) ON DELETE RESTRICT,
  item_instance_id uuid,
  sense_grant_id uuid,
  companion_instance_id uuid,
  feature_id uuid REFERENCES public.features (id) ON DELETE RESTRICT,
  used integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_sheet_resource_usage_used_chk CHECK (used >= 0),
  CONSTRAINT character_sheet_resource_usage_item_fkey
    FOREIGN KEY (item_instance_id)
    REFERENCES public.inventory_items (id)
    ON DELETE CASCADE,
  CONSTRAINT character_sheet_resource_usage_companion_fkey
    FOREIGN KEY (character_id, companion_instance_id)
    REFERENCES public.character_creatures (character_id, id)
    ON DELETE CASCADE,
  CONSTRAINT character_sheet_resource_usage_owner_chk CHECK (
    (
      owner_kind = 'AUTHORED_GRANT'
      AND resource_grant_id IS NOT NULL
      AND source_id IS NULL
      AND spell_id IS NULL
      AND source_kind IS NULL
      AND source_instance_id IS NULL
      AND charge_id IS NULL
      AND item_instance_id IS NULL
      AND sense_grant_id IS NULL
      AND companion_instance_id IS NULL
      AND feature_id IS NULL
    )
    OR (
      owner_kind = 'AUTHORED_SOURCE'
      AND resource_grant_id IS NULL
      AND source_id IS NOT NULL
      AND spell_id IS NULL
      AND source_kind IS NULL
      AND source_instance_id IS NULL
      AND charge_id IS NOT NULL
      AND item_instance_id IS NULL
      AND sense_grant_id IS NULL
      AND companion_instance_id IS NULL
      AND feature_id IS NULL
    )
    OR (
      owner_kind = 'SPELL_SOURCE'
      AND resource_grant_id IS NOT NULL
      AND source_id IS NULL
      AND spell_id IS NOT NULL
      AND source_kind IN ('BACKGROUND', 'CLASS', 'FEAT', 'FEATURE', 'ITEM', 'OPTION', 'RACE', 'SUBCLASS')
      AND source_instance_id IS NOT NULL
      AND charge_id IS NULL
      AND item_instance_id IS NULL
      AND sense_grant_id IS NULL
      AND companion_instance_id IS NULL
      AND feature_id IS NULL
    )
    OR (
      owner_kind = 'ITEM_INSTANCE'
      AND resource_grant_id IS NULL
      AND source_id IS NULL
      AND spell_id IS NULL
      AND source_kind IS NULL
      AND source_instance_id IS NULL
      AND charge_id IS NOT NULL
      AND item_instance_id IS NOT NULL
      AND sense_grant_id IS NULL
      AND companion_instance_id IS NULL
      AND feature_id IS NULL
    )
    OR (
      owner_kind = 'SENSE_GRANT'
      AND resource_grant_id IS NULL
      AND source_id IS NULL
      AND spell_id IS NULL
      AND source_kind IS NULL
      AND source_instance_id IS NULL
      AND charge_id IS NULL
      AND item_instance_id IS NULL
      AND sense_grant_id IS NOT NULL
      AND companion_instance_id IS NULL
      AND feature_id IS NULL
    )
    OR (
      owner_kind = 'COMPANION_FEATURE'
      AND resource_grant_id IS NULL
      AND source_id IS NULL
      AND spell_id IS NULL
      AND source_kind IS NULL
      AND source_instance_id IS NULL
      AND charge_id IS NOT NULL
      AND item_instance_id IS NULL
      AND sense_grant_id IS NULL
      AND companion_instance_id IS NOT NULL
      AND feature_id IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS character_sheet_resource_usage_authored_uq
  ON public.character_sheet_resource_usage (character_id, resource_grant_id)
  WHERE owner_kind = 'AUTHORED_GRANT';
CREATE UNIQUE INDEX IF NOT EXISTS character_sheet_resource_usage_authored_source_uq
  ON public.character_sheet_resource_usage (character_id, source_id, charge_id)
  WHERE owner_kind = 'AUTHORED_SOURCE';
CREATE UNIQUE INDEX IF NOT EXISTS character_sheet_resource_usage_spell_uq
  ON public.character_sheet_resource_usage (
    character_id,
    resource_grant_id,
    spell_id,
    source_kind,
    source_instance_id
  )
  WHERE owner_kind = 'SPELL_SOURCE';
CREATE UNIQUE INDEX IF NOT EXISTS character_sheet_resource_usage_item_uq
  ON public.character_sheet_resource_usage (character_id, item_instance_id, charge_id)
  WHERE owner_kind = 'ITEM_INSTANCE';
CREATE UNIQUE INDEX IF NOT EXISTS character_sheet_resource_usage_sense_uq
  ON public.character_sheet_resource_usage (character_id, sense_grant_id)
  WHERE owner_kind = 'SENSE_GRANT';
CREATE UNIQUE INDEX IF NOT EXISTS character_sheet_resource_usage_companion_uq
  ON public.character_sheet_resource_usage (character_id, companion_instance_id, feature_id, charge_id)
  WHERE owner_kind = 'COMPANION_FEATURE';

INSERT INTO public.character_sheet_resource_usage (
  character_id,
  owner_kind,
  resource_grant_id,
  used,
  created_by,
  updated_by
)
SELECT
  legacy.character_id,
  'AUTHORED_GRANT',
  legacy.resource_grant_id,
  legacy.used,
  characters.user_id,
  characters.user_id
FROM public.character_resources AS legacy
JOIN public.characters AS characters ON characters.id = legacy.character_id
ON CONFLICT (character_id, resource_grant_id) WHERE owner_kind = 'AUTHORED_GRANT'
DO UPDATE SET used = EXCLUDED.used, updated_by = EXCLUDED.updated_by;

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
    'character_sheet_preferences',
    'character_spell_customizations',
    'character_sheet_resource_usage'
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

CREATE OR REPLACE FUNCTION public.assert_character_inventory_item_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.item_instance_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.inventory_items AS item
    JOIN public.inventory_owners AS inventory_owner ON inventory_owner.id = item.owner_id
    WHERE item.id = NEW.item_instance_id
      AND inventory_owner.kind = 'CHARACTER'
      AND inventory_owner.character_id = NEW.character_id
    FOR KEY SHARE OF item, inventory_owner
  ) THEN
    RAISE EXCEPTION 'Inventory item % does not belong to character %.',
      NEW.item_instance_id,
      NEW.character_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_character_item_sheet_state_on_inventory_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  source_character_id uuid;
BEGIN
  IF OLD.owner_id = NEW.owner_id THEN
    RETURN NEW;
  END IF;

  SELECT inventory_owner.character_id
  INTO source_character_id
  FROM public.inventory_owners AS inventory_owner
  WHERE inventory_owner.id = OLD.owner_id
    AND inventory_owner.kind = 'CHARACTER'
  FOR KEY SHARE;

  IF source_character_id IS NOT NULL THEN
    DELETE FROM public.character_item_adjustments
    WHERE character_id = source_character_id
      AND item_instance_id = OLD.id;

    DELETE FROM public.character_sheet_resource_usage
    WHERE character_id = source_character_id
      AND item_instance_id = OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_character_inventory_item_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_character_item_sheet_state_on_inventory_transfer() FROM PUBLIC;

DROP TRIGGER IF EXISTS character_item_adjustments_inventory_owner ON public.character_item_adjustments;
CREATE TRIGGER character_item_adjustments_inventory_owner
  BEFORE INSERT OR UPDATE OF character_id, item_instance_id ON public.character_item_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.assert_character_inventory_item_owner();

DROP TRIGGER IF EXISTS character_sheet_resource_usage_inventory_owner ON public.character_sheet_resource_usage;
CREATE TRIGGER character_sheet_resource_usage_inventory_owner
  BEFORE INSERT OR UPDATE OF character_id, item_instance_id ON public.character_sheet_resource_usage
  FOR EACH ROW EXECUTE FUNCTION public.assert_character_inventory_item_owner();

DROP TRIGGER IF EXISTS inventory_items_clear_character_item_sheet_state ON public.inventory_items;
CREATE TRIGGER inventory_items_clear_character_item_sheet_state
  AFTER UPDATE OF owner_id ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.clear_character_item_sheet_state_on_inventory_transfer();

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
  END LOOP;
END;
$$;
