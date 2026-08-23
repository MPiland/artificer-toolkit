import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike, SocialListingRecord } from '@artificer-toolkit/db'
import type {
  CreateSocialListingInput,
  UpdateSocialListingInput
} from '@artificer-toolkit/schema/api/socialHub'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  listing: '00000000-0000-4000-8000-000000000002',
  owner: '00000000-0000-4000-8000-000000000003',
  profile: '00000000-0000-4000-8000-000000000004',
  system: '00000000-0000-4000-8000-000000000005'
}

const campaign = {
  id: ids.campaign,
  ownerUserId: ids.owner,
  name: 'Lock-order table',
  description: null,
  format: 'ONGOING' as const,
  toneTags: [] as const,
  toneDetails: null,
  contentMaturity: 'STANDARD' as const,
  attunementSlotOverride: null,
  status: 'ACTIVE' as const,
  version: 1,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z'
}

const inputFields = {
  summary: 'A focused lock-order fixture.',
  audience: 'PRIVATE' as const,
  systemId: ids.system,
  playMode: 'ONLINE' as const,
  capacity: 4,
  schedule: {
    kind: 'FLEXIBLE' as const,
    timeZone: 'America/Chicago',
    summary: 'Schedule together.'
  },
  location: null,
  expectations: {
    contentGuidance: 'Standard fantasy adventure.',
    attendancePolicy: 'Notify the table before missing a session.',
    allowedContentRules: 'Published rules and approved homebrew.',
    tableConduct: 'Be considerate and share spotlight.',
    contentBoundaries: 'Respect stated boundaries.',
    safetyPractices: ['SESSION_ZERO'] as Array<'SESSION_ZERO'>,
    safetyDetails: 'Review boundaries during session zero.'
  }
}

const listing: SocialListingRecord = {
  id: ids.listing,
  campaignId: ids.campaign,
  campaignOwnerUserId: ids.owner,
  campaignStatus: 'ACTIVE',
  hostProfileId: ids.profile,
  hostUsername: 'lock_owner',
  status: 'DRAFT',
  audience: inputFields.audience,
  moderationStatus: 'VISIBLE',
  systemId: ids.system,
  systemLabel: 'D&D 5e',
  rulesetCode: 'dnd5e',
  rulesetVersion: '2014',
  title: campaign.name,
  summary: inputFields.summary,
  campaignFormat: campaign.format,
  toneTags: [],
  toneDetails: null,
  contentMaturity: campaign.contentMaturity,
  playMode: inputFields.playMode,
  capacity: inputFields.capacity,
  activePlayerCount: 0,
  scheduleKind: inputFields.schedule.kind,
  timeZone: inputFields.schedule.timeZone,
  scheduleSummary: inputFields.schedule.summary,
  startsAt: null,
  weekday: null,
  localStartTime: null,
  recurrence: null,
  city: null,
  stateCode: null,
  contentGuidance: inputFields.expectations.contentGuidance,
  attendancePolicy: inputFields.expectations.attendancePolicy,
  allowedContentRules: inputFields.expectations.allowedContentRules,
  tableConduct: inputFields.expectations.tableConduct,
  contentBoundaries: inputFields.expectations.contentBoundaries,
  safetyPractices: [...inputFields.expectations.safetyPractices],
  safetyDetails: inputFields.expectations.safetyDetails,
  isFree: true,
  priceAmount: null,
  priceCurrency: null,
  publishedAt: null,
  version: 1,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z'
}

const mocks = vi.hoisted(() => ({
  campaign: {
    lockCampaign: vi.fn(),
    expirePendingInvites: vi.fn(),
    advancePendingInviteListingVersions: vi.fn()
  },
  social: {
    createSocialListing: vi.fn(),
    findSocialListingById: vi.fn(),
    lockSocialListing: vi.fn(),
    updateSocialListing: vi.fn(),
    setSocialListingStatus: vi.fn(),
    expireSubmittedSocialApplications: vi.fn(),
    advanceSubmittedSocialApplicationListingVersions: vi.fn()
  },
  entitlement: { lockTier: vi.fn(), countUsage: vi.fn() },
  requireActiveSocialProfile: vi.fn(),
  enqueueApplicationSubmittedCancellations: vi.fn(),
  enqueueInvitationReceivedCancellations: vi.fn(),
  transaction: { isTransaction: true }
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createCampaignRepository: () => mocks.campaign,
    createSocialRepository: () => mocks.social,
    createAccountEntitlementsRepository: () => mocks.entitlement,
    withTransaction: (_db: DBLike, callback: (trx: DBLike) => Promise<unknown>) =>
      callback(mocks.transaction as DBLike)
  }
})

vi.mock('./profileService.js', () => ({
  requireActiveSocialProfile: mocks.requireActiveSocialProfile
}))

vi.mock('../notifications/notificationService.js', () => ({
  enqueueApplicationSubmittedCancellations: mocks.enqueueApplicationSubmittedCancellations,
  enqueueInvitationReceivedCancellations: mocks.enqueueInvitationReceivedCancellations
}))

const { createSocialListing, openSocialListing, updateSocialListing } =
  await import('./listingService.js')

describe('Social listing entitlement and Campaign lock order', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.requireActiveSocialProfile.mockResolvedValue({ id: ids.profile })
    mocks.entitlement.lockTier.mockResolvedValue('FREE')
    mocks.entitlement.countUsage.mockResolvedValue({ publicListings: 0 })
    mocks.campaign.lockCampaign.mockResolvedValue(campaign)
    mocks.campaign.expirePendingInvites.mockResolvedValue([])
    mocks.campaign.advancePendingInviteListingVersions.mockResolvedValue([])
    mocks.social.createSocialListing.mockResolvedValue(listing)
    mocks.social.findSocialListingById.mockResolvedValue(listing)
    mocks.social.lockSocialListing.mockResolvedValue(listing)
    mocks.social.updateSocialListing.mockResolvedValue({ ...listing, version: 2 })
    mocks.social.setSocialListingStatus.mockResolvedValue({
      ...listing,
      status: 'OPEN',
      version: 2
    })
    mocks.social.expireSubmittedSocialApplications.mockResolvedValue([])
    mocks.social.advanceSubmittedSocialApplicationListingVersions.mockResolvedValue([])
  })

  it('locks the owner entitlement before Campaign creation checks', async () => {
    const input = { campaignId: ids.campaign, ...inputFields } satisfies CreateSocialListingInput

    await expect(createSocialListing({} as DBLike, ids.owner, input)).resolves.toMatchObject({
      listingPublicId: ids.listing
    })
    expect(mocks.entitlement.lockTier.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.campaign.lockCampaign.mock.invocationCallOrder[0] ?? 0
    )
  })

  it('locks the owner entitlement before Campaign update checks', async () => {
    const input = {
      listingPublicId: ids.listing,
      expectedVersion: 1,
      ...inputFields
    } satisfies UpdateSocialListingInput

    await expect(updateSocialListing({} as DBLike, ids.owner, input)).resolves.toMatchObject({
      listingPublicId: ids.listing,
      version: 2
    })
    expect(mocks.entitlement.lockTier.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.social.lockSocialListing.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.social.lockSocialListing.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.campaign.lockCampaign.mock.invocationCallOrder[0] ?? 0
    )
  })

  it('locks the owner entitlement before Campaign open checks', async () => {
    await expect(openSocialListing({} as DBLike, ids.owner, ids.listing, 1)).resolves.toMatchObject(
      { listingPublicId: ids.listing, status: 'OPEN', version: 2 }
    )
    expect(mocks.entitlement.lockTier.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.social.lockSocialListing.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.social.lockSocialListing.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.campaign.lockCampaign.mock.invocationCallOrder[0] ?? 0
    )
  })
})
