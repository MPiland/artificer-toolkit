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
      'UPDATE public.%I
       SET source_note = CASE
         WHEN source_label IS NULL OR btrim(source_label) = '''' THEN source_note
         WHEN source_note IS NULL OR btrim(source_note) = '''' THEN left(btrim(source_label), 240)
         ELSE left(btrim(source_label) || '' — '' || btrim(source_note), 240)
       END
       WHERE source_label IS NOT NULL AND btrim(source_label) <> ''''',
      table_name
    );

    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      table_name,
      table_name || '_source_category_chk'
    );
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      table_name,
      table_name || '_source_label_chk'
    );
    EXECUTE format(
      'ALTER TABLE public.%I DROP COLUMN IF EXISTS source_category',
      table_name
    );
    EXECUTE format(
      'ALTER TABLE public.%I DROP COLUMN IF EXISTS source_label',
      table_name
    );
  END LOOP;
END;
$$;
