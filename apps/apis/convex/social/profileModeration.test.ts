import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CreateSocialReportInput,
  SocialApplicationDto,
  SocialReportReceiptDto,
  SubmitSocialApplicationInput,
  SocialListingDto,
  UpdateSocialListingInput
} from '@artificer-toolkit/schema/api/socialHub'
import type {
  CampaignInviteDto,
  CreateCampaignInviteInput,
  CampaignDetailDto,
  UpdateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  socialProfileModerationInputSchema,
  SocialModerationEvidenceDto
} from '@artificer-toolkit/schema/api/socialModeration'
import { fixture } from '../../tests/fixtures/socialWriters'
import * as documents from './moderationDocuments'

const createReport = makeFunctionReference<
  'mutation',
  { input: CreateSocialReportInput },
  SocialReportReceiptDto
>('social/reports:create')
const moderate = makeFunctionReference<
  'mutation',
  z.input<typeof socialProfileModerationInputSchema>,
  SocialModerationEvidenceDto
>('social/profileModeration:action')
const setRole = makeFunctionReference<
  'mutation',
  { userId: string; role: 'user' | 'superadmin' },
  null
>('authAdmin:setRole')
const submit = makeFunctionReference<
  'mutation',
  SubmitSocialApplicationInput,
  SocialApplicationDto
>('social/applications:submit')
const createInvitation = makeFunctionReference<
  'mutation',
  CreateCampaignInviteInput,
  CampaignInviteDto
>('social/invitations:create')
const getOwnApplication = makeFunctionReference<
  'query',
  { applicationPublicId: string },
  SocialApplicationDto
>('social/applications:getOwn')
const getReceivedInvitation = makeFunctionReference<
  'query',
  { invitePublicId: string; asOf: string },
  CampaignInviteDto
>('social/invitationReads:getReceived')
const getOwnedListing = makeFunctionReference<
  'query',
  { listingPublicId: string },
  { status: string; version: number }
>('social/listings:getOwned')
const updateListing = makeFunctionReference<
  'mutation',
  { input: UpdateSocialListingInput },
  SocialListingDto
>('social/listings:update')
const openListing = makeFunctionReference<
  'mutation',
  { listingPublicId: string; expectedVersion: number },
  SocialListingDto
>('social/listings:open')
const updateCampaign = makeFunctionReference<'mutation', UpdateCampaignInput, CampaignDetailDto>(
  'campaigns/update:update'
)

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

async function setup(target: 'HOST' | 'PARTICIPANT') {
  const base = await fixture()
  const targetUserId = target === 'HOST' ? base.owner.userId : base.other.userId
  const targetProfile = await base.t.run((ctx) =>
    ctx.db
      .query('socialProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', targetUserId))
      .unique()
  )
  if (!targetProfile) throw new Error('Missing target Social profile.')
  const reporter = target === 'HOST' ? base.other : base.owner
  const report = await reporter.caller.mutation(createReport, {
    input: {
      targetKind: 'PROFILE',
      targetPublicId: targetProfile.id,
      reason: 'HARASSMENT',
      details: 'Profile moderation evidence.'
    }
  })
  const moderator = target === 'HOST' ? await base.addActor('ProfileModerator') : base.owner
  await base.t.mutation(setRole, { userId: moderator.userId, role: 'superadmin' })
  return { base, report, targetProfile, moderator }
}

describe('native profile moderation', () => {
  it('fences moderator actions and rolls back a failed final presentation', async () => {
    const { base, report, moderator } = await setup('PARTICIPANT')
    const snapshot = () =>
      base.t.run(async (ctx) => ({
        profiles: await ctx.db.query('socialProfiles').collect(),
        reports: await ctx.db.query('socialReports').collect(),
        events: await ctx.db.query('socialProfileInvalidations').collect(),
        audits: await ctx.db.query('socialModerationActions').collect(),
        scheduled: await ctx.db.system.query('_scheduled_functions').collect()
      }))
    const before = await snapshot()
    await expect(
      base.other.caller.mutation(moderate, {
        reportPublicId: report.reportPublicId,
        expectedVersion: 0,
        action: 'SUSPEND_PROFILE',
        reason: 'Forged moderation.'
      })
    ).rejects.toThrow()
    await expect(
      moderator.caller.mutation(moderate, {
        reportPublicId: report.reportPublicId,
        expectedVersion: 1,
        action: 'SUSPEND_PROFILE',
        reason: 'Stale moderation.'
      })
    ).rejects.toThrow('version conflict')
    expect(await snapshot()).toEqual(before)
    const fault = vi
      .spyOn(documents, 'presentModerationReport')
      .mockRejectedValueOnce(new Error('Injected final presentation failure'))
    try {
      await expect(
        moderator.caller.mutation(moderate, {
          reportPublicId: report.reportPublicId,
          expectedVersion: 0,
          action: 'SUSPEND_PROFILE',
          reason: 'Rollback test.'
        })
      ).rejects.toThrow('Injected final presentation failure')
    } finally {
      fault.mockRestore()
    }
    expect(await snapshot()).toEqual(before)
  })

  it('permanently closes host admission after suspend then restore', async () => {
    const { base, report, moderator } = await setup('HOST')
    const application = await base.other.caller.mutation(submit, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      message: 'Host suspension application.'
    })
    const invitation = await base.owner.caller.mutation(createInvitation, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      username: 'AdmissionPlayer'
    })
    await moderator.caller.mutation(moderate, {
      reportPublicId: report.reportPublicId,
      expectedVersion: 0,
      action: 'SUSPEND_PROFILE',
      reason: 'Suspend host.'
    })
    await moderator.caller.mutation(moderate, {
      reportPublicId: report.reportPublicId,
      expectedVersion: 1,
      action: 'RESTORE_PROFILE',
      reason: 'Restore host.'
    })
    await expect(
      base.owner.caller.query(getOwnedListing, { listingPublicId: base.listing.listingPublicId })
    ).resolves.toMatchObject({ status: 'CLOSED' })
    await expect(
      base.other.caller.query(getOwnApplication, {
        applicationPublicId: application.applicationPublicId
      })
    ).resolves.toMatchObject({ status: 'EXPIRED' })
    await expect(
      base.other.caller.query(getReceivedInvitation, {
        invitePublicId: invitation.invitePublicId,
        asOf: new Date().toISOString()
      })
    ).resolves.toMatchObject({ status: 'EXPIRED' })
    await base.t.finishAllScheduledFunctions(vi.runAllTimers)
    const rows = await base.snapshot()
    expect(
      rows.applications.find((row) => row.id === application.applicationPublicId)
    ).toMatchObject({
      status: 'EXPIRED',
      version: 1
    })
    expect(rows.invitations.find((row) => row.id === invitation.invitePublicId)).toMatchObject({
      status: 'EXPIRED',
      version: 1
    })
  })

  it.each(['HOST', 'PARTICIPANT'] as const)(
    'pages every affected request through %s suspension',
    async (target) => {
      const { base, report, moderator } = await setup(target)
      const application = await base.other.caller.mutation(submit, {
        listingPublicId: base.listing.listingPublicId,
        expectedListingVersion: base.listing.version,
        message: 'Source application for paging.'
      })
      const invitation = await base.owner.caller.mutation(createInvitation, {
        listingPublicId: base.listing.listingPublicId,
        expectedListingVersion: base.listing.version,
        username: 'AdmissionPlayer'
      })
      const copied = await base.t.run(async (ctx) => {
        const listing = await ctx.db
          .query('socialListings')
          .withIndex('by_publicId', (q) => q.eq('id', base.listing.listingPublicId))
          .unique()
        const sourceApplication = await ctx.db
          .query('socialApplications')
          .withIndex('by_publicId', (q) => q.eq('id', application.applicationPublicId))
          .unique()
        const sourceInvitation = await ctx.db
          .query('campaignInvites')
          .withIndex('by_publicId', (q) => q.eq('id', invitation.invitePublicId))
          .unique()
        if (!listing || !sourceApplication || !sourceInvitation)
          throw new Error('Missing paging sources.')
        const campaign = await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
          .unique()
        if (!campaign) throw new Error('Missing source Campaign.')
        const {
          _id: _campaignRowId,
          _creationTime: _campaignCreationTime,
          ...storedCampaign
        } = campaign
        const {
          _id: _listingRowId,
          _creationTime: _listingCreationTime,
          ...storedListing
        } = listing
        const {
          _id: _applicationRowId,
          _creationTime: _applicationCreationTime,
          ...storedApplication
        } = sourceApplication
        const {
          _id: _invitationRowId,
          _creationTime: _invitationCreationTime,
          ...storedInvitation
        } = sourceInvitation
        const listingIds: string[] = []
        const applicationIds: string[] = []
        const invitationIds: string[] = []
        for (let index = 0; index < 21; index++) {
          const campaignId = crypto.randomUUID()
          const listingId = crypto.randomUUID()
          const applicationId = crypto.randomUUID()
          const invitationId = crypto.randomUUID()
          listingIds.push(listingId)
          applicationIds.push(applicationId)
          invitationIds.push(invitationId)
          await ctx.db.insert('campaigns', { ...storedCampaign, id: campaignId })
          await ctx.db.insert('socialListings', {
            ...storedListing,
            id: listingId,
            campaignId,
            updatedAt: new Date(Date.parse(storedListing.updatedAt) + index + 1).toISOString()
          })
          await ctx.db.insert('socialApplications', {
            ...storedApplication,
            id: applicationId,
            listingId
          })
          await ctx.db.insert('campaignInvites', {
            ...storedInvitation,
            id: invitationId,
            listingId
          })
        }
        return { listingIds, applicationIds, invitationIds }
      })
      await moderator.caller.mutation(moderate, {
        reportPublicId: report.reportPublicId,
        expectedVersion: 0,
        action: 'SUSPEND_PROFILE',
        reason: 'Suspend paged host.'
      })
      await base.t.finishAllScheduledFunctions(vi.runAllTimers)
      const rows = await base.t.run(async (ctx) => ({
        listings: await Promise.all(
          copied.listingIds.map((id) =>
            ctx.db
              .query('socialListings')
              .withIndex('by_publicId', (q) => q.eq('id', id))
              .unique()
          )
        ),
        applications: await Promise.all(
          copied.applicationIds.map((id) =>
            ctx.db
              .query('socialApplications')
              .withIndex('by_publicId', (q) => q.eq('id', id))
              .unique()
          )
        ),
        invitations: await Promise.all(
          copied.invitationIds.map((id) =>
            ctx.db
              .query('campaignInvites')
              .withIndex('by_publicId', (q) => q.eq('id', id))
              .unique()
          )
        )
      }))
      expect(rows.listings).toEqual(
        Array.from({ length: 21 }, () =>
          expect.objectContaining({ status: target === 'HOST' ? 'CLOSED' : 'OPEN' })
        )
      )
      expect(rows.applications).toEqual(
        Array.from({ length: 21 }, () => expect.objectContaining({ status: 'EXPIRED', version: 1 }))
      )
      expect(rows.invitations).toEqual(
        Array.from({ length: 21 }, () => expect.objectContaining({ status: 'EXPIRED', version: 1 }))
      )
    }
  )

  it('keeps a listing reopened after restore and its new admission through old cleanup', async () => {
    const { base, report, moderator } = await setup('HOST')
    const membershipBefore = await base.t.run((ctx) =>
      ctx.db.query('campaignMemberships').collect()
    )
    await moderator.caller.mutation(moderate, {
      reportPublicId: report.reportPublicId,
      expectedVersion: 0,
      action: 'SUSPEND_PROFILE',
      reason: 'Suspend before reopening.'
    })
    await moderator.caller.mutation(moderate, {
      reportPublicId: report.reportPublicId,
      expectedVersion: 1,
      action: 'RESTORE_PROFILE',
      reason: 'Restore before reopening.'
    })
    const [logical, stored] = await Promise.all([
      base.owner.caller.query(getOwnedListing, { listingPublicId: base.listing.listingPublicId }),
      base.t.run((ctx) =>
        ctx.db
          .query('socialListings')
          .withIndex('by_publicId', (q) => q.eq('id', base.listing.listingPublicId))
          .unique()
      )
    ])
    if (!stored) throw new Error('Missing stored listing.')
    const draft = await base.owner.caller.mutation(updateListing, {
      input: {
        listingPublicId: stored.id,
        expectedVersion: logical.version,
        summary: stored.summary,
        audience: stored.audience,
        systemId: stored.systemId,
        playMode: stored.playMode,
        capacity: stored.capacity,
        schedule: stored.schedule,
        location: stored.location,
        expectations: stored.expectations
      }
    })
    const reopened = await base.owner.caller.mutation(openListing, {
      listingPublicId: draft.listingPublicId,
      expectedVersion: draft.version
    })
    const application = await base.other.caller.mutation(submit, {
      listingPublicId: reopened.listingPublicId,
      expectedListingVersion: reopened.version,
      message: 'New application after restore.'
    })
    await base.t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('socialApplications')
          .withIndex('by_publicId', (q) => q.eq('id', application.applicationPublicId))
          .unique()
      )
    ).toMatchObject({ status: 'SUBMITTED', version: 0 })
    expect(await base.t.run((ctx) => ctx.db.query('campaignMemberships').collect())).toEqual(
      membershipBefore
    )
  })

  it('closes suspended-host listing during a campaign update and decrements usage once', async () => {
    const { base, report, moderator } = await setup('HOST')
    const before = await base.t.run(async (ctx) => ({
      account: await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique(),
      memberships: await ctx.db.query('campaignMemberships').collect()
    }))
    if (!before.account) throw new Error('Missing owner account.')
    await moderator.caller.mutation(moderate, {
      reportPublicId: report.reportPublicId,
      expectedVersion: 0,
      action: 'SUSPEND_PROFILE',
      reason: 'Suspend before campaign update.'
    })
    await base.owner.caller.mutation(updateCampaign, {
      campaignId: base.campaign.id,
      expectedVersion: base.campaign.version,
      name: 'Renamed while suspended'
    })
    const afterUpdate = await base.t.run(async (ctx) => ({
      listing: await ctx.db
        .query('socialListings')
        .withIndex('by_publicId', (q) => q.eq('id', base.listing.listingPublicId))
        .unique(),
      account: await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique()
    }))
    expect(afterUpdate.listing).toMatchObject({ status: 'CLOSED' })
    expect(afterUpdate.account?.entitlementUsage.publicListings).toBe(
      before.account.entitlementUsage.publicListings - 1
    )
    await base.t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
          .unique()
      )
    ).toMatchObject({ entitlementUsage: afterUpdate.account?.entitlementUsage })
    expect(await base.t.run((ctx) => ctx.db.query('campaignMemberships').collect())).toEqual(
      before.memberships
    )
  })

  it('permanently invalidates a suspended participant without reviving replacements', async () => {
    const { base, report, moderator } = await setup('PARTICIPANT')
    const application = await base.other.caller.mutation(submit, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      message: 'Participant suspension application.'
    })
    const invitation = await base.owner.caller.mutation(createInvitation, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      username: 'AdmissionPlayer'
    })
    await moderator.caller.mutation(moderate, {
      reportPublicId: report.reportPublicId,
      expectedVersion: 0,
      action: 'SUSPEND_PROFILE',
      reason: 'Suspend participant.'
    })
    await moderator.caller.mutation(moderate, {
      reportPublicId: report.reportPublicId,
      expectedVersion: 1,
      action: 'RESTORE_PROFILE',
      reason: 'Restore participant.'
    })
    await expect(
      base.other.caller.query(getOwnApplication, {
        applicationPublicId: application.applicationPublicId
      })
    ).resolves.toMatchObject({ status: 'EXPIRED' })
    await expect(
      base.other.caller.query(getReceivedInvitation, {
        invitePublicId: invitation.invitePublicId,
        asOf: new Date().toISOString()
      })
    ).resolves.toMatchObject({ status: 'EXPIRED' })
    const replacement = await base.other.caller.mutation(submit, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      message: 'Participant replacement application.'
    })
    const replacementInvitation = await base.owner.caller.mutation(createInvitation, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      username: 'AdmissionPlayer'
    })
    await base.t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('socialApplications')
          .withIndex('by_publicId', (q) => q.eq('id', replacement.applicationPublicId))
          .unique()
      )
    ).toMatchObject({ status: 'SUBMITTED', participantProfileGeneration: 1, version: 0 })
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('campaignInvites')
          .withIndex('by_publicId', (q) => q.eq('id', replacementInvitation.invitePublicId))
          .unique()
      )
    ).toMatchObject({ status: 'PENDING', participantProfileGeneration: 1, version: 0 })
  })

  it('establishes generation one when restoring a legacy suspended profile', async () => {
    const { base, report, targetProfile, moderator } = await setup('PARTICIPANT')
    await base.t.run(async (ctx) => {
      const profile = await ctx.db
        .query('socialProfiles')
        .withIndex('by_publicId', (q) => q.eq('id', targetProfile.id))
        .unique()
      if (!profile) throw new Error('Missing profile.')
      await ctx.db.patch(profile._id, { status: 'SUSPENDED' })
    })
    await moderator.caller.mutation(moderate, {
      reportPublicId: report.reportPublicId,
      expectedVersion: 0,
      action: 'RESTORE_PROFILE',
      reason: 'Restore legacy suspended profile.'
    })
    expect(await base.t.run((ctx) => ctx.db.query('socialProfileInvalidations').collect())).toEqual(
      [expect.objectContaining({ profileId: targetProfile.id, generation: 1 })]
    )
  })
})
