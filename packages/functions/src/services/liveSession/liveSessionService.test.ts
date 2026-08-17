import type { DBLike } from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
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
  findSceneByEncounter: vi.fn(),
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
      listForCampaign: mocks.listEncounters
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
  loadCharacterRuleSnapshotForLiveSessionCampaign: mocks.loadCharacterRuleSnapshot
}))

const { loadLiveSessionRoomSnapshot } = await import('./liveSessionService.js')

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
})
