import { createHash } from 'node:crypto'

import type { DBLike } from '@artificer-toolkit/db'
import { LEGACY_VISUAL_ONLY_DARKNESS_REPLAY_KIND } from '@artificer-toolkit/schema/api/vttScenes'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  command: '00000000-0000-4000-8000-000000000002',
  encounter: '00000000-0000-4000-8000-000000000003',
  scene: '00000000-0000-4000-8000-000000000004',
  otherScene: '00000000-0000-4000-8000-000000000008',
  session: '00000000-0000-4000-8000-000000000005',
  token: '00000000-0000-4000-8000-000000000007',
  user: '00000000-0000-4000-8000-000000000006'
} as const

const mocks = vi.hoisted(() => ({
  appendEvent: vi.fn(),
  appendReceipt: vi.fn(),
  actorRuleSnapshot: vi.fn(),
  findEventByCommand: vi.fn(),
  findEncounterByRootCommand: vi.fn(),
  findEncounter: vi.fn(),
  findLiveScene: vi.fn(),
  findSessionPresentation: vi.fn(),
  findReceipt: vi.fn(),
  findTerminalReceiptByOccurrence: vi.fn(),
  findEncounterBinding: vi.fn(),
  lockLiveScene: vi.fn(),
  listActorTokenBindings: vi.fn(),
  lockContext: vi.fn(),
  lockLiveCommandContext: vi.fn(),
  lockPendingEncounter: vi.fn(),
  createPending: vi.fn(),
  reactionDiscovery: vi.fn(),
  spatialEvaluation: vi.fn(),
  startReactionBoundary: vi.fn(),
  lockActiveEffectTargets: vi.fn(),
  refreshActiveEffectTargets: vi.fn(),
  lockSpatialScope: vi.fn(),
  listSpatialEffects: vi.fn(),
  lockActiveEffectsByOwner: vi.fn(),
  findActiveVocabulary: vi.fn(),
  listEventsAfter: vi.fn(),
  updateProjection: vi.fn(),
  publishLiveCommand: vi.fn()
}))

vi.mock('@artificer-toolkit/db', () => ({
  checksumSceneCurrentProjection: () => '0'.repeat(64),
  createActiveRuleEffectRepository: () => ({
    lockByOwner: mocks.lockActiveEffectsByOwner
  }),
  createCampaignRepository: () => ({
    lockCampaign: vi.fn(async (campaignId: string) => ({
      id: campaignId,
      status: 'ACTIVE',
      ownerUserId: ids.user
    }))
  }),
  createEncounterRepository: () => ({
    find: mocks.findEncounter,
    lockActorRelationship: vi.fn(),
    publishCurrentProjection: vi.fn(),
    updateActor: vi.fn()
  }),
  createReusableDefinitionRepository: () => ({ requireCurrent: vi.fn() }),
  createRuleOccurrenceRepository: () => ({
    createPending: mocks.createPending,
    appendReceipt: mocks.appendReceipt,
    findEncounterByRootCommand: mocks.findEncounterByRootCommand,
    findReceipt: mocks.findReceipt,
    findTerminalReceiptByOccurrence: mocks.findTerminalReceiptByOccurrence,
    lockPendingEncounter: mocks.lockPendingEncounter
  }),
  createSpatialRuleEffectRepository: () => ({
    lockScope: mocks.lockSpatialScope
  }),
  createSystemVocabularySnapshotRepository: () => ({
    findActive: mocks.findActiveVocabulary
  }),
  createVttSceneRepository: () => ({
    appendEvent: mocks.appendEvent,
    findEventByCommand: mocks.findEventByCommand,
    findLiveScene: mocks.findLiveScene,
    findSessionPresentation: mocks.findSessionPresentation,
    lockSession: vi.fn(async () => ({ status: 'OPEN' })),
    listEventsAfter: mocks.listEventsAfter,
    findEncounterBinding: mocks.findEncounterBinding,
    lockLiveScene: mocks.lockLiveScene,
    listActorTokenBindings: mocks.listActorTokenBindings,
    lockLiveCommandContext: mocks.lockLiveCommandContext,
    publishLiveCommand: mocks.publishLiveCommand,
    updateProjection: mocks.updateProjection
  }),
  withTransaction: async <T>(db: DBLike, callback: (trx: DBLike) => Promise<T>) => callback(db)
}))

vi.mock('../campaign/campaignService.js', () => {
  class CampaignAccessError extends Error {
    constructor() {
      super('Campaign access denied.')
      this.name = 'CampaignAccessError'
    }
  }
  class CampaignConflictError extends Error {}
  return {
    CampaignAccessError,
    CampaignConflictError,
    assertActiveCampaignMember: vi.fn(),
    assertCampaignOwner: vi.fn(),
    assertCampaignWritable: vi.fn(),
    resolveCampaignAuthority: vi.fn(async () => ({
      campaign: { id: ids.campaign, status: 'ACTIVE', ownerUserId: ids.user },
      membership: { role: 'OWNER' }
    }))
  }
})

vi.mock('../campaign/liveSessionCommandAuthority.js', () => ({
  assertSessionLiveSessionCommandAuthority: vi.fn()
}))

vi.mock('./encounterRuleExecutionCommandContext.js', () => ({
  lockEncounterRuleExecutionCommandContext: mocks.lockContext
}))

vi.mock('./encounterActorRuleEvaluation.js', () => ({
  evaluateEncounterActorRuleSnapshot: mocks.actorRuleSnapshot
}))

vi.mock('./encounterProjection.js', () => ({
  compileEncounterCurrentProjection: (value: unknown) => value,
  projectGm: (value: unknown) => value
}))

vi.mock('./encounterActiveEffectTargetState.js', () => ({
  lockEncounterActiveEffectTargets: mocks.lockActiveEffectTargets,
  refreshLockedEncounterActiveEffectTargets: mocks.refreshActiveEffectTargets
}))

vi.mock('./encounterMovementReactionDiscovery.js', () => ({
  discoverEncounterMovementReactionChoices: mocks.reactionDiscovery
}))

vi.mock('./encounterSpatialMovementRuleService.js', () => ({
  evaluateEncounterSpatialMovementRuleBatch: mocks.spatialEvaluation
}))

vi.mock('./encounterMovementReactionContinuation.js', () => ({
  startEncounterMovementReactionAtBoundary: mocks.startReactionBoundary
}))

vi.mock('../rules/encounterFeatureActionCapabilityDiscoveryRegistry.js', () => ({
  discoverEncounterFeatureActionCapabilities: vi.fn(() => [])
}))

const { executeEncounterSceneCommandWithState } = await import('./vttSceneService.js')

const input = {
  barrierId: ids.encounter,
  commandId: ids.command,
  expectedSceneVersion: 0,
  sceneId: ids.scene,
  state: 'OPEN' as const,
  type: 'SET_SCENE_DOOR_STATE' as const
}

const liveContext = {
  authorityId: 'room-authority',
  campaignId: ids.campaign,
  sessionId: ids.session
}

function authoritativeSceneState(version = 0) {
  return {
    annotations: [],
    ambientIllumination: 'BRIGHT' as const,
    barriers: [
      {
        a: { x: 50, y: 0 },
        b: { x: 50, y: 100 },
        blocksLightWhenClosed: true,
        blocksMovementWhenClosed: true,
        id: ids.encounter,
        initialState: 'CLOSED' as const,
        kind: 'DOOR' as const,
        openAngleDegrees: 90
      }
    ],
    campaignId: ids.campaign,
    darknessZones: [],
    definitionId: ids.scene,
    definitionVersion: 1,
    doorStates: { [ids.encounter]: 'CLOSED' },
    fogLayers: [],
    fogMode: 'SHARED_PARTY' as const,
    grid: {
      kind: 'GRIDLESS' as const,
      pixelsPerUnit: 5,
      unit: 'FEET' as const
    },
    id: ids.scene,
    lights: [],
    map: {
      assetId: ids.scene,
      height: 100,
      tileManifestAssetId: null,
      width: 100
    },
    measurements: [],
    name: 'Live Scene',
    tokens: [],
    version,
    visionRevealMode: 'ON_DRAG' as const
  }
}

const darknessInput = {
  commandId: ids.command,
  expectedSceneVersion: 0,
  sceneId: ids.scene,
  type: 'UPSERT_SCENE_DARKNESS' as const,
  zone: {
    id: ids.scene,
    mechanicalIllumination: null,
    mechanicalObscurement: null,
    opacity: 0.5,
    polygon: {
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ]
    }
  }
}

function commandFingerprint(): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

const move = {
  commandId: ids.command,
  expectedEncounterVersion: 0,
  expectedSceneVersion: 0,
  correlationId: null,
  movementKind: 'VOLUNTARY' as const,
  path: [
    { x: 0, y: 0 },
    { x: 1, y: 0 }
  ],
  sceneId: ids.scene,
  tokenId: ids.token,
  type: 'MOVE_SCENE_TOKEN' as const
}

const mechanicsOptions = { encounterId: ids.encounter }

function pendingSpatialOccurrence(characterId: string) {
  return {
    id: '00000000-0000-4000-8000-000000000007',
    aggregateId: ids.encounter,
    aggregateKind: 'ENCOUNTER',
    rootCommandId: ids.command,
    state: 'PENDING',
    version: 0,
    expectedAggregateVersion: 0,
    pendingSnapshot: {
      snapshotKind: 'KERNEL_EVIDENCE',
      request: {
        requestId: 'spatial-roll',
        kind: 'INTEGER_RANGE',
        nodeId: 'node',
        ordinal: 0,
        min: 1,
        max: 20
      },
      applicationContext: {
        kind: 'ENCOUNTER_SPATIAL_MOVEMENT',
        root: {
          commandId: ids.command,
          commandFingerprint: createHash('sha256').update(JSON.stringify(move)).digest('hex'),
          initiatorUserId: ids.user,
          correlationId: null,
          encounterId: ids.encounter,
          sceneId: ids.scene,
          tokenId: ids.token,
          expectedEncounterVersion: 0,
          expectedSceneVersion: 0,
          movementKind: 'VOLUNTARY'
        },
        currentCandidate: {
          target: { kind: 'CHARACTER', characterId },
          d20Policy: { rollMode: 'NORMAL' }
        }
      }
    },
    pendingSnapshotChecksum: null,
    completedAt: null,
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z'
  }
}

function pendingMovementReactionOccurrence() {
  const option = {
    optionId: 'a'.repeat(64),
    contactSourceId: 'b'.repeat(64),
    actionId: 'controlled-reaction',
    actionSourceKind: 'CHARACTER_ACTION',
    actionSourceCurrentnessChecksum: 'c'.repeat(64),
    candidate: {
      contact: { x: 1, y: 0 },
      movingActorId: '00000000-0000-4000-8000-000000000008',
      pathDistance: 1,
      reactorActorId: '00000000-0000-4000-8000-000000000009',
      reactorTokenId: '00000000-0000-4000-8000-000000000010',
      sourceId: 'b'.repeat(64),
      stage: 'BEFORE_LEAVE_REACH'
    },
    binding: {
      kind: 'MOVEMENT',
      stage: 'BEFORE_LEAVE_REACH',
      perceptionRequirement: null,
      eligibilityDefinitionId: '00000000-0000-4000-8000-000000000010',
      movementInterruption: null
    },
    policy: {
      eligible: true,
      allowanceDefinitionId: '00000000-0000-4000-8000-000000000011',
      allowanceMaximum: 1,
      allowanceRefreshBoundary: 'START_OF_TURN',
      selectionPolicy: 'CHOICE',
      choiceDefinitionId: '00000000-0000-4000-8000-000000000012',
      targetPolicy: 'MOVER'
    },
    eligibilityEvidenceChecksum: 'd'.repeat(64),
    authority: {
      kind: 'CHARACTER_CONTROLLER',
      characterId: 'controlled-character'
    },
    visibility: 'CONTROLLER'
  }
  return {
    ...pendingSpatialOccurrence('controlled-character'),
    pendingSnapshot: {
      snapshotKind: 'KERNEL_EVIDENCE',
      request: {
        requestId: 'reaction-choice',
        kind: 'CHOICE',
        nodeId: 'choice',
        ordinal: 0,
        options: [0, 1]
      },
      applicationContext: {
        kind: 'ENCOUNTER_MOVEMENT_REACTION',
        phase: { kind: 'CHOICE' },
        root: {
          commandId: ids.command,
          commandFingerprint: createHash('sha256').update(JSON.stringify(move)).digest('hex'),
          initiatorUserId: ids.user,
          correlationId: null,
          encounterId: ids.encounter,
          sceneId: ids.scene,
          tokenId: ids.token,
          expectedEncounterVersion: 0,
          expectedSceneVersion: 0,
          movementKind: 'VOLUNTARY',
          currentSceneVersion: 1,
          resolutionCommands: []
        },
        reactionTimeline: [
          {
            kind: 'CONTROLLER_CHOICE',
            group: {
              pathDistance: 1,
              reactorActorId: option.candidate.reactorActorId,
              reactorTokenId: option.candidate.reactorTokenId,
              options: [option]
            }
          }
        ]
      }
    }
  }
}

describe('live Scene command lane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.lockContext.mockResolvedValue({
      encounter: { id: ids.encounter },
      context: { role: 'OWNER' }
    })
    mocks.findEncounterBinding.mockResolvedValue({ sceneId: ids.scene })
    mocks.lockLiveScene.mockResolvedValue({
      definitionSnapshot: {},
      state: authoritativeSceneState()
    })
    mocks.listActorTokenBindings.mockResolvedValue([])
    mocks.findEventByCommand.mockResolvedValue(null)
    mocks.findEncounterByRootCommand.mockResolvedValue(null)
    mocks.findLiveScene.mockResolvedValue({
      state: authoritativeSceneState()
    })
    mocks.findSessionPresentation.mockResolvedValue({ sceneId: ids.scene, version: 0 })
    mocks.findReceipt.mockResolvedValue(null)
    mocks.findTerminalReceiptByOccurrence.mockResolvedValue(null)
    mocks.lockPendingEncounter.mockResolvedValue(null)
    mocks.listEventsAfter.mockResolvedValue([])
    mocks.updateProjection.mockResolvedValue(true)
    mocks.appendEvent.mockResolvedValue(undefined)
    mocks.publishLiveCommand.mockResolvedValue(true)
    mocks.lockActiveEffectTargets.mockResolvedValue({
      lockedCharacters: new Map()
    })
    mocks.refreshActiveEffectTargets.mockResolvedValue({
      lockedCharacters: new Map()
    })
    mocks.findEncounter.mockResolvedValue({
      id: ids.encounter,
      campaignId: ids.campaign,
      version: 0,
      actors: []
    })
    mocks.lockActiveEffectsByOwner.mockResolvedValue([])
    mocks.listSpatialEffects.mockResolvedValue([])
    mocks.lockSpatialScope.mockResolvedValue({
      list: mocks.listSpatialEffects
    })
    mocks.findActiveVocabulary.mockResolvedValue({
      document: {
        schemaVersion: 2,
        abilities: [],
        conditionTypes: []
      }
    })
    mocks.reactionDiscovery.mockResolvedValue({
      reactionTimeline: [],
      firstBoundaryDistance: null
    })
    mocks.actorRuleSnapshot.mockImplementation(async ({ encounter }) => ({
      snapshot: { output: {} },
      reconciledEncounter: encounter,
      actorUpdates: []
    }))
  })

  it('fails closed when the single locked context read does not authorize the command', async () => {
    mocks.findLiveScene.mockResolvedValueOnce(null)

    await expect(
      executeEncounterSceneCommandWithState({} as DBLike, ids.user, input, {
        liveSceneContext: liveContext
      })
    ).rejects.toThrow('Campaign live Scene was not found.')
    expect(mocks.appendEvent).not.toHaveBeenCalled()
    expect(mocks.publishLiveCommand).not.toHaveBeenCalled()
    expect(mocks.lockLiveCommandContext).not.toHaveBeenCalled()
  })

  it('rejects a live command after the Session presents another Scene', async () => {
    mocks.findSessionPresentation.mockResolvedValueOnce({ sceneId: ids.otherScene, version: 1 })

    await expect(
      executeEncounterSceneCommandWithState({} as DBLike, ids.user, input, {
        liveSceneContext: liveContext
      })
    ).rejects.toThrow('Campaign access denied.')

    expect(mocks.lockLiveScene).not.toHaveBeenCalled()
    expect(mocks.appendEvent).not.toHaveBeenCalled()
    expect(mocks.publishLiveCommand).not.toHaveBeenCalled()
  })

  it('returns an idempotent replay from the locked context without another write', async () => {
    mocks.lockLiveCommandContext.mockResolvedValueOnce({
      membershipRole: 'PLAYER',
      priorEvent: {
        commandFingerprint: commandFingerprint(),
        commandType: input.type,
        createdAt: '2026-08-19T00:00:00.000Z',
        event: {
          actorUserId: ids.user,
          commandId: ids.command,
          delta: {
            barrierId: ids.encounter,
            kind: 'DOOR_STATE_SET',
            state: 'OPEN'
          },
          sceneId: ids.scene,
          version: 1
        },
        id: ids.command
      },
      scene: {
        definitionSnapshot: {},
        state: { id: ids.scene, version: 1 }
      }
    })
    mocks.findEventByCommand.mockResolvedValueOnce({
      commandFingerprint: commandFingerprint(),
      commandType: input.type,
      event: {
        actorUserId: ids.user,
        commandId: ids.command,
        delta: { barrierId: ids.encounter, kind: 'DOOR_STATE_SET', state: 'OPEN' },
        sceneId: ids.scene,
        version: 1
      },
      id: ids.command
    })

    const execution = await executeEncounterSceneCommandWithState({} as DBLike, ids.user, input, {
      liveSceneContext: liveContext
    })

    expect(execution.result).toMatchObject({ replayed: true, version: 1 })
    expect(mocks.appendEvent).not.toHaveBeenCalled()
    expect(mocks.publishLiveCommand).not.toHaveBeenCalled()
    expect(mocks.lockPendingEncounter).not.toHaveBeenCalled()
  })

  it('commits owner-authored ambient illumination through the authoritative live Scene lane', async () => {
    const state = authoritativeSceneState()
    mocks.lockLiveCommandContext.mockResolvedValueOnce({
      membershipRole: 'OWNER',
      priorEvent: null,
      scene: { definitionSnapshot: state, state }
    })
    mocks.publishLiveCommand.mockResolvedValueOnce(true)

    const execution = await executeEncounterSceneCommandWithState(
      {} as DBLike,
      ids.user,
      {
        commandId: ids.command,
        expectedSceneVersion: 0,
        illumination: 'DIM',
        sceneId: ids.scene,
        type: 'SET_SCENE_AMBIENT_ILLUMINATION'
      },
      { liveSceneContext: liveContext }
    )

    expect(execution.result).toMatchObject({
      delta: { illumination: 'DIM', kind: 'AMBIENT_ILLUMINATION_SET' },
      replayed: false,
      version: 1
    })
    expect(execution.state.ambientIllumination).toBe('DIM')
    expect(mocks.publishLiveCommand).toHaveBeenCalledOnce()
  })

  it('rejects a legacy visual-only darkness envelope unless it matches a prior receipt', async () => {
    await expect(
      executeEncounterSceneCommandWithState({} as DBLike, ids.user, {
        ...darknessInput,
        legacyReplayKind: LEGACY_VISUAL_ONLY_DARKNESS_REPLAY_KIND
      })
    ).rejects.toThrow('valid only for replaying a committed command')

    expect(mocks.appendEvent).not.toHaveBeenCalled()
    expect(mocks.publishLiveCommand).not.toHaveBeenCalled()
  })

  it('replays an exact historical visual-only darkness command from explicit-null current input', async () => {
    const { mechanicalIllumination, mechanicalObscurement, ...legacyZone } = darknessInput.zone
    const legacyCommand = { ...darknessInput, zone: legacyZone }
    const legacyFingerprint = createHash('sha256')
      .update(JSON.stringify(legacyCommand))
      .digest('hex')
    mocks.findEventByCommand.mockResolvedValueOnce({
      commandFingerprint: legacyFingerprint,
      commandType: darknessInput.type,
      createdAt: '2026-08-19T00:00:00.000Z',
      event: {
        actorUserId: ids.user,
        commandId: ids.command,
        delta: { kind: 'DARKNESS_UPSERTED', zone: darknessInput.zone },
        sceneId: ids.scene,
        version: 1
      },
      id: ids.command
    })

    const execution = await executeEncounterSceneCommandWithState(
      {} as DBLike,
      ids.user,
      darknessInput
    )

    expect(mechanicalIllumination).toBeNull()
    expect(mechanicalObscurement).toBeNull()
    expect(execution.result).toMatchObject({ replayed: true, version: 1 })
    expect(mocks.appendEvent).not.toHaveBeenCalled()
    expect(mocks.publishLiveCommand).not.toHaveBeenCalled()
  })

  it('locks the canonical Encounter root before direct Scene lock and rejects a fresh move while pending', async () => {
    mocks.lockPendingEncounter.mockResolvedValue({ id: 'pending' })
    const move = {
      commandId: ids.command,
      expectedEncounterVersion: 0,
      expectedSceneVersion: 0,
      correlationId: null,
      movementKind: 'VOLUNTARY' as const,
      path: [
        { x: 0, y: 0 },
        { x: 1, y: 0 }
      ],
      sceneId: ids.scene,
      tokenId: ids.token,
      type: 'MOVE_SCENE_TOKEN' as const
    }

    await expect(
      executeEncounterSceneCommandWithState({} as DBLike, ids.user, move, mechanicsOptions)
    ).rejects.toThrow('awaiting resolution')

    expect(mocks.lockContext).toHaveBeenCalledBefore(mocks.lockLiveScene)
    expect(mocks.appendEvent).not.toHaveBeenCalled()
    expect(mocks.publishLiveCommand).not.toHaveBeenCalled()
  })

  it('waits for the shared Encounter command context before taking the Scene lock', async () => {
    let releaseContext: (() => void) | undefined
    const contextGate = new Promise<void>((resolve) => {
      releaseContext = resolve
    })
    mocks.lockContext.mockImplementationOnce(async () => {
      await contextGate
      return {
        encounter: { id: ids.encounter },
        context: { role: 'OWNER' }
      }
    })
    mocks.lockPendingEncounter.mockResolvedValue({ id: 'pending' })

    const command = executeEncounterSceneCommandWithState(
      {} as DBLike,
      ids.user,
      {
        commandId: ids.command,
        expectedEncounterVersion: 0,
        expectedSceneVersion: 0,
        correlationId: null,
        movementKind: 'VOLUNTARY',
        path: [
          { x: 0, y: 0 },
          { x: 1, y: 0 }
        ],
        sceneId: ids.scene,
        tokenId: ids.token,
        type: 'MOVE_SCENE_TOKEN'
      },
      mechanicsOptions
    )
    await Promise.resolve()
    expect(mocks.lockLiveScene).not.toHaveBeenCalled()

    releaseContext!()
    await expect(command).rejects.toThrow('awaiting resolution')
    expect(mocks.lockContext).toHaveBeenCalledBefore(mocks.lockLiveScene)
  })

  it('commits only the first frozen reaction boundary and persists the same movement occurrence', async () => {
    const movingActorId = '00000000-0000-4000-8000-000000000020'
    const sceneState = {
      ...authoritativeSceneState(),
      tokens: [
        {
          assetId: null,
          controlledByUserIds: [ids.user],
          height: 1,
          hidden: false,
          id: ids.token,
          label: 'Mover',
          locked: false,
          position: { x: 0, y: 0 },
          rotationDegrees: 0,
          vision: null,
          width: 1
        }
      ]
    }
    mocks.lockContext.mockResolvedValueOnce({
      encounter: {
        id: ids.encounter,
        campaignId: ids.campaign,
        gameSystemId: '00000000-0000-4000-8000-000000000021',
        version: 0,
        automationMode: 'ASSISTED',
        actors: []
      },
      context: {
        role: 'OWNER',
        assignedCharacterId: null,
        attunementSlotOverride: null,
        advanceVersion: vi.fn(async () => 1)
      }
    })
    mocks.lockLiveScene.mockResolvedValueOnce({
      definitionSnapshot: {},
      state: sceneState
    })
    mocks.listActorTokenBindings.mockResolvedValueOnce([
      { actorId: movingActorId, tokenId: ids.token }
    ])
    const pending = pendingMovementReactionOccurrence()
    const reactionTimeline =
      pending.pendingSnapshot.applicationContext.kind === 'ENCOUNTER_MOVEMENT_REACTION'
        ? pending.pendingSnapshot.applicationContext.reactionTimeline
        : []
    mocks.reactionDiscovery.mockResolvedValueOnce({
      reactionTimeline,
      firstBoundaryDistance: 1
    })
    mocks.spatialEvaluation.mockResolvedValueOnce({
      kind: 'REACTION_BOUNDARY',
      boundaryDistance: 1,
      boundaryPosition: { x: 1, y: 0 },
      movementIntent: { tokenId: ids.token, position: { x: 1, y: 0 } },
      completedExecutions: [],
      appliedPrefix: null,
      completedReactionExecutions: [],
      remainingCandidates: [],
      resolutionCommands: [],
      selectionChecksum: 'a'.repeat(64),
      currentnessChecksum: 'b'.repeat(64)
    })
    mocks.startReactionBoundary.mockResolvedValueOnce(pending.pendingSnapshot)
    mocks.createPending.mockResolvedValueOnce(pending)

    const result = await executeEncounterSceneCommandWithState({} as DBLike, ids.user, move, {
      createRuleOccurrenceId: () => pending.id,
      rulesRuntime: {} as never,
      encounterId: ids.encounter
    })

    expect(mocks.spatialEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({ interruptAfterPathDistance: 1 })
    )
    expect(mocks.reactionDiscovery).toHaveBeenCalledWith(
      expect.objectContaining({ automationMode: 'ASSISTED' })
    )
    expect(mocks.refreshActiveEffectTargets).not.toHaveBeenCalled()
    expect(mocks.startReactionBoundary).toHaveBeenCalledWith(
      expect.objectContaining({
        occurrenceId: pending.id,
        currentSceneVersion: 1,
        reactionTimeline
      })
    )
    expect(mocks.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateId: ids.encounter,
        occurrenceId: pending.id,
        rootCommandId: ids.command
      })
    )
    expect(mocks.appendReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateId: ids.encounter,
        commandId: ids.command,
        commandType: 'MOVE_SCENE_TOKEN',
        occurrenceId: pending.id,
        resultPayload: expect.objectContaining({
          status: 'ENCOUNTER_OCCURRENCE_PENDING',
          occurrenceId: pending.id
        })
      })
    )
    expect(result.result).toMatchObject({
      replayed: false,
      delta: { kind: 'TOKEN_MOVED', position: { x: 1, y: 0 } },
      occurrence: { status: 'PENDING' },
      version: 1
    })
    expect(result.state.tokens[0]?.position).toEqual({ x: 1, y: 0 })

    const pendingReceipt = mocks.appendReceipt.mock.calls[0]?.[0]
    expect(pendingReceipt).toBeDefined()
    mocks.lockContext.mockResolvedValueOnce({
      encounter: {
        id: ids.encounter,
        campaignId: ids.campaign,
        version: 0
      },
      context: { role: 'OWNER', assignedCharacterId: null }
    })
    mocks.lockLiveScene.mockResolvedValueOnce({
      definitionSnapshot: {},
      state: sceneState
    })
    mocks.findEncounterByRootCommand.mockResolvedValueOnce(pending)
    mocks.findReceipt.mockResolvedValueOnce(pendingReceipt)

    const replay = await executeEncounterSceneCommandWithState({} as DBLike, ids.user, move, {
      createRuleOccurrenceId: () => pending.id,
      rulesRuntime: {} as never,
      encounterId: ids.encounter
    })

    expect(replay.result.replayed).toBe(true)
    expect(replay.spatialChangedAggregates).toEqual(result.spatialChangedAggregates)
    expect(replay.result.occurrence).toEqual(pendingReceipt.resultPayload.occurrence)
    expect(mocks.spatialEvaluation).toHaveBeenCalledTimes(1)
  })

  it('redacts a pending spatial roll from a controller other than its Character target', async () => {
    mocks.lockContext.mockResolvedValueOnce({
      encounter: { id: ids.encounter, version: 0 },
      context: { role: 'PLAYER', assignedCharacterId: 'other-character' }
    })
    mocks.findEncounterByRootCommand.mockResolvedValueOnce(
      pendingSpatialOccurrence('target-character')
    )
    mocks.findReceipt.mockResolvedValueOnce({
      commandMetadata: { transition: 'SPATIAL_MOVEMENT', changedAggregates: [] },
      resultPayload: {
        status: 'ENCOUNTER_OCCURRENCE_PENDING',
        occurrence: { pending: { kind: 'D20_EVIDENCE', request: { requestId: 'stale-private' } } }
      }
    } as never)

    const result = await executeEncounterSceneCommandWithState(
      {} as DBLike,
      ids.user,
      move,
      mechanicsOptions
    )

    expect(result.result).toMatchObject({
      replayed: true,
      occurrence: { status: 'PENDING', pending: null }
    })
  })

  it('shows a pending spatial roll only to the target Character controller or GM', async () => {
    mocks.lockContext.mockResolvedValueOnce({
      encounter: { id: ids.encounter, version: 0 },
      context: { role: 'PLAYER', assignedCharacterId: 'target-character' }
    })
    mocks.findEncounterByRootCommand.mockResolvedValueOnce(
      pendingSpatialOccurrence('target-character')
    )

    const result = await executeEncounterSceneCommandWithState(
      {} as DBLike,
      ids.user,
      move,
      mechanicsOptions
    )

    expect(result.result.occurrence?.pending).toMatchObject({
      request: { requestId: 'spatial-roll', min: 1, max: 20 },
      allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
    })
  })

  it('projects a movement reaction choice only to its current Character controller', async () => {
    mocks.lockContext.mockResolvedValueOnce({
      encounter: { id: ids.encounter, version: 0 },
      context: { role: 'PLAYER', assignedCharacterId: 'controlled-character' }
    })
    mocks.findEncounterByRootCommand.mockResolvedValueOnce(pendingMovementReactionOccurrence())

    const result = await executeEncounterSceneCommandWithState(
      {} as DBLike,
      ids.user,
      move,
      mechanicsOptions
    )

    expect(result.result.occurrence?.pending).toEqual({
      kind: 'MOVEMENT_REACTION',
      occurrenceId: '00000000-0000-4000-8000-000000000007',
      occurrenceVersion: 0,
      encounterVersion: 0,
      choice: {
        pathDistance: 1,
        reactorActorId: '00000000-0000-4000-8000-000000000009',
        reactorTokenId: '00000000-0000-4000-8000-000000000010',
        options: [
          {
            optionId: 'a'.repeat(64),
            actionId: 'controlled-reaction',
            actionSourceKind: 'CHARACTER_ACTION'
          }
        ]
      },
      allowedResponses: ['DECLINE', 'OPTION']
    })
  })

  it('redacts a movement reaction choice from another Character controller', async () => {
    mocks.lockContext.mockResolvedValueOnce({
      encounter: { id: ids.encounter, version: 0 },
      context: { role: 'PLAYER', assignedCharacterId: 'other-character' }
    })
    mocks.findEncounterByRootCommand.mockResolvedValueOnce(pendingMovementReactionOccurrence())

    const result = await executeEncounterSceneCommandWithState(
      {} as DBLike,
      ids.user,
      move,
      mechanicsOptions
    )

    expect(result.result.occurrence).toMatchObject({
      status: 'PENDING',
      pending: null
    })
  })

  it('rejects a completed no-Scene replay when its terminal receipt does not match the root', async () => {
    mocks.findEncounterByRootCommand.mockResolvedValueOnce(
      Object.assign({}, pendingSpatialOccurrence('target-character') as object, {
        state: 'COMPLETED',
        pendingSnapshot: null
      })
    )
    mocks.findTerminalReceiptByOccurrence.mockResolvedValueOnce({
      aggregateKind: 'ENCOUNTER',
      aggregateId: ids.encounter,
      commandId: ids.command,
      commandFingerprint: '0'.repeat(64),
      occurrenceId: '00000000-0000-4000-8000-000000000007',
      aggregateVersion: 1,
      commandType: 'MOVE_SCENE_TOKEN',
      actorUserId: ids.user,
      correlationId: null,
      commandMetadata: { transition: 'SPATIAL_MOVEMENT' }
    } as never)

    await expect(
      executeEncounterSceneCommandWithState({} as DBLike, ids.user, move, mechanicsOptions)
    ).rejects.toThrow('identity')
  })

  it('replays a completed no-op root movement from its terminal movement receipt', async () => {
    const pending = pendingSpatialOccurrence('target-character')
    const root = pending.pendingSnapshot.applicationContext.root
    mocks.findEncounterByRootCommand.mockResolvedValueOnce({
      ...pending,
      pendingSnapshot: null,
      state: 'COMPLETED'
    })
    mocks.findTerminalReceiptByOccurrence.mockResolvedValueOnce({
      aggregateId: ids.encounter,
      aggregateKind: 'ENCOUNTER',
      actorUserId: ids.user,
      aggregateVersion: 1,
      commandFingerprint: root.commandFingerprint,
      commandId: root.commandId,
      commandMetadata: {
        commandType: 'MOVE_SCENE_TOKEN',
        encounterId: root.encounterId,
        expectedEncounterVersion: root.expectedEncounterVersion,
        expectedSceneVersion: root.expectedSceneVersion,
        movementKind: root.movementKind,
        rootCommandFingerprint: root.commandFingerprint,
        rootCommandId: root.commandId,
        rootCorrelationId: root.correlationId,
        rootExpectedEncounterVersion: root.expectedEncounterVersion,
        rootExpectedSceneVersion: root.expectedSceneVersion,
        rootInitiatorUserId: root.initiatorUserId,
        sceneId: root.sceneId,
        tokenId: root.tokenId,
        transition: 'SPATIAL_MOVEMENT'
      },
      commandType: 'MOVE_SCENE_TOKEN',
      correlationId: null,
      occurrenceId: pending.id,
      resultPayload: {
        encounterVersion: 1,
        sceneVersion: 0,
        status: 'MOVEMENT_COMPLETE'
      }
    } as never)

    const result = await executeEncounterSceneCommandWithState(
      {} as DBLike,
      ids.user,
      move,
      mechanicsOptions
    )

    expect(result.result).toMatchObject({
      delta: null,
      replayed: true,
      version: 0
    })
    expect(result.spatialTerminalResult).toMatchObject({
      encounterVersion: 1,
      sceneVersion: 0,
      status: 'MOVEMENT_COMPLETE'
    })
    expect(mocks.appendEvent).not.toHaveBeenCalled()
    expect(mocks.publishLiveCommand).not.toHaveBeenCalled()
  })

  it('replays an original move from terminal resolution metadata rather than the resolution envelope', async () => {
    const pending = pendingSpatialOccurrence('target-character')
    const root = pending.pendingSnapshot.applicationContext.root
    mocks.findEncounterByRootCommand.mockResolvedValueOnce({
      ...pending,
      pendingSnapshot: null,
      state: 'COMPLETED'
    })
    mocks.findTerminalReceiptByOccurrence.mockResolvedValueOnce({
      aggregateId: ids.encounter,
      aggregateKind: 'ENCOUNTER',
      actorUserId: 'resolution-controller',
      aggregateVersion: 1,
      commandFingerprint: '1'.repeat(64),
      commandId: '00000000-0000-4000-8000-000000000008',
      commandMetadata: {
        commandType: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: root.encounterId,
        expectedEncounterVersion: root.expectedEncounterVersion + 2,
        expectedSceneVersion: root.expectedSceneVersion + 4,
        movementKind: root.movementKind,
        rootCommandFingerprint: root.commandFingerprint,
        rootCommandId: root.commandId,
        rootCorrelationId: root.correlationId,
        rootExpectedEncounterVersion: root.expectedEncounterVersion,
        rootExpectedSceneVersion: root.expectedSceneVersion,
        rootInitiatorUserId: root.initiatorUserId,
        sceneId: root.sceneId,
        selectionChecksum: '2'.repeat(64),
        tokenId: root.tokenId,
        transition: 'SPATIAL_MOVEMENT'
      },
      commandType: 'RESOLVE_RULE_OCCURRENCE',
      correlationId: null,
      occurrenceId: pending.id,
      resultPayload: {
        batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT',
        encounterVersion: root.expectedEncounterVersion + 2,
        sceneVersion: root.expectedSceneVersion + 4,
        status: 'BATCH_COMPLETE'
      }
    } as never)

    const result = await executeEncounterSceneCommandWithState(
      {} as DBLike,
      ids.user,
      move,
      mechanicsOptions
    )

    expect(result.result).toMatchObject({ replayed: true, version: 4 })
    expect(result.spatialTerminalResult).toMatchObject({
      batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT',
      encounterVersion: root.expectedEncounterVersion + 2,
      sceneVersion: 4
    })
    expect(result.spatialChangedAggregates).toEqual([])
    expect(mocks.appendEvent).not.toHaveBeenCalled()
    expect(mocks.publishLiveCommand).not.toHaveBeenCalled()
  })
})
