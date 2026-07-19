-- Character HP rows are structural level-history records. Pre-release data is
-- intentionally reset because the previous grouped-class shape cannot recover
-- multiclass acquisition order without guessing.
TRUNCATE TABLE public.character_hitpoint_level_rolls, public.character_hitpoint_levels;

ALTER TABLE public.character_hitpoint_levels
  ADD COLUMN IF NOT EXISTS class_id uuid,
  ADD COLUMN IF NOT EXISTS class_level integer;

ALTER TABLE public.character_hitpoint_levels
  DROP CONSTRAINT IF EXISTS character_hitpoint_levels_character_class_fkey,
  DROP CONSTRAINT IF EXISTS character_hitpoint_levels_class_progression_uniq,
  DROP CONSTRAINT IF EXISTS character_hitpoint_levels_class_level_chk,
  ALTER COLUMN class_id SET NOT NULL,
  ALTER COLUMN class_level SET NOT NULL,
  ADD CONSTRAINT character_hitpoint_levels_character_class_fkey
    FOREIGN KEY (character_id, class_id)
    REFERENCES public.character_classes (character_id, class_id)
    ON DELETE CASCADE DEFERRABLE,
  ADD CONSTRAINT character_hitpoint_levels_class_progression_uniq
    UNIQUE (character_id, class_id, class_level),
  ADD CONSTRAINT character_hitpoint_levels_class_level_chk CHECK (class_level > 0);
