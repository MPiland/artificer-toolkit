import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'

const ids = {
  source: '00000000-0000-4000-8000-000000000001',
  copy: '00000000-0000-4000-8000-000000000002',
  owner: '00000000-0000-4000-8000-000000000003'
}

const source = {
  id: ids.source,
  ownerUserId: ids.owner,
  name: 'Reusable one-shot',
  description: '<p>Prepared premise</p>',
  format: 'ONE_SHOT' as const,
  toneTags: ['DARK', 'HORROR'] as const,
  toneDetails: 'Bleak but hopeful',
  contentMaturity: 'MATURE' as const,
  attunementSlotOverride: 4,
  status: 'ACTIVE' as const,
  version: 7,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z'
}

const mocks = vi.hoisted(() => ({
  campaign: {
    lockCampaign: vi.fn(),
    countActiveOwned: vi.fn(),
    createCampaign: vi.fn(),
    insertOwnerMembership: vi.fn()
  },
  collaboration: { copyCampaignNoteSections: vi.fn() },
  content: { copyApprovedContentVersions: vi.fn() },
  lockTier: vi.fn(),
  resolveAuthority: vi.fn(),
  getCampaign: vi.fn(),
  transaction: { isTransaction: true }
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createCampaignRepository: () => mocks.campaign,
    createCampaignCollaborationRepository: () => mocks.collaboration,
    createCampaignContentRepository: () => mocks.content,
    createAccountEntitlementsRepository: () => ({ lockTier: mocks.lockTier }),
    withTransaction: (_db: DBLike, callback: (trx: DBLike) => Promise<unknown>) =>
      callback(mocks.transaction as DBLike)
  }
})

vi.mock('./campaignService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./campaignService.js')>()
  return {
    ...actual,
    resolveCampaignAuthority: mocks.resolveAuthority,
    getCampaign: mocks.getCampaign
  }
})

const { copyCampaign } = await import('./campaignCopyService.js')

describe('copyCampaign', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.campaign.lockCampaign.mockResolvedValue(source)
    mocks.campaign.countActiveOwned.mockResolvedValue(0)
    mocks.campaign.createCampaign.mockResolvedValue({ id: ids.copy })
    mocks.lockTier.mockResolvedValue('FREE')
    mocks.resolveAuthority.mockResolvedValue({
      campaign: source,
      membership: { role: 'OWNER', status: 'ACTIVE' },
      assignedCharacter: null
    })
    mocks.getCampaign.mockResolvedValue({ id: ids.copy })
  })

  it('copies reusable Campaign preparation into a fresh aggregate only', async () => {
    await expect(
      copyCampaign({} as DBLike, ids.owner, {
        campaignId: ids.source,
        expectedVersion: 7
      })
    ).resolves.toEqual({ id: ids.copy })

    expect(mocks.campaign.createCampaign).toHaveBeenCalledWith(ids.owner, {
      name: source.name,
      description: source.description,
      format: source.format,
      tone_tags: source.toneTags,
      tone_details: source.toneDetails,
      content_maturity: source.contentMaturity,
      attunement_slot_override: source.attunementSlotOverride
    })
    expect(mocks.campaign.insertOwnerMembership).toHaveBeenCalledWith(ids.copy, ids.owner)
    expect(mocks.collaboration.copyCampaignNoteSections).toHaveBeenCalledWith(
      ids.source,
      ids.copy,
      ids.owner
    )
    expect(mocks.content.copyApprovedContentVersions).toHaveBeenCalledWith(
      ids.source,
      ids.copy,
      ids.owner
    )
  })

  it('rejects a non-owner before allocating entitlement usage', async () => {
    mocks.resolveAuthority.mockResolvedValue({
      campaign: source,
      membership: { role: 'PLAYER', status: 'ACTIVE' },
      assignedCharacter: null
    })

    await expect(
      copyCampaign({} as DBLike, '00000000-0000-4000-8000-000000000099', {
        campaignId: ids.source,
        expectedVersion: 7
      })
    ).rejects.toThrow()
    expect(mocks.lockTier).not.toHaveBeenCalled()
    expect(mocks.campaign.createCampaign).not.toHaveBeenCalled()
  })
})
