ALTER TABLE public.character_sheet_resource_usage
  ADD COLUMN IF NOT EXISTS source_id text;

ALTER TABLE public.character_sheet_resource_usage
  DROP CONSTRAINT IF EXISTS character_sheet_resource_usage_owner_chk;

ALTER TABLE public.character_sheet_resource_usage
  ADD CONSTRAINT character_sheet_resource_usage_owner_chk CHECK (
    (owner_kind = 'AUTHORED_GRANT' AND resource_grant_id IS NOT NULL AND source_id IS NULL AND spell_id IS NULL AND source_kind IS NULL AND source_instance_id IS NULL AND charge_id IS NULL AND item_instance_id IS NULL AND sense_grant_id IS NULL AND companion_instance_id IS NULL AND feature_id IS NULL)
    OR (owner_kind = 'AUTHORED_SOURCE' AND resource_grant_id IS NULL AND source_id IS NOT NULL AND spell_id IS NULL AND source_kind IS NULL AND source_instance_id IS NULL AND charge_id IS NOT NULL AND item_instance_id IS NULL AND sense_grant_id IS NULL AND companion_instance_id IS NULL AND feature_id IS NULL)
    OR (owner_kind = 'SPELL_SOURCE' AND resource_grant_id IS NOT NULL AND source_id IS NULL AND spell_id IS NOT NULL AND source_kind IN ('BACKGROUND', 'CLASS', 'FEAT', 'FEATURE', 'ITEM', 'OPTION', 'RACE', 'SUBCLASS') AND source_instance_id IS NOT NULL AND charge_id IS NULL AND item_instance_id IS NULL AND sense_grant_id IS NULL AND companion_instance_id IS NULL AND feature_id IS NULL)
    OR (owner_kind = 'ITEM_INSTANCE' AND resource_grant_id IS NULL AND source_id IS NULL AND spell_id IS NULL AND source_kind IS NULL AND source_instance_id IS NULL AND charge_id IS NOT NULL AND item_instance_id IS NOT NULL AND sense_grant_id IS NULL AND companion_instance_id IS NULL AND feature_id IS NULL)
    OR (owner_kind = 'SENSE_GRANT' AND resource_grant_id IS NULL AND source_id IS NULL AND spell_id IS NULL AND source_kind IS NULL AND source_instance_id IS NULL AND charge_id IS NULL AND item_instance_id IS NULL AND sense_grant_id IS NOT NULL AND companion_instance_id IS NULL AND feature_id IS NULL)
    OR (owner_kind = 'COMPANION_FEATURE' AND resource_grant_id IS NULL AND source_id IS NULL AND spell_id IS NULL AND source_kind IS NULL AND source_instance_id IS NULL AND charge_id IS NOT NULL AND item_instance_id IS NULL AND sense_grant_id IS NULL AND companion_instance_id IS NOT NULL AND feature_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS character_sheet_resource_usage_authored_source_uq
  ON public.character_sheet_resource_usage (character_id, source_id, charge_id)
  WHERE owner_kind = 'AUTHORED_SOURCE';
