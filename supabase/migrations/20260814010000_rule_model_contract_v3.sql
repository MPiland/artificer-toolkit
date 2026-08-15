ALTER TABLE public.rule_pack_revisions
  ALTER COLUMN model_contract_version SET DEFAULT 3;

UPDATE public.rule_pack_revisions
SET model_contract_version = 3
WHERE activated_at IS NULL;
