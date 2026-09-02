import { describe, expect, it } from 'vitest'

import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import { compiledActionEntryPointsSchema } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { EffectInvocationAuthored } from '@artificer-toolkit/shared/authored'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'

import type { CharacterActionCapabilityDescriptor } from './characterActionCapabilityDiscovery.js'
import {
  CharacterRuleActionUnsupportedCompilationError,
  type CharacterRuleActionSystemAdapter
} from './characterRuleActionSystemAdapter.js'
import {
  CharacterActionEntryPointIntegrityError,
  compileCharacterActionEntryPoints
} from './characterActionEntryPointCompiler.js'
import { DND5E_SYSTEM_ID } from './systems/dnd5e/characterActionCapabilityDiscovery.js'
import { dnd5eCharacterRuleActionSystemAdapter } from './systems/dnd5e/effectActionCompiler.js'

const EFFECT_ID = '00000000-0000-4000-8000-000000000010'
const OTHER_SYSTEM_ID = '00000000-0000-4000-8000-000000000099'
function candidate(input: { resource?: boolean } = {}): CharacterActionCandidate {
  return {
    sequence: 0,
    actionId: `source:ACTION:${EFFECT_ID}`,
    effectId: EFFECT_ID,
    sourceId: 'source',
    source: {
      kind: 'AUTHORED',
      sourceKind: 'FEATURE',
      definitionId: 'feature',
      sourceInstanceId: 'source'
    },
    mechanicsOwner: { kind: 'FEATURE', id: 'feature' },
    activationSourceKind: 'ACTIVE_SOURCE',
    equipment: null,
    resourceUse: input.resource
      ? {
          poolId:
            'ITEM_INSTANCE:00000000-0000-4000-8000-000000000022:00000000-0000-4000-8000-000000000021',
          chargeId: '00000000-0000-4000-8000-000000000021',
          cost: 1
        }
      : null,
    mechanicFacts: {
      invocation: {
        triggerCode: 'ACTIVATED',
        activation: { code: 'ACTION', amount: 1 },
        range: { rangeKind: 'SELF', amount: null, unit: null },
        savingThrow: null,
        reactionMovementTrigger: null
      },
      outcomes: [
        {
          kind: 'HEAL',
          pathCode: 'ON_USE',
          label: null,
          valueKind: 'FIXED',
          scalingKind: 'NONE',
          scalingSource: null,
          classId: null,
          temporary: false,
          values: [
            {
              level: null,
              order: 0,
              amount: 7,
              dice: null,
              multiplier: null,
              minimum: null,
              maximum: null
            }
          ],
          bonuses: []
        }
      ]
    }
  }
}

function descriptor(
  input: { resource?: boolean; unsupported?: boolean } = {}
): CharacterActionCapabilityDescriptor {
  const compiledEffect = compileEffect({
    id: EFFECT_ID,
    order: 1,
    invocation: {
      kind: 'ACTION',
      triggerCode: TRIGGER.ACTIVATED,
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      ...(input.resource
        ? {
            resourceUse: {
              chargeId: '00000000-0000-4000-8000-000000000021',
              cost: 1
            }
          }
        : {}),
      range: {
        id: 'range-id',
        rangeKind: input.unsupported ? RANGE_KIND.TOUCH : RANGE_KIND.SELF
      },
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
  const action = candidate()
  return {
    kind: 'CHARACTER_ACTION',
    gameSystemId: DND5E_SYSTEM_ID,
    authoredRootKind: 'effect',
    entryPointDefinitionId: EFFECT_ID,
    effectId: EFFECT_ID,
    actionId: action.actionId,
    sourceId: action.sourceId,
    source: action.source,
    mechanicsOwner: action.mechanicsOwner,
    activationSourceKind: action.activationSourceKind,
    mechanicFacts: action.mechanicFacts,
    compiledEffect
  }
}

function diceTestDescriptor(
  input:
    | {
        triggerCode: typeof TRIGGER.MELEE_WEAPON_ATTACK
        pathCode: typeof PATH_CODE.ON_HIT
      }
    | {
        triggerCode: typeof TRIGGER.SAVING_THROW
        pathCode: typeof PATH_CODE.ON_SAVE_FAIL
      }
): CharacterActionCapabilityDescriptor {
  const base = descriptor()
  const invocation: EffectInvocationAuthored =
    input.triggerCode === TRIGGER.SAVING_THROW
      ? {
          kind: 'ACTION',
          triggerCode: input.triggerCode,
          activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
          range: { id: 'range-id', rangeKind: RANGE_KIND.UNLIMITED },
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' },
          savingThrow: {
            id: 'save-id',
            abilityDefinitionId: '00000000-0000-4000-8000-000000000012',
            dcMethod: 'FIXED_DC',
            baseDc: 13
          }
        }
      : {
          kind: 'ACTION',
          triggerCode: input.triggerCode,
          activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
          range: { id: 'range-id', rangeKind: RANGE_KIND.UNLIMITED },
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
        }
  return {
    ...base,
    compiledEffect: compileEffect({
      id: EFFECT_ID,
      order: 1,
      invocation,
      paths: [
        {
          id: '00000000-0000-4000-8000-000000000013',
          order: 1,
          pathCode: input.pathCode,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED',
          resultBlock: {
            id: '00000000-0000-4000-8000-000000000014',
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: '00000000-0000-4000-8000-000000000015',
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: '00000000-0000-4000-8000-000000000016',
                valueKind: 'DICE',
                scalingKind: 'NONE',
                diceConfig: '1d8'
              }
            ]
          }
        }
      ]
    })
  }
}

function directEntry(candidate: CharacterActionCapabilityDescriptor) {
  const entry = candidate.compiledEffect.entries[0]
  if (!entry || !('outcome' in entry)) throw new Error('Expected a direct compiled Effect entry.')
  return entry
}

describe('compileCharacterActionEntryPoints', () => {
  it('publishes the exact D&D fixed self-heal graph', () => {
    const entries = compileCharacterActionEntryPoints({
      gameSystemId: DND5E_SYSTEM_ID,
      candidates: [candidate()],
      descriptors: [descriptor()]
    })

    expect(entries).toMatchObject([
      {
        schemaVersion: 4,
        actionId: `source:ACTION:${EFFECT_ID}`,
        effectId: EFFECT_ID,
        compilation: {
          kind: 'COMPILED',
          resourceBinding: null,
          executionPlan: {
            kind: 'SINGLE_GRAPH',
            published: { id: EFFECT_ID, gameSystemId: DND5E_SYSTEM_ID }
          }
        }
      }
    ])
    const compiledEntry = entries[0]!
    if (compiledEntry.compilation.kind !== 'COMPILED' || compiledEntry.schemaVersion !== 4) {
      throw new Error('Expected a current compiled Character action entry.')
    }
    if (compiledEntry.compilation.executionPlan.kind !== 'SINGLE_GRAPH') {
      throw new Error('Expected a fixed single-graph Character action entry.')
    }
    expect(compiledEntry.compilation.executionPlan.published.id).toBe(EFFECT_ID)
  })

  it.each([
    { triggerCode: TRIGGER.MELEE_WEAPON_ATTACK, pathCode: PATH_CODE.ON_HIT },
    { triggerCode: TRIGGER.SAVING_THROW, pathCode: PATH_CODE.ON_SAVE_FAIL }
  ] as const)(
    'selects the v4 TEST_OUTCOME plan for legal dice $triggerCode actions',
    (testCase) => {
      const { pathCode } = testCase
      const entries = compileCharacterActionEntryPoints({
        gameSystemId: DND5E_SYSTEM_ID,
        candidates: [candidate()],
        descriptors: [diceTestDescriptor(testCase)]
      })
      const entry = entries[0]
      if (
        !entry ||
        entry.schemaVersion !== 4 ||
        entry.compilation.kind !== 'COMPILED' ||
        entry.compilation.executionPlan.kind !== 'TEST_OUTCOME'
      ) {
        throw new Error('Expected a TEST_OUTCOME Character action entry.')
      }
      expect(entry.compilation.executionPlan.test.published.id).toBe(EFFECT_ID)
      expect(entry.compilation.executionPlan.outcomes).toContainEqual(
        expect.objectContaining({ pathCode })
      )
    }
  )

  it.each([
    {
      triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
      pathCode: PATH_CODE.ON_HIT,
      terminalPath: 'ON_MISS'
    },
    {
      triggerCode: TRIGGER.SAVING_THROW,
      pathCode: PATH_CODE.ON_SAVE_FAIL,
      terminalPath: 'ON_SAVE_SUCCESS'
    }
  ] as const)(
    'pins an omitted $triggerCode TEST result as a terminal $terminalPath path',
    (testCase) => {
      const { terminalPath } = testCase
      const entry = compileCharacterActionEntryPoints({
        gameSystemId: DND5E_SYSTEM_ID,
        candidates: [candidate()],
        descriptors: [diceTestDescriptor(testCase)]
      })[0]
      if (
        !entry ||
        entry.schemaVersion !== 4 ||
        entry.compilation.kind !== 'COMPILED' ||
        entry.compilation.executionPlan.kind !== 'TEST_OUTCOME'
      ) {
        throw new Error('Expected a TEST_OUTCOME Character action entry.')
      }
      const outcome = dnd5eCharacterRuleActionSystemAdapter.specializeOutcomeTemplate?.({
        compilerSource: entry.compilation.executionPlan.compilerSource,
        testTemplate: entry.compilation.executionPlan.test,
        selectedPath: terminalPath,
        facts: {}
      })
      expect(outcome).toBeNull()
    }
  )

  it('keeps CLASS_LEVEL dice actions manual before any TEST graph can publish', () => {
    const classScaled = diceTestDescriptor({
      triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
      pathCode: PATH_CODE.ON_HIT
    })
    const first = classScaled.compiledEffect.entries[0]
    if (
      !first ||
      !('outcome' in first) ||
      first.outcome.effectKind !== EFFECT_KIND.DAMAGE ||
      first.outcome.valueKind !== 'DICE'
    )
      throw new Error('Expected a dice damage outcome.')
    expect(
      compileCharacterActionEntryPoints({
        gameSystemId: DND5E_SYSTEM_ID,
        candidates: [candidate()],
        descriptors: [
          {
            ...classScaled,
            compiledEffect: {
              ...classScaled.compiledEffect,
              entries: [
                {
                  ...first,
                  outcome: {
                    ...first.outcome,
                    scalingKind: 'BREAKPOINTS',
                    scalingSource: 'CLASS_LEVEL',
                    classId: '00000000-0000-4000-8000-000000000098',
                    level: 1,
                    order: 1
                  }
                }
              ]
            }
          }
        ]
      })
    ).toMatchObject([{ compilation: { kind: 'MANUAL', reasonCode: 'NOT_NORMALIZED' } }])
  })

  it('fails closed instead of combining a TEST_OUTCOME plan with an active effect', () => {
    const adapter: CharacterRuleActionSystemAdapter = {
      ...dnd5eCharacterRuleActionSystemAdapter,
      compileExecutionPlan: ({ action, compilerSource }) => {
        const published = dnd5eCharacterRuleActionSystemAdapter.compile({ action })
        return {
          kind: 'TEST_OUTCOME',
          compilerSource,
          test: {
            published,
            template: {
              definitionId: published.id,
              gameSystemId: published.gameSystemId,
              definitionFamilyKey: published.definitionFamilyKey,
              checksum: published.checksum
            }
          },
          outcomes: [
            {
              pathCode: 'ON_USE',
              template: {
                definitionId: published.id,
                gameSystemId: published.gameSystemId,
                definitionFamilyKey: published.definitionFamilyKey,
                checksum: published.checksum
              }
            }
          ]
        }
      },
      activeEffectPlans: ({ published }) => [
        {
          authoredEffectId: EFFECT_ID,
          compiledEntryId: 'compiled-entry',
          frozenGraphNodeId: 'frozen-node',
          frozenGraph: published,
          capabilityContractVersion: 1,
          recurrenceStage: 'START_OF_TURN',
          initialRemaining: 1,
          adapterFacts: {},
          perceptionContributions: [],
          maintenance: null
        }
      ]
    }
    expect(
      compileCharacterActionEntryPoints(
        {
          gameSystemId: DND5E_SYSTEM_ID,
          candidates: [candidate()],
          descriptors: [descriptor()]
        },
        { get: () => adapter }
      )
    ).toMatchObject([{ compilation: { kind: 'MANUAL', reasonCode: 'NOT_NORMALIZED' } }])
  })

  it('pins an exact normalized resource binding into a new compiled entry', () => {
    const entries = compileCharacterActionEntryPoints({
      gameSystemId: DND5E_SYSTEM_ID,
      candidates: [candidate({ resource: true })],
      descriptors: [descriptor({ resource: true })]
    })

    expect(entries).toMatchObject([
      {
        schemaVersion: 4,
        compilation: {
          kind: 'COMPILED',
          resourceBinding: {
            poolId:
              'ITEM_INSTANCE:00000000-0000-4000-8000-000000000022:00000000-0000-4000-8000-000000000021',
            chargeId: '00000000-0000-4000-8000-000000000021',
            cost: 1
          }
        }
      }
    ])
  })

  it('permits distinct equipment actions to share one Effect definition', () => {
    const first = candidate({ resource: true })
    const second = {
      ...candidate({ resource: true }),
      sequence: 1,
      actionId: `item-instance-two:ACTION:${EFFECT_ID}`,
      sourceId: 'item-instance-two',
      source: {
        kind: 'EQUIPMENT_INSTANCE' as const,
        equipmentId: 'item-definition',
        itemInstanceId: 'item-instance-two'
      },
      mechanicsOwner: { kind: 'EQUIPMENT' as const, id: 'item-instance-two' },
      activationSourceKind: 'ACTIVE_EQUIPMENT' as const,
      equipment: {
        itemInstanceId: 'item-instance-two',
        equipped: true,
        attuned: true,
        requiresAttunement: false,
        requiresEquipped: true,
        requiresAttuned: false
      },
      resourceUse: {
        poolId:
          'ITEM_INSTANCE:00000000-0000-4000-8000-000000000023:00000000-0000-4000-8000-000000000021',
        chargeId: '00000000-0000-4000-8000-000000000021',
        cost: 1
      }
    }
    const firstDescriptor = descriptor({ resource: true })
    const secondDescriptor = {
      ...descriptor({ resource: true }),
      actionId: second.actionId,
      sourceId: second.sourceId,
      source: second.source,
      mechanicsOwner: second.mechanicsOwner,
      activationSourceKind: second.activationSourceKind
    }

    const entries = compileCharacterActionEntryPoints({
      gameSystemId: DND5E_SYSTEM_ID,
      candidates: [first, second],
      descriptors: [firstDescriptor, secondDescriptor]
    })

    expect(entries).toHaveLength(2)
    expect(entries.map((entry) => entry.effectId)).toEqual([EFFECT_ID, EFFECT_ID])
    expect(entries.map((entry) => entry.actionId)).toEqual([first.actionId, second.actionId])
    expect(entries.map((entry) => entry.compilation)).toMatchObject([
      {
        resourceBinding: { poolId: first.resourceUse?.poolId }
      },
      {
        resourceBinding: { poolId: second.resourceUse.poolId }
      }
    ])
  })

  it('keeps an incomplete resource binding manual', () => {
    const resourceCandidate = candidate({ resource: true })
    resourceCandidate.resourceUse = {
      ...resourceCandidate.resourceUse!,
      poolId: null
    }
    expect(
      compileCharacterActionEntryPoints({
        gameSystemId: DND5E_SYSTEM_ID,
        candidates: [resourceCandidate],
        descriptors: [descriptor({ resource: true })]
      })
    ).toMatchObject([{ compilation: { kind: 'MANUAL', reasonCode: 'NOT_NORMALIZED' } }])
  })

  it('keeps the historical v1 compiled entry readable as resource-free', () => {
    const current = compileCharacterActionEntryPoints({
      gameSystemId: DND5E_SYSTEM_ID,
      candidates: [candidate()],
      descriptors: [descriptor()]
    })
    const entry = current[0]
    if (
      !entry ||
      entry.schemaVersion !== 4 ||
      entry.compilation.kind !== 'COMPILED' ||
      entry.compilation.executionPlan.kind !== 'SINGLE_GRAPH'
    )
      throw new Error('Expected a compiled Character action entry.')
    expect(
      compiledActionEntryPointsSchema.parse([
        {
          schemaVersion: 1,
          kind: entry.kind,
          actionId: entry.actionId,
          effectId: entry.effectId,
          compilation: {
            kind: 'COMPILED',
            published: entry.compilation.executionPlan.published
          }
        }
      ])
    ).toMatchObject([{ schemaVersion: 1 }])
  })

  it('keeps a known unsupported D&D Effect actionable only manually', () => {
    expect(
      compileCharacterActionEntryPoints({
        gameSystemId: DND5E_SYSTEM_ID,
        candidates: [candidate()],
        descriptors: [descriptor({ unsupported: true })]
      })
    ).toEqual([
      {
        schemaVersion: 1,
        kind: 'CHARACTER_ACTION',
        actionId: `source:ACTION:${EFFECT_ID}`,
        effectId: EFFECT_ID,
        targetPolicy: {
          range: { id: 'range-id', rangeKind: 'TOUCH' },
          targeting: { selectionKind: 'SELF' },
          shape: null,
          pathOverrides: []
        },
        compilation: { kind: 'MANUAL', reasonCode: 'NOT_NORMALIZED' }
      }
    ])
  })

  it('keeps a legacy recurring result block without a UUID identity manual', () => {
    const recurring = descriptor()
    const entry = directEntry(recurring)
    entry.resultBlockId = 'legacy-recurring-result'
    entry.duration = { durationKind: 'ROUND', amount: 2 }
    entry.lifecycle = { recurringKind: 'START_OF_TURN' }

    expect(
      compileCharacterActionEntryPoints({
        gameSystemId: DND5E_SYSTEM_ID,
        candidates: [candidate()],
        descriptors: [recurring]
      })
    ).toMatchObject([{ compilation: { kind: 'MANUAL', reasonCode: 'NOT_NORMALIZED' } }])
  })

  it('maps generic non-D&D structural unsupported compilation to a manual entry', () => {
    const adapter: CharacterRuleActionSystemAdapter = {
      gameSystemId: OTHER_SYSTEM_ID,
      compile() {
        throw new CharacterRuleActionUnsupportedCompilationError('Unsupported mechanic.')
      },
      bindFacts() {
        return { facts: {} }
      },
      interpret() {
        throw new Error('Not used.')
      }
    }
    const entries = compileCharacterActionEntryPoints(
      {
        gameSystemId: OTHER_SYSTEM_ID,
        candidates: [candidate()],
        descriptors: [{ ...descriptor(), gameSystemId: OTHER_SYSTEM_ID }]
      },
      {
        get: (gameSystemId) => (gameSystemId === OTHER_SYSTEM_ID ? adapter : undefined)
      }
    )

    expect(entries[0]?.compilation).toEqual({
      kind: 'MANUAL',
      reasonCode: 'NOT_NORMALIZED'
    })
  })

  it('does not convert malformed typed D&D damage into a manual entry', () => {
    const candidateDescriptor = descriptor()
    const entry = directEntry(candidateDescriptor)
    expect(() =>
      compileCharacterActionEntryPoints({
        gameSystemId: DND5E_SYSTEM_ID,
        candidates: [candidate()],
        descriptors: [
          {
            ...candidateDescriptor,
            compiledEffect: {
              ...candidateDescriptor.compiledEffect,
              entries: [
                {
                  ...entry,
                  outcome: {
                    id: entry.outcome.id,
                    effectKind: EFFECT_KIND.DAMAGE,
                    damageTypeId: 'fire',
                    valueKind: 'FIXED',
                    scalingKind: 'NONE',
                    amount: 1
                  }
                }
              ]
            }
          }
        ]
      })
    ).toThrow()
  })

  it('fails closed to a manual entry for every candidate when no System adapter is registered', () => {
    expect(
      compileCharacterActionEntryPoints({
        gameSystemId: '00000000-0000-4000-8000-000000000099',
        candidates: [candidate()],
        descriptors: []
      })
    ).toMatchObject([
      {
        compilation: {
          kind: 'MANUAL',
          reasonCode: 'SYSTEM_CAPABILITY_UNAVAILABLE'
        }
      }
    ])
  })

  it('rejects an exact-source descriptor that does not match the candidate', () => {
    expect(() =>
      compileCharacterActionEntryPoints({
        gameSystemId: DND5E_SYSTEM_ID,
        candidates: [candidate()],
        descriptors: [{ ...descriptor(), actionId: 'other-action' }]
      })
    ).toThrow(CharacterActionEntryPointIntegrityError)
  })

  it('rejects duplicate candidate identities before publishing any entry point', () => {
    expect(() =>
      compileCharacterActionEntryPoints({
        gameSystemId: DND5E_SYSTEM_ID,
        candidates: [candidate(), candidate()],
        descriptors: [descriptor(), descriptor()]
      })
    ).toThrow(CharacterActionEntryPointIntegrityError)
  })
})
