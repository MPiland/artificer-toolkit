import { describe, expect, it } from 'vitest'
import {
  deleteAccountCompletely,
  runAccountDeletionStep
} from '../../tests/fixtures/accountDeletion'
import { fixture } from '../../tests/fixtures/socialWriters'
import { api, components, internal } from '../_generated/api'

async function applicantAccount(base: Awaited<ReturnType<typeof fixture>>) {
  const account = await base.t.run((ctx) =>
    ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
      .unique()
  )
  if (!account) throw new Error('Missing applicant account.')
  return account
}

describe('account deletion retains Social application and report history', () => {
  it('withdraws pending applicant history, deletes current identity, and presents retained evidence', async () => {
    const base = await fixture()
    const application = await base.other.caller.mutation(api.social.applications.submit, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      message: 'Keep this application and the report evidence.'
    })
    const report = await base.other.caller.mutation(api.social.reports.create, {
      input: {
        targetKind: 'APPLICATION',
        targetPublicId: application.applicationPublicId,
        reason: 'OTHER',
        details: 'Preserve this reporter evidence.'
      }
    })
    await base.t.mutation(internal.authAdmin.setRole, {
      userId: base.owner.userId,
      role: 'superadmin'
    })
    const account = await applicantAccount(base)

    await deleteAccountCompletely(base.t, account.authUserId)

    const retained = await base.t.run(async (ctx) => ({
      account: await ctx.db.get(account._id),
      profile: await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique(),
      application: await ctx.db
        .query('socialApplications')
        .withIndex('by_publicId', (q) => q.eq('id', application.applicationPublicId))
        .unique(),
      report: await ctx.db
        .query('socialReports')
        .withIndex('by_publicId', (q) => q.eq('id', report.reportPublicId))
        .unique()
    }))
    expect(retained.account).toBeNull()
    expect(retained.profile).toBeNull()
    expect(retained.application).toMatchObject({
      id: application.applicationPublicId,
      status: 'WITHDRAWN',
      applicantDeletedAt: expect.any(String),
      withdrawnAt: expect.any(String),
      version: 1
    })
    expect(retained.report).toMatchObject({
      id: report.reportPublicId,
      reporterProfileId: application.applicant.profilePublicId
    })
    expect(
      (
        await base.owner.caller.query(api.social.admissionLists.listListingApplications, {
          listingPublicId: base.listing.listingPublicId,
          group: 'HISTORY',
          paginationOpts: { cursor: null, numItems: 10 }
        })
      ).page
    ).toEqual([
      expect.objectContaining({
        applicationPublicId: application.applicationPublicId,
        applicant: {
          profilePublicId: application.applicant.profilePublicId,
          username: 'Deleted user'
        },
        status: 'WITHDRAWN'
      })
    ])
    await expect(
      base.owner.caller.mutation(api.social.moderation.open, {
        reportPublicId: report.reportPublicId
      })
    ).resolves.toMatchObject({
      reporter: {
        profilePublicId: application.applicant.profilePublicId,
        username: 'Deleted user'
      }
    })
    await expect(
      base.other.caller.query(api.social.applications.getOwn, {
        applicationPublicId: application.applicationPublicId
      })
    ).rejects.toThrow('Unauthenticated')
  })

  it('rolls back the Social deletion step when its parent transaction fails after Social preparation', async () => {
    const base = await fixture()
    const application = await base.other.caller.mutation(api.social.applications.submit, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      message: 'Rollback this retained application.'
    })
    const account = await applicantAccount(base)
    const snapshot = () =>
      base.t.run(async (ctx) => ({
        authUser: await ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: 'user',
          where: [{ field: '_id', value: account.authUserId }]
        }),
        accounts: await ctx.db.query('userProfiles').collect(),
        profiles: await ctx.db.query('socialProfiles').collect(),
        applications: await ctx.db.query('socialApplications').collect(),
        reports: await ctx.db.query('socialReports').collect(),
        notificationFeedItems: await ctx.db.query('notificationFeedItems').collect(),
        notificationDeliveryIntents: await ctx.db.query('notificationDeliveryIntents').collect(),
        jobs: await ctx.db.system.query('_scheduled_functions').collect()
      }))
    const before = await snapshot()
    await base.t.mutation(internal.accountDeletion.schedule, { authUserId: account.authUserId })
    await runAccountDeletionStep(
      base.t,
      base.other.userId,
      internal.campaigns.accountDeparture.step
    )
    const atSocial = await snapshot()
    expect(atSocial.applications).toEqual(before.applications)
    const job = await base.t.run((ctx) =>
      ctx.db
        .query('accountDeletionJobs')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique()
    )
    expect(job).toMatchObject({ step: 'SOCIAL' })
    if (!job) throw new Error('Missing account deletion job.')

    await expect(
      base.t.run(async (ctx) => {
        await ctx.runMutation(internal.social.accountCleanup.prepareAccountDeletion, {
          jobId: job._id,
          token: job.token
        })
        throw new Error('Injected parent transaction failure')
      })
    ).rejects.toThrow('Injected parent transaction failure')

    expect(await snapshot()).toEqual(atSocial)
    const beforeApplication = before.applications.find(
      (row) => row.id === application.applicationPublicId
    )
    expect(beforeApplication).toMatchObject({ status: 'SUBMITTED', version: 0 })
    expect(beforeApplication).not.toHaveProperty('applicantDeletedAt')
  })
})
