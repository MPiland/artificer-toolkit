import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike, SocialProfileRecord, SocialReportRecord } from '@artificer-toolkit/db'

const mocks = vi.hoisted(() => ({
  social: {
    findSocialProfileByUser: vi.fn(),
    lockSocialReport: vi.fn(),
    setSocialListingModerationStatus: vi.fn(),
    expireSubmittedSocialApplications: vi.fn(),
    advanceSocialReportVersion: vi.fn(),
    insertSocialModerationAction: vi.fn()
  },
  campaign: { expirePendingInvites: vi.fn() },
  transaction: { isTransaction: true }
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createSocialRepository: () => mocks.social,
    createCampaignRepository: () => mocks.campaign,
    withTransaction: (_db: DBLike, callback: (trx: DBLike) => Promise<unknown>) =>
      callback(mocks.transaction as DBLike)
  }
})

const { takeSocialModerationAction } = await import('./safetyService.js')

const moderatorUserId = '00000000-0000-4000-8000-000000000001'
const reportId = '00000000-0000-4000-8000-000000000002'
const listingId = '00000000-0000-4000-8000-000000000003'

const moderatorProfile: SocialProfileRecord = {
  id: '00000000-0000-4000-8000-000000000004',
  userId: moderatorUserId,
  username: 'moderator',
  adultAttestedAt: '2026-08-01T00:00:00.000Z',
  usAttestedAt: '2026-08-01T00:00:00.000Z',
  contentPreference: 'STANDARD',
  status: 'ACTIVE',
  version: 1,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z'
}

const report: SocialReportRecord = {
  id: reportId,
  reporterProfileId: '00000000-0000-4000-8000-000000000005',
  reporterUsername: 'reporter',
  targetKind: 'LISTING',
  targetProfileId: null,
  targetListingId: listingId,
  targetApplicationId: null,
  reason: 'SAFETY_MISREPRESENTATION',
  details: 'Reported details.',
  evidenceSnapshot: { listing: 'evidence' },
  status: 'UNDER_REVIEW',
  reviewStartedAt: '2026-08-01T00:00:00.000Z',
  resolvedAt: null,
  version: 1,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z'
}

describe('Social moderation enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.social.findSocialProfileByUser.mockResolvedValue(moderatorProfile)
    mocks.social.lockSocialReport.mockResolvedValue(report)
    mocks.social.setSocialListingModerationStatus.mockResolvedValue(true)
    mocks.social.expireSubmittedSocialApplications.mockResolvedValue(undefined)
    mocks.social.advanceSocialReportVersion.mockResolvedValue({ ...report, version: 2 })
    mocks.social.insertSocialModerationAction.mockResolvedValue(
      '00000000-0000-4000-8000-000000000006'
    )
    mocks.campaign.expirePendingInvites.mockResolvedValue(undefined)
  })

  it('advances the report version for listing enforcement and rejects a stale retry', async () => {
    const input = {
      reportPublicId: reportId,
      expectedVersion: 1,
      action: 'HIDE_LISTING' as const,
      reason: 'Hide while the report is reviewed.'
    }

    const result = await takeSocialModerationAction(
      mocks.transaction as DBLike,
      moderatorUserId,
      true,
      input
    )

    expect(result.version).toBe(2)
    expect(mocks.social.advanceSocialReportVersion).toHaveBeenCalledWith(
      expect.objectContaining({ reportId, expectedVersion: 1 })
    )
    expect(mocks.social.insertSocialModerationAction).toHaveBeenCalledWith(
      expect.objectContaining({ afterState: expect.objectContaining({ reportVersion: 2 }) })
    )

    mocks.social.lockSocialReport.mockResolvedValue({ ...report, version: 2 })

    await expect(
      takeSocialModerationAction(mocks.transaction as DBLike, moderatorUserId, true, input)
    ).rejects.toMatchObject({ name: 'SocialConflictError' })
    expect(mocks.social.setSocialListingModerationStatus).toHaveBeenCalledTimes(1)
  })
})
