-- A character can answer an authored grant choice once for each active owner
-- and progression level. Source class level is acquisition metadata, not owner
-- identity, so it is intentionally excluded from this index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_character_chosen_grant_selection_identity
  ON public.character_chosen_grant_selections (
    character_id,
    grant_id,
    source_kind,
    class_id,
    subclass_id,
    race_id,
    subrace_id,
    ancestry_id,
    option_id,
    acquired_parent_id,
    background_id,
    feat_id,
    feature_id,
    reason,
    progression_level
  ) NULLS NOT DISTINCT;
