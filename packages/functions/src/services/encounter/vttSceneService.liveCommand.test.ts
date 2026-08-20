import { createHash } from 'node:crypto'

import type { DBLike } from '@artificer-toolkit/db'
import { describe, expect, it, vi } from 'vitest'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  command: '00000000-0000-4000-8000-000000000002',
  encounter: '00000000-0000-4000-8000-000000000003',
  scene: '00000000-0000-4000-8000-000000000004',
  session: '00000000-0000-4000-8000-000000000005',
  user: '00000000-0000-4000-8000-000000000006'
} as const

const mocks = vi.hoisted(() => ({
  appendEvent: vi.fn(),
  lockLiveCommandContext: vi.fn(),
  publishLiveCommand: vi.fn()
}))

vi.mock('@artificer-toolkit/db', () => ({
  createEncounterRepository: () => ({ find: vi.fn() }),
  createVttSceneRepository: () => ({
    appendEvent: mocks.appendEvent,
    lockLiveCommandContext: mocks.lockLiveCommandContext,
    publishLiveCommand: mocks.publishLiveCommand
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
    resolveCampaignAuthority: vi.fn()
  }
})

vi.mock('../campaign/liveSessionCommandAuthority.js', () => ({
  assertSessionLiveSessionCommandAuthority: vi.fn()
}))

const { executeEncounterSceneCommandWithState } = await import('./vttSceneService.js')

const input = {
  barrierId: ids.encounter,
  commandId: ids.command,
  encounterId: ids.encounter,
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

function commandFingerprint(): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

describe('live Scene command lane', () => {
  it('fails closed when the single locked context read does not authorize the command', async () => {
    mocks.lockLiveCommandContext.mockResolvedValueOnce(null)

    await expect(
      executeEncounterSceneCommandWithState({} as DBLike, ids.user, input, {
        liveSceneContext: liveContext
      })
    ).rejects.toMatchObject({ name: 'CampaignAccessError' })
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
          delta: { barrierId: ids.encounter, kind: 'DOOR_STATE_SET', state: 'OPEN' },
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

    const execution = await executeEncounterSceneCommandWithState(
      {} as DBLike,
      ids.user,
      input,
      { liveSceneContext: liveContext }
    )

    expect(execution.result).toMatchObject({ replayed: true, version: 1 })
    expect(mocks.appendEvent).not.toHaveBeenCalled()
    expect(mocks.publishLiveCommand).not.toHaveBeenCalled()
  })
})
