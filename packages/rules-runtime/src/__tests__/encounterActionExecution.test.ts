import { describe, expect, it } from 'vitest'
import {
  advanceNativeActionGraphs,
  executeNativeActionGraphs
} from '../encounterActionExecution.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/characterActionCapabilityDiscovery.js'
import type { CharacterActionCapabilityDescriptor } from '../characterActionCapabilityDiscovery.js'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'

const EFFECT_ID = '00000000-0000-4000-8000-000000000010'
const TARGET_ID = '00000000-0000-4000-8000-000000000011'
const OCCURRENCE_ID = '00000000-0000-4000-8000-000000000012'
const DAMAGE_TYPE_ID = '00000000-0000-4000-8000-000000000099'
const DEXTERITY_ID = '00000000-0000-4000-8000-000000000014'

function descriptor(
  compiledEffect: ReturnType<typeof compileEffect>
): CharacterActionCapabilityDescriptor {
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
    compiledEffect
  } as CharacterActionCapabilityDescriptor
}

function attackAction(input: { dice?: boolean; includeMiss?: boolean } = {}) {
  const paths = [
    PATH_CODE.ON_HIT,
    ...(input.includeMiss ? [PATH_CODE.ON_MISS] : []),
    PATH_CODE.ON_CRIT
  ].map((pathCode, order) => ({
    id: `path-${order}`,
    order,
    pathCode,
    groupType: PATH_GROUP_TYPE.SINGLE,
    selectionKind: 'FIXED' as const,
    resultBlock: {
      id: `result-${order}`,
      resultKind: 'SINGLE' as const,
      outcomes: [
        input.dice
          ? {
              id: `damage-${order}`,
              effectKind: EFFECT_KIND.DAMAGE,
              damageTypeId: DAMAGE_TYPE_ID,
              valueKind: 'DICE' as const,
              scalingKind: 'NONE' as const,
              diceConfig: '1d6'
            }
          : {
              id: `damage-${order}`,
              effectKind: EFFECT_KIND.DAMAGE,
              damageTypeId: DAMAGE_TYPE_ID,
              valueKind: 'FIXED' as const,
              scalingKind: 'NONE' as const,
              amount: order + 1
            }
      ]
    }
  }))
  return descriptor(
    compileEffect({
      id: EFFECT_ID,
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: 'range', rangeKind: RANGE_KIND.UNLIMITED },
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
      },
      paths
    })
  )
}

function directDiceAction() {
  return descriptor(
    compileEffect({
      id: EFFECT_ID,
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: 'range', rangeKind: RANGE_KIND.SELF },
        targeting: { selectionKind: 'SELF' }
      },
      paths: [
        {
          id: 'path',
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'result',
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: 'heal',
                effectKind: EFFECT_KIND.HEAL,
                valueKind: 'DICE',
                scalingKind: 'NONE',
                diceConfig: '1d8'
              }
            ]
          }
        }
      ]
    })
  )
}

function nestedSaveAction() {
  return descriptor(
    compileEffect({
      id: EFFECT_ID,
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: 'range', rangeKind: RANGE_KIND.UNLIMITED },
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
      },
      paths: [
        {
          id: '00000000-0000-4000-8000-000000000020',
          order: 1,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          selectionKind: 'FIXED',
          resultBlock: {
            id: '00000000-0000-4000-8000-000000000021',
            resultKind: 'SEQUENCE',
            outcomes: [
              {
                id: '00000000-0000-4000-8000-000000000022',
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: DAMAGE_TYPE_ID,
                valueKind: 'DICE',
                scalingKind: 'NONE',
                diceConfig: '1d6'
              },
              {
                id: '00000000-0000-4000-8000-000000000023',
                effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
                timing: 'IMMEDIATE',
                savingThrow: {
                  id: '00000000-0000-4000-8000-000000000024',
                  dcMethod: 'FIXED_DC',
                  abilityDefinitionId: DEXTERITY_ID,
                  baseDc: 10
                },
                attempts: { kind: 'ONCE' },
                onFailure: {
                  kind: 'OUTCOMES',
                  endCurrent: false,
                  resultKind: 'SINGLE',
                  outcomes: [
                    {
                      id: '00000000-0000-4000-8000-000000000025',
                      effectKind: EFFECT_KIND.DAMAGE,
                      damageTypeId: DAMAGE_TYPE_ID,
                      valueKind: 'DICE',
                      scalingKind: 'NONE',
                      diceConfig: '1d6'
                    }
                  ]
                },
                onSuccess: {
                  kind: 'OUTCOMES',
                  endCurrent: false,
                  resultKind: 'SINGLE',
                  outcomes: [
                    {
                      id: '00000000-0000-4000-8000-000000000026',
                      effectKind: EFFECT_KIND.DAMAGE,
                      damageTypeId: DAMAGE_TYPE_ID,
                      valueKind: 'DICE',
                      scalingKind: 'NONE',
                      diceConfig: '1d6',
                      multiplier: 0.5
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    })
  )
}

function plan(action: CharacterActionCapabilityDescriptor) {
  const compilerSource = buildCompiledActionCompilerSource(action)
  const result = dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
    action,
    compilerSource
  })
  if (!result) throw new Error('Expected the installed D&D compiler to produce an execution plan.')
  return result
}

function singlePlan(action: CharacterActionCapabilityDescriptor) {
  return {
    kind: 'SINGLE_GRAPH' as const,
    published: dnd5eCharacterRuleActionSystemAdapter.compile({ action })
  }
}

function runtime() {
  return createPlatformRulesRuntime({
    continuationIntegrityKey: new Uint8Array(32).fill(1),
    definitions: {
      async requireCurrent() {
        throw new Error('Definitions are not used by sealed graphs.')
      }
    }
  })
}

function binding(
  input: {
    attack?: boolean
    outcomes?: readonly Record<string, unknown>[]
    hitPoints?: number
  } = {}
) {
  return {
    actionMechanic: {
      attackBonus: input.attack ? 5 : null,
      attackKind: input.attack ? 'MELEE' : null,
      attackRollMode: 'NORMAL',
      save: null,
      outcomes: input.outcomes ?? []
    },
    sourceDerivedFacts: {},
    targetActorId: TARGET_ID,
    targetDerivedFacts: {
      statBlock: { armorClass: 12 },
      savingThrowDefinitions: [
        {
          abilityDefinitionId: DEXTERITY_ID,
          modifier: 0,
          rollMode: 'NORMAL' as const,
          contributors: []
        }
      ]
    },
    targetConditionIds: [],
    currentHitPoints: input.hitPoints ?? 20,
    temporaryHitPoints: 0,
    maximumHitPoints: 20,
    targetScalarValues: {},
    defenses: []
  }
}

function deterministic(values: number[]) {
  return (maxExclusive: number) => {
    const value = values.shift()
    if (value === undefined || value < 0 || value >= maxExclusive)
      throw new Error('Unexpected random call.')
    return value
  }
}

describe('native phased action execution', () => {
  it('retains TEST evidence and resumes its exact OUTCOME request without rerunning TEST', async () => {
    const input = {
      runtime: runtime(),
      adapter: dnd5eCharacterRuleActionSystemAdapter,
      plan: plan(attackAction({ dice: true })),
      occurrenceId: OCCURRENCE_ID,
      binding: binding({
        attack: true,
        outcomes: [
          {
            kind: 'DAMAGE',
            outcomeId: 'damage-0',
            pathCode: 'ON_HIT',
            expression: '1d6',
            damageTypeId: DAMAGE_TYPE_ID,
            scaling: []
          }
        ]
      }),
      autoRoll: { SOURCE: false, TARGET: false },
      afterTest: async () => undefined
    }
    const test = await advanceNativeActionGraphs(input)
    expect(test.kind).toBe('PENDING')
    if (test.kind !== 'PENDING') throw new Error('Expected TEST evidence.')
    if (input.plan.kind !== 'TEST_OUTCOME') throw new Error('Expected TEST/OUTCOME plan.')
    expect(test.twoPhase?.phase).toBe('TEST')
    expect(test.continuation.graph.source.definitionId).toBe(input.plan.test.published.id)
    expect(test.continuation.graph.source.checksum).toBe(input.plan.test.published.checksum)

    const outcome = await advanceNativeActionGraphs({
      ...input,
      resume: {
        pending: test,
        resolution: { kind: 'AUTO_ROLL', requestId: test.continuation.request.requestId }
      },
      random: deterministic([14])
    })
    expect(outcome.kind).toBe('PENDING')
    if (outcome.kind !== 'PENDING') throw new Error('Expected OUTCOME evidence.')
    expect(outcome.twoPhase?.phase).toBe('OUTCOME')
    expect(outcome.phaseReceipts?.map((receipt) => receipt.phase)).toEqual(['TEST'])

    const complete = await advanceNativeActionGraphs({
      ...input,
      resume: {
        pending: outcome,
        resolution: { kind: 'AUTO_ROLL', requestId: outcome.continuation.request.requestId }
      },
      random: deterministic([3])
    })
    expect(complete.kind).toBe('COMPLETE')
    if (complete.kind !== 'COMPLETE') throw new Error('Expected completed action.')
    expect(complete.phaseReceipts?.map((receipt) => receipt.phase)).toEqual(['TEST', 'OUTCOME'])
    expect(complete.applications).toMatchObject([{ kind: 'DAMAGE', appliedAmount: 4 }])
    const automatic = await executeNativeActionGraphs({ ...input, random: deterministic([14, 3]) })
    expect(complete.d20).not.toBeNull()
    expect(complete.d20).toEqual(automatic.d20)
    expect(complete.phaseReceipts).toEqual(automatic.phaseReceipts)
    // Turning auto-roll on mid-action resumes the sealed prompt instead of rerunning the action.
    await expect(
      advanceNativeActionGraphs({
        ...input,
        autoRoll: { SOURCE: true, TARGET: true },
        resume: {
          pending: outcome,
          resolution: { kind: 'AUTO_ROLL', requestId: outcome.continuation.request.requestId }
        },
        random: deterministic([3])
      })
    ).resolves.toEqual(complete)
  })

  it('executes a hit TEST then dice damage OUTCOME with sealed receipts before mechanics', async () => {
    const result = await executeNativeActionGraphs({
      runtime: runtime(),
      adapter: dnd5eCharacterRuleActionSystemAdapter,
      plan: plan(attackAction({ dice: true })),
      occurrenceId: OCCURRENCE_ID,
      binding: binding({
        attack: true,
        outcomes: [
          {
            kind: 'DAMAGE',
            outcomeId: 'damage-0',
            pathCode: 'ON_HIT',
            expression: '1d6',
            damageTypeId: DAMAGE_TYPE_ID,
            scaling: []
          }
        ]
      }),
      afterTest: async (test) => expect(test.outputs.resultPath).toBe('ON_HIT'),
      random: deterministic([14, 3])
    })

    expect(result.phaseReceipts?.map((receipt) => receipt.phase)).toEqual(['TEST', 'OUTCOME'])
    expect(result.phaseReceipts?.[0]?.execution.outputs.resultPath).toBe('ON_HIT')
    expect(result.applications).toMatchObject([{ kind: 'DAMAGE', appliedAmount: 4 }])
  })

  it('keeps a miss as TEST_ONLY and does not roll or apply an outcome', async () => {
    const result = await executeNativeActionGraphs({
      runtime: runtime(),
      adapter: dnd5eCharacterRuleActionSystemAdapter,
      plan: plan(attackAction()),
      occurrenceId: OCCURRENCE_ID,
      binding: binding({ attack: true }),
      afterTest: async () => undefined,
      random: deterministic([0])
    })

    expect(result.phaseReceipts).toHaveLength(1)
    expect(result.execution.outputs.resultPath).toBe('ON_MISS')
    expect(result.applications).toEqual([])
  })

  it('specializes the critical outcome selected by the real TEST graph', async () => {
    const result = await executeNativeActionGraphs({
      runtime: runtime(),
      adapter: dnd5eCharacterRuleActionSystemAdapter,
      plan: plan(attackAction()),
      occurrenceId: OCCURRENCE_ID,
      binding: binding({ attack: true }),
      afterTest: async () => undefined,
      random: deterministic([19])
    })

    expect(result.phaseReceipts?.[0]?.execution.outputs.resultPath).toBe('ON_CRIT')
    expect(result.applications).toMatchObject([
      { kind: 'DAMAGE', sourceNodeId: 'outcome1-proposal-on_hit', appliedAmount: 1 },
      { kind: 'DAMAGE', sourceNodeId: 'outcome2-proposal-on_crit', appliedAmount: 2 }
    ])
  })

  it('executes immediate integer evidence for a single graph and retains nested save evidence', async () => {
    const single = await executeNativeActionGraphs({
      runtime: runtime(),
      adapter: dnd5eCharacterRuleActionSystemAdapter,
      plan: singlePlan(directDiceAction()),
      occurrenceId: OCCURRENCE_ID,
      binding: binding({
        hitPoints: 10,
        outcomes: [
          {
            kind: 'HEAL',
            outcomeId: 'heal',
            pathCode: 'ON_USE',
            expression: '1d8',
            temporary: false,
            scaling: []
          }
        ]
      }),
      afterTest: async () => undefined,
      random: deterministic([5])
    })
    expect(single.phaseReceipts).toBeUndefined()
    expect(single.applications).toMatchObject([{ kind: 'HEAL', appliedAmount: 6 }])

    const nestedInput = {
      runtime: runtime(),
      adapter: dnd5eCharacterRuleActionSystemAdapter,
      plan: plan(nestedSaveAction()),
      occurrenceId: OCCURRENCE_ID,
      binding: binding({
        attack: true,
        outcomes: [
          {
            kind: 'DAMAGE',
            outcomeId: '00000000-0000-4000-8000-000000000022',
            pathCode: 'ON_HIT',
            expression: '1d6',
            damageTypeId: DAMAGE_TYPE_ID,
            scaling: []
          }
        ]
      }),
      afterTest: async () => undefined,
      random: deterministic([14, 0, 0, 0])
    }
    const nested = await executeNativeActionGraphs(nestedInput)
    expect(nested.nestedD20).toMatchObject({
      requestNodeId: 'nested-save-d20',
      selectedNatural: 1,
      resultPath: 'ON_SAVE_FAIL'
    })
    const assistedInput = {
      ...nestedInput,
      autoRoll: { SOURCE: false, TARGET: false },
      random: deterministic([14, 0, 0, 0])
    }
    let assisted = await advanceNativeActionGraphs(assistedInput)
    let retainedNestedSave = false
    for (let step = 0; assisted.kind === 'PENDING' && step < 8; step++) {
      if (assisted.twoPhase?.phase === 'OUTCOME' && assisted.twoPhase.nestedOutcomeD20Evidence)
        retainedNestedSave = true
      assisted = await advanceNativeActionGraphs({
        ...assistedInput,
        resume: {
          pending: assisted,
          resolution: { kind: 'AUTO_ROLL', requestId: assisted.continuation.request.requestId }
        }
      })
    }
    expect(retainedNestedSave).toBe(true)
    expect(assisted.kind).toBe('COMPLETE')
    if (assisted.kind !== 'COMPLETE') throw new Error('Expected completed nested save action.')
    expect(assisted.d20).toEqual(nested.d20)
    expect(assisted.nestedD20).toEqual(nested.nestedD20)
    expect(assisted.phaseReceipts).toEqual(nested.phaseReceipts)
    expect(assisted.applications).toEqual(nested.applications)
  })

  it('does not execute an OUTCOME when the interstitial test policy refuses it', async () => {
    const random = deterministic([14])
    await expect(
      executeNativeActionGraphs({
        runtime: runtime(),
        adapter: dnd5eCharacterRuleActionSystemAdapter,
        plan: plan(attackAction({ dice: true })),
        occurrenceId: OCCURRENCE_ID,
        binding: binding({
          attack: true,
          outcomes: [
            {
              kind: 'DAMAGE',
              outcomeId: 'damage-0',
              pathCode: 'ON_HIT',
              expression: '1d6',
              damageTypeId: DAMAGE_TYPE_ID,
              scaling: []
            }
          ]
        }),
        afterTest: async () => {
          throw new Error('refused')
        },
        random
      })
    ).rejects.toThrow('refused')
    expect(() => random(6)).toThrow('Unexpected random call')
  })
})
