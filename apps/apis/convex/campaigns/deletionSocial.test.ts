import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDeletionResult,
  CampaignInviteDto,
  CreateCampaignInviteInput,
  DeleteCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CreateSocialReportInput,
  SocialApplicationDto,
  SocialReportReceiptDto,
  SubmitSocialApplicationInput,
  socialApplicationVersionInputSchema
} from '@artificer-toolkit/schema/api/socialHub'
import type {
  SocialModerationEvidenceDto,
  socialReportReviewInputSchema
} from '@artificer-toolkit/schema/api/socialModeration'
import { socialStoredModerationActionSchema } from '@artificer-toolkit/schema/projections/socialModerationPersistence'
import { fixture } from '../../tests/fixtures/socialWriters'
import { api } from '../_generated/api'
import type { Id, TableNames } from '../_generated/dataModel'
import schema from '../schema'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
const runDeletion = makeFunctionReference<
  'action',
  { jobId: Id<'campaignDeletionJobs'>; revision: number },
  null
>('campaigns/deletionJobs:run')

const remove = makeFunctionReference<'mutation', DeleteCampaignInput, CampaignDeletionResult>(
  'campaigns/deletion:remove'
)
const createReport = makeFunctionReference<
  'mutation',
  { input: CreateSocialReportInput },
  SocialReportReceiptDto
>('social/reports:create')
const submit = makeFunctionReference<
  'mutation',
  SubmitSocialApplicationInput,
  SocialApplicationDto
>('social/applications:submit')
const withdraw = makeFunctionReference<
  'mutation',
  z.input<typeof socialApplicationVersionInputSchema>,
  SocialApplicationDto
>('social/applications:withdraw')
const invite = makeFunctionReference<'mutation', CreateCampaignInviteInput, CampaignInviteDto>(
  'social/invitations:create'
)
const review = makeFunctionReference<
  'mutation',
  z.input<typeof socialReportReviewInputSchema>,
  SocialModerationEvidenceDto
>('social/moderation:review')
const setRole = makeFunctionReference<
  'mutation',
  { userId: string; role: 'user' | 'superadmin' },
  null
>('authAdmin:setRole')
const tableNames = Object.keys(schema.tables) as TableNames[]
const snapshot = (base: Awaited<ReturnType<typeof fixture>>) =>
  base.t.run(async (ctx) => ({
    tables: Object.fromEntries(
      await Promise.all(
        tableNames.map(async (name) => [name, await ctx.db.query(name).collect()] as const)
      )
    ),
    scheduled: await ctx.db.system.query('_scheduled_functions').collect()
  }))
const deleteInput = (base: Awaited<ReturnType<typeof fixture>>): DeleteCampaignInput => ({
  campaignId: base.campaign.id,
  expectedVersion: base.campaign.version,
  confirmation: 'DELETE'
})

async function listingReport(base: Awaited<ReturnType<typeof fixture>>) {
  await base.other.caller.mutation(createReport, {
    input: {
      targetKind: 'LISTING',
      targetPublicId: base.listing.listingPublicId,
      reason: 'HARASSMENT',
      details: 'Retained listing report.'
    }
  })
}
async function terminalApplicationReport(base: Awaited<ReturnType<typeof fixture>>) {
  const application = await base.other.caller.mutation(submit, {
    listingPublicId: base.listing.listingPublicId,
    expectedListingVersion: base.listing.version,
    message: 'Retained application history.'
  })
  const report = await base.owner.caller.mutation(createReport, {
    input: {
      targetKind: 'APPLICATION',
      targetPublicId: application.applicationPublicId,
      reason: 'OTHER',
      details: 'Retained terminal application report.'
    }
  })
  await base.other.caller.mutation(withdraw, {
    applicationPublicId: application.applicationPublicId,
    expectedVersion: application.version
  })
  await base.t.mutation(setRole, { userId: base.owner.userId, role: 'superadmin' })
  await base.owner.caller.mutation(review, {
    reportPublicId: report.reportPublicId,
    action: 'START_REVIEW',
    expectedVersion: 0,
    reason: 'Review retained history.'
  })
  await base.owner.caller.mutation(review, {
    reportPublicId: report.reportPublicId,
    action: 'DISMISS',
    expectedVersion: 1,
    reason: 'Dismiss retained history.'
  })
  await base.t.run(async (ctx) => {
    expect(
      (
        await ctx.db
          .query('socialApplications')
          .withIndex('by_publicId', (q) => q.eq('id', application.applicationPublicId))
          .unique()
      )?.status
    ).toBe('WITHDRAWN')
    expect(
      (
        await ctx.db
          .query('socialReports')
          .withIndex('by_publicId', (q) => q.eq('id', report.reportPublicId))
          .unique()
      )?.status
    ).toBe('DISMISSED')
  })
}
async function listingAuditOnly(base: Awaited<ReturnType<typeof fixture>>) {
  const profile = await base.t.run((ctx) =>
    ctx.db
      .query('socialProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
      .unique()
  )
  if (!profile) throw new Error('Missing owner Social profile.')
  const report = await base.other.caller.mutation(createReport, {
    input: {
      targetKind: 'PROFILE',
      targetPublicId: profile.id,
      reason: 'OTHER',
      details: 'Independent retained audit reference.'
    }
  })
  // Isolate the audit FK using validated persisted history; its report targets a Profile, not this listing.
  await base.t.run(async (ctx) => {
    const stored = await ctx.db
      .query('socialReports')
      .withIndex('by_publicId', (q) => q.eq('id', report.reportPublicId))
      .unique()
    if (!stored) throw new Error('Missing retained report.')
    await ctx.db.insert(
      'socialModerationActions',
      socialStoredModerationActionSchema.parse({
        id: crypto.randomUUID(),
        moderatorUserId: base.owner.userId,
        reportId: stored.id,
        action: 'RESTORE_LISTING',
        affectedProfileId: null,
        affectedListingId: base.listing.listingPublicId,
        reason: 'Independent retained listing audit.',
        beforeState: {
          reportStatus: stored.status,
          reportVersion: stored.version,
          listingModerationStatus: 'HIDDEN'
        },
        afterState: {
          reportStatus: stored.status,
          reportVersion: stored.version,
          listingModerationStatus: 'VISIBLE'
        },
        createdAt: stored.updatedAt
      })
    )
    expect(
      await ctx.db
        .query('socialReports')
        .withIndex('by_targetListingId', (q) =>
          q.eq('targetListingId', base.listing.listingPublicId)
        )
        .collect()
    ).toEqual([])
  })
}

describe('Campaign deletion Social boundaries', () => {
  it.each([
    ['listing report', listingReport],
    ['terminal application and report', terminalApplicationReport],
    ['independent listing audit', listingAuditOnly]
  ] as const)(
    'refuses a retained %s with literal all-root-table and scheduled-state preservation',
    async (_name, prepare) => {
      const base = await fixture()
      await prepare(base)
      const before = await snapshot(base)
      await expect(base.owner.caller.mutation(remove, deleteInput(base))).rejects.toThrow(
        'Campaign admission history is referenced by moderation.'
      )
      expect(await snapshot(base)).toEqual(before)
    },
    30_000
  )

  it('removes unreferenced admission, cancels exact pending intents, and preserves unrelated Social and feed history', async () => {
    const base = await fixture()
    const application = await base.other.caller.mutation(submit, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      message: 'Pending application.'
    })
    await base.addActor('InvitedPlayer')
    const invitation = await base.owner.caller.mutation(invite, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      username: 'InvitedPlayer'
    })
    const unrelated = await base.addActor('UnrelatedProfile')
    const profile = await base.t.run((ctx) =>
      ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', unrelated.userId))
        .unique()
    )
    if (!profile) throw new Error('Missing protected Social profile.')
    await base.owner.caller.mutation(api.social.blocks.create, { profilePublicId: profile.id })
    const before = await snapshot(base)
    const intentsBefore = await base.t.run((ctx) =>
      ctx.db.query('notificationDeliveryIntents').collect()
    )
    const targetIds = new Set([application.applicationPublicId, invitation.invitePublicId])
    expect(intentsBefore.filter((row) => targetIds.has(row.sourcePublicId))).toHaveLength(2)
    expect(
      intentsBefore
        .filter((row) => targetIds.has(row.sourcePublicId))
        .every((row) => row.status === 'PENDING')
    ).toBe(true)
    const requestStarted = Date.now()
    await expect(base.owner.caller.mutation(remove, deleteInput(base))).resolves.toEqual({
      ok: true
    })
    await expect(
      base.owner.caller.query(api.social.listings.listOwned, {
        paginationOpts: { cursor: null, numItems: 8 }
      })
    ).resolves.toMatchObject({ page: [] })
    for (let page = 0; page < 100; page++) {
      const job = await base.t.run((ctx) =>
        ctx.db
          .query('campaignDeletionJobs')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
          .unique()
      )
      if (!job) throw new Error('Missing deletion job.')
      if (job.status === 'DELETED') break
      await base.t.action(runDeletion, { jobId: job._id, revision: job.revision })
      if (page === 99) throw new Error('Deletion failed to converge.')
    }
    const after = await snapshot(base)
    const deletionTime = await base.t.run(async (ctx) => {
      const job = await ctx.db
        .query('campaignDeletionJobs')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
        .unique()
      const invalidation = await ctx.db
        .query('socialListingInvalidations')
        .withIndex('by_listingId_generation', (q) =>
          q.eq('listingId', base.listing.listingPublicId)
        )
        .order('desc')
        .first()
      if (!job || !invalidation) throw new Error('Missing Campaign deletion event.')
      expect(invalidation.invalidatedAt).toBe(job.createdAt)
      return job.createdAt
    })
    for (const name of [
      'campaigns',
      'campaignMemberships',
      'campaignPlaySettings',
      'socialListings',
      'socialApplications',
      'campaignInvites'
    ])
      expect(after.tables[name], name).toEqual([])
    const changed = new Set([
      'campaigns',
      'campaignMemberships',
      'campaignPlaySettings',
      'authoredRouteIds',
      'sceneVisionRevisions',
      'accountUsageEntries',
      'userProfiles',
      'socialListings',
      'socialApplications',
      'campaignInvites',
      'notificationDeliveryIntents',
      'campaignDeletionJobs',
      'socialListingInvalidations'
    ])
    for (const name of tableNames)
      if (!changed.has(name)) expect(after.tables[name], name).toEqual(before.tables[name])
    expect(
      after.scheduled.filter((job) => job.name === 'campaigns/deletionJobs:watchdog')
    ).toHaveLength(1)
    expect(
      after.scheduled.filter(
        (job) =>
          job.name !== 'campaigns/deletionJobs:run' &&
          job.name !== 'campaigns/deletionJobs:watchdog'
      )
    ).toEqual(before.scheduled)
    expect(after.tables.socialBlocks).toHaveLength(1)
    const intentsAfter = await base.t.run((ctx) =>
      ctx.db.query('notificationDeliveryIntents').collect()
    )
    expect(intentsAfter).toEqual(
      intentsBefore.map((row) => {
        if (!targetIds.has(row.sourcePublicId)) return row
        const cancelled = intentsAfter.find((current) => current._id === row._id)
        expect(cancelled?.status).toBe('CANCELLED')
        if (!cancelled?.cancelledAt) throw new Error('Missing cancellation time.')
        expect(Date.parse(cancelled.cancelledAt)).toBeGreaterThanOrEqual(requestStarted)
        expect(cancelled.cancelledAt).toBe(deletionTime)
        return { ...row, status: 'CANCELLED', cancelledAt: cancelled.cancelledAt }
      })
    )
    await expect(base.owner.caller.query(api.accountEntitlements.get, {})).resolves.toMatchObject({
      usage: { activeHostedCampaigns: 0, publicListings: 0 }
    })
  }, 30_000)
})
