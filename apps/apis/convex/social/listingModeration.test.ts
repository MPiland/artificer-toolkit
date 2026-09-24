import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CreateSocialReportInput,
  SocialApplicationDto,
  SocialReportReceiptDto,
  SubmitSocialApplicationInput,
  socialBlockInputSchema
} from '@artificer-toolkit/schema/api/socialHub'
import type {
  CampaignInviteDto,
  CreateCampaignInviteInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  socialListingModerationInputSchema,
  SocialModerationEvidenceDto
} from '@artificer-toolkit/schema/api/socialModeration'
import { fixture } from '../../tests/fixtures/socialWriters'
import { isNotificationSourceEligible } from '../notifications/source'
import { readAdmissionInvalidation } from './admissionInvalidation'
import * as documents from './moderationDocuments'

const createReport = makeFunctionReference<
  'mutation',
  { input: CreateSocialReportInput },
  SocialReportReceiptDto
>('social/reports:create')
const moderate = makeFunctionReference<
  'mutation',
  z.input<typeof socialListingModerationInputSchema>,
  SocialModerationEvidenceDto
>('social/listingModeration:action')
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
const setRole = makeFunctionReference<
  'mutation',
  { userId: string; role: 'user' | 'superadmin' },
  null
>('authAdmin:setRole')
const createBlock = makeFunctionReference<
  'mutation',
  z.input<typeof socialBlockInputSchema>,
  unknown
>('social/blocks:create')
const listingCleanup = makeFunctionReference<
  'mutation',
  {
    listingId: string
    ownerUserId: string
    generation: number
    invalidatedAt: string
    phase: 'APPLICATION' | 'INVITATION'
    cursor: string | null
  },
  null
>('social/listingModerationCleanup:run')
const blockCleanup = makeFunctionReference<
  'mutation',
  {
    firstProfileId: string
    secondProfileId: string
    firstUserId: string
    secondUserId: string
    generation: number
    invalidatedAt: string
    phase: 'APPLICATION_FIRST' | 'APPLICATION_SECOND' | 'INVITATION_FIRST' | 'INVITATION_SECOND'
    cursor: string | null
  },
  null
>('social/blockCleanup:run')

async function setup() {
  const base = await fixture()
  const report = await base.other.caller.mutation(createReport, {
    input: {
      targetKind: 'LISTING',
      targetPublicId: base.listing.listingPublicId,
      reason: 'HARASSMENT',
      details: 'Moderation needs to remove this listing.'
    }
  })
  await base.t.mutation(setRole, { userId: base.owner.userId, role: 'superadmin' })
  return { base, report }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('native listing moderation', () => {
  it('hides immediately, records an invalidation, and restores without reviving admission', async () => {
    const { base, report } = await setup()
    const application = await base.other.caller.mutation(submit, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      message: 'Pending before moderation.'
    })
    const invitation = await base.owner.caller.mutation(createInvitation, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      username: 'AdmissionPlayer'
    })
    const copiedIds = await base.t.run(async (ctx) => {
      const sourceApplication = await ctx.db
        .query('socialApplications')
        .withIndex('by_publicId', (q) => q.eq('id', application.applicationPublicId))
        .unique()
      const sourceInvitation = await ctx.db
        .query('campaignInvites')
        .withIndex('by_publicId', (q) => q.eq('id', invitation.invitePublicId))
        .unique()
      if (!sourceApplication || !sourceInvitation) throw new Error('Missing admission sources.')
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
      const applicationIds: string[] = []
      const invitationIds: string[] = []
      for (let index = 0; index < 21; index++) {
        const applicationId = crypto.randomUUID()
        const invitationId = crypto.randomUUID()
        applicationIds.push(applicationId)
        invitationIds.push(invitationId)
        await ctx.db.insert('socialApplications', {
          ...storedApplication,
          id: applicationId,
          applicantProfileId: crypto.randomUUID()
        })
        await ctx.db.insert('campaignInvites', {
          ...storedInvitation,
          id: invitationId,
          recipientUserId: crypto.randomUUID()
        })
      }
      return { applicationIds, invitationIds }
    })
    const hidden = await base.owner.caller.mutation(moderate, {
      reportPublicId: report.reportPublicId,
      expectedVersion: 0,
      action: 'HIDE_LISTING',
      reason: 'Remove from discovery while reviewed.'
    })
    expect(hidden).toMatchObject({ version: 1 })
    const afterHide = await base.t.run(async (ctx) => ({
      listing: await ctx.db
        .query('socialListings')
        .withIndex('by_publicId', (q) => q.eq('id', base.listing.listingPublicId))
        .unique(),
      invalidations: await ctx.db.query('socialListingInvalidations').collect(),
      audits: await ctx.db.query('socialModerationActions').collect()
    }))
    expect(afterHide.listing).toMatchObject({ moderationStatus: 'HIDDEN', version: 2 })
    expect(afterHide.invalidations).toHaveLength(1)
    expect(afterHide.audits).toEqual([
      expect.objectContaining({
        action: 'HIDE_LISTING',
        affectedListingId: base.listing.listingPublicId,
        beforeState: expect.objectContaining({ listingModerationStatus: 'VISIBLE' }),
        afterState: expect.objectContaining({ listingModerationStatus: 'HIDDEN', reportVersion: 1 })
      })
    ])
    await base.owner.caller.mutation(moderate, {
      reportPublicId: report.reportPublicId,
      expectedVersion: 1,
      action: 'RESTORE_LISTING',
      reason: 'Restore listing visibility.'
    })
    const afterRestore = await base.t.run(async (ctx) => ({
      listing: await ctx.db
        .query('socialListings')
        .withIndex('by_publicId', (q) => q.eq('id', base.listing.listingPublicId))
        .unique(),
      invalidations: await ctx.db.query('socialListingInvalidations').collect(),
      scheduled: await ctx.db.system.query('_scheduled_functions').collect()
    }))
    expect(afterRestore.listing).toMatchObject({ moderationStatus: 'VISIBLE', version: 3 })
    expect(afterRestore.invalidations).toHaveLength(1)
    expect(afterRestore.scheduled).toHaveLength(1)
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
    expect(
      await base.t.run(async (ctx) => {
        const intent = await ctx.db
          .query('notificationDeliveryIntents')
          .withIndex('by_recipientUserId_workflowKey_sourcePublicId', (q) =>
            q
              .eq('recipientUserId', base.owner.userId)
              .eq('workflowKey', 'social-application-submitted')
              .eq('sourcePublicId', application.applicationPublicId)
          )
          .unique()
        if (!intent?.data) throw new Error('Missing pending application notification.')
        return isNotificationSourceEligible(ctx, base.owner.userId, intent.data)
      })
    ).toBe(false)
    const replacement = await base.other.caller.mutation(submit, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: 3,
      message: 'Created after the listing was restored.'
    })
    await base.t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('socialApplications')
          .withIndex('by_publicId', (q) => q.eq('id', application.applicationPublicId))
          .unique()
      )
    ).toMatchObject({ status: 'EXPIRED', version: 1 })
    const paged = await base.t.run(async (ctx) => ({
      applications: await Promise.all(
        copiedIds.applicationIds.map((id) =>
          ctx.db
            .query('socialApplications')
            .withIndex('by_publicId', (q) => q.eq('id', id))
            .unique()
        )
      ),
      invitations: await Promise.all(
        copiedIds.invitationIds.map((id) =>
          ctx.db
            .query('campaignInvites')
            .withIndex('by_publicId', (q) => q.eq('id', id))
            .unique()
        )
      )
    }))
    expect(paged.applications).toEqual(
      Array.from({ length: 21 }, () => expect.objectContaining({ status: 'EXPIRED', version: 1 }))
    )
    expect(paged.invitations).toEqual(
      Array.from({ length: 21 }, () => expect.objectContaining({ status: 'EXPIRED', version: 1 }))
    )
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('socialApplications')
          .withIndex('by_publicId', (q) => q.eq('id', replacement.applicationPublicId))
          .unique()
      )
    ).toMatchObject({ status: 'SUBMITTED', listingGeneration: 1, version: 0 })
  })

  it('establishes an invalidation before restoring a legacy hidden listing', async () => {
    const { base, report } = await setup()
    const application = await base.other.caller.mutation(submit, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      message: 'Legacy pending admission.'
    })
    await base.t.run(async (ctx) => {
      const listing = await ctx.db
        .query('socialListings')
        .withIndex('by_publicId', (q) => q.eq('id', base.listing.listingPublicId))
        .unique()
      if (!listing) throw new Error('Missing listing.')
      await ctx.db.patch(listing._id, { moderationStatus: 'HIDDEN' })
    })
    await base.owner.caller.mutation(moderate, {
      reportPublicId: report.reportPublicId,
      expectedVersion: 0,
      action: 'RESTORE_LISTING',
      reason: 'Restore a legacy hidden listing.'
    })
    expect(await base.t.run((ctx) => ctx.db.query('socialListingInvalidations').collect())).toEqual(
      [expect.objectContaining({ listingId: base.listing.listingPublicId, generation: 1 })]
    )
    await base.t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('socialApplications')
          .withIndex('by_publicId', (q) => q.eq('id', application.applicationPublicId))
          .unique()
      )
    ).toMatchObject({ status: 'EXPIRED', version: 1 })
  })

  it.each([
    'listing cleanup before BLOCK',
    'listing cleanup first',
    'block cleanup first'
  ] as const)('keeps HIDE as the first invalidation when %s', async (order) => {
    const { base, report } = await setup()
    const application = await base.other.caller.mutation(submit, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      message: 'Ordering application.'
    })
    const invitation = await base.owner.caller.mutation(createInvitation, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      username: 'AdmissionPlayer'
    })
    await base.owner.caller.mutation(moderate, {
      reportPublicId: report.reportPublicId,
      expectedVersion: 0,
      action: 'HIDE_LISTING',
      reason: 'Hide before blocking.'
    })
    const [listingEvent, participant] = await base.t.run(async (ctx) => [
      await ctx.db.query('socialListingInvalidations').first(),
      await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique()
    ])
    if (!listingEvent || !participant) throw new Error('Missing HIDE event or participant.')
    const listingArgs = {
      listingId: base.listing.listingPublicId,
      ownerUserId: base.owner.userId,
      generation: listingEvent.generation,
      invalidatedAt: listingEvent.invalidatedAt,
      cursor: null
    }
    const runListing = async () => {
      await base.t.mutation(listingCleanup, { ...listingArgs, phase: 'APPLICATION' })
      await base.t.mutation(listingCleanup, { ...listingArgs, phase: 'INVITATION' })
    }
    if (order === 'listing cleanup before BLOCK') await runListing()
    await base.owner.caller.mutation(createBlock, { profilePublicId: participant.id })
    const blockEvent = await base.t.run((ctx) => ctx.db.query('socialBlockInvalidations').first())
    if (!blockEvent) throw new Error('Missing block event.')
    const participantIsFirst = blockEvent.firstProfileId === participant.id
    const blockArgs = {
      firstProfileId: blockEvent.firstProfileId,
      secondProfileId: blockEvent.secondProfileId,
      firstUserId: blockEvent.firstUserId,
      secondUserId: blockEvent.secondUserId,
      generation: blockEvent.generation,
      invalidatedAt: blockEvent.invalidatedAt,
      cursor: null
    }
    const runBlock = async () => {
      await base.t.mutation(blockCleanup, {
        ...blockArgs,
        phase: participantIsFirst ? 'APPLICATION_FIRST' : 'APPLICATION_SECOND'
      })
      await base.t.mutation(blockCleanup, {
        ...blockArgs,
        phase: participantIsFirst ? 'INVITATION_FIRST' : 'INVITATION_SECOND'
      })
    }
    if (order === 'listing cleanup first') {
      await runListing()
      await runBlock()
    } else if (order === 'block cleanup first') {
      await runBlock()
      await runListing()
    } else await runBlock()
    const rows = await base.t.run(async (ctx) => ({
      application: await ctx.db
        .query('socialApplications')
        .withIndex('by_publicId', (q) => q.eq('id', application.applicationPublicId))
        .unique(),
      invitation: await ctx.db
        .query('campaignInvites')
        .withIndex('by_publicId', (q) => q.eq('id', invitation.invitePublicId))
        .unique()
    }))
    expect(rows.application).toMatchObject({
      status: 'EXPIRED',
      expiredAt: listingEvent.invalidatedAt,
      version: 1
    })
    expect(rows.invitation).toMatchObject({
      status: 'EXPIRED',
      expiredAt: listingEvent.invalidatedAt,
      version: 1
    })
  })

  it.each([false, true])('keeps %s BLOCK metadata ahead of a later HIDE', async (legacyBlock) => {
    const { base, report } = await setup()
    const application = await base.other.caller.mutation(submit, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      message: 'Block before hide application.'
    })
    const invitation = await base.owner.caller.mutation(createInvitation, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      username: 'AdmissionPlayer'
    })
    const participant = await base.t.run((ctx) =>
      ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique()
    )
    if (!participant) throw new Error('Missing participant.')
    await base.owner.caller.mutation(createBlock, { profilePublicId: participant.id })
    const blockEvent = await base.t.run(async (ctx) => {
      const event = await ctx.db.query('socialBlockInvalidations').first()
      if (!event) throw new Error('Missing block event.')
      if (legacyBlock) {
        const { _id, _creationTime, committedAt: _committedAt, ...legacy } = event
        await ctx.db.replace(_id, legacy)
      }
      return event
    })
    if (!blockEvent) throw new Error('Missing block event.')
    await base.owner.caller.mutation(moderate, {
      reportPublicId: report.reportPublicId,
      expectedVersion: 0,
      action: 'HIDE_LISTING',
      reason: 'Hide after blocking.'
    })
    await base.t.finishAllScheduledFunctions(vi.runAllTimers)
    const rows = await base.t.run(async (ctx) => ({
      application: await ctx.db
        .query('socialApplications')
        .withIndex('by_publicId', (q) => q.eq('id', application.applicationPublicId))
        .unique(),
      invitation: await ctx.db
        .query('campaignInvites')
        .withIndex('by_publicId', (q) => q.eq('id', invitation.invitePublicId))
        .unique()
    }))
    expect(rows.application).toMatchObject({
      status: 'BLOCKED',
      blockedAt: blockEvent.invalidatedAt
    })
    expect(rows.invitation).toMatchObject({
      status: 'REVOKED',
      revokedAt: blockEvent.invalidatedAt
    })
  })

  it('orders committed listing invalidation ahead of pending and committed block invalidation', async () => {
    const base = await fixture()
    const [host, participant] = await base.t.run(async (ctx) => [
      await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique(),
      await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique()
    ])
    if (!host || !participant) throw new Error('Missing Social profiles.')
    await base.t.run((ctx) =>
      ctx.db.insert('socialListingInvalidations', {
        listingId: base.listing.listingPublicId,
        generation: 1,
        invalidatedAt: '2030-01-01T00:00:00.000Z',
        committedAt: ctx.db.vars.commitTs
      })
    )
    const [first, second] = host.id < participant.id ? [host, participant] : [participant, host]
    await base.t.run(async (ctx) => {
      await ctx.db.insert('socialBlockInvalidations', {
        firstProfileId: first.id,
        secondProfileId: second.id,
        firstUserId: first.userId,
        secondUserId: second.userId,
        generation: 1,
        invalidatedAt: '2030-01-01T00:00:00.000Z',
        committedAt: ctx.db.vars.commitTs
      })
      expect(
        await readAdmissionInvalidation(
          ctx,
          host.userId,
          { profileId: participant.id },
          0,
          {
            id: base.listing.listingPublicId,
            generation: 0
          },
          {}
        )
      ).toMatchObject({ kind: 'LISTING', generation: 1 })
    })
    expect(
      await base.t.run((ctx) =>
        readAdmissionInvalidation(
          ctx,
          host.userId,
          { profileId: participant.id },
          0,
          {
            id: base.listing.listingPublicId,
            generation: 0
          },
          {}
        )
      )
    ).toMatchObject({ kind: 'LISTING', generation: 1 })
  })

  it('rejects stale or repeated actions without writes', async () => {
    const { base, report } = await setup()
    const before = await base.t.run(async (ctx) => ({
      listings: await ctx.db.query('socialListings').collect(),
      reports: await ctx.db.query('socialReports').collect(),
      events: await ctx.db.query('socialListingInvalidations').collect(),
      audits: await ctx.db.query('socialModerationActions').collect(),
      scheduled: await ctx.db.system.query('_scheduled_functions').collect()
    }))
    await expect(
      base.other.caller.mutation(moderate, {
        reportPublicId: report.reportPublicId,
        expectedVersion: 0,
        action: 'HIDE_LISTING',
        reason: 'Forged moderator action.'
      })
    ).rejects.toThrow()
    await expect(
      base.owner.caller.mutation(moderate, {
        reportPublicId: report.reportPublicId,
        expectedVersion: 1,
        action: 'HIDE_LISTING',
        reason: 'Stale report version.'
      })
    ).rejects.toThrow('version conflict')
    expect(
      await base.t.run(async (ctx) => ({
        listings: await ctx.db.query('socialListings').collect(),
        reports: await ctx.db.query('socialReports').collect(),
        events: await ctx.db.query('socialListingInvalidations').collect(),
        audits: await ctx.db.query('socialModerationActions').collect(),
        scheduled: await ctx.db.system.query('_scheduled_functions').collect()
      }))
    ).toEqual(before)
    await base.owner.caller.mutation(moderate, {
      reportPublicId: report.reportPublicId,
      expectedVersion: 0,
      action: 'HIDE_LISTING',
      reason: 'Hide it.'
    })
    const hidden = await base.t.run(async (ctx) => ({
      listings: await ctx.db.query('socialListings').collect(),
      reports: await ctx.db.query('socialReports').collect(),
      events: await ctx.db.query('socialListingInvalidations').collect(),
      audits: await ctx.db.query('socialModerationActions').collect(),
      scheduled: await ctx.db.system.query('_scheduled_functions').collect()
    }))
    await expect(
      base.owner.caller.mutation(moderate, {
        reportPublicId: report.reportPublicId,
        expectedVersion: 1,
        action: 'HIDE_LISTING',
        reason: 'Hide it again.'
      })
    ).rejects.toThrow('already')
    expect(
      await base.t.run(async (ctx) => ({
        listings: await ctx.db.query('socialListings').collect(),
        reports: await ctx.db.query('socialReports').collect(),
        events: await ctx.db.query('socialListingInvalidations').collect(),
        audits: await ctx.db.query('socialModerationActions').collect(),
        scheduled: await ctx.db.system.query('_scheduled_functions').collect()
      }))
    ).toEqual(hidden)
  })

  it('rolls back listing, report, audit, invalidation, and scheduling when evidence presentation fails', async () => {
    const { base, report } = await setup()
    const before = await base.t.run(async (ctx) => ({
      listings: await ctx.db.query('socialListings').collect(),
      reports: await ctx.db.query('socialReports').collect(),
      events: await ctx.db.query('socialListingInvalidations').collect(),
      audits: await ctx.db.query('socialModerationActions').collect(),
      scheduled: await ctx.db.system.query('_scheduled_functions').collect()
    }))
    const fault = vi
      .spyOn(documents, 'presentModerationReport')
      .mockRejectedValueOnce(new Error('Injected evidence presentation failure'))
    try {
      await expect(
        base.owner.caller.mutation(moderate, {
          reportPublicId: report.reportPublicId,
          expectedVersion: 0,
          action: 'HIDE_LISTING',
          reason: 'Fail at final presentation.'
        })
      ).rejects.toThrow('Injected evidence presentation failure')
    } finally {
      fault.mockRestore()
    }
    expect(
      await base.t.run(async (ctx) => ({
        listings: await ctx.db.query('socialListings').collect(),
        reports: await ctx.db.query('socialReports').collect(),
        events: await ctx.db.query('socialListingInvalidations').collect(),
        audits: await ctx.db.query('socialModerationActions').collect(),
        scheduled: await ctx.db.system.query('_scheduled_functions').collect()
      }))
    ).toEqual(before)
  })
})
