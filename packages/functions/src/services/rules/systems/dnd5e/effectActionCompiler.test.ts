import { describe, expect, it } from 'vitest'
import type { ServerRuleExecutionTraceEntryDto } from '@artificer-toolkit/schema/shared/rulesExecution'

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
  DND5E_ATTACK_TEST_OPERATION_KEY,
  dnd5eAttackTestOperation,
  dnd5eSaveTestOperation,
  dnd5eDamageProposalOperation,
  dnd5eDamageTotalOperation,
  dnd5eHealTotalOperation,
  dnd5eConditionApplyProposalOperation,
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
      defenses: []
    })
    expect(bound.facts[DND5E_RESOLVED_DAMAGE_EXPRESSION_FACT_KEYS.ON_HIT]).toBe('2d8 + 6')
    expect(bound.facts[DND5E_RESOLVED_DAMAGE_OUTCOME_EXPRESSIONS_FACT_KEY]).toBe(
      JSON.stringify({ 'damage-0': '2d8 + 6' })
    )
  })

  it('binds multiple same-path damage expressions only by exact outcome identity', () => {
    const candidate = diceAttackAction({ dice: '1d6' })
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

    expect(plan).toEqual({
      authoredEffectId: EFFECT_ID,
      compiledEntryId: '00000000-0000-4000-8000-000000000014',
      frozenGraphNodeId: 'active_effect_00000000-0000-4000-8000-000000000014',
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
})
