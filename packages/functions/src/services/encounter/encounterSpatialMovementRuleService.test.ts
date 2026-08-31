import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./encounterActiveEffectTargetState.js', () => ({
  lockEncounterActiveEffectTargets: vi.fn(async (input: { actors: readonly { id: string }[] }) => ({
    lockedCharacters: new Map(),
    encounterActors: new Map(input.actors.map((actor) => [actor.id, actor])),
    encounterActorRules: {}
  }))
}))

vi.mock('../rules/targetBoundActiveRuleEffectExecutor.js', () => ({
  executeTargetBoundActiveRuleEffectWithPause: vi.fn(),
  resumeTargetBoundActiveRuleEffectWithPause: vi.fn(),
  reconstructTargetBoundActiveRuleEffectCompletion: vi.fn()
}))

vi.mock('./encounterActorRuleEvaluation.js', () => ({
  requireEncounterActorRuleResult: vi.fn(() => ({
    targetProtection: {
      status: 'NORMALIZED',
      defenses: [],
      conditionImmunityIds: []
    }
  }))
}))

import {
  evaluateEncounterSpatialMovementRuleBatch,
  type SpatialMovementRuleRoot
} from './encounterSpatialMovementRuleService.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  encounter: '00000000-0000-4000-8000-000000000002',
  scene: '00000000-0000-4000-8000-000000000003',
  token: '00000000-0000-4000-8000-000000000004',
  actor: '00000000-0000-4000-8000-000000000005',
  effect: '00000000-0000-4000-8000-000000000006',
  occurrence: '00000000-0000-4000-8000-000000000007',
  user: '00000000-0000-4000-8000-000000000008',
  system: '00000000-0000-4000-8000-000000000009',
  resolution: '00000000-0000-4000-8000-000000000010'
}

const checksum = (letter: string) => letter.repeat(64)
const resolutionCommand = {
  commandId: ids.resolution,
  commandFingerprint: checksum('f'),
  actorUserId: ids.user,
  correlationId: null,
  expectedOccurrenceVersion: 0,
  requestId: 'request-1',
  kind: 'ENTER_DICE' as const
}
const root: SpatialMovementRuleRoot = {
  commandId: ids.occurrence,
  commandFingerprint: checksum('a'),
  initiatorUserId: ids.user,
  correlationId: null,
  encounterId: ids.encounter,
  sceneId: ids.scene,
  tokenId: ids.token,
  expectedEncounterVersion: 1,
  expectedSceneVersion: 1,
  movementKind: 'VOLUNTARY',
  originalPath: [
    { x: 0, y: 0 },
    { x: 10, y: 0 }
  ]
}

function encounter(automationMode: 'AUTOMATIC' | 'ASSISTED' | 'MANUAL') {
  return {
    id: ids.encounter,
    campaignId: ids.campaign,
    gameSystemId: ids.system,
    version: 1,
    automationMode,
    actors: [
      {
        id: ids.actor,
        kind: 'CREATURE',
        sourceId: null,
        sourceRevision: 1,
        systemId: ids.system,
        currentHitPoints: 10,
        tempHitPoints: 0,
        maxHitPoints: 10,
        conditions: []
      }
    ]
  } as never
}

function spatialEffect() {
  return {
    id: ids.effect,
    version: 1,
    definitionChecksum: checksum('b'),
    lifecycleChecksum: checksum('c'),
    placementChecksum: checksum('d'),
    spatialStateChecksum: checksum('e'),
    definition: {
      origin: { kind: 'ENCOUNTER', sourceActorId: null },
      authoredEffectId: ids.effect,
      compiledEntryId: ids.effect,
      frozenGraphNodeId: 'spatial-node',
      frozenGraph: {
        schemaVersion: 1,
        source: {
          definitionId: ids.effect,
          gameSystemId: ids.system,
          definitionFamilyKey: 'spatial-test',
          checksum: checksum('f')
        },
        capabilityContractVersion: 1,
        factContracts: [],
        nodes: [
          {
            id: 'spatial-node',
            operation: { key: 'spatial-test', contractVersion: 1 },
            inputs: { value: { kind: 'LITERAL', value: 1 } }
          }
        ],
        outputs: { value: { kind: 'LITERAL', value: 1 } },
        sourceEntryBindings: [{ sourceEntryId: ids.effect, nodeId: 'spatial-node' }]
      },
      adapterFacts: {},
      recurrence: {
        recurrenceStage: 'NONE',
        consumeOnFirstEvent: null,
        endOnEvents: [],
        lifetimeScope: 'ENCOUNTER',
        expiration: { kind: 'INDEFINITE' }
      }
    },
    lifecycle: { schemaVersion: 1, remainingTicks: null },
    placement: {
      anchorKind: 'FIXED',
      sourceTokenId: null,
      geometry: {
        frame: 'SCENE_ABSOLUTE',
        shape: { kind: 'CIRCLE', center: { x: 5, y: 0 }, radius: 2 }
      },
      triggerModes: ['CROSS'],
      movementKinds: ['VOLUNTARY'],
      activation: 'ONE_SHOT',
      revealOnTrigger: false
    },
    spatialState: { schemaVersion: 1, revealed: true }
  } as never
}

function input(automationMode: 'AUTOMATIC' | 'ASSISTED' | 'MANUAL', effects: readonly unknown[]) {
  const scope = {
    snapshot: vi.fn().mockResolvedValue(effects),
    list: vi.fn().mockResolvedValue(effects),
    lockById: vi
      .fn()
      .mockImplementation(async ({ id }: { id: string }) =>
        (effects as Array<{ id: string }>).find((effect) => effect.id === id)
      ),
    create: vi.fn(),
    deleteCas: vi.fn(),
    updateCurrentStateCas: vi.fn()
  }
  return {
    trx: {} as never,
    actorUserId: ids.user,
    encounter: encounter(automationMode),
    sceneId: ids.scene,
    sceneVersion: 1,
    actorIdByTokenId: new Map([[ids.token, ids.actor]]),
    sceneTokens: [
      {
        id: ids.token,
        position: { x: 0, y: 0 },
        width: 1,
        height: 1
      },
      {
        id: '00000000-0000-4000-8000-000000000010',
        position: { x: 5, y: 0 },
        width: 1,
        height: 1
      }
    ],
    spatialScope: scope,
    root,
    currentPosition: { x: 0, y: 0 },
    occurrenceId: ids.occurrence,
    executionCommandId: root.commandId,
    attunementSlotOverride: null
  }
}

describe('evaluateEncounterSpatialMovementRuleBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps an ordinary no-candidate movement mechanics-inert', async () => {
    const result = await evaluateEncounterSpatialMovementRuleBatch(input('AUTOMATIC', []))
    expect(result).toEqual({
      kind: 'NO_CANDIDATES',
      movementIntent: { tokenId: ids.token, position: { x: 10, y: 0 } }
    })
  })

  it('keeps an unbound Scene token movement mechanics-inert', async () => {
    const value = input('AUTOMATIC', [])
    const movingToken = value.sceneTokens[0]!
    const result = await evaluateEncounterSpatialMovementRuleBatch({
      ...value,
      actorIdByTokenId: new Map(),
      sceneTokens: [movingToken, ...value.sceneTokens.slice(1)]
    })

    expect(result).toEqual({
      kind: 'NO_CANDIDATES',
      movementIntent: { tokenId: ids.token, position: { x: 10, y: 0 } }
    })
  })

  it('keeps recognized Manual movement mechanics-inert without reading targets or runtime', async () => {
    const value = input('MANUAL', [spatialEffect()])
    const result = await evaluateEncounterSpatialMovementRuleBatch(value)
    expect(result).toEqual({
      kind: 'MANUAL',
      movementIntent: { tokenId: ids.token, position: { x: 10, y: 0 } }
    })
  })

  it('stages the exact reaction boundary without applying later spatial mechanics', async () => {
    const executor = await import('../rules/targetBoundActiveRuleEffectExecutor.js')
    const beforeTerminalApply = vi.fn()
    const value = {
      ...input('ASSISTED', [spatialEffect()]),
      runtime: {} as never,
      interruptAfterPathDistance: 0.5,
      beforeTerminalApply
    }

    const result = await evaluateEncounterSpatialMovementRuleBatch(value)

    expect(result).toMatchObject({
      kind: 'REACTION_BOUNDARY',
      boundaryDistance: 0.5,
      boundaryPosition: { x: 0.5, y: 0 },
      movementIntent: { tokenId: ids.token, position: { x: 0.5, y: 0 } },
      completedExecutions: [],
      remainingCandidates: [{ ordinal: 0 }],
      resolutionCommands: []
    })
    expect(executor.executeTargetBoundActiveRuleEffectWithPause).not.toHaveBeenCalled()
    expect(beforeTerminalApply).not.toHaveBeenCalled()
    expect(value.spatialScope.deleteCas).not.toHaveBeenCalled()
    expect(value.spatialScope.updateCurrentStateCas).not.toHaveBeenCalled()
  })

  it('resumes a reaction-only frozen path without rediscovering spatial candidates', async () => {
    const first = await evaluateEncounterSpatialMovementRuleBatch({
      ...input('ASSISTED', []),
      interruptAfterPathDistance: 5
    })
    if (first.kind !== 'REACTION_BOUNDARY') throw new Error('Expected a reaction boundary.')
    expect(first).toMatchObject({
      boundaryDistance: 5,
      boundaryPosition: { x: 5, y: 0 },
      completedExecutions: [],
      remainingCandidates: []
    })

    const resumed = await evaluateEncounterSpatialMovementRuleBatch({
      ...input('ASSISTED', []),
      sceneVersion: 2,
      currentPosition: { x: 5, y: 0 },
      occurrenceVersion: 1,
      frozenReactionRemainder: {
        root: {
          ...root,
          originalPath: root.originalPath.map((point) => ({ ...point })),
          currentSceneVersion: 2,
          pathChecksum: checksumRuleDocument(root.originalPath),
          pathStartDistance: 5,
          currentPosition: { x: 5, y: 0 },
          resolutionCommands: [
            {
              commandId: ids.resolution,
              commandFingerprint: checksum('f'),
              actorUserId: ids.user,
              correlationId: null,
              expectedOccurrenceVersion: 0,
              kind: 'DECLINE'
            }
          ]
        },
        spatialSelectionChecksum: first.selectionChecksum,
        spatialCurrentnessChecksum: first.currentnessChecksum,
        completedSpatialExecutions: [],
        appliedSpatialPrefix: null,
        completedReactionExecutions: [],
        currentSpatialCandidate: null,
        remainingSpatialCandidates: [],
        reactionTimeline: []
      }
    })

    expect(resumed).toMatchObject({
      kind: 'TERMINAL',
      movementIntent: { tokenId: ids.token, position: { x: 10, y: 0 } },
      resolutionCommands: [{ kind: 'DECLINE' }],
      result: {
        status: 'MOVEMENT_COMPLETE',
        occurrenceVersion: 1,
        sceneVersion: 3
      }
    })
  })

  it('rejects a second evaluator stage before any target or root mutation', async () => {
    const executor = await import('../rules/targetBoundActiveRuleEffectExecutor.js')
    const graph = (spatialEffect() as unknown as { definition: { frozenGraph: unknown } })
      .definition.frozenGraph
    const continuation = {
      schemaVersion: 1,
      occurrenceId: ids.occurrence,
      graph,
      facts: {},
      nextNodeIndex: 0,
      nodeOutputs: {},
      trace: [],
      request: {
        requestId: 'request-1',
        kind: 'INTEGER_RANGE',
        nodeId: 'spatial-node',
        ordinal: 0,
        min: 1,
        max: 20
      },
      authority: 'APPLICATION_SERVICE',
      redaction: 'SERVER_ONLY',
      seal: checksum('g')
    }
    vi.mocked(executor.executeTargetBoundActiveRuleEffectWithPause).mockResolvedValue({
      continuation,
      evidencePolicy: {
        rollMode: 'NORMAL',
        contributors: [],
        contributorChecksum: checksum('h'),
        modifier: 0,
        defenseOrDc: 10
      }
    } as never)
    vi.mocked(executor.resumeTargetBoundActiveRuleEffectWithPause).mockResolvedValue({
      continuation
    } as never)
    const value = {
      ...input('AUTOMATIC', [spatialEffect()]),
      runtime: {} as never
    }
    const result = evaluateEncounterSpatialMovementRuleBatch(value)
    await expect(result).rejects.toThrow('only one evidence stage')
    expect(value.spatialScope.deleteCas).not.toHaveBeenCalled()
    expect(value.spatialScope.updateCurrentStateCas).not.toHaveBeenCalled()
  })

  it('refuses an Assisted pause without a supported d20 policy before mutation', async () => {
    const executor = await import('../rules/targetBoundActiveRuleEffectExecutor.js')
    vi.mocked(executor.executeTargetBoundActiveRuleEffectWithPause).mockResolvedValue({
      continuation: {
        schemaVersion: 1,
        occurrenceId: ids.occurrence,
        graph: (spatialEffect() as unknown as { definition: { frozenGraph: unknown } }).definition
          .frozenGraph,
        facts: {},
        nextNodeIndex: 0,
        nodeOutputs: {},
        trace: [],
        request: {
          requestId: 'request-1',
          kind: 'INTEGER_RANGE',
          nodeId: 'spatial-node',
          ordinal: 0,
          min: 1,
          max: 20
        },
        authority: 'APPLICATION_SERVICE',
        redaction: 'SERVER_ONLY',
        seal: checksum('a')
      },
      evidencePolicy: null
    } as never)
    const value = {
      ...input('ASSISTED', [spatialEffect()]),
      runtime: {} as never
    }
    await expect(evaluateEncounterSpatialMovementRuleBatch(value)).rejects.toThrow(
      'unsupported evidence'
    )
    expect(value.spatialScope.deleteCas).not.toHaveBeenCalled()
    expect(value.spatialScope.updateCurrentStateCas).not.toHaveBeenCalled()
  })

  it('rejects stale scene currentness before target or root mutation', async () => {
    const value = input('ASSISTED', [])
    const context = {
      kind: 'ENCOUNTER_SPATIAL_MOVEMENT',
      schemaVersion: 1,
      root: {
        ...root,
        pathChecksum: checksumRuleDocument(root.originalPath),
        pathStartDistance: 0,
        currentPosition: { x: 0, y: 0 },
        currentSceneVersion: 2,
        resolutionCommands: []
      },
      selectionChecksum: checksum('q'),
      completedExecutions: [],
      currentCandidate: {
        ordinal: 0,
        candidate: {
          effectId: ids.effect,
          targetActorId: ids.actor,
          trigger: 'CROSS',
          pathDistance: 0,
          contact: { x: 0, y: 0 },
          sourceMoved: false
        },
        effect: {},
        target: {},
        d20Policy: null
      },
      remainingCandidates: []
    }
    await expect(
      evaluateEncounterSpatialMovementRuleBatch({
        ...value,
        occurrenceVersion: 1,
        pendingSnapshot: { applicationContext: context } as never,
        resolution: {
          requestId: 'request-1',
          kind: 'ENTER_DICE',
          rawFaces: [5]
        },
        resolutionCommand
      })
    ).rejects.toThrow('stale')
    expect(value.spatialScope.deleteCas).not.toHaveBeenCalled()
  })

  it('rejects disappearance of the frozen candidate selection before execution', async () => {
    const value = input('ASSISTED', [])
    const context = {
      kind: 'ENCOUNTER_SPATIAL_MOVEMENT',
      schemaVersion: 1,
      root: {
        ...root,
        pathChecksum: checksumRuleDocument(root.originalPath),
        pathStartDistance: 0,
        currentPosition: { x: 0, y: 0 },
        currentSceneVersion: 1,
        resolutionCommands: []
      },
      selectionChecksum: checksumRuleDocument({
        encounterId: ids.encounter,
        sceneId: ids.scene,
        tokenId: ids.token,
        movementKind: root.movementKind,
        path: root.originalPath,
        candidates: []
      }),
      completedExecutions: [],
      currentCandidate: {
        ordinal: 0,
        candidate: {
          effectId: ids.effect,
          targetActorId: ids.actor,
          trigger: 'CROSS',
          pathDistance: 0,
          contact: { x: 0, y: 0 },
          sourceMoved: false
        },
        effect: {},
        target: {},
        d20Policy: null
      },
      remainingCandidates: []
    }
    await expect(
      evaluateEncounterSpatialMovementRuleBatch({
        ...value,
        occurrenceVersion: 1,
        pendingSnapshot: { applicationContext: context } as never,
        resolution: {
          requestId: 'request-1',
          kind: 'ENTER_DICE',
          rawFaces: [5]
        },
        resolutionCommand
      })
    ).rejects.toThrow('candidate selection')
  })
})
