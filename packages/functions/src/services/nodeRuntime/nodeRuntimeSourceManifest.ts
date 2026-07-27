/** Exact database columns that shipped Authoring Schema data sources may query. */
export const nodeRuntimeSourceManifest = {
  alignments: ['id', 'label'],
  background_features: ['background_id', 'feature_id'],
  backgrounds: ['id', 'label'],
  challenge_ratings: ['id', 'label'],
  class_features: ['class_id', 'feature_id'],
  class_proficiency_grants: ['class_id', 'proficiency_grant_id'],
  class_resources: ['class_id', 'id', 'label'],
  class_specializations: ['class_id', 'id', 'label'],
  classes: ['category', 'id', 'label', 'parent_class_id'],
  condition_types: ['id', 'label', 'tooltip'],
  conditions: ['condition_type_id', 'id'],
  creature_types: ['id', 'label'],
  creatures: ['id', 'label'],
  currencies: ['code', 'description', 'id', 'label', 'short', 'tooltip'],
  damage_types: ['id', 'label', 'tooltip'],
  damages: ['damage_type_id', 'id'],
  effect_path_choice_options: ['path_id', 'result_block_id'],
  effect_path_roll_table_rows: ['path_id', 'result_block_id'],
  effect_paths: ['effect_id', 'id', 'result_block_id'],
  effect_result_block_outcomes: ['outcome_id', 'result_block_id'],
  equipment: ['category', 'id', 'label'],
  equipment_effects: ['effect_id', 'equipment_id'],
  equipment_features: ['equipment_id', 'feature_id'],
  equipment_properties: ['equipment_id', 'property_code'],
  feat_effects: ['effect_id', 'feat_id'],
  feat_features: ['feat_id', 'feature_id'],
  feat_proficiency_grants: ['feat_id', 'proficiency_grant_id'],
  feats: ['id', 'label'],
  feature_effects: ['effect_id', 'feature_id'],
  feature_options: ['feature_id', 'option_id'],
  feature_proficiency_grants: ['feature_id', 'proficiency_grant_id'],
  features: ['id', 'label'],
  heritages: ['id', 'label'],
  languages: ['id', 'label', 'tooltip'],
  magic_schools: ['id', 'label'],
  option_effects: ['effect_id', 'option_id'],
  option_proficiency_grants: ['option_id', 'proficiency_grant_id'],
  options: ['id', 'label'],
  proficiency_grant_languages: ['language_id', 'proficiency_grant_id'],
  proficiency_grant_skills: ['proficiency_grant_id', 'skill_id'],
  race_ancestries: ['id', 'race_id'],
  race_ancestry_option_features: ['ancestry_option_id', 'feature_id'],
  race_ancestry_options: ['ancestry_id', 'id', 'label'],
  race_features: ['feature_id', 'race_id'],
  races: ['category', 'id', 'label', 'parent_race_id'],
  rarities: ['id', 'label'],
  senses: ['id', 'label'],
  skills: ['id', 'label', 'tooltip'],
  speeds: ['id', 'label', 'tooltip'],
  spell_effects: ['effect_id', 'spell_id'],
  spells: ['id', 'label', 'magic_school_id']
} as const satisfies Readonly<Record<string, readonly string[]>>

export type NodeRuntimeSourceTable = keyof typeof nodeRuntimeSourceManifest

export function isNodeRuntimeSourceTable(table: string): table is NodeRuntimeSourceTable {
  return Object.hasOwn(nodeRuntimeSourceManifest, table)
}

export function isNodeRuntimeSourceColumn(table: NodeRuntimeSourceTable, column: string): boolean {
  return (nodeRuntimeSourceManifest[table] as readonly string[]).includes(column)
}
