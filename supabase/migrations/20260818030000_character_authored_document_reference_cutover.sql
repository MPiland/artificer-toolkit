-- Character rows retain canonical root references and local relational integrity.
-- Nested authored IDs are validated from the exact authored-version vector and may
-- not depend on normalized child rows that source-only seeding intentionally omits.

ALTER TABLE public.character_ancestry_acquisitions
  DROP CONSTRAINT IF EXISTS character_ancestry_acquisitions_ancestry_id_fkey,
  DROP CONSTRAINT IF EXISTS character_ancestry_acquisitions_option_id_fkey;

ALTER TABLE public.character_classes
  DROP CONSTRAINT IF EXISTS character_classes_specialization_id_fkey;

ALTER TABLE public.character_chosen_grant_selections
  DROP CONSTRAINT IF EXISTS character_chosen_grant_selections_ancestry_id_fkey,
  DROP CONSTRAINT IF EXISTS character_chosen_grant_selections_feature_id_fkey,
  DROP CONSTRAINT IF EXISTS character_chosen_grant_selections_option_id_fkey;

ALTER TABLE public.character_feature_acquisitions
  DROP CONSTRAINT IF EXISTS character_feature_acquisitions_ancestry_id_fkey,
  DROP CONSTRAINT IF EXISTS character_feature_acquisitions_feature_id_fkey,
  DROP CONSTRAINT IF EXISTS character_feature_acquisitions_option_id_fkey;

ALTER TABLE public.character_spell_selections
  DROP CONSTRAINT IF EXISTS character_spell_selections_feature_id_fkey,
  DROP CONSTRAINT IF EXISTS character_spell_selections_option_id_fkey;

ALTER TABLE public.character_resource_grants
  DROP CONSTRAINT IF EXISTS character_resource_grants_resource_id_fkey,
  DROP CONSTRAINT IF EXISTS character_resource_grants_feature_id_fkey,
  DROP CONSTRAINT IF EXISTS character_resource_grants_option_id_fkey;

ALTER TABLE public.character_sheet_resource_usage
  DROP CONSTRAINT IF EXISTS character_sheet_resource_usage_charge_id_fkey,
  DROP CONSTRAINT IF EXISTS character_sheet_resource_usage_feature_id_fkey;

ALTER TABLE public.character_class_equipment_session
  DROP CONSTRAINT IF EXISTS character_class_equipment_session_option_fkey;

ALTER TABLE public.character_class_equipment_groups
  DROP CONSTRAINT IF EXISTS character_class_equipment_groups_group_id_fkey,
  DROP CONSTRAINT IF EXISTS character_class_equipment_groups_option_id_fkey;

ALTER TABLE public.character_class_equipment_items
  DROP CONSTRAINT IF EXISTS character_class_equipment_items_group_id_fkey,
  DROP CONSTRAINT IF EXISTS character_class_equipment_items_selection_item_id_fkey;

ALTER TABLE public.character_background_equipment_groups
  DROP CONSTRAINT IF EXISTS character_background_equipment_groups_group_id_fkey,
  DROP CONSTRAINT IF EXISTS character_background_equipment_groups_option_id_fkey;

ALTER TABLE public.character_background_equipment_items
  DROP CONSTRAINT IF EXISTS character_background_equipment_items_group_id_fkey,
  DROP CONSTRAINT IF EXISTS character_background_equipment_items_selection_item_id_fkey;
