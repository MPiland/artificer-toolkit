import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'

const ids = {
  source: '00000000-0000-4000-8000-000000000001',
  copy: '00000000-0000-4000-8000-000000000002',
  owner: '00000000-0000-4000-8000-000000000003',
  command: '00000000-0000-4000-8000-000000000004'
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
  events: { insertCampaignEvent: vi.fn() },
  receipts: { findCampaignEventByIdempotency: vi.fn() },
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
    createCampaignAdjustmentsRepository: () => mocks.events,
    createInventoryRepository: () => mocks.receipts,
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
    mocks.receipts.findCampaignEventByIdempotency.mockResolvedValue(null)
  })

  it('copies reusable Campaign preparation into a fresh aggregate only', async () => {
    await expect(
      copyCampaign({} as DBLike, ids.owner, {
        campaignId: ids.source,
        commandId: ids.command,
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
    expect(mocks.events.insertCampaignEvent).toHaveBeenCalledWith({
      campaignId: ids.source,
      actorUserId: ids.owner,
      kind: 'CAMPAIGN_COPIED',
      visibility: 'OWNER',
      payload: { copiedCampaignId: ids.copy, expectedVersion: 7 },
      idempotencyKey: ids.command
    })
    expect(mocks.lockTier.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.campaign.lockCampaign.mock.invocationCallOrder[0] ?? 0
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
        commandId: ids.command,
        expectedVersion: 7
      })
    ).rejects.toThrow()
    expect(mocks.lockTier).not.toHaveBeenCalled()
    expect(mocks.campaign.createCampaign).not.toHaveBeenCalled()
  })

  it('does not inspect or transfer source shares, Vehicles, or inventory outside the copy surface', async () => {
    await copyCampaign({} as DBLike, ids.owner, {
      campaignId: ids.source,
      commandId: ids.command,
      expectedVersion: 7
    })

    expect(mocks.campaign.createCampaign).toHaveBeenCalledOnce()
    expect(mocks.collaboration.copyCampaignNoteSections).toHaveBeenCalledOnce()
  })

  it('returns the exact prior copy for an idempotent command retry', async () => {
    mocks.receipts.findCampaignEventByIdempotency.mockResolvedValue({
      actorUserId: ids.owner,
      kind: 'CAMPAIGN_COPIED',
      payload: { copiedCampaignId: ids.copy, expectedVersion: 7 }
    })

    await expect(
      copyCampaign({} as DBLike, ids.owner, {
        campaignId: ids.source,
        commandId: ids.command,
        expectedVersion: 7
      })
    ).resolves.toEqual({ id: ids.copy })

    expect(mocks.resolveAuthority).not.toHaveBeenCalled()
    expect(mocks.lockTier).not.toHaveBeenCalled()
    expect(mocks.campaign.createCampaign).not.toHaveBeenCalled()
  })

  it('rejects reuse of a copy command ID with different input', async () => {
    mocks.receipts.findCampaignEventByIdempotency.mockResolvedValue({
      actorUserId: ids.owner,
      kind: 'CAMPAIGN_COPIED',
      payload: { copiedCampaignId: ids.copy, expectedVersion: 6 }
    })

    await expect(
      copyCampaign({} as DBLike, ids.owner, {
        campaignId: ids.source,
        commandId: ids.command,
        expectedVersion: 7
      })
    ).rejects.toThrow('Command ID was already used')
    expect(mocks.campaign.createCampaign).not.toHaveBeenCalled()
  })
})
