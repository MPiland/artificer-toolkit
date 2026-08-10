import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'

const campaignId = '00000000-0000-4000-8000-000000000001'
const ownerId = '00000000-0000-4000-8000-000000000002'
const playerId = '00000000-0000-4000-8000-000000000003'
const otherPlayerId = '00000000-0000-4000-8000-000000000007'
const subjectId = '00000000-0000-4000-8000-000000000004'
const systemId = '00000000-0000-4000-8000-000000000005'

const mocks = vi.hoisted(() => ({
  content: {
    findActiveRootOwner: vi.fn(),
    findOwnedDraftPayload: vi.fn(),
    lockNextRevision: vi.fn(),
    insertContentVersion: vi.fn(),
    lockRootBindings: vi.fn(),
    replaceLockedRootBindings: vi.fn(),
    listContentVersions: vi.fn(),
    findContentVersion: vi.fn(),
    approvePendingContentVersion: vi.fn(),
    rejectPendingContentVersion: vi.fn()
  },
  campaignLock: vi.fn(),
  characterLock: vi.fn(),
  findCharacter: vi.fn(),
  authority: vi.fn(),
  reconcile: vi.fn(),
  resolveBuilder: vi.fn(),
  loadContext: vi.fn(),
  broadcast: vi.fn(),
  steps: [] as string[]
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createCampaignContentRepository: () => mocks.content,
    createCampaignRepository: () => ({ lockCampaign: mocks.campaignLock }),
    createCharacterRepository: () => ({
      findUpdatedAtByIdForUpdate: mocks.characterLock,
      findAuthoredById: mocks.findCharacter
    }),
    withTransaction: async (_db: DBLike, callback: (trx: DBLike) => Promise<unknown>) => {
      const result = await callback({} as DBLike)
      mocks.steps.push('commit')
      return result
    }
  }
})

vi.mock('./campaignService.js', () => ({
  CampaignConflictError: class CampaignConflictError extends Error {},
  CampaignNotFoundError: class CampaignNotFoundError extends Error {},
  CampaignValidationError: class CampaignValidationError extends Error {},
  assertActiveCampaignMember: vi.fn(),
  assertCampaignOwner: vi.fn(),
  assertCampaignWritable: vi.fn(),
  resolveCampaignAuthority: mocks.authority
}))

vi.mock('../character/builderService.js', () => ({
  loadCharacterBuilderContext: mocks.loadContext,
  resolveCharacterBuilder: mocks.resolveBuilder
}))
vi.mock('../character/builderReconciliation.js', () => ({
  reconcileCharacterBuilderCharacter: mocks.reconcile
}))
vi.mock('./realtimeService.js', () => ({
  broadcastCampaignInvalidation: async (...args: unknown[]) => {
    mocks.steps.push('broadcast')
    return mocks.broadcast(...args)
  }
}))

const { listCampaignContentVersions, reviewCampaignContentVersion, submitCampaignContentVersion } =
  await import('./campaignContentService.js')

function snapshot(userId: string) {
  return {
    kind: 'BACKGROUND' as const,
    id: subjectId,
    label: 'Campaign Background',
    userId,
    systemId
  }
}

function version(state: 'PENDING' | 'APPROVED' | 'REJECTED', authoredBy = playerId) {
  return {
    id: '00000000-0000-4000-8000-000000000006',
    campaignId,
    subjectKind: 'BACKGROUND' as const,
    subjectId,
    authoredBy,
    revision: 1,
    state,
    snapshot: snapshot(authoredBy),
    approvedBy: state === 'APPROVED' ? ownerId : null,
    approvedAt: state === 'APPROVED' ? '2026-08-06T12:00:00.000Z' : null,
    rejectedAt: state === 'REJECTED' ? '2026-08-06T12:00:00.000Z' : null,
    createdAt: '2026-08-06T12:00:00.000Z',
    updatedAt: '2026-08-06T12:00:00.000Z'
  }
}

function authority(userId: string, role: 'OWNER' | 'PLAYER') {
  return {
    campaign: { id: campaignId, status: 'ACTIVE' },
    membership: { userId, role, status: 'ACTIVE' },
    assignedCharacter: null
  }
}

describe('Campaign content service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.steps.length = 0
    mocks.campaignLock.mockResolvedValue({ id: campaignId })
    mocks.content.findActiveRootOwner.mockResolvedValue({
      subjectId,
      subjectKind: 'BACKGROUND',
      ownerUserId: playerId,
      systemId,
      isMaster: false
    })
    mocks.content.findOwnedDraftPayload.mockResolvedValue(null)
    mocks.content.lockNextRevision.mockResolvedValue(1)
    mocks.content.lockRootBindings.mockResolvedValue([])
    mocks.content.insertContentVersion.mockImplementation(async (input: { state: string }) =>
      version(input.state as 'PENDING' | 'APPROVED')
    )
    mocks.broadcast.mockResolvedValue(true)
  })

  it('stores a player submission as pending and broadcasts only after commit', async () => {
    mocks.authority.mockResolvedValue(authority(playerId, 'PLAYER'))

    await submitCampaignContentVersion({} as DBLike, playerId, {
      campaignId,
      subjectKind: 'BACKGROUND',
      subjectId,
      version: 1,
      snapshot: snapshot(playerId)
    })

    expect(mocks.content.insertContentVersion).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'PENDING', authoredBy: playerId })
    )
    expect(mocks.steps).toEqual(['commit', 'broadcast'])
    expect(mocks.broadcast).toHaveBeenCalledWith(
      expect.anything(),
      campaignId,
      expect.objectContaining({ scope: 'OWNER' })
    )
  })

  it('broadcasts an owner auto-approved submission to the table', async () => {
    mocks.authority.mockResolvedValue(authority(ownerId, 'OWNER'))
    mocks.content.findActiveRootOwner.mockResolvedValue({
      subjectId,
      subjectKind: 'BACKGROUND',
      ownerUserId: ownerId,
      systemId,
      isMaster: false
    })

    await submitCampaignContentVersion({} as DBLike, ownerId, {
      campaignId,
      subjectKind: 'BACKGROUND',
      subjectId,
      version: 1,
      snapshot: snapshot(ownerId)
    })

    expect(mocks.broadcast).toHaveBeenCalledWith(
      expect.anything(),
      campaignId,
      expect.objectContaining({ scope: 'TABLE' })
    )
  })

  it('shows players approved content and their own pending or rejected submissions only', async () => {
    mocks.authority.mockResolvedValue(authority(otherPlayerId, 'PLAYER'))
    mocks.content.listContentVersions.mockResolvedValue([
      version('APPROVED', playerId),
      version('PENDING', playerId),
      version('REJECTED', playerId),
      version('PENDING', otherPlayerId)
    ])

    await expect(
      listCampaignContentVersions({} as DBLike, otherPlayerId, campaignId)
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'APPROVED' }),
        expect.objectContaining({ status: 'PENDING' })
      ])
    )
    await expect(
      listCampaignContentVersions({} as DBLike, otherPlayerId, campaignId)
    ).resolves.toHaveLength(2)
  })

  it('shows owners every content version', async () => {
    mocks.authority.mockResolvedValue(authority(ownerId, 'OWNER'))
    mocks.content.listContentVersions.mockResolvedValue([
      version('APPROVED', playerId),
      version('PENDING', playerId),
      version('REJECTED', playerId)
    ])

    await expect(
      listCampaignContentVersions({} as DBLike, ownerId, campaignId)
    ).resolves.toHaveLength(3)
  })

  it('rejects snapshot metadata that does not match the owned root', async () => {
    mocks.authority.mockResolvedValue(authority(playerId, 'PLAYER'))

    await expect(
      submitCampaignContentVersion({} as DBLike, playerId, {
        campaignId,
        subjectKind: 'BACKGROUND',
        subjectId,
        version: 1,
        snapshot: snapshot(ownerId)
      })
    ).rejects.toThrow('metadata')
    expect(mocks.content.insertContentVersion).not.toHaveBeenCalled()
  })

  it('requires an active owned root so its creator retains it after Campaign departure', async () => {
    mocks.authority.mockResolvedValue(authority(playerId, 'PLAYER'))
    mocks.content.findActiveRootOwner.mockResolvedValue(null)
    mocks.content.findOwnedDraftPayload.mockResolvedValue({ systemId })

    await expect(
      submitCampaignContentVersion({} as DBLike, playerId, {
        campaignId,
        subjectKind: 'BACKGROUND',
        subjectId,
        version: 1,
        snapshot: snapshot(playerId)
      })
    ).rejects.toThrow('owned homebrew')
    expect(mocks.content.insertContentVersion).not.toHaveBeenCalled()
  })

  it('validates every affected Character before replacing approval bindings', async () => {
    const pending = version('PENDING')
    const approved = version('APPROVED')
    const character = {
      id: '00000000-0000-4000-8000-000000000007',
      label: 'Rook',
      userId: playerId,
      systemId,
      intent: {},
      state: {}
    }
    mocks.authority.mockResolvedValue(authority(ownerId, 'OWNER'))
    mocks.content.findContentVersion.mockResolvedValue(pending)
    mocks.content.approvePendingContentVersion.mockResolvedValue(approved)
    mocks.content.lockRootBindings.mockResolvedValue([
      { characterId: character.id },
      { characterId: '00000000-0000-4000-8000-000000000008' }
    ])
    mocks.findCharacter.mockResolvedValue(character)
    mocks.loadContext.mockResolvedValue({})
    mocks.reconcile.mockImplementation(async (_db: DBLike, value: unknown) => value)
    mocks.resolveBuilder
      .mockResolvedValueOnce({ readiness: { ready: true } })
      .mockResolvedValueOnce({ readiness: { ready: false } })

    await expect(
      reviewCampaignContentVersion({} as DBLike, ownerId, {
        campaignId,
        contentVersionId: pending.id,
        decision: 'APPROVE'
      })
    ).rejects.toThrow('conflicts')

    expect(mocks.characterLock).toHaveBeenCalledTimes(2)
    expect(mocks.content.replaceLockedRootBindings).not.toHaveBeenCalled()
    expect(mocks.broadcast).not.toHaveBeenCalled()
  })

  it('broadcasts approved reviews to the table and rejected reviews to owners and the author', async () => {
    const pending = version('PENDING')
    mocks.authority.mockResolvedValue(authority(ownerId, 'OWNER'))
    mocks.content.findContentVersion.mockResolvedValue(pending)
    mocks.content.approvePendingContentVersion.mockResolvedValue(version('APPROVED'))

    await reviewCampaignContentVersion({} as DBLike, ownerId, {
      campaignId,
      contentVersionId: pending.id,
      decision: 'APPROVE'
    })

    expect(mocks.broadcast).toHaveBeenLastCalledWith(
      expect.anything(),
      campaignId,
      expect.objectContaining({ scope: 'TABLE' })
    )

    mocks.content.rejectPendingContentVersion.mockResolvedValue(version('REJECTED'))
    await reviewCampaignContentVersion({} as DBLike, ownerId, {
      campaignId,
      contentVersionId: pending.id,
      decision: 'REJECT'
    })

    expect(mocks.broadcast.mock.calls.slice(-2)).toEqual([
      [expect.anything(), campaignId, expect.objectContaining({ scope: 'OWNER' })],
      [
        expect.anything(),
        campaignId,
        expect.objectContaining({ scope: 'USER', recipientUserId: playerId })
      ]
    ])
  })
})
