import { z, lazySchema } from '../zod.js'
import { projectionChecksumSchema } from '../projections/identity.js'

/** Closed source facts consumed by the shared Authoring Schema resolver. */
export const nodeRuntimeSourceManifest = {
  abilities: ['description', 'id', 'label', 'short'],
  ability_definitions: ['description', 'id', 'label'],
  ability_modifier_references: ['description', 'id', 'label'],
  action_traits: ['description', 'id', 'label'],
  alignments: ['description', 'id', 'label'],
  background_features: ['background_id', 'feature_id'],
  backgrounds: ['id', 'label'],
  challenge_ratings: ['description', 'id', 'label'],
  class_features: ['class_id', 'feature_id'],
  class_proficiency_grants: ['class_id', 'proficiency_grant_id'],
  class_resources: ['class_id', 'id', 'label'],
  class_specializations: ['class_id', 'id', 'label'],
  classes: ['category', 'id', 'label', 'parent_class_id'],
  condition_types: ['description', 'id', 'label'],
  conditions: ['condition_type_id', 'id'],
  creature_types: ['description', 'id', 'label'],
  creatures: ['id', 'label'],
  currencies: ['code', 'description', 'id', 'label', 'short'],
  damage_types: ['description', 'id', 'label'],
  damages: ['damage_type_id', 'id'],
  effect_consume_events: ['description', 'id', 'label'],
  effect_end_events: ['description', 'id', 'label'],
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
  heritages: ['description', 'id', 'label'],
  languages: ['description', 'id', 'label'],
  magic_schools: ['description', 'id', 'label'],
  option_effects: ['effect_id', 'option_id'],
  option_proficiency_grants: ['option_id', 'proficiency_grant_id'],
  options: ['id', 'label'],
  passives: ['description', 'id', 'label'],
  proficiency_grant_equipment: ['equipment_id', 'proficiency_grant_id'],
  proficiency_grant_equipment_properties: ['proficiency_grant_id', 'property_code'],
  proficiency_grant_languages: ['language_id', 'proficiency_grant_id'],
  proficiency_grant_skills: ['proficiency_grant_id', 'skill_id'],
  race_ancestries: ['id', 'race_id'],
  race_ancestry_option_features: ['ancestry_option_id', 'feature_id'],
  race_ancestry_options: ['ancestry_id', 'id', 'label'],
  race_features: ['feature_id', 'race_id'],
  races: ['category', 'id', 'label', 'parent_race_id'],
  rarities: ['description', 'id', 'label'],
  reusable_definitions: ['id', 'label'],
  roll_influences: ['description', 'id', 'label'],
  roll_modes: ['description', 'id', 'label'],
  senses: ['description', 'id', 'label'],
  sizes: ['description', 'id', 'label'],
  skills: ['description', 'id', 'label'],
  speeds: ['description', 'id', 'label'],
  spell_effects: ['effect_id', 'spell_id'],
  spell_slot_pools: ['description', 'id', 'label'],
  spells: ['id', 'label', 'magic_school_id']
} as const satisfies Readonly<Record<string, readonly string[]>>

export type NodeRuntimeSourceTable = keyof typeof nodeRuntimeSourceManifest

/** Request-only read set checked atomically before committing prepared authoring. */
export const nodeRuntimeSourceChecksumsSchema = lazySchema(() =>
  z.partialRecord(
    z.enum(Object.keys(nodeRuntimeSourceManifest) as NodeRuntimeSourceTable[]),
    projectionChecksumSchema
  )
)

export function isNodeRuntimeSourceTable(table: string): table is NodeRuntimeSourceTable {
  return Object.hasOwn(nodeRuntimeSourceManifest, table)
}

export function isNodeRuntimeSourceColumn(table: NodeRuntimeSourceTable, column: string): boolean {
  return (nodeRuntimeSourceManifest[table] as readonly string[]).includes(column)
}

/**
 * The derivation that produced stored source facts. Bump it whenever `authoredSourceFacts` derives
 * different rows from the same document; an older or absent version is re-derived by the seed
 * (canonical rows) and `content/sourceMigrations` (all rows), never treated as a conflict.
 */
export const AUTHORED_SOURCE_FACTS_VERSION = 3

// Server-derived, checksum-bound option metadata on a cohesive authored root. These
// source keys adapt the existing resolver, not independent editable SQL-style tables.
export const authoredNodeRuntimeSourceFactsSchema = lazySchema(() =>
  z.strictObject({
    checksum: projectionChecksumSchema,
    factsVersion: z.optional(z.number().check(z.int()).check(z.positive())),
    rows: z
      .partialRecord(
        z.enum(Object.keys(nodeRuntimeSourceManifest) as NodeRuntimeSourceTable[]),
        z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])))
      )
      .check(
        z.superRefine((tables, context) => {
          for (const [table, rows] of Object.entries(tables)) {
            if (!isNodeRuntimeSourceTable(table) || !rows) continue
            const columns = nodeRuntimeSourceManifest[table]
            for (const [index, row] of rows.entries()) {
              if (
                Object.keys(row).length !== columns.length ||
                !columns.every((column) => Object.hasOwn(row, column))
              ) {
                context.addIssue({
                  code: 'custom',
                  path: [table, index],
                  message: 'Authoring source columns must match the closed manifest.'
                })
              }
            }
          }
        })
      )
  })
)

export type AuthoredNodeRuntimeSourceFacts = z.infer<typeof authoredNodeRuntimeSourceFactsSchema>
