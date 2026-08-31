import { createHash } from 'node:crypto'

import type { DBLike } from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  command: '00000000-0000-4000-8000-000000000002',
  scene: '00000000-0000-4000-8000-000000000003',
  session: '00000000-0000-4000-8000-000000000004',
  user: '00000000-0000-4000-8000-000000000005'
} as const

const state = vi.hoisted(() => ({
  appendError: null as Error | null,
  events: [] as { commandFingerprint: string; result: Record<string, unknown> }[],
  presentation: null as { sceneId: string | null; version: number } | null
}))

const mocks = vi.hoisted(() => ({
  appendReceipt: vi.fn(),
  findReceipt: vi.fn(),
  findPresentation: vi.fn(),
  findSessionCampaignId: vi.fn(),
  lockCampaign: vi.fn(),
  lockLiveScene: vi.fn(),
  lockSession: vi.fn(),
  listLiveScenes: vi.fn(),
  present: vi.fn()
}))

vi.mock('@artificer-toolkit/db', () => ({
  createCampaignRepository: () => ({ lockCampaign: mocks.lockCampaign }),
  createEncounterRepository: () => ({}),
  createReusableDefinitionRepository: () => ({}),
  createRuleOccurrenceRepository: () => ({}),
  createSpatialRuleEffectRepository: () => ({}),
  createSystemVocabularySnapshotRepository: () => ({}),
  createVttSceneRepository: () => ({
    appendSessionScenePresentationReceipt: mocks.appendReceipt,
    findSessionPresentation: mocks.findPresentation,
    findSessionCampaignId: mocks.findSessionCampaignId,
    findSessionScenePresentationReceipt: mocks.findReceipt,
    lockLiveScene: mocks.lockLiveScene,
    lockSession: mocks.lockSession,
    listLiveScenes: mocks.listLiveScenes,
    presentSessionScene: mocks.present
  }),
  checksumCanonicalJson: vi.fn(),
  withTransaction: async <T>(db: DBLike, callback: (trx: DBLike) => Promise<T>) => {
    const snapshot = {
      events: [...state.events],
      presentation: state.presentation ? { ...state.presentation } : null
    }
    try {
      return await callback(db)
    } catch (error) {
      state.events = snapshot.events
      state.presentation = snapshot.presentation
      throw error
    }
  }
}))

vi.mock('../campaign/campaignService.js', () => ({
  CampaignAccessError: class CampaignAccessError extends Error {},
  CampaignConflictError: class CampaignConflictError extends Error {},
  assertActiveCampaignMember: vi.fn(),
  assertCampaignOwner: vi.fn(),
  assertCampaignWritable: vi.fn(),
  resolveCampaignAuthority: vi.fn(async () => ({ membership: { role: 'OWNER' } }))
}))

vi.mock('../campaign/liveSessionCommandAuthority.js', () => ({
  assertSessionLiveSessionCommandAuthority: vi.fn()
}))

vi.mock('./encounterRuleExecutionCommandContext.js', () => ({
  lockEncounterRuleExecutionCommandContext: vi.fn()
}))

const { listCampaignLiveScenes, setCampaignLiveScenePresentation } =
  await import('./vttSceneService.js')

const input = {
  commandId: ids.command,
  expectedPresentationVersion: null,
  sceneId: ids.scene,
  sessionId: ids.session,
  type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION' as const
}

function commandFingerprint(value = input): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

describe('setCampaignLiveScenePresentation', () => {
  beforeEach(() => {
    state.appendError = null
    state.events = []
    state.presentation = null
    vi.clearAllMocks()
    mocks.lockCampaign.mockResolvedValue({ id: ids.campaign })
    mocks.findSessionCampaignId.mockResolvedValue(ids.campaign)
    mocks.lockSession.mockResolvedValue({ id: ids.session, status: 'OPEN' })
    mocks.lockLiveScene.mockResolvedValue({ state: { campaignId: ids.campaign } })
    mocks.findReceipt.mockImplementation(async () => {
      const receipt = state.events[0]
      return receipt ?? null
    })
    mocks.findPresentation.mockImplementation(async () => state.presentation)
    mocks.present.mockImplementation(
      async (command: { expectedVersion: number | null; sceneId: string | null }) => {
        if (command.expectedVersion === null) {
          if (state.presentation) return false
          state.presentation = { sceneId: command.sceneId, version: 0 }
          return true
        }
        if (!state.presentation || state.presentation.version !== command.expectedVersion)
          return false
        state.presentation = { sceneId: command.sceneId, version: state.presentation.version + 1 }
        return true
      }
    )
    mocks.appendReceipt.mockImplementation(
      async (event: {
        receipt: { commandFingerprint: string; result: Record<string, unknown> }
      }) => {
        if (state.appendError) throw state.appendError
        state.events.push(event.receipt)
      }
    )
  })

  it('sets the initial presentation and records its terminal receipt', async () => {
    await expect(setCampaignLiveScenePresentation({} as DBLike, ids.user, input)).resolves.toEqual({
      commandId: ids.command,
      replayed: false,
      sceneId: ids.scene,
      sessionId: ids.session,
      version: 0
    })
    expect(state.events).toHaveLength(1)
  })

  it('clears a presentation with the next exact version', async () => {
    state.presentation = { sceneId: ids.scene, version: 0 }
    await expect(
      setCampaignLiveScenePresentation({} as DBLike, ids.user, {
        ...input,
        expectedPresentationVersion: 0,
        sceneId: null
      })
    ).resolves.toMatchObject({ replayed: false, sceneId: null, version: 1 })
  })

  it('replays a matching command without another CAS or event', async () => {
    state.events = [
      {
        commandFingerprint: commandFingerprint(),
        result: {
          commandId: ids.command,
          replayed: false,
          sceneId: ids.scene,
          sessionId: ids.session,
          version: 0
        }
      }
    ]
    await expect(
      setCampaignLiveScenePresentation({} as DBLike, ids.user, input)
    ).resolves.toMatchObject({
      replayed: true
    })
    expect(mocks.present).not.toHaveBeenCalled()
    expect(mocks.appendReceipt).not.toHaveBeenCalled()
  })

  it('rejects a mismatched command replay', async () => {
    state.events = [
      {
        commandFingerprint: '1'.repeat(64),
        result: {
          commandId: ids.command,
          replayed: false,
          sceneId: ids.scene,
          sessionId: ids.session,
          version: 0
        }
      }
    ]
    await expect(setCampaignLiveScenePresentation({} as DBLike, ids.user, input)).rejects.toThrow(
      'Command ID was already used with different input.'
    )
  })

  it('rejects stale presentation versions', async () => {
    state.presentation = { sceneId: ids.scene, version: 3 }
    await expect(
      setCampaignLiveScenePresentation({} as DBLike, ids.user, {
        ...input,
        expectedPresentationVersion: 2
      })
    ).rejects.toThrow('Session Scene presentation version is stale.')
  })

  it('rejects a cross-Campaign Scene and a closed Session before CAS', async () => {
    mocks.lockLiveScene.mockResolvedValueOnce({
      state: { campaignId: '00000000-0000-4000-8000-000000000099' }
    })
    await expect(setCampaignLiveScenePresentation({} as DBLike, ids.user, input)).rejects.toThrow(
      'Campaign live Scene was not found.'
    )
    mocks.lockSession.mockResolvedValueOnce({ id: ids.session, status: 'FINISHED' })
    await expect(setCampaignLiveScenePresentation({} as DBLike, ids.user, input)).rejects.toThrow(
      'Finished Sessions cannot present Scenes.'
    )
    expect(mocks.present).not.toHaveBeenCalled()
  })

  it('rolls back the presentation when its receipt append fails', async () => {
    state.appendError = new Error('event write failed')
    await expect(setCampaignLiveScenePresentation({} as DBLike, ids.user, input)).rejects.toThrow(
      'event write failed'
    )
    expect(state.presentation).toBeNull()
    expect(state.events).toEqual([])
  })
})

describe('listCampaignLiveScenes', () => {
  it('returns compact owner-selectable live Scene identities', async () => {
    mocks.listLiveScenes.mockResolvedValueOnce([
      {
        state: {
          definitionId: '00000000-0000-4000-8000-000000000006',
          id: ids.scene,
          name: 'Town square',
          version: 7
        }
      }
    ])

    await expect(listCampaignLiveScenes({} as DBLike, ids.user, ids.campaign)).resolves.toEqual([
      {
        definitionId: '00000000-0000-4000-8000-000000000006',
        id: ids.scene,
        name: 'Town square',
        version: 7
      }
    ])
  })
})
