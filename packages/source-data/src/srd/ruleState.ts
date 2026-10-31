import {
  conditionRuleStateReusableDefinitionDocumentDtoSchema,
  ruleCapabilityReusableDefinitionDocumentDtoSchema,
  type ConditionMechanicDto,
  type ConditionRuleStateReusableDefinitionDocumentDto,
  type RuleCapabilityReusableDefinitionDocumentDto
} from '@artificer-toolkit/schema/shared/ruleState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES,
  SRD_SYSTEM_ID
} from './vocabulary.js'

export const SRD_REACTION_ALLOWANCE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000d2'
export const SRD_ACTOR_ACTION_CAPABILITY_DEFINITION_ID = '00000000-0000-4000-8000-0000000000d4'
const SRD_POSITIONAL_SUPPORT_CAPABILITY_DEFINITION_ID = '00000000-0000-4000-8000-0000000000d5'
/** Suppressible breathing capability used by target-owned relationship effects. */
export const SRD_BREATHING_CAPABILITY_DEFINITION_ID = '00000000-0000-4000-8000-0000000000d6'
export const SRD_ACTION_ALLOWANCE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000d7'
export const SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000d8'
export const SRD_FREE_REACTION_ALLOWANCE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000d9'
const SRD_BLINDED_CONDITION_DEFINITION_ID = '00000000-0000-0000-0002-000100000000'
const SRD_INVISIBLE_CONDITION_DEFINITION_ID = '00000000-0000-0000-0002-000800000000'

type RuleStateDocument =
  | RuleCapabilityReusableDefinitionDocumentDto
  | ConditionRuleStateReusableDefinitionDocumentDto

interface SrdRuleStateDefinitionSeed {
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
    id: SRD_FREE_REACTION_ALLOWANCE_DEFINITION_ID,
    definitionFamilyKey: 'rule-capability',
    label: 'Free reaction allowance',
    description:
      'D&D Encounter reaction a granted opportunity attack makes without the reaction, once each turn.',
    document: ruleCapabilityReusableDefinitionDocumentDtoSchema.parse({
      schemaVersion: 1,
      kind: 'RULE_CAPABILITY',
      id: SRD_FREE_REACTION_ALLOWANCE_DEFINITION_ID,
      gameSystemId: SRD_SYSTEM_ID,
      usage: { maximum: 1, refreshBoundary: 'EACH_TURN' }
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

type ConditionMechanicRule = ConditionMechanicDto extends infer Mechanic
  ? Mechanic extends ConditionMechanicDto
    ? Omit<Mechanic, 'id' | 'order' | 'minimumLevel'>
    : never
  : never

const WITHIN_5_FEET = { kind: 'WITHIN', distance: { amount: 5, unit: 'FEET' } } as const
const BEYOND_5_FEET = { kind: 'BEYOND', distance: { amount: 5, unit: 'FEET' } } as const
const SPEED_ZERO = { kind: 'SPEED', numerator: 0, denominator: 1 } as const
const disadvantageOn = (
  roll: Extract<ConditionMechanicRule, { kind: 'D20_ROLL_MODE' }>['roll']
): Extract<ConditionMechanicRule, { kind: 'D20_ROLL_MODE' }> => ({
  kind: 'D20_ROLL_MODE',
  influence: 'DISADVANTAGE',
  roll
})
const advantageOn = (
  roll: Extract<ConditionMechanicRule, { kind: 'D20_ROLL_MODE' }>['roll']
): ConditionMechanicRule => ({ kind: 'D20_ROLL_MODE', influence: 'ADVANTAGE', roll })

/** Paralyzed, Petrified, Stunned and Unconscious: helpless against attacks and Str/Dex saves. */
function helplessMechanics(criticalWithin5Feet: boolean): ConditionMechanicRule[] {
  return [
    advantageOn({ kind: 'ATTACKS_AGAINST', range: { kind: 'ANY' } }),
    {
      kind: 'SAVE_AUTO_FAIL',
      abilityDefinitionIds: [
        SRD_ABILITY_DEFINITION_IDS.STRENGTH,
        SRD_ABILITY_DEFINITION_IDS.DEXTERITY
      ].sort()
    },
    SPEED_ZERO,
    ...(criticalWithin5Feet
      ? [{ kind: 'HITS_AGAINST_CRITICAL', range: WITHIN_5_FEET } as const]
      : [])
  ]
}

/** SRD 5.1 condition mechanics (D94), each with the Exhaustion level it needs, if any. */
const mechanicsByConditionCode: Readonly<
  Record<string, readonly (ConditionMechanicRule & { minimumLevel?: number })[]>
> = {
  POISONED: [disadvantageOn({ kind: 'ATTACKS_BY' }), disadvantageOn({ kind: 'ABILITY_CHECKS' })],
  // Disadvantage while the source of its fear is in sight, and no willing move closer to it; a
  // Frightened with no recorded source keeps the disadvantage always (SPELLS-29).
  FRIGHTENED: [
    { ...disadvantageOn({ kind: 'ATTACKS_BY' }), requiresHolderSeesSource: true },
    { ...disadvantageOn({ kind: 'ABILITY_CHECKS' }), requiresHolderSeesSource: true },
    { kind: 'APPROACH_SOURCE_FORBIDDEN' }
  ],
  PRONE: [
    disadvantageOn({ kind: 'ATTACKS_BY' }),
    advantageOn({ kind: 'ATTACKS_AGAINST', range: WITHIN_5_FEET }),
    disadvantageOn({ kind: 'ATTACKS_AGAINST', range: BEYOND_5_FEET })
  ],
  GRAPPLED: [SPEED_ZERO],
  RESTRAINED: [
    SPEED_ZERO,
    disadvantageOn({ kind: 'ATTACKS_BY' }),
    advantageOn({ kind: 'ATTACKS_AGAINST', range: { kind: 'ANY' } }),
    disadvantageOn({
      kind: 'SAVES',
      abilityDefinitionIds: [SRD_ABILITY_DEFINITION_IDS.DEXTERITY]
    })
  ],
  PARALYZED: helplessMechanics(true),
  PETRIFIED: [
    ...helplessMechanics(false),
    {
      kind: 'DAMAGE_DEFENSE',
      defense: 'RESISTANCE',
      damageTypeIds: SRD_DAMAGE_TYPES.map(({ id }) => id).sort()
    }
  ],
  STUNNED: helplessMechanics(false),
  UNCONSCIOUS: helplessMechanics(true),
  EXHAUSTION: [
    { ...disadvantageOn({ kind: 'ABILITY_CHECKS' }), minimumLevel: 1 },
    { kind: 'SPEED', numerator: 1, denominator: 2, minimumLevel: 2 },
    { ...disadvantageOn({ kind: 'ATTACKS_BY' }), minimumLevel: 3 },
    { ...disadvantageOn({ kind: 'SAVES', abilityDefinitionIds: null }), minimumLevel: 3 },
    { kind: 'HIT_POINT_MAXIMUM', numerator: 1, denominator: 2, minimumLevel: 4 },
    { ...SPEED_ZERO, minimumLevel: 5 },
    { kind: 'DEATH', minimumLevel: 6 }
  ]
}

/** Stable mechanic identities: the condition's vocabulary number and the mechanic's place. */
function conditionMechanicId(conditionIndex: number, mechanicIndex: number) {
  return `00000000-0000-4000-8001-${(conditionIndex * 256 + mechanicIndex).toString(16).padStart(12, '0')}`
}

export const SRD_CONDITION_RULE_STATE_DEFINITIONS: readonly SrdRuleStateDefinitionSeed[] =
  SRD_CONDITION_TYPES.map((condition, conditionIndex) => {
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
                SRD_FREE_REACTION_ALLOWANCE_DEFINITION_ID,
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
        ] ?? [],
      mechanics: (mechanicsByConditionCode[condition.code] ?? []).map(
        ({ minimumLevel, ...mechanic }, order) => ({
          ...mechanic,
          id: conditionMechanicId(conditionIndex + 1, order),
          order,
          minimumLevel: minimumLevel ?? null
        })
      )
    })
    return defineRuleState({
      id: condition.id,
      definitionFamilyKey: 'condition-rule-state',
      label: `${condition.label} rule policy`,
      description: `D&D capability, perception and mechanics policy for the ${condition.label} condition.`,
      document
    })
  })

export const SRD_RULE_STATE_DEFINITIONS: readonly SrdRuleStateDefinitionSeed[] = [
  ...SRD_RULE_CAPABILITY_DEFINITIONS,
  ...SRD_CONDITION_RULE_STATE_DEFINITIONS
]
