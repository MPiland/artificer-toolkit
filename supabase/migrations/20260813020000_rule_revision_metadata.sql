ALTER TABLE public.rule_pack_revisions
  ADD COLUMN IF NOT EXISTS evaluator_kind text NOT NULL DEFAULT 'ZEN'
    CHECK (evaluator_kind = 'ZEN'),
  ADD COLUMN IF NOT EXISTS evaluator_version text NOT NULL DEFAULT '0.54.0'
    CHECK (char_length(btrim(evaluator_version)) BETWEEN 1 AND 80),
  ADD COLUMN IF NOT EXISTS model_contract_version integer NOT NULL DEFAULT 1
    CHECK (model_contract_version BETWEEN 1 AND 10000);

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS rule_pack_revision_id uuid
    REFERENCES public.rule_pack_revisions (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_characters_rule_pack_revision_id
  ON public.characters (rule_pack_revision_id);
