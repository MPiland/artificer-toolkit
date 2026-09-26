import { z } from '../zod.js'

export const RULE_RUNTIME_GRAPH_FAMILY_KEY = 'rules-runtime-graph'
export const RULE_RUNTIME_GRAPH_CONTRACT_VERSION = 1
export const SENSE_DEFINITION_FAMILY_KEY = 'sense'
export const RULE_CAPABILITY_DEFINITION_FAMILY_KEY = 'rule-capability'
export const CONDITION_RULE_STATE_DEFINITION_FAMILY_KEY = 'condition-rule-state'
export const RULE_MAINTENANCE_DEFINITION_FAMILY_KEY = 'rule-maintenance'
export const INITIATIVE_POLICY_DEFINITION_FAMILY_KEY = 'initiative-policy'
export const DND5E_ENCOUNTER_LIFECYCLE_DEFINITION_FAMILY_KEY = 'dnd5e-encounter-lifecycle'
export const DND5E_OPTIONAL_COMBAT_DEFINITION_FAMILY_KEY = 'dnd5e-optional-combat'
export const BASIC_ACTION_DEFINITION_FAMILY_KEY = 'basic-action'

export const dnd5eOptionalCombatRuleKindDtoSchema = z.enum([
  'FLANKING',
  'ALTERNATING_DIAGONALS',
  'FACING',
  'CLIMB_ONTO_LARGER_CREATURE',
  'DISARM',
  'MARK',
  'OVERRUN',
  'SHOVE_ASIDE',
  'TUMBLE',
  'HITTING_COVER',
  'CLEAVING',
  'INJURIES',
  'MASSIVE_DAMAGE',
  'MORALE'
])

// Executable System families can also include compiler-generated actions. Only
// these families have a standalone authored document and publisher.
export const REUSABLE_DEFINITION_AUTHORING_FAMILY_KEYS = [
  RULE_RUNTIME_GRAPH_FAMILY_KEY,
  SENSE_DEFINITION_FAMILY_KEY,
  RULE_CAPABILITY_DEFINITION_FAMILY_KEY,
  CONDITION_RULE_STATE_DEFINITION_FAMILY_KEY,
  RULE_MAINTENANCE_DEFINITION_FAMILY_KEY,
  INITIATIVE_POLICY_DEFINITION_FAMILY_KEY,
  DND5E_ENCOUNTER_LIFECYCLE_DEFINITION_FAMILY_KEY,
  DND5E_OPTIONAL_COMBAT_DEFINITION_FAMILY_KEY,
  BASIC_ACTION_DEFINITION_FAMILY_KEY
] as const

// Storage identity must not load the executable graph/geometry schema dependency tree.
export const reusableDefinitionFamilyKeyDtoSchema = z
  .string()
  .check(z.trim())
  .check(z.minLength(1))
  .check(z.maxLength(80))
  .check(z.regex(/^[a-z][a-z0-9.-]{0,79}$/))
