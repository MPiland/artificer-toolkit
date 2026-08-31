import { describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => ({ updateActor: vi.fn() }))

vi.mock('@artificer-toolkit/db', () => ({
  createEncounterRepository: () => ({ updateActor: dbMocks.updateActor })
}))

vi.mock('./encounterActiveEffectTargetState.js', () => ({
  lockEncounterActiveEffectTargets: vi.fn(
    async ({ actors }: { actors: readonly { id: string; sourceId?: string | null }[] }) => ({
      lockedCharacters: new Map(
        actors.map((actor) => [
          actor.sourceId!,
          {
            id: actor.sourceId!,
            systemId: 'dnd5e',
            streamVersion: 1,
            actor,
            mechanics: {
              commandState: {
                state: { hitpoints: { current: 3, temp: 0 }, conditions: [] }
              }
            },
            overlay: {
              projectionChecksum: 'a'.repeat(64),
              mechanicalContextChecksum: 'b'.repeat(64),
              rulePolicyOutput: {
                defenses: [],
                conditionImmunityIds: [],
                savingThrowDefinitions: [
                  {
                    abilityDefinitionId: ids.ability,
                    modifier: 0,
                    rollMode: 'NORMAL',
                    contributors: []
                  }
                ]
              }
            },
            conditionDefinitions: [],
            maximumHitPoints: 10
          }
        ])
      ),
      encounterActors: new Map(),
      encounterActorRules: null
    })
  )
}))

vi.mock('./encounterCharacterMechanicsBatch.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./encounterCharacterMechanicsBatch.js')>()
  return {
    ...actual,
    applyLockedEncounterActorMechanicsBatch: vi.fn(
      async ({ targetActor, initialConditionRows, applications }) => {
        const conditions = actual.readEncounterActorConditionState(initialConditionRows)
        const folded = actual.foldCharacterMechanicsApplications({
          targetActorId: targetActor.id,
          currentHitPoints: targetActor.currentHitPoints,
          temporaryHitPoints: targetActor.tempHitPoints,
          maximumHitPoints: targetActor.maxHitPoints,
          conditionIds: conditions.ids,
          applications
        })
        return {
          updatedActor: {
            ...targetActor,
            currentHitPoints: folded.after.currentHitPoints,
            tempHitPoints: folded.after.temporaryHitPoints
          },
          receiptApplications: folded.applications,
          targetTransition: {
            checksum: 'a'.repeat(64),
            before: folded.before,
            after: folded.after
          },
          stateChanged: folded.stateChanged
        }
      }
    ),
    applyLockedEncounterCharacterMechanicsBatch: vi.fn(
      async ({ targetActor, mechanics, applications }) => {
        const folded = actual.foldCharacterMechanicsApplications({
          targetActorId: targetActor.id,
          currentHitPoints: mechanics.commandState.state.hitpoints.current,
          temporaryHitPoints: mechanics.commandState.state.hitpoints.temp ?? 0,
          maximumHitPoints: targetActor.maxHitPoints,
          conditionIds: (mechanics.commandState.state.conditions ?? []).map(
            (condition: { conditionTypeId: string }) => condition.conditionTypeId
          ),
          applications
        })
        return {
          updatedActor: {
            ...targetActor,
            sourceRevision: 2,
            currentHitPoints: folded.after.currentHitPoints,
            tempHitPoints: folded.after.temporaryHitPoints
          },
          streamVersion: 2,
          finalState: folded.after,
          receiptApplications: folded.applications,
          targetTransition: {
            checksum: 'a'.repeat(64),
            before: folded.before,
            after: folded.after
          },
          stateChanged: folded.stateChanged
        }
      }
    )
  }
})

vi.mock('./encounterActorRuleEvaluation.js', () => ({
  requireEncounterActorRuleResult: vi.fn(() => ({
    targetProtection: {
      status: 'NORMALIZED',
      defenses: [],
      conditionImmunityIds: []
    }
  }))
}))

import { evaluateEncounterSpatialMovementRuleBatch } from './encounterSpatialMovementRuleService.js'
import {
  applyLockedEncounterCharacterMechanicsBatch,
  deriveEncounterCharacterMechanicsEventCommandId
} from './encounterCharacterMechanicsBatch.js'
import { createRulesRuntimeService } from '../rules/rulesRuntimeService.js'
import {
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_TEST_HEAL_PROPOSAL_OPERATION_KEY,
  DND5E_SAVE_TEST_OPERATION_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  dnd5eSaveTestOperation,
  dnd5eTestHealProposalOperation,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  dnd5eEffectActionCapability
} from '../rules/systems/dnd5e/effectActionCompiler.js'
import {
  integerRangeEvidenceRuleOperation,
  type RuleGraphDefinition,
  checksumRuleDocument
} from '@artificer-toolkit/shared/rules'
import { collectSpatialMovementCandidates } from '@artificer-toolkit/shared/vtt'
import {
  serverPublishedRuleDefinitionDtoSchema,
  activeRuleEffectDefinitionDtoSchema
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { DND5E_SYSTEM_ID } from '../rules/systems/dnd5e/characterActionCapabilityDiscovery.js'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000201',
  encounter: '00000000-0000-4000-8000-000000000202',
  scene: '00000000-0000-4000-8000-000000000203',
  token: '00000000-0000-4000-8000-000000000204',
  actor: '00000000-0000-4000-8000-000000000205',
  effect: '00000000-0000-4000-8000-000000000206',
  occurrence: '00000000-0000-4000-8000-000000000207',
  user: '00000000-0000-4000-8000-000000000208',
  entry: '00000000-0000-4000-8000-000000000209',
  ability: '00000000-0000-4000-8000-000000000210',
  secondEffect: '00000000-0000-4000-8000-000000000211',
  firstResolution: '00000000-0000-4000-8000-000000000213',
  secondResolution: '00000000-0000-4000-8000-000000000214'
} as const
const hex = (value: string) => value.repeat(64)

function runtime() {
  return createRulesRuntimeService({
    capabilities: [dnd5eEffectActionCapability],
    operations: [
      integerRangeEvidenceRuleOperation,
      dnd5eSaveTestOperation,
      dnd5eTestHealProposalOperation
    ],
    continuationIntegrityKey: new Uint8Array(32).fill(1),
    definitions: {
      async requireCurrent() {
        throw new Error('frozen')
      }
    }
  })
}

function graph(): RuleGraphDefinition {
  return {
    schemaVersion: 1,
    id: ids.effect,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      {
        id: 'd20',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'LITERAL', value: 1 },
          max: { kind: 'LITERAL', value: 20 }
        }
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
        id: 'proposal-on_save_fail',
        operation: {
          key: DND5E_TEST_HEAL_PROPOSAL_OPERATION_KEY,
          contractVersion: 1
        },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          resolvedPath: {
            kind: 'NODE_OUTPUT',
            nodeId: 'test',
            port: 'resultPath'
          },
          authoredPath: { kind: 'LITERAL', value: 'ON_SAVE_FAIL' },
          targetStateChecksum: {
            kind: 'FACT',
            factKey: 'dnd5e.target-state-checksum'
          },
          amount: { kind: 'LITERAL', value: 7 }
        }
      }
    ],
    outputs: {
      targetActorId: {
        kind: 'NODE_OUTPUT',
        nodeId: 'test',
        port: 'targetActorId'
      },
      naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'naturalD20' },
      total: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'total' },
      resultPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
      contributorChecksum: {
        kind: 'NODE_OUTPUT',
        nodeId: 'test',
        port: 'contributorChecksum'
      }
    },
    sourceEntryBindings: [{ sourceEntryId: ids.entry, nodeId: 'proposal-on_save_fail' }]
  }
}

async function definition() {
  const g = graph()
  const prepared = await runtime().executeResolvedWithGraph?.({
    command: {
      definitionId: ids.effect,
      occurrenceId: ids.occurrence,
      facts: {
        [DND5E_TARGET_ACTOR_FACT_KEY]: ids.actor,
        [DND5E_SAVE_MODIFIER_FACT_KEY]: 0,
        [DND5E_SAVE_DC_FACT_KEY]: 10,
        [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: checksumRuleDocument([]),
        ['dnd5e.target-state-checksum']: checksumRuleDocument({
          targetActorId: ids.actor,
          currentHitPoints: 3,
          temporaryHitPoints: 0,
          maximumHitPoints: 10,
          conditionIds: []
        })
      }
    },
    published: serverPublishedRuleDefinitionDtoSchema.parse({
      id: ids.effect,
      gameSystemId: DND5E_SYSTEM_ID,
      definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
      checksum: checksumRuleDocument(g),
      definition: g
    })
  })
  if (!prepared) throw new Error('expected compiled graph')
  return activeRuleEffectDefinitionDtoSchema.parse({
    schemaVersion: 1,
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: ids.encounter,
      sourceOccurrenceId: ids.occurrence,
      rootCommandId: ids.occurrence,
      sourceActorId: ids.actor
    },
    authoredEffectId: ids.effect,
    compiledEntryId: ids.entry,
    frozenGraphNodeId: 'proposal-on_save_fail',
    frozenGraph: prepared.graph,
    adapterFacts: {
      [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]: ids.ability,
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
  })
}

function effect(
  def: Awaited<ReturnType<typeof definition>>,
  id: string = ids.effect,
  token = false,
  geometry: { center: { x: number; y: number }; radius: number } | null = null,
  triggerModes: readonly ('ENTER' | 'EXIT' | 'CROSS')[] = ['CROSS']
) {
  const lifecycle = { schemaVersion: 1, remainingTicks: null }
  const shape = geometry ?? {
    center: token ? { x: 0, y: 0 } : { x: 5, y: 0 },
    radius: 2
  }
  return {
    id,
    encounterId: ids.encounter,
    sceneId: ids.scene,
    version: 1,
    createdOrdinal: 1,
    definitionChecksum: checksumRuleDocument(def),
    lifecycleChecksum: checksumRuleDocument(lifecycle),
    placementChecksum: hex('c'),
    spatialStateChecksum: hex('d'),
    definition: def,
    lifecycle,
    placement: {
      anchorKind: token ? 'TOKEN' : 'FIXED',
      sourceTokenId: token ? ids.token : null,
      geometry: {
        frame: token ? 'TOKEN_LOCAL' : 'SCENE_ABSOLUTE',
        shape: { kind: 'CIRCLE', ...shape }
      },
      triggerModes,
      movementKinds: ['VOLUNTARY'],
      activation: 'ONE_SHOT',
      revealOnTrigger: false
    },
    spatialState: { schemaVersion: 1, revealed: true }
  } as never
}

type CoordinatorInput = Parameters<typeof evaluateEncounterSpatialMovementRuleBatch>[0]

function base(
  mode: 'AUTOMATIC' | 'ASSISTED',
  effects: readonly unknown[],
  path: readonly { x: number; y: number }[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 }
  ],
  roll = 5
): CoordinatorInput {
  const scope = {
    snapshot: vi.fn().mockResolvedValue(effects),
    list: vi.fn().mockResolvedValue(effects),
    lockById: vi
      .fn()
      .mockImplementation(async ({ id }: { id: string }) =>
        effects.find((e) => (e as { id: string }).id === id)
      ),
    deleteCas: vi.fn().mockResolvedValue(undefined),
    updateCurrentStateCas: vi.fn().mockResolvedValue(undefined),
    create: vi.fn()
  }
  return {
    trx: {} as never,
    actorUserId: ids.user,
    encounter: {
      id: ids.encounter,
      campaignId: ids.campaign,
      gameSystemId: DND5E_SYSTEM_ID,
      version: 1,
      automationMode: mode,
      actors: [
        {
          id: ids.actor,
          kind: 'CHARACTER',
          sourceId: ids.actor,
          sourceRevision: 1,
          systemId: DND5E_SYSTEM_ID,
          currentHitPoints: 3,
          tempHitPoints: 0,
          maxHitPoints: 10,
          conditions: []
        }
      ]
    } as never,
    sceneId: ids.scene,
    sceneVersion: 1,
    actorIdByTokenId: new Map([
      [ids.token, ids.actor],
      ['00000000-0000-4000-8000-000000000212', ids.actor]
    ]),
    sceneTokens: [
      {
        id: ids.token,
        position: { x: 0, y: 0 },
        width: 1,
        height: 1
      },
      {
        id: '00000000-0000-4000-8000-000000000212',
        position: { x: 5, y: 0 },
        width: 1,
        height: 1
      }
    ],
    spatialScope: scope as never,
    root: {
      commandId: ids.occurrence,
      commandFingerprint: hex('a'),
      initiatorUserId: ids.user,
      correlationId: null,
      encounterId: ids.encounter,
      sceneId: ids.scene,
      tokenId: ids.token,
      expectedEncounterVersion: 1,
      expectedSceneVersion: 1,
      movementKind: 'VOLUNTARY',
      originalPath: path
    },
    currentPosition: { x: 0, y: 0 },
    occurrenceId: ids.occurrence,
    executionCommandId: ids.occurrence,
    attunementSlotOverride: null,
    runtime: runtime(),
    rollD20: vi.fn(() => roll)
  }
}

function resolutionCommand(input: {
  commandId: string
  expectedOccurrenceVersion: number
  requestId: string
  kind: 'ENTER_DICE' | 'SYSTEM_ROLL'
}) {
  return {
    commandId: input.commandId,
    commandFingerprint: hex('e'),
    actorUserId: ids.user,
    correlationId: null,
    expectedOccurrenceVersion: input.expectedOccurrenceVersion,
    requestId: input.requestId,
    kind: input.kind
  } as const
}

describe('real spatial movement executor integration', () => {
  it('automatically resolves an Encounter actor and emits evidence plus one root transition', async () => {
    dbMocks.updateActor.mockClear()
    const value = base('AUTOMATIC', [effect(await definition())])
    const result = await evaluateEncounterSpatialMovementRuleBatch(value)
    expect(result.kind).toBe('TERMINAL')
    if (result.kind !== 'TERMINAL') return
    if (result.result.status !== 'BATCH_COMPLETE')
      throw new Error('Expected a spatial movement batch.')
    expect(result.result.executions[0]?.d20?.rawFaces).toEqual([5])
    expect(result.result.encounterVersion).toBe(2)
    expect(result.result.sceneVersion).toBe(2)
    expect(result.result.spatialEffectTransitions).toHaveLength(1)
    expect(result.result.characterTransitions).toHaveLength(1)
    expect(dbMocks.updateActor).toHaveBeenCalledTimes(1)
    expect(dbMocks.updateActor).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ids.actor,
        sourceRevision: 2,
        currentHitPoints: 10,
        tempHitPoints: 0
      })
    )
    expect(value.spatialScope.deleteCas).toHaveBeenCalledTimes(1)
  })

  it('stages the complete same-distance spatial group before a reaction boundary without mutation', async () => {
    dbMocks.updateActor.mockClear()
    vi.mocked(applyLockedEncounterCharacterMechanicsBatch).mockClear()
    const beforeTerminalApply = vi.fn()
    const value = {
      ...base('AUTOMATIC', [effect(await definition())]),
      interruptAfterPathDistance: 2.5,
      beforeTerminalApply
    }

    const result = await evaluateEncounterSpatialMovementRuleBatch(value)

    expect(result.kind).toBe('REACTION_BOUNDARY')
    if (result.kind !== 'REACTION_BOUNDARY') return
    expect(result.boundaryDistance).toBe(2.5)
    expect(result.boundaryPosition).toEqual({ x: 2.5, y: 0 })
    expect(result.completedExecutions).toHaveLength(1)
    expect(result.completedExecutions[0]?.d20?.rawFaces).toEqual([5])
    expect(result.appliedPrefix).toBeNull()
    expect(result.remainingCandidates).toEqual([])
    expect(beforeTerminalApply).not.toHaveBeenCalled()
    expect(dbMocks.updateActor).not.toHaveBeenCalled()
    expect(vi.mocked(applyLockedEncounterCharacterMechanicsBatch)).not.toHaveBeenCalled()
    expect(value.spatialScope.deleteCas).not.toHaveBeenCalled()
    expect(value.spatialScope.updateCurrentStateCas).not.toHaveBeenCalled()
  })

  it('completes a successful save with an authorized zero-application proposal', async () => {
    dbMocks.updateActor.mockClear()
    const value = base(
      'AUTOMATIC',
      [effect(await definition())],
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      15
    )
    const result = await evaluateEncounterSpatialMovementRuleBatch(value)
    expect(result.kind).toBe('TERMINAL')
    if (result.kind !== 'TERMINAL') return
    if (result.result.status !== 'BATCH_COMPLETE')
      throw new Error('Expected a spatial movement batch.')
    expect(result.result.executions[0]).toMatchObject({
      d20: { resultPath: 'ON_SAVE_SUCCESS' },
      applications: []
    })
    expect(result.result.characterTransitions).toEqual([])
    expect(dbMocks.updateActor).not.toHaveBeenCalled()
    expect(value.spatialScope.deleteCas).toHaveBeenCalledTimes(1)
  })

  it('pauses at the authoritative contact and resumes with exact physical evidence', async () => {
    const value = base('ASSISTED', [effect(await definition())])
    const pending = await evaluateEncounterSpatialMovementRuleBatch(value)
    expect(pending.kind).toBe('PENDING')
    if (pending.kind !== 'PENDING') return
    expect(pending.pendingSnapshot.applicationContext).toMatchObject({
      kind: 'ENCOUNTER_SPATIAL_MOVEMENT',
      currentCandidate: { candidate: { pathDistance: 2.5 } }
    })
    const resumed = await evaluateEncounterSpatialMovementRuleBatch({
      ...value,
      sceneVersion: 2,
      currentPosition: { x: 2.5, y: 0 },
      pendingSnapshot: pending.pendingSnapshot,
      occurrenceVersion: 1,
      resolution: {
        requestId: pending.pendingSnapshot.request.requestId,
        kind: 'ENTER_DICE',
        rawFaces: [15]
      },
      resolutionCommand: resolutionCommand({
        commandId: ids.firstResolution,
        expectedOccurrenceVersion: 0,
        requestId: pending.pendingSnapshot.request.requestId,
        kind: 'ENTER_DICE'
      })
    })
    expect(resumed.kind).toBe('TERMINAL')
  })

  it('keeps distinct roots as an ordered completed prefix across Assisted pauses', async () => {
    vi.mocked(applyLockedEncounterCharacterMechanicsBatch).mockClear()
    const def = await definition()
    const first = effect(def)
    const second = effect(def, ids.secondEffect, false, { center: { x: 8, y: 0 }, radius: 2 }, [
      'ENTER'
    ])
    const value = base('ASSISTED', [first, second])
    const pending = await evaluateEncounterSpatialMovementRuleBatch(value)
    expect(pending.kind).toBe('PENDING')
    if (pending.kind !== 'PENDING') return
    expect(vi.mocked(applyLockedEncounterCharacterMechanicsBatch)).not.toHaveBeenCalled()
    const next = await evaluateEncounterSpatialMovementRuleBatch({
      ...value,
      executionCommandId: ids.firstResolution,
      sceneVersion: 2,
      currentPosition: { x: 2.5, y: 0 },
      pendingSnapshot: pending.pendingSnapshot,
      occurrenceVersion: 1,
      resolution: {
        requestId: pending.pendingSnapshot.request.requestId,
        kind: 'ENTER_DICE',
        rawFaces: [15]
      },
      resolutionCommand: resolutionCommand({
        commandId: ids.firstResolution,
        expectedOccurrenceVersion: 0,
        requestId: pending.pendingSnapshot.request.requestId,
        kind: 'ENTER_DICE'
      })
    })
    expect(next.kind).toBe('PENDING')
    if (next.kind !== 'PENDING') return
    const context = next.pendingSnapshot.applicationContext as Extract<
      NonNullable<typeof next.pendingSnapshot.applicationContext>,
      { kind: 'ENCOUNTER_SPATIAL_MOVEMENT' }
    >
    expect(context.completedExecutions).toMatchObject([
      { candidate: { candidate: { effectId: ids.effect, pathDistance: 2.5 } } }
    ])
    expect(context.root.resolutionCommands).toEqual([
      resolutionCommand({
        commandId: ids.firstResolution,
        expectedOccurrenceVersion: 0,
        requestId: pending.pendingSnapshot.request.requestId,
        kind: 'ENTER_DICE'
      })
    ])
    expect(context.currentCandidate).toMatchObject({
      candidate: { effectId: ids.secondEffect, pathDistance: 5.5 }
    })
    expect(vi.mocked(applyLockedEncounterCharacterMechanicsBatch)).not.toHaveBeenCalled()
    const nextResolution = {
      requestId: next.pendingSnapshot.request.requestId,
      kind: 'ENTER_DICE' as const,
      rawFaces: [5]
    }
    await expect(
      evaluateEncounterSpatialMovementRuleBatch({
        ...value,
        sceneVersion: 3,
        currentPosition: { x: 5.5, y: 0 },
        occurrenceVersion: 2,
        pendingSnapshot: next.pendingSnapshot,
        resolution: nextResolution,
        resolutionCommand: resolutionCommand({
          commandId: ids.firstResolution,
          expectedOccurrenceVersion: 1,
          requestId: nextResolution.requestId,
          kind: 'ENTER_DICE'
        })
      })
    ).rejects.toThrow('already used')
    await expect(
      evaluateEncounterSpatialMovementRuleBatch({
        ...value,
        sceneVersion: 3,
        currentPosition: { x: 5.5, y: 0 },
        occurrenceVersion: 2,
        pendingSnapshot: next.pendingSnapshot,
        resolution: nextResolution,
        resolutionCommand: resolutionCommand({
          commandId: ids.secondResolution,
          expectedOccurrenceVersion: 0,
          requestId: nextResolution.requestId,
          kind: 'ENTER_DICE'
        })
      })
    ).rejects.toThrow('stale')
    const terminal = await evaluateEncounterSpatialMovementRuleBatch({
      ...value,
      executionCommandId: ids.secondResolution,
      sceneVersion: 3,
      currentPosition: { x: 5.5, y: 0 },
      pendingSnapshot: next.pendingSnapshot,
      occurrenceVersion: 2,
      resolution: {
        requestId: next.pendingSnapshot.request.requestId,
        kind: 'ENTER_DICE',
        rawFaces: [5]
      },
      resolutionCommand: resolutionCommand({
        commandId: ids.secondResolution,
        expectedOccurrenceVersion: 1,
        requestId: next.pendingSnapshot.request.requestId,
        kind: 'ENTER_DICE'
      })
    })
    expect(terminal.kind).toBe('TERMINAL')
    if (terminal.kind !== 'TERMINAL') return
    if (terminal.result.status !== 'BATCH_COMPLETE')
      throw new Error('Expected a spatial movement batch.')
    expect(terminal.result.occurrenceVersion).toBe(2)
    expect(terminal.resolutionCommands).toEqual([
      resolutionCommand({
        commandId: ids.firstResolution,
        expectedOccurrenceVersion: 0,
        requestId: pending.pendingSnapshot.request.requestId,
        kind: 'ENTER_DICE'
      }),
      resolutionCommand({
        commandId: ids.secondResolution,
        expectedOccurrenceVersion: 1,
        requestId: next.pendingSnapshot.request.requestId,
        kind: 'ENTER_DICE'
      })
    ])
    expect(terminal.result.executions).toMatchObject([
      {
        candidate: { candidate: { effectId: ids.effect } },
        d20: { rawFaces: [15] }
      },
      {
        candidate: { candidate: { effectId: ids.secondEffect } },
        d20: { rawFaces: [5] }
      }
    ])
    expect(terminal.result.spatialEffectTransitions).toHaveLength(2)
    expect(value.spatialScope.deleteCas).toHaveBeenCalledTimes(2)
    expect(vi.mocked(applyLockedEncounterCharacterMechanicsBatch)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(applyLockedEncounterCharacterMechanicsBatch)).toHaveBeenCalledWith(
      expect.objectContaining({
        commandId: deriveEncounterCharacterMechanicsEventCommandId({
          occurrenceId: ids.occurrence,
          sourceCommandId: ids.secondResolution,
          phase: 'SPATIAL_EFFECT',
          ordinal: 0,
          targetCharacterId: ids.actor
        }),
        sourceCommandId: ids.secondResolution
      })
    )
  })

  it('rebuilds a later pending target pin from state changed by the completed prefix', async () => {
    const def = await definition()
    const first = effect(def)
    const second = effect(def, ids.secondEffect, false, { center: { x: 8, y: 0 }, radius: 2 }, [
      'ENTER'
    ])
    const value = base('ASSISTED', [first, second])
    const pending = await evaluateEncounterSpatialMovementRuleBatch(value)
    expect(pending.kind).toBe('PENDING')
    if (pending.kind !== 'PENDING') return
    const next = await evaluateEncounterSpatialMovementRuleBatch({
      ...value,
      sceneVersion: 2,
      currentPosition: { x: 2.5, y: 0 },
      occurrenceVersion: 1,
      pendingSnapshot: pending.pendingSnapshot,
      resolution: {
        requestId: pending.pendingSnapshot.request.requestId,
        kind: 'ENTER_DICE',
        rawFaces: [5]
      },
      resolutionCommand: resolutionCommand({
        commandId: ids.firstResolution,
        expectedOccurrenceVersion: 0,
        requestId: pending.pendingSnapshot.request.requestId,
        kind: 'ENTER_DICE'
      })
    })
    expect(next.kind).toBe('PENDING')
    if (next.kind !== 'PENDING') return
    const context = next.pendingSnapshot.applicationContext as Extract<
      NonNullable<typeof next.pendingSnapshot.applicationContext>,
      { kind: 'ENCOUNTER_SPATIAL_MOVEMENT' }
    >
    expect(context.currentCandidate.target.targetStateChecksum).toBe(
      checksumRuleDocument({
        targetActorId: ids.actor,
        currentHitPoints: 10,
        temporaryHitPoints: 0,
        maximumHitPoints: 10,
        conditionIds: []
      })
    )
    const terminal = await evaluateEncounterSpatialMovementRuleBatch({
      ...value,
      sceneVersion: 3,
      currentPosition: { x: 5.5, y: 0 },
      occurrenceVersion: 2,
      pendingSnapshot: next.pendingSnapshot,
      resolution: {
        requestId: next.pendingSnapshot.request.requestId,
        kind: 'ENTER_DICE',
        rawFaces: [15]
      },
      resolutionCommand: resolutionCommand({
        commandId: ids.secondResolution,
        expectedOccurrenceVersion: 1,
        requestId: next.pendingSnapshot.request.requestId,
        kind: 'ENTER_DICE'
      })
    })
    expect(terminal.kind).toBe('TERMINAL')
    if (terminal.kind !== 'TERMINAL') return
    if (terminal.result.status !== 'BATCH_COMPLETE')
      throw new Error('Expected a spatial movement batch.')
    expect(terminal.result.characterTransitions[0]).toMatchObject({
      before: { currentHitPoints: 3 },
      after: { currentHitPoints: 10 }
    })
  })

  it('rejects invalid resumed evidence before server RNG', async () => {
    const value = base('ASSISTED', [effect(await definition())])
    const pending = await evaluateEncounterSpatialMovementRuleBatch(value)
    expect(pending.kind).toBe('PENDING')
    if (pending.kind !== 'PENDING') return
    const rollD20 = vi.fn(() => 5)
    const command = resolutionCommand({
      commandId: ids.firstResolution,
      expectedOccurrenceVersion: 0,
      requestId: pending.pendingSnapshot.request.requestId,
      kind: 'SYSTEM_ROLL'
    })
    await expect(
      evaluateEncounterSpatialMovementRuleBatch({
        ...value,
        occurrenceVersion: 1,
        sceneVersion: 2,
        currentPosition: { x: 2.5, y: 0 },
        pendingSnapshot: pending.pendingSnapshot,
        resolution: { requestId: 'wrong-request', kind: 'SYSTEM_ROLL' },
        resolutionCommand: { ...command, requestId: 'wrong-request' },
        rollD20
      })
    ).rejects.toThrow('stale')
    await expect(
      evaluateEncounterSpatialMovementRuleBatch({
        ...value,
        occurrenceVersion: 1,
        sceneVersion: 2,
        currentPosition: { x: 2.5, y: 0 },
        pendingSnapshot: pending.pendingSnapshot,
        resolution: {
          requestId: pending.pendingSnapshot.request.requestId,
          kind: 'ENTER_DICE',
          rawFaces: [5, 6]
        },
        resolutionCommand: { ...command, kind: 'ENTER_DICE' },
        rollD20
      })
    ).rejects.toThrow('face count')
    await expect(
      evaluateEncounterSpatialMovementRuleBatch({
        ...value,
        occurrenceVersion: 1,
        sceneVersion: 2,
        currentPosition: { x: 2.5, y: 0 },
        pendingSnapshot: pending.pendingSnapshot,
        resolution: {
          requestId: pending.pendingSnapshot.request.requestId,
          kind: 'SYSTEM_ROLL',
          rawFaces: [5]
        } as never,
        resolutionCommand: command,
        rollD20
      })
    ).rejects.toThrow()
    expect(rollD20).not.toHaveBeenCalled()
  })

  it('uses the authoritative mover path contact when a token-anchored source moves', async () => {
    vi.mocked(applyLockedEncounterCharacterMechanicsBatch).mockClear()
    const def = await definition()
    const moved = effect(def, ids.effect, true)
    const baseValue = base('ASSISTED', [moved])
    const value = {
      ...baseValue,
      actorIdByTokenId: new Map([...baseValue.actorIdByTokenId, [ids.secondEffect, ids.actor]]),
      sceneTokens: [
        ...baseValue.sceneTokens,
        { ...baseValue.sceneTokens[0]!, id: ids.secondEffect, position: { x: 5, y: 0 } }
      ]
    }
    const [candidate] = collectSpatialMovementCandidates({
      actorIdByTokenId: value.actorIdByTokenId,
      effects: [
        {
          effectId: ids.effect,
          sourceActorId: ids.actor,
          sourceTokenId: ids.token,
          anchorKind: 'TOKEN',
          geometry: {
            frame: 'TOKEN_LOCAL',
            shape: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 2 }
          },
          triggerModes: ['CROSS'],
          movementKinds: ['VOLUNTARY']
        }
      ],
      movementKind: value.root.movementKind,
      movingTokenId: value.root.tokenId,
      path: value.root.originalPath,
      tokens: value.sceneTokens
    })
    expect(candidate).toMatchObject({ sourceMoved: true })
    expect(candidate?.contact).toEqual({ x: candidate?.pathDistance, y: 0 })

    const pending = await evaluateEncounterSpatialMovementRuleBatch(value)
    expect(pending.kind).toBe('PENDING')
    if (pending.kind !== 'PENDING' || !candidate) return
    const context = pending.pendingSnapshot.applicationContext as Extract<
      NonNullable<typeof pending.pendingSnapshot.applicationContext>,
      { kind: 'ENCOUNTER_SPATIAL_MOVEMENT' }
    >
    expect(context.currentCandidate.candidate).toMatchObject(candidate)
    expect(context.root.currentPosition).toEqual(candidate.contact)
    expect(context.root.pathStartDistance).toBeCloseTo(candidate.pathDistance)
    expect(pending.movementIntent).toEqual({
      tokenId: ids.token,
      position: candidate.contact
    })
    expect(vi.mocked(applyLockedEncounterCharacterMechanicsBatch)).not.toHaveBeenCalled()
  })
})
