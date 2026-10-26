import {
  DND5E_ALTERNATING_DIAGONALS_DEFINITION_ID,
  DND5E_ALTERNATING_DIAGONALS_OPERATION_KEY,
  DND5E_CLEAVING_DEFINITION_ID,
  DND5E_CLEAVING_OPERATION_KEY,
  DND5E_CLIMB_ONTO_LARGER_CREATURE_DEFINITION_ID,
  DND5E_CLIMB_ONTO_LARGER_CREATURE_OPERATION_KEY,
  DND5E_DISARM_DEFINITION_ID,
  DND5E_DISARM_OPERATION_KEY,
  DND5E_FLANKING_DEFINITION_ID,
  DND5E_FLANKING_OPERATION_KEY,
  DND5E_FLANKING_PARTICIPANT_CAPABILITY_DEFINITION_ID,
  DND5E_FACING_DEFINITION_ID,
  DND5E_FACING_OPERATION_KEY,
  DND5E_HITTING_COVER_DEFINITION_ID,
  DND5E_HITTING_COVER_OPERATION_KEY,
  DND5E_INJURIES_DEFINITION_ID,
  DND5E_INJURIES_OPERATION_KEY,
  DND5E_MARK_DEFINITION_ID,
  DND5E_MARK_OPERATION_KEY,
  DND5E_MASSIVE_DAMAGE_DEFINITION_ID,
  DND5E_MASSIVE_DAMAGE_OPERATION_KEY,
  DND5E_MORALE_DEFINITION_ID,
  DND5E_MORALE_OPERATION_KEY,
  DND5E_OVERRUN_DEFINITION_ID,
  DND5E_OVERRUN_OPERATION_KEY,
  DND5E_SHOVE_ASIDE_DEFINITION_ID,
  DND5E_SHOVE_ASIDE_OPERATION_KEY,
  DND5E_TUMBLE_DEFINITION_ID,
  DND5E_TUMBLE_OPERATION_KEY,
  dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema,
  type Dnd5eOptionalCombatReusableDefinitionDocumentDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { ATTACK_DOMAIN_CODE } from '@artificer-toolkit/shared/core'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { v5 as uuidv5 } from 'uuid'

import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_ACROBATICS_SKILL_ID,
  SRD_ATHLETICS_SKILL_ID,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from './vocabulary.js'

const optionalOutcome = <
  TKind extends
    | 'REACTIONS_SUPPRESSED_UNTIL_END_OF_NEXT_TURN'
    | 'DROP_TO_ZERO'
    | 'STABLE_AT_ZERO'
    | 'STUNNED_UNTIL_END_OF_NEXT_TURN'
    | 'IMPAIRED_UNTIL_END_OF_NEXT_TURN'
    | 'LOSE_EYE'
    | 'LOSE_ARM_OR_HAND'
    | 'LOSE_FOOT_OR_LEG'
    | 'LIMP'
    | 'INTERNAL_INJURY'
    | 'BROKEN_RIBS'
    | 'HORRIBLE_SCAR'
    | 'FESTERING_WOUND'
    | 'MINOR_SCAR'
    | 'CONTINUE'
    | 'FLEE'
    | 'SURRENDER'
>(
  id: string,
  kind: TKind,
  operations: readonly unknown[]
) => ({ id, kind, operations })

const optionalRecovery = <
  TKind extends
    | 'NONE'
    | 'MAGICAL_RESTORATION'
    | 'MEDICAL_TREATMENT'
    | 'NATURAL_HEALING'
    | 'JUDGMENT_REQUIRED'
>(
  id: string,
  kind: TKind,
  operations: readonly unknown[]
) => ({ id, kind, operations })

const injuryRecord = (
  id: string,
  injuryDefinitionId: string,
  duration: 'PERMANENT' | 'UNTIL_CLEARED'
) => ({
  id,
  primitive: 'CREATE_INJURY_RECORD' as const,
  target: 'SUBJECT' as const,
  injuryDefinitionId,
  duration
})

const injuryConsequenceJudgment = (id: string) => ({
  id,
  primitive: 'JUDGMENT_REQUIRED' as const,
  target: 'SUBJECT' as const,
  reason: 'UNNORMALIZED_INJURY_CONSEQUENCE' as const
})

const internalInjuryCheck = (id: string) => ({
  id,
  primitive: 'REQUIRE_CHECK' as const,
  target: 'SUBJECT' as const,
  abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CONSTITUTION,
  difficultyClass: 15,
  trigger: 'BEFORE_COMBAT_ACTION' as const,
  successEffects: [
    { effect: 'RETAIN_INJURY' as const },
    { effect: 'ALLOW_ATTEMPTED_COMBAT_ACTION' as const }
  ],
  failureEffects: [
    { effect: 'RETAIN_INJURY' as const },
    { effect: 'DENY_AND_LOSE_ATTEMPTED_COMBAT_ACTION' as const },
    {
      effect: 'SET_REACTION_AVAILABILITY' as const,
      available: false,
      duration: 'UNTIL_START_OF_NEXT_TURN' as const
    }
  ]
})

const recoveryJudgment = (id: string) => ({
  id,
  primitive: 'JUDGMENT_REQUIRED' as const,
  target: 'SUBJECT' as const,
  reason: 'UNNORMALIZED_RECOVERY' as const
})

function conditionId(code: (typeof SRD_CONDITION_TYPES)[number]['code']): string {
  const condition = SRD_CONDITION_TYPES.find((candidate) => candidate.code === code)
  if (condition === undefined) throw new Error(`Missing SRD condition source: ${code}`)
  return condition.id
}

interface SrdOptionalCombatDefinitionSeed {
  id: string
  definitionFamilyKey: 'dnd5e-optional-combat'
  label: string
  description: string
  document: Dnd5eOptionalCombatReusableDefinitionDocumentDto
  checksum: string
}

const document = dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.parse({
  schemaVersion: 1,
  kind: 'ALTERNATING_DIAGONALS',
  id: DND5E_ALTERNATING_DIAGONALS_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  module: {
    policyModuleKey: DND5E_ALTERNATING_DIAGONALS_OPERATION_KEY,
    contractVersion: 1
  },
  parameters: { kind: 'ALTERNATING_DIAGONALS' },
  mutuallyExclusiveGroup: null
})

const flankingDocument = dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.parse({
  schemaVersion: 1,
  kind: 'FLANKING',
  id: DND5E_FLANKING_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  module: {
    policyModuleKey: DND5E_FLANKING_OPERATION_KEY,
    contractVersion: 1
  },
  parameters: {
    kind: 'FLANKING',
    participantCapabilityDefinitionId: DND5E_FLANKING_PARTICIPANT_CAPABILITY_DEFINITION_ID
  },
  mutuallyExclusiveGroup: null
})

const facingDocument = dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.parse({
  schemaVersion: 1,
  kind: 'FACING',
  id: DND5E_FACING_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  module: {
    policyModuleKey: DND5E_FACING_OPERATION_KEY,
    contractVersion: 1
  },
  parameters: {
    kind: 'FACING',
    facingStepDegrees: 90,
    arcs: [
      { arc: 'FRONT', fromDegrees: -45, toDegrees: 45 },
      { arc: 'RIGHT_SIDE', fromDegrees: 45, toDegrees: 135 },
      { arc: 'REAR', fromDegrees: 135, toDegrees: 225 },
      { arc: 'LEFT_SIDE', fromDegrees: 225, toDegrees: 315 }
    ],
    attackerInTargetArc: [{ arc: 'REAR', influence: 'ADVANTAGE' }],
    sourceCannotTargetInOwnArcs: ['REAR']
  },
  mutuallyExclusiveGroup: null
})

const climbOntoLargerCreatureDocument =
  dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.parse({
    schemaVersion: 1,
    kind: 'CLIMB_ONTO_LARGER_CREATURE',
    id: DND5E_CLIMB_ONTO_LARGER_CREATURE_DEFINITION_ID,
    gameSystemId: SRD_SYSTEM_ID,
    module: {
      policyModuleKey: DND5E_CLIMB_ONTO_LARGER_CREATURE_OPERATION_KEY,
      contractVersion: 1
    },
    parameters: {
      kind: 'CLIMB_ONTO_LARGER_CREATURE',
      initiatorCheckDefinitionIds: [SRD_ATHLETICS_SKILL_ID, SRD_ACROBATICS_SKILL_ID],
      targetCheckDefinitionId: SRD_ACROBATICS_SKILL_ID,
      minimumTargetSizeSteps: 1,
      economies: ['ACTION']
    },
    mutuallyExclusiveGroup: null
  })

const disarmDocument = dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.parse({
  schemaVersion: 1,
  kind: 'DISARM',
  id: DND5E_DISARM_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  module: { policyModuleKey: DND5E_DISARM_OPERATION_KEY, contractVersion: 1 },
  parameters: {
    kind: 'DISARM',
    defenderCheckDefinitionIds: [SRD_ATHLETICS_SKILL_ID, SRD_ACROBATICS_SKILL_ID]
  },
  mutuallyExclusiveGroup: null
})

/**
 * The mark a melee attack leaves on its target: until the end of the attacker's next turn, the
 * attacker's opportunity attacks against it have advantage, and once per turn one of them does not
 * spend the attacker's reaction. One mark per attacker, so a new mark
 * replaces the attacker's earlier one on any creature.
 */
function markEffect() {
  const childId = (kind: string, index = 0) =>
    uuidv5(`${DND5E_MARK_DEFINITION_ID}:${kind}:${index}`, DND5E_MARK_DEFINITION_ID)
  return {
    id: childId('effect'),
    order: 1,
    invocation: {
      kind: 'PASSIVE',
      triggerCode: 'ACTIVATED',
      range: { id: childId('range'), rangeKind: 'SELF' },
      targeting: { selectionKind: 'SELF' }
    },
    paths: [
      {
        id: childId('path'),
        order: 1,
        pathCode: 'PASSIVE',
        groupType: 'SINGLE',
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: childId('result'),
          resultKind: 'SINGLE',
          duration: { id: childId('duration'), durationKind: 'ROUND', amount: 1 },
          lifecycle: {
            turnAnchor: { actor: 'SOURCE', boundary: 'END_OF_TURN' },
            fromSourceOnly: true,
            exclusivity: 'PER_SOURCE'
          },
          outcomes: [
            {
              id: childId('outcome'),
              effectKind: 'APPLY_GRANT',
              grants: {
                modifiers: [
                  ...Object.values(ATTACK_DOMAIN_CODE).map((attackDomain, order) => ({
                    id: childId('grant', order),
                    grantKind: 'MODIFIER_GRANT',
                    valueDomainCode: 'ATTACKS_AGAINST',
                    domain: {
                      attackDomain,
                      requiresHolderSeesAttacker: false,
                      attackOccasion: 'OPPORTUNITY'
                    },
                    modifierKind: 'ROLL_INFLUENCE',
                    payload: { influence: 'ADVANTAGE' },
                    scope: 'GLOBAL',
                    selectionKind: 'GRANTED',
                    order
                  })),
                  {
                    id: childId('free-reaction'),
                    grantKind: 'MODIFIER_GRANT',
                    valueDomainCode: 'FREE_OPPORTUNITY_REACTION',
                    domain: {},
                    modifierKind: 'ENABLE',
                    scope: 'GLOBAL',
                    selectionKind: 'GRANTED',
                    order: Object.values(ATTACK_DOMAIN_CODE).length
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  }
}

const markDocument = dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.parse({
  schemaVersion: 1,
  kind: 'MARK',
  id: DND5E_MARK_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  module: { policyModuleKey: DND5E_MARK_OPERATION_KEY, contractVersion: 1 },
  parameters: { kind: 'MARK', qualifyingAttackKind: 'MELEE', effect: markEffect() },
  mutuallyExclusiveGroup: null
})

const overrunDocument = dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.parse({
  schemaVersion: 1,
  kind: 'OVERRUN',
  id: DND5E_OVERRUN_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  module: { policyModuleKey: DND5E_OVERRUN_OPERATION_KEY, contractVersion: 1 },
  parameters: {
    kind: 'OVERRUN',
    initiatorCheckDefinitionId: SRD_ATHLETICS_SKILL_ID,
    targetCheckDefinitionId: SRD_ATHLETICS_SKILL_ID
  },
  mutuallyExclusiveGroup: null
})

const shoveAsideDocument = dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.parse({
  schemaVersion: 1,
  kind: 'SHOVE_ASIDE',
  id: DND5E_SHOVE_ASIDE_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  module: { policyModuleKey: DND5E_SHOVE_ASIDE_OPERATION_KEY, contractVersion: 1 },
  parameters: {
    kind: 'SHOVE_ASIDE',
    initiatorCheckDefinitionId: SRD_ATHLETICS_SKILL_ID,
    defenderCheckDefinitionIds: [SRD_ATHLETICS_SKILL_ID, SRD_ACROBATICS_SKILL_ID]
  },
  mutuallyExclusiveGroup: null
})

const tumbleDocument = dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.parse({
  schemaVersion: 1,
  kind: 'TUMBLE',
  id: DND5E_TUMBLE_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  module: { policyModuleKey: DND5E_TUMBLE_OPERATION_KEY, contractVersion: 1 },
  parameters: {
    kind: 'TUMBLE',
    initiatorCheckDefinitionId: SRD_ACROBATICS_SKILL_ID,
    targetCheckDefinitionId: SRD_ACROBATICS_SKILL_ID
  },
  mutuallyExclusiveGroup: null
})

const hittingCoverDocument = dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.parse({
  schemaVersion: 1,
  kind: 'HITTING_COVER',
  id: DND5E_HITTING_COVER_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  module: { policyModuleKey: DND5E_HITTING_COVER_OPERATION_KEY, contractVersion: 1 },
  parameters: {
    kind: 'HITTING_COVER',
    qualifyingAttackKind: 'RANGED',
    redirectCoverProviderKinds: ['CREATURE'],
    redirectRequiresStrictAttackTotalOverProviderArmorClass: true
  },
  mutuallyExclusiveGroup: null
})

const cleavingDocument = dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.parse({
  schemaVersion: 1,
  kind: 'CLEAVING',
  id: DND5E_CLEAVING_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  module: { policyModuleKey: DND5E_CLEAVING_OPERATION_KEY, contractVersion: 1 },
  parameters: {
    kind: 'CLEAVING',
    qualifyingAttackKind: 'MELEE',
    requiresUndamagedInitialTarget: true
  },
  mutuallyExclusiveGroup: null
})

const injuriesDocument = dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.parse({
  schemaVersion: 1,
  kind: 'INJURIES',
  id: DND5E_INJURIES_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  module: { policyModuleKey: DND5E_INJURIES_OPERATION_KEY, contractVersion: 1 },
  parameters: {
    kind: 'INJURIES',
    triggers: [
      { event: 'DAMAGED', critical: true },
      { event: 'HIT_POINTS_ZERO' },
      { event: 'DEATH_SAVE_FAILED', byAtLeast: 5 }
    ],
    bands: [
      {
        minimum: 1,
        maximum: 1,
        outcome: optionalOutcome('00000000-0000-4000-8000-000000000121', 'LOSE_EYE', [
          injuryRecord(
            '00000000-0000-4000-8000-000000000261',
            '00000000-0000-4000-8000-000000000121',
            'UNTIL_CLEARED'
          ),
          injuryConsequenceJudgment('00000000-0000-4000-8000-000000000262')
        ]),
        recovery: optionalRecovery('00000000-0000-4000-8000-000000000131', 'JUDGMENT_REQUIRED', [
          recoveryJudgment('00000000-0000-4000-8000-000000000281')
        ])
      },
      {
        minimum: 2,
        maximum: 2,
        outcome: optionalOutcome('00000000-0000-4000-8000-000000000122', 'LOSE_ARM_OR_HAND', [
          injuryRecord(
            '00000000-0000-4000-8000-000000000263',
            '00000000-0000-4000-8000-000000000122',
            'UNTIL_CLEARED'
          ),
          injuryConsequenceJudgment('00000000-0000-4000-8000-000000000264')
        ]),
        recovery: optionalRecovery('00000000-0000-4000-8000-000000000132', 'JUDGMENT_REQUIRED', [
          recoveryJudgment('00000000-0000-4000-8000-000000000282')
        ])
      },
      {
        minimum: 3,
        maximum: 3,
        outcome: optionalOutcome('00000000-0000-4000-8000-000000000123', 'LOSE_FOOT_OR_LEG', [
          injuryRecord(
            '00000000-0000-4000-8000-000000000265',
            '00000000-0000-4000-8000-000000000123',
            'UNTIL_CLEARED'
          ),
          injuryConsequenceJudgment('00000000-0000-4000-8000-000000000266')
        ]),
        recovery: optionalRecovery('00000000-0000-4000-8000-000000000133', 'JUDGMENT_REQUIRED', [
          recoveryJudgment('00000000-0000-4000-8000-000000000283')
        ])
      },
      {
        minimum: 4,
        maximum: 4,
        outcome: optionalOutcome('00000000-0000-4000-8000-000000000124', 'LIMP', [
          injuryRecord(
            '00000000-0000-4000-8000-000000000267',
            '00000000-0000-4000-8000-000000000124',
            'UNTIL_CLEARED'
          ),
          injuryConsequenceJudgment('00000000-0000-4000-8000-000000000268')
        ]),
        recovery: optionalRecovery('00000000-0000-4000-8000-000000000134', 'JUDGMENT_REQUIRED', [
          recoveryJudgment('00000000-0000-4000-8000-000000000284')
        ])
      },
      {
        minimum: 5,
        maximum: 7,
        outcome: optionalOutcome('00000000-0000-4000-8000-000000000125', 'INTERNAL_INJURY', [
          injuryRecord(
            '00000000-0000-4000-8000-000000000269',
            '00000000-0000-4000-8000-000000000125',
            'UNTIL_CLEARED'
          ),
          internalInjuryCheck('00000000-0000-4000-8000-000000000270')
        ]),
        recovery: optionalRecovery('00000000-0000-4000-8000-000000000135', 'JUDGMENT_REQUIRED', [
          recoveryJudgment('00000000-0000-4000-8000-000000000285')
        ])
      },
      {
        minimum: 8,
        maximum: 10,
        outcome: optionalOutcome('00000000-0000-4000-8000-000000000126', 'BROKEN_RIBS', [
          injuryRecord(
            '00000000-0000-4000-8000-000000000271',
            '00000000-0000-4000-8000-000000000126',
            'UNTIL_CLEARED'
          ),
          injuryConsequenceJudgment('00000000-0000-4000-8000-000000000272')
        ]),
        recovery: optionalRecovery('00000000-0000-4000-8000-000000000136', 'JUDGMENT_REQUIRED', [
          recoveryJudgment('00000000-0000-4000-8000-000000000286')
        ])
      },
      {
        minimum: 11,
        maximum: 13,
        outcome: optionalOutcome('00000000-0000-4000-8000-000000000127', 'HORRIBLE_SCAR', [
          injuryRecord(
            '00000000-0000-4000-8000-000000000273',
            '00000000-0000-4000-8000-000000000127',
            'UNTIL_CLEARED'
          ),
          injuryConsequenceJudgment('00000000-0000-4000-8000-000000000274')
        ]),
        recovery: optionalRecovery('00000000-0000-4000-8000-000000000137', 'NONE', [])
      },
      {
        minimum: 14,
        maximum: 16,
        outcome: optionalOutcome('00000000-0000-4000-8000-000000000128', 'FESTERING_WOUND', [
          injuryRecord(
            '00000000-0000-4000-8000-000000000275',
            '00000000-0000-4000-8000-000000000128',
            'UNTIL_CLEARED'
          ),
          injuryConsequenceJudgment('00000000-0000-4000-8000-000000000276')
        ]),
        recovery: optionalRecovery('00000000-0000-4000-8000-000000000138', 'JUDGMENT_REQUIRED', [
          recoveryJudgment('00000000-0000-4000-8000-000000000287')
        ])
      },
      {
        minimum: 17,
        maximum: 20,
        outcome: optionalOutcome('00000000-0000-4000-8000-000000000129', 'MINOR_SCAR', [
          injuryRecord(
            '00000000-0000-4000-8000-000000000277',
            '00000000-0000-4000-8000-000000000129',
            'PERMANENT'
          )
        ]),
        recovery: optionalRecovery('00000000-0000-4000-8000-000000000139', 'NONE', [])
      }
    ]
  },
  mutuallyExclusiveGroup: null
})

const massiveDamageDocument = dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.parse({
  schemaVersion: 1,
  kind: 'MASSIVE_DAMAGE',
  id: DND5E_MASSIVE_DAMAGE_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  module: { policyModuleKey: DND5E_MASSIVE_DAMAGE_OPERATION_KEY, contractVersion: 1 },
  parameters: {
    kind: 'MASSIVE_DAMAGE',
    threshold: { numerator: 1, denominator: 2 },
    savingThrowAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CONSTITUTION,
    savingThrowDifficultyClass: 15,
    bands: [
      {
        minimum: 1,
        maximum: 1,
        outcome: optionalOutcome('00000000-0000-4000-8000-000000000141', 'DROP_TO_ZERO', [
          {
            id: '00000000-0000-4000-8000-000000000241',
            primitive: 'SET_HIT_POINTS',
            target: 'SUBJECT',
            value: 0,
            duration: null
          }
        ]),
        recovery: null
      },
      {
        minimum: 2,
        maximum: 3,
        outcome: optionalOutcome('00000000-0000-4000-8000-000000000142', 'STABLE_AT_ZERO', [
          {
            id: '00000000-0000-4000-8000-000000000242',
            primitive: 'SET_HIT_POINTS',
            target: 'SUBJECT',
            value: 0,
            duration: null
          },
          {
            id: '00000000-0000-4000-8000-000000000243',
            primitive: 'SET_STABLE',
            target: 'SUBJECT',
            duration: null
          }
        ]),
        recovery: null
      },
      {
        minimum: 4,
        maximum: 5,
        outcome: optionalOutcome(
          '00000000-0000-4000-8000-000000000143',
          'STUNNED_UNTIL_END_OF_NEXT_TURN',
          [
            {
              id: '00000000-0000-4000-8000-000000000244',
              primitive: 'APPLY_CONDITION',
              target: 'SUBJECT',
              conditionDefinitionId: conditionId('STUNNED'),
              duration: 'UNTIL_END_OF_NEXT_TURN'
            }
          ]
        ),
        recovery: null
      },
      {
        minimum: 6,
        maximum: 7,
        outcome: optionalOutcome(
          '00000000-0000-4000-8000-000000000144',
          'IMPAIRED_UNTIL_END_OF_NEXT_TURN',
          [
            {
              id: '00000000-0000-4000-8000-000000000245',
              primitive: 'SET_REACTION_AVAILABILITY',
              target: 'SUBJECT',
              available: false,
              duration: 'UNTIL_END_OF_NEXT_TURN'
            },
            {
              id: '00000000-0000-4000-8000-000000000246',
              primitive: 'APPLY_ROLL_MODE',
              target: 'SUBJECT',
              rollMode: 'DISADVANTAGE',
              rollContexts: ['ATTACK_ROLL', 'ABILITY_CHECK'],
              duration: 'UNTIL_END_OF_NEXT_TURN'
            }
          ]
        ),
        recovery: null
      },
      {
        minimum: 8,
        maximum: 10,
        outcome: optionalOutcome(
          '00000000-0000-4000-8000-000000000145',
          'REACTIONS_SUPPRESSED_UNTIL_END_OF_NEXT_TURN',
          [
            {
              id: '00000000-0000-4000-8000-000000000247',
              primitive: 'SET_REACTION_AVAILABILITY',
              target: 'SUBJECT',
              available: false,
              duration: 'UNTIL_END_OF_NEXT_TURN'
            }
          ]
        ),
        recovery: null
      }
    ]
  },
  mutuallyExclusiveGroup: null
})

const moraleDocument = dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.parse({
  schemaVersion: 1,
  kind: 'MORALE',
  id: DND5E_MORALE_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  module: { policyModuleKey: DND5E_MORALE_OPERATION_KEY, contractVersion: 1 },
  parameters: {
    kind: 'MORALE',
    triggerKinds: [
      'INDIVIDUAL_SURPRISED',
      'INDIVIDUAL_REDUCED_TO_HALF',
      'INDIVIDUAL_CANNOT_HARM_OPPOSITION',
      'GROUP_SURPRISED',
      'GROUP_HALF_REMOVED',
      'GROUP_LEADER_REMOVED',
      'GROUP_LEADER_INCAPACITATED',
      'GROUP_LEADER_TAKEN_PRISONER'
    ],
    savingThrowAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.WISDOM,
    savingThrowDifficultyClass: 10,
    requiresGroupLeaderOrFallback: true,
    overwhelmingOpposition: { rollMode: 'DISADVANTAGE', automaticFailure: false },
    individualOutcomes: [
      optionalOutcome('00000000-0000-4000-8000-000000000151', 'CONTINUE', [
        {
          id: '00000000-0000-4000-8000-000000000291',
          primitive: 'SET_MORALE_DISPOSITION',
          target: 'SUBJECT',
          disposition: 'CONTINUE',
          duration: null
        }
      ]),
      optionalOutcome('00000000-0000-4000-8000-000000000152', 'FLEE', [
        {
          id: '00000000-0000-4000-8000-000000000292',
          primitive: 'SET_MORALE_DISPOSITION',
          target: 'SUBJECT',
          disposition: 'FLEE',
          duration: null
        }
      ]),
      optionalOutcome('00000000-0000-4000-8000-000000000153', 'SURRENDER', [
        {
          id: '00000000-0000-4000-8000-000000000293',
          primitive: 'SET_MORALE_DISPOSITION',
          target: 'SUBJECT',
          disposition: 'SURRENDER',
          duration: null
        }
      ])
    ],
    groupOutcomes: [
      optionalOutcome('00000000-0000-4000-8000-000000000161', 'CONTINUE', [
        {
          id: '00000000-0000-4000-8000-000000000294',
          primitive: 'SET_MORALE_DISPOSITION',
          target: 'GROUP',
          disposition: 'CONTINUE',
          duration: null
        }
      ]),
      optionalOutcome('00000000-0000-4000-8000-000000000162', 'FLEE', [
        {
          id: '00000000-0000-4000-8000-000000000295',
          primitive: 'SET_MORALE_DISPOSITION',
          target: 'GROUP',
          disposition: 'FLEE',
          duration: null
        }
      ]),
      optionalOutcome('00000000-0000-4000-8000-000000000163', 'SURRENDER', [
        {
          id: '00000000-0000-4000-8000-000000000296',
          primitive: 'SET_MORALE_DISPOSITION',
          target: 'GROUP',
          disposition: 'SURRENDER',
          duration: null
        }
      ])
    ]
  },
  mutuallyExclusiveGroup: null
})

/** Canonical UUID-backed source document; labels are catalogue metadata only. */
export const SRD_OPTIONAL_COMBAT_DEFINITIONS: readonly SrdOptionalCombatDefinitionSeed[] = [
  {
    id: document.id,
    definitionFamilyKey: 'dnd5e-optional-combat',
    label: 'Alternating Diagonals',
    description: 'D&D optional square-grid diagonal measurement policy.',
    document,
    checksum: checksumRuleDocument(document)
  },
  {
    id: flankingDocument.id,
    definitionFamilyKey: 'dnd5e-optional-combat',
    label: 'Flanking',
    description: 'D&D optional square-grid melee flanking policy.',
    document: flankingDocument,
    checksum: checksumRuleDocument(flankingDocument)
  },
  {
    id: facingDocument.id,
    definitionFamilyKey: 'dnd5e-optional-combat',
    label: 'Facing',
    description: 'D&D optional square-grid facing policy.',
    document: facingDocument,
    checksum: checksumRuleDocument(facingDocument)
  },
  {
    id: climbOntoLargerCreatureDocument.id,
    definitionFamilyKey: 'dnd5e-optional-combat',
    label: 'Climb onto a Bigger Creature',
    description: 'D&D optional action policy for climbing onto a larger creature.',
    document: climbOntoLargerCreatureDocument,
    checksum: checksumRuleDocument(climbOntoLargerCreatureDocument)
  },
  {
    id: disarmDocument.id,
    definitionFamilyKey: 'dnd5e-optional-combat',
    label: 'Disarm',
    description: 'D&D optional action policy for disarming a target.',
    document: disarmDocument,
    checksum: checksumRuleDocument(disarmDocument)
  },
  {
    id: markDocument.id,
    definitionFamilyKey: 'dnd5e-optional-combat',
    label: 'Mark',
    description: 'D&D optional attack marking policy.',
    document: markDocument,
    checksum: checksumRuleDocument(markDocument)
  },
  {
    id: overrunDocument.id,
    definitionFamilyKey: 'dnd5e-optional-combat',
    label: 'Overrun',
    description: 'D&D optional movement policy for overrunning a creature.',
    document: overrunDocument,
    checksum: checksumRuleDocument(overrunDocument)
  },
  {
    id: shoveAsideDocument.id,
    definitionFamilyKey: 'dnd5e-optional-combat',
    label: 'Shove Aside',
    description: 'D&D optional movement policy for shoving a creature aside.',
    document: shoveAsideDocument,
    checksum: checksumRuleDocument(shoveAsideDocument)
  },
  {
    id: tumbleDocument.id,
    definitionFamilyKey: 'dnd5e-optional-combat',
    label: 'Tumble',
    description: 'D&D optional movement policy for tumbling through a creature space.',
    document: tumbleDocument,
    checksum: checksumRuleDocument(tumbleDocument)
  },
  {
    id: hittingCoverDocument.id,
    definitionFamilyKey: 'dnd5e-optional-combat',
    label: 'Hitting Cover',
    description: 'D&D optional attack policy for hitting creature-provided cover.',
    document: hittingCoverDocument,
    checksum: checksumRuleDocument(hittingCoverDocument)
  },
  {
    id: cleavingDocument.id,
    definitionFamilyKey: 'dnd5e-optional-combat',
    label: 'Cleaving Through Creatures',
    description: 'D&D optional damage-outcome cleaving policy.',
    document: cleavingDocument,
    checksum: checksumRuleDocument(cleavingDocument)
  },
  {
    id: injuriesDocument.id,
    definitionFamilyKey: 'dnd5e-optional-combat',
    label: 'Lingering Injuries',
    description: 'D&D optional character-consequence injury policy.',
    document: injuriesDocument,
    checksum: checksumRuleDocument(injuriesDocument)
  },
  {
    id: massiveDamageDocument.id,
    definitionFamilyKey: 'dnd5e-optional-combat',
    label: 'Massive Damage',
    description: 'D&D optional damage-consequence policy.',
    document: massiveDamageDocument,
    checksum: checksumRuleDocument(massiveDamageDocument)
  },
  {
    id: moraleDocument.id,
    definitionFamilyKey: 'dnd5e-optional-combat',
    label: 'Morale',
    description: 'D&D optional encounter morale policy.',
    document: moraleDocument,
    checksum: checksumRuleDocument(moraleDocument)
  }
]
