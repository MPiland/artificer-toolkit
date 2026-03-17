/* ============================================================================
 * Cross-domain foreign keys deferred for empty-database bootstrap.
 *
 * These constraints are intentionally added after all root tables exist so the
 * schema can be created on a fresh database without relying on impossible file
 * ordering across cyclic domains.
 * ========================================================================== */

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'starting_equipment_option_item_equipment_equipment_id_fkey') THEN
    ALTER TABLE public.starting_equipment_option_item_equipment
      ADD CONSTRAINT starting_equipment_option_item_equipment_equipment_id_fkey
      FOREIGN KEY (equipment_id) REFERENCES public.equipment(id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'damages_class_id_fkey') THEN
    ALTER TABLE public.damages
      ADD CONSTRAINT damages_class_id_fkey
      FOREIGN KEY (class_id) REFERENCES public.classes(id)
      ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_class_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_class_id_fkey
      FOREIGN KEY (class_id) REFERENCES public.classes(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_feature_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_feature_id_fkey
      FOREIGN KEY (feature_id) REFERENCES public.features(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_spell_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_spell_id_fkey
      FOREIGN KEY (spell_id) REFERENCES public.spells(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_equipment_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_equipment_id_fkey
      FOREIGN KEY (equipment_id) REFERENCES public.equipment(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_feat_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_feat_id_fkey
      FOREIGN KEY (feat_id) REFERENCES public.feats(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_race_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_race_id_fkey
      FOREIGN KEY (race_id) REFERENCES public.races(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_background_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_background_id_fkey
      FOREIGN KEY (background_id) REFERENCES public.backgrounds(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_option_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_option_id_fkey
      FOREIGN KEY (option_id) REFERENCES public.options(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_subrace_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_subrace_id_fkey
      FOREIGN KEY (subrace_id) REFERENCES public.races(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_subclass_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_subclass_id_fkey
      FOREIGN KEY (subclass_id) REFERENCES public.classes(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_resource_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_resource_id_fkey
      FOREIGN KEY (resource_id) REFERENCES public.class_resources(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_ancestry_option_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_ancestry_option_id_fkey
      FOREIGN KEY (ancestry_option_id) REFERENCES public.race_ancestry_options(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_class_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_class_id_fkey
      FOREIGN KEY (class_id) REFERENCES public.classes(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_feature_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_feature_id_fkey
      FOREIGN KEY (feature_id) REFERENCES public.features(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_spell_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_spell_id_fkey
      FOREIGN KEY (spell_id) REFERENCES public.spells(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_equipment_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_equipment_id_fkey
      FOREIGN KEY (equipment_id) REFERENCES public.equipment(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_feat_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_feat_id_fkey
      FOREIGN KEY (feat_id) REFERENCES public.feats(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_race_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_race_id_fkey
      FOREIGN KEY (race_id) REFERENCES public.races(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_background_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_background_id_fkey
      FOREIGN KEY (background_id) REFERENCES public.backgrounds(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_option_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_option_id_fkey
      FOREIGN KEY (option_id) REFERENCES public.options(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_subrace_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_subrace_id_fkey
      FOREIGN KEY (subrace_id) REFERENCES public.races(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_subclass_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_subclass_id_fkey
      FOREIGN KEY (subclass_id) REFERENCES public.classes(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_resource_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_resource_id_fkey
      FOREIGN KEY (resource_id) REFERENCES public.class_resources(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_ancestry_option_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_ancestry_option_id_fkey
      FOREIGN KEY (ancestry_option_id) REFERENCES public.race_ancestry_options(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_predicate_spell_items_spell_id_fkey') THEN
    ALTER TABLE public.facet_predicate_spell_items
      ADD CONSTRAINT facet_predicate_spell_items_spell_id_fkey
      FOREIGN KEY (spell_id) REFERENCES public.spells(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_predicate_feat_items_feat_id_fkey') THEN
    ALTER TABLE public.facet_predicate_feat_items
      ADD CONSTRAINT facet_predicate_feat_items_feat_id_fkey
      FOREIGN KEY (feat_id) REFERENCES public.feats(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_predicate_feature_items_feature_id_fkey') THEN
    ALTER TABLE public.facet_predicate_feature_items
      ADD CONSTRAINT facet_predicate_feature_items_feature_id_fkey
      FOREIGN KEY (feature_id) REFERENCES public.features(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_predicate_option_items_option_id_fkey') THEN
    ALTER TABLE public.facet_predicate_option_items
      ADD CONSTRAINT facet_predicate_option_items_option_id_fkey
      FOREIGN KEY (option_id) REFERENCES public.options(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_predicate_equipment_items_equipment_id_fkey') THEN
    ALTER TABLE public.facet_predicate_equipment_items
      ADD CONSTRAINT facet_predicate_equipment_items_equipment_id_fkey
      FOREIGN KEY (equipment_id) REFERENCES public.equipment(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feature_feat_grants_feat_grant_id_fkey') THEN
    ALTER TABLE public.feature_feat_grants
      ADD CONSTRAINT feature_feat_grants_feat_grant_id_fkey
      FOREIGN KEY (feat_grant_id) REFERENCES public.feat_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feature_modifier_grants_modifier_grant_id_fkey') THEN
    ALTER TABLE public.feature_modifier_grants
      ADD CONSTRAINT feature_modifier_grants_modifier_grant_id_fkey
      FOREIGN KEY (modifier_grant_id) REFERENCES public.modifier_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feature_proficiency_grants_proficiency_grant_id_fkey') THEN
    ALTER TABLE public.feature_proficiency_grants
      ADD CONSTRAINT feature_proficiency_grants_proficiency_grant_id_fkey
      FOREIGN KEY (proficiency_grant_id) REFERENCES public.proficiency_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feature_sense_grants_sense_grant_id_fkey') THEN
    ALTER TABLE public.feature_sense_grants
      ADD CONSTRAINT feature_sense_grants_sense_grant_id_fkey
      FOREIGN KEY (sense_grant_id) REFERENCES public.sense_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feature_spell_grants_spell_grant_id_fkey') THEN
    ALTER TABLE public.feature_spell_grants
      ADD CONSTRAINT feature_spell_grants_spell_grant_id_fkey
      FOREIGN KEY (spell_grant_id) REFERENCES public.spell_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feature_options_option_id_fkey') THEN
    ALTER TABLE public.feature_options
      ADD CONSTRAINT feature_options_option_id_fkey
      FOREIGN KEY (option_id) REFERENCES public.options(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'option_feat_grants_feat_grant_id_fkey') THEN
    ALTER TABLE public.option_feat_grants
      ADD CONSTRAINT option_feat_grants_feat_grant_id_fkey
      FOREIGN KEY (feat_grant_id) REFERENCES public.feat_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'option_modifier_grants_modifier_grant_id_fkey') THEN
    ALTER TABLE public.option_modifier_grants
      ADD CONSTRAINT option_modifier_grants_modifier_grant_id_fkey
      FOREIGN KEY (modifier_grant_id) REFERENCES public.modifier_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'option_proficiency_grants_proficiency_grant_id_fkey') THEN
    ALTER TABLE public.option_proficiency_grants
      ADD CONSTRAINT option_proficiency_grants_proficiency_grant_id_fkey
      FOREIGN KEY (proficiency_grant_id) REFERENCES public.proficiency_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'option_sense_grants_sense_grant_id_fkey') THEN
    ALTER TABLE public.option_sense_grants
      ADD CONSTRAINT option_sense_grants_sense_grant_id_fkey
      FOREIGN KEY (sense_grant_id) REFERENCES public.sense_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'option_spell_grants_spell_grant_id_fkey') THEN
    ALTER TABLE public.option_spell_grants
      ADD CONSTRAINT option_spell_grants_spell_grant_id_fkey
      FOREIGN KEY (spell_grant_id) REFERENCES public.spell_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feat_grant_feats_feat_id_fkey') THEN
    ALTER TABLE public.feat_grant_feats
      ADD CONSTRAINT feat_grant_feats_feat_id_fkey
      FOREIGN KEY (feat_id) REFERENCES public.feats(id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feat_grant_scaling_level_feats_feat_id_fkey') THEN
    ALTER TABLE public.feat_grant_scaling_level_feats
      ADD CONSTRAINT feat_grant_scaling_level_feats_feat_id_fkey
      FOREIGN KEY (feat_id) REFERENCES public.feats(id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spell_grants_class_id_fkey') THEN
    ALTER TABLE public.spell_grants
      ADD CONSTRAINT spell_grants_class_id_fkey
      FOREIGN KEY (class_id) REFERENCES public.classes(id)
      ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spell_grant_spells_spell_id_fkey') THEN
    ALTER TABLE public.spell_grant_spells
      ADD CONSTRAINT spell_grant_spells_spell_id_fkey
      FOREIGN KEY (spell_id) REFERENCES public.spells(id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spell_grant_scaling_level_spells_spell_id_fkey') THEN
    ALTER TABLE public.spell_grant_scaling_level_spells
      ADD CONSTRAINT spell_grant_scaling_level_spells_spell_id_fkey
      FOREIGN KEY (spell_id) REFERENCES public.spells(id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sense_grants_class_id_fkey') THEN
    ALTER TABLE public.sense_grants
      ADD CONSTRAINT sense_grants_class_id_fkey
      FOREIGN KEY (class_id) REFERENCES public.classes(id)
      ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'modifier_grant_payloads_numeric_class_id_fkey') THEN
    ALTER TABLE public.modifier_grant_payloads
      ADD CONSTRAINT modifier_grant_payloads_numeric_class_id_fkey
      FOREIGN KEY (numeric_class_id) REFERENCES public.classes(id)
      ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proficiency_grant_equipment_equipment_id_fkey') THEN
    ALTER TABLE public.proficiency_grant_equipment
      ADD CONSTRAINT proficiency_grant_equipment_equipment_id_fkey
      FOREIGN KEY (equipment_id) REFERENCES public.equipment(id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'background_proficiency_grants_proficiency_grant_id_fkey') THEN
    ALTER TABLE public.background_proficiency_grants
      ADD CONSTRAINT background_proficiency_grants_proficiency_grant_id_fkey
      FOREIGN KEY (proficiency_grant_id) REFERENCES public.proficiency_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'background_features_feature_id_fkey') THEN
    ALTER TABLE public.background_features
      ADD CONSTRAINT background_features_feature_id_fkey
      FOREIGN KEY (feature_id) REFERENCES public.features(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feat_effects_effect_id_fkey') THEN
    ALTER TABLE public.feat_effects
      ADD CONSTRAINT feat_effects_effect_id_fkey
      FOREIGN KEY (effect_id) REFERENCES public.effects(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feat_modifier_grants_modifier_grant_id_fkey') THEN
    ALTER TABLE public.feat_modifier_grants
      ADD CONSTRAINT feat_modifier_grants_modifier_grant_id_fkey
      FOREIGN KEY (modifier_grant_id) REFERENCES public.modifier_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feat_spell_grants_spell_grant_id_fkey') THEN
    ALTER TABLE public.feat_spell_grants
      ADD CONSTRAINT feat_spell_grants_spell_grant_id_fkey
      FOREIGN KEY (spell_grant_id) REFERENCES public.spell_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feat_sense_grants_sense_grant_id_fkey') THEN
    ALTER TABLE public.feat_sense_grants
      ADD CONSTRAINT feat_sense_grants_sense_grant_id_fkey
      FOREIGN KEY (sense_grant_id) REFERENCES public.sense_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feat_proficiency_grants_proficiency_grant_id_fkey') THEN
    ALTER TABLE public.feat_proficiency_grants
      ADD CONSTRAINT feat_proficiency_grants_proficiency_grant_id_fkey
      FOREIGN KEY (proficiency_grant_id) REFERENCES public.proficiency_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feat_features_feature_id_fkey') THEN
    ALTER TABLE public.feat_features
      ADD CONSTRAINT feat_features_feature_id_fkey
      FOREIGN KEY (feature_id) REFERENCES public.features(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_effects_effect_id_fkey') THEN
    ALTER TABLE public.equipment_effects
      ADD CONSTRAINT equipment_effects_effect_id_fkey
      FOREIGN KEY (effect_id) REFERENCES public.effects(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_modifier_grants_modifier_grant_id_fkey') THEN
    ALTER TABLE public.equipment_modifier_grants
      ADD CONSTRAINT equipment_modifier_grants_modifier_grant_id_fkey
      FOREIGN KEY (modifier_grant_id) REFERENCES public.modifier_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_features_feature_id_fkey') THEN
    ALTER TABLE public.equipment_features
      ADD CONSTRAINT equipment_features_feature_id_fkey
      FOREIGN KEY (feature_id) REFERENCES public.features(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_proficiency_grants_proficiency_grant_id_fkey') THEN
    ALTER TABLE public.class_proficiency_grants
      ADD CONSTRAINT class_proficiency_grants_proficiency_grant_id_fkey
      FOREIGN KEY (proficiency_grant_id) REFERENCES public.proficiency_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_features_feature_id_fkey') THEN
    ALTER TABLE public.class_features
      ADD CONSTRAINT class_features_feature_id_fkey
      FOREIGN KEY (feature_id) REFERENCES public.features(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_multiclass_proficiency_grants_proficiency_grant_id_fkey') THEN
    ALTER TABLE public.class_multiclass_proficiency_grants
      ADD CONSTRAINT class_multiclass_proficiency_grants_proficiency_grant_id_fkey
      FOREIGN KEY (proficiency_grant_id) REFERENCES public.proficiency_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spell_classes_class_id_fkey') THEN
    ALTER TABLE public.spell_classes
      ADD CONSTRAINT spell_classes_class_id_fkey
      FOREIGN KEY (class_id) REFERENCES public.classes(id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spell_effects_effect_id_fkey') THEN
    ALTER TABLE public.spell_effects
      ADD CONSTRAINT spell_effects_effect_id_fkey
      FOREIGN KEY (effect_id) REFERENCES public.effects(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'race_features_feature_id_fkey') THEN
    ALTER TABLE public.race_features
      ADD CONSTRAINT race_features_feature_id_fkey
      FOREIGN KEY (feature_id) REFERENCES public.features(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'race_ancestry_option_features_feature_id_fkey') THEN
    ALTER TABLE public.race_ancestry_option_features
      ADD CONSTRAINT race_ancestry_option_features_feature_id_fkey
      FOREIGN KEY (feature_id) REFERENCES public.features(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;
