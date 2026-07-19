ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS subclass_selection_level smallint;

ALTER TABLE public.classes
  DROP CONSTRAINT IF EXISTS classes_subclass_selection_level_chk;

ALTER TABLE public.classes
  ADD CONSTRAINT classes_subclass_selection_level_chk CHECK (
    (category = 'BASE' AND (subclass_selection_level IS NULL OR subclass_selection_level BETWEEN 1 AND 20))
    OR (category = 'SUBCLASS' AND subclass_selection_level IS NULL)
  );
