import { beforeEach, describe, expect, it, vi } from 'vitest'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { EncounterRecord } from '@artificer-toolkit/db'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  encounter: '00000000-0000-4000-8000-000000000002',
  characterA: '00000000-0000-4000-8000-000000000003',
  characterB: '00000000-0000-4000-8000-000000000004',
  actorA: '00000000-0000-4000-8000-000000000005',
  actorB: '00000000-0000-4000-8000-000000000006',
  effectA: '00000000-0000-4000-8000-000000000007',
  effectB: '00000000-0000-4000-8000-000000000008',
  occurrence: '00000000-0000-4000-8000-000000000009',
  system: '00000000-0000-4000-8000-000000000010'
}

const state = vi.hoisted(() => ({
  list: vi.fn(),
  lockByOwner: vi.fn(),
  updateLifecycleCas: vi.fn(),
  deleteCas: vi.fn(),
  lockAssignment: vi.fn(),
  requireOverlay: vi.fn(),
  requireMechanics: vi.fn(),
  vocabulary: vi.fn(),
  updateActor: vi.fn(),
  execute: vi.fn(),
  executeWithPause: vi.fn(),
  resumeWithPause: vi.fn(),
  reconstruct: vi.fn(),
  apply: vi.fn(),
  context: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    checksumCanonicalJson: () => 'a'.repeat(64),
    createActiveRuleEffectRepository: () => ({
      list: state.list,
      lockByOwner: state.lockByOwner,
      updateLifecycleCas: state.updateLifecycleCas,
      deleteCas: state.deleteCas
    }),
    createCampaignCharacterMechanicsProjectionRepository: () => ({
      lockAssignment: state.lockAssignment,
      requireCurrent: state.requireOverlay
    }),
    createCharacterMechanicsProjectionRepository: () => ({
      requireCurrent: state.requireMechanics
    }),
    createSystemVocabularySnapshotRepository: () => ({ findById: state.vocabulary }),
    createEncounterRepository: () => ({ updateActor: state.updateActor })
  }
})

vi.mock('../character/campaignCharacterSheet.js', () => ({
  checksumCampaignCharacterMechanicalContext: () => 'b'.repeat(64),
  resolveCharacterLiveSessionRuleContext: state.context
}))
vi.mock('../campaign/campaignCharacterMechanicsProjection.js', () => ({
  CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION: 1
}))
vi.mock('../rules/characterRuleActionSystemAdapterRegistry.js', () => ({
  characterRuleActionSystemAdapterRegistry: {}
}))
vi.mock('../rules/characterActiveRuleEffectExecutor.js', () => ({
  executeCharacterActiveRuleEffect: state.execute,
  executeCharacterActiveRuleEffectWithPause: state.executeWithPause,
  resumeCharacterActiveRuleEffectWithPause: state.resumeWithPause,
  reconstructCharacterActiveRuleEffectCompletion: state.reconstruct
}))
vi.mock('@artificer-toolkit/shared/rules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/shared/rules')>()),
  checksumRuleDocument: () => 'c'.repeat(64)
}))
vi.mock('./encounterCharacterMechanicsBatch.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./encounterCharacterMechanicsBatch.js')>()),
  applyLockedEncounterCharacterMechanicsBatch: state.apply
}))

import {
  __testOnlyTurnEffectEvaluator,
  executeEncounterTurnCharacterActiveEffects,
  projectEncounterAfterEvaluatedTurnEffectBatch
} from './encounterCharacterActiveRuleEffectService.js'

function actor(id: string, characterId: string) {
  return {
    id,
    kind: 'CHARACTER',
    sourceId: characterId,
    sourceRevision: 4,
    systemId: ids.system,
    currentHitPoints: 5,
    tempHitPoints: 0,
    maxHitPoints: 10,
    conditions: []
  }
}

function creatureActor(id: string) {
  return {
    id,
    kind: 'CREATURE',
    sourceId: null,
    sourceRevision: 1,
    systemId: ids.system,
    currentHitPoints: 5,
    tempHitPoints: 0,
    maxHitPoints: 10,
    conditions: [{ conditionTypeId: '00000000-0000-4000-8000-000000000011', notes: 'preserve' }]
  }
}

function effect(id: string, stage: 'START_OF_TURN' | 'END_OF_TURN', ticks = 2, createdOrdinal = 1) {
  return {
    id,
    sourceEncounterId: null,
    createdOrdinal,
    version: 2,
    definitionChecksum: 'd'.repeat(64),
    lifecycleChecksum: 'e'.repeat(64),
    lifecycle: { schemaVersion: 1, remainingTicks: ticks },
    definition: {
      authoredEffectId: ids.effectA,
      compiledEntryId: ids.effectA,
      frozenGraphNodeId: 'effect-node',
      frozenGraph: {
        source: {
          definitionId: ids.effectA,
          gameSystemId: ids.system,
          definitionFamilyKey: 'effect',
          checksum: 'f'.repeat(64)
        },
        sourceEntryBindings: [{ sourceEntryId: ids.effectA, nodeId: 'effect-node' }],
        capabilityContractVersion: 1
      },
      recurrence: { recurrenceStage: stage, lifetimeScope: 'OWNER' }
    }
  }
}

function encounter(automationMode: 'AUTOMATIC' | 'ASSISTED' | 'MANUAL' = 'AUTOMATIC') {
  return {
    id: ids.encounter,
    campaignId: ids.campaign,
    gameSystemId: ids.system,
    automationMode,
    manualReminderMode: 'SUBTLE',
    actors: [actor(ids.actorA, ids.characterA), actor(ids.actorB, ids.characterB)]
  }
}

function db(characterIds: readonly string[] = [ids.characterA]) {
  let index = 0
  return {
    selectFrom: () => ({
      select: () => ({
        where: () => ({
          forUpdate: () => ({
            executeTakeFirst: async () => ({
              id: characterIds[index++] ?? ids.characterA,
              system_id: ids.system,
              stream_version: 4,
              status: 'ACTIVE'
            })
          })
        })
      })
    })
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  state.list.mockResolvedValue([])
  state.lockByOwner.mockResolvedValue([])
  state.lockAssignment.mockResolvedValue(undefined)
  state.requireMechanics.mockResolvedValue({
    characterStreamVersion: 4,
    projectionChecksum: 'g'.repeat(64),
    systemVocabularySnapshotId: ids.system,
    systemVocabularySnapshotVersion: 1,
    systemVocabularySnapshotChecksum: 'h'.repeat(64),
    commandState: { state: { hitpoints: { current: 5, temp: 0 }, conditions: [] } }
  })
  state.requireOverlay.mockResolvedValue({
    campaignId: ids.campaign,
    characterId: ids.characterA,
    characterStreamVersion: 4,
    baseMechanicsProjectionChecksum: 'g'.repeat(64),
    projectionSchemaVersion: 1,
    projectionChecksum: 'a'.repeat(64),
    mechanicalContextChecksum: 'b'.repeat(64),
    kind: 'MATERIALIZED',
    rulePolicyOutput: { derivedStats: { maxHitPoints: { effective: 10 } }, defenses: [] }
  })
  state.vocabulary.mockResolvedValue({
    systemId: ids.system,
    snapshotVersion: 1,
    checksum: 'h'.repeat(64),
    document: { conditionTypes: [] }
  })
  state.context.mockResolvedValue({ adjustments: [], attunementSlotOverride: null })
  state.apply.mockImplementation(async ({ targetActor, targetCharacterId, applications }) => ({
    updatedActor: targetActor,
    streamVersion: 5,
    finalState: {
      currentHitPoints: 5 + applications.length,
      temporaryHitPoints: 0,
      maximumHitPoints: 10,
      conditionIds: []
    },
    receiptApplications: [],
    targetTransition: {
      checksum: 'c'.repeat(64),
      before: {
        currentHitPoints: 5,
        temporaryHitPoints: 0,
        conditionIds: []
      },
      after: {
        currentHitPoints: 5 + applications.length,
        temporaryHitPoints: 0,
        conditionIds: []
      }
    },
    stateChanged: false,
    targetCharacterId
  }))
  state.execute.mockImplementation(async (input) => {
    const expires = input.lifecycle.remainingTicks === 1
    return {
      execution: {
        status: 'COMPLETE',
        outputs: { result: true },
        evidence: {
          source: {
            definitionId: ids.effectA,
            gameSystemId: ids.system,
            definitionFamilyKey: 'effect',
            checksum: 'f'.repeat(64)
          },
          capabilityContractVersion: 1,
          facts: {},
          sourceEntryBindings: [{ sourceEntryId: ids.effectA, nodeId: 'effect-node' }],
          trace: [
            {
              nodeId: 'effect-node',
              operation: { key: 'effect.apply', contractVersion: 1 },
              inputs: {},
              outputs: {
                targetActorId: input.targetActorId,
                amount: 1,
                resolvedPath: 'ON_USE',
                applicationCandidate: true,
                authorized: true,
                targetStateChecksum: 'c'.repeat(64)
              }
            }
          ],
          outputs: { result: true }
        }
      },
      applications: [
        {
          kind: 'HEAL',
          targetActorId: input.targetActorId,
          requestedAmount: 1,
          resolvedAmount: 1,
          appliedAmount: 1,
          beforeCurrentHitPoints: input.currentHitPoints,
          afterCurrentHitPoints: input.currentHitPoints + 1,
          beforeTemporaryHitPoints: input.temporaryHitPoints,
          afterTemporaryHitPoints: input.temporaryHitPoints,
          maximumHitPoints: input.maximumHitPoints,
          sourceNodeId: 'effect-node',
          sourceOperationKey: 'effect.apply',
          authoredPath: null,
          resolvedPath: 'ON_USE'
        }
      ],
      lifecycle: expires
        ? {
            kind: 'EXPIRE',
            expectedVersion: 2,
            beforeRemainingTicks: 1,
            afterRemainingTicks: 0,
            beforeLifecycleChecksum: 'e'.repeat(64)
          }
        : {
            kind: 'UPDATE',
            expectedVersion: 2,
            proposedAfterVersion: 3,
            beforeRemainingTicks: 2,
            afterRemainingTicks: 1,
            beforeLifecycleChecksum: 'e'.repeat(64),
            afterLifecycleChecksum: 'c'.repeat(64)
          }
    }
  })
  state.executeWithPause.mockImplementation(state.execute)
  state.resumeWithPause.mockImplementation(state.execute)
  state.reconstruct.mockImplementation(({ executionInput, execution }) => ({
    execution,
    applications: [
      {
        kind: 'HEAL',
        targetActorId: executionInput.targetActorId,
        requestedAmount: 1,
        resolvedAmount: 1,
        appliedAmount: 1,
        beforeCurrentHitPoints: executionInput.currentHitPoints,
        afterCurrentHitPoints: executionInput.currentHitPoints + 1,
        beforeTemporaryHitPoints: executionInput.temporaryHitPoints,
        afterTemporaryHitPoints: executionInput.temporaryHitPoints,
        maximumHitPoints: executionInput.maximumHitPoints,
        sourceNodeId: 'effect-node',
        sourceOperationKey: 'effect.apply',
        authoredPath: null,
        resolvedPath: 'ON_USE'
      }
    ],
    lifecycle: {
      kind: 'UPDATE',
      activeEffectId: executionInput.activeEffectId,
      expectedVersion: executionInput.activeEffectVersion,
      proposedAfterVersion: executionInput.activeEffectVersion + 1,
      beforeRemainingTicks: executionInput.lifecycle.remainingTicks,
      afterRemainingTicks: executionInput.lifecycle.remainingTicks - 1,
      beforeLifecycleChecksum: executionInput.lifecycleChecksum,
      afterLifecycle: {
        schemaVersion: 1,
        remainingTicks: executionInput.lifecycle.remainingTicks - 1
      },
      afterLifecycleChecksum: 'c'.repeat(64)
    }
  }))
})

function coordinatorRoot() {
  return {
    rootCommandId: ids.occurrence,
    commandFingerprint: 'b'.repeat(64),
    initiatorUserId: ids.characterA,
    correlationId: null,
    expectedEncounterVersion: 3,
    proposedTerminalTransition: { status: 'ACTIVE' as const, round: 1, currentActorId: ids.actorA }
  }
}

function assistedEvaluationInput(
  boundaries: readonly {
    ordinal: 0 | 1
    stage: 'START_OF_TURN' | 'END_OF_TURN'
    actorId: string | null
  }[]
) {
  return {
    trx: db() as never,
    actorUserId: ids.characterA,
    encounter: { ...encounter('ASSISTED'), version: 3 } as never,
    commandType: 'START' as const,
    boundaries,
    occurrenceId: ids.occurrence,
    runtime: {} as never,
    attunementSlotOverride: null,
    coordinatorRoot: coordinatorRoot()
  }
}

function pausedContinuation() {
  return {
    continuation: {
      schemaVersion: 1,
      occurrenceId: ids.occurrence,
      graph: {
        schemaVersion: 1,
        source: {
          definitionId: ids.effectA,
          gameSystemId: ids.system,
          definitionFamilyKey: 'effect',
          checksum: 'f'.repeat(64)
        },
        capabilityContractVersion: 1,
        factContracts: [],
        nodes: [
          { id: 'effect-node', operation: { key: 'effect.apply', contractVersion: 1 }, inputs: {} }
        ],
        outputs: { result: { kind: 'LITERAL', value: true } },
        sourceEntryBindings: [{ sourceEntryId: ids.effectA, nodeId: 'effect-node' }]
      },
      facts: {},
      nextNodeIndex: 0,
      nodeOutputs: {},
      trace: [],
      request: {
        requestId: 'effect-d20',
        kind: 'INTEGER_RANGE',
        nodeId: 'effect-node',
        ordinal: 0,
        min: 1,
        max: 20
      },
      authority: 'APPLICATION_SERVICE' as const,
      redaction: 'SERVER_ONLY' as const,
      seal: 'a'.repeat(64)
    }
  }
}

describe('encounter turn Character active effects', () => {
  it('replaces a repeated Assisted pause without terminal mutation', async () => {
    const active = effect(ids.effectA, 'START_OF_TURN')
    state.list.mockResolvedValue([active])
    state.lockByOwner.mockResolvedValue([active])
    state.executeWithPause.mockResolvedValue(pausedContinuation())
    const initial = await __testOnlyTurnEffectEvaluator.evaluate(
      assistedEvaluationInput([{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }])
    )
    expect(initial.kind).toBe('PENDING')
    if (initial.kind !== 'PENDING') return
    state.resumeWithPause.mockResolvedValue(pausedContinuation())
    const resumed = await __testOnlyTurnEffectEvaluator.evaluate({
      ...assistedEvaluationInput([{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }]),
      resume: {
        pendingSnapshot: initial.pendingSnapshot,
        resolution: { requestId: 'effect-d20', rawFaces: [12] }
      }
    })
    expect(resumed).toMatchObject({
      kind: 'PENDING',
      pendingSnapshot: {
        applicationContext: {
          currentCandidate: { activeEffectId: ids.effectA },
          completedExecutions: []
        }
      }
    })
    expect(state.resumeWithPause).toHaveBeenCalledTimes(1)
    expect(state.apply).not.toHaveBeenCalled()
    expect(state.updateActor).not.toHaveBeenCalled()
    expect(state.updateLifecycleCas).not.toHaveBeenCalled()
  })

  it('rebuilds the completed prefix before pausing a later Assisted candidate', async () => {
    const first = effect(ids.effectA, 'START_OF_TURN', 2, 1)
    const second = effect(ids.effectB, 'START_OF_TURN', 2, 2)
    state.list.mockResolvedValue([first, second])
    state.lockByOwner.mockResolvedValue([first, second])
    state.executeWithPause.mockImplementation(async (input) =>
      input.activeEffectId === ids.effectA ? state.execute(input) : pausedContinuation()
    )
    const initial = await __testOnlyTurnEffectEvaluator.evaluate(
      assistedEvaluationInput([{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }])
    )
    expect(initial.kind).toBe('PENDING')
    if (initial.kind !== 'PENDING') return
    expect(initial.pendingSnapshot.applicationContext).toMatchObject({
      kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS',
      currentCandidate: { ordinal: 1, activeEffectId: ids.effectB },
      completedExecutions: [{ ordinal: 0, activeEffectId: ids.effectA }]
    })
    state.resumeWithPause.mockImplementation(state.execute)
    const resumed = await __testOnlyTurnEffectEvaluator.evaluate({
      ...assistedEvaluationInput([{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }]),
      resume: {
        pendingSnapshot: initial.pendingSnapshot,
        resolution: { requestId: 'effect-d20', rawFaces: [12] }
      }
    })
    expect(resumed.kind).toBe('READY')
    if (resumed.kind === 'READY') {
      expect(resumed.batch.executions.map((entry) => entry.activeEffectId)).toEqual([
        ids.effectA,
        ids.effectB
      ])
    }
    expect(state.apply).not.toHaveBeenCalled()
    expect(state.updateActor).not.toHaveBeenCalled()
  })

  it('relocks and restores a staged terminal plan without re-executing or mutating it', async () => {
    const active = effect(ids.effectA, 'END_OF_TURN')
    state.list.mockResolvedValue([active])
    state.lockByOwner.mockResolvedValue([active])
    const input = assistedEvaluationInput([
      { ordinal: 0, stage: 'END_OF_TURN', actorId: ids.actorA }
    ])
    const initial = await __testOnlyTurnEffectEvaluator.evaluate(input)
    expect(initial.kind).toBe('READY')
    if (initial.kind !== 'READY') return

    state.executeWithPause.mockClear()
    const restored = await __testOnlyTurnEffectEvaluator.evaluate({
      ...input,
      stagedPlan: {
        selectionChecksum: initial.batch.selectionChecksum,
        executions: [...initial.batch.executions]
      }
    })

    expect(restored).toMatchObject({
      kind: 'READY',
      batch: { executions: [{ activeEffectId: ids.effectA }] }
    })
    expect(state.executeWithPause).not.toHaveBeenCalled()
    expect(state.apply).not.toHaveBeenCalled()
    expect(state.updateActor).not.toHaveBeenCalled()
    expect(state.updateLifecycleCas).not.toHaveBeenCalled()
  })

  it('rejects tampered stored prefix applications and frozen lifecycle pins before resume', async () => {
    const first = effect(ids.effectA, 'START_OF_TURN', 2, 1)
    const second = effect(ids.effectB, 'START_OF_TURN', 2, 2)
    state.list.mockResolvedValue([first, second])
    state.lockByOwner.mockResolvedValue([first, second])
    state.executeWithPause.mockImplementation(async (input) =>
      input.activeEffectId === ids.effectA ? state.execute(input) : pausedContinuation()
    )
    const initial = await __testOnlyTurnEffectEvaluator.evaluate(
      assistedEvaluationInput([{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }])
    )
    expect(initial.kind).toBe('PENDING')
    if (
      initial.kind !== 'PENDING' ||
      initial.pendingSnapshot.applicationContext.kind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
    ) {
      return
    }
    const context = initial.pendingSnapshot.applicationContext
    const execution = context.completedExecutions[0]!
    const tamperedApplication = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
      ...initial.pendingSnapshot,
      applicationContext: {
        ...context,
        completedExecutions: [
          {
            ...execution,
            applications: [
              {
                ...execution.applications[0]!,
                requestedAmount: 2,
                resolvedAmount: 2,
                appliedAmount: 2,
                afterCurrentHitPoints: 7
              }
            ],
            targetTransition: {
              ...execution.targetTransition,
              after: { ...execution.targetTransition.after, currentHitPoints: 7 }
            }
          }
        ]
      }
    })
    await expect(
      __testOnlyTurnEffectEvaluator.evaluate({
        ...assistedEvaluationInput([{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }]),
        resume: {
          pendingSnapshot: tamperedApplication,
          resolution: { requestId: 'effect-d20', rawFaces: [12] }
        }
      })
    ).rejects.toThrow('completed prefix')
    const tamperedLifecycle = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
      ...initial.pendingSnapshot,
      applicationContext: {
        ...context,
        completedExecutions: [
          {
            ...execution,
            lifecycle: { ...execution.lifecycle, afterVersion: 99 }
          }
        ]
      }
    })
    await expect(
      __testOnlyTurnEffectEvaluator.evaluate({
        ...assistedEvaluationInput([{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }]),
        resume: {
          pendingSnapshot: tamperedLifecycle,
          resolution: { requestId: 'effect-d20', rawFaces: [12] }
        }
      })
    ).rejects.toThrow('completed prefix')
    expect(state.resumeWithPause).not.toHaveBeenCalled()
    expect(state.apply).not.toHaveBeenCalled()
  })

  it('requires the independently verified coordinator root to exactly match the sealed batch root', async () => {
    const active = effect(ids.effectA, 'START_OF_TURN')
    state.list.mockResolvedValue([active])
    state.lockByOwner.mockResolvedValue([active])
    state.executeWithPause.mockResolvedValue(pausedContinuation())
    const initial = await __testOnlyTurnEffectEvaluator.evaluate(
      assistedEvaluationInput([{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }])
    )
    expect(initial.kind).toBe('PENDING')
    if (initial.kind !== 'PENDING') return
    await expect(
      __testOnlyTurnEffectEvaluator.evaluate({
        ...assistedEvaluationInput([{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }]),
        coordinatorRoot: {
          ...coordinatorRoot(),
          commandFingerprint: 'd'.repeat(64),
          proposedTerminalTransition: { status: 'COMPLETED', round: 2, currentActorId: null }
        },
        resume: {
          pendingSnapshot: initial.pendingSnapshot,
          resolution: { requestId: 'effect-d20', rawFaces: [12] }
        }
      })
    ).rejects.toThrow('batch is stale')
    expect(state.resumeWithPause).not.toHaveBeenCalled()
    expect(state.apply).not.toHaveBeenCalled()
  })

  it('rejects stale pending candidate pins before resuming its runtime', async () => {
    const active = effect(ids.effectA, 'START_OF_TURN')
    state.list.mockResolvedValue([active])
    state.lockByOwner.mockResolvedValue([active])
    state.executeWithPause.mockResolvedValue(pausedContinuation())
    const initial = await __testOnlyTurnEffectEvaluator.evaluate(
      assistedEvaluationInput([{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }])
    )
    expect(initial.kind).toBe('PENDING')
    if (initial.kind !== 'PENDING') return
    const stale = { ...active, version: active.version + 1 }
    state.list.mockResolvedValue([stale])
    state.lockByOwner.mockResolvedValue([stale])
    await expect(
      __testOnlyTurnEffectEvaluator.evaluate({
        ...assistedEvaluationInput([{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }]),
        resume: {
          pendingSnapshot: initial.pendingSnapshot,
          resolution: { requestId: 'effect-d20', rawFaces: [12] }
        }
      })
    ).rejects.toThrow('current candidate is stale')
    expect(state.resumeWithPause).not.toHaveBeenCalled()
    expect(state.apply).not.toHaveBeenCalled()
  })

  it('rejects a changed Character projection pin or selection before resuming runtime', async () => {
    const active = effect(ids.effectA, 'START_OF_TURN')
    state.list.mockResolvedValue([active])
    state.lockByOwner.mockResolvedValue([active])
    state.executeWithPause.mockResolvedValue(pausedContinuation())
    const initial = await __testOnlyTurnEffectEvaluator.evaluate(
      assistedEvaluationInput([{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }])
    )
    expect(initial.kind).toBe('PENDING')
    if (initial.kind !== 'PENDING') return
    state.requireOverlay.mockResolvedValue({
      ...(await state.requireOverlay.mock.results[0]!.value),
      projectionChecksum: 'd'.repeat(64)
    })
    await expect(
      __testOnlyTurnEffectEvaluator.evaluate({
        ...assistedEvaluationInput([{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }]),
        resume: {
          pendingSnapshot: initial.pendingSnapshot,
          resolution: { requestId: 'effect-d20', rawFaces: [12] }
        }
      })
    ).rejects.toThrow('current candidate is stale')
    const staleSelection = {
      ...initial.pendingSnapshot,
      applicationContext: {
        ...initial.pendingSnapshot.applicationContext,
        selectionChecksum: 'd'.repeat(64)
      }
    }
    state.requireOverlay.mockResolvedValue(await state.requireOverlay.mock.results[0]!.value)
    await expect(
      __testOnlyTurnEffectEvaluator.evaluate({
        ...assistedEvaluationInput([{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }]),
        resume: {
          pendingSnapshot: staleSelection,
          resolution: { requestId: 'effect-d20', rawFaces: [12] }
        }
      })
    ).rejects.toThrow('batch is stale')
    expect(state.resumeWithPause).not.toHaveBeenCalled()
  })

  it('returns a sealed Assisted turn-effect pending snapshot before any terminal mutation', async () => {
    const active = effect(ids.effectA, 'START_OF_TURN')
    state.list.mockResolvedValue([active])
    state.lockByOwner.mockResolvedValue([active])
    state.executeWithPause.mockResolvedValue({
      continuation: {
        schemaVersion: 1,
        occurrenceId: ids.occurrence,
        graph: {
          schemaVersion: 1,
          source: {
            definitionId: ids.effectA,
            gameSystemId: ids.system,
            definitionFamilyKey: 'effect',
            checksum: 'f'.repeat(64)
          },
          capabilityContractVersion: 1,
          factContracts: [],
          nodes: [
            {
              id: 'effect-node',
              operation: { key: 'effect.apply', contractVersion: 1 },
              inputs: {}
            }
          ],
          outputs: { result: { kind: 'LITERAL', value: true } },
          sourceEntryBindings: [{ sourceEntryId: ids.effectA, nodeId: 'effect-node' }]
        },
        facts: {},
        nextNodeIndex: 0,
        nodeOutputs: {},
        trace: [],
        request: {
          requestId: 'effect-d20',
          kind: 'INTEGER_RANGE',
          nodeId: 'effect-node',
          ordinal: 0,
          min: 1,
          max: 20
        },
        authority: 'APPLICATION_SERVICE',
        redaction: 'SERVER_ONLY',
        seal: 'a'.repeat(64)
      }
    })
    const evaluation = await __testOnlyTurnEffectEvaluator.evaluate({
      trx: db() as never,
      actorUserId: ids.characterA,
      encounter: encounter('ASSISTED') as never,
      commandType: 'START',
      boundaries: [{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }],
      occurrenceId: ids.occurrence,
      runtime: {} as never,
      attunementSlotOverride: null,
      coordinatorRoot: {
        rootCommandId: ids.occurrence,
        commandFingerprint: 'b'.repeat(64),
        initiatorUserId: ids.characterA,
        correlationId: null,
        expectedEncounterVersion: 3,
        proposedTerminalTransition: { status: 'ACTIVE', round: 1, currentActorId: ids.actorA }
      }
    })
    expect(evaluation).toMatchObject({
      kind: 'PENDING',
      pendingSnapshot: {
        applicationContext: {
          kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS',
          selectionChecksum: 'a'.repeat(64),
          completedExecutions: [],
          remainingCandidates: [],
          currentCandidate: {
            ordinal: 0,
            activeEffectId: ids.effectA,
            owner: { characterId: ids.characterA }
          }
        }
      }
    })
    expect(state.apply).not.toHaveBeenCalled()
    expect(state.updateActor).not.toHaveBeenCalled()
    expect(state.updateLifecycleCas).not.toHaveBeenCalled()
    expect(state.deleteCas).not.toHaveBeenCalled()
  })

  it('leaves a no-effect turn on the existing path without runtime or Character work', async () => {
    await expect(
      executeEncounterTurnCharacterActiveEffects({
        trx: db() as never,
        actorUserId: ids.characterA,
        encounter: encounter() as never,
        commandType: 'START',
        boundaries: [{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }],
        occurrenceId: ids.occurrence,
        attunementSlotOverride: null
      })
    ).resolves.toEqual({ result: null, selectionChecksum: null })
    expect(state.execute).not.toHaveBeenCalled()
    expect(state.apply).not.toHaveBeenCalled()
  })

  it('records a Manual subtle turn as a generic inert receipt', async () => {
    const active = effect(ids.effectA, 'START_OF_TURN')
    state.list.mockResolvedValue([active])
    state.lockByOwner.mockResolvedValue([active])
    state.requireMechanics.mockRejectedValue(new Error('must stay inert'))
    state.requireOverlay.mockRejectedValue(new Error('must stay inert'))
    state.vocabulary.mockRejectedValue(new Error('must stay inert'))
    const result = await executeEncounterTurnCharacterActiveEffects({
      trx: db() as never,
      actorUserId: ids.characterA,
      encounter: encounter('MANUAL') as never,
      commandType: 'START',
      boundaries: [{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }],
      occurrenceId: ids.occurrence,
      attunementSlotOverride: null
    })
    expect(result.result).toMatchObject({
      status: 'MANUAL',
      reminder: { kind: 'MANUAL_RULE_REVIEW' }
    })
    expect(state.execute).not.toHaveBeenCalled()
    expect(state.apply).not.toHaveBeenCalled()
    expect(state.updateLifecycleCas).not.toHaveBeenCalled()
    expect(state.requireMechanics).not.toHaveBeenCalled()
    expect(state.requireOverlay).not.toHaveBeenCalled()
    expect(state.vocabulary).not.toHaveBeenCalled()
  })

  it('keeps Manual OFF inert without a receipt', async () => {
    const active = effect(ids.effectA, 'START_OF_TURN')
    state.list.mockResolvedValue([active])
    state.lockByOwner.mockResolvedValue([active])
    state.requireMechanics.mockRejectedValue(new Error('must stay inert'))
    state.requireOverlay.mockRejectedValue(new Error('must stay inert'))
    state.vocabulary.mockRejectedValue(new Error('must stay inert'))
    const manual = { ...encounter('MANUAL'), manualReminderMode: 'OFF' as const }
    await expect(
      executeEncounterTurnCharacterActiveEffects({
        trx: db() as never,
        actorUserId: ids.characterA,
        encounter: manual as never,
        commandType: 'START',
        boundaries: [{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }],
        occurrenceId: ids.occurrence,
        attunementSlotOverride: null
      })
    ).resolves.toMatchObject({ result: null })
    expect(state.execute).not.toHaveBeenCalled()
    expect(state.apply).not.toHaveBeenCalled()
    expect(state.requireMechanics).not.toHaveBeenCalled()
    expect(state.requireOverlay).not.toHaveBeenCalled()
    expect(state.vocabulary).not.toHaveBeenCalled()
  })

  it('requires runtime before Character or effect mutation for an eligible automatic turn', async () => {
    const active = effect(ids.effectA, 'START_OF_TURN')
    state.list.mockResolvedValue([active])
    state.lockByOwner.mockResolvedValue([active])
    await expect(
      executeEncounterTurnCharacterActiveEffects({
        trx: db() as never,
        actorUserId: ids.characterA,
        encounter: encounter() as never,
        commandType: 'START',
        boundaries: [{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }],
        occurrenceId: ids.occurrence,
        attunementSlotOverride: null
      })
    ).rejects.toThrow('Rules runtime')
    expect(state.apply).not.toHaveBeenCalled()
    expect(state.updateLifecycleCas).not.toHaveBeenCalled()
  })

  it('executes an automatic START effect once, advances the Character once, and CAS-updates lifecycle', async () => {
    const active = effect(ids.effectA, 'START_OF_TURN')
    state.list.mockResolvedValue([active])
    state.lockByOwner.mockResolvedValue([active])
    const result = await executeEncounterTurnCharacterActiveEffects({
      trx: db() as never,
      actorUserId: ids.characterA,
      encounter: encounter() as never,
      commandType: 'START',
      boundaries: [{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }],
      occurrenceId: ids.occurrence,
      runtime: {} as never,
      attunementSlotOverride: null
    })
    expect(result.result).toMatchObject({
      status: 'BATCH_COMPLETE',
      commandType: 'START',
      executions: [
        {
          ordinal: 0,
          boundaryOrdinal: 0,
          stage: 'START_OF_TURN',
          targetActorId: ids.actorA,
          owner: { kind: 'CHARACTER', characterId: ids.characterA },
          activeEffectId: ids.effectA,
          lifecycle: {
            kind: 'UPDATE',
            expectedVersion: 2,
            afterVersion: 3,
            beforeRemainingTicks: 2,
            afterRemainingTicks: 1
          }
        }
      ],
      characterTransitions: [
        {
          characterId: ids.characterA,
          targetActorId: ids.actorA,
          beforeStreamVersion: 4,
          afterStreamVersion: 5
        }
      ]
    })
    expect(state.execute).toHaveBeenCalledTimes(1)
    expect(state.apply).toHaveBeenCalledTimes(1)
    expect(state.updateLifecycleCas).toHaveBeenCalledWith(
      expect.objectContaining({ id: ids.effectA, expectedVersion: 2 })
    )
    expect(state.deleteCas).not.toHaveBeenCalled()
    expect(state.updateActor).toHaveBeenCalledTimes(1)
    expect(state.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        targetActor: expect.objectContaining({ id: ids.actorA }),
        targetCharacterId: ids.characterA,
        effectiveMaximumHitPoints: 10,
        forceVersionAdvance: true,
        applications: [
          expect.objectContaining({
            kind: 'HEAL',
            targetActorId: ids.actorA,
            requestedAmount: 1,
            resolvedAmount: 1,
            appliedAmount: 1,
            beforeCurrentHitPoints: 5,
            afterCurrentHitPoints: 6,
            sourceNodeId: 'effect-node',
            sourceOperationKey: 'effect.apply',
            resolvedPath: 'ON_USE'
          })
        ]
      })
    )
  })

  it('finishes evaluation before the terminal applicator mutates state', async () => {
    const active = effect(ids.effectA, 'START_OF_TURN')
    state.list.mockResolvedValue([active])
    state.lockByOwner.mockResolvedValue([active])
    const terminalBoundary = vi.fn(async () => {
      throw new Error('terminal boundary')
    })
    await expect(
      executeEncounterTurnCharacterActiveEffects({
        trx: db() as never,
        actorUserId: ids.characterA,
        encounter: encounter() as never,
        commandType: 'START',
        boundaries: [{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }],
        occurrenceId: ids.occurrence,
        runtime: {} as never,
        attunementSlotOverride: null,
        beforeTerminalApply: terminalBoundary
      })
    ).rejects.toThrow('terminal boundary')
    expect(state.execute).toHaveBeenCalledTimes(1)
    expect(terminalBoundary).toHaveBeenCalledTimes(1)
    expect(state.apply).not.toHaveBeenCalled()
    expect(state.updateActor).not.toHaveBeenCalled()
    expect(state.updateLifecycleCas).not.toHaveBeenCalled()
    expect(state.deleteCas).not.toHaveBeenCalled()
  })

  it('expires a tick-one effect rather than updating its lifecycle', async () => {
    const active = effect(ids.effectA, 'START_OF_TURN', 1)
    state.list.mockResolvedValue([active])
    state.lockByOwner.mockResolvedValue([active])
    await executeEncounterTurnCharacterActiveEffects({
      trx: db() as never,
      actorUserId: ids.characterA,
      encounter: encounter() as never,
      commandType: 'START',
      boundaries: [{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }],
      occurrenceId: ids.occurrence,
      runtime: {} as never,
      attunementSlotOverride: null
    })
    expect(state.deleteCas).toHaveBeenCalledWith(
      expect.objectContaining({ id: ids.effectA, expectedVersion: 2 })
    )
    expect(state.updateLifecycleCas).not.toHaveBeenCalled()
  })

  it('records an authenticated suppressed condition with no application while advancing Character lifecycle state', async () => {
    const active = effect(ids.effectA, 'START_OF_TURN')
    state.list.mockResolvedValue([active])
    state.lockByOwner.mockResolvedValue([active])
    state.execute.mockImplementationOnce(async (input) => ({
      execution: {
        status: 'COMPLETE',
        outputs: {},
        evidence: {
          source: {
            definitionId: ids.effectA,
            gameSystemId: ids.system,
            definitionFamilyKey: 'effect',
            checksum: 'f'.repeat(64)
          },
          capabilityContractVersion: 1,
          facts: {},
          sourceEntryBindings: [{ sourceEntryId: ids.effectA, nodeId: 'effect-node' }],
          trace: [
            {
              nodeId: 'effect-node',
              operation: { key: 'effect.apply', contractVersion: 1 },
              inputs: {},
              outputs: {
                targetActorId: input.targetActorId,
                conditionId: '00000000-0000-4000-8000-000000000011',
                resolvedPath: 'ON_USE',
                applicationCandidate: true,
                authorized: false,
                targetStateChecksum: 'c'.repeat(64)
              }
            }
          ],
          outputs: {}
        }
      },
      applications: [],
      lifecycle: {
        kind: 'UPDATE',
        expectedVersion: 2,
        proposedAfterVersion: 3,
        beforeRemainingTicks: 2,
        afterRemainingTicks: 1,
        beforeLifecycleChecksum: 'e'.repeat(64),
        afterLifecycleChecksum: 'a'.repeat(64)
      }
    }))
    const result = await executeEncounterTurnCharacterActiveEffects({
      trx: db() as never,
      actorUserId: ids.characterA,
      encounter: encounter() as never,
      commandType: 'START',
      boundaries: [{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }],
      occurrenceId: ids.occurrence,
      runtime: {} as never,
      attunementSlotOverride: null
    })
    expect(result.result).toMatchObject({
      status: 'BATCH_COMPLETE',
      executions: [{ applications: [] }]
    })
    expect(state.apply).toHaveBeenCalledWith(
      expect.objectContaining({ applications: [], forceVersionAdvance: true })
    )
    expect(state.updateLifecycleCas).toHaveBeenCalledTimes(1)
  })

  it('executes a Creature-owned effect once and persists one Encounter actor transition', async () => {
    const target = creatureActor(ids.actorA)
    const active = effect(ids.effectA, 'START_OF_TURN')
    state.list.mockResolvedValue([active])
    state.lockByOwner.mockResolvedValue([active])
    const result = await executeEncounterTurnCharacterActiveEffects({
      trx: db() as never,
      actorUserId: ids.characterA,
      encounter: { ...encounter(), actors: [target] } as never,
      commandType: 'START',
      boundaries: [{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }],
      occurrenceId: ids.occurrence,
      runtime: {} as never,
      attunementSlotOverride: null,
      getEncounterActorSnapshot: async () => ({
        encounter: { ...encounter(), actors: [target] } as never,
        rules: {
          actors: [
            {
              actorId: ids.actorA,
              initiativeModifier: 0,
              targetProtection: { status: 'NORMALIZED', defenses: [], conditionImmunityIds: [] },
              featureResources: []
            }
          ]
        }
      })
    })
    expect(result.result).toMatchObject({
      status: 'BATCH_COMPLETE',
      executions: [{ owner: { kind: 'ENCOUNTER_ACTOR' }, targetActorId: ids.actorA }],
      characterTransitions: [],
      encounterActorTransitions: [{ targetActorId: ids.actorA }]
    })
    expect(state.apply).not.toHaveBeenCalled()
    expect(state.updateActor).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ids.actorA,
        currentHitPoints: 6,
        conditions: [expect.objectContaining({ notes: 'preserve' })]
      })
    )
    expect(state.updateLifecycleCas).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ids.encounter, targetActorId: ids.actorA }
      })
    )
  })

  it('uses reconciled Encounter actor state and matching Encounter-lifetime provenance', async () => {
    const target = { ...creatureActor(ids.actorA), resources: { charges: { used: 0 } } }
    const active = {
      ...effect(ids.effectA, 'START_OF_TURN'),
      definition: {
        ...effect(ids.effectA, 'START_OF_TURN').definition,
        origin: { kind: 'ENCOUNTER', sourceAggregateId: ids.encounter },
        recurrence: { recurrenceStage: 'START_OF_TURN', lifetimeScope: 'ENCOUNTER' }
      }
    }
    const reconciled = { ...target, resources: { charges: { used: 2 } } }
    state.list.mockResolvedValue([active])
    state.lockByOwner.mockResolvedValue([active])
    await executeEncounterTurnCharacterActiveEffects({
      trx: db() as never,
      actorUserId: ids.characterA,
      encounter: { ...encounter(), actors: [target] } as never,
      commandType: 'START',
      boundaries: [{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }],
      occurrenceId: ids.occurrence,
      runtime: {} as never,
      attunementSlotOverride: null,
      getEncounterActorSnapshot: async () => ({
        encounter: { ...encounter(), actors: [reconciled] } as never,
        rules: {
          actors: [
            {
              actorId: ids.actorA,
              initiativeModifier: 0,
              targetProtection: { status: 'NORMALIZED', defenses: [], conditionImmunityIds: [] },
              featureResources: []
            }
          ]
        }
      })
    })
    expect(state.updateActor).toHaveBeenCalledWith(
      expect.objectContaining({
        resources: { charges: { used: 2 } },
        currentHitPoints: 6
      })
    )
  })

  it('records a suppressed Creature condition without an unnecessary actor write', async () => {
    const target = creatureActor(ids.actorA)
    const active = effect(ids.effectA, 'START_OF_TURN')
    state.list.mockResolvedValue([active])
    state.lockByOwner.mockResolvedValue([active])
    state.execute.mockImplementationOnce(async (input) => ({
      execution: {
        status: 'COMPLETE',
        outputs: {},
        evidence: {
          source: {
            definitionId: ids.effectA,
            gameSystemId: ids.system,
            definitionFamilyKey: 'effect',
            checksum: 'f'.repeat(64)
          },
          capabilityContractVersion: 1,
          facts: {},
          sourceEntryBindings: [{ sourceEntryId: ids.effectA, nodeId: 'effect-node' }],
          trace: [
            {
              nodeId: 'effect-node',
              operation: { key: 'effect.apply', contractVersion: 1 },
              inputs: {},
              outputs: {
                targetActorId: input.targetActorId,
                conditionId: '00000000-0000-4000-8000-000000000011',
                resolvedPath: 'ON_USE',
                applicationCandidate: true,
                authorized: false,
                targetStateChecksum: 'c'.repeat(64)
              }
            }
          ],
          outputs: {}
        }
      },
      applications: [],
      lifecycle: {
        kind: 'UPDATE',
        expectedVersion: 2,
        proposedAfterVersion: 3,
        beforeRemainingTicks: 2,
        afterRemainingTicks: 1,
        beforeLifecycleChecksum: 'e'.repeat(64),
        afterLifecycleChecksum: 'a'.repeat(64)
      }
    }))
    const result = await executeEncounterTurnCharacterActiveEffects({
      trx: db() as never,
      actorUserId: ids.characterA,
      encounter: { ...encounter(), actors: [target] } as never,
      commandType: 'START',
      boundaries: [{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }],
      occurrenceId: ids.occurrence,
      runtime: {} as never,
      attunementSlotOverride: null,
      getEncounterActorSnapshot: async () => ({
        encounter: { ...encounter(), actors: [target] } as never,
        rules: {
          actors: [
            {
              actorId: ids.actorA,
              initiativeModifier: 0,
              targetProtection: { status: 'NORMALIZED', defenses: [], conditionImmunityIds: [] },
              featureResources: []
            }
          ]
        }
      })
    })
    expect(result.result).toMatchObject({
      status: 'BATCH_COMPLETE',
      encounterActorTransitions: [{ targetActorId: ids.actorA }]
    })
    expect(state.updateActor).not.toHaveBeenCalled()
    expect(state.updateLifecycleCas).toHaveBeenCalledTimes(1)
  })

  it('orders ADVANCE boundaries END then START and batches one Character once', async () => {
    const end = effect(ids.effectA, 'END_OF_TURN', 2, 2)
    const start = effect(ids.effectB, 'START_OF_TURN', 2, 1)
    state.list.mockResolvedValue([end, start])
    state.lockByOwner.mockResolvedValue([end, start])
    const result = await executeEncounterTurnCharacterActiveEffects({
      trx: db() as never,
      actorUserId: ids.characterA,
      encounter: encounter() as never,
      commandType: 'ADVANCE_TURN',
      boundaries: [
        { ordinal: 0, stage: 'END_OF_TURN', actorId: ids.actorA },
        { ordinal: 1, stage: 'START_OF_TURN', actorId: ids.actorA }
      ],
      occurrenceId: ids.occurrence,
      runtime: {} as never,
      attunementSlotOverride: null
    })
    expect(state.execute.mock.calls.map(([input]) => input.stage)).toEqual([
      'END_OF_TURN',
      'START_OF_TURN'
    ])
    expect(result.result).toMatchObject({
      status: 'BATCH_COMPLETE',
      executions: [
        { ordinal: 0, boundaryOrdinal: 0, stage: 'END_OF_TURN' },
        { ordinal: 1, boundaryOrdinal: 1, stage: 'START_OF_TURN' }
      ],
      characterTransitions: [{ characterId: ids.characterA, targetActorId: ids.actorA }]
    })
    expect(state.apply).toHaveBeenCalledTimes(1)
  })

  it('does not load an outgoing Character without an eligible effect before an incoming effect', async () => {
    const incoming = effect(ids.effectB, 'START_OF_TURN')
    state.list.mockImplementation(async ({ characterId }) =>
      characterId === ids.characterB ? [incoming] : []
    )
    state.lockByOwner.mockImplementation(async ({ characterId }) =>
      characterId === ids.characterB ? [incoming] : []
    )
    state.requireMechanics.mockImplementation(async ({ characterId }) => {
      if (characterId === ids.characterA) throw new Error('outgoing mechanics unavailable')
      return {
        characterStreamVersion: 4,
        projectionChecksum: 'g'.repeat(64),
        systemVocabularySnapshotId: ids.system,
        systemVocabularySnapshotVersion: 1,
        systemVocabularySnapshotChecksum: 'h'.repeat(64),
        commandState: { state: { hitpoints: { current: 5, temp: 0 }, conditions: [] } }
      }
    })
    await expect(
      executeEncounterTurnCharacterActiveEffects({
        trx: db([ids.characterB]) as never,
        actorUserId: ids.characterA,
        encounter: encounter() as never,
        commandType: 'ADVANCE_TURN',
        boundaries: [
          { ordinal: 0, stage: 'END_OF_TURN', actorId: ids.actorA },
          { ordinal: 1, stage: 'START_OF_TURN', actorId: ids.actorB }
        ],
        occurrenceId: ids.occurrence,
        runtime: {} as never,
        attunementSlotOverride: null
      })
    ).resolves.toMatchObject({ result: { status: 'BATCH_COMPLETE' } })
    expect(state.requireMechanics).toHaveBeenCalledWith(
      expect.objectContaining({ characterId: ids.characterB })
    )
  })

  it('rejects malformed executor evidence before returning a Batch receipt', async () => {
    const active = effect(ids.effectA, 'START_OF_TURN')
    state.list.mockResolvedValue([active])
    state.lockByOwner.mockResolvedValue([active])
    const valid = await state.execute({
      targetActorId: ids.actorA,
      currentHitPoints: 5,
      temporaryHitPoints: 0,
      maximumHitPoints: 10,
      lifecycle: { remainingTicks: 2 }
    })
    valid.execution.evidence.sourceEntryBindings = []
    state.execute.mockResolvedValueOnce(valid)
    await expect(
      executeEncounterTurnCharacterActiveEffects({
        trx: db() as never,
        actorUserId: ids.characterA,
        encounter: encounter() as never,
        commandType: 'START',
        boundaries: [{ ordinal: 0, stage: 'START_OF_TURN', actorId: ids.actorA }],
        occurrenceId: ids.occurrence,
        runtime: {} as never,
        attunementSlotOverride: null
      })
    ).rejects.toThrow()
  })

  it('processes distinct Characters in canonical order and filters another Encounter lifetime', async () => {
    const first = effect(ids.effectA, 'END_OF_TURN', 2, 2)
    const second = effect(ids.effectB, 'START_OF_TURN', 2, 1)
    const otherEncounter = {
      ...effect(ids.effectB, 'START_OF_TURN', 2, 3),
      sourceEncounterId: ids.characterB,
      definition: {
        ...effect(ids.effectB, 'START_OF_TURN', 2, 3).definition,
        recurrence: { recurrenceStage: 'START_OF_TURN', lifetimeScope: 'ENCOUNTER' }
      }
    }
    state.list.mockImplementation(async ({ characterId }) =>
      characterId === ids.characterA ? [first] : [second, otherEncounter]
    )
    state.lockByOwner.mockImplementation(async ({ characterId }) =>
      characterId === ids.characterA ? [first] : [second, otherEncounter]
    )
    await executeEncounterTurnCharacterActiveEffects({
      trx: db([ids.characterA, ids.characterB]) as never,
      actorUserId: ids.characterA,
      encounter: encounter() as never,
      commandType: 'ADVANCE_TURN',
      boundaries: [
        { ordinal: 0, stage: 'END_OF_TURN', actorId: ids.actorA },
        { ordinal: 1, stage: 'START_OF_TURN', actorId: ids.actorB }
      ],
      occurrenceId: ids.occurrence,
      runtime: {} as never,
      attunementSlotOverride: null
    })
    expect(state.apply).toHaveBeenCalledTimes(2)
    expect(state.execute).toHaveBeenCalledTimes(2)
    expect(state.apply.mock.calls.map(([input]) => input.targetCharacterId)).toEqual([
      ids.characterA,
      ids.characterB
    ])
  })

  it('projects cumulative Character and Encounter actor state without invoking writers', () => {
    const source = encounter() as unknown as EncounterRecord
    const targetEncounterActor = creatureActor(ids.actorB)
    const unaffectedActor = { ...actor(ids.actorB, ids.characterB), id: ids.effectB }
    const originalActors = [source.actors[0], targetEncounterActor, unaffectedActor]
    const projected = projectEncounterAfterEvaluatedTurnEffectBatch(
      { ...source, actors: originalActors as unknown as EncounterRecord['actors'] },
      {
        executionStates: new Map([
          [`CHARACTER:${ids.characterA}`, { current: 2, temporary: 4, conditions: [ids.effectA] }],
          [`ENCOUNTER_ACTOR:${ids.actorB}`, { current: 1, temporary: 3, conditions: [] }]
        ])
      }
    )

    expect(projected.actors.map((actor) => actor.id)).toEqual([ids.actorA, ids.actorB, ids.effectB])
    expect(projected.actors[0]).toMatchObject({
      id: ids.actorA,
      currentHitPoints: 2,
      tempHitPoints: 4,
      conditions: [{ conditionTypeId: ids.effectA }]
    })
    expect(projected.actors[1]).toMatchObject({
      id: ids.actorB,
      currentHitPoints: 1,
      tempHitPoints: 3,
      conditions: []
    })
    expect(projected.actors[2]).toBe(originalActors[2])
    expect(projected.actors[0]).not.toBe(source.actors[0])
    expect(projected.actors[1]).not.toBe(source.actors[1])
    expect(state.apply).not.toHaveBeenCalled()
    expect(state.updateActor).not.toHaveBeenCalled()
    expect(state.updateLifecycleCas).not.toHaveBeenCalled()
    expect(state.deleteCas).not.toHaveBeenCalled()
  })
})
