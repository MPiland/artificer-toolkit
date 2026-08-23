import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CampaignInviteRecord,
  DBLike,
  SocialApplicationRecord,
  SocialListingRecord,
  SocialProfileRecord
} from '@artificer-toolkit/db'

const mocks = vi.hoisted(() => ({
  social: {
    findSocialProfileByUser: vi.fn(),
    findSocialApplicationById: vi.fn(),
    findSocialListingById: vi.fn(),
    lockSocialListing: vi.fn(),
    lockSocialApplication: vi.fn(),
    findVisibleSocialListing: vi.fn(),
    insertSocialApplication: vi.fn(),
    hasSocialBlockEitherDirection: vi.fn(),
    setSocialApplicationStatus: vi.fn()
  },
  campaign: {
    findInviteById: vi.fn(),
    lockCampaign: vi.fn(),
    findMembership: vi.fn(),
    countActiveMembers: vi.fn(),
    activatePlayerMembership: vi.fn(),
    lockInvite: vi.fn(),
    setInviteStatus: vi.fn()
  },
  entitlement: { lockTier: vi.fn() },
  notifications: {
    enqueueApplicationDecisionNotifications: vi.fn(),
    enqueueApplicationSubmittedCancellations: vi.fn(),
    enqueueApplicationSubmittedNotification: vi.fn(),
    enqueueInvitationDecisionNotifications: vi.fn()
  },
  consumeSocialRateLimit: vi.fn(),
  transaction: { isTransaction: true }
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createSocialRepository: () => mocks.social,
    createCampaignRepository: () => mocks.campaign,
    createAccountEntitlementsRepository: () => mocks.entitlement,
    withTransaction: (_db: DBLike, callback: (trx: DBLike) => Promise<unknown>) =>
      callback(mocks.transaction as DBLike)
  }
})

vi.mock('../notifications/notificationService.js', () => ({
  ...mocks.notifications
}))

vi.mock('./rateLimits.js', () => ({ consumeSocialRateLimit: mocks.consumeSocialRateLimit }))

const {
  acceptSocialAdmission,
  decideSocialApplication,
  submitSocialApplication,
  withdrawSocialApplication
} = await import('./applicationService.js')

const ownerUserId = '00000000-0000-4000-8000-000000000001'
const applicantUserId = '00000000-0000-4000-8000-000000000002'
const listingId = '00000000-0000-4000-8000-000000000003'
const applicationId = '00000000-0000-4000-8000-000000000004'

const hostProfile: SocialProfileRecord = {
  id: '00000000-0000-4000-8000-000000000005',
  userId: ownerUserId,
  username: 'host-user',
  adultAttestedAt: '2026-08-01T00:00:00.000Z',
  contentPreference: 'STANDARD',
  status: 'ACTIVE',
  version: 1,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z'
}

const applicantProfile: SocialProfileRecord = {
  ...hostProfile,
  id: '00000000-0000-4000-8000-000000000006',
  userId: applicantUserId,
  username: 'applicant-user'
}

const listing = {
  id: listingId,
  campaignId: '00000000-0000-4000-8000-000000000007',
  campaignOwnerUserId: ownerUserId,
  campaignStatus: 'ACTIVE',
  hostProfileId: hostProfile.id,
  hostUsername: hostProfile.username,
  status: 'OPEN',
  audience: 'PUBLIC',
  moderationStatus: 'VISIBLE',
  systemId: '00000000-0000-4000-8000-000000000008',
  systemLabel: 'System',
  rulesetCode: 'RULESET',
  rulesetVersion: '1',
  title: 'Table',
  summary: 'Summary',
  campaignFormat: 'ONGOING',
  toneTags: ['HEROIC'],
  toneDetails: 'Heroic',
  contentMaturity: 'STANDARD',
  playMode: 'ONLINE',
  capacity: 1,
  activePlayerCount: 0,
  scheduleKind: 'FLEXIBLE',
  timeZone: 'America/Chicago',
  scheduleSummary: 'Flexible',
  startsAt: null,
  weekday: null,
  localStartTime: null,
  recurrence: null,
  city: null,
  stateCode: null,
  contentGuidance: 'Guidance',
  attendancePolicy: 'Attend',
  allowedContentRules: 'Rules',
  tableConduct: 'Conduct',
  contentBoundaries: 'Boundaries',
  safetyPractices: ['SESSION_ZERO'],
  safetyDetails: 'Details',
  isFree: true,
  priceAmount: null,
  priceCurrency: null,
  publishedAt: '2026-08-01T00:00:00.000Z',
  version: 2,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z'
} satisfies SocialListingRecord

const application = {
  id: applicationId,
  listingId,
  listingTitle: listing.title,
  contentMaturity: listing.contentMaturity,
  campaignId: listing.campaignId,
  hostUserId: ownerUserId,
  applicantProfileId: applicantProfile.id,
  applicantUserId,
  applicantUsername: applicantProfile.username,
  message: 'I would like to join.',
  status: 'SUBMITTED',
  listingVersion: listing.version,
  expectationsSnapshot: {
    contentGuidance: listing.contentGuidance,
    attendancePolicy: listing.attendancePolicy,
    allowedContentRules: listing.allowedContentRules,
    tableConduct: listing.tableConduct,
    contentBoundaries: listing.contentBoundaries,
    safetyPractices: listing.safetyPractices,
    safetyDetails: listing.safetyDetails
  },
  submittedAt: '2026-08-01T00:00:00.000Z',
  withdrawnAt: null,
  respondedAt: null,
  expiredAt: null,
  blockedAt: null,
  version: 1,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z'
} satisfies SocialApplicationRecord

describe('Social admission', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.social.findSocialProfileByUser.mockImplementation(async (userId: string) =>
      userId === ownerUserId ? hostProfile : applicantProfile
    )
    mocks.social.findSocialApplicationById.mockResolvedValue(application)
    mocks.social.findSocialListingById.mockResolvedValue(listing)
    mocks.social.lockSocialListing.mockResolvedValue(listing)
    mocks.social.lockSocialApplication.mockResolvedValue(application)
    mocks.social.findVisibleSocialListing.mockResolvedValue(listing)
    mocks.social.insertSocialApplication.mockResolvedValue(application)
    mocks.social.hasSocialBlockEitherDirection.mockResolvedValue(false)
    mocks.campaign.lockCampaign.mockResolvedValue({
      id: listing.campaignId,
      ownerUserId,
      status: 'ACTIVE',
      version: 1
    })
    mocks.campaign.findMembership.mockResolvedValue(null)
    mocks.campaign.countActiveMembers.mockResolvedValue({ members: 1, players: 0 })
    mocks.entitlement.lockTier.mockResolvedValue('FREE')
    mocks.social.setSocialApplicationStatus.mockResolvedValue({
      ...application,
      status: 'ACCEPTED',
      respondedAt: '2026-08-01T00:01:00.000Z',
      version: 2
    })
    mocks.consumeSocialRateLimit.mockResolvedValue(undefined)
  })

  it('locks entitlement, listing, Campaign, and source before activating one membership', async () => {
    const result = await acceptSocialAdmission({} as DBLike, ownerUserId, {
      kind: 'APPLICATION',
      publicId: applicationId,
      expectedVersion: 1
    })

    expect(result).toMatchObject({ kind: 'APPLICATION', campaignId: listing.campaignId })
    expect(mocks.entitlement.lockTier.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.social.lockSocialListing.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.social.lockSocialListing.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.campaign.lockCampaign.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.campaign.lockCampaign.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.social.lockSocialApplication.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.entitlement.lockTier.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.campaign.activatePlayerMembership.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.campaign.activatePlayerMembership.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.social.setSocialApplicationStatus.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.notifications.enqueueApplicationDecisionNotifications).toHaveBeenCalledWith(
      mocks.transaction,
      expect.objectContaining({ id: applicationId, status: 'ACCEPTED' }),
      'ACCEPTED',
      expect.any(String)
    )
  })

  it('rejects when the exact listing changes after entitlement acquisition', async () => {
    mocks.social.lockSocialListing.mockResolvedValue({ ...listing, version: listing.version + 1 })

    await expect(
      acceptSocialAdmission({} as DBLike, ownerUserId, {
        kind: 'APPLICATION',
        publicId: applicationId,
        expectedVersion: 1
      })
    ).rejects.toMatchObject({ name: 'SocialNotFoundError' })

    expect(mocks.entitlement.lockTier.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.social.lockSocialListing.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.campaign.lockCampaign).not.toHaveBeenCalled()
    expect(mocks.social.lockSocialApplication).not.toHaveBeenCalled()
  })

  it('returns an accepted active membership idempotently after listing closure', async () => {
    const accepted = { ...application, status: 'ACCEPTED' as const, version: 2 }
    const closedListing = {
      ...listing,
      status: 'CLOSED' as const,
      moderationStatus: 'HIDDEN' as const
    }
    mocks.social.findSocialApplicationById.mockResolvedValue(accepted)
    mocks.social.findSocialListingById.mockResolvedValue(closedListing)
    mocks.social.lockSocialApplication.mockResolvedValue(accepted)
    mocks.social.lockSocialListing.mockResolvedValue(closedListing)
    mocks.campaign.findMembership.mockResolvedValue({
      campaignId: listing.campaignId,
      userId: applicantUserId,
      role: 'PLAYER',
      status: 'ACTIVE'
    })

    await expect(
      acceptSocialAdmission({} as DBLike, ownerUserId, {
        kind: 'APPLICATION',
        publicId: applicationId,
        expectedVersion: 1
      })
    ).resolves.toMatchObject({ kind: 'APPLICATION', application: accepted })

    expect(mocks.entitlement.lockTier).not.toHaveBeenCalled()
    expect(mocks.campaign.activatePlayerMembership).not.toHaveBeenCalled()
    expect(mocks.social.setSocialApplicationStatus).not.toHaveBeenCalled()
    expect(mocks.notifications.enqueueApplicationDecisionNotifications).not.toHaveBeenCalled()
  })

  it('enqueues the submitted workflow in the application insert transaction', async () => {
    await submitSocialApplication({} as DBLike, applicantUserId, {
      listingPublicId: listing.id,
      expectedListingVersion: listing.version,
      message: application.message
    })

    expect(mocks.notifications.enqueueApplicationSubmittedNotification).toHaveBeenCalledWith(
      mocks.transaction,
      application,
      expect.any(String)
    )
  })

  it('cancels the submitted workflow when the applicant withdraws', async () => {
    const withdrawn = {
      ...application,
      status: 'WITHDRAWN' as const,
      withdrawnAt: '2026-08-01T00:01:00.000Z',
      version: 2
    }
    mocks.social.setSocialApplicationStatus.mockResolvedValue(withdrawn)

    await withdrawSocialApplication(
      {} as DBLike,
      applicantUserId,
      application.id,
      application.version
    )

    expect(mocks.notifications.enqueueApplicationSubmittedCancellations).toHaveBeenCalledWith(
      mocks.transaction,
      [application.id],
      expect.any(String)
    )
  })

  it('cancels the host submission and triggers the applicant decision when declined', async () => {
    const declined = {
      ...application,
      status: 'DECLINED' as const,
      respondedAt: '2026-08-01T00:01:00.000Z',
      version: 2
    }
    mocks.social.setSocialApplicationStatus.mockResolvedValue(declined)

    await decideSocialApplication({} as DBLike, ownerUserId, {
      applicationPublicId: application.id,
      expectedVersion: application.version,
      decision: 'DECLINE'
    })

    expect(mocks.notifications.enqueueApplicationDecisionNotifications).toHaveBeenCalledWith(
      mocks.transaction,
      declined,
      'DECLINED',
      expect.any(String)
    )
  })

  it('cancels invitation receipt and triggers the host decision when accepted', async () => {
    const invitation = {
      id: '00000000-0000-4000-8000-000000000010',
      listingId: listing.id,
      campaignId: listing.campaignId,
      createdBy: ownerUserId,
      recipientUserId: applicantUserId,
      recipientUsername: applicantProfile.username,
      listingVersion: listing.version,
      status: 'PENDING',
      expiresAt: '2099-08-01T00:00:00.000Z',
      respondedAt: null,
      revokedAt: null,
      expiredAt: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      version: 1
    } satisfies CampaignInviteRecord
    const accepted = {
      ...invitation,
      status: 'ACCEPTED' as const,
      respondedAt: '2026-08-01T00:01:00.000Z',
      version: 2
    }
    mocks.campaign.findInviteById.mockResolvedValue(invitation)
    mocks.campaign.lockInvite.mockResolvedValue(invitation)
    mocks.campaign.setInviteStatus.mockResolvedValue(accepted)

    await acceptSocialAdmission({} as DBLike, applicantUserId, {
      kind: 'INVITATION',
      publicId: invitation.id,
      expectedVersion: invitation.version
    })

    expect(mocks.notifications.enqueueInvitationDecisionNotifications).toHaveBeenCalledWith(
      mocks.transaction,
      accepted,
      {
        hostUserId: ownerUserId,
        listingTitle: listing.title,
        decision: 'ACCEPTED',
        occurredAt: expect.any(String)
      }
    )
  })

  it('emits no intent for failed or stale mutations', async () => {
    mocks.social.insertSocialApplication.mockRejectedValueOnce({ code: '23505' })
    await expect(
      submitSocialApplication({} as DBLike, applicantUserId, {
        listingPublicId: listing.id,
        expectedListingVersion: listing.version,
        message: application.message
      })
    ).rejects.toBeInstanceOf(Error)
    expect(mocks.notifications.enqueueApplicationSubmittedNotification).not.toHaveBeenCalled()

    await expect(
      withdrawSocialApplication(
        {} as DBLike,
        applicantUserId,
        application.id,
        application.version + 1
      )
    ).rejects.toBeInstanceOf(Error)
    expect(mocks.notifications.enqueueApplicationSubmittedCancellations).not.toHaveBeenCalled()
  })
})
