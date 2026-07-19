CREATE TABLE IF NOT EXISTS public.character_chosen_grant_selections (
  id uuid PRIMARY KEY,
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  grant_id uuid NOT NULL,
  source_kind text NOT NULL,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  subclass_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  source_class_level integer,
  race_id uuid REFERENCES public.races (id) ON DELETE SET NULL DEFERRABLE,
  subrace_id uuid REFERENCES public.races (id) ON DELETE SET NULL DEFERRABLE,
  ancestry_id uuid REFERENCES public.race_ancestries (id) ON DELETE SET NULL DEFERRABLE,
  option_id uuid REFERENCES public.options (id) ON DELETE SET NULL DEFERRABLE,
  acquired_parent_id uuid,
  background_id uuid REFERENCES public.backgrounds (id) ON DELETE SET NULL DEFERRABLE,
  feat_id uuid REFERENCES public.feats (id) ON DELETE SET NULL DEFERRABLE,
  feature_id uuid REFERENCES public.features (id) ON DELETE SET NULL DEFERRABLE,
  reason text,
  timing_kind text NOT NULL,
  timing_level integer,
  timing_class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  timing_class_level integer,
  progression_level integer,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_chosen_grant_selection_source_kind_chk CHECK (
    source_kind IN ('CLASS', 'SUBCLASS', 'RACE', 'SUBRACE', 'ANCESTRY', 'BACKGROUND', 'FEAT', 'FEATURE', 'OPTION', 'MANUAL')
  ),
  CONSTRAINT character_chosen_grant_selection_source_ref_chk CHECK (
    (source_kind = 'CLASS' AND class_id IS NOT NULL AND subclass_id IS NULL AND race_id IS NULL AND subrace_id IS NULL AND ancestry_id IS NULL AND option_id IS NULL AND acquired_parent_id IS NULL AND background_id IS NULL AND feat_id IS NULL AND feature_id IS NULL AND reason IS NULL)
    OR (source_kind = 'SUBCLASS' AND class_id IS NULL AND subclass_id IS NOT NULL AND race_id IS NULL AND subrace_id IS NULL AND ancestry_id IS NULL AND option_id IS NULL AND acquired_parent_id IS NULL AND background_id IS NULL AND feat_id IS NULL AND feature_id IS NULL AND reason IS NULL)
    OR (source_kind = 'RACE' AND class_id IS NULL AND subclass_id IS NULL AND source_class_level IS NULL AND race_id IS NOT NULL AND subrace_id IS NULL AND ancestry_id IS NULL AND option_id IS NULL AND acquired_parent_id IS NULL AND background_id IS NULL AND feat_id IS NULL AND feature_id IS NULL AND reason IS NULL)
    OR (source_kind = 'SUBRACE' AND class_id IS NULL AND subclass_id IS NULL AND source_class_level IS NULL AND race_id IS NULL AND subrace_id IS NOT NULL AND ancestry_id IS NULL AND option_id IS NULL AND acquired_parent_id IS NULL AND background_id IS NULL AND feat_id IS NULL AND feature_id IS NULL AND reason IS NULL)
    OR (source_kind = 'ANCESTRY' AND class_id IS NULL AND subclass_id IS NULL AND source_class_level IS NULL AND race_id IS NULL AND subrace_id IS NULL AND ancestry_id IS NOT NULL AND option_id IS NOT NULL AND acquired_parent_id IS NULL AND background_id IS NULL AND feat_id IS NULL AND feature_id IS NULL AND reason IS NULL)
    OR (source_kind = 'BACKGROUND' AND class_id IS NULL AND subclass_id IS NULL AND source_class_level IS NULL AND race_id IS NULL AND subrace_id IS NULL AND ancestry_id IS NULL AND option_id IS NULL AND acquired_parent_id IS NULL AND background_id IS NOT NULL AND feat_id IS NULL AND feature_id IS NULL AND reason IS NULL)
    OR (source_kind = 'FEAT' AND class_id IS NULL AND subclass_id IS NULL AND source_class_level IS NULL AND race_id IS NULL AND subrace_id IS NULL AND ancestry_id IS NULL AND option_id IS NULL AND acquired_parent_id IS NULL AND background_id IS NULL AND feat_id IS NOT NULL AND feature_id IS NULL AND reason IS NULL)
    OR (source_kind = 'FEATURE' AND class_id IS NULL AND subclass_id IS NULL AND source_class_level IS NULL AND race_id IS NULL AND subrace_id IS NULL AND ancestry_id IS NULL AND option_id IS NULL AND acquired_parent_id IS NULL AND background_id IS NULL AND feat_id IS NULL AND feature_id IS NOT NULL AND reason IS NULL)
    OR (source_kind = 'OPTION' AND class_id IS NULL AND subclass_id IS NULL AND source_class_level IS NULL AND race_id IS NULL AND subrace_id IS NULL AND ancestry_id IS NULL AND option_id IS NOT NULL AND acquired_parent_id IS NOT NULL AND background_id IS NULL AND feat_id IS NULL AND feature_id IS NULL AND reason IS NULL)
    OR (source_kind = 'MANUAL' AND class_id IS NULL AND subclass_id IS NULL AND source_class_level IS NULL AND race_id IS NULL AND subrace_id IS NULL AND ancestry_id IS NULL AND option_id IS NULL AND acquired_parent_id IS NULL AND background_id IS NULL AND feat_id IS NULL AND feature_id IS NULL)
  ),
  CONSTRAINT character_chosen_grant_selection_source_level_chk CHECK (
    source_class_level IS NULL OR source_class_level > 0
  ),
  CONSTRAINT character_chosen_grant_selection_timing_kind_chk CHECK (
    timing_kind IN ('IMMEDIATE', 'CHARACTER_LEVEL', 'CLASS_LEVEL')
  ),
  CONSTRAINT character_chosen_grant_selection_timing_ref_chk CHECK (
    (timing_kind = 'IMMEDIATE' AND timing_level IS NULL AND timing_class_id IS NULL AND timing_class_level IS NULL)
    OR (timing_kind = 'CHARACTER_LEVEL' AND timing_level IS NOT NULL AND timing_level > 0 AND timing_class_id IS NULL AND timing_class_level IS NULL)
    OR (timing_kind = 'CLASS_LEVEL' AND timing_level IS NULL AND timing_class_id IS NOT NULL AND timing_class_level IS NOT NULL AND timing_class_level > 0)
  ),
  CONSTRAINT character_chosen_grant_selection_progression_level_chk CHECK (
    progression_level IS NULL OR progression_level > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_character_chosen_grant_selections_character_id
  ON public.character_chosen_grant_selections (character_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_chosen_grant_selections_updated_at'
      AND tgrelid = 'public.character_chosen_grant_selections'::regclass) THEN
  CREATE TRIGGER trg_character_chosen_grant_selections_updated_at
    BEFORE UPDATE ON public.character_chosen_grant_selections
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_chosen_grant_selections ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_chosen_grant_selection_targets (
  selection_id uuid NOT NULL REFERENCES public.character_chosen_grant_selections (id) ON DELETE CASCADE DEFERRABLE,
  slot_index integer NOT NULL,
  target_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (selection_id, slot_index),
  CONSTRAINT character_chosen_grant_selection_target_slot_chk CHECK (
    slot_index >= 0
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_chosen_grant_selection_targets_updated_at'
      AND tgrelid = 'public.character_chosen_grant_selection_targets'::regclass) THEN
  CREATE TRIGGER trg_character_chosen_grant_selection_targets_updated_at
    BEFORE UPDATE ON public.character_chosen_grant_selection_targets
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_chosen_grant_selection_targets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'character_chosen_grant_selections_acquired_parent_id_fkey'
      AND conrelid = 'public.character_chosen_grant_selections'::regclass
  ) THEN
    ALTER TABLE public.character_chosen_grant_selections
      ADD CONSTRAINT character_chosen_grant_selections_acquired_parent_id_fkey
      FOREIGN KEY (acquired_parent_id)
      REFERENCES public.character_feature_acquisitions (id)
      ON DELETE SET NULL
      DEFERRABLE;
  END IF;
END;
$$;
