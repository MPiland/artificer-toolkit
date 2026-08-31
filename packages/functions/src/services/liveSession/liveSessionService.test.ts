import type { DBLike } from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterSheetCommittedRuleSnapshot } from '../character/sheetService.js'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  encounter: '00000000-0000-4000-8000-000000000002',
  scene: '00000000-0000-4000-8000-000000000007',
  session: '00000000-0000-4000-8000-000000000003',
  playerA: '00000000-0000-4000-8000-000000000004',
  characterA: '00000000-0000-4000-8000-000000000005',
  characterB: '00000000-0000-4000-8000-000000000006',
  occurrence: '00000000-0000-4000-8000-000000000008'
} as const

const mocks = vi.hoisted(() => ({
  resolveCampaignAuthority: vi.fn(),
  listActiveMemberships: vi.fn(),
  listCampaignSessions: vi.fn(),
  listSessionAttendance: vi.fn(),
  findCharacter: vi.fn(),
  findEncounter: vi.fn(),
  findActiveEncounter: vi.fn(),
  listEncounters: vi.fn(),
  requireCurrentProjection: vi.fn(),
  findLiveScene: vi.fn(),
  findSessionPresentation: vi.fn(),
  findEncounterBinding: vi.fn(),
  listActorTokenBindings: vi.fn(),
  executeSceneCommand: vi.fn(),
  setLiveScenePresentation: vi.fn(),
  bindEncounterToPresentedScene: vi.fn(),
  executeActorTokenBinding: vi.fn(),
  executeEncounterCommand: vi.fn(),
  executeCompactLiveHitPoints: vi.fn(),
  executeCompactMaximumHitPointModifier: vi.fn(),
  executeCharacterSheetCommand: vi.fn(),
  loadCharacterSceneVision: vi.fn(),
  loadCharacterRuleSnapshot: vi.fn(),
  lockCampaignForCommand: vi.fn(),
  claimLiveSessionCommandAuthority: vi.fn(),
  renewLiveSessionCommandAuthority: vi.fn(),
  createCampaignCollaborationRepository: vi.fn(),
  createLiveSessionCommandLeaseRepository: vi.fn(),
  listPendingEncounters: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createCampaignCollaborationRepository: mocks.createCampaignCollaborationRepository,
    createCampaignRepository: () => ({ listActiveMemberships: mocks.listActiveMemberships }),
    createCharacterRepository: () => ({ findById: mocks.findCharacter }),
    createEncounterRepository: () => ({
      find: mocks.findEncounter,
      findActiveForCampaign: mocks.findActiveEncounter,
      listVersionMetadataForSession: mocks.listEncounters,
      requireCurrentProjection: mocks.requireCurrentProjection
    }),
    createVttSceneRepository: () => ({
      findLiveScene: mocks.findLiveScene,
      findSessionPresentation: mocks.findSessionPresentation,
      findEncounterBinding: mocks.findEncounterBinding,
      listActorTokenBindings: mocks.listActorTokenBindings
    }),
    createLiveSessionCommandLeaseRepository: mocks.createLiveSessionCommandLeaseRepository,
    createRuleOccurrenceRepository: () => ({
      listPendingEncounters: mocks.listPendingEncounters
    })
  }
})

vi.mock('../campaign/campaignService.js', () => {
  class CampaignAccessError extends Error {
    constructor() {
      super('Campaign access denied.')
      this.name = 'CampaignAccessError'
    }
  }
  return {
    CampaignAccessError,
    resolveCampaignAuthority: mocks.resolveCampaignAuthority,
    assertCampaignWritable: vi.fn()
  }
})

vi.mock('../character/characterLiveSessionSnapshot.js', () => ({
  loadCharacterSceneVisionForLiveSessionCampaign: mocks.loadCharacterSceneVision,
  resolveCharacterSceneVisionDimRangeFeet: () => null,
  loadCharacterRuleSnapshotForLiveSessionCampaign: mocks.loadCharacterRuleSnapshot
}))

vi.mock('../campaign/liveSessionCommandAuthority.js', () => ({
  claimLiveSessionCommandAuthority: mocks.claimLiveSessionCommandAuthority,
  releaseLiveSessionCommandAuthority: vi.fn(),
  renewLiveSessionCommandAuthority: mocks.renewLiveSessionCommandAuthority
}))

vi.mock('../character/sheetService.js', () => ({
  executeCompactLiveCharacterHitPointCommand: mocks.executeCompactLiveHitPoints,
  executeCompactLiveMaximumHitPointModifierCommand: mocks.executeCompactMaximumHitPointModifier,
  executeCharacterSheetCommandWithRuleEvaluation: mocks.executeCharacterSheetCommand
}))

vi.mock('../encounter/vttSceneService.js', () => ({
  bindEncounterToPresentedScene: mocks.bindEncounterToPresentedScene,
  executeEncounterSceneActorTokenBindingCommand: mocks.executeActorTokenBinding,
  executeEncounterSceneCommandWithState: mocks.executeSceneCommand,
  setCampaignLiveScenePresentation: mocks.setLiveScenePresentation
}))

vi.mock('../encounter/encounterService.js', () => ({
  executeEncounterCommandWithRuleSnapshot: mocks.executeEncounterCommand
}))

const {
  claimLiveSessionRoomCommandAuthority,
  executeLiveSessionCommand,
  loadLiveSessionCoordinatorSnapshot,
  loadLiveSessionRoomSnapshot,
  renewLiveSessionRoomCommandAuthority,
  classifyLiveSessionCommandError
} = await import('./liveSessionService.js')

const transactionDb = { isTransaction: true } as unknown as DBLike

function ruleSnapshot(streamVersion: number) {
  return {
    streamVersion,
    evaluation: { output: { senses: [] } },
    resolution: {}
  }
}

describe('live-session room snapshot authorization', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.executeCompactLiveHitPoints.mockReset()
    mocks.executeCompactMaximumHitPointModifier.mockReset()
    mocks.executeCharacterSheetCommand.mockReset()
    mocks.executeEncounterCommand.mockReset()
    mocks.executeSceneCommand.mockReset()
    mocks.listActiveMemberships.mockResolvedValue([{ role: 'PLAYER', userId: ids.playerA }])
    mocks.renewLiveSessionCommandAuthority.mockResolvedValue(undefined)
    mocks.lockCampaignForCommand.mockResolvedValue(true)
    mocks.createCampaignCollaborationRepository.mockReturnValue({
      listCampaignSessions: mocks.listCampaignSessions,
      listSessionAttendance: mocks.listSessionAttendance
    })
    mocks.createLiveSessionCommandLeaseRepository.mockReturnValue({
      lockCampaignForCommand: mocks.lockCampaignForCommand
    })
    mocks.resolveCampaignAuthority.mockResolvedValue({
      campaign: {
        id: ids.campaign,
        attunementSlotOverride: 4,
        status: 'ACTIVE',
        version: 3
      },
      membership: { role: 'PLAYER', status: 'ACTIVE' }
    })
    mocks.listCampaignSessions.mockResolvedValue([{ id: ids.session, status: 'OPEN' }])
    mocks.listSessionAttendance.mockResolvedValue([
      { characterId: ids.characterA, present: true },
      { characterId: ids.characterB, present: true }
    ])
    mocks.findCharacter.mockImplementation(async (characterId: string) => ({
      id: characterId,
      stream_version: characterId === ids.characterA ? 7 : 11
    }))
    mocks.listEncounters.mockResolvedValue([])
    mocks.findSessionPresentation.mockResolvedValue(null)
    mocks.findLiveScene.mockResolvedValue(null)
    mocks.findEncounterBinding.mockResolvedValue(null)
    mocks.listActorTokenBindings.mockResolvedValue([])
    mocks.findActiveEncounter.mockResolvedValue(null)
    mocks.listPendingEncounters.mockResolvedValue([])
    mocks.loadCharacterRuleSnapshot.mockImplementation(async (_db, characterId: string) =>
      ruleSnapshot(characterId === ids.characterA ? 7 : 11)
    )
    mocks.loadCharacterSceneVision.mockImplementation(async (_db, characterId: string) => ({
      streamVersion: characterId === ids.characterA ? 7 : 11,
      dimRangeFeet: null
    }))
  })

  it('keeps the Campaign lock, admission, and lease claim in the transaction it opens for a direct caller', async () => {
    const trx = { isTransaction: true } as unknown as DBLike
    const db = {
      transaction: () => ({
        execute: async (callback: (transaction: DBLike) => Promise<void>) => callback(trx)
      })
    } as unknown as DBLike

    await claimLiveSessionRoomCommandAuthority(
      db,
      ids.playerA,
      {
        campaignId: ids.campaign,
        sessionId: ids.session
      },
      'room-authority'
    )

    expect(mocks.lockCampaignForCommand).toHaveBeenCalledWith(ids.campaign)
    expect(mocks.createLiveSessionCommandLeaseRepository).toHaveBeenCalledWith(trx)
    expect(mocks.resolveCampaignAuthority).toHaveBeenCalledWith(trx, ids.campaign, ids.playerA)
    expect(mocks.createCampaignCollaborationRepository).toHaveBeenCalledWith(trx)
    expect(mocks.listCampaignSessions).toHaveBeenCalledWith(ids.campaign)
    expect(mocks.claimLiveSessionCommandAuthority).toHaveBeenCalledWith(trx, {
      authorityId: 'room-authority',
      sessionId: ids.session
    })
  })

  it('renews membership and authoritative aggregate versions under the Campaign lock', async () => {
    const renewal = await renewLiveSessionRoomCommandAuthority(
      transactionDb,
      ids.playerA,
      { campaignId: ids.campaign, sessionId: ids.session },
      'room-authority'
    )

    expect(mocks.lockCampaignForCommand).toHaveBeenCalledWith(ids.campaign)
    expect(mocks.renewLiveSessionCommandAuthority).toHaveBeenCalledWith(transactionDb, {
      authorityId: 'room-authority',
      sessionId: ids.session
    })
    expect(renewal).toEqual({
      aggregateVersions: [
        { aggregateId: ids.campaign, aggregateKind: 'CAMPAIGN', version: 3 },
        { aggregateId: ids.characterA, aggregateKind: 'CHARACTER', version: 7 },
        { aggregateId: ids.characterB, aggregateKind: 'CHARACTER', version: 11 }
      ],
      memberships: [{ role: 'PLAYER', userId: ids.playerA }]
    })
  })

  it('hydrates the transport coordinator without assembling full Character Sheet snapshots', async () => {
    const snapshot = await loadLiveSessionCoordinatorSnapshot(transactionDb, ids.playerA, {
      campaignId: ids.campaign,
      sessionId: ids.session
    })

    expect(snapshot.characterVisions).toEqual([
      { characterId: ids.characterA, dimRange: null },
      { characterId: ids.characterB, dimRange: null }
    ])
    expect(mocks.loadCharacterSceneVision).toHaveBeenCalledTimes(2)
    expect(mocks.loadCharacterRuleSnapshot).not.toHaveBeenCalled()
  })

  it('lets Player A hydrate Player B through the assigned-Campaign rule snapshot seam', async () => {
    const snapshot = await loadLiveSessionRoomSnapshot(transactionDb, ids.playerA, {
      campaignId: ids.campaign,
      sessionId: ids.session
    })

    expect(snapshot.characterRuleSnapshots.map(({ characterId }) => characterId)).toEqual([
      ids.characterA,
      ids.characterB
    ])
    expect(mocks.loadCharacterRuleSnapshot).toHaveBeenCalledTimes(2)
    expect(mocks.loadCharacterRuleSnapshot).toHaveBeenCalledWith(
      expect.anything(),
      ids.characterB,
      { id: ids.campaign, attunementSlotOverride: 4, version: 3 }
    )
  })

  it('hydrates Encounter command facts from the committed projection', async () => {
    mocks.listEncounters.mockResolvedValue([{ id: ids.encounter, version: 3 }])
    mocks.requireCurrentProjection.mockResolvedValue({
      encounterId: ids.encounter,
      projection: {
        actors: [
          {
            id: ids.encounter,
            kind: 'CHARACTER',
            sourceId: ids.characterA
          }
        ]
      },
      ruleSnapshot: {
        encounterVersion: 3,
        facts: { actors: [], contractVersion: 1 },
        output: { actors: [] },
        revisionId: ids.encounter
      }
    })
    mocks.listPendingEncounters.mockResolvedValue([
      {
        aggregateId: ids.encounter,
        id: ids.occurrence,
        pendingSnapshot: {
          applicationContext: {
            kind: 'ENCOUNTER_SPATIAL_MOVEMENT',
            root: { sceneId: ids.scene }
          }
        }
      }
    ])
    mocks.listActorTokenBindings.mockResolvedValue([
      { actorId: ids.encounter, tokenId: ids.characterB }
    ])

    const snapshot = await loadLiveSessionRoomSnapshot(transactionDb, ids.playerA, {
      campaignId: ids.campaign,
      sessionId: ids.session
    })

    expect(mocks.requireCurrentProjection).toHaveBeenCalledWith({
      encounterId: ids.encounter,
      expectedStreamVersion: 3
    })
    expect(snapshot.encounterCharacterBindings).toEqual([
      {
        actorId: ids.encounter,
        characterId: ids.characterA,
        encounterId: ids.encounter,
        tokenId: ids.characterB
      }
    ])
    expect(snapshot.encounterRuleOccurrenceBindings).toEqual([
      {
        encounterId: ids.encounter,
        executionKind: 'SPATIAL',
        occurrenceId: ids.occurrence,
        sceneId: ids.scene
      }
    ])
    expect(snapshot.encounterRuleSnapshots).toEqual([
      {
        encounterId: ids.encounter,
        snapshot: {
          encounterVersion: 3,
          facts: { actors: [], contractVersion: 1 },
          output: { actors: [] },
          revisionId: ids.encounter
        }
      }
    ])
  })

  it('fails before hydration for a nonmember', async () => {
    mocks.resolveCampaignAuthority.mockRejectedValueOnce(
      Object.assign(new Error('Campaign not found.'), {
        name: 'CampaignNotFoundError'
      })
    )

    await expect(
      loadLiveSessionRoomSnapshot(transactionDb, ids.playerA, {
        campaignId: ids.campaign,
        sessionId: ids.session
      })
    ).rejects.toMatchObject({ name: 'CampaignNotFoundError' })
    expect(mocks.loadCharacterRuleSnapshot).not.toHaveBeenCalled()
  })

  it('fails when a present Character is not assigned to the admitted Campaign', async () => {
    mocks.loadCharacterRuleSnapshot.mockImplementation(async (_db, characterId: string) =>
      characterId === ids.characterB ? null : ruleSnapshot(7)
    )

    await expect(
      loadLiveSessionRoomSnapshot(transactionDb, ids.playerA, {
        campaignId: ids.campaign,
        sessionId: ids.session
      })
    ).rejects.toMatchObject({ name: 'CampaignAccessError' })
  })

  it('uses the locked Scene command lane without pre-hydrating Campaign or Encounter state', async () => {
    const commandId = '00000000-0000-4000-8000-000000000007'
    mocks.executeSceneCommand.mockResolvedValue({
      result: {
        commandId,
        delta: { barrierId: ids.encounter, kind: 'DOOR_STATE_SET', state: 'OPEN' },
        replayed: false,
        sceneId: ids.encounter,
        version: 1
      },
      state: { id: ids.encounter, version: 1 }
    })

    await executeLiveSessionCommand(
      {} as DBLike,
      ids.playerA,
      { campaignId: ids.campaign, sessionId: ids.session },
      {
        aggregateKind: 'SCENE',
        command: {
          barrierId: ids.encounter,
          commandId,
          expectedSceneVersion: 0,
          sceneId: ids.encounter,
          state: 'OPEN',
          type: 'SET_SCENE_DOOR_STATE'
        }
      },
      'room-authority',
      { characterVisions: [], encounterCharacterBindings: [] }
    )

    expect(mocks.resolveCampaignAuthority).not.toHaveBeenCalled()
    expect(mocks.executeSceneCommand).toHaveBeenCalledWith(
      expect.anything(),
      ids.playerA,
      expect.objectContaining({ type: 'SET_SCENE_DOOR_STATE' }),
      {
        liveSceneContext: {
          authorityId: 'room-authority',
          campaignId: ids.campaign,
          sessionId: ids.session
        },
        liveSessionAuthority: {
          authorityId: 'room-authority',
          sessionId: ids.session
        },
        sceneVisionContext: { characterVisions: [], encounterCharacterBindings: [] }
      }
    )
  })

  it('publishes a fresh reaction-only movement as one exact multi-root transition', async () => {
    const commandId = '00000000-0000-4000-8000-000000000009'
    const sceneState = { campaignId: ids.campaign, id: ids.scene, version: 1 }
    mocks.executeSceneCommand.mockResolvedValue({
      result: {
        commandId,
        delta: {
          kind: 'TOKEN_MOVED',
          position: { x: 5, y: 0 },
          tokenId: ids.characterB
        },
        occurrence: {
          occurrenceId: ids.occurrence,
          occurrenceVersion: 0,
          outcome: null,
          pending: null,
          status: 'COMPLETE'
        },
        replayed: false,
        sceneId: ids.scene,
        version: 1
      },
      spatialTerminalResult: {
        status: 'MOVEMENT_COMPLETE',
        schemaVersion: 1,
        occurrenceId: ids.occurrence,
        occurrenceVersion: 0,
        encounterId: ids.encounter,
        encounterVersion: 4,
        sceneId: ids.scene,
        sceneVersion: 1,
        tokenId: ids.characterB,
        movementKind: 'VOLUNTARY',
        reactionExecutions: [
          {
            sourceCommandId: commandId,
            characterTransitions: [
              {
                characterId: ids.characterA,
                beforeStreamVersion: 7,
                afterStreamVersion: 8
              }
            ]
          }
        ],
        terminalPosition: { x: 5, y: 0 }
      },
      spatialChangedAggregates: [
        {
          aggregateId: ids.characterA,
          aggregateKind: 'CHARACTER',
          beforeVersion: 7,
          version: 8
        },
        {
          aggregateId: ids.encounter,
          aggregateKind: 'ENCOUNTER',
          beforeVersion: 3,
          version: 4
        },
        {
          aggregateId: ids.scene,
          aggregateKind: 'SCENE',
          beforeVersion: 0,
          version: 1
        }
      ],
      state: sceneState
    })
    mocks.loadCharacterRuleSnapshot.mockResolvedValueOnce(ruleSnapshot(8))
    mocks.requireCurrentProjection.mockResolvedValue({ ruleSnapshot: ruleSnapshot(4) })
    mocks.findActiveEncounter.mockResolvedValue({
      campaignId: ids.campaign,
      id: ids.encounter,
      sessionId: ids.session,
      version: 3
    })
    mocks.findEncounterBinding.mockResolvedValue({ sceneId: ids.scene })
    mocks.findLiveScene.mockResolvedValue({ state: sceneState })

    const execution = await executeLiveSessionCommand(
      {} as DBLike,
      ids.playerA,
      { campaignId: ids.campaign, sessionId: ids.session },
      {
        aggregateKind: 'SCENE',
        command: {
          commandId,
          correlationId: null,
          expectedEncounterVersion: 3,
          expectedSceneVersion: 0,
          movementKind: 'VOLUNTARY',
          path: [
            { x: 0, y: 0 },
            { x: 5, y: 0 }
          ],
          sceneId: ids.scene,
          tokenId: ids.characterB,
          type: 'MOVE_SCENE_TOKEN'
        }
      },
      'room-authority',
      { characterVisions: [], encounterCharacterBindings: [] }
    )

    expect(execution.changedAggregates).toEqual([
      {
        aggregateId: ids.characterA,
        aggregateKind: 'CHARACTER',
        beforeVersion: 7,
        version: 8
      },
      {
        aggregateId: ids.encounter,
        aggregateKind: 'ENCOUNTER',
        beforeVersion: 3,
        version: 4
      },
      {
        aggregateId: ids.scene,
        aggregateKind: 'SCENE',
        beforeVersion: 0,
        version: 1
      }
    ])
    expect(execution.spatialRefresh).toMatchObject({
      characterRuleSnapshots: [{ characterId: ids.characterA, snapshot: { streamVersion: 8 } }],
      encounterRuleSnapshot: { streamVersion: 4 },
      sceneState
    })
  })

  it('replays an original movement from its own transitions after later resolutions advanced the occurrence', async () => {
    const commandId = '00000000-0000-4000-8000-000000000010'
    mocks.executeSceneCommand.mockResolvedValue({
      result: {
        commandId,
        delta: null,
        occurrence: {
          occurrenceId: ids.occurrence,
          occurrenceVersion: 3,
          outcome: null,
          pending: null,
          status: 'COMPLETE'
        },
        replayed: true,
        sceneId: ids.scene,
        version: 4
      },
      spatialChangedAggregates: [],
      spatialTerminalResult: {
        status: 'BATCH_COMPLETE',
        batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT',
        schemaVersion: 1,
        occurrenceId: ids.occurrence,
        occurrenceVersion: 3,
        encounterId: ids.encounter,
        encounterVersion: 5,
        sceneId: ids.scene,
        sceneVersion: 4,
        tokenId: ids.characterB,
        movementKind: 'VOLUNTARY',
        reactionExecutions: [],
        terminalPosition: { x: 5, y: 0 },
        executions: [],
        spatialEffectTransitions: [],
        characterTransitions: [],
        encounterActorTransitions: []
      },
      state: { campaignId: ids.campaign, id: ids.scene, version: 4 }
    })
    mocks.findActiveEncounter.mockResolvedValue({
      campaignId: ids.campaign,
      id: ids.encounter,
      sessionId: ids.session,
      version: 3
    })
    mocks.findEncounterBinding.mockResolvedValue({ sceneId: ids.scene })

    const execution = await executeLiveSessionCommand(
      {} as DBLike,
      ids.playerA,
      { campaignId: ids.campaign, sessionId: ids.session },
      {
        aggregateKind: 'SCENE',
        command: {
          commandId,
          correlationId: null,
          expectedEncounterVersion: 3,
          expectedSceneVersion: 0,
          movementKind: 'VOLUNTARY',
          path: [
            { x: 0, y: 0 },
            { x: 5, y: 0 }
          ],
          sceneId: ids.scene,
          tokenId: ids.characterB,
          type: 'MOVE_SCENE_TOKEN'
        }
      },
      'room-authority',
      { characterVisions: [], encounterCharacterBindings: [] }
    )

    expect(execution.replayed).toBe(true)
    expect(execution.changedAggregates).toEqual([])
    expect(execution.spatialRefresh).toBeUndefined()
  })

  it('propagates exact Scene-only changes and authoritative vision for a spatial re-pause', async () => {
    const commandId = '00000000-0000-4000-8000-000000000010'
    const sceneVisionContext = {
      characterVisions: [{ characterId: ids.characterA, dimRange: null }],
      encounterCharacterBindings: [
        {
          actorId: ids.characterA,
          characterId: ids.characterA,
          encounterId: ids.encounter,
          tokenId: ids.characterB
        }
      ]
    }
    const spatialSceneState = { campaignId: ids.campaign, id: ids.scene, version: 4 }
    mocks.findEncounter.mockResolvedValue({
      campaignId: ids.campaign,
      id: ids.encounter,
      sessionId: ids.session
    })
    mocks.executeEncounterCommand.mockResolvedValue({
      replayed: false,
      response: { projection: { version: 3 } },
      spatialChangedAggregates: [{ aggregateId: ids.scene, aggregateKind: 'SCENE', version: 4 }],
      spatialSceneState
    })
    mocks.listPendingEncounters.mockResolvedValue([
      {
        aggregateId: ids.encounter,
        id: ids.characterB,
        pendingSnapshot: {
          applicationContext: {
            kind: 'ENCOUNTER_SPATIAL_MOVEMENT',
            root: { sceneId: ids.scene }
          }
        }
      }
    ])

    const execution = await executeLiveSessionCommand(
      {} as DBLike,
      ids.playerA,
      { campaignId: ids.campaign, sessionId: ids.session },
      {
        aggregateKind: 'ENCOUNTER',
        command: {
          commandId,
          correlationId: null,
          encounterId: ids.encounter,
          expectedOccurrenceVersion: 1,
          expectedVersion: 3,
          occurrenceId: ids.characterB,
          resolution: { kind: 'SYSTEM_ROLL', requestId: 'spatial-request' },
          type: 'RESOLVE_RULE_OCCURRENCE'
        }
      },
      'room-authority',
      sceneVisionContext
    )

    expect(mocks.executeEncounterCommand).toHaveBeenCalledWith(
      expect.anything(),
      ids.playerA,
      expect.objectContaining({ commandId, type: 'RESOLVE_RULE_OCCURRENCE' }),
      expect.objectContaining({ sceneVisionContext })
    )
    expect(execution.changedAggregates).toEqual([
      { aggregateId: ids.scene, aggregateKind: 'SCENE', version: 4 }
    ])
    if (execution.aggregateKind !== 'ENCOUNTER') throw new Error('Expected Encounter execution.')
    expect(execution.occurrenceBindingUpdate).toEqual({
      binding: {
        encounterId: ids.encounter,
        executionKind: 'SPATIAL',
        occurrenceId: ids.characterB,
        sceneId: ids.scene
      },
      encounterId: ids.encounter
    })
    expect(execution.spatialRefresh).toEqual({
      characterRuleSnapshots: [],
      characterVisions: [],
      sceneState: spatialSceneState
    })
  })

  it('routes live hit-point adjustments through the compact receipt lane', async () => {
    const commandId = '00000000-0000-4000-8000-000000000008'
    const committedRuleSnapshot = ruleSnapshot(7)
    const refreshedRuleSnapshot = ruleSnapshot(8)
    mocks.executeCompactLiveHitPoints.mockResolvedValue({
      characterVision: { characterId: ids.characterA, dimRange: null },
      replayed: false,
      ruleSnapshot: refreshedRuleSnapshot,
      version: 8
    })

    const execution = await executeLiveSessionCommand(
      {} as DBLike,
      ids.playerA,
      { campaignId: ids.campaign, sessionId: ids.session },
      {
        aggregateKind: 'CHARACTER',
        characterId: ids.characterA,
        command: {
          amount: 3,
          commandId,
          expectedVersion: 7,
          mode: 'DAMAGE',
          type: 'ADJUST_HIT_POINTS'
        }
      },
      'room-authority',
      { characterVisions: [], encounterCharacterBindings: [] },
      committedRuleSnapshot as unknown as CharacterSheetCommittedRuleSnapshot
    )

    expect(mocks.executeCompactLiveHitPoints).toHaveBeenCalledWith({
      db: expect.anything(),
      characterId: ids.characterA,
      command: expect.objectContaining({ commandId, type: 'ADJUST_HIT_POINTS' }),
      committedRuleSnapshot,
      liveSessionAuthority: { authorityId: 'room-authority', sessionId: ids.session },
      userId: ids.playerA
    })
    expect(mocks.executeCharacterSheetCommand).not.toHaveBeenCalled()
    expect(execution).toMatchObject({
      aggregateKind: 'CHARACTER',
      aggregateId: ids.characterA,
      characterVision: { characterId: ids.characterA, dimRange: null },
      commandId,
      response: null,
      ruleSnapshot: refreshedRuleSnapshot,
      version: 8
    })
    expect(execution).not.toHaveProperty('ruleEvaluationLane')
  })

  it('routes a live maximum-hit-point modifier through the compact rule lane', async () => {
    const commandId = '00000000-0000-4000-8000-000000000009'
    mocks.executeCompactMaximumHitPointModifier.mockResolvedValue({
      characterVision: { characterId: ids.characterA, dimRange: null },
      replayed: false,
      version: 8
    })
    const execution = await executeLiveSessionCommand(
      {} as DBLike,
      ids.playerA,
      { campaignId: ids.campaign, sessionId: ids.session },
      {
        aggregateKind: 'CHARACTER',
        characterId: ids.characterA,
        command: {
          adjustment: { family: 'HIT_POINTS', field: 'MAXIMUM_MODIFIER', value: 3 },
          commandId,
          expectedVersion: 7,
          type: 'UPSERT_SHEET_ADJUSTMENT'
        }
      },
      'room-authority',
      { characterVisions: [], encounterCharacterBindings: [] },
      undefined
    )

    expect(mocks.executeCompactMaximumHitPointModifier).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: ids.characterA,
        command: expect.objectContaining({ commandId, type: 'UPSERT_SHEET_ADJUSTMENT' })
      })
    )
    expect(mocks.executeCharacterSheetCommand).not.toHaveBeenCalled()
    expect(mocks.resolveCampaignAuthority).not.toHaveBeenCalled()
    expect(mocks.listCampaignSessions).not.toHaveBeenCalled()
    expect(mocks.listSessionAttendance).not.toHaveBeenCalled()
    expect(execution).toMatchObject({
      response: null,
      ruleEvaluationLane: 'CHARACTER_POLICY',
      version: 8
    })

    mocks.executeCompactMaximumHitPointModifier.mockResolvedValue({
      characterVision: { characterId: ids.characterA, dimRange: null },
      replayed: true,
      version: 8
    })
    const replay = await executeLiveSessionCommand(
      {} as DBLike,
      ids.playerA,
      { campaignId: ids.campaign, sessionId: ids.session },
      {
        aggregateKind: 'CHARACTER',
        characterId: ids.characterA,
        command: {
          adjustment: { family: 'HIT_POINTS', field: 'MAXIMUM_MODIFIER', value: 3 },
          commandId,
          expectedVersion: 7,
          type: 'UPSERT_SHEET_ADJUSTMENT'
        }
      },
      'room-authority',
      { characterVisions: [], encounterCharacterBindings: [] }
    )

    expect(replay).not.toHaveProperty('ruleEvaluationLane')
  })

  it('falls back to the regular lane when the compact modifier lane declines a removal', async () => {
    mocks.executeCompactMaximumHitPointModifier.mockResolvedValue(null)
    mocks.executeCharacterSheetCommand.mockResolvedValue({
      replayed: false,
      response: { streamVersion: 8 },
      ruleSnapshot: { evaluation: { output: { senses: [] } } }
    })

    await executeLiveSessionCommand(
      {} as DBLike,
      ids.playerA,
      { campaignId: ids.campaign, sessionId: ids.session },
      {
        aggregateKind: 'CHARACTER',
        characterId: ids.characterA,
        command: {
          adjustmentId: '00000000-0000-4000-8000-000000000010',
          commandId: '00000000-0000-4000-8000-000000000011',
          expectedVersion: 7,
          family: 'HIT_POINTS',
          target: { kind: 'HIT_POINTS' },
          type: 'REMOVE_SHEET_ADJUSTMENT'
        }
      },
      'room-authority',
      { characterVisions: [], encounterCharacterBindings: [] }
    )

    expect(mocks.executeCharacterSheetCommand).toHaveBeenCalledOnce()
  })
})

describe('live-session adapter error parity', () => {
  it.each([
    ['CharacterSheetCommandError', 'INVALID_COMMAND'],
    ['EncounterValidationError', 'INVALID_COMMAND'],
    ['CampaignAccessError', 'UNAUTHORIZED'],
    ['CampaignNotFoundError', 'UNAUTHORIZED'],
    ['LiveSessionAuthorityError', 'UNAUTHORIZED'],
    ['ConcurrencyError', 'STALE_VERSION'],
    ['EncounterConflictError', 'STALE_VERSION'],
    ['LiveSessionCommandAuthorityError', 'STALE_VERSION'],
    ['UnexpectedError', 'COMMAND_FAILED']
  ] as const)('classifies %s identically for every transport adapter', (name, expected) => {
    const error = new Error('adapter failure')
    error.name = name
    expect(classifyLiveSessionCommandError(error)).toBe(expected)
  })
})
