import { describe, expect, it, vi } from 'vitest'

import {
  activeRuleEffectDefinitionDtoSchema,
  serverRuleExecutionContinuationDtoSchema,
  serverPublishedRuleDefinitionDtoSchema,
  type ActiveRuleEffectDefinitionDto,
  type ActiveRuleEffectLifecycleDto,
  type ServerRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  integerRangeEvidenceRuleOperation,
  RULE_VALUE_KIND,
  type RuleGraphDefinition,
  type RuleInputBinding
} from '@artificer-toolkit/shared/rules'

import {
  executeCharacterActiveRuleEffect,
  executeCharacterActiveRuleEffectWithPause,
  reconstructCharacterActiveRuleEffectCompletion,
  resumeCharacterActiveRuleEffectWithPause,
  CharacterActiveRuleEffectExecutionError
} from './characterActiveRuleEffectExecutor.js'
import {
  executeTargetBoundActiveRuleEffectWithPause,
  reconstructTargetBoundActiveRuleEffectCompletion,
  resumeTargetBoundActiveRuleEffectWithPause
} from './targetBoundActiveRuleEffectExecutor.js'
import { createCharacterRuleActionSystemAdapterRegistry } from './characterRuleActionSystemAdapterRegistry.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { createRulesRuntimeService, type RulesRuntimeService } from './rulesRuntimeService.js'
import {
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_HEAL_PROPOSAL_OPERATION_KEY,
  DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY,
  DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_SAVE_TEST_OPERATION_KEY,
  DND5E_TEST_HEAL_PROPOSAL_OPERATION_KEY,
  dnd5eCharacterRuleActionSystemAdapter,
  dnd5eConditionApplyProposalOperation,
  dnd5eDamageProposalOperation,
  dnd5eEffectActionCapability,
  dnd5eHealProposalOperation,
  dnd5eSaveTestOperation,
  dnd5eTestHealProposalOperation,
  dnd5eTemporaryHitPointsProposalOperation
} from './systems/dnd5e/effectActionCompiler.js'
import { DND5E_SYSTEM_ID } from './systems/dnd5e/characterActionCapabilityDiscovery.js'

const EFFECT_ID = '00000000-0000-4000-8000-000000000101'
const ENTRY_ID = '00000000-0000-4000-8000-000000000102'
const OCCURRENCE_ID = '00000000-0000-4000-8000-000000000103'
const TARGET_ID = '00000000-0000-4000-8000-000000000104'
const EFFECT_INSTANCE_ID = '00000000-0000-4000-8000-000000000105'
const ABILITY_ID = '00000000-0000-4000-8000-000000000106'
const NODE_ID = `active_effect_${ENTRY_ID}`
const SAVE_NODE_ID = 'proposal-on_save_fail'

type OutcomeKind = 'HEAL' | 'TEMPORARY_HIT_POINTS' | 'DAMAGE' | 'CONDITION_APPLY'

function directDefinition(outcome: OutcomeKind = 'HEAL'): RuleGraphDefinition {
  const operation =
    outcome === 'HEAL'
      ? DND5E_HEAL_PROPOSAL_OPERATION_KEY
      : outcome === 'TEMPORARY_HIT_POINTS'
        ? DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY
        : outcome === 'DAMAGE'
          ? DND5E_DAMAGE_PROPOSAL_OPERATION_KEY
          : DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY
  const outcomeInputs: Record<string, RuleInputBinding> =
    outcome === 'CONDITION_APPLY'
      ? {
          conditionId: { kind: 'LITERAL' as const, value: ENTRY_ID },
          conditionImmune: {
            kind: 'FACT' as const,
            factKey: DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY
          }
        }
      : {
          amount: { kind: 'LITERAL' as const, value: 7 },
          ...(outcome === 'DAMAGE'
            ? { damageTypeId: { kind: 'LITERAL' as const, value: ENTRY_ID } }
            : {})
        }
  const outcomeOutputs: Record<string, RuleInputBinding> =
    outcome === 'CONDITION_APPLY'
      ? { conditionId: { kind: 'NODE_OUTPUT' as const, nodeId: NODE_ID, port: 'conditionId' } }
      : {
          amount: { kind: 'NODE_OUTPUT' as const, nodeId: NODE_ID, port: 'amount' },
          ...(outcome === 'DAMAGE'
            ? {
                damageTypeId: {
                  kind: 'NODE_OUTPUT' as const,
                  nodeId: NODE_ID,
                  port: 'damageTypeId'
                }
              }
            : {})
        }
  return {
    schemaVersion: 1,
    id: EFFECT_ID,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      {
        id: NODE_ID,
        operation: { key: operation, contractVersion: 1 },
        inputs: {
          targetActorId: {
            kind: 'FACT',
            factKey: DND5E_TARGET_ACTOR_FACT_KEY
          },
          targetStateChecksum: {
            kind: 'FACT',
            factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY
          },
          ...outcomeInputs
        }
      }
    ],
    outputs: {
      targetActorId: { kind: 'NODE_OUTPUT', nodeId: NODE_ID, port: 'targetActorId' },
      ...outcomeOutputs
    },
    sourceEntryBindings: [{ sourceEntryId: ENTRY_ID, nodeId: NODE_ID }]
  }
}

function savingThrowDefinition(): RuleGraphDefinition {
  return {
    schemaVersion: 1,
    id: EFFECT_ID,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      {
        id: 'd20',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
      },
      {
        id: 'test',
        operation: { key: DND5E_SAVE_TEST_OPERATION_KEY, contractVersion: 1 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
          modifier: { kind: 'FACT', factKey: DND5E_SAVE_MODIFIER_FACT_KEY },
          threshold: { kind: 'FACT', factKey: DND5E_SAVE_DC_FACT_KEY },
          contributorChecksum: {
            kind: 'FACT',
            factKey: DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY
          }
        }
      },
      {
        id: SAVE_NODE_ID,
        operation: { key: DND5E_TEST_HEAL_PROPOSAL_OPERATION_KEY, contractVersion: 1 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          resolvedPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
          authoredPath: { kind: 'LITERAL', value: 'ON_SAVE_FAIL' },
          targetStateChecksum: {
            kind: 'FACT',
            factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY
          },
          amount: { kind: 'LITERAL', value: 7 }
        }
      }
    ],
    outputs: {
      targetActorId: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'targetActorId' },
      naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'naturalD20' },
      total: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'total' },
      resultPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
      contributorChecksum: {
        kind: 'NODE_OUTPUT',
        nodeId: 'test',
        port: 'contributorChecksum'
      }
    },
    sourceEntryBindings: [{ sourceEntryId: ENTRY_ID, nodeId: SAVE_NODE_ID }]
  }
}

function runtime() {
  return createRulesRuntimeService({
    capabilities: [dnd5eEffectActionCapability],
    operations: [
      dnd5eHealProposalOperation,
      dnd5eTemporaryHitPointsProposalOperation,
      dnd5eDamageProposalOperation,
      dnd5eConditionApplyProposalOperation,
      integerRangeEvidenceRuleOperation,
      dnd5eSaveTestOperation,
      dnd5eTestHealProposalOperation
    ],
    continuationIntegrityKey: new Uint8Array(32).fill(1),
    definitions: {
      async requireCurrent() {
        throw new Error('Frozen active effects never read source definitions.')
      }
    }
  })
}

function savingThrowRuntime() {
  return createRulesRuntimeService({
    capabilities: [
      {
        ...dnd5eEffectActionCapability,
        factContracts: [
          ...dnd5eEffectActionCapability.factContracts,
          {
            key: DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
            valueKind: RULE_VALUE_KIND.TEXT
          },
          {
            key: DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY,
            valueKind: RULE_VALUE_KIND.TEXT
          }
        ]
      }
    ],
    operations: [
      integerRangeEvidenceRuleOperation,
      dnd5eHealProposalOperation,
      dnd5eTemporaryHitPointsProposalOperation,
      dnd5eDamageProposalOperation,
      dnd5eConditionApplyProposalOperation,
      dnd5eSaveTestOperation,
      dnd5eTestHealProposalOperation
    ],
    continuationIntegrityKey: new Uint8Array(32).fill(1),
    definitions: {
      async requireCurrent() {
        throw new Error('Frozen active effects never read source definitions.')
      }
    }
  })
}

async function activeDefinition(
  input: {
    remainingTicks?: number
    stage?: 'START_OF_TURN' | 'END_OF_TURN'
    outcome?: OutcomeKind
  } = {}
): Promise<{
  definition: ActiveRuleEffectDefinitionDto
  lifecycle: ActiveRuleEffectLifecycleDto
}> {
  const ruleRuntime = runtime()
  const graphDefinition = directDefinition(input.outcome)
  const published = serverPublishedRuleDefinitionDtoSchema.parse({
    id: EFFECT_ID,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    checksum: checksumRuleDocument(graphDefinition),
    definition: graphDefinition
  })
  const compiled = await ruleRuntime.executeResolvedWithGraph?.({
    command: {
      definitionId: EFFECT_ID,
      occurrenceId: OCCURRENCE_ID,
      facts: {
        [DND5E_TARGET_ACTOR_FACT_KEY]: TARGET_ID,
        [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: checksumRuleDocument({
          targetActorId: TARGET_ID,
          currentHitPoints: 3,
          temporaryHitPoints: 0,
          maximumHitPoints: 10,
          conditionIds: []
        }),
        [DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY]: false
      }
    },
    published
  })
  if (!compiled) throw new Error('Expected compiled frozen graph support.')
  const stage = input.stage ?? 'START_OF_TURN'
  const remainingTicks = input.remainingTicks ?? 2
  return {
    definition: activeRuleEffectDefinitionDtoSchema.parse({
      schemaVersion: 1,
      origin: {
        kind: 'CHARACTER',
        sourceAggregateId: TARGET_ID,
        sourceOccurrenceId: OCCURRENCE_ID,
        rootCommandId: OCCURRENCE_ID
      },
      authoredEffectId: EFFECT_ID,
      compiledEntryId: ENTRY_ID,
      frozenGraphNodeId: NODE_ID,
      frozenGraph: compiled.graph,
      adapterFacts: {},
      perceptionContributions: [],
      recurrence: {
        recurrenceStage: stage,
        consumeOnFirstEvent: null,
        endOnEvents: [],
        lifetimeScope: 'OWNER',
        expiration: {
          kind: 'TICKS',
          initialRemaining: 2,
          decrementStage: stage
        }
      }
    }),
    lifecycle: { schemaVersion: 1, remainingTicks }
  }
}

async function spatialSavingThrowDefinition(): Promise<{
  definition: ActiveRuleEffectDefinitionDto
  lifecycle: ActiveRuleEffectLifecycleDto
}> {
  const ruleRuntime = savingThrowRuntime()
  const graphDefinition = savingThrowDefinition()
  const published = serverPublishedRuleDefinitionDtoSchema.parse({
    id: EFFECT_ID,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    checksum: checksumRuleDocument(graphDefinition),
    definition: graphDefinition
  })
  const prepared = await ruleRuntime.executeResolvedWithGraph?.({
    command: {
      definitionId: EFFECT_ID,
      occurrenceId: OCCURRENCE_ID,
      facts: {
        [DND5E_TARGET_ACTOR_FACT_KEY]: TARGET_ID,
        [DND5E_SAVE_MODIFIER_FACT_KEY]: 0,
        [DND5E_SAVE_DC_FACT_KEY]: 10,
        [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: checksumRuleDocument([]),
        [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: checksumRuleDocument({
          targetActorId: TARGET_ID,
          currentHitPoints: 3,
          temporaryHitPoints: 0,
          maximumHitPoints: 10,
          conditionIds: []
        }),
        [DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY]: false
      }
    },
    published
  })
  if (!prepared) throw new Error('Expected compiled frozen graph support.')
  return {
    definition: activeRuleEffectDefinitionDtoSchema.parse({
      schemaVersion: 1,
      origin: {
        kind: 'ENCOUNTER',
        sourceAggregateId: EFFECT_ID,
        sourceOccurrenceId: OCCURRENCE_ID,
        rootCommandId: OCCURRENCE_ID,
        sourceActorId: TARGET_ID
      },
      authoredEffectId: EFFECT_ID,
      compiledEntryId: ENTRY_ID,
      frozenGraphNodeId: SAVE_NODE_ID,
      frozenGraph: prepared.graph,
      adapterFacts: {
        [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]: ABILITY_ID,
        [DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]: 'd20',
        [DND5E_SAVE_DC_FACT_KEY]: 10
      },
      perceptionContributions: [],
      recurrence: {
        recurrenceStage: 'NONE',
        consumeOnFirstEvent: null,
        endOnEvents: [],
        lifetimeScope: 'ENCOUNTER',
        expiration: { kind: 'INDEFINITE' }
      }
    }),
    lifecycle: { schemaVersion: 1, remainingTicks: null }
  }
}

async function execute(input?: {
  remainingTicks?: number
  stage?: 'START_OF_TURN' | 'END_OF_TURN'
  outcome?: OutcomeKind
  definition?: ActiveRuleEffectDefinitionDto
  defenses?: readonly { kind: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY'; damageTypeId: string }[]
  currentHitPoints?: number
  temporaryHitPoints?: number
  maximumHitPoints?: number
  targetScalarValues?: Readonly<Record<string, number>>
  lifecycleChecksum?: string
  activeEffectVersion?: number
  runtime?: RulesRuntimeService
  adapters?: ReturnType<typeof createCharacterRuleActionSystemAdapterRegistry>
  conditionImmunityIds?: readonly string[]
  targetDerivedFacts?: Readonly<Record<string, unknown>>
}) {
  const fixture = await activeDefinition({
    remainingTicks: input?.remainingTicks,
    outcome: input?.outcome
  })
  const definition = input?.definition ?? fixture.definition
  return executeCharacterActiveRuleEffect({
    activeEffectId: EFFECT_INSTANCE_ID,
    activeEffectVersion: input?.activeEffectVersion ?? 3,
    definition,
    lifecycle: fixture.lifecycle,
    lifecycleChecksum: input?.lifecycleChecksum ?? checksumRuleDocument(fixture.lifecycle),
    occurrenceId: OCCURRENCE_ID,
    stage: input?.stage ?? 'START_OF_TURN',
    targetActorId: TARGET_ID,
    currentHitPoints: input?.currentHitPoints ?? 3,
    temporaryHitPoints: input?.temporaryHitPoints ?? 0,
    maximumHitPoints: input?.maximumHitPoints ?? 10,
    targetScalarValues: input?.targetScalarValues ?? {},
    targetConditionIds: [],
    targetDerivedFacts: input?.targetDerivedFacts ?? {},
    defenses: input?.defenses ?? [],
    conditionImmunityIds: input?.conditionImmunityIds ?? [],
    runtime: input?.runtime ?? runtime(),
    adapters:
      input?.adapters ??
      createCharacterRuleActionSystemAdapterRegistry([dnd5eCharacterRuleActionSystemAdapter])
  })
}

describe('character active-rule-effect executor', () => {
  it('rejects protection-dependent unnormalized targets before runtime while allowing safe effects', async () => {
    const executeFrozen = vi.fn()
    await expect(
      execute({
        outcome: 'DAMAGE',
        targetDerivedFacts: { targetProtection: { status: 'NOT_NORMALIZED' } },
        runtime: { executeFrozen } as never
      })
    ).rejects.toThrow('protections are not normalized')
    expect(executeFrozen).not.toHaveBeenCalled()
    const conditionRuntime = { executeFrozen: vi.fn() }
    await expect(
      execute({
        outcome: 'CONDITION_APPLY',
        targetDerivedFacts: { targetProtection: { status: 'NOT_NORMALIZED' } },
        runtime: conditionRuntime as never
      })
    ).rejects.toThrow('protections are not normalized')
    expect(conditionRuntime.executeFrozen).not.toHaveBeenCalled()
    await expect(
      execute({
        outcome: 'HEAL',
        targetDerivedFacts: { targetProtection: { status: 'NOT_NORMALIZED' } }
      })
    ).resolves.toMatchObject({ applications: [expect.objectContaining({ kind: 'HEAL' })] })
    const temporaryRuntime = runtime()
    const temporarySpy = vi.spyOn(temporaryRuntime, 'executeFrozen')
    await expect(
      execute({
        outcome: 'TEMPORARY_HIT_POINTS',
        targetDerivedFacts: { targetProtection: { status: 'NOT_NORMALIZED' } },
        runtime: temporaryRuntime
      })
    ).resolves.toMatchObject({
      applications: [expect.objectContaining({ kind: 'TEMPORARY_HIT_POINTS' })]
    })
    expect(temporarySpy).toHaveBeenCalledTimes(1)
  })
  it('runs the exact frozen graph and returns current-state applications with an UPDATE proposal', async () => {
    await expect(execute()).resolves.toMatchObject({
      execution: {
        status: 'COMPLETE',
        evidence: {
          sourceEntryBindings: [{ sourceEntryId: ENTRY_ID, nodeId: NODE_ID }],
          trace: [expect.objectContaining({ nodeId: NODE_ID })]
        }
      },
      applications: [
        expect.objectContaining({
          kind: 'HEAL',
          targetActorId: TARGET_ID,
          beforeCurrentHitPoints: 3,
          afterCurrentHitPoints: 10,
          appliedAmount: 7
        })
      ],
      lifecycle: expect.objectContaining({
        kind: 'UPDATE',
        expectedVersion: 3,
        proposedAfterVersion: 4,
        beforeRemainingTicks: 2,
        afterRemainingTicks: 1
      })
    })
  })

  it('rejects an altered initial runtime graph before adapter application', async () => {
    const fixture = await activeDefinition()
    const baseRuntime = runtime()
    const interpretActiveEffect = vi.fn(dnd5eCharacterRuleActionSystemAdapter.interpretActiveEffect)
    const alteredRuntime: RulesRuntimeService = {
      ...baseRuntime,
      async executeFrozen(input) {
        const result = await baseRuntime.executeFrozen(input)
        return {
          ...result,
          graph: {
            ...result.graph,
            outputs: {
              ...result.graph.outputs,
              forged: { kind: 'LITERAL', value: true }
            }
          }
        }
      }
    }
    await expect(
      execute({
        definition: fixture.definition,
        runtime: alteredRuntime,
        adapters: createCharacterRuleActionSystemAdapterRegistry([
          { ...dnd5eCharacterRuleActionSystemAdapter, interpretActiveEffect }
        ])
      })
    ).rejects.toThrow('resumed active-effect graph does not match its frozen definition')
    expect(interpretActiveEffect).not.toHaveBeenCalled()
  })

  it('resumes the exact sealed active-effect context and reuses terminal interpretation', async () => {
    const fixture = await activeDefinition()
    let frozenInput: Parameters<RulesRuntimeService['executeFrozen']>[0] | null = null
    const baseRuntime = runtime()
    const pausingRuntime: RulesRuntimeService = {
      ...baseRuntime,
      async executeFrozen(input) {
        frozenInput = input
        return {
          graph: input.graph,
          result: {
            status: 'PAUSED',
            continuation: serverRuleExecutionContinuationDtoSchema.parse({
              schemaVersion: 1,
              occurrenceId: input.occurrenceId,
              graph: input.graph,
              facts: input.facts,
              nextNodeIndex: 0,
              nodeOutputs: {},
              trace: [],
              request: {
                requestId: 'active-effect-request',
                kind: 'INTEGER_RANGE',
                nodeId: NODE_ID,
                ordinal: 0,
                min: 1,
                max: 20
              },
              authority: 'APPLICATION_SERVICE',
              redaction: 'SERVER_ONLY',
              seal: 'a'.repeat(64)
            })
          }
        }
      }
    }
    const common = {
      activeEffectId: EFFECT_INSTANCE_ID,
      activeEffectVersion: 3,
      definition: fixture.definition,
      lifecycle: fixture.lifecycle,
      lifecycleChecksum: checksumRuleDocument(fixture.lifecycle),
      occurrenceId: OCCURRENCE_ID,
      stage: 'START_OF_TURN' as const,
      targetActorId: TARGET_ID,
      currentHitPoints: 3,
      temporaryHitPoints: 0,
      maximumHitPoints: 10,
      targetScalarValues: {},
      targetConditionIds: [] as const,
      targetDerivedFacts: {},
      defenses: [] as const,
      conditionImmunityIds: [] as const,
      adapters: createCharacterRuleActionSystemAdapterRegistry([
        dnd5eCharacterRuleActionSystemAdapter
      ])
    }
    const paused = await executeCharacterActiveRuleEffectWithPause({
      ...common,
      runtime: pausingRuntime
    })
    if (!('continuation' in paused) || !frozenInput) throw new Error('Expected a pause.')
    const completed = await baseRuntime.executeFrozen(frozenInput)
    if (completed.result.status !== 'COMPLETE')
      throw new Error('Expected terminal fixture evidence.')
    const reconstructionRuntime = { executeFrozen: vi.fn() }
    const reconstructed = reconstructCharacterActiveRuleEffectCompletion({
      executionInput: {
        ...common,
        runtime: reconstructionRuntime as unknown as RulesRuntimeService
      },
      execution: completed.result
    })
    expect(reconstructed).toMatchObject({
      applications: [expect.objectContaining({ kind: 'HEAL', appliedAmount: 7 })],
      lifecycle: expect.objectContaining({ kind: 'UPDATE', afterRemainingTicks: 1 })
    })
    expect(reconstructionRuntime.executeFrozen).not.toHaveBeenCalled()
    const resumeWithGraph = vi.fn(async () => completed)
    await expect(
      resumeCharacterActiveRuleEffectWithPause({
        ...common,
        runtime: { ...baseRuntime, resumeWithGraph },
        continuation: paused.continuation,
        resolution: { requestId: 'active-effect-request', rawFaces: [12] }
      })
    ).rejects.toThrow('no normalized d20 evidence policy')
    expect(resumeWithGraph).not.toHaveBeenCalled()
  })

  it('evaluates, pauses, resumes, and reconstructs an indefinite target-bound effect without lifecycle mutation', async () => {
    const fixture = await spatialSavingThrowDefinition()
    const baseRuntime = savingThrowRuntime()
    const common = {
      activeEffectId: EFFECT_INSTANCE_ID,
      activeEffectVersion: 3,
      definition: fixture.definition,
      lifecycle: fixture.lifecycle,
      lifecycleChecksum: checksumRuleDocument(fixture.lifecycle),
      occurrenceId: OCCURRENCE_ID,
      targetActorId: TARGET_ID,
      currentHitPoints: 3,
      temporaryHitPoints: 0,
      maximumHitPoints: 10,
      targetScalarValues: {},
      targetConditionIds: [] as const,
      targetDerivedFacts: {
        savingThrowDefinitions: [
          {
            abilityDefinitionId: ABILITY_ID,
            modifier: 0,
            rollMode: 'NORMAL' as const,
            contributors: []
          }
        ]
      },
      defenses: [] as const,
      conditionImmunityIds: [] as const,
      adapters: createCharacterRuleActionSystemAdapterRegistry([
        dnd5eCharacterRuleActionSystemAdapter
      ])
    }
    const paused = await executeTargetBoundActiveRuleEffectWithPause({
      ...common,
      runtime: baseRuntime
    })
    if (!('continuation' in paused)) throw new Error('Expected a target-bound pause.')
    const resumed = await resumeTargetBoundActiveRuleEffectWithPause({
      ...common,
      runtime: baseRuntime,
      continuation: paused.continuation,
      resolution: { requestId: paused.continuation.request.requestId, rawFaces: [5] },
      expectedEvidencePolicy: paused.evidencePolicy
    })
    if ('continuation' in resumed) throw new Error('Expected completed target-bound evidence.')
    const reconstructionRuntime = { executeFrozen: vi.fn() }
    const reconstructed = reconstructTargetBoundActiveRuleEffectCompletion({
      executionInput: {
        ...common,
        runtime: reconstructionRuntime as unknown as RulesRuntimeService
      },
      execution: resumed.execution,
      d20Evidence: {
        requestId: paused.continuation.request.requestId,
        rollMode: 'NORMAL',
        rawFaces: [5],
        selectedNatural: 5,
        contributors: [],
        contributorChecksum: checksumRuleDocument([]),
        modifier: 0,
        total: 5,
        defenseOrDc: 10,
        resultPath: 'ON_SAVE_FAIL'
      }
    })
    expect(reconstructed).toMatchObject({
      applications: [expect.objectContaining({ kind: 'HEAL', appliedAmount: 7 })],
      d20: expect.objectContaining({ rawFaces: [5] })
    })
    expect(reconstructed).not.toHaveProperty('lifecycle')
    expect(reconstructionRuntime.executeFrozen).not.toHaveBeenCalled()
    expect(resumed).toMatchObject({
      applications: [expect.objectContaining({ kind: 'HEAL', appliedAmount: 7 })],
      d20: expect.objectContaining({ rawFaces: [5] })
    })
    expect(resumed).not.toHaveProperty('lifecycle')
  })

  it('completes a recurring saving throw without an application on a successful save', async () => {
    const fixture = await spatialSavingThrowDefinition()
    const common = {
      activeEffectId: EFFECT_INSTANCE_ID,
      activeEffectVersion: 3,
      definition: fixture.definition,
      lifecycle: fixture.lifecycle,
      lifecycleChecksum: checksumRuleDocument(fixture.lifecycle),
      occurrenceId: OCCURRENCE_ID,
      targetActorId: TARGET_ID,
      currentHitPoints: 3,
      temporaryHitPoints: 0,
      maximumHitPoints: 10,
      targetScalarValues: {},
      targetConditionIds: [] as const,
      targetDerivedFacts: {
        savingThrowDefinitions: [
          {
            abilityDefinitionId: ABILITY_ID,
            modifier: 0,
            rollMode: 'NORMAL' as const,
            contributors: []
          }
        ]
      },
      defenses: [] as const,
      conditionImmunityIds: [] as const,
      adapters: createCharacterRuleActionSystemAdapterRegistry([
        dnd5eCharacterRuleActionSystemAdapter
      ])
    }
    const paused = await executeTargetBoundActiveRuleEffectWithPause({
      ...common,
      runtime: savingThrowRuntime()
    })
    if (!('continuation' in paused)) throw new Error('Expected a target-bound pause.')
    const resumed = await resumeTargetBoundActiveRuleEffectWithPause({
      ...common,
      runtime: savingThrowRuntime(),
      continuation: paused.continuation,
      resolution: { requestId: paused.continuation.request.requestId, rawFaces: [15] },
      expectedEvidencePolicy: paused.evidencePolicy
    })
    if ('continuation' in resumed) throw new Error('Expected completed target-bound evidence.')
    expect(resumed).toMatchObject({
      applications: [],
      d20: expect.objectContaining({ resultPath: 'ON_SAVE_SUCCESS' })
    })
  })

  it('returns an EXPIRY proposal without inventing an after-version', async () => {
    const result = await execute({ remainingTicks: 1 })
    expect(result.lifecycle).toEqual({
      kind: 'EXPIRE',
      activeEffectId: EFFECT_INSTANCE_ID,
      expectedVersion: 3,
      beforeRemainingTicks: 1,
      afterRemainingTicks: 0,
      beforeLifecycleChecksum: checksumRuleDocument({
        schemaVersion: 1,
        remainingTicks: 1
      })
    })
  })

  it('uses the exact current target state and defenses for each supported fixed outcome', async () => {
    await expect(execute({ outcome: 'TEMPORARY_HIT_POINTS' })).resolves.toMatchObject({
      applications: [
        expect.objectContaining({ kind: 'TEMPORARY_HIT_POINTS', afterTemporaryHitPoints: 7 })
      ]
    })
    await expect(
      execute({
        outcome: 'DAMAGE',
        defenses: [{ kind: 'IMMUNITY', damageTypeId: ENTRY_ID }]
      })
    ).resolves.toMatchObject({
      applications: [
        expect.objectContaining({
          kind: 'DAMAGE',
          damageDisposition: 'IMMUNE',
          resolvedAmount: 0,
          afterCurrentHitPoints: 3
        })
      ]
    })
    await expect(
      execute({
        outcome: 'DAMAGE',
        defenses: [{ kind: 'VULNERABILITY', damageTypeId: ENTRY_ID }]
      })
    ).resolves.toMatchObject({
      applications: [
        expect.objectContaining({
          kind: 'DAMAGE',
          damageDisposition: 'VULNERABLE',
          resolvedAmount: 14,
          afterCurrentHitPoints: 0
        })
      ]
    })
    await expect(
      execute({
        outcome: 'DAMAGE',
        defenses: [{ kind: 'RESISTANCE', damageTypeId: ENTRY_ID }]
      })
    ).resolves.toMatchObject({
      applications: [
        expect.objectContaining({ kind: 'DAMAGE', resolvedAmount: 3, afterCurrentHitPoints: 0 })
      ]
    })
    await expect(
      execute({
        outcome: 'DAMAGE',
        defenses: [
          { kind: 'RESISTANCE', damageTypeId: ENTRY_ID },
          { kind: 'VULNERABILITY', damageTypeId: ENTRY_ID }
        ]
      })
    ).resolves.toMatchObject({
      applications: [
        expect.objectContaining({
          kind: 'DAMAGE',
          damageDisposition: 'CANCELLED',
          resolvedAmount: 7,
          afterCurrentHitPoints: 0
        })
      ]
    })
    await expect(execute({ outcome: 'CONDITION_APPLY' })).resolves.toMatchObject({
      applications: [expect.objectContaining({ kind: 'CONDITION_APPLY', conditionId: ENTRY_ID })]
    })
    await expect(
      execute({ outcome: 'CONDITION_APPLY', conditionImmunityIds: [ENTRY_ID] })
    ).resolves.toMatchObject({ applications: [] })
  })

  it('fails closed before execution for a wrong stage or forged source-entry binding', async () => {
    await expect(execute({ stage: 'END_OF_TURN' })).rejects.toThrow(
      CharacterActiveRuleEffectExecutionError
    )
    const fixture = await activeDefinition()
    await expect(
      execute({
        definition: {
          ...fixture.definition,
          compiledEntryId: '00000000-0000-4000-8000-000000000199'
        }
      })
    ).rejects.toThrow()
  })

  it('rejects invalid target state, defenses, adapter, lifecycle checksum, and unsafe update versions before runtime execution', async () => {
    const actualRuntime = runtime()
    let executions = 0
    const guardedRuntime: RulesRuntimeService = {
      ...actualRuntime,
      async executeFrozen(frozen) {
        executions += 1
        return actualRuntime.executeFrozen(frozen)
      }
    }
    for (const invalidState of [
      { currentHitPoints: -1 },
      { currentHitPoints: 11 },
      { currentHitPoints: 1.5 },
      { temporaryHitPoints: -1 },
      { maximumHitPoints: 0 }
    ]) {
      await expect(execute({ ...invalidState, runtime: guardedRuntime })).rejects.toThrow(
        CharacterActiveRuleEffectExecutionError
      )
    }
    await expect(
      execute({
        runtime: guardedRuntime,
        defenses: [
          { kind: 'RESISTANCE', damageTypeId: ENTRY_ID },
          { kind: 'RESISTANCE', damageTypeId: ENTRY_ID }
        ]
      })
    ).rejects.toThrow(CharacterActiveRuleEffectExecutionError)
    await expect(
      execute({
        runtime: guardedRuntime,
        defenses: [
          {
            kind: 'RESISTANCE',
            damageTypeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'.toUpperCase()
          }
        ]
      })
    ).rejects.toThrow(CharacterActiveRuleEffectExecutionError)
    await expect(
      execute({
        runtime: guardedRuntime,
        lifecycleChecksum: 'a'.repeat(64)
      })
    ).rejects.toThrow(CharacterActiveRuleEffectExecutionError)
    await expect(
      execute({
        runtime: guardedRuntime,
        activeEffectVersion: Number.MAX_SAFE_INTEGER
      })
    ).rejects.toThrow(CharacterActiveRuleEffectExecutionError)
    await expect(
      execute({
        runtime: guardedRuntime,
        adapters: createCharacterRuleActionSystemAdapterRegistry([])
      })
    ).rejects.toThrow(CharacterActiveRuleEffectExecutionError)
    expect(executions).toBe(0)
  })

  it('fails closed for a paused or forged frozen execution and unsupported adapter application', async () => {
    const fixture = await activeDefinition()
    const paused: Extract<ServerRuleExecutionResultDto, { status: 'PAUSED' }> = {
      status: 'PAUSED',
      continuation: {
        schemaVersion: 1,
        occurrenceId: OCCURRENCE_ID,
        graph: fixture.definition.frozenGraph,
        facts: {
          [DND5E_TARGET_ACTOR_FACT_KEY]: TARGET_ID,
          [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: 'a'.repeat(64)
        },
        nextNodeIndex: 0,
        nodeOutputs: {},
        trace: [],
        request: {
          requestId: 'paused-request',
          kind: 'INTEGER_RANGE',
          nodeId: NODE_ID,
          ordinal: 0,
          min: 1,
          max: 20
        },
        authority: 'APPLICATION_SERVICE',
        redaction: 'SERVER_ONLY',
        seal: 'a'.repeat(64)
      }
    }
    const pausedRuntime: RulesRuntimeService = {
      ...runtime(),
      async executeFrozen() {
        return { result: paused, graph: fixture.definition.frozenGraph }
      }
    }
    await expect(
      execute({ definition: fixture.definition, runtime: pausedRuntime })
    ).rejects.toThrow(CharacterActiveRuleEffectExecutionError)

    const actualRuntime = runtime()
    const completed = await actualRuntime.executeFrozen({
      graph: fixture.definition.frozenGraph,
      occurrenceId: OCCURRENCE_ID,
      facts: {
        [DND5E_TARGET_ACTOR_FACT_KEY]: TARGET_ID,
        [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: checksumRuleDocument({
          targetActorId: TARGET_ID,
          currentHitPoints: 3,
          temporaryHitPoints: 0,
          maximumHitPoints: 10,
          conditionIds: []
        })
      }
    })
    if (completed.result.status !== 'COMPLETE') throw new Error('Expected completed execution.')
    const completedExecution = completed.result
    const forgedRuntime: RulesRuntimeService = {
      ...actualRuntime,
      async executeFrozen() {
        return {
          result: {
            ...completedExecution,
            evidence: { ...completedExecution.evidence, trace: [] }
          },
          graph: fixture.definition.frozenGraph
        }
      }
    }
    await expect(
      execute({ definition: fixture.definition, runtime: forgedRuntime })
    ).rejects.toThrow(CharacterActiveRuleEffectExecutionError)

    const unsupportedAdapter = {
      ...dnd5eCharacterRuleActionSystemAdapter,
      interpretActiveEffect() {
        return { applications: [], terminal: false }
      }
    }
    await expect(
      execute({
        definition: fixture.definition,
        adapters: createCharacterRuleActionSystemAdapterRegistry([unsupportedAdapter])
      })
    ).rejects.toThrow(CharacterActiveRuleEffectExecutionError)
  })
})
