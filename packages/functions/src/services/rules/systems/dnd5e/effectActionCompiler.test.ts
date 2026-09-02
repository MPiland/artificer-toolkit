import { describe, expect, it } from 'vitest'
import {
  activeRuleEffectDefinitionDtoSchema,
  type ServerRuleExecutionTraceEntryDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import type { EffectPathAuthored, OutcomeAuthored } from '@artificer-toolkit/shared/authored'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import {
  addNumbersRuleOperation,
  integerRangeEvidenceRuleOperation
} from '@artificer-toolkit/shared/rules'
import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  FORCED_MOVEMENT_ACTION_ECONOMY,
  FORCED_MOVEMENT_DIRECTION,
  FORCED_MOVEMENT_DISTANCE_MODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'

import type { CharacterActionCapabilityDescriptor } from '../../characterActionCapabilityDiscovery.js'
import { CharacterRuleActionUnsupportedCompilationError } from '../../characterRuleActionSystemAdapter.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { createRulesRuntimeService } from '../../rulesRuntimeService.js'
import {
  compileDnd5eEffectAction,
  compileDnd5eEffectActionTestTemplate,
  classifyDnd5eCompiledEffectAction,
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY,
  DND5E_FORCED_MOVEMENT_PROPOSAL_OPERATION_KEY,
  DND5E_ATTACK_MODIFIER_FACT_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY,
  DND5E_CONDITION_IMMUNE_FACT_KEYS,
  DND5E_TARGET_DEFENSE_FACT_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_PERCEPTION_REQUIREMENT_FACT_KEY,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ROLL_INFLUENCE_FACT_KEY,
  DND5E_ATTACK_TEST_OPERATION_KEY,
  dnd5eAttackTestOperation,
  dnd5eSaveTestOperation,
  dnd5eDamageProposalOperation,
  dnd5eForcedMovementProposalOperation,
  dnd5eHitPointMaximumReductionProposalOperation,
  dnd5eDamageTotalOperation,
  dnd5eSaveDamageTotalOperation,
  dnd5eHealTotalOperation,
  dnd5eConditionApplyProposalOperation,
  dnd5eTestConditionProposalOperation,
  dnd5eTestDamageProposalOperation,
  dnd5eCharacterRuleActionSystemAdapter,
  dnd5eEffectActionCapability,
  dnd5eHealProposalOperation,
  specializeDnd5eEffectActionOutcome,
  Dnd5eEffectActionCompilerError,
  DND5E_RESOLVED_DAMAGE_EXPRESSION_FACT_KEYS,
  DND5E_RESOLVED_DAMAGE_OUTCOME_EXPRESSIONS_FACT_KEY,
  DND5E_RESOLVED_HEAL_MODIFIER_FACT_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY
} from './effectActionCompiler.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'

const EFFECT_ID = '00000000-0000-4000-8000-000000000010'
const ACTOR_ID = '00000000-0000-4000-8000-000000000011'
const OCCURRENCE_ID = '00000000-0000-4000-8000-000000000012'
const CONDITION_ID = '00000000-0000-4000-8000-000000000013'
const CONDITION_B_ID = '00000000-0000-4000-8000-000000000016'
const DEXTERITY_ABILITY_ID = '00000000-0000-4000-8000-000000000014'
const REACTION_ELIGIBILITY_ID = '00000000-0000-4000-8000-000000000015'

function action(overrides: Record<string, unknown> = {}): CharacterActionCapabilityDescriptor {
  const effect = compileEffect({
    id: EFFECT_ID,
    order: 1,
    invocation: {
      kind: 'ACTION',
      triggerCode: TRIGGER.ACTIVATED,
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      range: { id: 'range-id', rangeKind: RANGE_KIND.SELF },
      targeting: { selectionKind: 'SELF' }
    },
    paths: [
      {
        id: 'path-id',
        order: 1,
        pathCode: PATH_CODE.ON_USE,
        groupType: PATH_GROUP_TYPE.SINGLE,
        selectionKind: 'FIXED',
        resultBlock: {
          id: 'result-id',
          resultKind: 'SINGLE',
          outcomes: [
            {
              id: 'heal-id',
              effectKind: EFFECT_KIND.HEAL,
              valueKind: 'FIXED',
              scalingKind: 'NONE',
              amount: 7
            }
          ]
        }
      }
    ]
  })
  return {
    kind: 'CHARACTER_ACTION',
    gameSystemId: DND5E_SYSTEM_ID,
    authoredRootKind: 'effect',
    entryPointDefinitionId: EFFECT_ID,
    effectId: EFFECT_ID,
    actionId: `source:ACTION:${EFFECT_ID}`,
    sourceId: 'source',
    source: {
      kind: 'AUTHORED',
      sourceKind: 'FEATURE',
      definitionId: 'feature',
      sourceInstanceId: 'source'
    },
    mechanicsOwner: { kind: 'FEATURE', id: 'feature' },
    activationSourceKind: 'ACTIVE_SOURCE',
    compiledEffect: effect,
    ...overrides
  } as CharacterActionCapabilityDescriptor
}

function directEntry(candidate: CharacterActionCapabilityDescriptor) {
  const entry = candidate.compiledEffect.entries[0]
  if (!entry || !('outcome' in entry)) throw new Error('Expected a direct compiled Effect entry.')
  return entry
}

function attackPaths() {
  return [PATH_CODE.ON_HIT, PATH_CODE.ON_MISS, PATH_CODE.ON_CRIT].map((pathCode, order) => ({
    id: `path-${order}`,
    order,
    pathCode: pathCode as
      | typeof PATH_CODE.ON_HIT
      | typeof PATH_CODE.ON_MISS
      | typeof PATH_CODE.ON_CRIT,
    groupType: PATH_GROUP_TYPE.SINGLE,
    selectionKind: 'FIXED' as const,
    resultBlock: {
      id: `result-${order}`,
      resultKind: 'SINGLE' as const,
      outcomes: [
        {
          id: `damage-${order}`,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: '00000000-0000-4000-8000-000000000099',
          valueKind: 'FIXED' as const,
          scalingKind: 'NONE' as const,
          amount: order + 1
        }
      ]
    }
  }))
}

function attackAction(): CharacterActionCapabilityDescriptor {
  return {
    ...action(),
    compiledEffect: compileEffect({
      id: EFFECT_ID,
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: 'range-id', rangeKind: RANGE_KIND.UNLIMITED },
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
      },
      paths: attackPaths()
    })
  }
}

function nestedSaveAttackAction(
  input: {
    timing?: 'IMMEDIATE' | 'TARGET_TURN_END'
    attempts?:
      | { kind: 'ONCE'; repeatOnFailure?: boolean }
      | {
          kind: 'THRESHOLDS'
          successesToEnd: number
          failuresToResolve: number
          consecutive: boolean
        }
    successDice?: string
    failureDice?: string
    primaryDice?: string
    fixedPrimary?: boolean
    maximumReductionDamageOutcomeId?: string
    repeatTiming?: 'TARGET_TURN_END'
    repeatCondition?: boolean
    durationRounds?: number
  } = {}
): CharacterActionCapabilityDescriptor {
  return {
    ...action(),
    compiledEffect: compileEffect({
      id: EFFECT_ID,
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: 'range-id', rangeKind: RANGE_KIND.UNLIMITED },
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
      },
      paths: [
        {
          id: '00000000-0000-4000-8000-000000000040',
          order: 1,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          selectionKind: 'FIXED',
          resultBlock: {
            id: '00000000-0000-4000-8000-000000000041',
            resultKind: 'SEQUENCE',
            ...(input.durationRounds
              ? {
                  duration: {
                    id: '00000000-0000-4000-8000-000000000048',
                    durationKind: 'ROUND' as const,
                    amount: input.durationRounds
                  }
                }
              : {}),
            outcomes: [
              {
                id: '00000000-0000-4000-8000-000000000042',
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: '00000000-0000-4000-8000-000000000098',
                ...(input.fixedPrimary
                  ? {
                      valueKind: 'FIXED' as const,
                      scalingKind: 'NONE' as const,
                      amount: 4
                    }
                  : {
                      valueKind: 'DICE' as const,
                      scalingKind: 'NONE' as const,
                      diceConfig: input.primaryDice ?? '1d6'
                    })
              },
              {
                id: '00000000-0000-4000-8000-000000000043',
                effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
                timing: input.timing ?? 'IMMEDIATE',
                savingThrow: {
                  id: '00000000-0000-4000-8000-000000000044',
                  dcMethod: 'FIXED_DC',
                  abilityDefinitionId: DEXTERITY_ABILITY_ID,
                  baseDc: 10
                },
                attempts:
                  input.attempts ??
                  (input.repeatTiming ? { kind: 'ONCE', repeatOnFailure: true } : { kind: 'ONCE' }),
                ...(input.repeatTiming ? { repeatTiming: input.repeatTiming } : {}),
                onFailure: {
                  kind: 'OUTCOMES',
                  endCurrent: false,
                  resultKind: 'SINGLE',
                  outcomes: [
                    {
                      id: '00000000-0000-4000-8000-000000000045',
                      effectKind: EFFECT_KIND.DAMAGE,
                      damageTypeId: '00000000-0000-4000-8000-000000000099',
                      valueKind: 'DICE',
                      scalingKind: 'NONE',
                      diceConfig: input.failureDice ?? '7d8'
                    },
                    ...(input.maximumReductionDamageOutcomeId
                      ? [
                          {
                            id: '00000000-0000-4000-8000-000000000047',
                            effectKind: EFFECT_KIND.HIT_POINT_MAXIMUM_REDUCTION,
                            amountSource: {
                              kind: 'DAMAGE_TAKEN' as const,
                              damageOutcomeId: input.maximumReductionDamageOutcomeId
                            },
                            recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM'] as [
                              'RESTORE_HIT_POINT_MAXIMUM'
                            ]
                          }
                        ]
                      : []),
                    ...(input.repeatCondition
                      ? [
                          {
                            id: CONDITION_ID,
                            effectKind: EFFECT_KIND.CONDITION,
                            conditionId: CONDITION_ID
                          }
                        ]
                      : [])
                  ]
                },
                onSuccess: input.repeatTiming
                  ? { kind: 'END' }
                  : {
                      kind: 'OUTCOMES',
                      endCurrent: false,
                      resultKind: 'SINGLE',
                      outcomes: [
                        {
                          id: '00000000-0000-4000-8000-000000000046',
                          effectKind: EFFECT_KIND.DAMAGE,
                          damageTypeId: '00000000-0000-4000-8000-000000000099',
                          valueKind: 'DICE',
                          scalingKind: 'NONE',
                          diceConfig: input.successDice ?? '7d8',
                          multiplier: 0.5
                        }
                      ]
                    },
                ...(input.repeatTiming ? { onDurationComplete: { kind: 'END' } } : {})
              }
            ]
          }
        }
      ]
    })
  } as CharacterActionCapabilityDescriptor
}

function directRepeatingConditionSaveAction(): CharacterActionCapabilityDescriptor {
  return {
    ...action(),
    compiledEffect: compileEffect({
      id: EFFECT_ID,
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: '00000000-0000-4000-8000-000000000060',
          dcMethod: 'FIXED_DC',
          abilityDefinitionId: DEXTERITY_ABILITY_ID,
          baseDc: 10
        },
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: 'direct-repeat-range', rangeKind: RANGE_KIND.UNLIMITED },
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
      },
      paths: [
        {
          id: '00000000-0000-4000-8000-000000000061',
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          selectionKind: 'FIXED',
          resultBlock: {
            id: '00000000-0000-4000-8000-000000000062',
            resultKind: 'SEQUENCE',
            duration: {
              id: '00000000-0000-4000-8000-000000000063',
              durationKind: 'ROUND',
              amount: 10
            },
            outcomes: [
              {
                id: '00000000-0000-4000-8000-000000000064',
                effectKind: EFFECT_KIND.CONDITION,
                conditionId: CONDITION_ID
              },
              {
                id: '00000000-0000-4000-8000-000000000065',
                effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
                timing: 'TARGET_TURN_END',
                repeatRollInfluence: {
                  influence: 'DISADVANTAGE',
                  when: {
                    kind: 'PERCEPTION',
                    observer: 'TARGET',
                    subject: 'SOURCE',
                    requirement: 'SEE'
                  }
                },
                savingThrow: {
                  id: '00000000-0000-4000-8000-000000000066',
                  dcMethod: 'FIXED_DC',
                  abilityDefinitionId: DEXTERITY_ABILITY_ID,
                  baseDc: 10
                },
                attempts: { kind: 'ONCE', repeatOnFailure: true },
                onSuccess: { kind: 'END' },
                onFailure: { kind: 'CONTINUE' },
                onDurationComplete: { kind: 'END' }
              }
            ]
          }
        }
      ]
    }),
    conditionDefinitionIds: [CONDITION_ID]
  } as CharacterActionCapabilityDescriptor
}

function quasitClawsAction(): CharacterActionCapabilityDescriptor {
  return {
    ...nestedSaveAttackAction({
      primaryDice: '1d4',
      failureDice: '2d4',
      repeatTiming: 'TARGET_TURN_END',
      repeatCondition: true
    }),
    conditionDefinitionIds: [CONDITION_ID]
  }
}

function relationshipAction(input: { recurrenceStage: 'NONE' | 'START_OF_TURN' }) {
  const effectId =
    input.recurrenceStage === 'NONE'
      ? '00000000-0000-4000-8000-000000000081'
      : '00000000-0000-4000-8000-000000000082'
  const relationshipId =
    input.recurrenceStage === 'NONE'
      ? '00000000-0000-4000-8000-000000000083'
      : '00000000-0000-4000-8000-000000000084'
  return {
    ...attackAction(),
    effectId,
    entryPointDefinitionId: effectId,
    conditionDefinitionIds: [CONDITION_ID],
    compiledEffect: compileEffect({
      id: effectId,
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: `${effectId}-range`, rangeKind: RANGE_KIND.DISTANCE, amount: 5, unit: 'FEET' },
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
      },
      paths: [
        {
          id: `${effectId}-path`,
          order: 1,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED',
          resultBlock: {
            id: `${effectId}-result`,
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: relationshipId,
                effectKind: EFFECT_KIND.ACTOR_RELATIONSHIP,
                modules: [
                  {
                    id: '00000000-0000-4000-8000-000000000085',
                    order: 1,
                    kind: 'TARGET_SIZE_MAXIMUM',
                    sizeCode: 'MEDIUM'
                  },
                  {
                    id: '00000000-0000-4000-8000-000000000086',
                    order: 2,
                    kind: 'TARGET_CAPABILITY_SUPPRESSION',
                    capabilityDefinitionIds: [REACTION_ELIGIBILITY_ID]
                  }
                ],
                conditions:
                  input.recurrenceStage === 'START_OF_TURN'
                    ? [
                        {
                          id: '00000000-0000-4000-8000-000000000087',
                          effectKind: EFFECT_KIND.CONDITION,
                          conditionId: CONDITION_ID
                        }
                      ]
                    : [],
                ...(input.recurrenceStage === 'START_OF_TURN'
                  ? {
                      recurrence: {
                        stage: 'START_OF_TURN',
                        damage: {
                          id: '00000000-0000-4000-8000-000000000088',
                          effectKind: EFFECT_KIND.DAMAGE,
                          damageTypeId: '00000000-0000-4000-8000-000000000099',
                          valueKind: 'DICE',
                          scalingKind: 'NONE',
                          diceConfig: '2d6+3'
                        }
                      }
                    }
                  : {})
              }
            ]
          }
        }
      ]
    })
  }
}

function maximumReductionNestedSaveAttackAction(
  input: {
    sourceDamageOutcomeId?: string
    successKind?: 'END' | 'CONTINUE'
  } = {}
): CharacterActionCapabilityDescriptor {
  const candidate = nestedSaveAttackAction()
  return {
    ...candidate,
    compiledEffect: {
      ...candidate.compiledEffect,
      entries: candidate.compiledEffect.entries.map((entry) =>
        entry.pathCode === PATH_CODE.ON_HIT &&
        'outcome' in entry &&
        entry.outcome.effectKind === EFFECT_KIND.FOLLOW_UP_SAVE
          ? {
              ...entry,
              outcome: {
                ...entry.outcome,
                onFailure: {
                  kind: 'OUTCOMES' as const,
                  endCurrent: false,
                  resultKind: 'SINGLE' as const,
                  outcomes: [
                    {
                      id: '00000000-0000-4000-8000-000000000047',
                      effectKind: EFFECT_KIND.HIT_POINT_MAXIMUM_REDUCTION,
                      amountSource: {
                        kind: 'DAMAGE_TAKEN' as const,
                        damageOutcomeId:
                          input.sourceDamageOutcomeId ?? '00000000-0000-4000-8000-000000000042'
                      },
                      recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM'] as ['RESTORE_HIT_POINT_MAXIMUM']
                    }
                  ]
                },
                onSuccess: { kind: input.successKind ?? 'END' }
              }
            }
          : entry
      )
    }
  } as CharacterActionCapabilityDescriptor
}

function forcedMovementNestedSaveAttackAction(
  input: {
    direction?:
      | typeof FORCED_MOVEMENT_DIRECTION.TOWARD_SOURCE
      | typeof FORCED_MOVEMENT_DIRECTION.AWAY_FROM_SOURCE
    amount?: number
  } = {}
): CharacterActionCapabilityDescriptor {
  return {
    ...action(),
    compiledEffect: compileEffect({
      id: EFFECT_ID,
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: 'range-id', rangeKind: RANGE_KIND.UNLIMITED },
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
      },
      paths: [
        {
          id: '00000000-0000-4000-8000-000000000050',
          order: 1,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          selectionKind: 'FIXED',
          resultBlock: {
            id: '00000000-0000-4000-8000-000000000051',
            resultKind: 'SEQUENCE',
            outcomes: [
              {
                id: '00000000-0000-4000-8000-000000000052',
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: '00000000-0000-4000-8000-000000000098',
                valueKind: 'DICE',
                scalingKind: 'NONE',
                diceConfig: '2d6'
              },
              {
                id: '00000000-0000-4000-8000-000000000053',
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: '00000000-0000-4000-8000-000000000097',
                valueKind: 'DICE',
                scalingKind: 'NONE',
                diceConfig: '3d6'
              },
              {
                id: '00000000-0000-4000-8000-000000000054',
                effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
                timing: 'IMMEDIATE',
                savingThrow: {
                  id: '00000000-0000-4000-8000-000000000055',
                  dcMethod: 'FIXED_DC',
                  abilityDefinitionId: DEXTERITY_ABILITY_ID,
                  baseDc: 20
                },
                attempts: { kind: 'ONCE' },
                onSuccess: { kind: 'END' },
                onFailure: {
                  kind: 'OUTCOMES',
                  endCurrent: true,
                  resultKind: 'SINGLE',
                  outcomes: [
                    {
                      id: '00000000-0000-4000-8000-000000000056',
                      effectKind: EFFECT_KIND.FORCED_MOVEMENT,
                      direction: input.direction ?? FORCED_MOVEMENT_DIRECTION.TOWARD_SOURCE,
                      actionEconomy: FORCED_MOVEMENT_ACTION_ECONOMY.NONE,
                      distanceMode: FORCED_MOVEMENT_DISTANCE_MODE.FIXED_DISTANCE,
                      amount: input.amount ?? 25,
                      unit: 'FEET'
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    })
  } as CharacterActionCapabilityDescriptor
}

function balorWhipAction(): CharacterActionCapabilityDescriptor {
  return forcedMovementNestedSaveAttackAction({ amount: 25 })
}

function diceAttackAction(input: {
  dice: string
  bonuses?: readonly {
    bonusKind: 'ABILITY_BONUS'
    ability: 'STRENGTH'
    order: number
  }[]
}): CharacterActionCapabilityDescriptor {
  const candidate = attackAction()
  return {
    ...candidate,
    compiledEffect: {
      ...candidate.compiledEffect,
      entries: candidate.compiledEffect.entries.map((entry) =>
        entry.pathCode === PATH_CODE.ON_HIT && 'outcome' in entry
          ? {
              ...entry,
              resultBlockId: '00000000-0000-4000-8000-000000000030',
              outcome: {
                ...entry.outcome,
                valueKind: 'DICE' as const,
                scalingKind: 'NONE' as const,
                dice: input.dice,
                ...(input.bonuses ? { bonuses: [...input.bonuses] } : {})
              }
            }
          : entry
      )
    }
  } as CharacterActionCapabilityDescriptor
}

function scalarReductionAttackAction(): CharacterActionCapabilityDescriptor {
  const candidate = attackAction()
  return {
    ...candidate,
    compiledEffect: compileEffect({
      id: EFFECT_ID,
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: 'range-id', rangeKind: RANGE_KIND.UNLIMITED },
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
      },
      paths: [
        {
          id: 'scalar-hit-path',
          order: 1,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'scalar-result',
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: '00000000-0000-4000-8000-000000000080',
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: '00000000-0000-4000-8000-000000000099',
                valueKind: 'DICE',
                scalingKind: 'NONE',
                diceConfig: '2d6+2'
              },
              {
                id: '00000000-0000-4000-8000-000000000081',
                effectKind: EFFECT_KIND.SCALAR_REDUCTION,
                valueDefinitionId: '00000000-0000-4000-8000-000000000082',
                amount: { kind: 'DICE', diceConfig: '1d4' },
                stacking: 'ADDITIVE',
                floor: 0,
                recoveryTriggers: ['SHORT_REST', 'LONG_REST'],
                terminalConsequence: 'TARGET_DIED'
              }
            ]
          }
        }
      ]
    })
  } as CharacterActionCapabilityDescriptor
}

function movementReactionAttackAction(
  input: {
    bound?: boolean
    movementInterruption?: {
      kind: 'STOP'
      whenResultPath:
        | typeof PATH_CODE.ON_HIT
        | typeof PATH_CODE.ON_MISS
        | typeof PATH_CODE.ON_SAVE_FAIL
    } | null
  } = {}
): CharacterActionCapabilityDescriptor {
  const candidate = attackAction()
  return {
    ...candidate,
    compiledEffect: compileEffect({
      id: EFFECT_ID,
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
        range: {
          id: 'reach-range-id',
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 5,
          unit: 'FEET'
        },
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' },
        ...(input.bound === false
          ? {}
          : {
              reactionMovementTrigger: {
                kind: 'MOVEMENT' as const,
                stage: 'BEFORE_LEAVE_REACH' as const,
                perceptionRequirement: 'SEE' as const,
                eligibilityDefinitionId: REACTION_ELIGIBILITY_ID,
                movementInterruption: input.movementInterruption ?? null
              }
            })
      },
      paths: attackPaths()
    })
  }
}

function saveAction(
  paths: readonly string[] = [PATH_CODE.ON_SAVE_FAIL, PATH_CODE.ON_SAVE_SUCCESS]
) {
  const entries = paths.map((pathCode, order) => ({
    id: `path-${order}`,
    order,
    pathCode: pathCode as typeof PATH_CODE.ON_SAVE_FAIL | typeof PATH_CODE.ON_SAVE_SUCCESS,
    groupType: PATH_GROUP_TYPE.SINGLE,
    selectionKind: 'FIXED' as const,
    resultBlock: {
      id: `result-${order}`,
      resultKind: 'SINGLE' as const,
      outcomes: [
        {
          id: `damage-${order}`,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: '00000000-0000-4000-8000-000000000099',
          valueKind: 'FIXED' as const,
          scalingKind: 'NONE' as const,
          amount: order + 1
        }
      ]
    }
  }))
  return {
    ...action(),
    compiledEffect: compileEffect({
      id: EFFECT_ID,
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: 'save-id',
          abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
          dcMethod: 'SOURCE_SAVE_DC'
        },
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: 'range-id', rangeKind: RANGE_KIND.UNLIMITED },
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
      },
      paths: entries
    })
  } as CharacterActionCapabilityDescriptor
}

async function resolveTest(
  candidate: CharacterActionCapabilityDescriptor,
  facts: Record<string, string | number>,
  naturalD20: number
) {
  const published = compileDnd5eEffectAction({ action: candidate })
  const runtime = createRulesRuntimeService({
    capabilities: [dnd5eEffectActionCapability],
    operations: [
      integerRangeEvidenceRuleOperation,
      dnd5eAttackTestOperation,
      dnd5eSaveTestOperation,
      dnd5eDamageProposalOperation,
      dnd5eTestDamageProposalOperation
    ],
    continuationIntegrityKey: new Uint8Array(32).fill(1),
    definitions: {
      async requireCurrent() {
        throw new Error('Not used.')
      }
    }
  })
  const started = await runtime.executeResolved({
    command: {
      definitionId: EFFECT_ID,
      occurrenceId: OCCURRENCE_ID,
      facts: {
        ...facts,
        [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: checksumRuleDocument([]),
        [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: 'a'.repeat(64)
      }
    },
    published
  })
  if (started.status !== 'PAUSED') throw new Error('Expected selected d20 evidence.')
  const completed = await runtime.resume({
    continuation: started.continuation,
    response: {
      requestId: started.continuation.request.requestId,
      value: naturalD20
    }
  })
  if (completed.status !== 'COMPLETE') throw new Error('Expected completed test.')
  return { published, completed }
}

describe('D&D Effect action compiler', () => {
  it('executes one immediate nested save with primary damage and one shared full-or-half pool', async () => {
    const candidate = nestedSaveAttackAction()
    const test = compileDnd5eEffectActionTestTemplate({ action: candidate })
    const outcome = specializeDnd5eEffectActionOutcome({
      action: candidate,
      testTemplate: test,
      selectedPath: 'ON_HIT',
      facts: {}
    })
    if (!outcome) throw new Error('Expected the nested-save OUTCOME template.')
    const runtime = createRulesRuntimeService({
      capabilities: [dnd5eEffectActionCapability],
      operations: [
        integerRangeEvidenceRuleOperation,
        addNumbersRuleOperation,
        dnd5eSaveTestOperation,
        dnd5eSaveDamageTotalOperation,
        dnd5eDamageProposalOperation,
        dnd5eTestDamageProposalOperation,
        dnd5eHitPointMaximumReductionProposalOperation
      ],
      continuationIntegrityKey: new Uint8Array(32).fill(31),
      definitions: {
        async requireCurrent() {
          throw new Error('Not used.')
        }
      }
    })
    const resolve = async (occurrenceId: string, naturalD20: number) => {
      let result = await runtime.executeResolved({
        command: {
          definitionId: EFFECT_ID,
          occurrenceId,
          facts: {
            [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
            [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: 'a'.repeat(64),
            [DND5E_SAVE_MODIFIER_FACT_KEY]: 0,
            [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: checksumRuleDocument([])
          }
        },
        published: outcome.published
      })
      const requestNodeIds: string[] = []
      while (result.status === 'PAUSED') {
        const request = result.continuation.request
        requestNodeIds.push(request.nodeId)
        const value =
          request.nodeId === 'die-1' ? 5 : request.nodeId === 'nested-save-d20' ? naturalD20 : 3
        result = await runtime.resume({
          continuation: result.continuation,
          response: { requestId: request.requestId, value }
        })
      }
      return { result, requestNodeIds }
    }

    const failed = await resolve(OCCURRENCE_ID, 1)
    const succeeded = await resolve('00000000-0000-4000-8000-000000000017', 20)
    expect(failed.requestNodeIds).toEqual([
      'die-1',
      'nested-save-d20',
      ...Array.from({ length: 7 }, (_, index) => `nested-save-die-${index + 1}`)
    ])
    expect(succeeded.requestNodeIds).toEqual(failed.requestNodeIds)
    expect(failed.result).toMatchObject({
      status: 'COMPLETE',
      outputs: { outcome1_amount: 5, outcome2_amount: 21 }
    })
    expect(succeeded.result).toMatchObject({
      status: 'COMPLETE',
      outputs: { outcome1_amount: 5, outcome2_amount: 10 }
    })
    if (failed.result.status !== 'COMPLETE' || succeeded.result.status !== 'COMPLETE') {
      throw new Error('Expected completed nested-save outcomes.')
    }
    const interpret = (execution: typeof failed.result) =>
      dnd5eCharacterRuleActionSystemAdapter.interpret({
        execution,
        occurrenceId: OCCURRENCE_ID,
        published: outcome.published,
        targetActorId: ACTOR_ID,
        currentHitPoints: 100,
        temporaryHitPoints: 0,
        maximumHitPoints: 100,
        defenses: []
      })
    expect(interpret(failed.result)).toMatchObject([
      { kind: 'DAMAGE', requestedAmount: 5 },
      { kind: 'DAMAGE', requestedAmount: 21 }
    ])
    expect(interpret(succeeded.result)).toMatchObject([
      { kind: 'DAMAGE', requestedAmount: 5 },
      { kind: 'DAMAGE', requestedAmount: 10 }
    ])
  })

  it('emits one maximum hit point reduction from resolved primary damage on nested-save failure', async () => {
    const fullOrHalfCandidate = nestedSaveAttackAction({
      maximumReductionDamageOutcomeId: '00000000-0000-4000-8000-000000000042'
    })
    const fullOrHalfTest = compileDnd5eEffectActionTestTemplate({
      action: fullOrHalfCandidate
    })
    const fullOrHalfOutcome = specializeDnd5eEffectActionOutcome({
      action: fullOrHalfCandidate,
      testTemplate: fullOrHalfTest,
      selectedPath: 'ON_HIT',
      facts: {}
    })
    if (!fullOrHalfOutcome)
      throw new Error('Expected the full-or-half nested-save OUTCOME template.')
    expect(fullOrHalfOutcome.published.definition.sourceEntryBindings).toContainEqual({
      sourceEntryId: '00000000-0000-4000-8000-000000000043',
      nodeId: 'nested-save-proposal'
    })
    expect(fullOrHalfOutcome.published.definition.sourceEntryBindings).toContainEqual({
      sourceEntryId: '00000000-0000-4000-8000-000000000047',
      nodeId: 'nested-save-hit-point-maximum-reduction'
    })
    const candidate = maximumReductionNestedSaveAttackAction()
    const test = compileDnd5eEffectActionTestTemplate({ action: candidate })
    const outcome = specializeDnd5eEffectActionOutcome({
      action: candidate,
      testTemplate: test,
      selectedPath: 'ON_HIT',
      facts: {}
    })
    if (!outcome) throw new Error('Expected the nested-save OUTCOME template.')
    expect(outcome.published.definition.nodes.map((node) => node.id)).toEqual([
      'die-1',
      'proposal-on_hit',
      'nested-save-d20',
      'nested-save-test',
      'nested-save-hit-point-maximum-reduction'
    ])
    expect(outcome.published.definition.sourceEntryBindings).toEqual([
      {
        sourceEntryId: '00000000-0000-4000-8000-000000000042',
        nodeId: 'proposal-on_hit'
      },
      {
        sourceEntryId: '00000000-0000-4000-8000-000000000043',
        nodeId: 'nested-save-test'
      },
      {
        sourceEntryId: '00000000-0000-4000-8000-000000000047',
        nodeId: 'nested-save-hit-point-maximum-reduction'
      }
    ])
    const runtime = createRulesRuntimeService({
      capabilities: [dnd5eEffectActionCapability],
      operations: [
        integerRangeEvidenceRuleOperation,
        dnd5eSaveTestOperation,
        dnd5eDamageProposalOperation,
        dnd5eHitPointMaximumReductionProposalOperation
      ],
      continuationIntegrityKey: new Uint8Array(32).fill(32),
      definitions: {
        async requireCurrent() {
          throw new Error('Not used.')
        }
      }
    })
    const resolve = async (
      naturalD20: number,
      defenses: readonly {
        kind: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY'
        damageTypeId: string
      }[]
    ) => {
      let result = await runtime.executeResolved({
        command: {
          definitionId: EFFECT_ID,
          occurrenceId: naturalD20 === 1 ? OCCURRENCE_ID : '00000000-0000-4000-8000-000000000018',
          facts: {
            [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
            [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: 'a'.repeat(64),
            [DND5E_SAVE_MODIFIER_FACT_KEY]: 0,
            [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: checksumRuleDocument([])
          }
        },
        published: outcome.published
      })
      while (result.status === 'PAUSED') {
        result = await runtime.resume({
          continuation: result.continuation,
          response: {
            requestId: result.continuation.request.requestId,
            value: result.continuation.request.nodeId === 'die-1' ? 5 : naturalD20
          }
        })
      }
      if (result.status !== 'COMPLETE') throw new Error('Expected completed nested-save outcome.')
      return dnd5eCharacterRuleActionSystemAdapter.interpret({
        execution: result,
        occurrenceId: OCCURRENCE_ID,
        published: outcome.published,
        targetActorId: ACTOR_ID,
        currentHitPoints: 100,
        temporaryHitPoints: 0,
        maximumHitPoints: 100,
        defenses
      })
    }
    expect(
      await resolve(1, [
        {
          kind: 'RESISTANCE',
          damageTypeId: '00000000-0000-4000-8000-000000000098'
        }
      ])
    ).toMatchObject([
      { kind: 'DAMAGE', requestedAmount: 5, resolvedAmount: 2 },
      {
        kind: 'HIT_POINT_MAXIMUM_REDUCTION',
        reductionAmount: 2,
        sourceDamageNodeId: 'proposal-on_hit',
        sourceDamageOperationKey: DND5E_DAMAGE_PROPOSAL_OPERATION_KEY
      }
    ])
    expect(
      await resolve(1, [
        {
          kind: 'VULNERABILITY',
          damageTypeId: '00000000-0000-4000-8000-000000000098'
        }
      ])
    ).toMatchObject([
      { kind: 'DAMAGE', requestedAmount: 5, resolvedAmount: 10 },
      { kind: 'HIT_POINT_MAXIMUM_REDUCTION', reductionAmount: 10 }
    ])
    expect(
      await resolve(1, [
        {
          kind: 'IMMUNITY',
          damageTypeId: '00000000-0000-4000-8000-000000000098'
        }
      ])
    ).toMatchObject([{ kind: 'DAMAGE', requestedAmount: 5, resolvedAmount: 0 }])
    expect(await resolve(20, [])).toMatchObject([{ kind: 'DAMAGE', requestedAmount: 5 }])
  })

  it('specializes a failed immediate save into one sealed forced-movement directive', async () => {
    const candidate = forcedMovementNestedSaveAttackAction()
    const test = compileDnd5eEffectActionTestTemplate({ action: candidate })
    expect(
      specializeDnd5eEffectActionOutcome({
        action: candidate,
        testTemplate: test,
        selectedPath: 'ON_MISS',
        facts: {}
      })
    ).toBeNull()
    const outcome = specializeDnd5eEffectActionOutcome({
      action: candidate,
      testTemplate: test,
      selectedPath: 'ON_HIT',
      facts: {}
    })
    if (!outcome) throw new Error('Expected the forced-movement OUTCOME template.')
    expect(outcome.published.definition.sourceEntryBindings).toContainEqual({
      sourceEntryId: '00000000-0000-4000-8000-000000000056',
      nodeId: 'nested-save-forced-movement'
    })
    const runtime = createRulesRuntimeService({
      capabilities: [dnd5eEffectActionCapability],
      operations: [
        integerRangeEvidenceRuleOperation,
        addNumbersRuleOperation,
        dnd5eSaveTestOperation,
        dnd5eDamageTotalOperation,
        dnd5eDamageProposalOperation,
        dnd5eForcedMovementProposalOperation
      ],
      continuationIntegrityKey: new Uint8Array(32).fill(39),
      definitions: {
        async requireCurrent() {
          throw new Error('Not used.')
        }
      }
    })
    const resolve = async (saveD20: number, critical = false) => {
      let result = await runtime.executeResolved({
        command: {
          definitionId: EFFECT_ID,
          occurrenceId: critical
            ? '00000000-0000-4000-8000-000000000058'
            : '00000000-0000-4000-8000-000000000057',
          facts: {
            [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
            [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: 'a'.repeat(64),
            [DND5E_SAVE_MODIFIER_FACT_KEY]: 0,
            [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: checksumRuleDocument([])
          }
        },
        published: critical
          ? (specializeDnd5eEffectActionOutcome({
              action: candidate,
              testTemplate: test,
              selectedPath: 'ON_CRIT',
              facts: {}
            })?.published ?? outcome.published)
          : outcome.published
      })
      while (result.status === 'PAUSED') {
        result = await runtime.resume({
          continuation: result.continuation,
          response: {
            requestId: result.continuation.request.requestId,
            value: result.continuation.request.nodeId === 'nested-save-d20' ? saveD20 : 1
          }
        })
      }
      if (result.status !== 'COMPLETE')
        throw new Error('Expected completed forced-movement outcome.')
      return result
    }
    const failed = await resolve(1)
    expect(
      dnd5eCharacterRuleActionSystemAdapter.interpret({
        execution: failed,
        occurrenceId: OCCURRENCE_ID,
        published: outcome.published,
        targetActorId: ACTOR_ID,
        currentHitPoints: 100,
        temporaryHitPoints: 0,
        maximumHitPoints: 100,
        defenses: []
      })
    ).toMatchObject([
      { kind: 'DAMAGE', requestedAmount: 2 },
      { kind: 'DAMAGE', requestedAmount: 3 }
    ])
    const spatialInput = {
      execution: failed,
      occurrenceId: OCCURRENCE_ID,
      published: outcome.published,
      targetActorId: ACTOR_ID
    }
    const malformedSpatialPublished = (
      sourceEntryBindings: NonNullable<typeof outcome.published.definition.sourceEntryBindings>
    ) => ({
      ...outcome.published,
      definition: {
        ...outcome.published.definition,
        sourceEntryBindings
      }
    })
    const forcedBinding = outcome.published.definition.sourceEntryBindings?.find(
      (binding) => binding.nodeId === 'nested-save-forced-movement'
    )
    if (!forcedBinding) throw new Error('Expected the forced-movement source binding.')
    expect(() =>
      dnd5eCharacterRuleActionSystemAdapter.interpretSpatial?.({
        ...spatialInput,
        published: malformedSpatialPublished(
          outcome.published.definition.sourceEntryBindings?.filter(
            (binding) => binding.nodeId !== 'nested-save-forced-movement'
          ) ?? []
        )
      })
    ).toThrow('forced movement proposal is invalid')
    expect(() =>
      dnd5eCharacterRuleActionSystemAdapter.interpretSpatial?.({
        ...spatialInput,
        published: malformedSpatialPublished([
          ...(outcome.published.definition.sourceEntryBindings ?? []),
          {
            ...forcedBinding,
            sourceEntryId: '00000000-0000-4000-8000-000000000099'
          }
        ])
      })
    ).toThrow('forced movement proposal is invalid')
    expect(() =>
      dnd5eCharacterRuleActionSystemAdapter.interpretSpatial?.({
        ...spatialInput,
        published: malformedSpatialPublished([
          ...(outcome.published.definition.sourceEntryBindings ?? []),
          forcedBinding
        ])
      })
    ).toThrow('forced movement proposal is invalid')
    expect(
      dnd5eCharacterRuleActionSystemAdapter.interpretSpatial?.({
        ...spatialInput
      })
    ).toEqual([
      expect.objectContaining({
        kind: 'FORCED_MOVEMENT',
        sourceNodeId: 'nested-save-forced-movement',
        sourceOperationKey: DND5E_FORCED_MOVEMENT_PROPOSAL_OPERATION_KEY,
        authoredPath: 'ON_HIT',
        resolvedPath: 'ON_SAVE_FAIL',
        direction: 'TOWARD_SOURCE',
        distanceMode: 'FIXED_DISTANCE',
        amount: 25,
        unit: 'FEET',
        actionEconomy: 'NONE'
      })
    ])
    const succeeded = await resolve(20)
    expect(
      dnd5eCharacterRuleActionSystemAdapter.interpretSpatial?.({
        execution: succeeded,
        occurrenceId: OCCURRENCE_ID,
        published: outcome.published,
        targetActorId: ACTOR_ID
      })
    ).toEqual([])
    const critical = await resolve(1, true)
    expect(
      critical.evidence.trace.filter(
        (entry) =>
          entry.nodeId.startsWith('primary-') &&
          entry.operation.key === integerRangeEvidenceRuleOperation.key
      ).length
    ).toBe(10)
    expect(
      dnd5eCharacterRuleActionSystemAdapter.interpretSpatial?.({
        execution: critical,
        occurrenceId: OCCURRENCE_ID,
        published: specializeDnd5eEffectActionOutcome({
          action: candidate,
          testTemplate: test,
          selectedPath: 'ON_CRIT',
          facts: {}
        })!.published,
        targetActorId: ACTOR_ID
      })
    ).toMatchObject([{ amount: 25 }])
  })

  it('traces canonical Balor Whip damage and forced movement through the compiler and adapter', async () => {
    const candidate = balorWhipAction()
    const test = compileDnd5eEffectActionTestTemplate({ action: candidate })
    const primaryDamageEntries = candidate.compiledEffect.entries.filter(
      (entry) =>
        entry.pathCode === PATH_CODE.ON_HIT &&
        'outcome' in entry &&
        entry.outcome.effectKind === EFFECT_KIND.DAMAGE
    )
    expect(primaryDamageEntries).toHaveLength(2)
    const [slashing, fire] = primaryDamageEntries
    if (!slashing || !fire) throw new Error('Expected canonical Balor primary damage entries.')
    const facts = {
      resolvedDamageOutcomeExpressions: {
        [slashing.entryId]: '2d6 + 8',
        [fire.entryId]: '3d6'
      }
    }
    expect(
      specializeDnd5eEffectActionOutcome({
        action: candidate,
        testTemplate: test,
        selectedPath: 'ON_MISS',
        facts
      })
    ).toBeNull()
    const outcome = specializeDnd5eEffectActionOutcome({
      action: candidate,
      testTemplate: test,
      selectedPath: 'ON_HIT',
      facts
    })
    if (!outcome) throw new Error('Expected canonical Balor Whip outcome.')
    const movementBinding = outcome.published.definition.sourceEntryBindings?.filter(
      (binding) => binding.nodeId === 'nested-save-forced-movement'
    )
    expect(movementBinding).toEqual([
      expect.objectContaining({ nodeId: 'nested-save-forced-movement' })
    ])
    const runtime = createRulesRuntimeService({
      capabilities: [dnd5eEffectActionCapability],
      operations: [
        integerRangeEvidenceRuleOperation,
        addNumbersRuleOperation,
        dnd5eDamageTotalOperation,
        dnd5eSaveTestOperation,
        dnd5eDamageProposalOperation,
        dnd5eForcedMovementProposalOperation
      ],
      continuationIntegrityKey: new Uint8Array(32).fill(40),
      definitions: {
        async requireCurrent() {
          throw new Error('Not used.')
        }
      }
    })
    const resolve = async (saveD20: number, critical = false) => {
      const published = critical
        ? specializeDnd5eEffectActionOutcome({
            action: candidate,
            testTemplate: test,
            selectedPath: 'ON_CRIT',
            facts
          })?.published
        : outcome.published
      if (!published) throw new Error('Expected canonical Balor Whip critical outcome.')
      let result = await runtime.executeResolved({
        command: {
          definitionId: candidate.effectId,
          occurrenceId: critical
            ? '00000000-0000-4000-8000-000000000061'
            : '00000000-0000-4000-8000-000000000060',
          facts: {
            [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
            [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: 'b'.repeat(64),
            [DND5E_SAVE_MODIFIER_FACT_KEY]: 0,
            [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: checksumRuleDocument([])
          }
        },
        published
      })
      while (result.status === 'PAUSED') {
        result = await runtime.resume({
          continuation: result.continuation,
          response: {
            requestId: result.continuation.request.requestId,
            value: result.continuation.request.nodeId === 'nested-save-d20' ? saveD20 : 1
          }
        })
      }
      if (result.status !== 'COMPLETE') throw new Error('Expected canonical Balor completion.')
      return { published, result }
    }
    const successfulSave = await resolve(20)
    expect(
      dnd5eCharacterRuleActionSystemAdapter.interpret({
        execution: successfulSave.result,
        occurrenceId: OCCURRENCE_ID,
        published: successfulSave.published,
        targetActorId: ACTOR_ID,
        currentHitPoints: 100,
        temporaryHitPoints: 0,
        maximumHitPoints: 100,
        defenses: []
      })
    ).toMatchObject([
      { kind: 'DAMAGE', requestedAmount: 10 },
      { kind: 'DAMAGE', requestedAmount: 3 }
    ])
    expect(
      dnd5eCharacterRuleActionSystemAdapter.interpretSpatial?.({
        execution: successfulSave.result,
        occurrenceId: OCCURRENCE_ID,
        published: successfulSave.published,
        targetActorId: ACTOR_ID
      })
    ).toEqual([])
    const failedSave = await resolve(1)
    expect(
      dnd5eCharacterRuleActionSystemAdapter.interpret({
        execution: failedSave.result,
        occurrenceId: OCCURRENCE_ID,
        published: failedSave.published,
        targetActorId: ACTOR_ID,
        currentHitPoints: 100,
        temporaryHitPoints: 0,
        maximumHitPoints: 100,
        defenses: []
      })
    ).toMatchObject([
      { kind: 'DAMAGE', requestedAmount: 10 },
      { kind: 'DAMAGE', requestedAmount: 3 }
    ])
    expect(
      dnd5eCharacterRuleActionSystemAdapter.interpretSpatial?.({
        execution: failedSave.result,
        occurrenceId: OCCURRENCE_ID,
        published: failedSave.published,
        targetActorId: ACTOR_ID
      })
    ).toEqual([
      expect.objectContaining({
        targetActorId: ACTOR_ID,
        sourceNodeId: 'nested-save-forced-movement',
        sourceOperationKey: DND5E_FORCED_MOVEMENT_PROPOSAL_OPERATION_KEY,
        direction: 'TOWARD_SOURCE',
        distanceMode: 'FIXED_DISTANCE',
        amount: 25,
        unit: 'FEET',
        actionEconomy: 'NONE'
      })
    ])
    const critical = await resolve(1, true)
    expect(
      dnd5eCharacterRuleActionSystemAdapter.interpret({
        execution: critical.result,
        occurrenceId: OCCURRENCE_ID,
        published: critical.published,
        targetActorId: ACTOR_ID,
        currentHitPoints: 100,
        temporaryHitPoints: 0,
        maximumHitPoints: 100,
        defenses: []
      })
    ).toMatchObject([
      { kind: 'DAMAGE', requestedAmount: 12 },
      { kind: 'DAMAGE', requestedAmount: 6 }
    ])
    expect(
      dnd5eCharacterRuleActionSystemAdapter.interpretSpatial?.({
        execution: critical.result,
        occurrenceId: OCCURRENCE_ID,
        published: critical.published,
        targetActorId: ACTOR_ID
      })
    ).toMatchObject([{ amount: 25, unit: 'FEET' }])
  })

  it.each([
    ['delayed timing', nestedSaveAttackAction({ timing: 'TARGET_TURN_END' })],
    [
      'repeating thresholds',
      nestedSaveAttackAction({
        attempts: {
          kind: 'THRESHOLDS',
          successesToEnd: 1,
          failuresToResolve: 1,
          consecutive: false
        }
      })
    ],
    ['different success dice', nestedSaveAttackAction({ successDice: '6d8' })],
    ['fixed primary damage', nestedSaveAttackAction({ fixedPrimary: true })],
    [
      'missing maximum reduction source',
      nestedSaveAttackAction({
        maximumReductionDamageOutcomeId: '00000000-0000-4000-8000-000000000099'
      })
    ],
    [
      'invalid maximum reduction source identity',
      nestedSaveAttackAction({ maximumReductionDamageOutcomeId: 'not-a-uuid' })
    ],
    [
      'cross-outcome maximum reduction source',
      nestedSaveAttackAction({
        maximumReductionDamageOutcomeId: '00000000-0000-4000-8000-000000000045'
      })
    ],
    [
      'state-only cross-outcome maximum reduction source',
      maximumReductionNestedSaveAttackAction({
        sourceDamageOutcomeId: '00000000-0000-4000-8000-000000000045'
      })
    ],
    [
      'state-only non-terminal success branch',
      maximumReductionNestedSaveAttackAction({ successKind: 'CONTINUE' })
    ],
    [
      'ordinary coordinator evidence limit',
      nestedSaveAttackAction({
        primaryDice: '15d6',
        failureDice: '16d8',
        successDice: '16d8'
      })
    ],
    [
      'critical coordinator evidence limit',
      nestedSaveAttackAction({
        primaryDice: '15d6',
        failureDice: '1d8',
        successDice: '1d8'
      })
    ],
    [
      'modified nested dice',
      nestedSaveAttackAction({
        failureDice: '7d8 + 1',
        successDice: '7d8 + 1'
      })
    ],
    [
      'forced movement direction',
      forcedMovementNestedSaveAttackAction({
        direction: FORCED_MOVEMENT_DIRECTION.AWAY_FROM_SOURCE
      })
    ],
    ['forced movement distance', forcedMovementNestedSaveAttackAction({ amount: 24 })]
  ])('rejects unsupported nested-save %s', (_label, candidate) => {
    expect(() => compileDnd5eEffectActionTestTemplate({ action: candidate })).toThrow(
      'unsupported bounded shape'
    )
  })

  it('doubles only the primary dice for a critical nested-save attack', async () => {
    const candidate = nestedSaveAttackAction()
    const test = compileDnd5eEffectActionTestTemplate({ action: candidate })
    const outcome = specializeDnd5eEffectActionOutcome({
      action: candidate,
      testTemplate: test,
      selectedPath: 'ON_CRIT',
      facts: {}
    })
    if (!outcome) throw new Error('Expected the critical nested-save OUTCOME template.')
    const evidenceNodes = outcome.published.definition.nodes.filter(
      (node) => node.operation.key === integerRangeEvidenceRuleOperation.key
    )
    expect(evidenceNodes.map((node) => node.id)).toEqual([
      'die-1',
      'die-2',
      'nested-save-d20',
      ...Array.from({ length: 7 }, (_, index) => `nested-save-die-${index + 1}`)
    ])
  })

  it('specializes a selected scaled dice outcome into exact server evidence requests', async () => {
    const candidate = saveAction([PATH_CODE.ON_SAVE_FAIL])
    const scaled = compileEffect({
      id: EFFECT_ID,
      order: 1,
      invocation: candidate.compiledEffect.invocation,
      paths: [
        {
          id: '00000000-0000-4000-8000-000000000030',
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED',
          resultBlock: {
            id: '00000000-0000-4000-8000-000000000031',
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: '00000000-0000-4000-8000-000000000032',
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: '00000000-0000-4000-8000-000000000099',
                valueKind: 'DICE',
                scalingKind: 'PER_LEVEL',
                scalingSource: 'CHARACTER_LEVEL',
                levels: [
                  {
                    id: '00000000-0000-4000-8000-000000000033',
                    level: 1,
                    order: 1,
                    diceConfig: '1d8'
                  },
                  {
                    id: '00000000-0000-4000-8000-000000000034',
                    level: 5,
                    order: 2,
                    diceConfig: '2d8'
                  }
                ]
              }
            ]
          }
        }
      ]
    })
    const action = { ...candidate, compiledEffect: scaled }
    const test = compileDnd5eEffectActionTestTemplate({ action })
    expect(test.phase).toBe('TEST')
    const outcome = specializeDnd5eEffectActionOutcome({
      action,
      testTemplate: test,
      selectedPath: 'ON_SAVE_FAIL',
      facts: { characterLevel: 5 }
    })
    if (!outcome) throw new Error('Expected selected save-failure outcome.')
    expect(outcome.phase).toBe('OUTCOME')
    expect(outcome.published.definition.sourceEntryBindings).toEqual([
      {
        sourceEntryId: '00000000-0000-4000-8000-000000000032',
        nodeId: 'proposal-on_save_fail'
      }
    ])
    expect(
      outcome.published.definition.nodes.filter((node) => node.id.startsWith('die-'))
    ).toHaveLength(2)
    const runtime = createRulesRuntimeService({
      capabilities: [dnd5eEffectActionCapability],
      operations: [
        integerRangeEvidenceRuleOperation,
        addNumbersRuleOperation,
        dnd5eDamageProposalOperation
      ],
      continuationIntegrityKey: new Uint8Array(32).fill(1),
      definitions: {
        async requireCurrent() {
          throw new Error('Not used.')
        }
      }
    })
    const started = await runtime.executeResolved({
      command: {
        definitionId: EFFECT_ID,
        occurrenceId: OCCURRENCE_ID,
        facts: {
          [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
          [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: 'a'.repeat(64)
        }
      },
      published: outcome.published
    })
    if (started.status !== 'PAUSED') throw new Error('Expected first exact die request.')
    const once = await runtime.resume({
      continuation: started.continuation,
      response: { requestId: started.continuation.request.requestId, value: 3 }
    })
    if (once.status !== 'PAUSED') throw new Error('Expected second exact die request.')
    const completed = await runtime.resume({
      continuation: once.continuation,
      response: { requestId: once.continuation.request.requestId, value: 6 }
    })
    expect(completed.status).toBe('COMPLETE')
    if (completed.status === 'COMPLETE') {
      expect(completed.outputs.amount).toBe(9)
      const target = {
        execution: completed,
        occurrenceId: OCCURRENCE_ID,
        published: outcome.published,
        targetActorId: ACTOR_ID,
        currentHitPoints: 10,
        temporaryHitPoints: 0,
        maximumHitPoints: 10,
        defenses: []
      }
      expect(dnd5eCharacterRuleActionSystemAdapter.interpret(target)).toMatchObject([
        { kind: 'DAMAGE', requestedAmount: 9, targetActorId: ACTOR_ID }
      ])
      const terminalAmountOnly = {
        ...completed,
        outputs: { ...completed.outputs, amount: 4 },
        evidence: {
          ...completed.evidence,
          trace: completed.evidence.trace.map((entry) =>
            entry.nodeId === 'proposal-on_save_fail'
              ? { ...entry, outputs: { ...entry.outputs, amount: 4 } }
              : entry
          )
        }
      }
      expect(
        dnd5eCharacterRuleActionSystemAdapter.interpret({
          ...target,
          execution: terminalAmountOnly
        })
      ).toMatchObject([{ kind: 'DAMAGE', requestedAmount: 9 }])

      const invalidTraces: Array<readonly [string, ServerRuleExecutionTraceEntryDto[]]> = [
        ['missing support node', completed.evidence.trace.slice(1)],
        [
          'reordered support nodes',
          [
            completed.evidence.trace[1]!,
            completed.evidence.trace[0]!,
            ...completed.evidence.trace.slice(2)
          ]
        ],
        ['extra proposal trace', [...completed.evidence.trace, completed.evidence.trace.at(-1)!]]
      ]
      for (const [label, trace] of invalidTraces) {
        expect(
          () =>
            dnd5eCharacterRuleActionSystemAdapter.interpret({
              ...target,
              execution: {
                ...completed,
                evidence: { ...completed.evidence, trace }
              }
            }),
          label
        ).toThrow(Dnd5eEffectActionCompilerError)
      }
    }
  })

  it('applies a bounded flat damage modifier and clamps the resolved total at zero', async () => {
    const candidate = diceAttackAction({ dice: '1d4-1' })
    const testTemplate = compileDnd5eEffectActionTestTemplate({
      action: candidate
    })
    const outcome = specializeDnd5eEffectActionOutcome({
      action: candidate,
      testTemplate,
      selectedPath: 'ON_HIT',
      facts: {}
    })
    if (!outcome) throw new Error('Expected modified damage outcome.')
    const runtime = createRulesRuntimeService({
      capabilities: [dnd5eEffectActionCapability],
      operations: [
        integerRangeEvidenceRuleOperation,
        dnd5eDamageTotalOperation,
        dnd5eDamageProposalOperation
      ],
      continuationIntegrityKey: new Uint8Array(32).fill(1),
      definitions: {
        async requireCurrent() {
          throw new Error('Not used.')
        }
      }
    })
    const started = await runtime.executeResolved({
      command: {
        definitionId: EFFECT_ID,
        occurrenceId: OCCURRENCE_ID,
        facts: {
          [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
          [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: 'a'.repeat(64)
        }
      },
      published: outcome.published
    })
    if (started.status !== 'PAUSED') throw new Error('Expected damage die request.')
    const completed = await runtime.resume({
      continuation: started.continuation,
      response: { requestId: started.continuation.request.requestId, value: 1 }
    })
    expect(completed.status).toBe('COMPLETE')
    if (completed.status === 'COMPLETE') expect(completed.outputs.amount).toBe(0)
  })

  it('compiles an authored positive integer damage expression without requesting dice', () => {
    const candidate = diceAttackAction({ dice: '1' })
    const testTemplate = compileDnd5eEffectActionTestTemplate({
      action: candidate
    })
    const outcome = specializeDnd5eEffectActionOutcome({
      action: candidate,
      testTemplate,
      selectedPath: 'ON_HIT',
      facts: {}
    })
    expect(outcome?.published.definition.nodes).toMatchObject([
      {
        operation: { key: 'dnd5e.damage-proposal', contractVersion: 1 },
        inputs: { amount: { kind: 'LITERAL', value: 1 } }
      }
    ])
  })

  it('uses only the locked resolved action expression for a typed damage bonus', () => {
    const candidate = diceAttackAction({
      dice: '2d8',
      bonuses: [{ bonusKind: 'ABILITY_BONUS', ability: 'STRENGTH', order: 1 }]
    })
    const testTemplate = compileDnd5eEffectActionTestTemplate({
      action: candidate
    })
    expect(() =>
      specializeDnd5eEffectActionOutcome({
        action: candidate,
        testTemplate,
        selectedPath: 'ON_HIT',
        facts: {}
      })
    ).toThrow('resolved damage expression is unavailable')

    const outcome = specializeDnd5eEffectActionOutcome({
      action: candidate,
      testTemplate,
      selectedPath: 'ON_HIT',
      facts: { resolvedDamageExpressions: { ON_HIT: '2d8 + 6' } }
    })
    const total = outcome?.published.definition.nodes.find((node) => node.id === 'damage-total')
    expect(total).toMatchObject({
      operation: { key: 'dnd5e.damage-total', contractVersion: 1 },
      inputs: { modifier: { kind: 'LITERAL', value: 6 } }
    })
  })

  it('binds resolved damage expressions from the current locked action mechanic', () => {
    const candidate = diceAttackAction({ dice: '2d8' })
    const testTemplate = compileDnd5eEffectActionTestTemplate({
      action: candidate
    })
    const bound = dnd5eCharacterRuleActionSystemAdapter.bindFacts({
      actionMechanic: {
        attackBonus: 5,
        attackKind: 'MELEE',
        attackRollMode: 'NORMAL',
        save: null,
        outcomes: [
          {
            kind: 'DAMAGE',
            outcomeId: 'damage-0',
            pathCode: 'ON_HIT',
            expression: '2d8 + 6',
            damageTypeId: '00000000-0000-4000-8000-000000000099',
            scaling: []
          }
        ]
      },
      published: testTemplate.published,
      sourceDerivedFacts: {},
      targetActorId: ACTOR_ID,
      targetDerivedFacts: { statBlock: { armorClass: 12 } },
      targetConditionIds: [],
      currentHitPoints: 10,
      temporaryHitPoints: 0,
      maximumHitPoints: 10,
      targetScalarValues: {},
      defenses: []
    })
    expect(bound.facts[DND5E_RESOLVED_DAMAGE_EXPRESSION_FACT_KEYS.ON_HIT]).toBe('2d8 + 6')
    expect(bound.facts[DND5E_RESOLVED_DAMAGE_OUTCOME_EXPRESSIONS_FACT_KEY]).toBe(
      JSON.stringify({ 'damage-0': '2d8 + 6' })
    )
  })

  it('binds multiple same-path damage expressions only by exact outcome identity', () => {
    const candidate = attackAction()
    const testTemplate = compileDnd5eEffectActionTestTemplate({
      action: candidate
    })
    const bound = dnd5eCharacterRuleActionSystemAdapter.bindFacts({
      actionMechanic: {
        attackBonus: 5,
        attackKind: 'MELEE',
        attackRollMode: 'NORMAL',
        save: null,
        outcomes: [
          {
            kind: 'DAMAGE',
            outcomeId: 'first-damage',
            pathCode: 'ON_HIT',
            expression: '1d6 + 2',
            damageTypeId: '00000000-0000-4000-8000-000000000099',
            scaling: []
          },
          {
            kind: 'DAMAGE',
            outcomeId: 'second-damage',
            pathCode: 'ON_HIT',
            expression: '1d4 + 3',
            damageTypeId: '00000000-0000-4000-8000-000000000098',
            scaling: []
          }
        ]
      },
      published: testTemplate.published,
      sourceDerivedFacts: {},
      targetActorId: ACTOR_ID,
      targetDerivedFacts: { statBlock: { armorClass: 12 } },
      targetConditionIds: [],
      currentHitPoints: 10,
      temporaryHitPoints: 0,
      maximumHitPoints: 10,
      targetScalarValues: {},
      defenses: []
    })
    expect(bound.facts[DND5E_RESOLVED_DAMAGE_EXPRESSION_FACT_KEYS.ON_HIT]).toBeUndefined()
    expect(bound.facts[DND5E_RESOLVED_DAMAGE_OUTCOME_EXPRESSIONS_FACT_KEY]).toBe(
      JSON.stringify({ 'first-damage': '1d6 + 2', 'second-damage': '1d4 + 3' })
    )
  })

  it('specializes one selected fixed outcome family and never carries an unselected branch', () => {
    const saveEffect = (outcome: OutcomeAuthored) => {
      const candidate = saveAction([PATH_CODE.ON_SAVE_FAIL])
      return compileEffect({
        id: EFFECT_ID,
        order: 1,
        invocation: candidate.compiledEffect.invocation,
        paths: [
          {
            id: 'fixed-path-id',
            order: 1,
            pathCode: PATH_CODE.ON_SAVE_FAIL,
            groupType: PATH_GROUP_TYPE.SINGLE,
            selectionKind: 'FIXED',
            resultBlock: {
              id: 'fixed-result-id',
              resultKind: 'SINGLE',
              outcomes: [outcome]
            }
          }
        ]
      })
    }
    const cases = [
      {
        label: 'damage',
        build: () =>
          saveEffect({
            id: 'fixed-damage-id',
            effectKind: EFFECT_KIND.DAMAGE,
            damageTypeId: '00000000-0000-4000-8000-000000000099',
            valueKind: 'FIXED',
            scalingKind: 'NONE',
            amount: 4
          }),
        operation: 'dnd5e.damage-proposal'
      },
      {
        label: 'healing',
        build: () =>
          saveEffect({
            id: 'fixed-heal-id',
            effectKind: EFFECT_KIND.HEAL,
            valueKind: 'FIXED',
            scalingKind: 'NONE',
            amount: 4
          }),
        operation: 'dnd5e.heal-proposal'
      },
      {
        label: 'temporary hit points',
        build: () =>
          saveEffect({
            id: 'fixed-temporary-id',
            effectKind: EFFECT_KIND.HEAL,
            temporary: true,
            valueKind: 'FIXED',
            scalingKind: 'NONE',
            amount: 4
          }),
        operation: 'dnd5e.temporary-hit-points-proposal'
      },
      {
        label: 'condition',
        build: () =>
          saveEffect({
            id: 'fixed-condition-id',
            effectKind: EFFECT_KIND.CONDITION,
            conditionId: CONDITION_ID
          }),
        operation: 'dnd5e.condition-apply-proposal'
      }
    ]

    for (const { label, build, operation } of cases) {
      const candidate = saveAction([PATH_CODE.ON_SAVE_FAIL])
      const action = {
        ...candidate,
        conditionDefinitionIds: label === 'condition' ? [CONDITION_ID] : undefined,
        compiledEffect: build()
      }
      const test = compileDnd5eEffectActionTestTemplate({ action })
      const specialized = specializeDnd5eEffectActionOutcome({
        action,
        testTemplate: test,
        selectedPath: 'ON_SAVE_FAIL',
        facts: {}
      })
      expect(specialized, label).not.toBeNull()
      expect(specialized?.published.definition.nodes).toHaveLength(1)
      expect(specialized?.published.definition.nodes[0]?.operation.key).toBe(operation)
      expect(
        specializeDnd5eEffectActionOutcome({
          action,
          testTemplate: test,
          selectedPath: 'ON_SAVE_FAIL',
          facts: {}
        })?.published.checksum
      ).toBe(specialized?.published.checksum)
    }
  })

  it('interprets multiple compiled proposals in graph order', async () => {
    const candidate = attackAction()
    const testTemplate = compileDnd5eEffectActionTestTemplate({
      action: candidate
    })
    const outcome = specializeDnd5eEffectActionOutcome({
      action: candidate,
      testTemplate,
      selectedPath: 'ON_CRIT',
      facts: {}
    })
    if (!outcome) throw new Error('Expected critical outcome graph.')
    const runtime = createRulesRuntimeService({
      capabilities: [dnd5eEffectActionCapability],
      operations: [dnd5eDamageProposalOperation],
      continuationIntegrityKey: new Uint8Array(32).fill(1),
      definitions: {
        async requireCurrent() {
          throw new Error('Not used.')
        }
      }
    })
    const completed = await runtime.executeResolved({
      command: {
        definitionId: EFFECT_ID,
        occurrenceId: OCCURRENCE_ID,
        facts: {
          [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
          [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: 'a'.repeat(64)
        }
      },
      published: outcome.published
    })
    if (completed.status !== 'COMPLETE') throw new Error('Expected complete outcome.')
    expect(
      dnd5eCharacterRuleActionSystemAdapter.interpret({
        execution: completed,
        occurrenceId: OCCURRENCE_ID,
        published: outcome.published,
        targetActorId: ACTOR_ID,
        currentHitPoints: 10,
        temporaryHitPoints: 0,
        maximumHitPoints: 10,
        defenses: []
      })
    ).toMatchObject([
      { kind: 'DAMAGE', beforeCurrentHitPoints: 10 },
      { kind: 'DAMAGE', beforeCurrentHitPoints: 9 }
    ])
  })

  it('interprets mixed damage and condition proposals from one complete trace', async () => {
    const base = attackAction()
    const paths: EffectPathAuthored<typeof TRIGGER.MELEE_WEAPON_ATTACK, OutcomeAuthored>[] =
      attackPaths().map((path) =>
        path.pathCode === PATH_CODE.ON_CRIT
          ? {
              ...path,
              resultBlock: {
                ...path.resultBlock,
                outcomes: [
                  {
                    id: 'critical-condition',
                    effectKind: EFFECT_KIND.CONDITION,
                    conditionId: CONDITION_ID
                  }
                ]
              }
            }
          : path
      )
    const candidate = {
      ...base,
      conditionDefinitionIds: [CONDITION_ID],
      compiledEffect: compileEffect({
        id: EFFECT_ID,
        order: 1,
        invocation: base.compiledEffect.invocation,
        paths
      })
    } as CharacterActionCapabilityDescriptor
    const testTemplate = compileDnd5eEffectActionTestTemplate({
      action: candidate
    })
    const outcome = specializeDnd5eEffectActionOutcome({
      action: candidate,
      testTemplate,
      selectedPath: 'ON_CRIT',
      facts: {}
    })
    if (!outcome) throw new Error('Expected mixed critical outcome graph.')
    const runtime = createRulesRuntimeService({
      capabilities: [dnd5eEffectActionCapability],
      operations: [dnd5eDamageProposalOperation, dnd5eConditionApplyProposalOperation],
      continuationIntegrityKey: new Uint8Array(32).fill(1),
      definitions: {
        async requireCurrent() {
          throw new Error('Not used.')
        }
      }
    })
    const completed = await runtime.executeResolved({
      command: {
        definitionId: EFFECT_ID,
        occurrenceId: OCCURRENCE_ID,
        facts: {
          [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
          [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: 'a'.repeat(64),
          [DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY]: false,
          [DND5E_CONDITION_IMMUNE_FACT_KEYS.ON_CRIT]: false
        }
      },
      published: outcome.published
    })
    if (completed.status !== 'COMPLETE') throw new Error('Expected complete outcome.')
    expect(
      dnd5eCharacterRuleActionSystemAdapter
        .interpret({
          execution: completed,
          occurrenceId: OCCURRENCE_ID,
          published: outcome.published,
          targetActorId: ACTOR_ID,
          currentHitPoints: 10,
          temporaryHitPoints: 0,
          maximumHitPoints: 10,
          defenses: [],
          conditionImmunityIds: []
        })
        .map((application) => application.kind)
    ).toEqual(['DAMAGE', 'CONDITION_APPLY'])
  })

  it('specializes every direct single group selected by the same result path', () => {
    const base = attackAction()
    const hitPath = attackPaths().find((path) => path.pathCode === PATH_CODE.ON_HIT)
    if (!hitPath) throw new Error('Expected an authored hit path.')
    const paths: EffectPathAuthored<typeof TRIGGER.MELEE_WEAPON_ATTACK, OutcomeAuthored>[] = [
      ...attackPaths(),
      {
        ...hitPath,
        id: 'second-hit-path',
        order: 4,
        resultBlock: {
          id: 'second-hit-result',
          resultKind: 'SINGLE',
          outcomes: [
            {
              id: 'second-hit-condition',
              effectKind: EFFECT_KIND.CONDITION,
              conditionId: CONDITION_ID
            }
          ]
        }
      }
    ]
    const candidate = {
      ...base,
      conditionDefinitionIds: [CONDITION_ID],
      compiledEffect: compileEffect({
        id: EFFECT_ID,
        order: 1,
        invocation: base.compiledEffect.invocation,
        paths
      })
    } as CharacterActionCapabilityDescriptor
    const testTemplate = compileDnd5eEffectActionTestTemplate({
      action: candidate
    })
    const outcome = specializeDnd5eEffectActionOutcome({
      action: candidate,
      testTemplate,
      selectedPath: 'ON_HIT',
      facts: {}
    })
    expect(outcome?.published.definition.nodes.map((node) => node.operation.key)).toEqual([
      'dnd5e.damage-proposal',
      'dnd5e.condition-apply-proposal'
    ])
  })

  it('keeps same-result dice damage outcomes distinct by authored outcome identity', () => {
    const base = diceAttackAction({ dice: '1d6' })
    const compiledEntries = base.compiledEffect.entries.flatMap((entry) => {
      if (entry.pathCode !== PATH_CODE.ON_HIT || !('outcome' in entry)) return [entry]
      return [
        entry,
        {
          ...entry,
          entryId: 'second-damage',
          outcome: {
            ...entry.outcome,
            id: 'second-damage',
            damageTypeId: '00000000-0000-4000-8000-000000000098',
            dice: '1d4'
          }
        }
      ]
    })
    const candidate = {
      ...base,
      compiledEffect: { ...base.compiledEffect, entries: compiledEntries }
    } as CharacterActionCapabilityDescriptor
    const testTemplate = compileDnd5eEffectActionTestTemplate({
      action: candidate
    })
    const outcome = specializeDnd5eEffectActionOutcome({
      action: candidate,
      testTemplate,
      selectedPath: 'ON_HIT',
      facts: {
        resolvedDamageOutcomeExpressions: {
          'damage-0': '1d6 + 2',
          'second-damage': '1d4 + 3'
        }
      }
    })
    expect(
      outcome?.published.definition.nodes
        .filter((node) => node.operation.key === 'dnd5e.damage-proposal')
        .map((node) => node.id)
    ).toEqual(['outcome1-proposal-on_hit', 'outcome2-proposal-on_hit'])
    expect(
      outcome?.published.definition.nodes
        .filter((node) => node.operation.key === 'dnd5e.damage-total')
        .map((node) => node.inputs.modifier)
    ).toEqual([
      { kind: 'LITERAL', value: 2 },
      { kind: 'LITERAL', value: 3 }
    ])
  })

  it('evaluates each critical condition proposal against its own immunity fact', async () => {
    const base = attackAction()
    const paths = attackPaths().map((path) => ({
      ...path,
      resultBlock: {
        ...path.resultBlock,
        outcomes: [
          {
            id: path.pathCode === PATH_CODE.ON_HIT ? 'condition-a' : 'condition-b',
            effectKind: EFFECT_KIND.CONDITION,
            conditionId: path.pathCode === PATH_CODE.ON_HIT ? CONDITION_ID : CONDITION_B_ID
          }
        ]
      }
    }))
    const candidate = {
      ...base,
      conditionDefinitionIds: [CONDITION_ID, CONDITION_B_ID],
      compiledEffect: compileEffect({
        id: EFFECT_ID,
        order: 1,
        invocation: base.compiledEffect.invocation,
        paths
      })
    } as CharacterActionCapabilityDescriptor
    const testTemplate = compileDnd5eEffectActionTestTemplate({
      action: candidate
    })
    const outcome = specializeDnd5eEffectActionOutcome({
      action: candidate,
      testTemplate,
      selectedPath: 'ON_CRIT',
      facts: {}
    })
    if (!outcome) throw new Error('Expected two-condition critical outcome graph.')
    const runtime = createRulesRuntimeService({
      capabilities: [dnd5eEffectActionCapability],
      operations: [dnd5eConditionApplyProposalOperation],
      continuationIntegrityKey: new Uint8Array(32).fill(1),
      definitions: {
        async requireCurrent() {
          throw new Error('Not used.')
        }
      }
    })
    const completed = await runtime.executeResolved({
      command: {
        definitionId: EFFECT_ID,
        occurrenceId: OCCURRENCE_ID,
        facts: {
          [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
          [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: 'a'.repeat(64),
          [DND5E_CONDITION_IMMUNE_FACT_KEYS.ON_HIT]: false,
          [DND5E_CONDITION_IMMUNE_FACT_KEYS.ON_CRIT]: false
        }
      },
      published: outcome.published
    })
    if (completed.status !== 'COMPLETE') throw new Error('Expected complete outcome.')
    const target = {
      execution: completed,
      occurrenceId: OCCURRENCE_ID,
      published: outcome.published,
      targetActorId: ACTOR_ID,
      currentHitPoints: 10,
      temporaryHitPoints: 0,
      maximumHitPoints: 10,
      defenses: []
    }
    const kindsFor = (conditionImmunityIds: readonly string[]) => {
      const execution = {
        ...completed,
        evidence: {
          ...completed.evidence,
          trace: completed.evidence.trace.map((entry) => {
            const conditionId = entry.outputs.conditionId
            return typeof conditionId === 'string'
              ? {
                  ...entry,
                  outputs: {
                    ...entry.outputs,
                    authorized: !conditionImmunityIds.includes(conditionId)
                  }
                }
              : entry
          })
        }
      }
      return dnd5eCharacterRuleActionSystemAdapter
        .interpret({ ...target, execution, conditionImmunityIds })
        .map((application) =>
          application.kind === 'CONDITION_APPLY' ? application.conditionId : application.kind
        )
    }
    expect(kindsFor([CONDITION_ID])).toEqual([CONDITION_B_ID])
    expect(kindsFor([CONDITION_B_ID])).toEqual([CONDITION_ID])
    expect(kindsFor([])).toEqual([CONDITION_ID, CONDITION_B_ID])

    const malformed = {
      ...outcome.published,
      definition: {
        ...outcome.published.definition,
        nodes: outcome.published.definition.nodes.map((node) =>
          node.id === 'proposal-on_crit'
            ? {
                ...node,
                inputs: {
                  ...node.inputs,
                  conditionImmune: {
                    kind: 'FACT' as const,
                    factKey: DND5E_CONDITION_IMMUNE_FACT_KEYS.ON_HIT
                  }
                }
              }
            : node
        )
      }
    }
    expect(() =>
      dnd5eCharacterRuleActionSystemAdapter.interpret({
        ...target,
        published: malformed
      })
    ).toThrow(Dnd5eEffectActionCompilerError)
  })

  it('treats an omitted miss path as terminal and combines hit plus critical results', () => {
    const candidate = attackAction()
    const hitAndCritical = {
      ...candidate,
      compiledEffect: {
        ...candidate.compiledEffect,
        entries: [candidate.compiledEffect.entries[0]!, candidate.compiledEffect.entries[2]!]
      }
    }
    const test = compileDnd5eEffectActionTestTemplate({
      action: hitAndCritical
    })
    expect(
      specializeDnd5eEffectActionOutcome({
        action: hitAndCritical,
        testTemplate: test,
        selectedPath: 'ON_MISS',
        facts: {}
      })
    ).toBeNull()
    const critical = specializeDnd5eEffectActionOutcome({
      action: hitAndCritical,
      testTemplate: test,
      selectedPath: 'ON_CRIT',
      facts: {}
    })
    expect(critical?.published.definition.nodes.map((node) => node.id)).toEqual([
      'proposal-on_hit',
      'proposal-on_crit'
    ])
    expect(() =>
      specializeDnd5eEffectActionOutcome({
        action: hitAndCritical,
        testTemplate: test,
        selectedPath: 'ON_SAVE_SUCCESS',
        facts: {}
      })
    ).toThrow(Dnd5eEffectActionCompilerError)
  })

  it('rejects a reachable test outcome outside the bounded phase compiler', () => {
    const candidate = saveAction([PATH_CODE.ON_SAVE_FAIL])
    const unsupported = {
      ...candidate,
      compiledEffect: compileEffect({
        id: EFFECT_ID,
        order: 1,
        invocation: candidate.compiledEffect.invocation,
        paths: [
          {
            id: 'unsupported-path-id',
            order: 1,
            pathCode: PATH_CODE.ON_SAVE_FAIL,
            groupType: PATH_GROUP_TYPE.SINGLE,
            selectionKind: 'FIXED',
            resultBlock: {
              id: 'unsupported-result-id',
              resultKind: 'SINGLE',
              outcomes: [
                {
                  id: 'unsupported-forced-movement-id',
                  effectKind: EFFECT_KIND.FORCED_MOVEMENT,
                  direction: FORCED_MOVEMENT_DIRECTION.AWAY_FROM_SOURCE,
                  distanceMode: FORCED_MOVEMENT_DISTANCE_MODE.UP_TO_SPEED,
                  actionEconomy: FORCED_MOVEMENT_ACTION_ECONOMY.NONE
                }
              ]
            }
          }
        ]
      })
    }
    expect(() => compileDnd5eEffectActionTestTemplate({ action: unsupported })).toThrow(
      CharacterRuleActionUnsupportedCompilationError
    )
  })

  it('rejects unpinned condition outcomes before publishing the TEST template', () => {
    const candidate = attackAction()
    const unpinnedCondition = {
      ...candidate,
      conditionDefinitionIds: [],
      compiledEffect: {
        ...candidate.compiledEffect,
        entries: candidate.compiledEffect.entries.map((entry) => ({
          ...entry,
          outcome: {
            id: 'condition-id',
            effectKind: EFFECT_KIND.CONDITION,
            conditionId: CONDITION_ID
          }
        }))
      }
    } as CharacterActionCapabilityDescriptor
    expect(() => compileDnd5eEffectActionTestTemplate({ action: unpinnedCondition })).toThrow(
      CharacterRuleActionUnsupportedCompilationError
    )
  })

  it.each([
    ['selection dice', '1d8kh1', 'NONE'],
    ['unsupported breakpoints', '1d8', 'BREAKPOINTS']
  ] as const)('rejects %s before publishing the TEST template', (_label, dice, scalingKind) => {
    const candidate = attackAction()
    const first = candidate.compiledEffect.entries[0]
    if (!first || !('outcome' in first)) throw new Error('Expected an attack outcome.')
    const invalidDice = {
      ...candidate,
      compiledEffect: {
        ...candidate.compiledEffect,
        entries: [
          {
            ...first,
            outcome: {
              ...first.outcome,
              valueKind: 'DICE',
              scalingKind,
              dice
            }
          }
        ]
      }
    } as CharacterActionCapabilityDescriptor
    expect(() => compileDnd5eEffectActionTestTemplate({ action: invalidDice })).toThrow(
      CharacterRuleActionUnsupportedCompilationError
    )
  })

  it('rejects CLASS_LEVEL dice scaling before publishing the TEST template', () => {
    const candidate = attackAction()
    const first = candidate.compiledEffect.entries[0]
    if (!first || !('outcome' in first)) throw new Error('Expected an attack outcome.')
    const classScaled = {
      ...candidate,
      compiledEffect: {
        ...candidate.compiledEffect,
        entries: [
          {
            ...first,
            outcome: {
              ...first.outcome,
              valueKind: 'DICE',
              scalingKind: 'PER_LEVEL',
              scalingSource: 'CLASS_LEVEL',
              classId: '00000000-0000-4000-8000-000000000098',
              level: 1,
              order: 1,
              dice: '1d8'
            }
          }
        ]
      }
    } as CharacterActionCapabilityDescriptor
    expect(() => compileDnd5eEffectActionTestTemplate({ action: classScaled })).toThrow(
      CharacterRuleActionUnsupportedCompilationError
    )
  })

  it('classifies a fully supported fixed action as automatic', () => {
    const candidate = action()
    expect(
      classifyDnd5eCompiledEffectAction({
        gameSystemId: candidate.gameSystemId,
        entryPointDefinitionId: candidate.entryPointDefinitionId,
        effectId: candidate.effectId,
        conditionDefinitionIds: candidate.conditionDefinitionIds,
        savingThrowAbilityDefinitionId: candidate.savingThrowAbilityDefinitionId,
        compiledEffect: candidate.compiledEffect
      })
    ).toBe('AUTOMATIC')
  })
  it('compiles raw Cloaker Bite and Rug Smother relationship plans as exact frozen effects', () => {
    const cloakerSource = relationshipAction({ recurrenceStage: 'NONE' })
    const rugSource = relationshipAction({ recurrenceStage: 'START_OF_TURN' })
    const cloakerPublished = compileDnd5eEffectActionTestTemplate({
      action: cloakerSource
    }).published
    const rugPublished = compileDnd5eEffectActionTestTemplate({
      action: rugSource
    }).published
    const [cloakerPlan] = dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans!({
      action: cloakerSource,
      published: cloakerPublished
    })
    const [rugPlan] = dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans!({
      action: rugSource,
      published: rugPublished
    })

    expect(cloakerPlan).toMatchObject({
      recurrenceStage: 'NONE',
      initialRemaining: null,
      actorRelationshipContribution: {
        relationshipOutcomeId: expect.any(String),
        conditionIds: [],
        capabilitySuppressions: [
          expect.objectContaining({ capabilityDefinitionIds: [REACTION_ELIGIBILITY_ID] })
        ]
      }
    })
    expect(cloakerPlan!.frozenGraph.definition.sourceEntryBindings).toEqual([
      {
        sourceEntryId: cloakerPlan!.compiledEntryId,
        nodeId: cloakerPlan!.frozenGraphNodeId
      }
    ])
    expect(rugPlan).toMatchObject({
      recurrenceStage: 'START_OF_TURN',
      initialRemaining: null,
      actorRelationshipContribution: {
        relationshipOutcomeId: expect.any(String),
        conditionIds: expect.arrayContaining([expect.any(String)]),
        capabilitySuppressions: [
          expect.objectContaining({
            contributionId: expect.any(String),
            capabilityDefinitionIds: [expect.any(String)]
          })
        ]
      }
    })
    expect(rugPlan!.frozenGraph.definition.nodes).toContainEqual(
      expect.objectContaining({
        id: rugPlan!.frozenGraphNodeId,
        operation: {
          key: DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
          contractVersion: 1
        }
      })
    )
  })

  it('retains the exact recurring compiled entry identity for the supported active-effect tracer', () => {
    const candidate = action()
    const recurring = {
      ...candidate,
      compiledEffect: compileEffect({
        id: EFFECT_ID,
        order: 1,
        invocation: {
          kind: 'ACTION',
          triggerCode: TRIGGER.ACTIVATED,
          activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
          range: { id: 'range-id', rangeKind: RANGE_KIND.SELF },
          targeting: { selectionKind: 'SELF' }
        },
        paths: [
          {
            id: 'recurring-path-id',
            order: 1,
            pathCode: PATH_CODE.ON_USE,
            groupType: PATH_GROUP_TYPE.SINGLE,
            selectionKind: 'FIXED',
            resultBlock: {
              id: '00000000-0000-4000-8000-000000000014',
              resultKind: 'SINGLE',
              maintenanceDefinitionId: '00000000-0000-4000-8000-000000000015',
              duration: {
                id: 'round-duration-id',
                durationKind: 'ROUND',
                amount: 2
              },
              lifecycle: { recurringKind: 'START_OF_TURN' },
              outcomes: [
                {
                  id: 'recurring-heal-id',
                  effectKind: EFFECT_KIND.HEAL,
                  valueKind: 'FIXED',
                  scalingKind: 'NONE',
                  amount: 7
                }
              ]
            }
          }
        ]
      })
    }
    const published = compileDnd5eEffectAction({ action: recurring })
    const [plan] = dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans!({
      action: recurring,
      published
    })

    expect(plan).toMatchObject({
      authoredEffectId: EFFECT_ID,
      compiledEntryId: '00000000-0000-4000-8000-000000000014',
      frozenGraphNodeId: 'active_effect_00000000-0000-4000-8000-000000000014',
      capabilityContractVersion: 1,
      recurrenceStage: 'START_OF_TURN',
      initialRemaining: 2,
      adapterFacts: {},
      perceptionContributions: [],
      maintenance: {
        definitionId: '00000000-0000-4000-8000-000000000015',
        definitionChecksum: null,
        owner: 'SOURCE_ACTOR',
        replacementPolicy: 'REPLACE_SAME_DEFINITION',
        emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
      }
    })
    expect(plan!.frozenGraph).toEqual(published)
    expect(published.definition.nodes).toContainEqual(
      expect.objectContaining({ id: plan!.frozenGraphNodeId })
    )
    expect(published.definition.sourceEntryBindings).toEqual([
      {
        sourceEntryId: plan!.compiledEntryId,
        nodeId: plan!.frozenGraphNodeId
      }
    ])
  })

  it('compiles a bounded recurring save tracer with exact UUID ability, DC, and d20 node pins', () => {
    const recurring = {
      ...saveAction([PATH_CODE.ON_SAVE_FAIL]),
      savingThrowAbilityDefinitionId: DEXTERITY_ABILITY_ID,
      mechanicFacts: {
        invocation: {
          triggerCode: TRIGGER.SAVING_THROW,
          activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
          range: { rangeKind: RANGE_KIND.UNLIMITED, amount: null, unit: null },
          savingThrow: {
            dcMethod: 'FIXED_DC',
            abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
            baseDc: 15,
            bonuses: []
          },
          reactionMovementTrigger: null
        },
        outcomes: []
      },
      compiledEffect: compileEffect({
        id: EFFECT_ID,
        order: 1,
        invocation: {
          kind: 'ACTION',
          triggerCode: TRIGGER.SAVING_THROW,
          savingThrow: {
            id: 'save-id',
            abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
            dcMethod: 'FIXED_DC',
            baseDc: 15
          },
          activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
          range: { id: 'range-id', rangeKind: RANGE_KIND.UNLIMITED },
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
        },
        paths: [
          {
            id: 'recurring-save-path',
            order: 1,
            pathCode: PATH_CODE.ON_SAVE_FAIL,
            groupType: PATH_GROUP_TYPE.SINGLE,
            selectionKind: 'FIXED',
            resultBlock: {
              id: '00000000-0000-4000-8000-000000000015',
              resultKind: 'SINGLE',
              duration: { id: 'duration', durationKind: 'ROUND', amount: 2 },
              lifecycle: { recurringKind: 'START_OF_TURN' },
              outcomes: [
                {
                  id: 'damage',
                  effectKind: EFFECT_KIND.DAMAGE,
                  damageTypeId: '00000000-0000-4000-8000-000000000099',
                  valueKind: 'FIXED',
                  scalingKind: 'NONE',
                  amount: 4
                }
              ]
            }
          }
        ]
      })
    } as CharacterActionCapabilityDescriptor
    const published = compileDnd5eEffectAction({ action: recurring })
    const [plan] = dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans!({
      action: recurring,
      published
    })
    expect(plan).toMatchObject({
      compiledEntryId: '00000000-0000-4000-8000-000000000015',
      frozenGraphNodeId: 'proposal-on_save_fail',
      adapterFacts: {
        [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]: DEXTERITY_ABILITY_ID,
        [DND5E_SAVE_DC_FACT_KEY]: 15,
        [DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]: 'd20'
      },
      perceptionContributions: []
    })
    expect(published.definition.sourceEntryBindings).toEqual([
      { sourceEntryId: plan!.compiledEntryId, nodeId: 'proposal-on_save_fail' }
    ])
  })

  it('compiles an immediate repeated follow-up save into a distinct frozen turn graph', () => {
    const repeating = {
      ...nestedSaveAttackAction({
        repeatTiming: 'TARGET_TURN_END',
        repeatCondition: true,
        durationRounds: 2
      }),
      conditionDefinitionIds: [CONDITION_ID]
    }
    const published = compileDnd5eEffectAction({ action: repeating })
    const [plan] = dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans!({
      action: repeating,
      published
    })

    expect(plan).toMatchObject({
      compiledEntryId: '00000000-0000-4000-8000-000000000041',
      frozenGraphNodeId: 'repeat-save-test',
      recurrenceStage: 'END_OF_TURN',
      initialRemaining: 2,
      conditionContribution: { conditionId: CONDITION_ID },
      adapterFacts: {
        [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]: DEXTERITY_ABILITY_ID,
        [DND5E_SAVE_DC_FACT_KEY]: 10,
        [DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]: 'repeat-save-d20'
      }
    })
    expect(plan!.frozenGraph.checksum).not.toBe(published.checksum)
    expect(plan!.frozenGraph.definition.sourceEntryBindings).toEqual([
      { sourceEntryId: plan!.compiledEntryId, nodeId: plan!.frozenGraphNodeId }
    ])
    expect(plan!.frozenGraph.definition.nodes.map((node) => node.id)).toEqual([
      'repeat-save-d20',
      'repeat-save-test'
    ])

    const unsupported = {
      ...repeating,
      compiledEffect: {
        ...repeating.compiledEffect,
        entries: repeating.compiledEffect.entries.map((entry) =>
          'outcome' in entry && entry.outcome.effectKind === EFFECT_KIND.FOLLOW_UP_SAVE
            ? {
                ...entry,
                outcome: {
                  ...entry.outcome,
                  repeatTiming: 'TARGET_TURN_START' as const
                }
              }
            : entry
        )
      }
    }
    expect(
      dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans!({
        action: unsupported,
        published
      })
    ).toEqual([])
  })

  it('compiles a direct failed save condition with one delayed repeat graph', () => {
    const candidate = directRepeatingConditionSaveAction()
    const test = compileDnd5eEffectActionTestTemplate({ action: candidate })
    const failed = specializeDnd5eEffectActionOutcome({
      action: candidate,
      testTemplate: test,
      selectedPath: 'ON_SAVE_FAIL',
      facts: {}
    })
    const succeeded = specializeDnd5eEffectActionOutcome({
      action: candidate,
      testTemplate: test,
      selectedPath: 'ON_SAVE_SUCCESS',
      facts: {}
    })
    if (!failed) throw new Error('Expected the direct failed-save condition outcome.')
    expect(succeeded).toBeNull()
    expect(failed.published.definition.nodes).toHaveLength(1)
    expect(failed.published.definition.nodes[0]).toMatchObject({
      id: 'proposal-on_save_fail',
      operation: { key: DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY }
    })

    const published = compileDnd5eEffectAction({ action: candidate })
    const [plan] = dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans!({
      action: candidate as CharacterActionCapabilityDescriptor,
      published
    })
    expect(plan).toMatchObject({
      compiledEntryId: '00000000-0000-4000-8000-000000000062',
      frozenGraphNodeId: 'repeat-save-test',
      recurrenceStage: 'END_OF_TURN',
      initialRemaining: 10,
      conditionContribution: { conditionId: CONDITION_ID },
      adapterFacts: {
        [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]: DEXTERITY_ABILITY_ID,
        [DND5E_SAVE_DC_FACT_KEY]: 10,
        [DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]: 'repeat-save-d20',
        [DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ROLL_INFLUENCE_FACT_KEY]: 'DISADVANTAGE',
        [DND5E_ACTIVE_EFFECT_REPEAT_SAVE_PERCEPTION_REQUIREMENT_FACT_KEY]: 'SEE'
      },
      perceptionContributions: []
    })
    expect(plan!.frozenGraph.definition.sourceEntryBindings).toEqual([
      { sourceEntryId: plan!.compiledEntryId, nodeId: 'repeat-save-test' }
    ])
  })

  it('binds a recurring perception influence only from current matching perception facts', () => {
    const candidate = directRepeatingConditionSaveAction()
    const published = compileDnd5eEffectAction({ action: candidate })
    const [plan] = dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans!({
      action: candidate,
      published
    })
    if (!plan) throw new Error('Expected a recurring save active-effect plan.')
    const definition = activeRuleEffectDefinitionDtoSchema.parse({
      schemaVersion: 1,
      origin: {
        kind: 'ENCOUNTER',
        sourceAggregateId: EFFECT_ID,
        sourceOccurrenceId: OCCURRENCE_ID,
        rootCommandId: OCCURRENCE_ID,
        sourceActorId: ACTOR_ID
      },
      authoredEffectId: plan.authoredEffectId,
      compiledEntryId: plan.compiledEntryId,
      frozenGraphNodeId: plan.frozenGraphNodeId,
      frozenGraph: {
        schemaVersion: 1,
        source: {
          definitionId: plan.frozenGraph.id,
          gameSystemId: plan.frozenGraph.gameSystemId,
          definitionFamilyKey: plan.frozenGraph.definitionFamilyKey,
          checksum: plan.frozenGraph.checksum
        },
        capabilityContractVersion: plan.capabilityContractVersion,
        factContracts: [],
        nodes: plan.frozenGraph.definition.nodes,
        outputs: plan.frozenGraph.definition.outputs,
        sourceEntryBindings: plan.frozenGraph.definition.sourceEntryBindings
      },
      adapterFacts: plan.adapterFacts,
      perceptionContributions: [],
      recurrence: {
        recurrenceStage: plan.recurrenceStage,
        consumeOnFirstEvent: null,
        endOnEvents: [],
        lifetimeScope: 'ENCOUNTER',
        expiration: {
          kind: 'TICKS',
          initialRemaining: 10,
          decrementStage: 'END_OF_TURN'
        }
      }
    })
    const bind = (input: {
      perception?: {
        requirement: 'SEE' | 'LOCATE'
        satisfied: boolean
        checksum: string
      } | null
      contributors?: readonly {
        sourceId: string
        grantId: string | null
        domainKey: string | null
        influence: 'ADVANTAGE' | 'DISADVANTAGE'
      }[]
    }) =>
      dnd5eCharacterRuleActionSystemAdapter.bindActiveEffectFacts!({
        activeEffectId: EFFECT_ID,
        definition,
        lifecycle: { schemaVersion: 1, remainingTicks: 10 },
        targetActorId: ACTOR_ID,
        targetDerivedFacts: {
          savingThrowDefinitions: [
            {
              abilityDefinitionId: DEXTERITY_ABILITY_ID,
              modifier: 2,
              rollMode: 'NORMAL',
              contributors: input.contributors ?? []
            }
          ]
        },
        targetConditionIds: [],
        currentHitPoints: 5,
        temporaryHitPoints: 0,
        maximumHitPoints: 10,
        targetScalarValues: {},
        defenses: [],
        conditionImmunityIds: [],
        perception: input.perception ?? null
      })

    const satisfied = {
      requirement: 'SEE' as const,
      satisfied: true,
      checksum: 'a'.repeat(64)
    }
    expect(bind({ perception: satisfied }).evidencePolicy).toMatchObject({
      rollMode: 'DISADVANTAGE'
    })
    expect(
      bind({
        perception: satisfied,
        contributors: [
          {
            sourceId: 'existing',
            grantId: null,
            domainKey: null,
            influence: 'ADVANTAGE'
          }
        ]
      }).evidencePolicy
    ).toMatchObject({ rollMode: 'NORMAL' })
    expect(bind({ perception: { ...satisfied, satisfied: false } }).evidencePolicy).toMatchObject({
      rollMode: 'NORMAL',
      contributors: []
    })
    expect(() => bind({})).toThrow('perception facts are unavailable or stale')
    expect(() => bind({ perception: { ...satisfied, requirement: 'LOCATE' } })).toThrow(
      'perception facts are unavailable or stale'
    )
  })

  it('executes the originating repeated follow-up save failure before creating its turn graph', async () => {
    const source = nestedSaveAttackAction({
      repeatTiming: 'TARGET_TURN_END',
      repeatCondition: true,
      durationRounds: 2,
      primaryDice: '1d4',
      failureDice: '2d4'
    })
    const candidate = {
      ...source,
      compiledEffect: {
        ...source.compiledEffect,
        entries: source.compiledEffect.entries.map((entry) =>
          'outcome' in entry && entry.outcome.effectKind === EFFECT_KIND.FOLLOW_UP_SAVE
            ? {
                ...entry,
                outcome: {
                  ...entry.outcome,
                  savingThrow: { ...entry.outcome.savingThrow, baseDc: 10 }
                }
              }
            : entry
        )
      },
      conditionDefinitionIds: [CONDITION_ID]
    }
    const test = compileDnd5eEffectActionTestTemplate({ action: candidate })
    const outcome = specializeDnd5eEffectActionOutcome({
      action: candidate,
      testTemplate: test,
      selectedPath: 'ON_HIT',
      facts: {}
    })
    if (!outcome) throw new Error('Expected the repeated nested-save OUTCOME template.')
    const runtime = createRulesRuntimeService({
      capabilities: [dnd5eEffectActionCapability],
      operations: [
        integerRangeEvidenceRuleOperation,
        addNumbersRuleOperation,
        dnd5eSaveTestOperation,
        dnd5eSaveDamageTotalOperation,
        dnd5eDamageProposalOperation,
        dnd5eTestDamageProposalOperation,
        dnd5eTestConditionProposalOperation
      ],
      continuationIntegrityKey: new Uint8Array(32).fill(32),
      definitions: {
        async requireCurrent() {
          throw new Error('Not used.')
        }
      }
    })
    const resolve = async (occurrenceId: string, saveD20: number) => {
      let result = await runtime.executeResolved({
        command: {
          definitionId: EFFECT_ID,
          occurrenceId,
          facts: {
            [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
            [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: 'a'.repeat(64),
            [DND5E_SAVE_MODIFIER_FACT_KEY]: 0,
            [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: checksumRuleDocument([]),
            [DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY]: false
          }
        },
        published: outcome.published
      })
      while (result.status === 'PAUSED') {
        result = await runtime.resume({
          continuation: result.continuation,
          response: {
            requestId: result.continuation.request.requestId,
            value: result.continuation.request.nodeId === 'nested-save-d20' ? saveD20 : 1
          }
        })
      }
      if (result.status !== 'COMPLETE') throw new Error('Expected completed repeated nested-save.')
      return result
    }
    const failed = await resolve(OCCURRENCE_ID, 1)
    const succeeded = await resolve('00000000-0000-4000-8000-000000000017', 20)
    expect(failed.evidence.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nodeId: 'proposal-on_hit' }),
        expect.objectContaining({
          nodeId: 'nested-save-proposal',
          outputs: expect.objectContaining({ amount: 2 })
        }),
        expect.objectContaining({
          nodeId: 'nested-save-condition',
          outputs: expect.objectContaining({ authorized: true })
        })
      ])
    )
    expect(succeeded.evidence.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'nested-save-proposal',
          outputs: expect.objectContaining({ amount: 2, authorized: false })
        }),
        expect.objectContaining({
          nodeId: 'nested-save-condition',
          outputs: expect.objectContaining({ authorized: false })
        })
      ])
    )
  })

  it('compiles and resolves raw SRD Quasit Claws as primary damage plus one repeatable save', async () => {
    const candidate = quasitClawsAction()
    expect(candidate.compiledEffect.entries).toMatchObject([
      { outcome: { effectKind: 'DAMAGE', dice: '1d4' } },
      {
        outcome: {
          effectKind: 'FOLLOW_UP_SAVE',
          timing: 'IMMEDIATE',
          repeatTiming: 'TARGET_TURN_END',
          attempts: { kind: 'ONCE', repeatOnFailure: true },
          onFailure: {
            resultKind: 'SINGLE',
            outcomes: [{ effectKind: 'DAMAGE', dice: '2d4' }, { effectKind: 'CONDITION' }]
          }
        }
      }
    ])
    const test = compileDnd5eEffectActionTestTemplate({ action: candidate })
    const primaryEntry = candidate.compiledEffect.entries[0]
    if (!primaryEntry || !('outcome' in primaryEntry))
      throw new Error('Expected Quasit Claws primary damage.')
    const outcome = specializeDnd5eEffectActionOutcome({
      action: candidate,
      testTemplate: test,
      selectedPath: 'ON_HIT',
      facts: {
        resolvedDamageOutcomeExpressions: {
          [primaryEntry.outcome.id]: '1d4 + 3'
        }
      }
    })
    if (!outcome) throw new Error('Expected the Quasit Claws OUTCOME template.')
    expect(outcome.published.definition.nodes.map((node) => node.id)).toEqual([
      'die-1',
      'damage-total',
      'proposal-on_hit',
      'nested-save-d20',
      'nested-save-test',
      'nested-save-die-1',
      'nested-save-die-2',
      'nested-save-sum-1',
      'nested-save-proposal',
      'nested-save-condition'
    ])
    expect(outcome.published.definition.sourceEntryBindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nodeId: 'proposal-on_hit' }),
        expect.objectContaining({ nodeId: 'nested-save-proposal' }),
        expect.objectContaining({ nodeId: 'nested-save-condition' })
      ])
    )

    const followUpSave = candidate.compiledEffect.entries[1]
    if (!followUpSave || !('outcome' in followUpSave))
      throw new Error('Expected the Quasit Claws follow-up save.')
    expect(followUpSave.outcome).toMatchObject({
      effectKind: 'FOLLOW_UP_SAVE',
      onFailure: {
        outcomes: [
          { effectKind: 'DAMAGE' },
          { effectKind: 'CONDITION', conditionId: expect.any(String) }
        ]
      }
    })
    if (followUpSave.outcome.effectKind !== 'FOLLOW_UP_SAVE')
      throw new Error('Expected the Quasit Claws follow-up save.')
    const condition = followUpSave.outcome.onFailure
    if (condition.kind !== 'OUTCOMES' || condition.outcomes[1]?.effectKind !== 'CONDITION')
      throw new Error('Expected the Quasit Claws poisoned condition.')
    expect(candidate.conditionDefinitionIds).toContain(condition.outcomes[1].conditionId)

    const [plan] = dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans!({
      action: candidate,
      published: compileDnd5eEffectAction({ action: candidate })
    })
    expect(plan).toMatchObject({
      recurrenceStage: 'END_OF_TURN',
      initialRemaining: null,
      conditionContribution: expect.any(Object),
      adapterFacts: expect.objectContaining({
        [DND5E_SAVE_DC_FACT_KEY]: 10,
        [DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]: 'repeat-save-d20'
      })
    })

    const runtime = createRulesRuntimeService({
      capabilities: [dnd5eEffectActionCapability],
      operations: [
        integerRangeEvidenceRuleOperation,
        addNumbersRuleOperation,
        dnd5eSaveTestOperation,
        dnd5eDamageTotalOperation,
        dnd5eDamageProposalOperation,
        dnd5eTestDamageProposalOperation,
        dnd5eTestConditionProposalOperation
      ],
      continuationIntegrityKey: new Uint8Array(32).fill(33),
      definitions: {
        async requireCurrent() {
          throw new Error('Not used.')
        }
      }
    })
    const resolve = async (occurrenceId: string, saveD20: number) => {
      let result = await runtime.executeResolved({
        command: {
          definitionId: candidate.effectId,
          occurrenceId,
          facts: {
            [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
            [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: 'a'.repeat(64),
            [DND5E_SAVE_MODIFIER_FACT_KEY]: 0,
            [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: checksumRuleDocument([]),
            [DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY]: false
          }
        },
        published: outcome.published
      })
      while (result.status === 'PAUSED') {
        result = await runtime.resume({
          continuation: result.continuation,
          response: {
            requestId: result.continuation.request.requestId,
            value:
              result.continuation.request.nodeId === 'nested-save-d20'
                ? saveD20
                : result.continuation.request.nodeId === 'die-1'
                  ? 1
                  : 1
          }
        })
      }
      if (result.status !== 'COMPLETE') throw new Error('Expected completed Quasit Claws outcome.')
      return result
    }

    const failed = await resolve(OCCURRENCE_ID, 1)
    const succeeded = await resolve('00000000-0000-4000-8000-000000000017', 20)
    const traceEntry = (trace: readonly ServerRuleExecutionTraceEntryDto[], nodeId: string) =>
      trace.find((entry) => entry.nodeId === nodeId)
    expect(traceEntry(failed.evidence.trace, 'proposal-on_hit')?.outputs).toMatchObject({
      amount: 4
    })
    expect(traceEntry(failed.evidence.trace, 'nested-save-proposal')?.outputs).toMatchObject({
      amount: 2,
      authorized: true
    })
    expect(traceEntry(failed.evidence.trace, 'nested-save-condition')?.outputs).toMatchObject({
      authorized: true
    })
    expect(traceEntry(succeeded.evidence.trace, 'nested-save-proposal')?.outputs).toMatchObject({
      authorized: false
    })
    expect(traceEntry(succeeded.evidence.trace, 'nested-save-condition')?.outputs).toMatchObject({
      authorized: false
    })
  })

  it('rejects a maintenance identity without a supported recurring active-effect plan', () => {
    const candidate = action()
    const unsupportedMaintenance = {
      ...candidate,
      compiledEffect: compileEffect({
        id: EFFECT_ID,
        order: 1,
        invocation: {
          kind: 'ACTION',
          triggerCode: TRIGGER.ACTIVATED,
          activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
          range: { id: 'range-id', rangeKind: RANGE_KIND.SELF },
          targeting: { selectionKind: 'SELF' }
        },
        paths: [
          {
            id: 'maintenance-path-id',
            order: 1,
            pathCode: PATH_CODE.ON_USE,
            groupType: PATH_GROUP_TYPE.SINGLE,
            selectionKind: 'FIXED',
            resultBlock: {
              id: '00000000-0000-4000-8000-000000000016',
              resultKind: 'SINGLE',
              maintenanceDefinitionId: '00000000-0000-4000-8000-000000000017',
              outcomes: [
                {
                  id: 'maintenance-heal-id',
                  effectKind: EFFECT_KIND.HEAL,
                  valueKind: 'FIXED',
                  scalingKind: 'NONE',
                  amount: 7
                }
              ]
            }
          }
        ]
      })
    }

    expect(() => compileDnd5eEffectAction({ action: unsupportedMaintenance })).toThrow(
      CharacterRuleActionUnsupportedCompilationError
    )
  })

  it('compiles one d20 attack test and applies ordered hit plus critical proposals', async () => {
    const published = compileDnd5eEffectAction({ action: attackAction() })
    expect(published.definition.nodes.map((node) => node.operation.key)).toEqual([
      'evidence.integer-range',
      DND5E_ATTACK_TEST_OPERATION_KEY,
      'dnd5e.test-damage-proposal',
      'dnd5e.test-damage-proposal',
      'dnd5e.test-damage-proposal'
    ])
    const runtime = createRulesRuntimeService({
      capabilities: [dnd5eEffectActionCapability],
      operations: [
        integerRangeEvidenceRuleOperation,
        dnd5eAttackTestOperation,
        dnd5eDamageProposalOperation,
        dnd5eTestDamageProposalOperation
      ],
      continuationIntegrityKey: new Uint8Array(32).fill(1),
      definitions: {
        async requireCurrent() {
          throw new Error('Not used.')
        }
      }
    })
    const started = await runtime.executeResolved({
      command: {
        definitionId: EFFECT_ID,
        occurrenceId: OCCURRENCE_ID,
        facts: {
          [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
          [DND5E_ATTACK_MODIFIER_FACT_KEY]: 2,
          [DND5E_TARGET_DEFENSE_FACT_KEY]: 30,
          [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: checksumRuleDocument([]),
          [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: 'a'.repeat(64)
        }
      },
      published
    })
    if (started.status !== 'PAUSED') throw new Error('Expected selected d20 evidence.')
    const completed = await runtime.resume({
      continuation: started.continuation,
      response: {
        requestId: started.continuation.request.requestId,
        value: 20
      }
    })
    if (completed.status !== 'COMPLETE') throw new Error('Expected completed attack.')
    expect(
      dnd5eCharacterRuleActionSystemAdapter
        .interpret({
          execution: completed,
          occurrenceId: OCCURRENCE_ID,
          published,
          targetActorId: ACTOR_ID,
          currentHitPoints: 10,
          temporaryHitPoints: 0,
          maximumHitPoints: 10,
          defenses: []
        })
        .map((outcome) => outcome.kind)
    ).toEqual(['DAMAGE', 'DAMAGE'])
  })

  it('compiles an exact movement-bound reaction through the ordinary attack graph', () => {
    const published = compileDnd5eEffectAction({
      action: movementReactionAttackAction()
    })
    expect(published.definition.nodes.map((node) => node.operation.key)).toEqual([
      'evidence.integer-range',
      DND5E_ATTACK_TEST_OPERATION_KEY,
      'dnd5e.test-damage-proposal',
      'dnd5e.test-damage-proposal',
      'dnd5e.test-damage-proposal'
    ])

    expect(() =>
      compileDnd5eEffectAction({
        action: movementReactionAttackAction({ bound: false })
      })
    ).toThrow(CharacterRuleActionUnsupportedCompilationError)
  })

  it('binds an explicit movement STOP output only for the authored reaction binding', () => {
    const omitted = compileDnd5eEffectAction({
      action: movementReactionAttackAction()
    })
    const stopped = compileDnd5eEffectAction({
      action: movementReactionAttackAction({
        movementInterruption: {
          kind: 'STOP',
          whenResultPath: PATH_CODE.ON_HIT
        }
      })
    })

    expect(omitted.definition.outputs.movementInterruption).toBeUndefined()
    expect(stopped.definition.outputs.movementInterruption).toEqual({
      kind: 'NODE_OUTPUT',
      nodeId: 'proposal-on_hit',
      port: 'authorized'
    })
  })

  it('rejects a movement STOP binding without an exact authored proposal path', () => {
    expect(() =>
      compileDnd5eEffectAction({
        action: movementReactionAttackAction({
          movementInterruption: {
            kind: 'STOP',
            whenResultPath: PATH_CODE.ON_SAVE_FAIL
          }
        })
      })
    ).toThrow('Movement interruption must bind one exact D&D test proposal path.')
  })

  it('emits STOP authorization only for the bound hit path, including a critical hit', async () => {
    const candidate = movementReactionAttackAction({
      movementInterruption: { kind: 'STOP', whenResultPath: PATH_CODE.ON_HIT }
    })
    const facts = {
      [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
      [DND5E_ATTACK_MODIFIER_FACT_KEY]: 2,
      [DND5E_TARGET_DEFENSE_FACT_KEY]: 10
    }
    const miss = await resolveTest(candidate, facts, 1)
    const hit = await resolveTest(candidate, facts, 8)
    const critical = await resolveTest(candidate, facts, 20)

    expect(miss.completed.outputs.movementInterruption).toBe(false)
    expect(hit.completed.outputs.movementInterruption).toBe(true)
    expect(critical.completed.outputs.movementInterruption).toBe(true)
  })

  it('validates test-condition proposals against the pinned condition vocabulary', () => {
    const candidate = attackAction()
    const conditionCandidate = {
      ...candidate,
      conditionDefinitionIds: [CONDITION_ID],
      compiledEffect: {
        ...candidate.compiledEffect,
        entries: candidate.compiledEffect.entries.map((entry) => ({
          ...entry,
          outcome: {
            id: 'condition',
            effectKind: EFFECT_KIND.CONDITION,
            conditionId: CONDITION_ID
          }
        }))
      }
    } as CharacterActionCapabilityDescriptor
    const published = compileDnd5eEffectAction({ action: conditionCandidate })
    expect(
      dnd5eCharacterRuleActionSystemAdapter.requiresConditionDefinitionValidation?.({ published })
    ).toBe(true)
    expect(() =>
      dnd5eCharacterRuleActionSystemAdapter.validateConditionDefinitions?.({
        conditionDefinitionIds: [CONDITION_ID],
        published
      })
    ).not.toThrow()
    expect(() =>
      dnd5eCharacterRuleActionSystemAdapter.validateConditionDefinitions?.({
        conditionDefinitionIds: [],
        published
      })
    ).toThrow(Dnd5eEffectActionCompilerError)
  })

  it.each([
    [
      'attack hit',
      attackAction(),
      12,
      DND5E_ATTACK_MODIFIER_FACT_KEY,
      DND5E_TARGET_DEFENSE_FACT_KEY,
      ['DAMAGE']
    ],
    [
      'attack miss',
      attackAction(),
      2,
      DND5E_ATTACK_MODIFIER_FACT_KEY,
      DND5E_TARGET_DEFENSE_FACT_KEY,
      ['DAMAGE']
    ],
    [
      'natural one always misses',
      attackAction(),
      1,
      DND5E_ATTACK_MODIFIER_FACT_KEY,
      DND5E_TARGET_DEFENSE_FACT_KEY,
      ['DAMAGE']
    ],
    [
      'save failure',
      saveAction(),
      8,
      DND5E_SAVE_MODIFIER_FACT_KEY,
      DND5E_SAVE_DC_FACT_KEY,
      ['DAMAGE']
    ],
    [
      'save success',
      saveAction(),
      18,
      DND5E_SAVE_MODIFIER_FACT_KEY,
      DND5E_SAVE_DC_FACT_KEY,
      ['DAMAGE']
    ]
  ])(
    '%s selects only the authorized authored branch',
    async (_label, candidate, die, modifierKey, thresholdKey, expected) => {
      const { published, completed } = await resolveTest(
        candidate,
        {
          [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
          [modifierKey]: 2,
          [thresholdKey]: 15
        },
        die
      )
      expect(
        dnd5eCharacterRuleActionSystemAdapter
          .interpret({
            execution: completed,
            occurrenceId: OCCURRENCE_ID,
            published,
            targetActorId: ACTOR_ID,
            currentHitPoints: 10,
            temporaryHitPoints: 0,
            maximumHitPoints: 10,
            defenses: []
          })
          .map((outcome) => outcome.kind)
      ).toEqual(expected)
    }
  )

  it('allows a save graph to omit its optional opposite branch', async () => {
    const { published, completed } = await resolveTest(
      saveAction([PATH_CODE.ON_SAVE_FAIL]),
      {
        [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
        [DND5E_SAVE_MODIFIER_FACT_KEY]: 2,
        [DND5E_SAVE_DC_FACT_KEY]: 5
      },
      18
    )
    expect(
      dnd5eCharacterRuleActionSystemAdapter.interpret({
        execution: completed,
        occurrenceId: OCCURRENCE_ID,
        published,
        targetActorId: ACTOR_ID,
        currentHitPoints: 10,
        temporaryHitPoints: 0,
        maximumHitPoints: 10,
        defenses: []
      })
    ).toEqual([])
  })

  it('derives only an authorized successful-save branch from immutable failed-save evidence', async () => {
    const { published, completed } = await resolveTest(
      saveAction(),
      {
        [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
        [DND5E_SAVE_MODIFIER_FACT_KEY]: 2,
        [DND5E_SAVE_DC_FACT_KEY]: 15
      },
      10
    )
    const originalEvidence = structuredClone(completed.evidence)
    expect(
      dnd5eCharacterRuleActionSystemAdapter.interpretSaveSuccessReplacement?.({
        execution: completed,
        occurrenceId: OCCURRENCE_ID,
        published,
        targetActorId: ACTOR_ID,
        currentHitPoints: 10,
        temporaryHitPoints: 0,
        maximumHitPoints: 10,
        defenses: [],
        replacement: {
          lifecycle: {
            definitionId: '00000000-0000-4000-8000-000000000301',
            definitionVersion: 1,
            definitionChecksum: 'a'.repeat(64),
            choiceGraphDefinitionId: '00000000-0000-4000-8000-000000000302',
            choiceGraphDefinitionVersion: 1,
            choiceGraphDefinitionChecksum: 'b'.repeat(64),
            useOutput: 'use',
            interruptedStage: 'AFTER_FAILED_SAVE_BEFORE_OUTCOME',
            replacement: 'SAVE_SUCCESS'
          }
        }
      })
    ).toMatchObject([{ kind: 'DAMAGE', requestedAmount: 2, resolvedPath: 'ON_SAVE_SUCCESS' }])
    expect(completed.evidence).toEqual(originalEvidence)
  })

  it.each([
    ['attack', attackAction(), 10],
    ['successful save', saveAction(), 20]
  ])(
    'rejects a Legendary Resistance replacement from a completed %s',
    async (_label, candidate, naturalD20) => {
      const facts: Record<string, string | number> =
        candidate.compiledEffect.invocation.triggerCode === TRIGGER.SAVING_THROW
          ? {
              [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
              [DND5E_SAVE_MODIFIER_FACT_KEY]: 2,
              [DND5E_SAVE_DC_FACT_KEY]: 15
            }
          : {
              [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
              [DND5E_ATTACK_MODIFIER_FACT_KEY]: 2,
              [DND5E_TARGET_DEFENSE_FACT_KEY]: 10
            }
      const { published, completed } = await resolveTest(candidate, facts, naturalD20)
      expect(() =>
        dnd5eCharacterRuleActionSystemAdapter.interpretSaveSuccessReplacement?.({
          execution: completed,
          occurrenceId: OCCURRENCE_ID,
          published,
          targetActorId: ACTOR_ID,
          currentHitPoints: 10,
          temporaryHitPoints: 0,
          maximumHitPoints: 10,
          defenses: [],
          replacement: {
            lifecycle: {
              definitionId: '00000000-0000-4000-8000-000000000301',
              definitionVersion: 1,
              definitionChecksum: 'a'.repeat(64),
              choiceGraphDefinitionId: '00000000-0000-4000-8000-000000000302',
              choiceGraphDefinitionVersion: 1,
              choiceGraphDefinitionChecksum: 'b'.repeat(64),
              useOutput: 'use',
              interruptedStage: 'AFTER_FAILED_SAVE_BEFORE_OUTCOME',
              replacement: 'SAVE_SUCCESS'
            }
          }
        })
      ).toThrow('save-success replacement')
    }
  )

  it('does not create a second base application for a natural twenty with only ON_HIT', async () => {
    const candidate = attackAction()
    const hitOnly = {
      ...candidate,
      compiledEffect: {
        ...candidate.compiledEffect,
        entries: [candidate.compiledEffect.entries[0]!]
      }
    }
    const { published, completed } = await resolveTest(
      hitOnly,
      {
        [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
        [DND5E_ATTACK_MODIFIER_FACT_KEY]: 2,
        [DND5E_TARGET_DEFENSE_FACT_KEY]: 10
      },
      20
    )
    expect(
      dnd5eCharacterRuleActionSystemAdapter.interpret({
        execution: completed,
        occurrenceId: OCCURRENCE_ID,
        published,
        targetActorId: ACTOR_ID,
        currentHitPoints: 10,
        temporaryHitPoints: 0,
        maximumHitPoints: 10,
        defenses: []
      })
    ).toHaveLength(1)
  })

  it('applies ON_HIT then ON_CRIT from a natural twenty against sequential hit-point state', async () => {
    const { published, completed } = await resolveTest(
      attackAction(),
      {
        [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
        [DND5E_ATTACK_MODIFIER_FACT_KEY]: 2,
        [DND5E_TARGET_DEFENSE_FACT_KEY]: 10
      },
      20
    )
    expect(
      dnd5eCharacterRuleActionSystemAdapter.interpret({
        execution: completed,
        occurrenceId: OCCURRENCE_ID,
        published,
        targetActorId: ACTOR_ID,
        currentHitPoints: 10,
        temporaryHitPoints: 0,
        maximumHitPoints: 10,
        defenses: []
      })
    ).toMatchObject([
      { kind: 'DAMAGE', beforeCurrentHitPoints: 10, afterCurrentHitPoints: 9 },
      { kind: 'DAMAGE', beforeCurrentHitPoints: 9, afterCurrentHitPoints: 6 }
    ])
  })

  it.each([
    [
      'missing branch trace',
      (trace: readonly ServerRuleExecutionTraceEntryDto[]) => trace.slice(0, -1)
    ],
    [
      'duplicate branch trace',
      (trace: readonly ServerRuleExecutionTraceEntryDto[]) => [...trace, trace[trace.length - 1]!]
    ],
    [
      'extra branch trace',
      (trace: readonly ServerRuleExecutionTraceEntryDto[]) => [
        ...trace,
        { ...trace[trace.length - 1]!, nodeId: 'extra' }
      ]
    ],
    [
      'wrong test node',
      (trace: readonly ServerRuleExecutionTraceEntryDto[]) =>
        trace.map((entry, index) => (index === 1 ? { ...entry, nodeId: 'wrong-test' } : entry))
    ],
    [
      'wrong attack modifier fact',
      (trace: readonly ServerRuleExecutionTraceEntryDto[]) =>
        trace.map((entry, index) =>
          index === 1 ? { ...entry, inputs: { ...entry.inputs, modifier: 99 } } : entry
        )
    ],
    [
      'wrong target defense fact',
      (trace: readonly ServerRuleExecutionTraceEntryDto[]) =>
        trace.map((entry, index) =>
          index === 1 ? { ...entry, inputs: { ...entry.inputs, threshold: 99 } } : entry
        )
    ],
    [
      'wrong selected d20 value',
      (trace: readonly ServerRuleExecutionTraceEntryDto[]) =>
        trace.map((entry, index) =>
          index === 0 ? { ...entry, evidence: { ...entry.evidence!, value: 19 } } : entry
        )
    ],
    [
      'wrong d20 request identity',
      (trace: readonly ServerRuleExecutionTraceEntryDto[]) =>
        trace.map((entry, index) =>
          index === 0
            ? {
                ...entry,
                evidence: { ...entry.evidence!, requestId: 'wrong-request' }
              }
            : entry
        )
    ],
    [
      'wrong d20 bounds',
      (trace: readonly ServerRuleExecutionTraceEntryDto[]) =>
        trace.map((entry, index) =>
          index === 0 ? { ...entry, inputs: { ...entry.inputs, max: 19 } } : entry
        )
    ],
    [
      'wrong target',
      (trace: readonly ServerRuleExecutionTraceEntryDto[]) =>
        trace.map((entry, index) =>
          index === 2
            ? {
                ...entry,
                outputs: { ...entry.outputs, targetActorId: EFFECT_ID }
              }
            : entry
        )
    ],
    [
      'wrong resolved path',
      (trace: readonly ServerRuleExecutionTraceEntryDto[]) =>
        trace.map((entry, index) =>
          index === 2 ? { ...entry, inputs: { ...entry.inputs, resolvedPath: 'ON_MISS' } } : entry
        )
    ],
    [
      'wrong amount literal',
      (trace: readonly ServerRuleExecutionTraceEntryDto[]) =>
        trace.map((entry, index) =>
          index === 2 ? { ...entry, inputs: { ...entry.inputs, amount: 99 } } : entry
        )
    ],
    [
      'wrong damage identity',
      (trace: readonly ServerRuleExecutionTraceEntryDto[]) =>
        trace.map((entry, index) =>
          index === 2
            ? {
                ...entry,
                outputs: { ...entry.outputs, damageTypeId: EFFECT_ID }
              }
            : entry
        )
    ],
    [
      'wrong authored path literal',
      (trace: readonly ServerRuleExecutionTraceEntryDto[]) =>
        trace.map((entry, index) =>
          index === 2 ? { ...entry, inputs: { ...entry.inputs, authoredPath: 'ON_MISS' } } : entry
        )
    ],
    [
      'wrong authored path output',
      (trace: readonly ServerRuleExecutionTraceEntryDto[]) =>
        trace.map((entry, index) =>
          index === 2
            ? {
                ...entry,
                outputs: { ...entry.outputs, authoredPath: 'ON_MISS' }
              }
            : entry
        )
    ]
  ])('rejects %s in a committed test trace', async (_label, mutate) => {
    const { published, completed } = await resolveTest(
      attackAction(),
      {
        [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
        [DND5E_ATTACK_MODIFIER_FACT_KEY]: 2,
        [DND5E_TARGET_DEFENSE_FACT_KEY]: 10
      },
      20
    )
    const malformed = {
      ...completed,
      evidence: {
        ...completed.evidence,
        trace: mutate(completed.evidence.trace)
      }
    }
    expect(() =>
      dnd5eCharacterRuleActionSystemAdapter.interpret({
        execution: malformed,
        occurrenceId: OCCURRENCE_ID,
        published,
        targetActorId: ACTOR_ID,
        currentHitPoints: 10,
        temporaryHitPoints: 0,
        maximumHitPoints: 10,
        defenses: []
      })
    ).toThrow(Dnd5eEffectActionCompilerError)
  })
  it.each([
    ['save modifier', 'modifier'],
    ['save DC', 'threshold']
  ])('rejects a committed %s that differs from locked facts', async (_label, port) => {
    const { published, completed } = await resolveTest(
      saveAction(),
      {
        [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
        [DND5E_SAVE_MODIFIER_FACT_KEY]: 2,
        [DND5E_SAVE_DC_FACT_KEY]: 15
      },
      8
    )
    const malformed = {
      ...completed,
      evidence: {
        ...completed.evidence,
        trace: completed.evidence.trace.map((entry, index) =>
          index === 1 ? { ...entry, inputs: { ...entry.inputs, [port]: 99 } } : entry
        )
      }
    }
    expect(() =>
      dnd5eCharacterRuleActionSystemAdapter.interpret({
        execution: malformed,
        occurrenceId: OCCURRENCE_ID,
        published,
        targetActorId: ACTOR_ID,
        currentHitPoints: 10,
        temporaryHitPoints: 0,
        maximumHitPoints: 10,
        defenses: []
      })
    ).toThrow(Dnd5eEffectActionCompilerError)
  })
  it('compiles the exact fixed self-heal into a D&D proposal graph and executes it', async () => {
    const published = compileDnd5eEffectAction({ action: action() })
    expect(published).toMatchObject({
      id: EFFECT_ID,
      gameSystemId: DND5E_SYSTEM_ID,
      definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
      definition: { id: EFFECT_ID }
    })
    expect(published.checksum).toBe(checksumRuleDocument(published.definition))

    const runtime = createRulesRuntimeService({
      capabilities: [dnd5eEffectActionCapability],
      operations: [dnd5eHealProposalOperation],
      continuationIntegrityKey: new Uint8Array(32).fill(1),
      definitions: {
        async requireCurrent() {
          throw new Error('Not used.')
        }
      }
    })
    await expect(
      runtime.executeResolved({
        command: {
          definitionId: EFFECT_ID,
          occurrenceId: OCCURRENCE_ID,
          facts: {
            [DND5E_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
            [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: 'a'.repeat(64)
          }
        },
        published
      })
    ).resolves.toMatchObject({
      status: 'COMPLETE',
      outputs: { targetActorId: ACTOR_ID, amount: 7 },
      evidence: {
        trace: [
          expect.objectContaining({
            operation: { key: 'dnd5e.heal-proposal', contractVersion: 1 },
            outputs: {
              targetActorId: ACTOR_ID,
              amount: 7,
              applicationCandidate: true,
              authorized: true,
              targetStateChecksum: 'a'.repeat(64)
            }
          })
        ]
      }
    })
  })

  it('compiles the bounded unlimited ANY single-target action without broadening target policy', () => {
    const candidate = action()
    const published = compileDnd5eEffectAction({
      action: {
        ...candidate,
        compiledEffect: {
          ...candidate.compiledEffect,
          invocation: {
            ...candidate.compiledEffect.invocation,
            range: { id: 'target-range-id', rangeKind: RANGE_KIND.UNLIMITED },
            targeting: {
              selectionKind: 'SINGLE_TARGET',
              dispositionKind: 'ANY'
            }
          }
        }
      }
    })

    expect(published.definition.outputs).toMatchObject({
      targetActorId: expect.any(Object)
    })
  })

  it.each([
    [
      'temporary hit points',
      { effectKind: EFFECT_KIND.HEAL, temporary: true },
      'dnd5e.temporary-hit-points-proposal'
    ],
    [
      'typed damage',
      {
        effectKind: EFFECT_KIND.DAMAGE,
        damageTypeId: '00000000-0000-4000-8000-000000000099'
      },
      'dnd5e.damage-proposal'
    ]
  ])('compiles fixed %s as its closed proposal operation', (_label, patch, operation) => {
    const candidate = action()
    const published = compileDnd5eEffectAction({
      action: {
        ...candidate,
        compiledEffect: {
          ...candidate.compiledEffect,
          entries: [
            {
              ...directEntry(candidate),
              outcome: { ...directEntry(candidate).outcome, ...patch }
            }
          ]
        }
      } as CharacterActionCapabilityDescriptor
    })
    expect(published.definition.nodes[0]?.operation.key).toBe(operation)
  })

  it('executes a bonus-action dice heal with its locked resolved modifier', async () => {
    const base = action()
    const entry = directEntry(base)
    const candidate = {
      ...base,
      compiledEffect: {
        ...base.compiledEffect,
        invocation: {
          ...base.compiledEffect.invocation,
          activation: { code: ACTIVATION_CODE.BONUS_ACTION, amount: 1 }
        },
        entries: [
          {
            ...entry,
            outcome: {
              id: 'heal-id',
              effectKind: EFFECT_KIND.HEAL,
              valueKind: 'DICE',
              scalingKind: 'NONE',
              diceConfig: '1d10',
              bonuses: [
                {
                  id: 'class-level-bonus',
                  bonusKind: 'CLASS_LEVEL',
                  classId: '00000000-0000-4000-8000-000000000020',
                  order: 1
                }
              ]
            }
          }
        ]
      }
    } as CharacterActionCapabilityDescriptor
    const published = compileDnd5eEffectAction({ action: candidate })
    expect(published.definition.nodes.map((node) => node.operation.key)).toEqual([
      'evidence.integer-range',
      'dnd5e.heal-total',
      'dnd5e.heal-proposal'
    ])
    const bound = dnd5eCharacterRuleActionSystemAdapter.bindFacts({
      actionMechanic: {
        attackBonus: null,
        attackKind: null,
        attackRollMode: 'NORMAL',
        save: null,
        outcomes: [
          {
            kind: 'HEAL',
            outcomeId: 'heal-id',
            pathCode: 'ON_USE',
            expression: '1d10 + 4',
            temporary: false,
            scaling: []
          }
        ]
      },
      published,
      sourceDerivedFacts: {},
      targetActorId: ACTOR_ID,
      targetDerivedFacts: {},
      targetConditionIds: [],
      currentHitPoints: 4,
      temporaryHitPoints: 0,
      maximumHitPoints: 20,
      targetScalarValues: {},
      defenses: []
    })
    expect(bound.facts[DND5E_RESOLVED_HEAL_MODIFIER_FACT_KEY]).toBe(4)
    expect(() =>
      dnd5eCharacterRuleActionSystemAdapter.bindFacts({
        actionMechanic: {
          attackBonus: null,
          attackKind: null,
          attackRollMode: 'NORMAL',
          save: null,
          outcomes: [
            {
              kind: 'HEAL',
              outcomeId: 'heal-id',
              pathCode: 'ON_USE',
              expression: '2d10 + 4',
              temporary: false,
              scaling: []
            }
          ]
        },
        published,
        sourceDerivedFacts: {},
        targetActorId: ACTOR_ID,
        targetDerivedFacts: {},
        targetConditionIds: [],
        currentHitPoints: 4,
        temporaryHitPoints: 0,
        maximumHitPoints: 20,
        targetScalarValues: {},
        defenses: []
      })
    ).toThrow(Dnd5eEffectActionCompilerError)
    const runtime = createRulesRuntimeService({
      capabilities: [dnd5eEffectActionCapability],
      operations: [
        integerRangeEvidenceRuleOperation,
        dnd5eHealTotalOperation,
        dnd5eHealProposalOperation
      ],
      continuationIntegrityKey: new Uint8Array(32).fill(1),
      definitions: {
        async requireCurrent() {
          throw new Error('Not used.')
        }
      }
    })
    const started = await runtime.executeResolved({
      command: {
        definitionId: EFFECT_ID,
        occurrenceId: OCCURRENCE_ID,
        facts: bound.facts
      },
      published
    })
    if (started.status !== 'PAUSED') throw new Error('Expected exact healing die request.')
    const completed = await runtime.resume({
      continuation: started.continuation,
      response: { requestId: started.continuation.request.requestId, value: 6 }
    })
    expect(completed.status).toBe('COMPLETE')
    if (completed.status === 'COMPLETE') expect(completed.outputs.amount).toBe(10)
  })

  it('compiles a pinned direct self condition application', () => {
    const candidate = action()
    const published = compileDnd5eEffectAction({
      action: {
        ...candidate,
        conditionDefinitionIds: [CONDITION_ID],
        compiledEffect: {
          ...candidate.compiledEffect,
          entries: [
            {
              ...directEntry(candidate),
              outcome: {
                id: 'condition-id',
                effectKind: EFFECT_KIND.CONDITION,
                conditionId: CONDITION_ID
              }
            }
          ]
        }
      } as CharacterActionCapabilityDescriptor
    })
    expect(published.definition.nodes[0]?.operation.key).toBe('dnd5e.condition-apply-proposal')
    expect(published.definition.outputs).toMatchObject({
      conditionId: { kind: 'NODE_OUTPUT', port: 'conditionId' }
    })
  })

  it('treats a condition outside the pinned vocabulary as unsupported', () => {
    const candidate = action()
    expect(() =>
      compileDnd5eEffectAction({
        action: {
          ...candidate,
          conditionDefinitionIds: [],
          compiledEffect: {
            ...candidate.compiledEffect,
            entries: [
              {
                ...directEntry(candidate),
                outcome: {
                  id: 'condition-id',
                  effectKind: EFFECT_KIND.CONDITION,
                  conditionId: CONDITION_ID
                }
              }
            ]
          }
        } as CharacterActionCapabilityDescriptor
      })
    ).toThrow(CharacterRuleActionUnsupportedCompilationError)
  })

  it('rejects an unsafe fixed amount as structurally unsupported', () => {
    const candidate = action()
    expect(() =>
      compileDnd5eEffectAction({
        action: {
          ...candidate,
          compiledEffect: {
            ...candidate.compiledEffect,
            entries: [
              {
                ...directEntry(candidate),
                outcome: {
                  ...directEntry(candidate).outcome,
                  amount: Number.MAX_SAFE_INTEGER + 1
                }
              }
            ]
          }
        } as CharacterActionCapabilityDescriptor
      })
    ).toThrow(CharacterRuleActionUnsupportedCompilationError)
  })

  it('treats a malformed typed damage identity as integrity failure', () => {
    const candidate = action()
    expect(() =>
      compileDnd5eEffectAction({
        action: {
          ...candidate,
          compiledEffect: {
            ...candidate.compiledEffect,
            entries: [
              {
                ...directEntry(candidate),
                outcome: {
                  ...directEntry(candidate).outcome,
                  effectKind: EFFECT_KIND.DAMAGE,
                  damageTypeId: 'fire'
                }
              }
            ]
          }
        } as CharacterActionCapabilityDescriptor
      })
    ).toThrow(Dnd5eEffectActionCompilerError)
  })

  it('accepts an already-normalized positive resource use without changing the proposal graph', () => {
    const candidate = action()
    expect(
      compileDnd5eEffectAction({
        action: {
          ...candidate,
          compiledEffect: {
            ...candidate.compiledEffect,
            invocation: {
              ...candidate.compiledEffect.invocation,
              resourceUse: {
                chargeId: '00000000-0000-4000-8000-000000000021',
                cost: 1
              }
            }
          }
        } as CharacterActionCapabilityDescriptor
      }).definition.nodes[0]?.operation.key
    ).toBe('dnd5e.heal-proposal')
  })

  it.each([
    ['wrong System', () => action({ gameSystemId: '00000000-0000-4000-8000-000000000099' })],
    [
      'noncanonical Effect ID',
      () =>
        action({
          effectId: '00000000-0000-4000-8000-0000000000aa'.toUpperCase()
        })
    ],
    [
      'mismatched Effect entry point',
      () =>
        action({
          entryPointDefinitionId: '00000000-0000-4000-8000-000000000099'
        })
    ],
    [
      'non-self range',
      () => {
        const candidate = action()
        return {
          ...candidate,
          compiledEffect: {
            ...candidate.compiledEffect,
            invocation: {
              ...candidate.compiledEffect.invocation,
              range: { id: 'range-id', rangeKind: 'TOUCH' }
            }
          }
        }
      }
    ],
    [
      'non-self targeting',
      () => {
        const candidate = action()
        return {
          ...candidate,
          compiledEffect: {
            ...candidate.compiledEffect,
            invocation: {
              ...candidate.compiledEffect.invocation,
              targeting: { selectionKind: 'SINGLE_TARGET' }
            }
          }
        }
      }
    ],
    [
      'scaled healing',
      () => {
        const candidate = action()
        return {
          ...candidate,
          compiledEffect: {
            ...candidate.compiledEffect,
            entries: [
              {
                ...directEntry(candidate),
                outcome: {
                  id: 'heal-id',
                  effectKind: EFFECT_KIND.HEAL,
                  valueKind: 'FIXED',
                  scalingKind: 'PER_LEVEL',
                  scalingSource: 'CHARACTER_LEVEL',
                  levels: []
                }
              }
            ]
          }
        }
      }
    ],
    [
      'healing bonuses',
      () => {
        const candidate = action()
        return {
          ...candidate,
          compiledEffect: {
            ...candidate.compiledEffect,
            entries: [
              {
                ...directEntry(candidate),
                outcome: {
                  ...directEntry(candidate).outcome,
                  bonuses: [{ id: 'bonus', bonusKind: 'PROFICIENCY_BONUS', order: 1 }]
                }
              }
            ]
          }
        }
      }
    ],
    [
      'malformed resource use',
      () => {
        const candidate = action()
        return {
          ...candidate,
          compiledEffect: {
            ...candidate.compiledEffect,
            invocation: {
              ...candidate.compiledEffect.invocation,
              resourceUse: { chargeId: ' charge ', cost: 1 }
            }
          }
        }
      }
    ],
    [
      'multiple results',
      () => {
        const candidate = action()
        return {
          ...candidate,
          compiledEffect: {
            ...candidate.compiledEffect,
            entries: [...candidate.compiledEffect.entries, candidate.compiledEffect.entries[0]!]
          }
        }
      }
    ],
    [
      'choice resolution',
      () => {
        const candidate = action()
        return {
          ...candidate,
          compiledEffect: {
            ...candidate.compiledEffect,
            entries: candidate.compiledEffect.entries.map((entry) => ({
              ...entry,
              groupKind: 'CHOICE'
            }))
          }
        }
      }
    ],
    [
      'roll-table resolution',
      () => {
        const candidate = action()
        return {
          ...candidate,
          compiledEffect: {
            ...candidate.compiledEffect,
            entries: candidate.compiledEffect.entries.map((entry) => ({
              ...entry,
              resolutionKind: 'ROLL_TABLE',
              rollTableKind: 'EXACT',
              die: '1d20',
              rollValue: 1
            }))
          }
        }
      }
    ],
    [
      'lifecycle result',
      () => {
        const candidate = action()
        return {
          ...candidate,
          compiledEffect: {
            ...candidate.compiledEffect,
            entries: candidate.compiledEffect.entries.map((entry) => ({
              ...entry,
              lifecycle: { kind: 'START_OF_TURN' }
            }))
          }
        }
      }
    ]
  ])('rejects %s', (_label, create) => {
    expect(() =>
      compileDnd5eEffectAction({
        action: create() as CharacterActionCapabilityDescriptor
      })
    ).toThrow()
  })

  it('specializes one successful attack path into ordered damage then UUID-backed scalar reduction', () => {
    const candidate = scalarReductionAttackAction()
    const template = compileDnd5eEffectActionTestTemplate({ action: candidate })
    const outcome = specializeDnd5eEffectActionOutcome({
      action: candidate,
      testTemplate: template,
      selectedPath: 'ON_HIT',
      facts: {}
    })
    if (!outcome) throw new Error('Expected scalar reduction outcome.')

    expect(outcome.published.definition.nodes.map((node) => node.operation.key)).toEqual([
      'evidence.integer-range',
      'evidence.integer-range',
      'number.add',
      'dnd5e.damage-total',
      'dnd5e.damage-proposal',
      'evidence.integer-range',
      'dnd5e.scalar-reduction-proposal'
    ])
    expect(outcome.published.definition.nodes[6]).toMatchObject({
      inputs: {
        valueDefinitionId: { value: '00000000-0000-4000-8000-000000000082' }
      }
    })
  })

  it('rejects same-path outcomes that originate from distinct authored result blocks', () => {
    const candidate = attackAction()
    const entry = candidate.compiledEffect.entries.find(
      (value) => value.pathCode === PATH_CODE.ON_HIT && 'outcome' in value
    )
    if (!entry || !('outcome' in entry)) throw new Error('Expected an authored hit outcome.')
    const entries = [
      ...candidate.compiledEffect.entries,
      {
        ...entry,
        entryId: '00000000-0000-4000-8000-000000000083',
        resultBlockId: '00000000-0000-4000-8000-000000000084'
      }
    ]

    expect(() =>
      compileDnd5eEffectAction({
        action: {
          ...candidate,
          compiledEffect: { ...candidate.compiledEffect, entries }
        }
      })
    ).toThrow('must not merge distinct authored result blocks')
  })

  it('binds UUID scalar state into both direct and active-effect target currentness', () => {
    const published = compileDnd5eEffectAction({ action: action() })
    const direct = dnd5eCharacterRuleActionSystemAdapter.bindFacts({
      actionMechanic: { attackBonus: null, attackKind: null, attackRollMode: 'NORMAL', save: null },
      published,
      sourceDerivedFacts: {},
      targetActorId: ACTOR_ID,
      targetDerivedFacts: {},
      targetConditionIds: [],
      currentHitPoints: 4,
      temporaryHitPoints: 0,
      maximumHitPoints: 10,
      targetScalarValues: { '00000000-0000-4000-8000-000000000082': 5 },
      defenses: []
    })
    const baseline = dnd5eCharacterRuleActionSystemAdapter.bindFacts({
      actionMechanic: { attackBonus: null, attackKind: null, attackRollMode: 'NORMAL', save: null },
      published,
      sourceDerivedFacts: {},
      targetActorId: ACTOR_ID,
      targetDerivedFacts: {},
      targetConditionIds: [],
      currentHitPoints: 4,
      temporaryHitPoints: 0,
      maximumHitPoints: 10,
      targetScalarValues: {},
      defenses: []
    })
    expect(direct.facts[DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]).not.toBe(
      baseline.facts[DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]
    )
  })
})
