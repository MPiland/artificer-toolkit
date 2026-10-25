import { SRD_BASIC_ACTION_DEFINITIONS } from './basicActions.js'
import { SRD_CONCENTRATION_DEFINITIONS } from './concentration.js'
import { SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS } from './encounterLifecycle.js'
import { SRD_INITIATIVE_POLICY_DEFINITIONS } from './initiativePolicies.js'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from './optionalCombat.js'
import { SRD_RULE_STATE_DEFINITIONS } from './ruleState.js'
import { SRD_SENSE_DEFINITIONS } from './senses.js'
import { SRD_SYSTEM_ID } from './vocabulary.js'

export const SRD_RULES_CATALOGUE = {
  id: '00000000-0000-4000-8000-000000000301',
  gameSystemId: SRD_SYSTEM_ID,
  code: 'dnd-2014',
  label: 'D&D 2014',
  description: 'D&D 5e 2014 catalogue.'
} as const

export const SRD_CONTENT_SOURCE = {
  id: '00000000-0000-4000-8000-000000000302',
  gameSystemId: SRD_SYSTEM_ID,
  kind: 'PLATFORM',
  ownerUserId: null,
  code: 'srd-5.1',
  label: 'SRD 5.1',
  description: 'D&D 5e SRD 5.1 platform source.'
} as const

export interface SrdReusableDefinitionSeed {
  id: string
  definitionFamilyKey: string
  label: string
  description: string
  document: unknown
  checksum: string
}

export const SRD_REUSABLE_DEFINITIONS: readonly SrdReusableDefinitionSeed[] = [
  ...SRD_SENSE_DEFINITIONS.map((definition) => ({ ...definition, definitionFamilyKey: 'sense' })),
  ...SRD_RULE_STATE_DEFINITIONS,
  ...SRD_OPTIONAL_COMBAT_DEFINITIONS,
  ...SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS,
  ...SRD_INITIATIVE_POLICY_DEFINITIONS,
  ...SRD_CONCENTRATION_DEFINITIONS,
  ...SRD_BASIC_ACTION_DEFINITIONS
]
