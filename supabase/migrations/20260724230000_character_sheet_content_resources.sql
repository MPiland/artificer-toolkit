ALTER TABLE public.character_item_adjustments
  DROP CONSTRAINT IF EXISTS character_item_adjustments_value_chk;

ALTER TABLE public.character_item_adjustments
  ADD CONSTRAINT character_item_adjustments_value_chk CHECK (
    (
      field_kind IN ('ATTACK_BONUS', 'ATTACK_OVERRIDE', 'DAMAGE_BONUS')
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
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
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
  spell_id uuid REFERENCES public.spells (id) ON DELETE RESTRICT,
  source_kind text,
  source_instance_id text,
  charge_id uuid REFERENCES public.charges (id) ON DELETE RESTRICT,
  item_instance_id uuid,
  sense_grant_id uuid,
  companion_instance_id uuid,
  feature_id uuid REFERENCES public.features (id) ON DELETE RESTRICT,
  used integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_sheet_resource_usage_used_chk CHECK (used >= 0),
  CONSTRAINT character_sheet_resource_usage_item_fkey
    FOREIGN KEY (character_id, item_instance_id)
    REFERENCES public.character_equipment (character_id, id)
    ON DELETE CASCADE,
  CONSTRAINT character_sheet_resource_usage_companion_fkey
    FOREIGN KEY (character_id, companion_instance_id)
    REFERENCES public.character_creatures (character_id, id)
    ON DELETE CASCADE,
  CONSTRAINT character_sheet_resource_usage_owner_chk CHECK (
    (
      owner_kind = 'AUTHORED_GRANT'
      AND resource_grant_id IS NOT NULL
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
      owner_kind = 'SPELL_SOURCE'
      AND resource_grant_id IS NOT NULL
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
    'character_spell_customizations',
    'character_sheet_resource_usage'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
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
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON public.%I',
      'trg_' || table_name || '_updated_at',
      table_name
    );
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      'trg_' || table_name || '_updated_at',
      table_name
    );
  END LOOP;
END;
$$;
