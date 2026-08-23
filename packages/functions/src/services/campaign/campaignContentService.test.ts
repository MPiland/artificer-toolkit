import type { DBLike } from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  user: '00000000-0000-4000-8000-000000000002',
  spell: '00000000-0000-4000-8000-000000000003',
  system: '00000000-0000-4000-8000-000000000004',
  version: '00000000-0000-4000-8000-000000000005'
}

const mocks = vi.hoisted(() => ({
  shares: {
    lockCampaignMemberForContentRead: vi.fn(),
    listCurrentSources: vi.fn(),
    lockOwnedCurrentRoot: vi.fn(),
    shareRoot: vi.fn()
  },
  authoredVersions: { findActive: vi.fn() },
  campaign: { lockCampaign: vi.fn() },
  findRemovalReceipt: vi.fn(),
  removeShares: vi.fn(),
  authority: vi.fn(),
  capabilities: vi.fn(),
  broadcast: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createCampaignContentShareRepository: () => mocks.shares,
  createAuthoredVersionRepository: () => mocks.authoredVersions,
  createCampaignRepository: () => mocks.campaign,
  withTransaction: async (_db: DBLike, fn: (trx: DBLike) => Promise<unknown>) => fn({} as DBLike)
}))
vi.mock('./campaignService.js', () => ({
  CampaignAccessError: class CampaignAccessError extends Error {},
  CampaignNotFoundError: class CampaignNotFoundError extends Error {},
  CampaignValidationError: class CampaignValidationError extends Error {},
  assertActiveCampaignMember: vi.fn(),
  assertCampaignWritable: vi.fn(),
  getCampaignCapabilities: mocks.capabilities,
  resolveCampaignAuthority: mocks.authority
}))
vi.mock('./realtimeService.js', () => ({ broadcastCampaignInvalidation: mocks.broadcast }))
vi.mock('./campaignContentShareRemoval.js', () => ({
  findCampaignContentRemovalReceipt: mocks.findRemovalReceipt,
  removeCampaignContentSharesAndReconcileInTransaction: mocks.removeShares
}))

const { listCampaignContentShares, shareCampaignContent, unshareCampaignContent } =
  await import('./campaignContentService.js')

const share = {
  campaignId: ids.campaign,
  subjectKind: 'SPELL' as const,
  subjectId: ids.spell,
  sharedBy: ids.user,
  createdAt: '2026-08-22T00:00:00.000Z',
  updatedAt: '2026-08-22T00:00:00.000Z'
}
const source = {
  authored: {
    subjectKind: 'SPELL' as const,
    subjectId: ids.spell,
    versionId: ids.version,
    version: 1,
    checksum: 'a'.repeat(64),
    document: { id: ids.spell, userId: ids.user, systemId: ids.system, label: 'Shared Spell' }
  },
  compiled: { projectionChecksum: 'b'.repeat(64), authoredDependencies: [] }
}

describe('Campaign content shares', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.campaign.lockCampaign.mockResolvedValue({ id: ids.campaign })
    mocks.shares.lockCampaignMemberForContentRead.mockResolvedValue({
      campaignExists: true,
      memberActive: true
    })
    mocks.authority.mockResolvedValue({
      campaign: { id: ids.campaign, status: 'ACTIVE', contentMaturity: 'STANDARD' },
      membership: { userId: ids.user, role: 'PLAYER', status: 'ACTIVE' }
    })
    mocks.capabilities.mockReturnValue({ shareOwnedContent: true, manageSharedContent: false })
    mocks.shares.lockOwnedCurrentRoot.mockResolvedValue({
      subjectKind: 'SPELL',
      subjectId: ids.spell,
      sharedBy: ids.user,
      versionId: ids.version,
      version: 1,
      checksum: 'a'.repeat(64)
    })
    mocks.authoredVersions.findActive.mockResolvedValue(source)
    mocks.shares.shareRoot.mockResolvedValue(share)
    mocks.shares.listCurrentSources.mockResolvedValue([{ share, source }])
    mocks.findRemovalReceipt.mockResolvedValue(null)
    mocks.removeShares.mockResolvedValue({
      eventId: '00000000-0000-4000-8000-000000000006',
      campaignVersion: 2,
      removedShares: [{ subjectKind: 'SPELL', subjectId: ids.spell, sharedBy: ids.user }],
      affectedCharacters: [],
      evacuatedVehicles: []
    })
  })

  it('shares owned active content immediately without review state', async () => {
    const result = await shareCampaignContent({} as DBLike, ids.user, {
      campaignId: ids.campaign,
      subjectKind: 'SPELL',
      subjectId: ids.spell
    })

    expect(mocks.shares.lockOwnedCurrentRoot).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: ids.spell,
      ownerUserId: ids.user
    })
    expect(mocks.shares.shareRoot).toHaveBeenCalledWith({
      campaignId: ids.campaign,
      subjectKind: 'SPELL',
      subjectId: ids.spell,
      sharedBy: ids.user
    })
    expect(result).not.toHaveProperty('status')
    expect(result).not.toHaveProperty('approvedBy')
    expect(mocks.broadcast).toHaveBeenCalledOnce()
  })

  it('fails closed for a Master, inactive, or differently owned root', async () => {
    mocks.shares.lockOwnedCurrentRoot.mockResolvedValue(null)

    await expect(
      shareCampaignContent({} as DBLike, ids.user, {
        campaignId: ids.campaign,
        subjectKind: 'SPELL',
        subjectId: ids.spell
      })
    ).rejects.toThrow('Only active homebrew you own can be shared.')
    expect(mocks.shares.shareRoot).not.toHaveBeenCalled()
  })

  it('does not substitute a Campaign role for the explicit share capability', async () => {
    mocks.capabilities.mockReturnValue({ shareOwnedContent: false, manageSharedContent: true })

    await expect(
      shareCampaignContent({} as DBLike, ids.user, {
        campaignId: ids.campaign,
        subjectKind: 'SPELL',
        subjectId: ids.spell
      })
    ).rejects.toThrow('You cannot share content with this Campaign.')
    expect(mocks.shares.lockOwnedCurrentRoot).not.toHaveBeenCalled()
  })

  it('fails closed when the loaded document disagrees with the locked root identity', async () => {
    mocks.authoredVersions.findActive.mockResolvedValue({
      ...source,
      authored: { ...source.authored, checksum: 'c'.repeat(64) }
    })

    await expect(
      shareCampaignContent({} as DBLike, ids.user, {
        campaignId: ids.campaign,
        subjectKind: 'SPELL',
        subjectId: ids.spell
      })
    ).rejects.toThrow('Owned homebrew current identity is unavailable.')
    expect(mocks.shares.shareRoot).not.toHaveBeenCalled()
  })

  it('lists only the repository current-share result for an active member', async () => {
    const result = await listCampaignContentShares({} as DBLike, ids.user, ids.campaign)

    expect(mocks.shares.lockCampaignMemberForContentRead).toHaveBeenCalledWith({
      campaignId: ids.campaign,
      userId: ids.user
    })
    expect(mocks.shares.lockCampaignMemberForContentRead.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.authority.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    )
    expect(mocks.authority.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.shares.listCurrentSources.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    )
    expect(mocks.shares.listCurrentSources).toHaveBeenCalledWith(ids.campaign)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      subjectKind: 'SPELL',
      subjectId: ids.spell,
      sharedBy: ids.user
    })
  })

  it('denies an inactive or missing member before resolving or loading content', async () => {
    mocks.shares.lockCampaignMemberForContentRead.mockResolvedValue({
      campaignExists: true,
      memberActive: false
    })

    await expect(listCampaignContentShares({} as DBLike, ids.user, ids.campaign)).rejects.toThrow()
    expect(mocks.authority).not.toHaveBeenCalled()
    expect(mocks.shares.listCurrentSources).not.toHaveBeenCalled()
  })

  it('returns no documents when current-source loading fails inside the transaction', async () => {
    mocks.shares.listCurrentSources.mockRejectedValue(new Error('Current source unavailable.'))

    await expect(listCampaignContentShares({} as DBLike, ids.user, ids.campaign)).rejects.toThrow(
      'Current source unavailable.'
    )
  })

  it('denies a cross-Campaign reader before loading any shares', async () => {
    mocks.authority.mockRejectedValue(new Error('Campaign access denied.'))

    await expect(listCampaignContentShares({} as DBLike, ids.user, ids.campaign)).rejects.toThrow(
      'Campaign access denied.'
    )
    expect(mocks.shares.listCurrentSources).not.toHaveBeenCalled()
  })

  it('removes one exact share through the atomic reconciliation primitive', async () => {
    const result = await unshareCampaignContent({} as DBLike, ids.user, {
      campaignId: ids.campaign,
      subjectKind: 'SPELL',
      subjectId: ids.spell,
      sharedBy: ids.user,
      expectedCampaignVersion: 1,
      commandId: '00000000-0000-4000-8000-000000000006'
    })

    expect(mocks.campaign.lockCampaign).toHaveBeenCalledWith(ids.campaign)
    expect(mocks.removeShares).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        operation: 'UNSHARE',
        expectedCampaignVersion: 1,
        shares: [{ subjectKind: 'SPELL', subjectId: ids.spell, sharedBy: ids.user }]
      })
    )
    expect(result.campaignVersion).toBe(2)
    expect(mocks.broadcast).not.toHaveBeenCalled()
  })

  it('returns an exact idempotent receipt before re-authorizing a retry', async () => {
    const receipt = {
      eventId: '00000000-0000-4000-8000-000000000006',
      campaignVersion: 2,
      removedShares: [],
      affectedCharacters: [],
      evacuatedVehicles: []
    }
    mocks.findRemovalReceipt.mockResolvedValue(receipt)

    await expect(
      unshareCampaignContent({} as DBLike, ids.user, {
        campaignId: ids.campaign,
        subjectKind: 'SPELL',
        subjectId: ids.spell,
        sharedBy: ids.user,
        expectedCampaignVersion: 1,
        commandId: receipt.eventId
      })
    ).resolves.toEqual(receipt)
    expect(mocks.authority).not.toHaveBeenCalled()
    expect(mocks.removeShares).not.toHaveBeenCalled()
  })
})
