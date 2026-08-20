import type { DBLike } from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  encounter: '00000000-0000-4000-8000-000000000002',
  session: '00000000-0000-4000-8000-000000000003',
  playerA: '00000000-0000-4000-8000-000000000004',
  characterA: '00000000-0000-4000-8000-000000000005',
  characterB: '00000000-0000-4000-8000-000000000006'
} as const

const mocks = vi.hoisted(() => ({
  resolveCampaignAuthority: vi.fn(),
  listCampaignSessions: vi.fn(),
  listSessionAttendance: vi.fn(),
  findCharacter: vi.fn(),
  listEncounters: vi.fn(),
  requireCurrentProjection: vi.fn(),
  findSceneByEncounter: vi.fn(),
  executeSceneCommand: vi.fn(),
  executeCompactLiveHitPoints: vi.fn(),
  executeCharacterSheetCommand: vi.fn(),
  loadCharacterSceneVision: vi.fn(),
  loadCharacterRuleSnapshot: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createCampaignCollaborationRepository: () => ({
      listCampaignSessions: mocks.listCampaignSessions,
      listSessionAttendance: mocks.listSessionAttendance
    }),
    createCharacterRepository: () => ({ findById: mocks.findCharacter }),
    createEncounterRepository: () => ({
      listVersionMetadataForSession: mocks.listEncounters,
      requireCurrentProjection: mocks.requireCurrentProjection
    }),
    createVttSceneRepository: () => ({
      findByEncounter: mocks.findSceneByEncounter
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

vi.mock('../character/sheetService.js', () => ({
  executeCompactLiveCharacterHitPointCommand: mocks.executeCompactLiveHitPoints,
  executeCharacterSheetCommandWithRuleEvaluation: mocks.executeCharacterSheetCommand
}))

vi.mock('../encounter/vttSceneService.js', () => ({
  attachEncounterScene: vi.fn(),
  executeEncounterSceneCommandWithState: mocks.executeSceneCommand
}))

const { executeLiveSessionCommand, loadLiveSessionCoordinatorSnapshot, loadLiveSessionRoomSnapshot } =
  await import('./liveSessionService.js')

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
    mocks.executeCharacterSheetCommand.mockReset()
    mocks.resolveCampaignAuthority.mockResolvedValue({
      campaign: {
        id: ids.campaign,
        attunementSlotOverride: 4,
        status: 'ACTIVE'
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
    mocks.loadCharacterRuleSnapshot.mockImplementation(async (_db, characterId: string) =>
      ruleSnapshot(characterId === ids.characterA ? 7 : 11)
    )
    mocks.loadCharacterSceneVision.mockImplementation(async (_db, characterId: string) => ({
      streamVersion: characterId === ids.characterA ? 7 : 11,
      dimRangeFeet: null
    }))
  })

  it('hydrates the transport coordinator without assembling full Character Sheet snapshots', async () => {
    const snapshot = await loadLiveSessionCoordinatorSnapshot({} as DBLike, ids.playerA, {
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
    const snapshot = await loadLiveSessionRoomSnapshot({} as DBLike, ids.playerA, {
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
      { id: ids.campaign, attunementSlotOverride: 4 }
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

    const snapshot = await loadLiveSessionRoomSnapshot({} as DBLike, ids.playerA, {
      campaignId: ids.campaign,
      sessionId: ids.session
    })

    expect(mocks.requireCurrentProjection).toHaveBeenCalledWith({
      encounterId: ids.encounter,
      expectedStreamVersion: 3
    })
    expect(snapshot.encounterCharacterBindings).toEqual([
      { actorId: ids.encounter, characterId: ids.characterA, encounterId: ids.encounter }
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
      loadLiveSessionRoomSnapshot({} as DBLike, ids.playerA, {
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
      loadLiveSessionRoomSnapshot({} as DBLike, ids.playerA, {
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
          encounterId: ids.encounter,
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
        sceneVisionContext: { characterVisions: [], encounterCharacterBindings: [] }
      }
    )
  })

  it('routes live hit-point adjustments through the compact receipt lane', async () => {
    const commandId = '00000000-0000-4000-8000-000000000008'
    mocks.executeCompactLiveHitPoints.mockResolvedValue({
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
          amount: 3,
          commandId,
          expectedVersion: 7,
          mode: 'DAMAGE',
          type: 'ADJUST_HIT_POINTS'
        }
      },
      'room-authority',
      { characterVisions: [], encounterCharacterBindings: [] }
    )

    expect(mocks.executeCompactLiveHitPoints).toHaveBeenCalledWith({
      db: expect.anything(),
      characterId: ids.characterA,
      command: expect.objectContaining({ commandId, type: 'ADJUST_HIT_POINTS' }),
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
      version: 8
    })
  })
})
