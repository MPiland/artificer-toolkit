import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  SocialRetentionApplyInput,
  SocialRetentionApplyResult,
  SocialRetentionPreviewInput,
  SocialRetentionPreviewResult
} from '@artificer-toolkit/schema/api/socialRetention'
import { socialStoredModerationActionSchema } from '@artificer-toolkit/schema/projections/socialModerationPersistence'
import { api, components } from '../_generated/api'
import { fixture } from '../../tests/fixtures/socialAdmission'

const previewFixturePage = makeFunctionReference<
  'query',
  { userIds: string[]; campaignId: string; input: SocialRetentionPreviewInput },
  SocialRetentionPreviewResult & { fixtureOnly: boolean }
>('social/developmentRetention:previewFixturePage')
const applyFixturePage = makeFunctionReference<
  'mutation',
  { userIds: string[]; campaignId: string; input: SocialRetentionApplyInput },
  SocialRetentionApplyResult
>('social/developmentRetention:applyFixturePage')
const preview = makeFunctionReference<
  'query',
  SocialRetentionPreviewInput,
  SocialRetentionPreviewResult
>('social/retention:preview')

const asOf = '2026-09-01T00:00:00.000Z'
const input = (phase: SocialRetentionApplyInput['phase']): SocialRetentionApplyInput => ({
  phase,
  asOf,
  paginationOpts: { cursor: null, numItems: 8 },
  confirm: 'purge-expired-social-data'
})

async function setup() {
  const base = await fixture()
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [base.owner.userId, base.other.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing fixture profile.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_123456abcde${index}@example.invalid` }
        }
      })
    }
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    if (!campaign) throw new Error('Missing fixture Campaign.')
    await ctx.db.patch(campaign._id, { name: 'Encounter execution fixture' })
  })
  return {
    ...base,
    args: {
      userIds: [base.owner.userId, base.other.userId],
      campaignId: base.campaign.id
    }
  }
}

describe('development Social retention fixture pages', () => {
  it('rejects nonfixture, duplicate, and oversized cohorts', async () => {
    const nonfixture = await fixture()
    await expect(
      nonfixture.t.query(previewFixturePage, {
        userIds: [nonfixture.owner.userId, nonfixture.other.userId],
        campaignId: nonfixture.campaign.id,
        input: {
          phase: 'INVITATIONS',
          asOf,
          paginationOpts: { cursor: null, numItems: 8 }
        }
      })
    ).rejects.toThrow('Fixture account is required')
    const base = await setup()
    await expect(
      base.t.query(previewFixturePage, {
        ...base.args,
        userIds: [base.owner.userId, base.owner.userId],
        input: {
          phase: 'INVITATIONS',
          asOf,
          paginationOpts: { cursor: null, numItems: 8 }
        }
      })
    ).rejects.toThrow('One to four unique fixture account IDs')
    await expect(
      base.t.query(previewFixturePage, {
        ...base.args,
        userIds: [base.owner.userId, base.other.userId, crypto.randomUUID()],
        input: {
          phase: 'INVITATIONS',
          asOf,
          paginationOpts: { cursor: null, numItems: 8 }
        }
      })
    ).rejects.toThrow('Fixture profile is missing')
    await expect(
      base.t.query(previewFixturePage, {
        ...base.args,
        userIds: Array.from({ length: 5 }, () => crypto.randomUUID()),
        input: {
          phase: 'INVITATIONS',
          asOf,
          paginationOpts: { cursor: null, numItems: 8 }
        }
      })
    ).rejects.toThrow('One to four unique fixture account IDs')
  })

  it('rejects a foreign eligible page atomically', async () => {
    const base = await setup()
    await base.t.run(async (ctx) => {
      const invite = await ctx.db
        .query('campaignInvites')
        .withIndex('by_publicId', (q) => q.eq('id', base.acceptedInviteId))
        .unique()
      if (!invite) throw new Error('Missing accepted invitation.')
      const { _id, _creationTime, ...stored } = invite
      const expired = {
        respondedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
      await ctx.db.patch(invite._id, expired)
      await ctx.db.insert('campaignInvites', {
        ...stored,
        ...expired,
        id: crypto.randomUUID(),
        recipientUserId: crypto.randomUUID()
      })
    })
    const before = await base.t.run(async (ctx) => ({
      invites: await ctx.db.query('campaignInvites').collect(),
      jobs: await ctx.db.system.query('_scheduled_functions').collect()
    }))
    expect(
      await base.t.query(previewFixturePage, {
        ...base.args,
        input: {
          phase: 'INVITATIONS',
          asOf,
          paginationOpts: { cursor: null, numItems: 8 }
        }
      })
    ).toMatchObject({ fixtureOnly: false, eligible: 2 })
    await expect(
      base.t.mutation(applyFixturePage, {
        ...base.args,
        input: input('INVITATIONS')
      })
    ).rejects.toThrow('Fixture retention page contains foreign records.')
    expect(
      await base.t.run(async (ctx) => ({
        invites: await ctx.db.query('campaignInvites').collect(),
        jobs: await ctx.db.system.query('_scheduled_functions').collect()
      }))
    ).toEqual(before)
  })

  it('runs real report retention and its scheduled audit cleanup for a safe page', async () => {
    vi.useFakeTimers()
    try {
      const base = await setup()
      const targetProfileId = await base.t.run(async (ctx) => {
        const profile = await ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
          .unique()
        if (!profile) throw new Error('Missing target profile.')
        return profile.id
      })
      const report = await base.owner.caller.mutation(api.social.reports.create, {
        input: {
          targetKind: 'PROFILE',
          targetPublicId: targetProfileId,
          reason: 'OTHER',
          details: 'Fixture'
        }
      })
      await base.t.run(async (ctx) => {
        const row = await ctx.db
          .query('socialReports')
          .withIndex('by_publicId', (q) => q.eq('id', report.reportPublicId))
          .unique()
        if (!row) throw new Error('Missing fixture report.')
        await ctx.db.patch(row._id, {
          status: 'DISMISSED',
          queuePriority: 2,
          reviewStartedAt: '2024-01-01T00:00:00.000Z',
          resolvedAt: '2024-08-01T00:00:00.000Z',
          updatedAt: '2024-08-01T00:00:00.000Z'
        })
        await ctx.db.insert(
          'socialModerationActions',
          socialStoredModerationActionSchema.parse({
            id: crypto.randomUUID(),
            moderatorUserId: base.owner.userId,
            reportId: report.reportPublicId,
            action: 'VIEWED',
            affectedProfileId: null,
            affectedListingId: null,
            reason: 'Fixture audit',
            beforeState: { reportStatus: 'DISMISSED', reportVersion: 0 },
            afterState: { reportStatus: 'DISMISSED', reportVersion: 0 },
            createdAt: '2024-08-02T00:00:00.000Z'
          })
        )
      })
      expect(
        await base.t.query(previewFixturePage, {
          ...base.args,
          input: {
            phase: 'REPORTS',
            asOf,
            paginationOpts: { cursor: null, numItems: 8 }
          }
        })
      ).toMatchObject({ fixtureOnly: true, eligible: 1 })
      expect(
        await base.t.mutation(applyFixturePage, {
          ...base.args,
          input: input('REPORTS')
        })
      ).toMatchObject({ deleted: 1 })
      await base.t.finishAllScheduledFunctions(vi.runAllTimers)
      expect(await base.t.run((ctx) => ctx.db.query('socialModerationActions').collect())).toEqual(
        []
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects a foreign moderator audit before report retention can schedule cleanup', async () => {
    const base = await setup()
    const targetProfileId = await base.t.run(async (ctx) => {
      const profile = await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique()
      if (!profile) throw new Error('Missing target profile.')
      return profile.id
    })
    const report = await base.owner.caller.mutation(api.social.reports.create, {
      input: {
        targetKind: 'PROFILE',
        targetPublicId: targetProfileId,
        reason: 'OTHER',
        details: 'Fixture'
      }
    })
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('socialReports')
        .withIndex('by_publicId', (q) => q.eq('id', report.reportPublicId))
        .unique()
      if (!row) throw new Error('Missing fixture report.')
      await ctx.db.patch(row._id, {
        status: 'DISMISSED',
        queuePriority: 2,
        reviewStartedAt: '2024-01-01T00:00:00.000Z',
        resolvedAt: '2024-08-01T00:00:00.000Z',
        updatedAt: '2024-08-01T00:00:00.000Z'
      })
      await ctx.db.insert(
        'socialModerationActions',
        socialStoredModerationActionSchema.parse({
          id: crypto.randomUUID(),
          moderatorUserId: crypto.randomUUID(),
          reportId: report.reportPublicId,
          action: 'VIEWED',
          affectedProfileId: null,
          affectedListingId: null,
          reason: 'Foreign fixture audit',
          beforeState: { reportStatus: 'DISMISSED', reportVersion: 0 },
          afterState: { reportStatus: 'DISMISSED', reportVersion: 0 },
          createdAt: '2024-08-02T00:00:00.000Z'
        })
      )
    })
    const before = await base.t.run(async (ctx) => ({
      reports: await ctx.db.query('socialReports').collect(),
      audits: await ctx.db.query('socialModerationActions').collect(),
      jobs: await ctx.db.system.query('_scheduled_functions').collect()
    }))
    expect(
      await base.t.query(previewFixturePage, {
        ...base.args,
        input: { phase: 'REPORTS', asOf, paginationOpts: { cursor: null, numItems: 8 } }
      })
    ).toMatchObject({ fixtureOnly: false, eligible: 1 })
    await expect(
      base.t.mutation(applyFixturePage, { ...base.args, input: input('REPORTS') })
    ).rejects.toThrow('Fixture retention page contains foreign records.')
    expect(
      await base.t.run(async (ctx) => ({
        reports: await ctx.db.query('socialReports').collect(),
        audits: await ctx.db.query('socialModerationActions').collect(),
        jobs: await ctx.db.system.query('_scheduled_functions').collect()
      }))
    ).toEqual(before)
  })

  it.each(['INVITATIONS', 'APPLICATIONS', 'REPORTS'] as const)(
    'checks and serves the %s page from one paginated read',
    async (phase) => {
      const base = await setup()
      const page = { phase, asOf, paginationOpts: { cursor: null, numItems: 8 } }
      expect(await base.t.query(previewFixturePage, { ...base.args, input: page })).toMatchObject({
        fixtureOnly: true
      })
      expect(
        await base.t.mutation(applyFixturePage, { ...base.args, input: input(phase) })
      ).toMatchObject({ deleted: 0 })
    }
  )

  it('preserves empty-page continuation metadata', async () => {
    const base = await setup()
    const empty: SocialRetentionPreviewInput = {
      phase: 'REPORTS',
      asOf,
      paginationOpts: { cursor: null, numItems: 8 }
    }
    const [expected, result] = await Promise.all([
      base.t.query(preview, empty),
      base.t.query(previewFixturePage, { ...base.args, input: empty })
    ])
    expect(result).toEqual({ ...expected, fixtureOnly: true })
  })
})
