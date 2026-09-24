import {
  conditionRuleStateReusableDefinitionDocumentDtoSchema,
  ruleCapabilityReusableDefinitionDocumentDtoSchema,
  type ConditionRuleStateReusableDefinitionDocumentDto,
  type RuleCapabilityReusableDefinitionDocumentDto
} from '@artificer-toolkit/schema/shared/ruleState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { SRD_CONDITION_TYPES, SRD_SYSTEM_ID } from './vocabulary.js'

export const SRD_REACTION_ALLOWANCE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000d2'
export const SRD_ACTOR_ACTION_CAPABILITY_DEFINITION_ID = '00000000-0000-4000-8000-0000000000d4'
export const SRD_POSITIONAL_SUPPORT_CAPABILITY_DEFINITION_ID =
  '00000000-0000-4000-8000-0000000000d5'
/** Suppressible breathing capability used by target-owned relationship effects. */
export const SRD_BREATHING_CAPABILITY_DEFINITION_ID = '00000000-0000-4000-8000-0000000000d6'
export const SRD_ACTION_ALLOWANCE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000d7'
export const SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000d8'
const SRD_BLINDED_CONDITION_DEFINITION_ID = '00000000-0000-0000-0002-000100000000'
const SRD_INVISIBLE_CONDITION_DEFINITION_ID = '00000000-0000-0000-0002-000800000000'

type RuleStateDocument =
  | RuleCapabilityReusableDefinitionDocumentDto
  | ConditionRuleStateReusableDefinitionDocumentDto

export interface SrdRuleStateDefinitionSeed {
  id: string
  definitionFamilyKey: 'rule-capability' | 'condition-rule-state'
  label: string
  description: string
  document: RuleStateDocument
  checksum: string
}

function defineRuleState(
  input: Omit<SrdRuleStateDefinitionSeed, 'checksum'>
): SrdRuleStateDefinitionSeed {
  return { ...input, checksum: checksumRuleDocument(input.document) }
}

export const SRD_RULE_CAPABILITY_DEFINITIONS: readonly SrdRuleStateDefinitionSeed[] = [
  defineRuleState({
    id: SRD_BREATHING_CAPABILITY_DEFINITION_ID,
    definitionFamilyKey: 'rule-capability',
    label: 'Breathing availability',
    description:
      'D&D actor capability used by System policy to determine whether an actor can breathe.',
    document: ruleCapabilityReusableDefinitionDocumentDtoSchema.parse({
      schemaVersion: 1,
      kind: 'RULE_CAPABILITY',
      id: SRD_BREATHING_CAPABILITY_DEFINITION_ID,
      gameSystemId: SRD_SYSTEM_ID,
      usage: null
    })
  }),
  defineRuleState({
    id: SRD_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
    definitionFamilyKey: 'rule-capability',
    label: 'Actor action availability',
    description: 'D&D actor capability used by System policy to gate actions and reactions.',
    document: ruleCapabilityReusableDefinitionDocumentDtoSchema.parse({
      schemaVersion: 1,
      kind: 'RULE_CAPABILITY',
      id: SRD_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
      gameSystemId: SRD_SYSTEM_ID,
      usage: null
    })
  }),
  defineRuleState({
    id: SRD_REACTION_ALLOWANCE_DEFINITION_ID,
    definitionFamilyKey: 'rule-capability',
    label: 'Reaction allowance',
    description: 'D&D Encounter reaction usage refreshed at the start of the actor turn.',
    document: ruleCapabilityReusableDefinitionDocumentDtoSchema.parse({
      schemaVersion: 1,
      kind: 'RULE_CAPABILITY',
      id: SRD_REACTION_ALLOWANCE_DEFINITION_ID,
      gameSystemId: SRD_SYSTEM_ID,
      usage: { maximum: 1, refreshBoundary: 'START_OF_TURN' }
    })
  }),
  defineRuleState({
    id: SRD_ACTION_ALLOWANCE_DEFINITION_ID,
    definitionFamilyKey: 'rule-capability',
    label: 'Action allowance',
    description: 'D&D Encounter action usage refreshed at the start of the actor turn.',
    document: ruleCapabilityReusableDefinitionDocumentDtoSchema.parse({
      schemaVersion: 1,
      kind: 'RULE_CAPABILITY',
      id: SRD_ACTION_ALLOWANCE_DEFINITION_ID,
      gameSystemId: SRD_SYSTEM_ID,
      usage: { maximum: 1, refreshBoundary: 'START_OF_TURN' }
    })
  }),
  defineRuleState({
    id: SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
    definitionFamilyKey: 'rule-capability',
    label: 'Bonus action allowance',
    description: 'D&D Encounter bonus-action usage refreshed at the start of the actor turn.',
    document: ruleCapabilityReusableDefinitionDocumentDtoSchema.parse({
      schemaVersion: 1,
      kind: 'RULE_CAPABILITY',
      id: SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
      gameSystemId: SRD_SYSTEM_ID,
      usage: { maximum: 1, refreshBoundary: 'START_OF_TURN' }
    })
  }),
  defineRuleState({
    id: SRD_POSITIONAL_SUPPORT_CAPABILITY_DEFINITION_ID,
    definitionFamilyKey: 'rule-capability',
    label: 'Positional support availability',
    description: 'D&D actor capability used by System policy to qualify positional combat support.',
    document: ruleCapabilityReusableDefinitionDocumentDtoSchema.parse({
      schemaVersion: 1,
      kind: 'RULE_CAPABILITY',
      id: SRD_POSITIONAL_SUPPORT_CAPABILITY_DEFINITION_ID,
      gameSystemId: SRD_SYSTEM_ID,
      usage: null
    })
  })
]

const actionSuppressingConditionCodes = new Set([
  'INCAPACITATED',
  'PARALYZED',
  'PETRIFIED',
  'STUNNED',
  'UNCONSCIOUS'
])

const perceptionContributionsByConditionDefinitionId = {
  [SRD_BLINDED_CONDITION_DEFINITION_ID]: [
    {
      id: '00000000-0000-4000-8000-0000000000e1',
      order: 0,
      kind: 'SENSE_SUPPRESS' as const,
      senseDefinitionIds: [],
      channels: ['VISUAL']
    }
  ],
  [SRD_INVISIBLE_CONDITION_DEFINITION_ID]: [
    {
      id: '00000000-0000-4000-8000-0000000000e2',
      order: 0,
      kind: 'EMISSION_SUPPRESS' as const,
      channels: ['VISUAL'],
      bypass: 'INVISIBILITY' as const
    }
  ]
} as const

export const SRD_CONDITION_RULE_STATE_DEFINITIONS: readonly SrdRuleStateDefinitionSeed[] =
  SRD_CONDITION_TYPES.map((condition) => {
    const suppressesActions = actionSuppressingConditionCodes.has(condition.code)
    const document = conditionRuleStateReusableDefinitionDocumentDtoSchema.parse({
      schemaVersion: 1,
      kind: 'CONDITION_RULE_STATE',
      id: condition.id,
      gameSystemId: SRD_SYSTEM_ID,
      capabilitySuppressions: suppressesActions
        ? [
            {
              id: condition.id,
              order: 0,
              kind: 'CAPABILITY_SUPPRESS',
              capabilityDefinitionIds: [
                SRD_REACTION_ALLOWANCE_DEFINITION_ID,
                SRD_ACTION_ALLOWANCE_DEFINITION_ID,
                SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
                SRD_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
                SRD_POSITIONAL_SUPPORT_CAPABILITY_DEFINITION_ID
              ].sort()
            }
          ]
        : [],
      perceptionContributions:
        perceptionContributionsByConditionDefinitionId[
          condition.id as keyof typeof perceptionContributionsByConditionDefinitionId
        ] ?? []
    })
    return defineRuleState({
      id: condition.id,
      definitionFamilyKey: 'condition-rule-state',
      label: `${condition.label} capability policy`,
      description: `D&D capability-availability policy for the ${condition.label} condition.`,
      document
    })
  })

export const SRD_RULE_STATE_DEFINITIONS: readonly SrdRuleStateDefinitionSeed[] = [
  ...SRD_RULE_CAPABILITY_DEFINITIONS,
  ...SRD_CONDITION_RULE_STATE_DEFINITIONS
]
